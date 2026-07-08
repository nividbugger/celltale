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

// ─── Admin: Tests API ─────────────────────────────────────────────────────────

export interface TestParameter {
  parameter: string
  unit: string
  biologicalReference: string
}

export interface CreateTestRequest {
  name: string
  parameters: TestParameter[]
}

export interface UpdateTestRequest {
  name?: string
  parameters?: TestParameter[]
}

export interface AdminTestRecord {
  id: string
  testId: string
  name: string
  parameters: TestParameter[]
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
