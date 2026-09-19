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

const CLOCK_TYPES = ['in', 'out', 'break_start', 'break_end'] as const
type ClockType = typeof CLOCK_TYPES[number]

attendanceRoutes.post('/clock', (req, res) => {
  const db = getDb()
  const { branchId, userId, clockType, photo } = req.body as {
    branchId: string; userId: string; clockType: ClockType; photo?: string
  }
  if (!branchId || !userId || !CLOCK_TYPES.includes(clockType)) {
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

// Owner only — the full clock-in/out log with photos, for the Attendance tab.
attendanceRoutes.get('/logs', requireAuth, requireRole('owner'), (req, res) => {
  const db = getDb()
  const { branchId, month } = req.query as { branchId: string; month: string } // month = YYYY-MM
  if (!branchId || !month) return res.status(400).json({ error: 'branchId and month are required' })

  res.json(db.prepare(`
    SELECT a.*, u.full_name as user_name
    FROM attendance_logs a
    JOIN users u ON u.id = a.user_id
    WHERE a.branch_id = ? AND strftime('%Y-%m', a.captured_at) = ?
    ORDER BY a.captured_at DESC
  `).all(branchId, month))
})

// Owner only — this is the payroll view.
attendanceRoutes.get('/summary', requireAuth, requireRole('owner'), (req, res) => {
  const db = getDb()
  const { branchId, month } = req.query as { branchId: string; month: string } // month = YYYY-MM
  if (!branchId || !month) return res.status(400).json({ error: 'branchId and month are required' })

  const rows = db.prepare(`
    SELECT a.user_id, u.full_name, u.daily_rate, a.clock_type, a.captured_at
    FROM attendance_logs a
    JOIN users u ON u.id = a.user_id
    WHERE a.branch_id = ? AND strftime('%Y-%m', a.captured_at) = ?
    ORDER BY a.user_id, a.captured_at ASC
  `).all(branchId, month) as Array<{ user_id: string; full_name: string; daily_rate: number; clock_type: ClockType; captured_at: string }>

  // Group by user, then by calendar day; pair sequential in→out to get hours worked, and
  // break_start→break_end pairs within that to get break time, which is subtracted back out
  // (breaks are unpaid time, not counted as hours worked — though pay itself is a flat daily
  // rate either way, see below, so this only affects the Hours figure, not what's owed).
  const byUser = new Map<string, { full_name: string; daily_rate: number; days: Map<string, typeof rows> }>()
  for (const r of rows) {
    if (!byUser.has(r.user_id)) byUser.set(r.user_id, { full_name: r.full_name, daily_rate: r.daily_rate, days: new Map() })
    const u = byUser.get(r.user_id)!
    const day = r.captured_at.slice(0, 10)
    if (!u.days.has(day)) u.days.set(day, [])
    u.days.get(day)!.push(r)
  }

  const summary = Array.from(byUser.entries()).map(([userId, u]) => {
    let totalMs = 0
    let totalBreakMs = 0
    let daysPresent = 0
    let paidDays = 0
    // Salary is a flat rate per day worked (owner sets it per staff member, Manage Staff
    // tab) — not prorated by hours, so break time never changes what's owed. A day only
    // counts toward pay once it has at least one completed clock-in → clock-out pair;
    // clocking in with no matching clock-out yet (still working, or they forgot) doesn't
    // get paid until it does.
    const dayBreakdown: Array<{ date: string; hours: number; break_hours: number; paid: boolean; amount: number }> = []

    for (const [day, entries] of u.days.entries()) {
      daysPresent++
      let dayMs = 0
      let breakMs = 0
      let pendingIn: string | null = null
      let pendingBreak: string | null = null
      for (const e of entries) {
        if (e.clock_type === 'in') {
          pendingIn = e.captured_at
        } else if (e.clock_type === 'out' && pendingIn) {
          dayMs += new Date(e.captured_at).getTime() - new Date(pendingIn).getTime()
          pendingIn = null
        } else if (e.clock_type === 'break_start' && pendingIn) {
          pendingBreak = e.captured_at
        } else if (e.clock_type === 'break_end' && pendingBreak) {
          breakMs += new Date(e.captured_at).getTime() - new Date(pendingBreak).getTime()
          pendingBreak = null
        }
      }
      const netMs = Math.max(0, dayMs - breakMs)
      totalMs += netMs
      totalBreakMs += breakMs
      const paid = dayMs > 0
      if (paid) paidDays++
      dayBreakdown.push({
        date: day,
        hours: Math.round((netMs / 3600000) * 100) / 100,
        break_hours: Math.round((breakMs / 3600000) * 100) / 100,
        paid,
        amount: paid ? u.daily_rate : 0,
      })
    }

    return {
      user_id: userId,
      full_name: u.full_name,
      daily_rate: u.daily_rate,
      days_present: daysPresent,
      paid_days: paidDays,
      total_hours: Math.round((totalMs / 3600000) * 100) / 100,
      total_break_hours: Math.round((totalBreakMs / 3600000) * 100) / 100,
      total_salary: Math.round(paidDays * u.daily_rate * 100) / 100,
      days: dayBreakdown.sort((a, b) => a.date.localeCompare(b.date)),
    }
  })

  res.json(summary.sort((a, b) => a.full_name.localeCompare(b.full_name)))
})
