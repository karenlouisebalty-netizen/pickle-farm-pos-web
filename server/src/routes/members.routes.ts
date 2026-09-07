import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import { getDb } from '../db/database'
import { nowISO } from '../shared/utils'
import { MEMBERSHIP_TYPES } from '../shared/constants'
import type { MembershipType } from '../shared/types'
import { addMonths, format } from 'date-fns'
import { requireAuth } from '../middleware/auth'

export const memberRoutes = Router()

function getExpiryDate(startDate: Date, type: MembershipType): string {
  const months = MEMBERSHIP_TYPES.find(m => m.value === type)?.months ?? 1
  return format(addMonths(startDate, months), 'yyyy-MM-dd')
}

function generateMemberCode(db: ReturnType<typeof getDb>): string {
  const row = db.prepare('SELECT COUNT(*) as n FROM members').get() as { n: number }
  return 'PF-' + String(row.n + 1).padStart(6, '0')
}

// Empty query returns every member (used by the Members screen to list everyone).
memberRoutes.get('/lookup', requireAuth, (req, res) => {
  const db = getDb()
  const query = String(req.query.q || '')
  if (!query.trim()) {
    return res.json(db.prepare(`
      SELECT m.*, c.full_name, c.contact_number
      FROM members m
      JOIN customers c ON c.id = m.customer_id
      ORDER BY m.created_at DESC
    `).all())
  }
  const like = `%${query}%`
  res.json(db.prepare(`
    SELECT m.*, c.full_name, c.contact_number
    FROM members m
    JOIN customers c ON c.id = m.customer_id
    WHERE (m.member_code LIKE ? OR c.full_name LIKE ? OR c.contact_number LIKE ?)
      AND m.is_active = 1
    LIMIT 5
  `).all(like, like, like))
})

memberRoutes.post('/', requireAuth, (req, res) => {
  const db = getDb()
  const data = req.body as any
  const now = nowISO()
  let customerId = data.customer_id
  if (!customerId) {
    customerId = uuid()
    const branch = db.prepare('SELECT id FROM branches LIMIT 1').get() as any
    db.prepare('INSERT INTO customers (id, branch_id, full_name, contact_number, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(customerId, branch?.id, data.full_name, data.contact_number || null, now, now)
  }
  const id = uuid()
  const startDate = new Date()
  const memberCode = generateMemberCode(db)
  const expiryDate = getExpiryDate(startDate, data.membership_type)
  db.prepare(`
    INSERT INTO members (id, customer_id, member_code, membership_type, start_date, expiry_date, discount_pct, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
  `).run(id, customerId, memberCode, data.membership_type, format(startDate, 'yyyy-MM-dd'), expiryDate, data.discount_pct || 0, now)

  res.json(db.prepare('SELECT m.*, c.full_name, c.contact_number FROM members m JOIN customers c ON c.id = m.customer_id WHERE m.id=?').get(id))
})

memberRoutes.post('/:id/renew', requireAuth, (req, res) => {
  const db = getDb()
  const { type } = req.body as { type: MembershipType }
  const startDate = new Date()
  const expiryDate = getExpiryDate(startDate, type)
  db.prepare(`
    UPDATE members SET membership_type=?, start_date=?, expiry_date=?, is_active=1 WHERE id=?
  `).run(type, format(startDate, 'yyyy-MM-dd'), expiryDate, req.params.id)
  res.json(db.prepare('SELECT * FROM members WHERE id=?').get(req.params.id))
})
