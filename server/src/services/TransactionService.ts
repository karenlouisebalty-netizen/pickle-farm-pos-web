import { v4 as uuid } from 'uuid'
import { getDb } from '../db/database'
import { generateReceiptNumber, nowISO, calcDiscount } from '../shared/utils'
import type { Transaction, CheckoutPayload } from '../shared/types'

export const TransactionService = {
  /** Process a new sale. Atomic SQLite transaction. */
  create(payload: CheckoutPayload): Transaction {
    const db = getDb()

    const seqRow = db.prepare("SELECT value FROM settings WHERE key='last_receipt_seq'").get() as { value: string } | undefined
    const seq = (parseInt(seqRow?.value ?? '0', 10) || 0) + 1
    const receiptNumber = generateReceiptNumber(seq)

    const subtotal = payload.items.reduce((sum, item) => {
      return sum + item.unit_price * item.quantity - item.discount
    }, 0)
    const discountTotal = calcDiscount(subtotal, payload.discount.type, payload.discount.value)
    const total = subtotal - discountTotal

    const txnId = uuid()
    const now = nowISO()

    const doCreate = db.transaction(() => {
      db.prepare(`
        INSERT INTO transactions
          (id, branch_id, cashier_id, customer_id, receipt_number, subtotal, discount_total, total, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(txnId, payload.branch_id, payload.cashier_id, payload.customer_id ?? null,
              receiptNumber, subtotal, discountTotal, total, payload.notes ?? null, now, now)

      for (const item of payload.items) {
        const itemId = uuid()
        const lineTotal = item.unit_price * item.quantity - item.discount
        db.prepare(`
          INSERT INTO transaction_items
            (id, transaction_id, product_id, item_name, unit_price, quantity, discount, line_total, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(itemId, txnId, item.product_id ?? null, item.item_name,
               item.unit_price, item.quantity, item.discount, lineTotal, item.notes ?? null)

        if (item.product_id) {
          const product = db.prepare('SELECT stock_qty, track_inventory FROM products WHERE id = ?').get(item.product_id) as { stock_qty: number; track_inventory: number } | undefined
          if (product?.track_inventory) {
            const newQty = product.stock_qty - item.quantity
            db.prepare('UPDATE products SET stock_qty = ?, updated_at = ? WHERE id = ?').run(newQty, now, item.product_id)

            db.prepare(`
              INSERT INTO inventory_movements
                (id, product_id, user_id, movement_type, quantity, stock_before, stock_after, reference_id, created_at)
              VALUES (?, ?, ?, 'sale', ?, ?, ?, ?, ?)
            `).run(uuid(), item.product_id, payload.cashier_id,
                   -item.quantity, product.stock_qty, newQty, txnId, now)
          }
        }
      }

      for (const pay of payload.payments) {
        db.prepare(`
          INSERT INTO payments
            (id, transaction_id, payment_method, amount, change_given, reference_number, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(uuid(), txnId, pay.payment_method, pay.amount,
               pay.change_given, pay.reference_number ?? null, now)
      }

      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('last_receipt_seq', ?)").run(String(seq))

      if (payload.customer_id) {
        db.prepare('UPDATE customers SET total_visits = total_visits + 1 WHERE id = ?').run(payload.customer_id)
      }
    })

    doCreate()

    return TransactionService.getById(txnId)!
  },

  /** Refund a completed transaction */
  refund(txnId: string, reason: string, cashierId: string): Transaction {
    const db = getDb()
    const now = nowISO()

    const txn = TransactionService.getById(txnId)
    if (!txn) throw new Error('Transaction not found')
    if (txn.status !== 'completed') throw new Error('Only completed transactions can be refunded')

    db.transaction(() => {
      db.prepare("UPDATE transactions SET status='refunded', notes=?, updated_at=? WHERE id=?")
        .run(`Refund: ${reason}`, now, txnId)

      for (const item of txn.items) {
        if (!item.product_id) continue
        const product = db.prepare('SELECT stock_qty, track_inventory FROM products WHERE id=?').get(item.product_id) as { stock_qty: number; track_inventory: number } | undefined
        if (!product?.track_inventory) continue

        const newQty = product.stock_qty + item.quantity
        db.prepare('UPDATE products SET stock_qty=?, updated_at=? WHERE id=?').run(newQty, now, item.product_id)
        db.prepare(`
          INSERT INTO inventory_movements
            (id, product_id, user_id, movement_type, quantity, stock_before, stock_after, reference_id, reason, created_at)
          VALUES (?, ?, ?, 'refund', ?, ?, ?, ?, ?, ?)
        `).run(uuid(), item.product_id, cashierId, item.quantity, product.stock_qty, newQty, txnId, reason, now)
      }
    })()

    return TransactionService.getById(txnId)!
  },

  /** Void a transaction (manager/owner only) */
  void(txnId: string): Transaction {
    const db = getDb()
    db.prepare("UPDATE transactions SET status='voided', updated_at=? WHERE id=?").run(nowISO(), txnId)
    return TransactionService.getById(txnId)!
  },

  /** Get full transaction with items and payments */
  getById(id: string): Transaction | null {
    const db = getDb()
    const row = db.prepare(`
      SELECT t.*, u.full_name as cashier_name, c.full_name as customer_name
      FROM transactions t
      LEFT JOIN users u ON u.id = t.cashier_id
      LEFT JOIN customers c ON c.id = t.customer_id
      WHERE t.id = ?
    `).get(id) as (Transaction & { cashier_name?: string; customer_name?: string }) | undefined

    if (!row) return null

    const items = db.prepare('SELECT * FROM transaction_items WHERE transaction_id = ? ORDER BY rowid').all(id) as Transaction['items']
    const payments = db.prepare('SELECT * FROM payments WHERE transaction_id = ? ORDER BY created_at').all(id) as Transaction['payments']

    return {
      ...row,
      items,
      payments,
      cashier: { id: row.cashier_id, full_name: row.cashier_name ?? 'Staff' },
      customer: row.customer_id ? { id: row.customer_id, full_name: row.customer_name ?? 'Guest' } : undefined,
    }
  },

  /** List transactions for a branch between two dates (YYYY-MM-DD, inclusive) */
  listByDate(branchId: string, dateFrom: string, dateTo?: string): Transaction[] {
    const db = getDb()
    const dateTo_ = dateTo || dateFrom
    const rows = db.prepare(`
      SELECT t.*, u.full_name as cashier_name
      FROM transactions t
      LEFT JOIN users u ON u.id = t.cashier_id
      WHERE t.branch_id = ? AND date(t.created_at) BETWEEN ? AND ?
      ORDER BY t.created_at DESC
    `).all(branchId, dateFrom, dateTo_) as (Transaction & { cashier_name?: string })[]

    return rows.map(row => {
      const items = db.prepare('SELECT * FROM transaction_items WHERE transaction_id = ?').all(row.id) as Transaction['items']
      const payments = db.prepare('SELECT * FROM payments WHERE transaction_id = ?').all(row.id) as Transaction['payments']
      return { ...row, items, payments, cashier: { id: row.cashier_id, full_name: row.cashier_name ?? 'Staff' } }
    })
  },
}
