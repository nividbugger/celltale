import * as nodemailer from 'nodemailer'
import { config } from '../../config'
import { createTransporter } from './transporter'

export interface EmailPayload {
  to: string
  subject: string
  html: string
}

/**
 * Sends a transactional email via the Gmail OAuth2 transporter.
 *
 * Unlike the Cloud Functions trigger version, this function THROWS on failure
 * so the HTTP route handler can return an appropriate error response to the caller.
 */
export async function sendEmail(payload: EmailPayload): Promise<void> {
  const transporter = await createTransporter()
  const info = await transporter.sendMail({
    from: `"${config.app.name}" <${config.app.fromEmail}>`,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
  })
  console.info(`[sendEmail] Sent to ${payload.to} — messageId: ${info.messageId}`)
  if (process.env.NODE_ENV !== 'production') {
    console.info(`[sendEmail] Preview URL: ${nodemailer.getTestMessageUrl(info)}`)
  }
}
