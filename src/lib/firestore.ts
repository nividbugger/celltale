import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
  onSnapshot,
  Timestamp,
  serverTimestamp,
  limit,
  getCountFromServer,
  runTransaction,
} from 'firebase/firestore'
import { db } from './firebase'
import type {
  User,
  Appointment,
  Report,
  TestValue,
  Package,
  ClinicSettings,
  Invoice,
  BulkInvoice,
  Test,
  DiagnosticParameter,
} from '../types'
import { DEFAULT_CLINIC_SETTINGS } from '../types'

// ─── Users ────────────────────────────────────────────────────────────────

export async function createUserDocument(
  uid: string,
  data: { name: string; phone: string; email?: string; company?: string },
): Promise<void> {
  await setDoc(doc(db, 'users', uid), {
    uid,
    name: data.name,
    email: data.email ?? '',
    phone: data.phone,
    ...(data.company ? { company: data.company } : {}),
    role: 'patient',
    createdAt: serverTimestamp(),
  })
}

export async function getUserDocument(uid: string): Promise<User | null> {
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.exists() ? (snap.data() as User) : null
}

export async function updateUserDocument(
  uid: string,
  data: Partial<Omit<User, 'uid' | 'email' | 'role' | 'createdAt'>>,
): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { ...data })
}

// ─── Appointments ─────────────────────────────────────────────────────────
// Mutations (create, status transitions, sample/barcode generation) go through the
// `/api/appointments` and `/api/samples` Express API (see src/lib/api.ts) so admin and
// patient flows share one code path. Only read-only queries remain here.

export async function getAppointmentsByPatient(patientId: string): Promise<Appointment[]> {
  const q = query(
    collection(db, 'appointments'),
    where('patientId', '==', patientId),
    orderBy('createdAt', 'desc'),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Appointment)
}

export async function getAllAppointments(): Promise<Appointment[]> {
  const snap = await getDocs(collection(db, 'appointments'))
  const appointments = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Appointment)
  return appointments.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
}

export async function getAppointmentById(id: string): Promise<Appointment | null> {
  const snap = await getDoc(doc(db, 'appointments', id))
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Appointment) : null
}

export async function softDeleteAppointment(id: string): Promise<void> {
  await updateDoc(doc(db, 'appointments', id), {
    status: 'Deleted',
    updatedAt: serverTimestamp(),
  })
}

// ─── Reports ──────────────────────────────────────────────────────────────

/** Reserve a report document id without writing to Firestore yet. Lets callers
 *  build the report's public URL (e.g. to stamp a QR onto an uploaded PDF)
 *  before the report doc is created. */
export function generateReportId(): string {
  return doc(collection(db, 'reports')).id
}

export async function createReport(data: {
  /** Optional pre-reserved id (see generateReportId); a new id is used when omitted. */
  id?: string
  appointmentId: string
  patientId: string
  pdfUrl?: string
  testValues: TestValue[]
  summary?: string
  packageId?: string
  testIds?: string[]
}): Promise<string> {
  const payload: Record<string, unknown> = {
    appointmentId: data.appointmentId,
    patientId: data.patientId,
    testValues: data.testValues,
    uploadedAt: serverTimestamp(),
  }
  if (data.pdfUrl) payload.pdfUrl = data.pdfUrl
  if (data.summary) payload.summary = data.summary
  if (data.packageId) payload.packageId = data.packageId
  if (data.testIds && data.testIds.length) payload.testIds = data.testIds
  if (data.id) {
    await setDoc(doc(db, 'reports', data.id), payload)
    return data.id
  }
  const ref = await addDoc(collection(db, 'reports'), payload)
  return ref.id
}

export async function getReportsByPatient(patientId: string): Promise<Report[]> {
  const q = query(
    collection(db, 'reports'),
    where('patientId', '==', patientId),
    orderBy('uploadedAt', 'desc'),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Report)
}

/** Fetch a single report by its document id. Used by the public QR report-view
 *  page — a single-doc `get`, which firestore.rules permits for anyone holding
 *  the (unguessable) report id. */
export async function getReportById(reportId: string): Promise<Report | null> {
  const snap = await getDoc(doc(db, 'reports', reportId))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as Report
}

export async function getReportByAppointmentId(appointmentId: string): Promise<Report | null> {
  const q = query(
    collection(db, 'reports'),
    where('appointmentId', '==', appointmentId),
    limit(1),
  )
  const snap = await getDocs(q)
  if (snap.empty) return null
  const d = snap.docs[0]
  return { id: d.id, ...d.data() } as Report
}

export function subscribeToReportByAppointmentId(
  appointmentId: string,
  callback: (report: Report | null) => void,
): () => void {
  const q = query(
    collection(db, 'reports'),
    where('appointmentId', '==', appointmentId),
    limit(1),
  )
  return onSnapshot(q, (snap) => {
    if (snap.empty) {
      callback(null)
    } else {
      const d = snap.docs[0]
      callback({ id: d.id, ...d.data() } as Report)
    }
  })
}

export async function updateReport(
  reportId: string,
  data: { testValues: TestValue[]; summary?: string; testIds?: string[] },
): Promise<void> {
  const payload: Record<string, unknown> = {
    testValues: data.testValues,
    uploadedAt: serverTimestamp(),
  }
  if (data.summary !== undefined) payload.summary = data.summary
  if (data.testIds) payload.testIds = data.testIds
  await updateDoc(doc(db, 'reports', reportId), payload)
}

/** Replace the uploaded PDF on an existing report, keeping the same report id so
 *  previously shared/printed QR links (/r/<id>) keep working. Bumps uploadedAt so
 *  the report sorts as freshly updated. */
export async function setReportPdfUrl(reportId: string, pdfUrl: string): Promise<void> {
  await updateDoc(doc(db, 'reports', reportId), {
    pdfUrl,
    uploadedAt: serverTimestamp(),
  })
}

// ─── Admin ────────────────────────────────────────────────────────────────

export async function getAllPatients(): Promise<User[]> {
  const q = query(collection(db, 'users'), where('role', '==', 'patient'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data() as User)
}

export async function getAdminStats(): Promise<{
  totalAppointments: number
  pendingAppointments: number
  totalPatients: number
  reportsUploaded: number
}> {
  const [totalSnap, pendingSnap, patientsSnap, reportsSnap] = await Promise.all([
    getCountFromServer(collection(db, 'appointments')),
    getCountFromServer(
      query(collection(db, 'appointments'), where('status', '==', 'Created')),
    ),
    getCountFromServer(query(collection(db, 'users'), where('role', '==', 'patient'))),
    getCountFromServer(collection(db, 'reports')),
  ])
  return {
    totalAppointments: totalSnap.data().count,
    pendingAppointments: pendingSnap.data().count,
    totalPatients: patientsSnap.data().count,
    reportsUploaded: reportsSnap.data().count,
  }
}

// ─── Packages ────────────────────────────────────────────────────────────

export async function getAllPackages(): Promise<Package[]> {
  const q = query(collection(db, 'packages'), orderBy('order', 'asc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Package))
}

export async function savePackage(pkg: Package): Promise<void> {
  await setDoc(doc(db, 'packages', pkg.id), pkg)
}

export async function deletePackage(id: string): Promise<void> {
  await deleteDoc(doc(db, 'packages', id))
}

export async function reorderPackages(packages: Package[]): Promise<void> {
  await Promise.all(
    packages.map((pkg, i) => setDoc(doc(db, 'packages', pkg.id), { ...pkg, order: i })),
  )
}

// ─── Clinic Settings ────────────────────────────────────────────────────────

export async function getClinicSettings(): Promise<ClinicSettings> {
  const snap = await getDoc(doc(db, 'config', 'clinicSettings'))
  return snap.exists() ? (snap.data() as ClinicSettings) : DEFAULT_CLINIC_SETTINGS
}

export async function saveClinicSettings(data: ClinicSettings): Promise<void> {
  await setDoc(doc(db, 'config', 'clinicSettings'), data)
}

// ─── Invoices ───────────────────────────────────────────────────────────────

export async function getNextInvoiceNumber(): Promise<number> {
  const counterRef = doc(db, 'config', 'invoiceCounter')
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef)
    const next = (snap.exists() ? (snap.data().lastNumber as number) : 0) + 1
    tx.set(counterRef, { lastNumber: next })
    return next
  })
}

export async function createInvoice(
  data: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const ref = await addDoc(collection(db, 'invoices'), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function getAllInvoices(): Promise<Invoice[]> {
  const snap = await getDocs(collection(db, 'invoices'))
  const invoices = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Invoice)
  return invoices.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
}

export async function getInvoiceById(id: string): Promise<Invoice | null> {
  const snap = await getDoc(doc(db, 'invoices', id))
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Invoice) : null
}

export async function updateInvoice(
  id: string,
  data: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<void> {
  await updateDoc(doc(db, 'invoices', id), { ...data, updatedAt: serverTimestamp() })
}

export async function deleteInvoice(id: string): Promise<void> {
  await deleteDoc(doc(db, 'invoices', id))
}

export async function getInvoiceByAppointmentId(appointmentId: string): Promise<Invoice | null> {
  const q = query(collection(db, 'invoices'), where('appointmentId', '==', appointmentId), limit(1))
  const snap = await getDocs(q)
  if (snap.empty) return null
  const d = snap.docs[0]
  return { id: d.id, ...d.data() } as Invoice
}

export async function setAppointmentInvoiceId(appointmentId: string, invoiceId: string): Promise<void> {
  await updateDoc(doc(db, 'appointments', appointmentId), { invoiceId })
}

export async function markInvoicePaid(id: string): Promise<void> {
  await updateDoc(doc(db, 'invoices', id), {
    isPaid: true,
    paidAt: new Date().toISOString(),
    updatedAt: serverTimestamp(),
  })
}

// ─── Bulk Invoices ───────────────────────────────────────────────────────────

export async function getAllBulkInvoices(): Promise<BulkInvoice[]> {
  const snap = await getDocs(collection(db, 'bulkInvoices'))
  const invoices = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as BulkInvoice)
  return invoices.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
}

export async function markBulkInvoicePaid(id: string): Promise<void> {
  await updateDoc(doc(db, 'bulkInvoices', id), {
    isPaid: true,
    paidAt: new Date().toISOString(),
    updatedAt: serverTimestamp(),
  })
}

export async function deleteBulkInvoice(id: string): Promise<void> {
  await deleteDoc(doc(db, 'bulkInvoices', id))
}

export async function getAppointmentsByPatientIds(patientIds: string[]): Promise<Appointment[]> {
  if (patientIds.length === 0) return []
  const chunks: string[][] = []
  for (let i = 0; i < patientIds.length; i += 30) {
    chunks.push(patientIds.slice(i, i + 30))
  }
  const results: Appointment[] = []
  await Promise.all(
    chunks.map(async (chunk) => {
      const q = query(collection(db, 'appointments'), where('patientId', 'in', chunk))
      const snap = await getDocs(q)
      snap.docs.forEach((d) => results.push({ id: d.id, ...d.data() } as Appointment))
    }),
  )
  return results.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
}

// ─── Diagnostic Parameters ────────────────────────────────────────────────

export async function getAllParameters(): Promise<DiagnosticParameter[]> {
  const snap = await getDocs(collection(db, 'diagnosticParameters'))
  const params = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as DiagnosticParameter)
  return params.sort((a, b) => {
    const dc = a.discipline.localeCompare(b.discipline)
    return dc !== 0 ? dc : a.name.localeCompare(b.name)
  })
}

// ─── Tests ────────────────────────────────────────────────────────────────

export async function getAllTests(): Promise<Test[]> {
  const snap = await getDocs(collection(db, 'tests'))
  const tests = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Test)
  return tests.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
}

export async function getActiveTests(): Promise<Test[]> {
  const all = await getAllTests()
  return all.filter((t) => t.isActive !== false)
}

export async function createTest(data: Omit<Test, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const ref = await addDoc(collection(db, 'tests'), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateTest(id: string, data: Partial<Omit<Test, 'id' | 'createdAt'>>): Promise<void> {
  await updateDoc(doc(db, 'tests', id), { ...data, updatedAt: serverTimestamp() })
}

export async function deleteTest(id: string): Promise<void> {
  await deleteDoc(doc(db, 'tests', id))
}

// Re-export Timestamp for convenience
export { Timestamp }
