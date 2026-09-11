import { Router } from 'express'
import { AuthService } from '../services/AuthService'
import { requireAuth, requireRole } from '../middleware/auth'

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

// Owner only — hiring / letting go of staff.
authRoutes.post('/users', requireAuth, requireRole('owner'), async (req, res) => {
  const { branch_id, full_name } = req.body as { branch_id: string; full_name: string }
  if (!branch_id || !full_name?.trim()) return res.status(400).json({ error: 'branch_id and full_name are required' })
  const user = await AuthService.createStaff(branch_id, full_name.trim())
  res.json(user)
})

authRoutes.patch('/users/:id/deactivate', requireAuth, requireRole('owner'), (req, res) => {
  AuthService.deactivateStaff(req.params.id)
  res.json({ success: true })
})

// Owner only — reset a staff member's PIN when they request it.
authRoutes.patch('/users/:id/pin', requireAuth, requireRole('owner'), async (req, res) => {
  const { pin } = req.body as { pin: string }
  if (!pin || !/^\d{4,6}$/.test(pin)) {
    return res.status(400).json({ error: 'PIN must be 4-6 digits' })
  }
  await AuthService.changePin(req.params.id, pin)
  res.json({ success: true })
})

// Owner only — set a staff member's flat per-day pay rate (payroll).
authRoutes.patch('/users/:id/rate', requireAuth, requireRole('owner'), (req, res) => {
  const { dailyRate } = req.body as { dailyRate: number }
  if (typeof dailyRate !== 'number' || !Number.isFinite(dailyRate) || dailyRate < 0) {
    return res.status(400).json({ error: 'dailyRate must be a non-negative number' })
  }
  AuthService.setDailyRate(req.params.id, dailyRate)
  res.json({ success: true })
})
