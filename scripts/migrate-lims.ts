/**
 * One-off backfill migrating the pre-refactor Patient -> Package -> Barcode data model to
 * Patient -> Appointment -> Tests -> Samples -> Barcode -> Reports. See
 * docs/lims-architecture-refactor.md §13 for the full design; this is a direct implementation
 * of that plan with one deliberate simplification: placeholder samples use a deterministic ID
 * (`S-LEGACY-{appointmentId}`) instead of a counter-reserved range. That single change kills
 * two birds the design doc originally treated separately — it makes a placeholder's existence
 * independently checkable by ID alone (real idempotency, not just a batch-write retry), AND it
 * means this script never touches `config/sampleCounter` at all, so there's no hot-document
 * contention to solve in the first place.
 *
 * NOT deployed as a Cloud Function — run manually, once, during the agreed downtime window.
 *
 * Usage:
 *   npm install
 *   npx ts-node migrate-lims.ts --project <firebase-project-id> [--dry-run] [--concurrency 20]
 *
 * Auth: uses Application Default Credentials. Either run
 *   `gcloud auth application-default login`
 * first, or set GOOGLE_APPLICATION_CREDENTIALS to a service account key path.
 *
 * To run against the Firestore emulator instead of production, set FIRESTORE_EMULATOR_HOST
 * (e.g. `FIRESTORE_EMULATOR_HOST=localhost:8080`) before invoking — the Admin SDK detects it
 * automatically and no credentials are needed.
 */
import * as admin from 'firebase-admin'

// ─── Types (local — no shared-types package exists across the api/functions/src/scripts
// package boundaries in this repo; see api/src/types.ts for the same pattern) ───────────────

type SampleType = 'blood' | 'urine' | 'stool' | 'swab' | 'other'
type LegacyStatus = 'Pending' | 'Confirmed' | 'Sample Collected' | 'Report Ready' | 'Completed' | 'Cancelled' | 'Deleted'
type NewStatus =
  | 'Created' | 'Confirmed' | 'SamplesGenerating' | 'SamplesGenerated' | 'SamplesCollected'
  | 'InLaboratory' | 'ReportGenerated' | 'ReportUploaded' | 'Completed' | 'Cancelled' | 'Deleted'

const LEGACY_STATUS_MAP: Record<LegacyStatus, NewStatus> = {
  Pending: 'Created',
  Confirmed: 'Confirmed',
  'Sample Collected': 'SamplesCollected',
  'Report Ready': 'ReportUploaded',
  Completed: 'Completed',
  Cancelled: 'Cancelled',
  Deleted: 'Deleted',
}

const STATUSES_NEEDING_PLACEHOLDER_SAMPLE: LegacyStatus[] = ['Sample Collected', 'Report Ready', 'Completed']

interface TestDoc { id: string; name: string; sampleType?: SampleType; cost?: number }
interface PackageDoc { id: string; name: string; price?: number; testIds: string[] }
interface LegacyAppointmentDoc {
  id: string
  patientId: string
  status: LegacyStatus
  packageId?: string
  packageName?: string
  packagePrice?: number
  barcodeId?: string
  packages?: unknown // presence of this field means already migrated
}

// ─── CLI args ─────────────────────────────────────────────────────────────────

interface Args { project: string; dryRun: boolean; concurrency: number }

function parseArgs(): Args {
  const argv = process.argv.slice(2)
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag)
    return i >= 0 ? argv[i + 1] : undefined
  }
  const project = get('--project') ?? process.env.GCLOUD_PROJECT
  if (!project) {
    console.error('Usage: ts-node migrate-lims.ts --project <firebase-project-id> [--dry-run] [--concurrency N]')
    process.exit(1)
  }
  return {
    project,
    dryRun: argv.includes('--dry-run'),
    concurrency: Number(get('--concurrency') ?? '20'),
  }
}

// ─── Concurrency-limited map ──────────────────────────────────────────────────

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  return results
}

// ─── Step 1: backfill tests.sampleType ────────────────────────────────────────

async function backfillTestSampleTypes(db: admin.firestore.Firestore, dryRun: boolean): Promise<Map<string, TestDoc>> {
  const snap = await db.collection('tests').get()
  const testsById = new Map<string, TestDoc>()
  let toBackfill = 0

  const batch = db.batch()
  for (const doc of snap.docs) {
    const data = doc.data() as TestDoc
    const sampleType = data.sampleType ?? 'other'
    testsById.set(doc.id, { id: doc.id, name: data.name, sampleType, cost: data.cost })
    if (!data.sampleType) {
      toBackfill++
      if (!dryRun) batch.update(doc.ref, { sampleType: 'other' })
    }
  }
  console.log(`[migrate-lims] tests: ${snap.size} total, ${toBackfill} missing sampleType (backfilling to 'other')`)
  if (!dryRun && toBackfill > 0) await batch.commit()
  return testsById
}

async function loadPackages(db: admin.firestore.Firestore): Promise<Map<string, PackageDoc>> {
  const snap = await db.collection('packages').get()
  const byId = new Map<string, PackageDoc>()
  snap.docs.forEach((d) => byId.set(d.id, { id: d.id, ...(d.data() as Omit<PackageDoc, 'id'>) }))
  return byId
}

// ─── Step 2: per-appointment migration ────────────────────────────────────────

interface MigrationResult { appointmentId: string; skipped: boolean; needsReview: boolean }

async function migrateAppointment(
  db: admin.firestore.Firestore,
  appointmentId: string,
  packagesById: Map<string, PackageDoc>,
  testsById: Map<string, TestDoc>,
  dryRun: boolean,
): Promise<MigrationResult> {
  const ref = db.collection('appointments').doc(appointmentId)

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists) return { appointmentId, skipped: true, needsReview: false }
    const data = snap.data() as LegacyAppointmentDoc

    // Idempotency guard — if `packages` already exists (an array field only the new model
    // writes), this appointment has already been migrated; re-running the script is a no-op.
    if (Array.isArray(data.packages)) {
      return { appointmentId, skipped: true, needsReview: false }
    }

    const legacyStatus = data.status
    const newStatus = LEGACY_STATUS_MAP[legacyStatus] ?? 'Created'
    const pkg = data.packageId ? packagesById.get(data.packageId) : undefined

    // Provenance is denormalized data — preserve it even if the source package was since
    // deleted; only test-list *derivation* requires the live package to still exist.
    const packages = data.packageId
      ? [{
          packageId: data.packageId,
          packageName: data.packageName ?? pkg?.name ?? 'Unknown Package',
          priceAtBooking: data.packagePrice ?? pkg?.price ?? 0,
        }]
      : []

    const testIds = pkg?.testIds ?? []
    const resolvedTests = testIds
      .map((testId) => {
        const t = testsById.get(testId)
        if (!t) return null
        return {
          testId,
          name: t.name,
          sampleType: t.sampleType ?? 'other',
          cost: t.cost ?? 0,
          origin: 'package' as const,
          sourcePackageId: data.packageId,
        }
      })
      .filter((t): t is NonNullable<typeof t> => t !== null)

    // Prefer the historical quoted price over recomputing from current test costs, so a
    // migrated appointment's totalCost matches what the patient was actually charged at the
    // time, not what the same tests would cost today.
    const totalCost = data.packagePrice ?? resolvedTests.reduce((sum, t) => sum + t.cost, 0)

    const needsPlaceholder = STATUSES_NEEDING_PLACEHOLDER_SAMPLE.includes(legacyStatus)
    let sampleIds: string[] = []
    let needsReview = false

    if (needsPlaceholder) {
      if (resolvedTests.length === 0) {
        // Old status implies a sample should exist, but we can't derive what tests it covered
        // (package deleted, or appointment never had package/test info at all) — flag for
        // manual review rather than guessing.
        needsReview = true
      } else {
        const placeholderId = `S-LEGACY-${appointmentId}`
        sampleIds = [placeholderId]
        if (!dryRun) {
          tx.set(db.collection('samples').doc(placeholderId), {
            id: placeholderId,
            appointmentId,
            patientId: data.patientId,
            sampleType: 'other', // legacy appointments never tracked per-sample-type splits
            testIds: resolvedTests.map((t) => t.testId),
            barcodeId: data.barcodeId ?? placeholderId,
            collectionStatus: 'collected',
            remarks: 'Auto-migrated from legacy appointment, pre-Sample-entity data model',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          })
        }
      }
    } else if (data.packageId && resolvedTests.length === 0) {
      // Confirmed-or-earlier appointment whose test list came back empty — either the package
      // was deleted, or (more likely if your `tests` collection is still sparsely populated)
      // the package exists but has no `testIds` configured yet. Either way, flag it: silently
      // freezing an empty resolvedTests for a 'Confirmed' appointment would be wrong, not just
      // incomplete.
      needsReview = true
    }

    if (!dryRun) {
      tx.update(ref, {
        packages,
        manualTestIds: [],
        resolvedTests,
        sampleIds,
        totalCost,
        status: newStatus,
        legacyStatus,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      })
    }

    return { appointmentId, skipped: false, needsReview }
  })
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs()
  admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: args.project })
  const db = admin.firestore()

  console.log(`[migrate-lims] project=${args.project} dryRun=${args.dryRun} concurrency=${args.concurrency}`)

  const testsById = await backfillTestSampleTypes(db, args.dryRun)
  const packagesById = await loadPackages(db)
  console.log(`[migrate-lims] loaded ${packagesById.size} packages, ${testsById.size} tests`)

  const apptSnap = await db.collection('appointments').get()
  const appointmentIds = apptSnap.docs.map((d) => d.id)
  console.log(`[migrate-lims] ${appointmentIds.length} appointments to process`)

  const results = await mapWithConcurrency(appointmentIds, args.concurrency, (id) =>
    migrateAppointment(db, id, packagesById, testsById, args.dryRun).catch((err) => {
      console.error(`[migrate-lims] FAILED appointment ${id}:`, err)
      return { appointmentId: id, skipped: false, needsReview: true }
    }),
  )

  const migrated = results.filter((r) => !r.skipped)
  const alreadyDone = results.filter((r) => r.skipped)
  const review = results.filter((r) => r.needsReview)

  console.log(`[migrate-lims] done. migrated=${migrated.length} already-migrated=${alreadyDone.length} needs-review=${review.length}`)
  if (review.length > 0) {
    console.log('[migrate-lims] MANUAL REVIEW REQUIRED for appointment IDs:')
    review.forEach((r) => console.log(`  - ${r.appointmentId}`))
  }
  if (args.dryRun) {
    console.log('[migrate-lims] --dry-run: no writes were committed.')
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[migrate-lims] fatal error:', err)
    process.exit(1)
  })
