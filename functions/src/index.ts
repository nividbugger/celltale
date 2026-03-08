import * as admin from 'firebase-admin'

// Initialize Firebase Admin SDK (once, at cold start)
admin.initializeApp()

// ─── Export all Cloud Functions ───────────────────────────────────────────

export { onUserCreated } from './triggers/onUserCreated'
export { onAppointmentCreated } from './triggers/onAppointmentCreated'
export { onAppointmentUpdated } from './triggers/onAppointmentUpdated'
export { sendReminders } from './triggers/scheduledReminder'
