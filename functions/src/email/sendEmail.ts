import * as functions from 'firebase-functions'
import { config } from '../config'
import { createTransporter } from './transporter'

export interface EmailPayload {
  to: string
  subject: string
  html: string
}

/**
 * Sends an email via the Gmail OAuth2 transporter.
 * Logs success/failure; never throws – a failed email should not crash the trigger.
 */
export async function sendEmail(payload: EmailPayload): Promise<void> {
  const transporter = createTransporter()
  try {
    const info = await transporter.sendMail({
      from: `"${config.app.name}" <${config.gmail.user}>`,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
    })
    functions.logger.info(`Email sent to ${payload.to}`, { messageId: info.messageId })
  } catch (err) {
    functions.logger.error(`Failed to send email to ${payload.to}`, { err })
  }
}
