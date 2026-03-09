import { Request, Response, NextFunction } from 'express'
import * as admin from 'firebase-admin'

/**
 * Extends Express's Request with the decoded Firebase Auth token.
 * Populated by the verifyAuth middleware.
 */
export interface AuthRequest extends Request {
  user?: admin.auth.DecodedIdToken
}

/**
 * Middleware: verifies the Firebase Auth ID token from the Authorization header.
 *
 * Expected header:
 *   Authorization: Bearer <Firebase ID token>
 *
 * On success: attaches `req.user` (DecodedIdToken) and calls next().
 * On failure: responds with 401 — never reveals WHY the token was rejected to
 *             prevent enumeration of valid vs. invalid tokens.
 */
export async function verifyAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: missing or malformed Authorization header' })
    return
  }

  const token = authHeader.slice('Bearer '.length)

  // Reject tokens that look obviously malformed before sending them to Firebase.
  // A valid Firebase ID token is a JWT: three base64url segments separated by dots.
  if (!/^[\w-]+\.[\w-]+\.[\w-]+$/.test(token)) {
    res.status(401).json({ error: 'Unauthorized: invalid token format' })
    return
  }

  try {
    // checkRevoked: true ensures the token is still valid even if the user's
    // session has been revoked in the Firebase console.
    const decoded = await admin.auth().verifyIdToken(token, /* checkRevoked= */ true)
    req.user = decoded
    next()
  } catch {
    // Intentionally vague: don't tell the caller whether the token is expired,
    // revoked, or completely forged.
    res.status(401).json({ error: 'Unauthorized: invalid or expired token' })
  }
}
