import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import { getDb } from '../db/database'
import { nowISO } from '../shared/utils'
import { requireAuth, requireRole } from '../middleware/auth'

export const attendanceRoutes = Router()

// Public — the Time Clock lives on the login screen, before anyone has
// signed in to the POS itself. The photo is the proof of identity here.
attendanceRoutes.get('/today', (req, res) => {
  const db = getDb()
  const branchId = String(req.query.branchId || '')
  const today = new Date().toISOString().slice(0, 10)
  res.json(db.prepare(`
    SELECT a.*, u.full_name as user_name
    FROM attendance_logs a
    JOIN users u ON u.id = a.user_id
    WHERE a.branch_id = ? AND date(a.captured_at) = ?
    ORDER BY a.captured_at DESC
  `).all(branchId, today))
})

attendanceRoutes.post('/clock', (req, res) => {
  const db = getDb()
  const { branchId, userId, clockType, photo } = req.body as {
    branchId: string; userId: string; clockType: 'in' | 'out'; photo?: string
  }
  if (!branchId || !userId || (clockType !== 'in' && clockType !== 'out')) {
    return res.status(400).json({ error: 'branchId, userId and a valid clockType are required' })
  }
  const user = db.prepare('SELECT id FROM users WHERE id=? AND is_active=1').get(userId)
  if (!user) return res.status(404).json({ error: 'Staff not found' })

  const id = uuid()
  const now = nowISO()
  db.prepare(`
    INSERT INTO attendance_logs (id, branch_id, user_id, clock_type, photo, captured_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, branchId, userId, clockType, photo || null, now)

  res.json(db.prepare(`
    SELECT a.*, u.full_name as user_name FROM attendance_logs a JOIN users u ON u.id=a.user_id WHERE a.id=?
  `).get(id))
})

// Owner only — this is the payroll view.
attendanceRoutes.get('/summary', requireAuth, requireRole('owner'), (req, res) => {
  const db = getDb()
  const { branchId, month } = req.query as { branchId: string; month: string } // month = YYYY-MM
  if (!branchId || !month) return res.status(400).json({ error: 'branchId and month are required' })

  const rows = db.prepare(`
    SELECT a.user_id, u.full_name, a.clock_type, a.captured_at
    FROM attendance_logs a
    JOIN users u ON u.id = a.user_id
    WHERE a.branch_id = ? AND strftime('%Y-%m', a.captured_at) = ?
    ORDER BY a.user_id, a.captured_at ASC
  `).all(branchId, month) as Array<{ user_id: string; full_name: string; clock_type: 'in' | 'out'; captured_at: string }>

  // Group by user, then by calendar day; pair sequential in→out to get hours worked.
  const byUser = new Map<string, { full_name: string; days: Map<string, typeof rows> }>()
  for (const r of rows) {
    if (!byUser.has(r.user_id)) byUser.set(r.user_id, { full_name: r.full_name, days: new Map() })
    const u = byUser.get(r.user_id)!
    const day = r.captured_at.slice(0, 10)
    if (!u.days.has(day)) u.days.set(day, [])
    u.days.get(day)!.push(r)
  }

  const summary = Array.from(byUser.entries()).map(([userId, u]) => {
    let totalMs = 0
    let daysPresent = 0
    const dayBreakdown: Array<{ date: string; hours: number }> = []

    for (const [day, entries] of u.days.entries()) {
      daysPresent++
      let dayMs = 0
      let pendingIn: string | null = null
      for (const e of entries) {
        if (e.clock_type === 'in') {
          pendingIn = e.captured_at
        } else if (e.clock_type === 'out' && pendingIn) {
          dayMs += new Date(e.captured_at).getTime() - new Date(pendingIn).getTime()
          pendingIn = null
        }
      }
      totalMs += dayMs
      dayBreakdown.push({ date: day, hours: Math.round((dayMs / 3600000) * 100) / 100 })
    }

    return {
      user_id: userId,
      full_name: u.full_name,
      days_present: daysPresent,
      total_hours: Math.round((totalMs / 3600000) * 100) / 100,
      days: dayBreakdown.sort((a, b) => a.date.localeCompare(b.date)),
    }
  })

  res.json(summary.sort((a, b) => a.full_name.localeCompare(b.full_name)))
})
