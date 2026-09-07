import { Router } from 'express'
import { AuthService } from '../services/AuthService'
import { requireAuth } from '../middleware/auth'

export const authRoutes = Router()

authRoutes.post('/login', async (req, res) => {
  try {
    const { userId, pin } = req.body as { userId: string; pin: string }
    const { session, token } = await AuthService.login(userId, pin)
    res.json({ session, token })
  } catch (e: any) {
    res.status(401).json({ error: e.message || 'Login failed' })
  }
})

authRoutes.post('/logout', requireAuth, (_req, res) => {
  // Stateless JWT — logout is a client-side token discard. Nothing to invalidate server-side.
  res.json({ success: true })
})

authRoutes.get('/session', requireAuth, (req, res) => {
  res.json(req.session)
})

authRoutes.get('/users', (req, res) => {
  const branchId = String(req.query.branchId || '')
  res.json(AuthService.listUsers(branchId))
})
