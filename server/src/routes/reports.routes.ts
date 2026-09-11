import { Router } from 'express'
import { ReportService } from '../services/ReportService'
import { requireAuth, requireRole } from '../middleware/auth'

export const reportRoutes = Router()

// Manager/owner only — this is where revenue and income figures live,
// and cashiers should not be able to see the business's actual income,
// even by calling the API directly.
reportRoutes.get('/daily', requireAuth, requireRole('manager'), (req, res) => {
  const { branchId, dateFrom, dateTo } = req.query as Record<string, string>
  res.json(ReportService.getDailySummary(branchId, dateFrom, dateTo))
})

// Any authenticated role, including cashier — but always TODAY, computed here rather than
// taken from a query param, so it can't be used to pull historical/monthly revenue even by
// calling the API directly with a spoofed date. This is what lets a cashier check today's
// cash against the system (their Daily Sales screen) without opening up income history.
reportRoutes.get('/today', requireAuth, (req, res) => {
  const { branchId } = req.query as Record<string, string>
  const today = new Date().toISOString().slice(0, 10)
  res.json(ReportService.getDailySummary(branchId, today, today))
})
