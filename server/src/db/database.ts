import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import bcrypt from 'bcryptjs'

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialised. Call initDatabase() first.')
  return db
}

export function initDatabase(): void {
  const dbPath = process.env.DB_PATH || './data/pickle-farm.db'
  const resolved = path.resolve(dbPath)
  fs.mkdirSync(path.dirname(resolved), { recursive: true })

  console.log('[DB] Opening SQLite at', resolved)

  db = new Database(resolved)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('synchronous = NORMAL')

  runMigrations(db)
  setupDefaultPin(db)
}

function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      filename  TEXT NOT NULL UNIQUE,
      ran_at    TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  const migrationsDir = path.join(__dirname, 'migrations')
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort()

  const ran = new Set(
    (db.prepare('SELECT filename FROM _migrations').all() as Array<{ filename: string }>)
      .map(r => r.filename)
  )

  for (const file of files) {
    if (ran.has(file)) continue
    console.log('[DB] Running migration:', file)
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8')
    db.exec(sql)
    db.prepare('INSERT INTO _migrations (filename) VALUES (?)').run(file)
  }
}

/** On first launch, replace the 'SETUP' placeholder PIN hash with a real bcrypt hash for PIN 1234. */
function setupDefaultPin(db: Database.Database): void {
  const users = db.prepare("SELECT id FROM users WHERE pin_hash = 'SETUP'").all() as Array<{ id: string }>
  if (users.length === 0) return

  const defaultPin = '1234'
  const hash = bcrypt.hashSync(defaultPin, 10)

  const update = db.prepare('UPDATE users SET pin_hash = ? WHERE id = ?')
  const txn = db.transaction(() => {
    for (const user of users) {
      update.run(hash, user.id)
    }
  })
  txn()
  console.log(`[DB] Default PIN (1234) set for ${users.length} user(s). Change it after first login.`)
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
    console.log('[DB] Database closed.')
  }
}
