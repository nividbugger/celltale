/**
 * Local type definitions for the `api` Cloud Function package. Mirrors the shapes in
 * `src/types/index.ts` but is intentionally NOT shared/imported across the api/functions/src
 * package boundary (no shared-types package exists in this repo — each package already
 * defines its own local interfaces, e.g. `adminTests.ts`'s `TestParameter`).
 */

export type SampleType = 'blood' | 'urine' | 'stool' | 'swab' | 'other'

export type AppointmentStatus =
  | 'Created'
  | 'Confirmed'
  | 'SamplesGenerating'
  | 'SamplesGenerated'
  | 'SamplesCollected'
  | 'InLaboratory'
  | 'ReportGenerated'
  | 'ReportUploaded'
  | 'Completed'
  | 'Cancelled'
  | 'Deleted'

export interface AppointmentPackageEntry {
  packageId: string
  packageName: string
  priceAtBooking: number
}

export interface ResolvedTest {
  testId: string
  name: string
  sampleType: SampleType
  cost: number
  origin: 'package' | 'manual'
  sourcePackageId?: string
}

export type SampleCollectionStatus = 'pending' | 'collected' | 'rejected'

export interface SampleDoc {
  id: string
  appointmentId: string
  patientId: string
  sampleType: SampleType
  testIds: string[]
  barcodeId: string
  collectionStatus: SampleCollectionStatus
  collectionDatetime?: unknown
  collector?: string
  remarks?: string
  createdAt: unknown
  updatedAt: unknown
}

/** Minimal shape of a `tests/{id}` doc needed by the services in this package. */
export interface TestDoc {
  id: string
  name: string
  sampleType?: SampleType
  cost?: number
}

/** Minimal shape of a `packages/{id}` doc needed by the services in this package. */
export interface PackageDoc {
  id: string
  name: string
  testIds: string[]
}

/** Minimal shape of an `appointments/{id}` doc needed by the services/routes in this package. */
export interface AppointmentDoc {
  id: string
  patientId: string
  patientName: string
  patientPhone: string
  packages: AppointmentPackageEntry[]
  manualTestIds: string[]
  resolvedTests: ResolvedTest[]
  sampleIds: string[]
  /** Set while status === 'SamplesGenerating': the sample docs already reserved/decided for
   * this generation attempt, so a retry after a crash writes the SAME ids/content instead of
   * re-reserving a fresh, orphaned range. Cleared once status reaches 'SamplesGenerated'.
   * Internal generation-lock state — not exposed in the frontend Appointment type. */
  pendingSamples?: Array<{ id: string; sampleType: SampleType; testIds: string[] }>
  totalCost: number
  /** Admin-set override for the estimated/final cost — takes precedence over the sum of
   * resolvedTests[].cost wherever cost is computed (summary preview and confirm()). `null`
   * (or absent) means "use the computed sum," not "cost is zero." */
  costOverride?: number | null
  invoiceId?: string
  date: string
  timeSlot: string
  collectionAddress: string
  status: AppointmentStatus
  notes?: string
  // Legacy fields, read-only.
  packageId?: string
  packageName?: string
  packagePrice?: number
  barcodeId?: string
  legacyStatus?: string
}
