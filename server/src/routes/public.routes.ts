import { Router } from 'express'
import { getDb } from '../db/database'

export const publicRoutes = Router()

// Public, unauthenticated, read-only — powers the shareable court-availability
// calendar. Deliberately returns only what a court is busy/free, never who
// booked it or how to reach them (no booker_name, contact_number, or notes).
publicRoutes.get('/availability', (req, res) => {
  const db = getDb()
  const branchId = String(req.query.branchId || '')
  const date = String(req.query.date || '')
  if (!branchId || !date) return res.status(400).json({ error: 'branchId and date are required' })

  const branch = db.prepare('SELECT name, contact_number FROM branches WHERE id = ? AND is_active = 1')
    .get(branchId) as { name: string; contact_number: string | null } | undefined
  if (!branch) return res.status(404).json({ error: 'Branch not found' })

  const bookings = db.prepare(`
    SELECT court_name, start_time, end_time
    FROM reservations
    WHERE branch_id = ? AND reservation_date = ? AND status != 'cancelled'
    ORDER BY court_name, start_time
  `).all(branchId, date)

  res.json({
    branch_name: branch.name,
    contact_number: branch.contact_number,
    date,
    bookings,
  })
})
