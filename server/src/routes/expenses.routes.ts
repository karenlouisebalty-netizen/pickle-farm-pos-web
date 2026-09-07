import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import { getDb } from '../db/database'
import { requireAuth } from '../middleware/auth'

export const expenseRoutes = Router()

expenseRoutes.get('/', requireAuth, (req, res) => {
  const db = getDb()
  const { branchId, dateFrom, dateTo } = req.query as Record<string, string>
  res.json(db.prepare(`
    SELECT e.*, u.full_name as created_by_name
    FROM expenses e
    LEFT JOIN users u ON u.id = e.created_by
    WHERE e.branch_id = ? AND e.expense_date BETWEEN ? AND ?
    ORDER BY e.expense_date DESC, e.created_at DESC
  `).all(branchId, dateFrom, dateTo))
})

expenseRoutes.post('/', requireAuth, (req, res) => {
  const db = getDb()
  const data = req.body as any
  const id = uuid()
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO expenses (id, branch_id, amount, category, description, expense_date, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, data.branch_id, data.amount, data.category, data.description || null, data.expense_date, data.created_by || null, now)
  res.json(db.prepare('SELECT * FROM expenses WHERE id=?').get(id))
})

expenseRoutes.delete('/:id', requireAuth, (req, res) => {
  const db = getDb()
  db.prepare('DELETE FROM expenses WHERE id=?').run(req.params.id)
  res.json({ success: true })
})

expenseRoutes.get('/summary', requireAuth, (req, res) => {
  const db = getDb()
  const { branchId, dateFrom, dateTo } = req.query as Record<string, string>
  const total = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM expenses
    WHERE branch_id = ? AND expense_date BETWEEN ? AND ?
  `).get(branchId, dateFrom, dateTo) as { total: number }

  const byCategory = db.prepare(`
    SELECT category, COALESCE(SUM(amount), 0) as total
    FROM expenses
    WHERE branch_id = ? AND expense_date BETWEEN ? AND ?
    GROUP BY category
  `).all(branchId, dateFrom, dateTo)

  res.json({ total: total.total, byCategory })
})
