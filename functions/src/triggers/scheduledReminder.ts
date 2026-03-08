import { onSchedule } from 'firebase-functions/v2/scheduler'
import * as admin from 'firebase-admin'
import * as functions from 'firebase-functions'
import { sendEmail } from '../email/sendEmail'
import { reminderTemplate, type AppointmentEmailData } from '../email/templates'
import { config } from '../config'

/**
 * Runs every hour (IST timezone).
 * Finds appointments that are ~reminderHoursBefore hours away and sends a reminder email.
 *
 * How it works:
 *   1. Read reminderHoursBefore from Firestore 'config/emailSettings' (defaults to 4).
 *   2. Query appointments with status 'Confirmed' where 'reminderSent' != true.
 *   3. Parse each appointment's date + timeSlot to get its absolute timestamp (IST).
 *   4. If the appointment is within ±30 min of (now + reminderHours), send the reminder.
 *   5. Mark 'reminderSent: true' on the appointment doc to prevent duplicate sends.
 *
 * Firestore 'config/emailSettings' document shape:
 *   { reminderHoursBefore: number }   ← configurable via Firestore console
 */
export const sendReminders = onSchedule(
  {
    schedule: 'every 60 minutes',
    timeZone: 'Asia/Kolkata',
    region: config.region,
  },
  async () => {
    // ── 1. Read reminder config ──────────────────────────────────────────
    let reminderHoursBefore = config.defaultReminderHours
    try {
      const configSnap = await admin.firestore().doc('config/emailSettings').get()
      if (configSnap.exists) {
        const val = configSnap.data()?.reminderHoursBefore
        if (typeof val === 'number' && val > 0) reminderHoursBefore = val
      }
    } catch (e) {
      functions.logger.warn('Could not read config/emailSettings, using default', { reminderHoursBefore })
    }

    // ── 2. Compute target window (in IST epoch ms) ───────────────────────
    // We shift "now" to IST, then add the reminder offset.
    // This avoids any timezone library dependency.
    const nowUtcMs = Date.now()
    const nowIstMs = nowUtcMs + config.istOffsetMs                        // current IST time in ms
    const targetIstMs = nowIstMs + reminderHoursBefore * 60 * 60 * 1000  // target appt time
    const windowMs = 30 * 60 * 1000                                       // ±30 min window

    // ── 3. Query upcoming confirmed appointments not yet reminded ────────
    // We query by date strings (today + tomorrow in IST) to keep the query scope small.
    const todayIST = istDateString(nowIstMs)
    const tomorrowIST = istDateString(nowIstMs + 24 * 60 * 60 * 1000)

    const snap = await admin
      .firestore()
      .collection('appointments')
      .where('status', '==', 'Confirmed')
      .where('date', 'in', [todayIST, tomorrowIST])
      .get()

    if (snap.empty) return

    const batch = admin.firestore().batch()
    const emailPromises: Promise<void>[] = []

    for (const doc of snap.docs) {
      const appt = doc.data()

      // Skip if reminder was already sent
      if (appt.reminderSent === true) continue

      // Parse appointment timestamp in IST (ms)
      const apptIstMs = parseAppointmentIstMs(appt.date, appt.timeSlot)
      if (isNaN(apptIstMs)) continue

      // Check if appointment falls within the reminder window
      if (Math.abs(apptIstMs - targetIstMs) > windowMs) continue

      // Fetch patient email
      const patientSnap = await admin.firestore().doc(`users/${appt.patientId}`).get()
      if (!patientSnap.exists) continue
      const patientEmail: string = patientSnap.data()?.email ?? ''
      if (!patientEmail) continue

      const templateData: AppointmentEmailData = {
        patientName: appt.patientName,
        packageName: appt.packageName,
        packagePrice: appt.packagePrice,
        date: appt.date,
        timeSlot: appt.timeSlot,
        collectionAddress: appt.collectionAddress,
        appointmentId: doc.id,
      }

      // Queue email send
      emailPromises.push(
        sendEmail({
          to: patientEmail,
          subject: `⏰ Reminder: Your appointment is in ${reminderHoursBefore} hours`,
          html: reminderTemplate(templateData, reminderHoursBefore),
        }),
      )

      // Mark as reminded in batch
      batch.update(doc.ref, { reminderSent: true })

      functions.logger.info(`Queued reminder for appointment ${doc.id} → ${patientEmail}`)
    }

    await Promise.all([...emailPromises, batch.commit()])
  },
)

// ─── Utility: format IST epoch ms → 'yyyy-MM-dd' ─────────────────────────
function istDateString(istMs: number): string {
  const d = new Date(istMs)
  const year = d.getUTCFullYear()
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// ─── Utility: parse 'yyyy-MM-dd' + 'HH:MM AM' → IST epoch ms ─────────────
function parseAppointmentIstMs(dateStr: string, timeSlot: string): number {
  // dateStr: '2026-03-05', timeSlot: '09:00 AM'
  const [yearStr, monthStr, dayStr] = dateStr.split('-')
  const [time, meridiem] = timeSlot.split(' ')
  const [hourStr, minStr] = time.split(':')

  let hours = parseInt(hourStr, 10)
  const minutes = parseInt(minStr, 10)

  if (meridiem === 'PM' && hours !== 12) hours += 12
  if (meridiem === 'AM' && hours === 12) hours = 0

  // Build a UTC timestamp that represents this IST clock time:
  //   IST epoch ms = UTC epoch ms + istOffset
  //   → UTC epoch ms = (local date+time components treated as UTC) - already accounts for offset
  // We construct by treating the local date/time as UTC, then we've already worked in IST space.
  const utcMs = Date.UTC(
    parseInt(yearStr, 10),
    parseInt(monthStr, 10) - 1,
    parseInt(dayStr, 10),
    hours,
    minutes,
  )
  // This utcMs represents the wall-clock time in UTC coords.
  // To get IST epoch ms (for comparison with nowIstMs), add the IST offset.
  return utcMs + config.istOffsetMs
}
