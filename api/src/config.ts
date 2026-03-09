/**
 * Central config for the API codebase.
 * Reads the same environment variables as the triggers codebase (functions/).
 *
 * Local dev:  create api/.env  (never commit it)
 * Production: set via `firebase functions:secrets:set SECRET_NAME`
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
    /** Public URL used for CTA links in emails and CORS allowlist */
    url: process.env.APP_URL ?? 'https://celltalediagnostics.com',
    name: 'CellTale Diagnostics',
    /** Visible sender address on all outgoing emails */
    fromEmail: process.env.FROM_EMAIL ?? 'care@celltalediagnostics.com',
    supportEmail: process.env.SUPPORT_EMAIL ?? 'care@celltalediagnostics.com',
    phone: '+91-XXXXX-XXXXX',
  },
  region: 'asia-south1' as const,
  /**
   * Allowed CORS origins. Keep in sync with cors.json for Firebase Storage CORS.
   * Requests from origins not in this list are rejected with HTTP 403.
   */
  allowedOrigins: [
    process.env.APP_URL ?? 'https://celltalediagnostics.com',
    'https://www.celltalediagnostics.com',
    'https://celltalediagnostics-8f817.web.app',
    'http://localhost:5173',
    'http://localhost:4173',
    'http://localhost:3000',
  ],
}
