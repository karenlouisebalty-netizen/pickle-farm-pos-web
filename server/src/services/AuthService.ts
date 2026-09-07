import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { getDb } from '../db/database'
import { nowISO } from '../shared/utils'
import type { Session, User, UserRole } from '../shared/types'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'
const TOKEN_TTL = '12h'

export const AuthService = {
  /** Verify PIN and issue a signed session token. Stateless — safe for many concurrent devices. */
  async login(userId: string, pin: string): Promise<{ session: Session; token: string }> {
    const db = getDb()

    const user = db.prepare(`
      SELECT u.*, b.name as branch_name
      FROM users u
      JOIN branches b ON b.id = u.branch_id
      WHERE u.id = ? AND u.is_active = 1
    `).get(userId) as (User & { branch_name: string; pin_hash: string }) | undefined

    if (!user) throw new Error('User not found or inactive.')

    const valid = await bcrypt.compare(pin, user.pin_hash)
    if (!valid) throw new Error('Incorrect PIN. Please try again.')

    db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(nowISO(), userId)

    const session: Session = {
      user_id:      user.id,
      full_name:    user.full_name,
      role:         user.role as UserRole,
      branch_id:    user.branch_id,
      branch_name:  user.branch_name,
      logged_in_at: nowISO(),
    }

    const token = jwt.sign(session, JWT_SECRET, { expiresIn: TOKEN_TTL })
    return { session, token }
  },

  verifyToken(token: string): Session {
    return jwt.verify(token, JWT_SECRET) as unknown as Session
  },

  requireRole(session: Session, minRole: UserRole): void {
    const ROLE_RANK: Record<UserRole, number> = { cashier: 1, manager: 2, owner: 3 }
    if (ROLE_RANK[session.role] < ROLE_RANK[minRole]) {
      throw new Error(`Requires ${minRole} role or higher.`)
    }
  },

  listUsers(branchId: string): User[] {
    const db = getDb()
    return db.prepare(`
      SELECT id, branch_id, full_name, email, role, is_active, last_login_at, created_at
      FROM users WHERE branch_id = ? AND is_active = 1 ORDER BY role, full_name
    `).all(branchId) as User[]
  },

  async changePin(userId: string, newPin: string): Promise<void> {
    const db = getDb()
    const hash = await bcrypt.hash(newPin, 10)
    db.prepare('UPDATE users SET pin_hash = ?, updated_at = ? WHERE id = ?').run(hash, nowISO(), userId)
  },
}
