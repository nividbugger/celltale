import { Router, Response } from 'express'
import rateLimit from 'express-rate-limit'
import * as admin from 'firebase-admin'
import { verifyAuth, AuthRequest } from '../middleware/verifyAuth'
import { requireAdmin } from '../middleware/requireAdmin'
import { sendEmail } from '../services/email/sendEmail'
import * as templates from '../services/email/templates'

const router = Router()

// ─── Rate limiter for email sending ──────────────────────────────────────────
// Stricter window to prevent abuse of the send endpoint (20 emails / hour / IP).
const emailSendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Email rate limit exceeded. Please try again later.' },
})

// ─── Allowed email types ─────────────────────────────────────────────────────
const EMAIL_TYPES = [
  'welcome',
  'appointment_booked',
  'appointment_confirmed',
  'sample_collected',
  'report_ready',
] as const

type EmailType = typeof EMAIL_TYPES[number]

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Basic RFC 5322 email format check. Rejects addresses with CRLF chars. */
function isValidEmail(email: unknown): email is string {
  if (typeof email !== 'string') return false
  // Disallow newlines to prevent email header injection
  if (/[\r\n]/.test(email)) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/**
 * Escapes HTML special characters in untrusted strings before they are
 * interpolated into email HTML content. Prevents HTML/script injection
 * in email bodies via user-supplied appointment data.
 */
function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    // Strip all ASCII control characters (including CR, LF, NUL)
    .replace(/[\x00-\x1F\x7F]/g, '')
}

// ─── POST /api/email/send ─────────────────────────────────────────────────────
// Admin only: manually (re)send a transactional email.
// Typical use: resend a confirmation that the patient didn't receive.
router.post(
  '/send',
  verifyAuth,
  requireAdmin,
  emailSendLimiter,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { type, to, data } = req.body as {
      type: unknown
      to: unknown
      data: Record<string, unknown>
    }

    // ── Input validation ────────────────────────────────────────────────────
    if (!type || !to || !data || typeof data !== 'object') {
      res.status(400).json({ error: 'Missing required fields: type, to, data' })
      return
    }

    if (!EMAIL_TYPES.includes(type as EmailType)) {
      res.status(400).json({
        error: `Invalid email type. Allowed values: ${EMAIL_TYPES.join(', ')}`,
      })
      return
    }

    if (!isValidEmail(to)) {
      res.status(400).json({ error: 'Invalid recipient email address' })
      return
    }

    // ── Sanitize all user-controlled template variables ─────────────────────
    const patientName       = escapeHtml(data.patientName)
    const packageName       = escapeHtml(data.packageName)
    const packagePrice      = Math.max(0, Number(data.packagePrice) || 0)
    const date              = escapeHtml(data.date)
    const timeSlot          = escapeHtml(data.timeSlot)
    const collectionAddress = escapeHtml(data.collectionAddress)
    const appointmentId     = escapeHtml(data.appointmentId)
    const notes             = data.notes ? escapeHtml(data.notes) : undefined

    const apptData: templates.AppointmentEmailData = {
      patientName, packageName, packagePrice,
      date, timeSlot, collectionAddress, appointmentId, notes,
    }

    let subject: string
    let html: string

    switch (type as EmailType) {
      case 'welcome':
        subject = `Welcome to ${escapeHtml(data.appName ?? 'CellTale Diagnostics')}!`
        html    = templates.welcomeTemplate(patientName)
        break
      case 'appointment_booked':
        subject = 'Appointment Booked – Pending Confirmation'
        html    = templates.appointmentBookedTemplate(apptData)
        break
      case 'appointment_confirmed':
        subject = '✅ Appointment Confirmed – CellTale Diagnostics'
        html    = templates.appointmentConfirmedTemplate(apptData)
        break
      case 'sample_collected':
        subject = '🧪 Sample Collected – Report Coming Soon'
        html    = templates.sampleCollectedTemplate(apptData)
        break
      case 'report_ready':
        subject = '📄 Your Test Report is Ready'
        html    = templates.reportReadyTemplate(apptData)
        break
      default:
        res.status(400).json({ error: 'Invalid email type' })
        return
    }

    try {
      await sendEmail({ to, subject, html })
      res.json({ success: true, message: `Email '${type}' sent successfully` })
    } catch (err) {
      console.error('[POST /api/email/send] Nodemailer error:', err)
      res.status(500).json({ error: 'Failed to send email. Please try again later.' })
    }
  },
)

// ─── GET /api/email/queue ─────────────────────────────────────────────────────
// Admin only: inspect the mailQueue collection.
// Optional query params:
//   ?status=pending|sent|failed
//   ?limit=20  (max 100)
router.get(
  '/queue',
  verifyAuth,
  requireAdmin,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { status, limit: rawLimit } = req.query as {
      status?: string
      limit?: string
    }

    const pageSize = Math.min(Math.max(1, Number(rawLimit) || 20), 100)

    const VALID_STATUSES = ['pending', 'sent', 'failed']
    const safeStatus =
      status && VALID_STATUSES.includes(status) ? status : null

    try {
      const collRef = admin.firestore().collection('mailQueue')

      // When filtering by status, order by document ID (default) to avoid
      // requiring a composite index. When listing all, order by createdAt desc.
      let query: admin.firestore.Query = safeStatus
        ? collRef.where('status', '==', safeStatus).limit(pageSize)
        : collRef.orderBy('createdAt', 'desc').limit(pageSize)

      const snap = await query.get()
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      res.json({ items, count: items.length })
    } catch {
      res.status(500).json({ error: 'Internal server error' })
    }
  },
)

export default router
