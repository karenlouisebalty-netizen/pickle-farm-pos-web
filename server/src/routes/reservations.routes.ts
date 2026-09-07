import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import { getDb } from '../db/database'
import { nowISO } from '../shared/utils'
import { requireAuth } from '../middleware/auth'
import type { Reservation } from '../shared/types'

export const reservationRoutes = Router()

reservationRoutes.post('/', requireAuth, (req, res) => {
  const db = getDb()
  const data = req.body as Omit<Reservation, 'id' | 'created_at'>

  const overlap = db.prepare(`
    SELECT id FROM reservations
    WHERE court_name = ? AND reservation_date = ? AND status != 'cancelled'
      AND start_time < ? AND end_time > ?
  `).get(data.court_name, data.reservation_date, data.end_time, data.start_time)

  if (overlap) return res.status(409).json({ error: 'This time slot is already booked. Please choose a different time.' })

  const id = uuid()
  db.prepare(`
    INSERT INTO reservations
      (id, branch_id, customer_id, transaction_id, court_name, reservation_date,
       start_time, end_time, booker_name, contact_number, status, deposit_amount, notes, is_recurring, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, data.branch_id, data.customer_id ?? null, data.transaction_id ?? null,
         data.court_name, data.reservation_date, data.start_time, data.end_time,
         data.booker_name, data.contact_number ?? null, data.status,
         data.deposit_amount, data.notes ?? null, data.is_recurring ? 1 : 0, nowISO())

  res.json(db.prepare('SELECT * FROM reservations WHERE id=?').get(id))
})

reservationRoutes.get('/', requireAuth, (req, res) => {
  const db = getDb()
  const { branchId, date } = req.query as Record<string, string>
  res.json(db.prepare(`
    SELECT * FROM reservations
    WHERE branch_id=? AND reservation_date=?
    ORDER BY court_name, start_time
  `).all(branchId, date))
})

reservationRoutes.post('/:id/cancel', requireAuth, (req, res) => {
  const db = getDb()
  db.prepare("UPDATE reservations SET status='cancelled' WHERE id=?").run(req.params.id)
  res.json({ success: true })
})
