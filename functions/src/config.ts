/**
 * Central config – reads environment variables.
 * For local dev: create functions/.env (never commit it).
 * For production: set Firebase runtime environment variables via Firebase Console
 *   or `firebase functions:secrets:set GMAIL_CLIENT_ID` (Secret Manager).
 */

export const config = {
  gmail: {
    user: process.env.GMAIL_USER ?? '',
    appPassword: process.env.GMAIL_APP_PASSWORD ?? '',
    clientId: process.env.GMAIL_CLIENT_ID ?? '',
    clientSecret: process.env.GMAIL_CLIENT_SECRET ?? '',
    refreshToken: process.env.GMAIL_REFRESH_TOKEN ?? '',
  },
  app: {
    /** Public URL of the deployed app (used for CTA links in emails) */
    url: process.env.APP_URL ?? 'https://celltalediagnostics.com',
    name: 'CellTale Diagnostics',
    /** Visible sender address on all outgoing emails */
    fromEmail: process.env.FROM_EMAIL ?? 'care@celltalediagnostics.com',
    supportEmail: process.env.SUPPORT_EMAIL ?? 'care@celltalediagnostics.com',
    phone: '+91-XXXXX-XXXXX',
  },
  /** Default reminder window: hours before appointment to send reminder */
  defaultReminderHours: 4,
  /** IST offset in ms (UTC+5:30) */
  istOffsetMs: 5.5 * 60 * 60 * 1000,
  /** Region for all functions */
  region: 'asia-south1' as const,
}
