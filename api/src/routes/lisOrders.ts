/**
 * LIS middleware integration routes.
 *
 * Called by the Windows LIS service (not a browser), so:
 *   - No CSRF/session; authenticated by a shared API key in the Authorization header.
 *   - CORS is implicitly allowed for requests without an Origin header (server-to-server).
 */
import { Router, Request, Response } from 'express'
import * as admin from 'firebase-admin'
import { config } from '../config'

const router = Router()

/** Reject requests whose Bearer token doesn't match LIS_API_KEY. */
function requireLisKey(req: Request, res: Response, next: () => void): void {
  const auth = req.headers['authorization'] ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!config.lisApiKey || token !== config.lisApiKey) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  next()
}

// ─── GET /api/lis/order/:patientId ────────────────────────────────────────────
// Called by the LIS middleware when the Erba XL-200 sends a query (Q record)
// after scanning a barcode. The barcode encodes the patient's Firebase UID as
// the Sample ID. We return patient demographics so the analyzer can populate
// Patient Name, Age, and Patient ID fields without manual entry.
//
// Response (200 found):
//   { found: true, patientId, name, dob, age, gender, appointmentId, packageName }
//   dob is ISO 8601 (yyyy-MM-dd) when stored; null otherwise.
//   The LIS middleware uses dob to build the P record BirthDate field.
// Response (200 not found):
//   { found: false }
router.get('/order/:patientId', requireLisKey, async (req: Request, res: Response): Promise<void> => {
  const { patientId } = req.params

  if (!patientId || !/^[\w-]{1,128}$/.test(patientId)) {
    res.status(400).json({ error: 'Invalid patientId' })
    return
  }

  try {
    const db = admin.firestore()

    // 1. Look up patient demographics
    const userSnap = await db.doc(`users/${patientId}`).get()
    if (!userSnap.exists) {
      res.status(200).json({ found: false })
      return
    }

    const user = userSnap.data()!
    // Calculate age: prefer stored age, fall back to DOB, fall back to null
    let age: number | null = user.age ?? null
    if (!age && user.dob) {
      const dob = new Date(user.dob as string)
      const now = new Date()
      age = now.getFullYear() - dob.getFullYear() -
        (now < new Date(now.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0)
    }

    // 2. Find the most recent active appointment for this patient
    const appointmentSnap = await db
      .collection('appointments')
      .where('patientId', '==', patientId)
      .where('status', 'not-in', ['Cancelled', 'Deleted'])
      .orderBy('status')         // required when using not-in
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get()

    const appointment = appointmentSnap.empty ? null : appointmentSnap.docs[0].data()

    res.status(200).json({
      found: true,
      patientId,
      name: (user.name as string) ?? '',
      dob: (user.dob as string) ?? null,   // ISO 8601 yyyy-MM-dd; used by LIS for P record BirthDate
      age,
      gender: (user.gender as string) ?? null,
      appointmentId: appointment ? appointmentSnap.docs[0].id : null,
      packageName: appointment?.packageName ?? null,
    })
  } catch (err) {
    console.error('[GET /api/lis/order] error', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
