import { Request, Response, NextFunction, RequestHandler } from 'express'

/**
 * Wraps an async Express handler so a rejected promise reaches the global error handler in
 * `app.ts` instead of becoming an unhandled rejection. Express 4 does not do this automatically
 * for async handlers — a throw inside a synchronous handler is caught, but a rejected promise
 * from an `async (req, res) => {...}` handler is not, and bypasses `res.status(500).json(...)`
 * entirely, surfacing as a raw runtime error to the client instead of a clean JSON response.
 */
export function asyncHandler<Req extends Request = Request>(
  fn: (req: Req, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    fn(req as Req, res, next).catch(next)
  }
}
