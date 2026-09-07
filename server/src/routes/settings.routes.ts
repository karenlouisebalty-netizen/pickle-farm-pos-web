import { Router } from 'express'
import { getDb } from '../db/database'
import { nowISO } from '../shared/utils'
import { requireAuth } from '../middleware/auth'

export const settingsRoutes = Router()

settingsRoutes.get('/:key', requireAuth, (req, res) => {
  const db = getDb()
  const row = db.prepare('SELECT value FROM settings WHERE key=?').get(req.params.key) as { value: string } | undefined
  res.json({ value: row?.value ?? null })
})

settingsRoutes.put('/:key', requireAuth, (req, res) => {
  const db = getDb()
  const { value } = req.body as { value: string }
  db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)').run(req.params.key, value, nowISO())
  res.json({ success: true })
})
