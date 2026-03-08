import * as nodemailer from 'nodemailer'
import { config } from '../config'

/**
 * Creates a Nodemailer transporter backed by Gmail OAuth2.
 * Using OAuth2 is the recommended production approach for Google Workspace.
 *
 * Prerequisites (run ONCE):
 *   1. Enable Gmail API in Google Cloud Console for your project.
 *   2. Create an OAuth 2.0 Client ID (type: Web application).
 *   3. Obtain a refresh token via https://developers.google.com/oauthplayground
 *      – Click ⚙ > "Use your own OAuth credentials", enter Client ID + Secret
 *      – Select scope: https://mail.google.com/
 *      – Authorize as sruthi_kandaswamy@celltalediagnostics.com
 *      – Exchange the auth code for a refresh token
 *   4. Store CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN in functions/.env (local)
 *      or Firebase Secret Manager (production).
 */
export function createTransporter(): nodemailer.Transporter {
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
