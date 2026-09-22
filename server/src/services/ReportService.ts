import { v4 as uuid } from 'uuid'
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
        COALESCE(SUM(discount_total), 0) as discount_total,
        COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total ELSE 0 END), 0) as collected_total
      FROM transactions
      WHERE branch_id = ? AND date(created_at) BETWEEN ? AND ? AND status = 'completed'
    `).get(branchId, dateFrom, to) as { total_revenue: number; transaction_count: number; discount_total: number; collected_total: number }

    // Only counts payments on transactions that are actually paid — this is "real money in
    // hand by method", so an unpaid/credit sale shouldn't inflate any method's total until
    // it's actually settled. `amount` is what the customer HANDED OVER (e.g. a cashier types
    // in ₱1000 tendered on a ₱750 cash sale), not what was actually kept — `change_given`
    // records the difference handed back. Subtracting it out here is what makes this "net
    // cash actually in the drawer" rather than "gross cash tendered", which without this was
    // overstating the cash total by every peso of change given (only cash ever has
    // change_given > 0, so this is a no-op for every other payment method).
    const payRows = db.prepare(`
      SELECT p.payment_method, COALESCE(SUM(p.amount - p.change_given), 0) as total
      FROM payments p
      JOIN transactions t ON t.id = p.transaction_id
      WHERE t.branch_id = ? AND date(t.created_at) BETWEEN ? AND ? AND t.status = 'completed' AND t.payment_status = 'paid'
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

    // Starting cash (the change fund staff put in the drawer before the day's sales) —
    // summed across every day in the range, since a multi-day range (This Week/Month/Custom)
    // can span several drawer-opening entries. For a single-day range (Today, or the Daily
    // Sales screen) this is just that one day's amount.
    const { starting_cash } = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as starting_cash
      FROM cash_drawer_starts
      WHERE branch_id = ? AND drawer_date BETWEEN ? AND ?
    `).get(branchId, dateFrom, to) as { starting_cash: number }

    return {
      date: dateFrom,
      total_revenue: totals.total_revenue,
      transaction_count: totals.transaction_count,
      discount_total: totals.discount_total,
      collected_total: totals.collected_total,
      outstanding_total: totals.total_revenue - totals.collected_total,
      payment_breakdown,
      top_items,
      open_play_count,
      court_rental_count,
      starting_cash,
      // What should physically be in the drawer: the float staff started with, plus net
      // cash actually collected (already change-adjusted, see payment_breakdown above).
      expected_cash_total: starting_cash + payment_breakdown.cash,
    }
  },

  /** Set (or correct) the starting cash / float for one branch on one day. Any signed-in
   *  role can call this — whoever opens the register enters it, same as counting a drawer. */
  setStartingCash(branchId: string, date: string, amount: number, setBy?: string) {
    const db = getDb()
    const now = new Date().toISOString()
    db.prepare(`
      INSERT INTO cash_drawer_starts (id, branch_id, drawer_date, amount, set_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(branch_id, drawer_date) DO UPDATE SET
        amount = excluded.amount,
        set_by = excluded.set_by,
        updated_at = excluded.updated_at
    `).run(uuid(), branchId, date, amount, setBy || null, now, now)
    return { branch_id: branchId, date, amount }
  },
}
