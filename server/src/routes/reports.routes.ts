import { Router } from 'express'
import { ReportService } from '../services/ReportService'
import { requireAuth } from '../middleware/auth'

export const reportRoutes = Router()

reportRoutes.get('/daily', requireAuth, (req, res) => {
  const { branchId, dateFrom, dateTo } = req.query as Record<string, string>
  res.json(ReportService.getDailySummary(branchId, dateFrom, dateTo))
})
