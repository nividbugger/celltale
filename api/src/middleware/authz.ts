import { Response } from 'express'
import * as admin from 'firebase-admin'
import { AuthRequest } from './verifyAuth'

export async function isAdminUser(uid: string): Promise<boolean> {
  const snap = await admin.firestore().doc(`users/${uid}`).get()
  return snap.exists && snap.data()?.role === 'admin'
}

/**
 * True if the caller may act on behalf of `patientId` — either they ARE that patient, or
 * they're an admin acting on a patient's behalf (e.g. a walk-in). Writes a 403 and returns
 * false otherwise. Mirrors `requireAdmin`'s posture of not revealing which check failed.
 */
export async function requireSelfOrAdmin(
  req: AuthRequest,
  res: Response,
  patientId: string,
): Promise<boolean> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return false
  }
  if (req.user.uid === patientId) return true
  if (await isAdminUser(req.user.uid)) return true
  res.status(403).json({ error: 'Forbidden' })
  return false
}
