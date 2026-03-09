import * as nodemailer from 'nodemailer'
import { config } from '../../config'

let _etherealTransporter: nodemailer.Transporter | null = null

/**
 * In development (NODE_ENV !== 'production'), returns a shared Ethereal fake-SMTP
 * transporter. Emails are captured at https://ethereal.email — no real delivery.
 * In production, uses the Gmail OAuth2 transporter.
 */
export async function createTransporter(): Promise<nodemailer.Transporter> {
  if (process.env.NODE_ENV !== 'production') {
    if (!_etherealTransporter) {
      const testAccount = await nodemailer.createTestAccount()
      _etherealTransporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: { user: testAccount.user, pass: testAccount.pass },
      })
      console.info(`[transporter] DEV mode — Ethereal test account: ${testAccount.user}`)
      console.info(`[transporter] Preview emails at https://ethereal.email`)
    }
    return _etherealTransporter
  }

  // Prefer App Password (simple, never expires) over OAuth2
  if (config.gmail.appPassword) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: config.gmail.user,
        pass: config.gmail.appPassword,
      },
    })
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: config.gmail.user,
      clientId: config.gmail.clientId,
      clientSecret: config.gmail.clientSecret,
      refreshToken: config.gmail.refreshToken,
    },
  })
}
