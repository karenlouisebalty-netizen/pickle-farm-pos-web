import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import { initDatabase } from './db/database'
import { authRoutes } from './routes/auth.routes'
import { posRoutes } from './routes/pos.routes'
import { inventoryRoutes } from './routes/inventory.routes'
import { reservationRoutes } from './routes/reservations.routes'
import { openPlayRoutes } from './routes/openplay.routes'
import { memberRoutes } from './routes/members.routes'
import { expenseRoutes } from './routes/expenses.routes'
import { reportRoutes } from './routes/reports.routes'
import { settingsRoutes } from './routes/settings.routes'
import { attendanceRoutes } from './routes/attendance.routes'

initDatabase()

const app = express()

const corsOrigin = process.env.CORS_ORIGIN
app.use(cors({ origin: corsOrigin ? corsOrigin.split(',') : true }))
app.use(express.json({ limit: '5mb' })) // attendance clock-in photos are sent as base64 JSON

app.get('/api/health', (_req, res) => res.json({ ok: true }))

app.use('/api/auth', authRoutes)
app.use('/api/pos', posRoutes)
app.use('/api/inventory', inventoryRoutes)
app.use('/api/reservations', reservationRoutes)
app.use('/api/openplay', openPlayRoutes)
app.use('/api/members', memberRoutes)
app.use('/api/expenses', expenseRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/attendance', attendanceRoutes)

// In production, this server also serves the built React app so the whole
// thing deploys as a single web service (one URL, no separate frontend host).
const clientDist = path.resolve(__dirname, '../../client/dist')
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next()
    res.sendFile(path.join(clientDist, 'index.html'))
  })
}

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})

const port = Number(process.env.PORT) || 4000
app.listen(port, () => {
  console.log(`[Server] The Pickle Farm POS API listening on port ${port}`)
})
