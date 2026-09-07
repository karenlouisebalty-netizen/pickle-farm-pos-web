import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import { getDb } from '../db/database'
import { TransactionService } from '../services/TransactionService'
import { requireAuth } from '../middleware/auth'
import type { CheckoutPayload } from '../shared/types'

export const posRoutes = Router()

posRoutes.post('/checkout', requireAuth, (req, res) => {
  try {
    const payload = req.body as CheckoutPayload
    const txn = TransactionService.create(payload)
    res.json(txn)
  } catch (e: any) {
    res.status(400).json({ error: e.message || 'Checkout failed' })
  }
})

posRoutes.post('/transactions/:id/refund', requireAuth, (req, res) => {
  try {
    const { reason } = req.body as { reason: string }
    const txn = TransactionService.refund(req.params.id, reason, req.session!.user_id)
    res.json(txn)
  } catch (e: any) {
    res.status(400).json({ error: e.message || 'Refund failed' })
  }
})

posRoutes.post('/transactions/:id/void', requireAuth, (req, res) => {
  try {
    const txn = TransactionService.void(req.params.id)
    res.json(txn)
  } catch (e: any) {
    res.status(400).json({ error: e.message || 'Void failed' })
  }
})

posRoutes.get('/transactions/:id', requireAuth, (req, res) => {
  const txn = TransactionService.getById(req.params.id)
  if (!txn) return res.status(404).json({ error: 'Transaction not found' })
  res.json(txn)
})

posRoutes.get('/transactions', requireAuth, (req, res) => {
  const { branchId, dateFrom, dateTo } = req.query as Record<string, string>
  res.json(TransactionService.listByDate(branchId, dateFrom, dateTo))
})

posRoutes.get('/products', requireAuth, (req, res) => {
  const db = getDb()
  const branchId = String(req.query.branchId || '')
  res.json(db.prepare(`
    SELECT * FROM products WHERE branch_id = ? AND is_active = 1
    ORDER BY category, sort_order, name
  `).all(branchId))
})

posRoutes.patch('/products/:id', requireAuth, (req, res) => {
  const db = getDb()
  const updates = req.body as { name?: string; price?: number }
  const fields: string[] = []
  const values: any[] = []

  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name) }
  if (updates.price !== undefined) { fields.push('price = ?'); values.push(updates.price) }

  if (fields.length === 0) return res.json(null)

  fields.push('updated_at = ?')
  values.push(new Date().toISOString())
  values.push(req.params.id)

  db.prepare(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  res.json(db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id))
})

posRoutes.post('/products', requireAuth, (req, res) => {
  const db = getDb()
  const data = req.body as {
    branch_id: string; name: string; category: string; price: number;
    track_inventory: boolean; stock_qty?: number; low_stock_threshold?: number; sku?: string
  }
  const id = uuid()
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO products (id, branch_id, name, category, price, stock_qty, low_stock_threshold, track_inventory, sku, is_active, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?)
  `).run(
    id, data.branch_id, data.name, data.category, data.price,
    data.stock_qty ?? 0, data.low_stock_threshold ?? 5,
    data.track_inventory ? 1 : 0, data.sku ?? null, now, now
  )

  res.json(db.prepare('SELECT * FROM products WHERE id = ?').get(id))
})
