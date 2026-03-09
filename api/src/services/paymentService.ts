/**
 * Payment service stubs.
 *
 * Implement these functions when integrating a payment gateway (e.g. Razorpay).
 * Each stub throws a "not implemented" error so routes return HTTP 501 cleanly.
 *
 * Recommended gateway for INR payments: Razorpay
 *   npm install razorpay  (add to api/package.json)
 */

export interface CreateOrderParams {
  appointmentId: string
  amountPaise: number   // Amount in smallest currency unit (paise for INR)
  currency: 'INR'
  notes?: Record<string, string>
}

export interface OrderResult {
  orderId: string
  amount: number
  currency: string
  receipt: string
}

export interface VerifyWebhookParams {
  rawBody: string
  signature: string
  secret: string
}

// ─── Stubs ────────────────────────────────────────────────────────────────────

export async function createOrder(_params: CreateOrderParams): Promise<OrderResult> {
  throw new Error('Payment gateway not yet configured')
}

export async function verifyWebhookSignature(_params: VerifyWebhookParams): Promise<boolean> {
  throw new Error('Payment gateway not yet configured')
}

export async function getOrderStatus(_orderId: string): Promise<Record<string, unknown>> {
  throw new Error('Payment gateway not yet configured')
}
