import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'
import type { AppointmentStatus } from '../types'

// ─── Mail queue item types ────────────────────────────────────────────────

export type EmailType =
  | 'welcome'
  | 'appointment_booked'
  | 'appointment_confirmed'
  | 'sample_collected'
  | 'report_ready'

export interface EmailQueueData {
  patientName: string
  packageName?: string
  packagePrice?: number
  date?: string
  timeSlot?: string
  collectionAddress?: string
  appointmentId?: string
  notes?: string
}

/**
 * Writes an email request to the Firestore `mailQueue` collection.
 * A GitHub Actions worker processes this queue every 5 minutes and sends the emails.
 * No credentials are ever exposed to the browser.
 */
export async function queueEmail(
  type: EmailType,
  to: string,
  data: EmailQueueData,
): Promise<void> {
  await addDoc(collection(db, 'mailQueue'), {
    type,
    to,
    data,
    status: 'pending',
    createdAt: serverTimestamp(),
  })
}

/**
 * Maps an AppointmentStatus transition to an EmailType (or null if no email needed).
 */
export function statusToEmailType(status: AppointmentStatus): EmailType | null {
  switch (status) {
    case 'Confirmed':       return 'appointment_confirmed'
    case 'Sample Collected': return 'sample_collected'
    case 'Report Ready':    return 'report_ready'
    default:                return null
  }
}
