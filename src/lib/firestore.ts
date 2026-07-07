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
  AppointmentStatus,
  Report,
  TestValue,
  Package,
  ClinicSettings,
  Invoice,
} from '../types'
import { DEFAULT_CLINIC_SETTINGS } from '../types'

// ─── Users ────────────────────────────────────────────────────────────────

export async function createUserDocument(
  uid: string,
  data: { name: string; email: string; phone: string },
): Promise<void> {
  await setDoc(doc(db, 'users', uid), {
    uid,
    name: data.name,
    email: data.email,
    phone: data.phone,
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

export async function createAppointment(
  data: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const ref = await addDoc(collection(db, 'appointments'), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  // Email is sent automatically by the onAppointmentCreated Cloud Function trigger.
  return ref.id
}

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
  const q = query(collection(db, 'appointments'), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Appointment)
}

export async function getAppointmentById(id: string): Promise<Appointment | null> {
  const snap = await getDoc(doc(db, 'appointments', id))
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Appointment) : null
}

export async function updateAppointmentStatus(
  id: string,
  status: AppointmentStatus,
  notes?: string,
): Promise<void> {
  const data: Record<string, unknown> = { status, updatedAt: serverTimestamp() }
  if (notes !== undefined) data.notes = notes
  await updateDoc(doc(db, 'appointments', id), data)
  // Status-change email is sent automatically by the onAppointmentUpdated Cloud Function trigger.
}

function generateBarcodeId(): string {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const rand = String(Math.floor(Math.random() * 10000)).padStart(4, '0')
  return `${yy}${mm}${dd}${rand}`
}

export async function assignBarcodeId(appointmentId: string): Promise<string> {
  const snap = await getDoc(doc(db, 'appointments', appointmentId))
  if (!snap.exists()) throw new Error('Appointment not found')
  const existing = snap.data().barcodeId as string | undefined
  if (existing) return existing
  const barcodeId = generateBarcodeId()
  await updateDoc(doc(db, 'appointments', appointmentId), { barcodeId })
  return barcodeId
}

export async function softDeleteAppointment(id: string): Promise<void> {
  await updateDoc(doc(db, 'appointments', id), {
    status: 'Deleted',
    updatedAt: serverTimestamp(),
  })
}

// ─── Reports ──────────────────────────────────────────────────────────────

export async function createReport(data: {
  appointmentId: string
  patientId: string
  pdfUrl: string
  testValues: TestValue[]
  summary?: string
}): Promise<string> {
  const ref = await addDoc(collection(db, 'reports'), {
    ...data,
    uploadedAt: serverTimestamp(),
  })
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
      query(collection(db, 'appointments'), where('status', '==', 'Pending')),
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
  return snap.docs.map((d) => ({ ...d.data() } as Package))
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
  const q = query(collection(db, 'invoices'), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Invoice)
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

// Re-export Timestamp for convenience
export { Timestamp }
