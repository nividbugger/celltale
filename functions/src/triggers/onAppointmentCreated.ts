import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import * as admin from 'firebase-admin'
import { sendEmail } from '../email/sendEmail'
import { appointmentBookedTemplate, type AppointmentEmailData } from '../email/templates'
import { config } from '../config'

/**
 * Fires when a new appointment is created.
 * Sends a booking confirmation email to the patient.
 */
export const onAppointmentCreated = onDocumentCreated(
  { document: 'appointments/{appointmentId}', region: config.region },
  async (event) => {
    const appt = event.data?.data()
    if (!appt) return

    // Fetch patient email from Firestore (not stored on appointment doc)
    const patientSnap = await admin.firestore().doc(`users/${appt.patientId}`).get()
    if (!patientSnap.exists) return
    const patientEmail: string = patientSnap.data()?.email
    if (!patientEmail) return

    const templateData: AppointmentEmailData = {
      patientName: appt.patientName,
      packageName: appt.packageName,
      packagePrice: appt.packagePrice,
      date: appt.date,
      timeSlot: appt.timeSlot,
      collectionAddress: appt.collectionAddress,
      appointmentId: event.params.appointmentId,
      notes: appt.notes,
    }

    await sendEmail({
      to: patientEmail,
      subject: `Appointment Booked – ${appt.packageName} on ${appt.date}`,
      html: appointmentBookedTemplate(templateData),
    })
  },
)
