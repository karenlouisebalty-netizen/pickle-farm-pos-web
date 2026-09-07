import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import { getDb } from '../db/database'
import { nowISO, todayString } from '../shared/utils'
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

// ── DAILY INVENTORY COUNTS ──────────────────────────────────
// Staff enter only two numbers per item per day: the actual physical
// count at the start of their shift and again at the end. Everything
// else (consumption, tally vs. sales, variance) is computed automatically.

inventoryRoutes.get('/counts', requireAuth, (req, res) => {
  const db = getDb()
  const { branchId, date } = req.query as Record<string, string>
  res.json(db.prepare(`
    SELECT ic.*, u.full_name as user_name
    FROM inventory_counts ic
    LEFT JOIN users u ON u.id = ic.user_id
    WHERE ic.branch_id=? AND ic.count_date=?
  `).all(branchId, date))
})

inventoryRoutes.post('/counts/bulk', requireAuth, (req, res) => {
  const db = getDb()
  const { branchId, countDate, countType, counts } = req.body as {
    branchId: string; countDate: string; countType: 'start' | 'end'
    counts: Array<{ productId: string; quantity: number }>
  }
  if (!branchId || !countDate || !countType || !Array.isArray(counts)) {
    return res.status(400).json({ error: 'branchId, countDate, countType and counts are required' })
  }
  const now = nowISO()
  const upsert = db.prepare(`
    INSERT INTO inventory_counts (id, branch_id, product_id, user_id, count_date, count_type, quantity, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET quantity=excluded.quantity, user_id=excluded.user_id, updated_at=excluded.updated_at
  `)
  db.transaction(() => {
    for (const c of counts) {
      if (c.quantity == null || c.quantity < 0) continue
      const id = `${c.productId}:${countDate}:${countType}`
      upsert.run(id, branchId, c.productId, req.session!.user_id, countDate, countType, c.quantity, now, now)
    }
  })()
  res.json({ success: true })
})

// ── WASTE LOG ────────────────────────────────────────────────
// Logging waste deducts stock, records a stock movement, and creates
// a matching expense automatically — nothing extra for staff to enter.

inventoryRoutes.get('/waste', requireAuth, (req, res) => {
  const db = getDb()
  const { branchId, date } = req.query as Record<string, string>
  res.json(db.prepare(`
    SELECT w.*, p.name as product_name, u.full_name as user_name
    FROM waste_log w
    JOIN products p ON p.id = w.product_id
    LEFT JOIN users u ON u.id = w.user_id
    WHERE w.branch_id=? AND w.waste_date=?
    ORDER BY w.created_at DESC
  `).all(branchId, date))
})

inventoryRoutes.post('/waste', requireAuth, (req, res) => {
  const db = getDb()
  const { productId, quantity, reason, notes, wasteDate } = req.body as {
    productId: string; quantity: number; reason: string; notes?: string; wasteDate?: string
  }
  if (!productId || !quantity || quantity <= 0 || !reason) {
    return res.status(400).json({ error: 'productId, quantity and reason are required' })
  }
  const product = db.prepare('SELECT * FROM products WHERE id=?').get(productId) as any
  if (!product) return res.status(404).json({ error: 'Product not found' })

  const date = wasteDate || todayString()
  const now = nowISO()
  const unitCost = product.cost || 0
  const totalCost = unitCost * quantity
  const wasteId = uuid()
  const expenseId = uuid()

  db.transaction(() => {
    if (product.track_inventory) {
      const newQty = Math.max(0, product.stock_qty - quantity)
      db.prepare('UPDATE products SET stock_qty=?, updated_at=? WHERE id=?').run(newQty, now, productId)
      db.prepare(`
        INSERT INTO inventory_movements
          (id, product_id, user_id, movement_type, quantity, stock_before, stock_after, reference_id, reason, created_at)
        VALUES (?, ?, ?, 'adjustment', ?, ?, ?, ?, ?, ?)
      `).run(uuid(), productId, req.session!.user_id, -quantity, product.stock_qty, newQty, wasteId, `Waste (${reason})`, now)
    }

    db.prepare(`
      INSERT INTO expenses (id, branch_id, amount, category, description, expense_date, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      expenseId, product.branch_id, totalCost,
      product.category === 'food_drinks' ? 'food' : 'supplies',
      `Waste: ${quantity} x ${product.name} (${reason})`,
      date, req.session!.user_id, now
    )

    db.prepare(`
      INSERT INTO waste_log
        (id, branch_id, product_id, user_id, quantity, reason, notes, unit_cost, total_cost, expense_id, waste_date, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(wasteId, product.branch_id, productId, req.session!.user_id, quantity, reason, notes || null, unitCost, totalCost, expenseId, date, now)
  })()

  res.json(db.prepare(`
    SELECT w.*, p.name as product_name FROM waste_log w JOIN products p ON p.id=w.product_id WHERE w.id=?
  `).get(wasteId))
})

// ── RECONCILIATION ───────────────────────────────────────────
// For each tracked product on a given day: beginning count minus
// ending count is what actually left the shelf. That should equal
// what POS sales + logged waste say left the shelf. Anything left
// over is an unexplained variance worth a manager's attention.

inventoryRoutes.get('/reconciliation', requireAuth, (req, res) => {
  const db = getDb()
  const { branchId, date } = req.query as Record<string, string>

  const products = db.prepare(`
    SELECT id, name, category FROM products
    WHERE branch_id=? AND track_inventory=1 AND is_active=1
    ORDER BY name
  `).all(branchId) as Array<{ id: string; name: string; category: string }>

  const getCount = db.prepare(`SELECT quantity FROM inventory_counts WHERE product_id=? AND count_date=? AND count_type=?`)
  const getSold = db.prepare(`
    SELECT COALESCE(SUM(-quantity), 0) as qty FROM inventory_movements
    WHERE product_id=? AND movement_type='sale' AND date(created_at)=?
  `)
  const getWasted = db.prepare(`SELECT COALESCE(SUM(quantity), 0) as qty FROM waste_log WHERE product_id=? AND waste_date=?`)

  const rows = products.map(p => {
    const start = (getCount.get(p.id, date, 'start') as { quantity: number } | undefined)?.quantity ?? null
    const end = (getCount.get(p.id, date, 'end') as { quantity: number } | undefined)?.quantity ?? null
    const sold = (getSold.get(p.id, date) as { qty: number }).qty
    const wasted = (getWasted.get(p.id, date) as { qty: number }).qty
    const actualUsed = start != null && end != null ? start - end : null
    const expectedUsed = sold + wasted
    const variance = actualUsed != null ? actualUsed - expectedUsed : null

    return {
      product_id: p.id,
      product_name: p.name,
      category: p.category,
      start_qty: start,
      end_qty: end,
      sold_qty: sold,
      wasted_qty: wasted,
      actual_used: actualUsed,
      expected_used: expectedUsed,
      variance,
      status: start == null || end == null ? 'pending' : variance === 0 ? 'ok' : 'variance',
    }
  })

  res.json(rows)
})
