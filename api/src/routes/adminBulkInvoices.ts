import { Router, Response } from 'express'
import * as admin from 'firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import { verifyAuth, AuthRequest } from '../middleware/verifyAuth'
import { requireAdmin } from '../middleware/requireAdmin'

const router = Router()

async function nextInvoiceNumber(): Promise<number> {
  const ref = admin.firestore().doc('config/invoiceCounter')
  return admin.firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    const next = (snap.exists ? (snap.data()?.lastNumber as number) : 0) + 1
    tx.set(ref, { lastNumber: next })
    return next
  })
}

interface PackageEntry {
  packageId: string
  packageName: string
  priceAtBooking: number
}

interface LineItemInput {
  packageId: string
  packageName: string
  patientCount: number
  pricePerPatient: number
  totalAmount: number
}

// POST /api/admin/bulk-invoices
// Body: { instituteName, date, appointmentIds, lineItems? }
// When lineItems is supplied (from the preview modal), those values are used as-is;
// otherwise they are computed from the appointments.
router.post('/', verifyAuth, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const { instituteName, date, appointmentIds, lineItems: clientLineItems } = (req.body ?? {}) as Record<string, unknown>

  if (typeof instituteName !== 'string' || !instituteName.trim()) {
    res.status(400).json({ error: 'instituteName is required' })
    return
  }
  if (typeof date !== 'string' || !date.trim()) {
    res.status(400).json({ error: 'date is required' })
    return
  }
  if (!Array.isArray(appointmentIds) || appointmentIds.length === 0) {
    res.status(400).json({ error: 'at least one appointmentId is required' })
    return
  }
  if ((appointmentIds as unknown[]).some((id) => typeof id !== 'string')) {
    res.status(400).json({ error: 'all appointmentIds must be strings' })
    return
  }

  // Validate caller-supplied line items if present
  if (clientLineItems !== undefined) {
    if (!Array.isArray(clientLineItems) || clientLineItems.length === 0) {
      res.status(400).json({ error: 'lineItems must be a non-empty array when provided' })
      return
    }
    for (const li of clientLineItems as unknown[]) {
      const item = li as Record<string, unknown>
      if (typeof item.packageName !== 'string' || !item.packageName.trim()) {
        res.status(400).json({ error: 'each lineItem must have a packageName' })
        return
      }
      if (typeof item.patientCount !== 'number' || item.patientCount <= 0) {
        res.status(400).json({ error: 'each lineItem must have a positive patientCount' })
        return
      }
      if (typeof item.pricePerPatient !== 'number' || item.pricePerPatient < 0) {
        res.status(400).json({ error: 'each lineItem pricePerPatient must be non-negative' })
        return
      }
    }
  }

  const ids = appointmentIds as string[]

  try {
    const db = admin.firestore()

    // Load and validate all appointments
    const apptSnaps = await Promise.all(ids.map((id) => db.doc(`appointments/${id}`).get()))

    const missing = apptSnaps.filter((s) => !s.exists)
    if (missing.length > 0) {
      res.status(404).json({ error: `${missing.length} appointment(s) not found` })
      return
    }

    const alreadyBilled = apptSnaps.filter((s) => s.data()?.bulkInvoiceId)
    if (alreadyBilled.length > 0) {
      res.status(409).json({ error: `${alreadyBilled.length} appointment(s) are already in a bulk invoice` })
      return
    }

    let lineItems: LineItemInput[]

    if (Array.isArray(clientLineItems) && clientLineItems.length > 0) {
      // Use caller-supplied line items (from preview modal, possibly price-edited)
      lineItems = (clientLineItems as Record<string, unknown>[]).map((li) => ({
        packageId: (li.packageId as string) ?? '__custom__',
        packageName: (li.packageName as string).trim(),
        patientCount: li.patientCount as number,
        pricePerPatient: li.pricePerPatient as number,
        totalAmount: (li.patientCount as number) * (li.pricePerPatient as number),
      }))
    } else {
      // Compute from appointment data
      const packageGroups = new Map<string, {
        packageId: string
        packageName: string
        pricePerPatient: number
        patientCount: number
      }>()
      let adHocCount = 0
      let adHocTotal = 0

      for (const snap of apptSnaps) {
        const data = snap.data()!
        const packages: PackageEntry[] = data.packages ?? []

        if (packages.length === 0) {
          adHocCount++
          adHocTotal += data.totalCost ?? 0
        } else {
          for (const pkg of packages) {
            const existing = packageGroups.get(pkg.packageId)
            if (existing) {
              existing.patientCount++
            } else {
              packageGroups.set(pkg.packageId, {
                packageId: pkg.packageId,
                packageName: pkg.packageName,
                pricePerPatient: pkg.priceAtBooking,
                patientCount: 1,
              })
            }
          }
        }
      }

      lineItems = Array.from(packageGroups.values()).map((g) => ({
        packageId: g.packageId,
        packageName: g.packageName,
        patientCount: g.patientCount,
        pricePerPatient: g.pricePerPatient,
        totalAmount: g.patientCount * g.pricePerPatient,
      }))

      if (adHocCount > 0) {
        lineItems.push({
          packageId: '__adhoc__',
          packageName: 'Lab Tests (Ad-hoc)',
          patientCount: adHocCount,
          pricePerPatient: adHocCount > 0 ? Math.round(adHocTotal / adHocCount) : 0,
          totalAmount: adHocTotal,
        })
      }
    }

    const totalAmount = lineItems.reduce((sum, li) => sum + li.totalAmount, 0)
    const invoiceNumber = await nextInvoiceNumber()
    const now = FieldValue.serverTimestamp()

    const bulkInvoiceData = {
      invoiceNumber,
      date: (date as string).trim(),
      instituteName: (instituteName as string).trim(),
      lineItems,
      appointmentIds: ids,
      totalAmount,
      isPaid: false,
      createdAt: now,
      updatedAt: now,
    }

    const ref = await db.collection('bulkInvoices').add(bulkInvoiceData)

    // Mark each appointment as billed
    const batch = db.batch()
    for (const id of ids) {
      batch.update(db.doc(`appointments/${id}`), {
        bulkInvoiceId: ref.id,
        updatedAt: now,
      })
    }
    await batch.commit()

    res.status(201).json({ id: ref.id, invoiceNumber, totalAmount })
  } catch (err) {
    console.error('[POST /api/admin/bulk-invoices]', err)
    res.status(500).json({ error: 'Failed to create bulk invoice' })
  }
})

// PATCH /api/admin/bulk-invoices/:id/paid
router.patch('/:id/paid', verifyAuth, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params
  try {
    const db = admin.firestore()
    const snap = await db.doc(`bulkInvoices/${id}`).get()
    if (!snap.exists) {
      res.status(404).json({ error: 'Bulk invoice not found' })
      return
    }
    if (snap.data()?.isPaid) {
      res.status(409).json({ error: 'Bulk invoice is already marked as paid' })
      return
    }
    await db.doc(`bulkInvoices/${id}`).update({
      isPaid: true,
      paidAt: new Date().toISOString(),
      updatedAt: FieldValue.serverTimestamp(),
    })
    res.json({ success: true })
  } catch (err) {
    console.error('[PATCH /api/admin/bulk-invoices/:id/paid]', err)
    res.status(500).json({ error: 'Failed to mark bulk invoice as paid' })
  }
})

// DELETE /api/admin/bulk-invoices/:id
// Removes the bulk invoice and clears bulkInvoiceId on the linked appointments
router.delete('/:id', verifyAuth, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params
  try {
    const db = admin.firestore()
    const snap = await db.doc(`bulkInvoices/${id}`).get()
    if (!snap.exists) {
      res.status(404).json({ error: 'Bulk invoice not found' })
      return
    }
    const data = snap.data()!
    const appointmentIds: string[] = data.appointmentIds ?? []

    // Clear bulkInvoiceId from appointments so they become billable again
    const batch = db.batch()
    for (const apptId of appointmentIds) {
      batch.update(db.doc(`appointments/${apptId}`), {
        bulkInvoiceId: admin.firestore.FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      })
    }
    batch.delete(db.doc(`bulkInvoices/${id}`))
    await batch.commit()

    res.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/admin/bulk-invoices/:id]', err)
    res.status(500).json({ error: 'Failed to delete bulk invoice' })
  }
})

export default router
