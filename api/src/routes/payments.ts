import { Router, Response } from 'express'
import rateLimit from 'express-rate-limit'
import { verifyAuth, AuthRequest } from '../middleware/verifyAuth'
import {
  createOrder,
  verifyWebhookSignature,
  getOrderStatus,
} from '../services/paymentService'

const router = Router()

// ─── Rate limiter for payment endpoints ───────────────────────────────────────
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many payment requests. Please try again later.' },
})

// ─── POST /api/payments/create-order ─────────────────────────────────────────
// Authenticated patients only: creates a payment order with the gateway.
// Returns the gateway order ID and amount for the client SDK to complete payment.
router.post(
  '/create-order',
  verifyAuth,
  paymentLimiter,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { appointmentId, amountPaise, currency } = req.body as {
      appointmentId?: unknown
      amountPaise?: unknown
      currency?: unknown
    }

    if (
      typeof appointmentId !== 'string' || !appointmentId.trim() ||
      typeof amountPaise !== 'number' || amountPaise <= 0 ||
      currency !== 'INR'
    ) {
      res.status(400).json({
        error: 'Invalid request. Required: appointmentId (string), amountPaise (number > 0), currency ("INR")',
      })
      return
    }

    try {
      const order = await createOrder({
        appointmentId: appointmentId.trim(),
        amountPaise,
        currency: 'INR',
        notes: { uid: req.user?.uid ?? '' },
      })
      res.json(order)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      if (message === 'Payment gateway not yet configured') {
        res.status(501).json({ error: 'Payment gateway not yet configured.' })
      } else {
        console.error('[POST /api/payments/create-order]', err)
        res.status(500).json({ error: 'Failed to create payment order.' })
      }
    }
  },
)

// ─── POST /api/payments/verify-webhook ───────────────────────────────────────
// Called by the payment gateway webhook after a successful payment.
// Does NOT require Firebase Auth — authenticated via the gateway's HMAC signature.
// IMPORTANT: raw body parsing is required for signature verification; mount this
// route BEFORE express.json() if you add raw body support in app.ts.
router.post(
  '/verify-webhook',
  async (req, res: Response): Promise<void> => {
    const signature = req.headers['x-razorpay-signature'] as string | undefined

    if (!signature) {
      res.status(400).json({ error: 'Missing webhook signature' })
      return
    }

    const secret = process.env.RAZORPAY_WEBHOOK_SECRET ?? ''
    if (!secret) {
      console.error('[verify-webhook] RAZORPAY_WEBHOOK_SECRET env var is not set')
      res.status(500).json({ error: 'Webhook secret not configured' })
      return
    }

    try {
      const isValid = await verifyWebhookSignature({
        rawBody: JSON.stringify(req.body),
        signature,
        secret,
      })

      if (!isValid) {
        res.status(401).json({ error: 'Invalid webhook signature' })
        return
      }

      // TODO: update Firestore appointment/payment status from req.body event
      res.json({ received: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      if (message === 'Payment gateway not yet configured') {
        res.status(501).json({ error: 'Payment gateway not yet configured.' })
      } else {
        console.error('[POST /api/payments/verify-webhook]', err)
        res.status(500).json({ error: 'Webhook processing failed.' })
      }
    }
  },
)

// ─── GET /api/payments/:orderId ───────────────────────────────────────────────
// Authenticated patients: check payment status for a specific order.
router.get(
  '/:orderId',
  verifyAuth,
  paymentLimiter,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { orderId } = req.params

    // Basic sanity-check on the orderId to prevent path traversal or injection
    if (!orderId || !/^[\w-]{1,100}$/.test(orderId)) {
      res.status(400).json({ error: 'Invalid order ID' })
      return
    }

    try {
      const status = await getOrderStatus(orderId)
      res.json(status)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      if (message === 'Payment gateway not yet configured') {
        res.status(501).json({ error: 'Payment gateway not yet configured.' })
      } else {
        console.error(`[GET /api/payments/${orderId}]`, err)
        res.status(500).json({ error: 'Failed to fetch payment status.' })
      }
    }
  },
)

export default router
