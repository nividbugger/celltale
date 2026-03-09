import { Response, NextFunction } from 'express'
import * as admin from 'firebase-admin'
import { AuthRequest } from './verifyAuth'

/**
 * Middleware: checks that the authenticated user has `role === 'admin'` in
 * Firestore. Must be used AFTER verifyAuth.
 *
 * Returns 403 Forbidden for non-admin users and 401 if verifyAuth was skipped.
 * Returns a generic 500 on Firestore lookup failures to avoid leaking internal
 * error details.
 */
export async function requireAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.user) {
    // verifyAuth was not applied before this middleware
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const snap = await admin.firestore().doc(`users/${req.user.uid}`).get()

    if (!snap.exists || snap.data()?.role !== 'admin') {
      // Return 403 for both "user doc not found" and "role !== admin" to avoid
      // leaking whether a UID exists in the database.
      res.status(403).json({ error: 'Forbidden: admin access required' })
      return
    }

    next()
  } catch {
    // Log server-side but return a generic message to the client
    console.error(`[requireAdmin] Firestore lookup failed for uid=${req.user.uid}`)
    res.status(500).json({ error: 'Internal server error' })
  }
}
