import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
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
} from 'firebase/firestore'
import { db } from './firebase'
import type { User, Appointment, AppointmentStatus, Report, TestValue } from '../types'

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

// Re-export Timestamp for convenience
export { Timestamp }
