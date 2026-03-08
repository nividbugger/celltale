import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { sendEmail } from '../email/sendEmail'
import { welcomeTemplate } from '../email/templates'
import { config } from '../config'

/**
 * Fires when a new document is created in the `users` collection.
 * Sends a welcome email to the new patient.
 */
export const onUserCreated = onDocumentCreated(
  { document: 'users/{uid}', region: config.region },
  async (event) => {
    const user = event.data?.data()
    if (!user) return

    // Only send to patients, not admin accounts
    if (user.role !== 'patient') return

    await sendEmail({
      to: user.email,
      subject: `Welcome to ${config.app.name}!`,
      html: welcomeTemplate(user.name),
    })
  },
)
