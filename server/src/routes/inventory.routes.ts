import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import { getDb } from '../db/database'
import { nowISO } from '../shared/utils'
import { requireAuth } from '../middleware/auth'

export const inventoryRoutes = Router()

inventoryRoutes.post('/stock-in', requireAuth, (req, res) => {
  const db = getDb()
  const { productId, qty, cost, reason } = req.body as { productId: string; qty: number; cost?: number; reason?: string }

  const product = db.prepare('SELECT stock_qty FROM products WHERE id=?').get(productId) as { stock_qty: number } | undefined
  if (!product) return res.status(404).json({ error: 'Product not found' })

  const newQty = product.stock_qty + qty
  const now = nowISO()

  db.transaction(() => {
    db.prepare('UPDATE products SET stock_qty=?, updated_at=? WHERE id=?').run(newQty, now, productId)
    db.prepare(`
      INSERT INTO inventory_movements
        (id, product_id, user_id, movement_type, quantity, unit_cost, stock_before, stock_after, reason, created_at)
      VALUES (?, ?, ?, 'stock_in', ?, ?, ?, ?, ?, ?)
    `).run(uuid(), productId, req.session!.user_id, qty, cost ?? null, product.stock_qty, newQty, reason ?? null, now)
  })()

  res.json({ success: true })
})

inventoryRoutes.post('/stock-out', requireAuth, (req, res) => {
  const db = getDb()
  const { productId, qty, reason } = req.body as { productId: string; qty: number; reason?: string }

  const product = db.prepare('SELECT stock_qty FROM products WHERE id=?').get(productId) as { stock_qty: number } | undefined
  if (!product) return res.status(404).json({ error: 'Product not found' })

  const newQty = Math.max(0, product.stock_qty - qty)
  const now = nowISO()

  db.transaction(() => {
    db.prepare('UPDATE products SET stock_qty=?, updated_at=? WHERE id=?').run(newQty, now, productId)
    db.prepare(`
      INSERT INTO inventory_movements
        (id, product_id, user_id, movement_type, quantity, stock_before, stock_after, reason, created_at)
      VALUES (?, ?, ?, 'stock_out', ?, ?, ?, ?, ?)
    `).run(uuid(), productId, req.session!.user_id, -qty, product.stock_qty, newQty, reason ?? null, now)
  })()

  res.json({ success: true })
})

inventoryRoutes.get('/movements/:productId', requireAuth, (req, res) => {
  const db = getDb()
  res.json(db.prepare(`
    SELECT im.*, u.full_name as user_name
    FROM inventory_movements im
    LEFT JOIN users u ON u.id = im.user_id
    WHERE im.product_id = ?
    ORDER BY im.created_at DESC LIMIT 100
  `).all(req.params.productId))
})

inventoryRoutes.get('/low-stock', requireAuth, (req, res) => {
  const db = getDb()
  const branchId = String(req.query.branchId || '')
  res.json(db.prepare(`
    SELECT * FROM products
    WHERE branch_id=? AND track_inventory=1 AND stock_qty <= low_stock_threshold AND is_active=1
    ORDER BY stock_qty ASC
  `).all(branchId))
})
