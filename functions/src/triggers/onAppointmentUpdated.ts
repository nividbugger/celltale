import { onDocumentUpdated } from 'firebase-functions/v2/firestore'
import * as admin from 'firebase-admin'
import { sendEmail } from '../email/sendEmail'
import {
  appointmentConfirmedTemplate,
  appointmentCancelledTemplate,
  sampleCollectedTemplate,
  reportReadyTemplate,
  type AppointmentEmailData,
} from '../email/templates'
import { describePackages } from '../appointmentDisplay'
import { config } from '../config'

type AppointmentStatus =
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

/**
 * Fires when an appointment document is updated.
 * Sends status-specific emails when the status changes to:
 *   – Confirmed        → appointment confirmed email
 *   – SamplesCollected → sample collected email
 *   – ReportUploaded   → report ready email
 *   – Cancelled        → appointment cancelled email
 * All other status values (Created, SamplesGenerating, SamplesGenerated, InLaboratory,
 * ReportGenerated, Completed, Deleted) intentionally send no email, matching pre-refactor
 * behavior for the equivalent old statuses.
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
      packageName: describePackages(after),
      packagePrice: after.totalCost ?? after.packagePrice ?? 0,
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

      case 'SamplesCollected':
        await sendEmail({
          to: patientEmail,
          subject: `🧪 Sample Collected – Processing Underway`,
          html: sampleCollectedTemplate(templateData),
        })
        break

      case 'ReportUploaded':
        await sendEmail({
          to: patientEmail,
          subject: `📄 Your ${templateData.packageName} Report is Ready`,
          html: reportReadyTemplate(templateData),
        })
        break

      case 'Cancelled':
        await sendEmail({
          to: patientEmail,
          subject: `❌ Appointment Cancelled – ${templateData.packageName} on ${after.date}`,
          html: appointmentCancelledTemplate(templateData),
        })
        break

      default:
        // Created / SamplesGenerating / SamplesGenerated / InLaboratory / ReportGenerated /
        // Completed / Deleted – no email
        break
    }
  },
)
