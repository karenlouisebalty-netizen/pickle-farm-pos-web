import { getDb } from '../db/database'
import type { DailySummary, PaymentMethod } from '../shared/types'

export const ReportService = {
  getDailySummary(branchId: string, dateFrom: string, dateTo?: string): DailySummary {
    const db = getDb()
    const to = dateTo || dateFrom

    const totals = db.prepare(`
      SELECT
        COALESCE(SUM(total), 0) as total_revenue,
        COUNT(*) as transaction_count,
        COALESCE(SUM(discount_total), 0) as discount_total
      FROM transactions
      WHERE branch_id = ? AND date(created_at) BETWEEN ? AND ? AND status = 'completed'
    `).get(branchId, dateFrom, to) as { total_revenue: number; transaction_count: number; discount_total: number }

    const payRows = db.prepare(`
      SELECT p.payment_method, COALESCE(SUM(p.amount), 0) as total
      FROM payments p
      JOIN transactions t ON t.id = p.transaction_id
      WHERE t.branch_id = ? AND date(t.created_at) BETWEEN ? AND ? AND t.status = 'completed'
      GROUP BY p.payment_method
    `).all(branchId, dateFrom, to) as Array<{ payment_method: PaymentMethod; total: number }>

    const payment_breakdown: Record<PaymentMethod, number> = {
      cash: 0, gcash: 0, maya: 0, credit_card: 0, bank_transfer: 0,
    }
    for (const row of payRows) {
      payment_breakdown[row.payment_method] = row.total
    }

    const top_items = db.prepare(`
      SELECT
        ti.item_name as name,
        SUM(ti.quantity) as qty,
        SUM(ti.line_total) as revenue
      FROM transaction_items ti
      JOIN transactions t ON t.id = ti.transaction_id
      WHERE t.branch_id = ? AND date(t.created_at) BETWEEN ? AND ? AND t.status = 'completed'
      GROUP BY ti.item_name
      ORDER BY revenue DESC
      LIMIT 10
    `).all(branchId, dateFrom, to) as Array<{ name: string; qty: number; revenue: number }>

    const { open_play_count } = db.prepare(`
      SELECT COUNT(*) as open_play_count
      FROM open_play_registrations
      WHERE branch_id = ? AND play_date BETWEEN ? AND ?
    `).get(branchId, dateFrom, to) as { open_play_count: number }

    const { court_rental_count } = db.prepare(`
      SELECT COUNT(*) as court_rental_count
      FROM transaction_items ti
      JOIN transactions t ON t.id = ti.transaction_id
      JOIN products p ON p.id = ti.product_id
      WHERE t.branch_id = ? AND date(t.created_at) BETWEEN ? AND ?
        AND p.category = 'court_rental' AND t.status = 'completed'
    `).get(branchId, dateFrom, to) as { court_rental_count: number }

    return {
      date: dateFrom,
      total_revenue: totals.total_revenue,
      transaction_count: totals.transaction_count,
      discount_total: totals.discount_total,
      payment_breakdown,
      top_items,
      open_play_count,
      court_rental_count,
    }
  },
}
