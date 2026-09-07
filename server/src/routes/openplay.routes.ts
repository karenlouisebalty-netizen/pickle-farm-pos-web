import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import { getDb } from '../db/database'
import { nowISO, todayString } from '../shared/utils'
import { requireAuth } from '../middleware/auth'
import type { OpenPlayRegistration } from '../shared/types'

export const openPlayRoutes = Router()

openPlayRoutes.post('/register', requireAuth, (req, res) => {
  const db = getDb()
  const data = req.body as Omit<OpenPlayRegistration, 'id' | 'check_in_at'>
  const id = uuid()
  const now = nowISO()
  db.prepare(`
    INSERT INTO open_play_registrations
      (id, branch_id, transaction_id, player_name, contact_number, skill_level, court_assigned, play_date, check_in_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, data.branch_id, data.transaction_id ?? null, data.player_name,
         data.contact_number ?? null, data.skill_level, data.court_assigned ?? null,
         data.play_date ?? todayString(), now)

  res.json(db.prepare('SELECT * FROM open_play_registrations WHERE id=?').get(id))
})

openPlayRoutes.post('/:id/assign', requireAuth, (req, res) => {
  const db = getDb()
  const { court } = req.body as { court: string }
  db.prepare('UPDATE open_play_registrations SET court_assigned=? WHERE id=?').run(court, req.params.id)
  res.json({ success: true })
})

openPlayRoutes.post('/:id/checkout', requireAuth, (req, res) => {
  const db = getDb()
  db.prepare('UPDATE open_play_registrations SET checked_out_at=? WHERE id=?').run(nowISO(), req.params.id)
  res.json({ success: true })
})

openPlayRoutes.get('/today', requireAuth, (req, res) => {
  const db = getDb()
  const branchId = String(req.query.branchId || '')
  const today = todayString()
  res.json(db.prepare(`
    SELECT * FROM open_play_registrations
    WHERE branch_id=? AND play_date=?
    ORDER BY check_in_at ASC
  `).all(branchId, today))
})
