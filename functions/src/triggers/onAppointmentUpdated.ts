import { onDocumentUpdated } from 'firebase-functions/v2/firestore'
import * as admin from 'firebase-admin'
import { sendEmail } from '../email/sendEmail'
import {
  appointmentConfirmedTemplate,
  sampleCollectedTemplate,
  reportReadyTemplate,
  type AppointmentEmailData,
} from '../email/templates'
import { config } from '../config'

type AppointmentStatus =
  | 'Pending'
  | 'Confirmed'
  | 'Sample Collected'
  | 'Report Ready'
  | 'Completed'
  | 'Cancelled'

/**
 * Fires when an appointment document is updated.
 * Sends status-specific emails when the status changes to:
 *   – Confirmed        → appointment confirmed email
 *   – Sample Collected → sample collected email
 *   – Report Ready     → report ready email
 */
export const onAppointmentUpdated = onDocumentUpdated(
  { document: 'appointments/{appointmentId}', region: config.region },
  async (event) => {
    const before = event.data?.before.data()
    const after = event.data?.after.data()
    if (!before || !after) return

    const oldStatus: AppointmentStatus = before.status
    const newStatus: AppointmentStatus = after.status

    // No status change – nothing to do
    if (oldStatus === newStatus) return

    // Fetch patient email
    const patientSnap = await admin.firestore().doc(`users/${after.patientId}`).get()
    if (!patientSnap.exists) return
    const patientEmail: string = patientSnap.data()?.email
    if (!patientEmail) return

    const templateData: AppointmentEmailData = {
      patientName: after.patientName,
      packageName: after.packageName,
      packagePrice: after.packagePrice,
      date: after.date,
      timeSlot: after.timeSlot,
      collectionAddress: after.collectionAddress,
      appointmentId: event.params.appointmentId,
      notes: after.notes,
    }

    switch (newStatus) {
      case 'Confirmed':
        await sendEmail({
          to: patientEmail,
          subject: `✅ Appointment Confirmed – ${after.date} at ${after.timeSlot}`,
          html: appointmentConfirmedTemplate(templateData),
        })
        break

      case 'Sample Collected':
        await sendEmail({
          to: patientEmail,
          subject: `🧪 Sample Collected – Processing Underway`,
          html: sampleCollectedTemplate(templateData),
        })
        break

      case 'Report Ready':
        await sendEmail({
          to: patientEmail,
          subject: `📄 Your ${after.packageName} Report is Ready`,
          html: reportReadyTemplate(templateData),
        })
        break

      default:
        // Cancelled / Completed / Pending – no email for now
        break
    }
  },
)
