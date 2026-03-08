/**
 * CellTale Email Worker
 * ---------------------
 * Runs via GitHub Actions every 5 minutes (queue processing)
 * and every hour (appointment reminders).
 *
 * Environment variables (set as GitHub Secrets):
 *   FIREBASE_SERVICE_ACCOUNT  – Firebase service account JSON (as a string)
 *   GMAIL_USER                – sruthi_kandaswamy@celltalediagnostics.com
 *   GMAIL_CLIENT_ID           – OAuth2 client ID
 *   GMAIL_CLIENT_SECRET       – OAuth2 client secret
 *   GMAIL_REFRESH_TOKEN       – OAuth2 refresh token
 *   APP_URL                   – https://celltalediagnostics-8f817.web.app
 *   WORKER_MODE               – 'queue' | 'reminders' (set by the workflow)
 *   REMINDER_HOURS_BEFORE     – optional override (default: read from Firestore config/emailSettings)
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import nodemailer from 'nodemailer'

// ─── Init ─────────────────────────────────────────────────────────────────

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()

const APP_NAME = 'CellTale Diagnostics'
const APP_URL  = process.env.APP_URL ?? 'https://celltalediagnostics-8f817.web.app'
const FROM     = `"${APP_NAME}" <${process.env.GMAIL_USER}>`
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

// ─── Nodemailer transporter (Gmail OAuth2) ────────────────────────────────

function createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: process.env.GMAIL_USER,
      clientId: process.env.GMAIL_CLIENT_ID,
      clientSecret: process.env.GMAIL_CLIENT_SECRET,
      refreshToken: process.env.GMAIL_REFRESH_TOKEN,
    },
  })
}

async function sendMail(to, subject, html) {
  const transporter = createTransporter()
  try {
    const info = await transporter.sendMail({ from: FROM, to, subject, html })
    console.log(`✅ Sent to ${to} — messageId: ${info.messageId}`)
    return true
  } catch (err) {
    console.error(`❌ Failed to send to ${to}:`, err.message)
    return false
  }
}

// ─── HTML Templates ───────────────────────────────────────────────────────

function layout(content) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
<tr><td style="background:linear-gradient(135deg,#0f766e,#0d9488);padding:28px 40px;text-align:center;">
  <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;">🔬 ${APP_NAME}</h1>
  <p style="margin:6px 0 0;color:#ccfbf1;font-size:13px;">Trusted Diagnostics, Delivered Home</p>
</td></tr>
<tr><td style="padding:36px 40px;">${content}</td></tr>
<tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;">
  <p style="margin:0;color:#94a3b8;font-size:12px;">${APP_NAME} · <a href="mailto:${process.env.GMAIL_USER}" style="color:#0d9488;">${process.env.GMAIL_USER}</a></p>
</td></tr>
</table></td></tr></table></body></html>`
}

function detailRow(label, value) {
  return `<tr>
    <td style="padding:8px 12px;color:#64748b;font-size:14px;width:160px;">${label}</td>
    <td style="padding:8px 12px;color:#1e293b;font-size:14px;font-weight:600;">${value}</td>
  </tr>`
}

function detailTable(rows) {
  return `<table cellpadding="0" cellspacing="0" style="width:100%;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin:20px 0;">${rows.join('')}</table>`
}

function cta(label, path) {
  return `<div style="text-align:center;margin:28px 0;">
    <a href="${APP_URL}${path}" style="display:inline-block;background:linear-gradient(135deg,#0f766e,#0d9488);color:#fff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 36px;border-radius:8px;">${label}</a>
  </div>`
}

function fmtDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function fmtPrice(n) {
  return `₹${Number(n).toLocaleString('en-IN')}`
}

// Templates keyed by EmailType
const TEMPLATES = {
  welcome: (d) => ({
    subject: `Welcome to ${APP_NAME}!`,
    html: layout(`
      <p style="margin:0 0 8px;color:#1e293b;font-size:22px;font-weight:700;">Hi ${d.patientName},</p>
      <p style="color:#475569;font-size:15px;line-height:1.6;">Welcome to <strong>${APP_NAME}</strong>! We provide accurate, affordable diagnostic tests with home sample collection.</p>
      <ul style="color:#475569;font-size:14px;line-height:2;padding-left:20px;">
        <li>📋 Browse and book health screening packages</li>
        <li>📅 Track your appointment status in real time</li>
        <li>📄 Download your test reports anytime</li>
      </ul>
      ${cta('Book Your First Test', '/dashboard/book')}
    `),
  }),

  appointment_booked: (d) => ({
    subject: `Appointment Booked – ${d.packageName} on ${d.date}`,
    html: layout(`
      <p style="margin:0 0 8px;color:#1e293b;font-size:22px;font-weight:700;">Hi ${d.patientName},</p>
      <p style="color:#475569;font-size:15px;line-height:1.6;">Your appointment has been <strong>successfully booked</strong>. Our team will review and confirm it shortly.</p>
      ${detailTable([
        detailRow('Package', d.packageName),
        detailRow('Price', fmtPrice(d.packagePrice)),
        detailRow('Date', fmtDate(d.date)),
        detailRow('Time Slot', d.timeSlot),
        detailRow('Collection At', d.collectionAddress),
        ...(d.notes ? [detailRow('Notes', d.notes)] : []),
      ])}
      <p style="color:#475569;font-size:14px;">⏳ <em>Status: <strong>Pending Confirmation</strong> — you'll receive another email once confirmed.</em></p>
      ${cta('View Appointment', '/dashboard/appointments')}
    `),
  }),

  appointment_confirmed: (d) => ({
    subject: `✅ Appointment Confirmed – ${d.date} at ${d.timeSlot}`,
    html: layout(`
      <p style="margin:0 0 8px;color:#1e293b;font-size:22px;font-weight:700;">Hi ${d.patientName},</p>
      <p style="color:#475569;font-size:15px;line-height:1.6;">Your appointment has been <strong style="color:#059669;">✅ Confirmed</strong>. Our phlebotomist will visit you at the scheduled time.</p>
      ${detailTable([
        detailRow('Package', d.packageName),
        detailRow('Date', fmtDate(d.date)),
        detailRow('Time Slot', d.timeSlot),
        detailRow('Collection At', d.collectionAddress),
      ])}
      <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:16px 20px;margin:20px 0;">
        <p style="margin:0;color:#065f46;font-size:14px;font-weight:600;">📌 How to Prepare</p>
        <ul style="color:#047857;font-size:13px;line-height:2;padding-left:18px;margin:8px 0 0;">
          <li>Fast for 8–12 hours if a fasting test is included</li>
          <li>Drink plenty of water (unless advised otherwise)</li>
          <li>Be available at the collection address during your slot</li>
        </ul>
      </div>
      ${cta('View Appointment', '/dashboard/appointments')}
    `),
  }),

  sample_collected: (d) => ({
    subject: `🧪 Sample Collected – Processing Underway`,
    html: layout(`
      <p style="margin:0 0 8px;color:#1e293b;font-size:22px;font-weight:700;">Hi ${d.patientName},</p>
      <p style="color:#475569;font-size:15px;line-height:1.6;">Your sample has been <strong style="color:#0284c7;">🧪 Successfully Collected</strong> and is on its way to our certified laboratory.</p>
      ${detailTable([
        detailRow('Package', d.packageName),
        detailRow('Collected On', fmtDate(d.date)),
      ])}
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px 20px;margin:20px 0;">
        <p style="margin:0;color:#1e40af;font-size:14px;font-weight:600;">🔬 What Happens Next</p>
        <ul style="color:#1d4ed8;font-size:13px;line-height:2;padding-left:18px;margin:8px 0 0;">
          <li>Results are typically ready within <strong>24–48 hours</strong></li>
          <li>You will receive an email as soon as your report is available</li>
        </ul>
      </div>
      ${cta('Track Status', '/dashboard/appointments')}
    `),
  }),

  report_ready: (d) => ({
    subject: `📄 Your ${d.packageName} Report is Ready`,
    html: layout(`
      <p style="margin:0 0 8px;color:#1e293b;font-size:22px;font-weight:700;">Hi ${d.patientName},</p>
      <p style="color:#475569;font-size:15px;line-height:1.6;">Your test report for the <strong>${d.packageName}</strong> package is <strong style="color:#7c3aed;">📄 Ready!</strong> View and download it from your dashboard.</p>
      ${detailTable([
        detailRow('Package', d.packageName),
        detailRow('Test Date', fmtDate(d.date)),
      ])}
      ${cta('View & Download Report', '/dashboard/reports')}
    `),
  }),

  reminder: (d, hoursLeft) => ({
    subject: `⏰ Reminder: Your appointment is in ${hoursLeft} hours`,
    html: layout(`
      <p style="margin:0 0 8px;color:#1e293b;font-size:22px;font-weight:700;">Hi ${d.patientName},</p>
      <p style="color:#475569;font-size:15px;line-height:1.6;">⏰ Your appointment is <strong>in approximately ${hoursLeft} hour${hoursLeft !== 1 ? 's' : ''}</strong>.</p>
      ${detailTable([
        detailRow('Package', d.packageName),
        detailRow('Date', fmtDate(d.date)),
        detailRow('Time Slot', d.timeSlot),
        detailRow('Collection At', d.collectionAddress),
      ])}
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px 20px;margin:20px 0;">
        <p style="margin:0;color:#92400e;font-size:14px;font-weight:600;">🔔 Last-Minute Checklist</p>
        <ul style="color:#b45309;font-size:13px;line-height:2;padding-left:18px;margin:8px 0 0;">
          <li>Continue fasting if applicable (water is fine)</li>
          <li>Keep your phone nearby — our team may call to confirm arrival</li>
        </ul>
      </div>
      ${cta('View Appointment', '/dashboard/appointments')}
    `),
  }),
}

// ─── Mode: process mailQueue ───────────────────────────────────────────────

async function processQueue() {
  console.log('▶ Processing mailQueue...')
  const snap = await db
    .collection('mailQueue')
    .where('status', '==', 'pending')
    .limit(50)
    .get()

  if (snap.empty) { console.log('   No pending emails.'); return }

  for (const docSnap of snap.docs) {
    const item = docSnap.data()
    const tmplFn = TEMPLATES[item.type]
    if (!tmplFn) {
      console.warn(`   Unknown email type: ${item.type} — skipping`)
      await docSnap.ref.update({ status: 'failed', error: 'unknown_type', processedAt: FieldValue.serverTimestamp() })
      continue
    }
    const { subject, html } = tmplFn(item.data)
    const ok = await sendMail(item.to, subject, html)
    await docSnap.ref.update({
      status: ok ? 'sent' : 'failed',
      processedAt: FieldValue.serverTimestamp(),
    })
  }
  console.log(`✅ Processed ${snap.size} queued email(s).`)
}

// ─── Mode: send appointment reminders ─────────────────────────────────────

async function sendReminders() {
  console.log('▶ Checking appointment reminders...')

  // Read configurable reminder window from Firestore
  let reminderHours = parseInt(process.env.REMINDER_HOURS_BEFORE ?? '0', 10) || 4
  try {
    const cfgSnap = await db.doc('config/emailSettings').get()
    if (cfgSnap.exists) {
      const val = cfgSnap.data()?.reminderHoursBefore
      if (typeof val === 'number' && val > 0) reminderHours = val
    }
  } catch { /* use default */ }
  console.log(`   Reminder window: ${reminderHours} hours`)

  const nowIstMs = Date.now() + IST_OFFSET_MS
  const targetIstMs = nowIstMs + reminderHours * 60 * 60 * 1000
  const windowMs = 30 * 60 * 1000

  // Query today + tomorrow (IST) to keep scope small
  const todayIST    = istDateString(nowIstMs)
  const tomorrowIST = istDateString(nowIstMs + 24 * 60 * 60 * 1000)

  const snap = await db
    .collection('appointments')
    .where('status', '==', 'Confirmed')
    .where('date', 'in', [todayIST, tomorrowIST])
    .get()

  if (snap.empty) { console.log('   No confirmed appointments found.'); return }

  let sent = 0
  for (const apptDoc of snap.docs) {
    const appt = apptDoc.data()
    if (appt.reminderSent === true) continue

    const apptIstMs = parseApptIstMs(appt.date, appt.timeSlot)
    if (isNaN(apptIstMs)) continue
    if (Math.abs(apptIstMs - targetIstMs) > windowMs) continue

    // Fetch patient email
    const patientSnap = await db.doc(`users/${appt.patientId}`).get()
    if (!patientSnap.exists) continue
    const patientEmail = patientSnap.data()?.email
    if (!patientEmail) continue

    const { subject, html } = TEMPLATES.reminder({
      patientName: appt.patientName,
      packageName: appt.packageName,
      packagePrice: appt.packagePrice,
      date: appt.date,
      timeSlot: appt.timeSlot,
      collectionAddress: appt.collectionAddress,
    }, reminderHours)

    const ok = await sendMail(patientEmail, subject, html)
    if (ok) {
      await apptDoc.ref.update({ reminderSent: true })
      sent++
    }
  }
  console.log(`✅ Sent ${sent} reminder(s).`)
}

// ─── Utilities ─────────────────────────────────────────────────────────────

function istDateString(istMs) {
  const d = new Date(istMs)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseApptIstMs(dateStr, timeSlot) {
  const [y, mo, d] = dateStr.split('-').map(Number)
  const [time, meridiem] = timeSlot.split(' ')
  let [h, min] = time.split(':').map(Number)
  if (meridiem === 'PM' && h !== 12) h += 12
  if (meridiem === 'AM' && h === 12) h = 0
  return Date.UTC(y, mo - 1, d, h, min) + IST_OFFSET_MS
}

// ─── Entry point ──────────────────────────────────────────────────────────

const mode = process.env.WORKER_MODE ?? 'queue'
console.log(`CellTale Email Worker — mode: ${mode}`)

// Reminder mode disabled for now — uncomment when ready
// if (mode === 'reminders') {
//   await sendReminders()
// } else {
//   await processQueue()
// }
await processQueue()
