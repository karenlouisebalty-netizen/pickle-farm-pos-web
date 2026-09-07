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
