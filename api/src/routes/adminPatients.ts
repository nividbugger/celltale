import { Router, Response } from 'express'
import * as admin from 'firebase-admin'
import { verifyAuth, AuthRequest } from '../middleware/verifyAuth'
import { requireAdmin } from '../middleware/requireAdmin'
import { asyncHandler } from '../middleware/asyncHandler'

const router = Router()

const PHONE_REGEX = /^[6-9]\d{9}$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function toE164(phone: string): string {
  return `+91${phone}`
}

interface PatientInput {
  name: string
  phone: string
  email: string | null
  company: string | null
  age: number | null
  gender: string | null
  additionalInfo: string | null
}

/** Validates and normalizes the request body shared by create and update. */
function parsePatientInput(
  body: unknown,
  { requireFields }: { requireFields: boolean },
): { data: PatientInput } | { error: string } {
  const { name, phone, email, company, age, gender, additionalInfo } = (body ?? {}) as Record<string, unknown>

  if (requireFields || name !== undefined) {
    if (typeof name !== 'string' || !name.trim()) {
      return { error: 'name is required' }
    }
  }
  if (requireFields || phone !== undefined) {
    if (typeof phone !== 'string' || !PHONE_REGEX.test(phone)) {
      return { error: 'phone must be a valid 10-digit Indian mobile number' }
    }
  }
  if (email !== undefined && email !== null && email !== '') {
    if (typeof email !== 'string' || !EMAIL_REGEX.test(email)) {
      return { error: 'email must be a valid email address' }
    }
  }
  if (company !== undefined && company !== null && typeof company !== 'string') {
    return { error: 'company must be a string' }
  }
  if (age !== undefined && age !== null && typeof age !== 'number') {
    return { error: 'age must be a number' }
  }
  if (gender !== undefined && gender !== null && typeof gender !== 'string') {
    return { error: 'gender must be a string' }
  }
  if (additionalInfo !== undefined && additionalInfo !== null && typeof additionalInfo !== 'string') {
    return { error: 'additionalInfo must be a string' }
  }

  return {
    data: {
      name: typeof name === 'string' ? name.trim() : '',
      phone: typeof phone === 'string' ? phone : '',
      email: (email as string) || null,
      company: (company as string)?.trim() || null,
      age: (age as number) || null,
      gender: (gender as string)?.trim() || null,
      additionalInfo: (additionalInfo as string)?.trim() || null,
    },
  }
}

// ─── POST /api/admin/patients ─────────────────────────────────────────────────
// Admin only: registers a patient the admin has met in person (e.g. a company/
// school camp) with just name + phone. Creates a phone-only Firebase Auth user
// so the patient can later sign in themselves via phone/OTP and land on this
// same pre-filled profile — Firebase resolves phone-auth sign-ins to whichever
// Auth user already owns that phone number.
router.post(
  '/',
  verifyAuth,
  requireAdmin,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const parsed = parsePatientInput(req.body, { requireFields: true })
    if ('error' in parsed) {
      res.status(400).json({ error: parsed.error })
      return
    }
    const { name, phone, email, company } = parsed.data
    const phoneNumber = toE164(phone)

    try {
      await admin.auth().getUserByPhoneNumber(phoneNumber)
      res.status(409).json({ error: 'A patient with this phone number is already registered' })
      return
    } catch (err) {
      if ((err as { code?: string }).code !== 'auth/user-not-found') {
        console.error('[POST /api/admin/patients] getUserByPhoneNumber failed', err)
        res.status(500).json({ error: 'Internal server error' })
        return
      }
    }

    try {
      const authUser = await admin.auth().createUser({
        phoneNumber,
        displayName: name,
        ...(email ? { email } : {}),
      })

      const userDoc: any = {
        uid: authUser.uid,
        name,
        phone,
        email: email ?? '',
        collectionTimestamp: admin.firestore.FieldValue.serverTimestamp(),
        role: 'patient' as const,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      }
      if (company && company !== '') userDoc.company = company
      if (parsed.data.age) userDoc.age = parsed.data.age
      if (parsed.data.gender && parsed.data.gender !== '') userDoc.gender = parsed.data.gender
      if (parsed.data.additionalInfo && parsed.data.additionalInfo !== '') userDoc.additionalInfo = parsed.data.additionalInfo
      await admin.firestore().doc(`users/${authUser.uid}`).set(userDoc)

      res.status(201).json({ ...userDoc, createdAt: null, collectionTimestamp: null })
    } catch (err) {
      console.error('[POST /api/admin/patients] createUser failed', err)
      res.status(500).json({ error: 'Failed to register patient' })
    }
  },
)

// ─── PATCH /api/admin/patients/:uid ───────────────────────────────────────────
// Admin only: edits an existing patient's details. Changing phone re-links the
// Firebase Auth user to the new number (after checking it isn't already taken).
router.patch(
  '/:uid',
  verifyAuth,
  requireAdmin,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { uid } = req.params
    if (!uid || !/^[\w-]{1,128}$/.test(uid)) {
      res.status(400).json({ error: 'Invalid uid' })
      return
    }

    const parsed = parsePatientInput(req.body, { requireFields: false })
    if ('error' in parsed) {
      res.status(400).json({ error: parsed.error })
      return
    }
    const body = (req.body ?? {}) as Record<string, unknown>
    const hasName = typeof body.name === 'string'
    const hasPhone = typeof body.phone === 'string'
    const hasEmail = body.email !== undefined
    const hasCompany = body.company !== undefined
    const hasAge = body.age !== undefined
    const hasGender = body.gender !== undefined
    const hasAdditionalInfo = body.additionalInfo !== undefined

    const userRef = admin.firestore().doc(`users/${uid}`)
    const existing = await userRef.get()
    if (!existing.exists) {
      res.status(404).json({ error: 'Patient not found' })
      return
    }

    if (hasPhone && parsed.data.phone !== existing.data()?.phone) {
      const phoneNumber = toE164(parsed.data.phone)
      try {
        const conflicting = await admin.auth().getUserByPhoneNumber(phoneNumber)
        if (conflicting.uid !== uid) {
          res.status(409).json({ error: 'A patient with this phone number is already registered' })
          return
        }
      } catch (err) {
        if ((err as { code?: string }).code !== 'auth/user-not-found') {
          console.error('[PATCH /api/admin/patients] getUserByPhoneNumber failed', err)
          res.status(500).json({ error: 'Internal server error' })
          return
        }
      }
      try {
        await admin.auth().updateUser(uid, { phoneNumber })
      } catch (err) {
        console.error('[PATCH /api/admin/patients] updateUser failed', err)
        res.status(500).json({ error: 'Failed to update phone number' })
        return
      }
    }

    const updates: Record<string, unknown> = {}
    if (hasName) updates.name = parsed.data.name
    if (hasPhone) updates.phone = parsed.data.phone
    if (hasEmail) updates.email = parsed.data.email ?? ''
    if (hasCompany) updates.company = parsed.data.company ?? admin.firestore.FieldValue.delete()
    if (hasAge) updates.age = parsed.data.age ?? admin.firestore.FieldValue.delete()
    if (hasGender) updates.gender = parsed.data.gender ?? admin.firestore.FieldValue.delete()
    if (hasAdditionalInfo) updates.additionalInfo = parsed.data.additionalInfo ?? admin.firestore.FieldValue.delete()

    try {
      await userRef.update(updates)
      const updated = await userRef.get()
      res.json({ id: updated.id, ...updated.data() })
    } catch (err) {
      console.error('[PATCH /api/admin/patients] Firestore update failed', err)
      res.status(500).json({ error: 'Failed to update patient' })
    }
  },
)

/** Deletes Firestore docs in chunks of ≤500 (Firestore's per-batch write limit). */
async function batchDelete(refs: FirebaseFirestore.DocumentReference[]): Promise<void> {
  const db = admin.firestore()
  for (let i = 0; i < refs.length; i += 500) {
    const batch = db.batch()
    refs.slice(i, i + 500).forEach((ref) => batch.delete(ref))
    await batch.commit()
  }
}

// ─── DELETE /api/admin/patients/:uid ──────────────────────────────────────────
// Admin only: permanently deletes a patient — the Firebase Auth account (so the phone/email
// can never sign back into this same identity), the Firestore profile, and every appointment,
// sample, and report tied to them. This is a genuine wipe, not a soft-delete: if the same
// person walks in again, they are registered as an entirely new patient with no history.
// Invoices are intentionally NOT deleted — they're financial/GST records that must survive
// independent of whether the underlying patient account still exists.
router.delete(
  '/:uid',
  verifyAuth,
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { uid } = req.params
    if (!uid || !/^[\w-]{1,128}$/.test(uid)) {
      res.status(400).json({ error: 'Invalid uid' })
      return
    }

    const db = admin.firestore()
    const userRef = db.doc(`users/${uid}`)
    const userSnap = await userRef.get()
    if (!userSnap.exists) {
      res.status(404).json({ error: 'Patient not found' })
      return
    }
    if (userSnap.data()?.role !== 'patient') {
      res.status(400).json({ error: 'This endpoint only deletes patient accounts' })
      return
    }

    const apptSnap = await db.collection('appointments').where('patientId', '==', uid).get()
    const appointmentIds = apptSnap.docs.map((d) => d.id)

    const [sampleRefs, reportRefs] = await Promise.all([
      appointmentIds.length > 0
        ? Promise.all(
            appointmentIds.map((id) => db.collection('samples').where('appointmentId', '==', id).get()),
          ).then((snaps) => snaps.flatMap((s) => s.docs.map((d) => d.ref)))
        : Promise.resolve([]),
      appointmentIds.length > 0
        ? Promise.all(
            appointmentIds.map((id) => db.collection('reports').where('appointmentId', '==', id).get()),
          ).then((snaps) => snaps.flatMap((s) => s.docs.map((d) => d.ref)))
        : Promise.resolve([]),
    ])

    await batchDelete([...sampleRefs, ...reportRefs, ...apptSnap.docs.map((d) => d.ref)])

    // Best-effort: uploaded report PDFs live in Cloud Storage under reports/{appointmentId}/,
    // not in Firestore — clean those up too, but don't fail the whole deletion over it.
    try {
      const bucket = admin.storage().bucket()
      await Promise.all(
        appointmentIds.map((id) => bucket.deleteFiles({ prefix: `reports/${id}/` }).catch(() => {})),
      )
    } catch (err) {
      console.error(`[DELETE /api/admin/patients/${uid}] Storage cleanup failed (non-fatal)`, err)
    }

    await userRef.delete()

    try {
      await admin.auth().deleteUser(uid)
    } catch (err) {
      // If the Auth user is already gone (e.g. a retry after a partial prior failure), that's
      // fine — the account no longer being able to sign in is the actual goal, and it can't.
      if ((err as { code?: string }).code !== 'auth/user-not-found') {
        console.error(`[DELETE /api/admin/patients/${uid}] Auth user deletion failed`, err)
        res.status(500).json({
          error: 'Patient data was deleted, but removing the login account failed — they may still be able to sign in. Retry this delete.',
        })
        return
      }
    }

    res.json({
      success: true,
      deletedAppointments: appointmentIds.length,
      deletedSamples: sampleRefs.length,
      deletedReports: reportRefs.length,
    })
  }),
)

export default router
