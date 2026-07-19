import * as admin from 'firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import type { AppointmentDoc, ResolvedTest, SampleType } from '../types'
import { assertTransition } from './appointmentStateMachine'

export interface SampleDraft {
  sampleType: SampleType
  testIds: string[]
}

export interface ResolvedSampleGroup {
  label: string
  testIds: string[]
  sampleType: SampleType
}

/**
 * Derives sample drafts from a frozen resolvedTests snapshot.
 *
 * When `resolvedSampleGroups` is provided (frozen at confirm time from the package's tube-split
 * configuration), each group becomes exactly one physical sample/barcode. Any tests not covered
 * by a group fall back to the auto-grouping behaviour (one sample per distinct sampleType).
 *
 * Without `resolvedSampleGroups`: one sample per distinct sampleType (original behaviour).
 */
export function deriveSamples(
  resolvedTests: ResolvedTest[],
  resolvedSampleGroups?: ResolvedSampleGroup[],
): SampleDraft[] {
  if (resolvedSampleGroups && resolvedSampleGroups.length > 0) {
    const covered = new Set(resolvedSampleGroups.flatMap((g) => g.testIds))
    const explicit = resolvedSampleGroups.map((g) => ({ sampleType: g.sampleType, testIds: g.testIds }))

    // Any tests not in a named group (e.g. manually added tests): group by sampleType as before.
    const byType = new Map<SampleType, string[]>()
    for (const rt of resolvedTests) {
      if (covered.has(rt.testId)) continue
      const list = byType.get(rt.sampleType)
      if (list) list.push(rt.testId)
      else byType.set(rt.sampleType, [rt.testId])
    }

    return [
      ...explicit,
      ...Array.from(byType.entries()).map(([sampleType, testIds]) => ({ sampleType, testIds })),
    ]
  }

  const byType = new Map<SampleType, string[]>()
  for (const rt of resolvedTests) {
    const list = byType.get(rt.sampleType)
    if (list) list.push(rt.testId)
    else byType.set(rt.sampleType, [rt.testId])
  }
  return Array.from(byType.entries()).map(([sampleType, testIds]) => ({ sampleType, testIds }))
}

interface CounterState {
  year: number
  seq: number
}

/** Pure helper so the live per-appointment reservation (inline in a transaction) and the
 * standalone migration reservation (its own transaction) compute ranges identically. */
function computeReservedRange(
  current: CounterState | undefined,
  year: number,
  count: number,
): { ids: string[]; next: CounterState } {
  const startSeq = (current?.year === year ? current.seq : 0) + 1
  const ids = Array.from(
    { length: count },
    (_, i) => `S-${year}-${String(startSeq + i).padStart(6, '0')}`,
  )
  return { ids, next: { year, seq: startSeq + count - 1 } }
}

/**
 * Reserves `count` globally-unique, year-scoped sample IDs in a single transaction on
 * `config/sampleCounter`. Used standalone by the migration script, which reserves one large
 * contiguous range up front for the whole backfill instead of touching the counter document
 * once per legacy appointment — hitting a single hot document thousands of times in a tight
 * loop would serialize the migration to roughly one write/sec under Firestore's per-document
 * contention limits.
 */
export async function reserveSampleIds(count: number): Promise<string[]> {
  if (count === 0) return []
  const db = admin.firestore()
  const ref = db.doc('config/sampleCounter')
  const year = new Date().getFullYear()
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    const { ids, next } = computeReservedRange(snap.data() as CounterState | undefined, year, count)
    tx.set(ref, next)
    return ids
  })
}

/**
 * Generates (or resumes generating) samples for a confirmed appointment. Implements the
 * atomic claim -> reserve -> batch-write flow:
 *
 *  1. One transaction reads the appointment and, only if status === 'Confirmed', reserves the
 *     sample IDs (inline, against the SAME `config/sampleCounter` document, in the SAME
 *     transaction) and records the decided {id, sampleType, testIds} list on the appointment as
 *     `pendingSamples` while flipping status -> 'SamplesGenerating'. This is the only place a
 *     range is ever reserved for a given appointment — a concurrent second caller reading the
 *     appointment mid-transaction will see 'SamplesGenerating' already, not 'Confirmed', so it
 *     skips reservation and just reads back the same `pendingSamples` decided by the first.
 *  2. Outside the transaction, a single WriteBatch creates every sample doc from
 *     `pendingSamples` (via `set`, not `create`, so re-running this step after a partial
 *     failure — or a benign concurrent duplicate run — overwrites with identical content
 *     rather than erroring or duplicating) and flips the appointment to 'SamplesGenerated'.
 *
 * If step 2 fails (crash, timeout) the appointment is left in 'SamplesGenerating' with
 * `pendingSamples` already decided — calling this function again resumes from step 2 using the
 * exact same ids, so no sample or barcode is ever generated twice for one appointment.
 */
export async function generateSamplesForAppointment(
  appointmentId: string,
): Promise<{ sampleIds: string[] }> {
  const db = admin.firestore()
  const apptRef = db.collection('appointments').doc(appointmentId)
  const counterRef = db.doc('config/sampleCounter')

  const claim = await db.runTransaction(async (tx) => {
    const apptSnap = await tx.get(apptRef)
    if (!apptSnap.exists) throw new Error('Appointment not found')
    const appt = apptSnap.data() as AppointmentDoc

    if (appt.status === 'SamplesGenerated') {
      return { done: true as const, sampleIds: appt.sampleIds }
    }
    if (appt.status === 'SamplesGenerating' && appt.pendingSamples) {
      return { done: false as const, pendingSamples: appt.pendingSamples, patientId: appt.patientId }
    }
    if (appt.status !== 'Confirmed') {
      assertTransition(appt.status, 'SamplesGenerating')
    }

    const drafts = deriveSamples(appt.resolvedTests, appt.resolvedSampleGroups)
    if (drafts.length === 0) {
      throw new Error('Cannot generate samples for an appointment with no resolved tests')
    }

    const counterSnap = await tx.get(counterRef)
    const year = new Date().getFullYear()
    const { ids, next } = computeReservedRange(counterSnap.data() as CounterState | undefined, year, drafts.length)
    tx.set(counterRef, next)

    const pendingSamples = drafts.map((draft, i) => ({
      id: ids[i],
      sampleType: draft.sampleType,
      testIds: draft.testIds,
    }))

    tx.update(apptRef, {
      status: 'SamplesGenerating',
      pendingSamples,
      updatedAt: FieldValue.serverTimestamp(),
    })

    return { done: false as const, pendingSamples, patientId: appt.patientId }
  })

  if (claim.done) {
    return { sampleIds: claim.sampleIds }
  }

  const now = FieldValue.serverTimestamp()
  const batch = db.batch()
  for (const sample of claim.pendingSamples) {
    // The sample's own globally-unique ID doubles as its barcode value — CODE128 encodes it
    // directly, and it removes an entire axis of complexity (no separate random suffix that
    // could theoretically collide) for no loss of traceability.
    batch.set(db.collection('samples').doc(sample.id), {
      id: sample.id,
      appointmentId,
      patientId: claim.patientId,
      sampleType: sample.sampleType,
      testIds: sample.testIds,
      barcodeId: sample.id,
      collectionStatus: 'pending',
      createdAt: now,
      updatedAt: now,
    })
  }
  const sampleIds = claim.pendingSamples.map((s) => s.id)
  batch.update(apptRef, {
    status: 'SamplesGenerated',
    sampleIds,
    pendingSamples: FieldValue.delete(),
    updatedAt: now,
  })
  await batch.commit()

  return { sampleIds }
}
