/**
 * Typed HTTP client for the CellTale API.
 *
 * Every request is automatically authenticated with the current user's Firebase
 * ID token (Bearer scheme). The token is refreshed silently by the Firebase SDK
 * when it nears expiry — no manual refresh logic needed here.
 *
 * Base URL:
 *   Production  → "/api"  (resolved via the Firebase Hosting rewrite rule)
 *   Local dev   → set VITE_API_BASE_URL in your .env.local, e.g.
 *                 VITE_API_BASE_URL=http://localhost:5001/celltalediagnostics-8f817/asia-south1/api
 */

import { auth } from './firebase'

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api'

// ─── Types ────────────────────────────────────────────────────────────────────

export type EmailType =
  | 'welcome'
  | 'appointment_booked'
  | 'appointment_confirmed'
  | 'sample_collected'
  | 'report_ready'

export interface SendEmailRequest {
  type: EmailType
  to: string
  data: {
    patientName: string
    packageName?: string
    packagePrice?: number
    date?: string
    timeSlot?: string
    collectionAddress?: string
    appointmentId?: string
    notes?: string
  }
}

export interface EmailQueueItem {
  id: string
  type: EmailType
  to: string
  status: 'pending' | 'sent' | 'failed'
  createdAt: unknown
  data: Record<string, unknown>
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const user = auth.currentUser
  if (!user) {
    throw new Error('Not authenticated. Please log in.')
  }

  // getIdToken() returns a cached token, refreshing automatically when expired.
  const token = await user.getIdToken()

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })

  const body = await response.json().catch(() => ({}))

  if (!response.ok) {
    // Use the server-supplied error message, fall back to HTTP status text
    const message: string =
      (body as { error?: string }).error ??
      `Request failed: ${response.status} ${response.statusText}`
    throw new Error(message)
  }

  return body as T
}

// ─── Email API ────────────────────────────────────────────────────────────────

/** Admin: manually send a transactional email (e.g. resend a confirmation). */
export async function sendEmailApi(payload: SendEmailRequest): Promise<{ success: boolean; message: string }> {
  return apiFetch('/email/send', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/** Admin: list items from the mailQueue collection. */
export async function getEmailQueue(
  options: { status?: 'pending' | 'sent' | 'failed'; limit?: number } = {},
): Promise<{ items: EmailQueueItem[]; count: number }> {
  const params = new URLSearchParams()
  if (options.status) params.set('status', options.status)
  if (options.limit)  params.set('limit', String(options.limit))

  const qs = params.toString()
  return apiFetch(`/email/queue${qs ? `?${qs}` : ''}`)
}

// ─── Admin: Patients API ──────────────────────────────────────────────────────

export interface RegisterPatientRequest {
  name: string
  phone: string
  email?: string
  company?: string
  age?: number
  gender?: string
  additionalInfo?: string
}

export interface UpdatePatientRequest {
  name?: string
  phone?: string
  email?: string
  company?: string
  age?: number
  gender?: string
  additionalInfo?: string
}

export interface AdminPatientRecord {
  uid: string
  name: string
  phone: string
  email: string
  company?: string
  age?: number
  gender?: string
  additionalInfo?: string
  role: 'patient'
}

/** Admin: register a patient met in person (e.g. a company/school camp) by name + phone. */
export async function registerPatient(payload: RegisterPatientRequest): Promise<AdminPatientRecord> {
  return apiFetch('/admin/patients', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/** Admin: edit an existing patient's details. */
export async function updatePatient(
  uid: string,
  payload: UpdatePatientRequest,
): Promise<AdminPatientRecord> {
  return apiFetch(`/admin/patients/${encodeURIComponent(uid)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export interface DeletePatientResult {
  success: boolean
  deletedAppointments: number
  deletedSamples: number
  deletedReports: number
}

/** Admin: permanently deletes a patient's login account and every appointment/sample/report
 * tied to them. Irreversible — if this person walks in again, they're a brand-new patient. */
export async function deletePatient(uid: string): Promise<DeletePatientResult> {
  return apiFetch(`/admin/patients/${encodeURIComponent(uid)}`, { method: 'DELETE' })
}

// ─── Admin: Parameters API ───────────────────────────────────────────────────

export interface DiagnosticParameterInput {
  code: string
  analyzer: string
  loinc?: string | null
  name: string
  discipline: string
  tubeColor: string
  additive?: string
  unit: string
  refLow?: number | null
  refHigh?: number | null
  sex: 'ALL' | 'M' | 'F'
  refText?: string | null
}

export interface DiagnosticParameterRecord extends DiagnosticParameterInput {
  id: string
}

export async function createParameter(payload: DiagnosticParameterInput): Promise<DiagnosticParameterRecord> {
  return apiFetch('/admin/parameters', { method: 'POST', body: JSON.stringify(payload) })
}

export async function updateParameter(
  id: string,
  payload: DiagnosticParameterInput,
): Promise<DiagnosticParameterRecord> {
  return apiFetch(`/admin/parameters/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function deleteParameter(id: string): Promise<{ success: boolean }> {
  return apiFetch(`/admin/parameters/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

// ─── Admin: Tests API ─────────────────────────────────────────────────────────

export interface TestParameter {
  parameter: string
  unit: string
  biologicalReference: string
}

export interface CreateTestRequest {
  name: string
  parameters: TestParameter[]
  cost?: number
  tubeColor?: string
  machineCode?: string
  category?: string
}

export interface UpdateTestRequest {
  name?: string
  parameters?: TestParameter[]
  cost?: number
  tubeColor?: string | null
  machineCode?: string | null
  category?: string | null
}

export interface AdminTestRecord {
  id: string
  testId: string
  machineCode?: string
  category?: string
  isActive?: boolean
  name: string
  parameters: TestParameter[]
  cost?: number
  tubeColor?: string
}

/** Admin: create a new test configuration. */
export async function createTest(payload: CreateTestRequest): Promise<AdminTestRecord> {
  return apiFetch('/admin/tests', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/** Admin: update an existing test. */
export async function updateTest(
  testId: string,
  payload: UpdateTestRequest,
): Promise<AdminTestRecord> {
  return apiFetch(`/admin/tests/${encodeURIComponent(testId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

/** Admin: delete a test. */
export async function deleteTest(testId: string): Promise<{ success: boolean }> {
  return apiFetch(`/admin/tests/${encodeURIComponent(testId)}`, {
    method: 'DELETE',
  })
}

/** Admin: toggle whether a test is active (offered by this lab). */
export async function toggleTestActive(testId: string, isActive: boolean): Promise<AdminTestRecord> {
  return apiFetch(`/admin/tests/${encodeURIComponent(testId)}/active`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  })
}

// ─── Admin: Invoices API ──────────────────────────────────────────────────────

export interface CreateInvoiceLineItem {
  itemName: string
  hsnSac?: string
  quantity: number
  pricePerUnit: number
  discountPercent: number
}

export interface CreateInvoiceRequest {
  date: string
  billToName: string
  billToContact?: string
  lineItems: CreateInvoiceLineItem[]
  receivedAmount: number
  appointmentId?: string
  patientId?: string
}

export interface InvoiceRecord extends CreateInvoiceRequest {
  id: string
  invoiceNumber: number
}

/** Admin: create an invoice linked to an appointment/patient — validated server-side, unlike
 * the pre-existing client-side `createInvoice` (src/lib/firestore.ts), which stays as-is for
 * standalone (non-appointment-linked) invoices. */
export async function createAppointmentInvoice(payload: CreateInvoiceRequest): Promise<InvoiceRecord> {
  return apiFetch('/admin/invoices', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

// ─── Appointments API (shared by patient portal and admin walk-in flow) ───────

export type ApiAppointmentStatus =
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

export interface ResolvedTestRecord {
  testId: string
  name: string
  sampleType: string
  cost: number
  origin: 'package' | 'manual'
  sourcePackageId?: string
}

export interface AppointmentRecord {
  id: string
  patientId: string
  patientName: string
  patientPhone: string
  packages: AppointmentPackageEntry[]
  manualTestIds: string[]
  resolvedTests: ResolvedTestRecord[]
  sampleIds: string[]
  totalCost: number
  invoiceId?: string
  date: string
  timeSlot: string
  collectionAddress: string
  status: ApiAppointmentStatus
  notes?: string
}

export interface SamplePreview {
  sampleType: 'blood' | 'urine' | 'stool' | 'swab' | 'other'
  /** Present when the tube comes from a named package sample group or manual color assignment. */
  label?: string
  /** The actual tube color name (e.g. "Lavender") to drive the dot color in the preview.
   * Set from the manual color picker label, or the test's configured tubeColor for auto mode. */
  tubeColorName?: string
  testNames: string[]
}

export interface AppointmentSummary {
  packages: AppointmentPackageEntry[]
  manualTestIds: string[]
  resolvedTests: ResolvedTestRecord[]
  totalTests: number
  totalSamples: number
  /** Sum of resolvedTests[].cost, ignoring any override — what the cost WOULD be by default. */
  computedCost: number
  /** Admin-set override, or null if none is set. */
  costOverride: number | null
  /** costOverride ?? computedCost — what the UI should actually display/charge. */
  estimatedCost: number
  /** One entry per physical tube/barcode that will be generated. Pre-confirm preview only. */
  samplePreviews: SamplePreview[]
  /** Current tube colour assignments for manually added tests (testId → colour name). */
  manualTubeColorMap: Record<string, string>
}

export interface CreateAppointmentRequest {
  patientId: string
  date: string
  timeSlot: string
  collectionAddress: string
  notes?: string
}

export async function createAppointmentApi(payload: CreateAppointmentRequest): Promise<AppointmentRecord> {
  return apiFetch('/appointments', { method: 'POST', body: JSON.stringify(payload) })
}

export async function getAppointmentApi(id: string): Promise<AppointmentRecord> {
  return apiFetch(`/appointments/${encodeURIComponent(id)}`)
}

export async function updateAppointmentApi(
  id: string,
  payload: Partial<Pick<CreateAppointmentRequest, 'date' | 'timeSlot' | 'collectionAddress' | 'notes'>>,
): Promise<AppointmentRecord> {
  return apiFetch(`/appointments/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function addPackagesToAppointment(id: string, packageIds: string[]): Promise<AppointmentRecord> {
  return apiFetch(`/appointments/${encodeURIComponent(id)}/packages`, {
    method: 'POST',
    body: JSON.stringify({ packageIds }),
  })
}

export async function removePackageFromAppointment(id: string, packageId: string): Promise<AppointmentRecord> {
  return apiFetch(
    `/appointments/${encodeURIComponent(id)}/packages/${encodeURIComponent(packageId)}`,
    { method: 'DELETE' },
  )
}

export async function addTestsToAppointment(id: string, testIds: string[]): Promise<AppointmentRecord> {
  return apiFetch(`/appointments/${encodeURIComponent(id)}/tests`, {
    method: 'POST',
    body: JSON.stringify({ testIds }),
  })
}

export async function removeTestFromAppointment(id: string, testId: string): Promise<AppointmentRecord> {
  return apiFetch(
    `/appointments/${encodeURIComponent(id)}/tests/${encodeURIComponent(testId)}`,
    { method: 'DELETE' },
  )
}

export async function getAppointmentSummary(id: string): Promise<AppointmentSummary> {
  return apiFetch(`/appointments/${encodeURIComponent(id)}/summary`)
}

/** Admin-only, pre-confirm: override the estimated/final cost, or pass `null` to clear back to
 * the computed sum of resolvedTest costs. */
export async function setAppointmentCostOverride(
  id: string,
  amount: number | null,
): Promise<AppointmentRecord> {
  return apiFetch(`/appointments/${encodeURIComponent(id)}/cost-override`, {
    method: 'POST',
    body: JSON.stringify({ amount }),
  })
}

/** Admin-only, pre-confirm: set per-test tube colour assignments for manually added tests. */
export async function setManualTubeColors(
  id: string,
  colorMap: Record<string, string>,
): Promise<{ ok: boolean }> {
  return apiFetch(`/appointments/${encodeURIComponent(id)}/manual-tube-colors`, {
    method: 'POST',
    body: JSON.stringify({ colorMap }),
  })
}

export async function confirmAppointment(id: string): Promise<AppointmentRecord> {
  return apiFetch(`/appointments/${encodeURIComponent(id)}/confirm`, { method: 'POST' })
}

export async function generateSamples(id: string): Promise<{ sampleIds: string[] }> {
  return apiFetch(`/appointments/${encodeURIComponent(id)}/generate-samples`, { method: 'POST' })
}

export async function getAppointmentSamples(id: string): Promise<SampleRecord[]> {
  return apiFetch(`/appointments/${encodeURIComponent(id)}/samples`)
}

export async function cancelAppointment(id: string): Promise<AppointmentRecord> {
  return apiFetch(`/appointments/${encodeURIComponent(id)}/cancel`, { method: 'POST' })
}

/** Admin-only generic transition for the tail of the pipeline (lab intake / report progress /
 * completion) — the backend rejects any target outside that whitelist, since sample generation
 * and cancellation carry business logic that must go through their own dedicated endpoints. */
export async function setAppointmentStatus(
  id: string,
  status: 'InLaboratory' | 'ReportGenerated' | 'ReportUploaded' | 'Completed',
): Promise<AppointmentRecord> {
  return apiFetch(`/appointments/${encodeURIComponent(id)}/status`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  })
}

export async function deleteAppointmentApi(id: string): Promise<AppointmentRecord> {
  return apiFetch(`/appointments/${encodeURIComponent(id)}/delete`, { method: 'POST' })
}

/** Admin-only. Deletes generated samples and resets the appointment to 'Created' so tests,
 * packages, and tube assignments can be edited and samples regenerated. Blocked once samples
 * are physically collected. */
export async function resetAppointmentToDraft(id: string): Promise<AppointmentRecord> {
  return apiFetch(`/appointments/${encodeURIComponent(id)}/reset-to-draft`, { method: 'POST' })
}

/** Walks the appointment from wherever it currently is (SamplesCollected or later) up through
 * the report-progress chain to ReportUploaded, one legal hop at a time — the state machine
 * doesn't allow skipping straight from e.g. SamplesCollected to ReportUploaded in one call. */
const REPORT_CHAIN: ApiAppointmentStatus[] = [
  'SamplesCollected',
  'InLaboratory',
  'ReportGenerated',
  'ReportUploaded',
]

export async function markReportUploaded(id: string, currentStatus: ApiAppointmentStatus): Promise<void> {
  const startIdx = Math.max(REPORT_CHAIN.indexOf(currentStatus), 0)
  for (let i = startIdx + 1; i < REPORT_CHAIN.length; i++) {
    await setAppointmentStatus(id, REPORT_CHAIN[i] as 'InLaboratory' | 'ReportGenerated' | 'ReportUploaded')
  }
}

// ─── Samples API ───────────────────────────────────────────────────────────────

export interface SampleRecord {
  id: string
  appointmentId: string
  patientId: string
  sampleType: string
  testIds: string[]
  barcodeId: string
  collectionStatus: 'pending' | 'collected' | 'rejected'
  collector?: string
  remarks?: string
}

export interface SamplePrintPayload {
  sampleId: string
  barcodeId: string
  sampleType: string
  patientName: string
  date: string
  timeSlot: string
  testNames: string[]
  tubeColor?: string
}

export async function getSampleApi(id: string): Promise<SampleRecord> {
  return apiFetch(`/samples/${encodeURIComponent(id)}`)
}

export async function collectSample(
  id: string,
  collector: string,
  remarks?: string,
): Promise<SampleRecord> {
  return apiFetch(`/samples/${encodeURIComponent(id)}/collect`, {
    method: 'POST',
    body: JSON.stringify({ collector, remarks }),
  })
}

export async function printSample(id: string): Promise<SamplePrintPayload> {
  return apiFetch(`/samples/${encodeURIComponent(id)}/print`, { method: 'POST' })
}

export async function rejectSample(
  id: string,
  remarks: string,
): Promise<{ rejectedSampleId: string; replacementSampleId: string }> {
  return apiFetch(`/samples/${encodeURIComponent(id)}/reject`, {
    method: 'POST',
    body: JSON.stringify({ remarks }),
  })
}

export interface CreateOrderRequest {
  appointmentId: string
  amountPaise: number
  currency: 'INR'
}

export interface OrderResult {
  orderId: string
  amount: number
  currency: string
  receipt: string
}

/** Authenticated patient: create a payment order for an appointment. */
export async function createPaymentOrder(payload: CreateOrderRequest): Promise<OrderResult> {
  return apiFetch('/payments/create-order', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/** Authenticated patient: get payment status for an order. */
export async function getPaymentStatus(orderId: string): Promise<Record<string, unknown>> {
  return apiFetch(`/payments/${encodeURIComponent(orderId)}`)
}
