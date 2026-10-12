import { Router, Response } from 'express'
import * as admin from 'firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import { verifyAuth, AuthRequest } from '../middleware/verifyAuth'
import { requireSelfOrAdmin, isAdminUser } from '../middleware/authz'
import { asyncHandler } from '../middleware/asyncHandler'
import { reserveSampleIds } from '../services/sampleGeneration'
import { assertTransition } from '../services/appointmentStateMachine'
import type { AppointmentDoc, SampleDoc } from '../types'

const router = Router()

async function getSampleOr404(id: string, res: Response): Promise<SampleDoc | null> {
  const snap = await admin.firestore().collection('samples').doc(id).get()
  if (!snap.exists) {
    res.status(404).json({ error: 'Sample not found' })
    return null
  }
  return { id: snap.id, ...snap.data() } as SampleDoc
}

function respondSample(res: Response, status: number, sample: object): void {
  res.status(status).json({ ...sample, createdAt: null, updatedAt: null })
}

// ─── GET /api/samples/:id ─────────────────────────────────────────────────────
router.get('/:id', verifyAuth, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const sample = await getSampleOr404(req.params.id, res)
  if (!sample) return
  if (!(await requireSelfOrAdmin(req, res, sample.patientId))) return
  respondSample(res, 200, sample)
}))

// ─── POST /api/samples/:id/collect ────────────────────────────────────────────
router.post('/:id/collect', verifyAuth, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user || !(await isAdminUser(req.user.uid))) {
    res.status(403).json({ error: 'Forbidden: admin access required' })
    return
  }
  const sample = await getSampleOr404(req.params.id, res)
  if (!sample) return

  if (sample.collectionStatus !== 'pending') {
    res.status(409).json({ error: `Sample is already '${sample.collectionStatus}', not 'pending'` })
    return
  }

  const { collector, remarks } = (req.body ?? {}) as Record<string, unknown>
  if (typeof collector !== 'string' || !collector.trim()) {
    res.status(400).json({ error: 'collector is required' })
    return
  }
  if (remarks !== undefined && typeof remarks !== 'string') {
    res.status(400).json({ error: 'remarks must be a string' })
    return
  }

  const ref = admin.firestore().collection('samples').doc(sample.id)
  await ref.update({
    collectionStatus: 'collected',
    collector: collector.trim(),
    collectionDatetime: FieldValue.serverTimestamp(),
    ...(remarks ? { remarks: remarks.trim() } : {}),
    updatedAt: FieldValue.serverTimestamp(),
  })

  // Appointment status advances SamplesGenerated -> SamplesCollected automatically once every
  // non-rejected sample for it is collected — rejected samples are excluded from this check so
  // a single rejection-and-redraw doesn't permanently block the appointment from ever reaching
  // SamplesCollected (its replacement sample is what actually has to be collected instead).
  const siblingsSnap = await admin
    .firestore()
    .collection('samples')
    .where('appointmentId', '==', sample.appointmentId)
    .get()
  const siblings = siblingsSnap.docs.map((d) => d.data() as SampleDoc)
  const allCollected = siblings
    .filter((s) => s.collectionStatus !== 'rejected')
    .every((s) => s.id === sample.id || s.collectionStatus === 'collected')

  if (allCollected) {
    const apptRef = admin.firestore().collection('appointments').doc(sample.appointmentId)
    const apptSnap = await apptRef.get()
    const appt = apptSnap.data() as AppointmentDoc | undefined
    if (appt && appt.status === 'SamplesGenerated') {
      try {
        assertTransition(appt.status, 'SamplesCollected')
        await apptRef.update({ status: 'SamplesCollected', updatedAt: FieldValue.serverTimestamp() })
      } catch {
        // Not a legal transition from the appointment's current state — leave it as-is rather
        // than throwing, since the sample itself was already successfully marked collected.
      }
    }
  }

  const updated = await ref.get()
  respondSample(res, 200, { id: updated.id, ...updated.data() })
}))

// ─── POST /api/samples/:id/print ──────────────────────────────────────────────
// Read-only — returns the label payload for the client to render/print. Printing can never
// mutate or (re)generate a barcode; that only ever happens once, at sample-creation time.
router.post('/:id/print', verifyAuth, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const sample = await getSampleOr404(req.params.id, res)
  if (!sample) return
  if (!(await requireSelfOrAdmin(req, res, sample.patientId))) return

  const db = admin.firestore()
  const [apptSnap, testDocs] = await Promise.all([
    db.collection('appointments').doc(sample.appointmentId).get(),
    Promise.all(sample.testIds.map((id) => db.collection('tests').doc(id).get())),
  ])
  type ApptShape = {
    patientName?: string
    date?: string
    timeSlot?: string
    resolvedSampleGroups?: Array<{ label: string; testIds: string[] }>
  }
  const appt = apptSnap.data() as ApptShape | undefined
  const existingTestDocs = testDocs.filter((d) => d.exists)

  // Prefer the resolvedSampleGroup label (e.g. "Lavender", "Red") — it's set by the admin
  // at confirm time and is the authoritative tube-color name for this sample group.
  // Fall back to tubeColor on the test doc if no matching group exists.
  const matchingGroup = appt?.resolvedSampleGroups?.find((g) =>
    sample.testIds.some((id) => g.testIds.includes(id)),
  )
  const tubeColor =
    matchingGroup?.label ??
    existingTestDocs.map((d) => (d.data() as { tubeColor?: string }).tubeColor).find(Boolean) ??
    ''

  res.json({
    sampleId: sample.id,
    barcodeId: sample.barcodeId,
    sampleType: sample.sampleType,
    patientName: appt?.patientName ?? '',
    date: appt?.date ?? '',
    timeSlot: appt?.timeSlot ?? '',
    testNames: existingTestDocs.map((d) => (d.data() as { name: string }).name),
    tubeColor,
  })
}))

// ─── POST /api/samples/:id/reject ─────────────────────────────────────────────
// Creates a NEW sample (fresh id + barcode) rather than mutating the rejected one, preserving a
// full audit trail of what happened to the original draw. The replacement's testIds are copied
// verbatim from the rejected sample — never re-derived from the appointment's resolvedTests —
// so a test's sampleType changing after the fact can't retroactively change what the
// replacement is grouped as.
router.post('/:id/reject', verifyAuth, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user || !(await isAdminUser(req.user.uid))) {
    res.status(403).json({ error: 'Forbidden: admin access required' })
    return
  }
  const sample = await getSampleOr404(req.params.id, res)
  if (!sample) return

  if (sample.collectionStatus === 'rejected') {
    res.status(409).json({ error: 'Sample is already rejected' })
    return
  }

  const { remarks } = (req.body ?? {}) as Record<string, unknown>
  if (typeof remarks !== 'string' || !remarks.trim()) {
    res.status(400).json({ error: 'remarks is required when rejecting a sample' })
    return
  }

  const db = admin.firestore()
  const [replacementId] = await reserveSampleIds(1)
  const now = FieldValue.serverTimestamp()

  const batch = db.batch()
  batch.update(db.collection('samples').doc(sample.id), {
    collectionStatus: 'rejected',
    remarks: remarks.trim(),
    updatedAt: now,
  })
  batch.set(db.collection('samples').doc(replacementId), {
    id: replacementId,
    appointmentId: sample.appointmentId,
    patientId: sample.patientId,
    sampleType: sample.sampleType,
    testIds: sample.testIds,
    barcodeId: replacementId,
    collectionStatus: 'pending',
    remarks: `Replacement for rejected sample ${sample.id}`,
    createdAt: now,
    updatedAt: now,
  })
  batch.update(db.collection('appointments').doc(sample.appointmentId), {
    sampleIds: FieldValue.arrayUnion(replacementId),
    updatedAt: now,
  })
  await batch.commit()

  res.json({ rejectedSampleId: sample.id, replacementSampleId: replacementId })
}))

export default router
