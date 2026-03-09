import * as admin from 'firebase-admin'
import { setGlobalOptions } from 'firebase-functions/v2'
import { onRequest } from 'firebase-functions/v2/https'
import { config } from './config'

// ─── Bootstrap ────────────────────────────────────────────────────────────────
// Initialize Admin SDK with default credentials (automatically provided in the
// Functions runtime). Safe to call once; guarded against double-init.
if (!admin.apps.length) {
  admin.initializeApp()
}

setGlobalOptions({ region: config.region })

// Import app AFTER initializeApp so middleware can safely reference admin singletons
// at request time (not module-load time).
import { app } from './app'

// ─── Export ───────────────────────────────────────────────────────────────────
// CORS is handled entirely by the Express cors() middleware below; set to false
// here so Firebase does not add its own permissive headers on top.
export const api = onRequest({ cors: false }, app)
