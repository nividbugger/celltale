import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { config } from './config'
import emailRouter from './routes/email'
import paymentsRouter from './routes/payments'

export const app = express()

// ─── Trust Firebase's reverse proxy ──────────────────────────────────────────
// Required for express-rate-limit to read the real client IP from X-Forwarded-For.
app.set('trust proxy', 1)

// ─── Security headers (helmet) ────────────────────────────────────────────────
// Sets X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, HSTS, etc.
// Removes the X-Powered-By header that reveals the framework.
app.use(helmet())

// ─── CORS ─────────────────────────────────────────────────────────────────────
// Only allow requests from the allowed origins list. Credentials are supported
// so the browser can send the Authorization header cross-origin.
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow server-to-server calls (no origin header) in the Functions runtime.
      if (!origin || config.allowedOrigins.includes(origin)) {
        callback(null, true)
      } else {
        callback(new Error(`CORS: origin '${origin}' not allowed`))
      }
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    credentials: true,
    maxAge: 3600,
  }),
)

// ─── Body parsing ────────────────────────────────────────────────────────────
// Hard limit at 10 KB to prevent memory-exhaustion / slowloris attacks.
app.use(express.json({ limit: '10kb' }))
app.use(express.urlencoded({ extended: false, limit: '10kb' }))

// ─── Global rate limiter ─────────────────────────────────────────────────────
// 100 requests per 15-minute window per IP across all endpoints.
// NOTE: Cloud Functions scales horizontally; this in-memory limiter operates
// per instance. For stricter enforcement at scale, replace the store with a
// Firestore- or Redis-backed store.
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
})
app.use(globalLimiter)

// ─── Routes ───────────────────────────────────────────────────────────────────
// All routes are mounted under /api so they match the Firebase Hosting rewrite:
//   { "source": "/api/**", "function": "api" }
app.use('/api/email', emailRouter)
app.use('/api/payments', paymentsRouter)

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' })
})

// ─── Global error handler ─────────────────────────────────────────────────────
// Catches synchronous throws and unhandled rejections forwarded via next(err).
// Never exposes stack traces or internal details to the client.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[API Error]', err.message)
  res.status(500).json({ error: 'Internal server error' })
})
