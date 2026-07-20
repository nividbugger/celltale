import { Router, Response } from 'express'
import * as admin from 'firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import { verifyAuth, AuthRequest } from '../middleware/verifyAuth'
import { requireAdmin } from '../middleware/requireAdmin'

const router = Router()

interface LineItemInput {
  itemName: string
  hsnSac?: string
  quantity: number
  pricePerUnit: number
  discountPercent: number
}

interface InvoiceInput {
  date: string
  billToName: string
  billToContact?: string
  lineItems: LineItemInput[]
  receivedAmount: number
  appointmentId?: string
  patientId?: string
}

function parseInvoiceInput(body: unknown): { data: InvoiceInput } | { error: string } {
  const { date, billToName, billToContact, lineItems, receivedAmount, appointmentId, patientId } =
    (body ?? {}) as Record<string, unknown>

  if (typeof date !== 'string' || !date.trim()) {
    return { error: 'date is required' }
  }
  if (typeof billToName !== 'string' || !billToName.trim()) {
    return { error: 'billToName is required' }
  }
  if (!Array.isArray(lineItems) || lineItems.length === 0) {
    return { error: 'at least one line item is required' }
  }
  for (const item of lineItems) {
    if (typeof item !== 'object' || item === null) {
      return { error: 'each line item must be an object' }
    }
    const li = item as Record<string, unknown>
    if (typeof li.itemName !== 'string' || !li.itemName.trim()) {
      return { error: 'each line item must have an itemName' }
    }
    if (typeof li.quantity !== 'number' || li.quantity <= 0) {
      return { error: 'each line item must have a positive quantity' }
    }
    if (typeof li.pricePerUnit !== 'number' || li.pricePerUnit < 0) {
      return { error: 'each line item must have a non-negative pricePerUnit' }
    }
    if (typeof li.discountPercent !== 'number' || li.discountPercent < 0 || li.discountPercent > 100) {
      return { error: 'each line item discountPercent must be between 0 and 100' }
    }
  }
  if (typeof receivedAmount !== 'number' || receivedAmount < 0) {
    return { error: 'receivedAmount must be a non-negative number' }
  }
  if (appointmentId !== undefined && typeof appointmentId !== 'string') {
    return { error: 'appointmentId must be a string' }
  }
  if (patientId !== undefined && typeof patientId !== 'string') {
    return { error: 'patientId must be a string' }
  }

  return {
    data: {
      date,
      billToName: billToName.trim(),
      billToContact: typeof billToContact === 'string' ? billToContact.trim() || undefined : undefined,
      lineItems: lineItems.map((li: any) => ({
        itemName: li.itemName.trim(),
        hsnSac: typeof li.hsnSac === 'string' ? li.hsnSac.trim() : undefined,
        quantity: li.quantity,
        pricePerUnit: li.pricePerUnit,
        discountPercent: li.discountPercent,
      })),
      receivedAmount,
      appointmentId: appointmentId as string | undefined,
      patientId: patientId as string | undefined,
    },
  }
}

/** Server-side sibling of the client-side `getNextInvoiceNumber` (src/lib/firestore.ts) — same
 * `config/invoiceCounter` document and `{lastNumber}` shape, just reachable from the Admin SDK
 * for this new appointment-linked endpoint. Both callers use a Firestore transaction, so it's
 * safe for the two write paths to share one counter document. */
async function nextInvoiceNumber(): Promise<number> {
  const ref = admin.firestore().doc('config/invoiceCounter')
  return admin.firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    const next = (snap.exists ? (snap.data()?.lastNumber as number) : 0) + 1
    tx.set(ref, { lastNumber: next })
    return next
  })
}

// ─── POST /api/admin/invoices ─────────────────────────────────────────────────
// Minimal route closing the invoice/appointment linkage gap — invoices were previously created
// entirely client-side with no backend validation and no link to the appointment or patient
// that generated them. Does not otherwise redesign invoicing.
router.post('/', verifyAuth, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = parseInvoiceInput(req.body)
  if ('error' in parsed) {
    res.status(400).json({ error: parsed.error })
    return
  }
  const { appointmentId } = parsed.data

  if (appointmentId) {
    const apptSnap = await admin.firestore().doc(`appointments/${appointmentId}`).get()
    if (!apptSnap.exists) {
      res.status(404).json({ error: 'appointmentId does not reference an existing appointment' })
      return
    }
  }

  try {
    const invoiceNumber = await nextInvoiceNumber()
    const now = FieldValue.serverTimestamp()
    const invoiceData = { ...parsed.data, invoiceNumber, createdAt: now, updatedAt: now }
    const ref = await admin.firestore().collection('invoices').add(invoiceData)

    if (appointmentId) {
      await admin.firestore().doc(`appointments/${appointmentId}`).update({ invoiceId: ref.id })
    }

    res.status(201).json({ id: ref.id, ...invoiceData, createdAt: null, updatedAt: null })
  } catch (err) {
    console.error('[POST /api/admin/invoices]', err)
    res.status(500).json({ error: 'Failed to create invoice' })
  }
})

export default router
