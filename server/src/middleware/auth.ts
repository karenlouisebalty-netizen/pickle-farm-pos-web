import type { Request, Response, NextFunction } from 'express'
import { AuthService } from '../services/AuthService'
import type { Session } from '../shared/types'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      session?: Session
    }
  }
}

/** Reads "Authorization: Bearer <token>" and attaches req.session. 401s if missing/invalid. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Not authenticated' })

  try {
    req.session = AuthService.verifyToken(token)
    next()
  } catch {
    res.status(401).json({ error: 'Session expired — please log in again' })
  }
}

/** Like requireAuth, but does not fail if no token is present (req.session stays undefined). */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null
  if (token) {
    try { req.session = AuthService.verifyToken(token) } catch { /* ignore */ }
  }
  next()
}

export function requireRole(minRole: 'owner' | 'manager' | 'cashier') {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session) return res.status(401).json({ error: 'Not authenticated' })
    try {
      AuthService.requireRole(req.session, minRole)
      next()
    } catch (e: any) {
      res.status(403).json({ error: e.message })
    }
  }
}
