// ─────────────────────────────────────────────────────────────
// Web API client — implements the same shape as the old desktop
// app's `window.electronAPI` (see shared/types.ts ElectronAPI),
// but talks to the server over HTTP instead of Electron IPC.
// Every screen ported from the desktop app calls these methods
// exactly as it used to, so screen code barely had to change.
// ─────────────────────────────────────────────────────────────
import type {
  CheckoutPayload, Transaction, Product, ProductCategory,
  Reservation, OpenPlayRegistration, Member, MembershipType,
  Expense, ExpenseSummary, DailySummary, Session, User,
  InventoryCount, WasteEntry, WasteReason, ReconciliationRow,
  AttendanceLog, AttendanceSummaryRow, ClockType,
} from '../shared/types'

const TOKEN_KEY = 'pf_pos_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}
function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

async function request<T>(method: string, path: string, body?: unknown, opts?: { overrideToken?: string }): Promise<T> {
  const headers: Record<string, string> = {}
  const token = opts?.overrideToken ?? getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  // Only the real stored session redirects on 401 — a one-off verification
  // call (e.g. checking the owner's PIN from the login screen) must not
  // clear an unrelated session or bounce the page.
  if (res.status === 401 && !opts?.overrideToken) {
    setToken(null)
    if (!location.pathname.startsWith('/login')) location.href = '/login'
  }

  const isJson = res.headers.get('content-type')?.includes('application/json')
  const data = isJson ? await res.json() : null

  if (!res.ok) {
    throw new Error((data && data.error) || `Request failed (${res.status})`)
  }
  return data as T
}

// Single attempt at checking the current session directly (bypasses `request()`'s
// unconditional 401→redirect, since a session-restore check on app load needs to distinguish
// "definitely not logged in" from "couldn't tell, try again" — see `getSession` below).
async function checkSessionOnce(): Promise<{ definitive: boolean; session: Session | null }> {
  const token = getToken()
  if (!token) return { definitive: true, session: null }
  try {
    const res = await fetch('/api/auth/session', { headers: { Authorization: `Bearer ${token}` } })
    if (res.status === 401) {
      // Server reachable and it says the token's genuinely invalid/expired — trust it now,
      // no point retrying.
      setToken(null)
      return { definitive: true, session: null }
    }
    if (!res.ok) return { definitive: false, session: null }
    return { definitive: true, session: await res.json() }
  } catch {
    // fetch() itself threw — offline, or the network isn't back yet. Not a real answer.
    return { definitive: false, session: null }
  }
}

function qs(params: Record<string, string | undefined>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v!)}`)
  return parts.length ? `?${parts.join('&')}` : ''
}

export const api = {
  // ── POS ──
  checkout:         (payload: CheckoutPayload)        => request<Transaction>('POST', '/pos/checkout', payload),
  refund:           (txnId: string, reason: string)   => request<Transaction>('POST', `/pos/transactions/${txnId}/refund`, { reason }),
  // Owner PIN required — ownerToken comes from verifyOwnerPin, same inline-verification
  // pattern used elsewhere, so voiding never needs the actual owner to be signed in.
  voidTxn:          (txnId: string, reason: string | undefined, ownerToken: string) =>
    request<Transaction>('POST', `/pos/transactions/${txnId}/void`, { reason }, { overrideToken: ownerToken }),
  getProducts:      (branchId: string)                => request<Product[]>('GET', `/pos/products${qs({ branchId })}`),
  updateProduct:    (id: string, updates: { name?: string; price?: number }) => request<Product>('PATCH', `/pos/products/${id}`, updates),
  createProduct:    (data: { branch_id: string; name: string; category: ProductCategory; price: number; track_inventory: boolean; stock_qty?: number; low_stock_threshold?: number; sku?: string }) => request<Product>('POST', '/pos/products', data),
  getTransaction:   (id: string)                       => request<Transaction>('GET', `/pos/transactions/${id}`),
  listTransactions: (branchId: string, dateFrom: string, dateTo?: string) => request<Transaction[]>('GET', `/pos/transactions${qs({ branchId, dateFrom, dateTo: dateTo ?? dateFrom })}`),
  // Any signed-in role — flips a credit/unpaid sale to paid once the money actually comes in.
  markTransactionPaid: (txnId: string) => request<Transaction>('POST', `/pos/transactions/${txnId}/mark-paid`),

  // ── Inventory ──
  stockIn:  (productId: string, qty: number, cost?: number, reason?: string) => request<void>('POST', '/inventory/stock-in', { productId, qty, cost, reason }),
  stockOut: (productId: string, qty: number, reason?: string)                => request<void>('POST', '/inventory/stock-out', { productId, qty, reason }),
  listMovements: (productId: string) => request<any[]>('GET', `/inventory/movements/${productId}`),
  getLowStock:   (branchId: string)  => request<Product[]>('GET', `/inventory/low-stock${qs({ branchId })}`),

  // ── Daily counts & waste ──
  getInventoryCounts: (branchId: string, date: string) => request<InventoryCount[]>('GET', `/inventory/counts${qs({ branchId, date })}`),
  submitInventoryCounts: (branchId: string, countDate: string, countType: 'start' | 'end', counts: Array<{ productId: string; quantity: number }>) =>
    request<{ success: boolean }>('POST', '/inventory/counts/bulk', { branchId, countDate, countType, counts }),
  getWasteLog: (branchId: string, date: string) => request<WasteEntry[]>('GET', `/inventory/waste${qs({ branchId, date })}`),
  logWaste: (productId: string, quantity: number, reason: WasteReason, notes?: string, wasteDate?: string) =>
    request<WasteEntry>('POST', '/inventory/waste', { productId, quantity, reason, notes, wasteDate }),
  getReconciliation: (branchId: string, date: string) => request<ReconciliationRow[]>('GET', `/inventory/reconciliation${qs({ branchId, date })}`),

  // ── Reservations ──
  createReservation: (data: Omit<Reservation, 'id' | 'created_at'>) => request<Reservation>('POST', '/reservations', data),
  listReservations:  (branchId: string, date: string)               => request<Reservation[]>('GET', `/reservations${qs({ branchId, date })}`),
  cancelReservation: (id: string) => request<void>('POST', `/reservations/${id}/cancel`),

  // ── Open Play ──
  registerOpenPlay:  (data: Omit<OpenPlayRegistration, 'id' | 'check_in_at'>) => request<OpenPlayRegistration>('POST', '/openplay/register', data),
  assignCourt:       (id: string, court: string) => request<void>('POST', `/openplay/${id}/assign`, { court }),
  checkOutPlayer:    (id: string)                => request<void>('POST', `/openplay/${id}/checkout`),
  listOpenPlayToday: (branchId: string)          => request<OpenPlayRegistration[]>('GET', `/openplay/today${qs({ branchId })}`),

  // ── Members ──
  lookupMember: (query: string) => request<any>('GET', `/members/lookup${qs({ q: query })}`),
  createMember: (data: any)     => request<Member>('POST', '/members', data),
  renewMember:  (id: string, type: MembershipType) => request<Member>('POST', `/members/${id}/renew`, { type }),

  // ── Expenses ──
  listExpenses:    (branchId: string, from: string, to: string) => request<Expense[]>('GET', `/expenses${qs({ branchId, dateFrom: from, dateTo: to })}`),
  createExpense:   (data: { branch_id: string; amount: number; category: string; description?: string; expense_date: string; created_by?: string }) => request<Expense>('POST', '/expenses', data),
  deleteExpense:   (id: string) => request<{ success: boolean }>('DELETE', `/expenses/${id}`),
  expenseSummary:  (branchId: string, from: string, to: string) => request<ExpenseSummary>('GET', `/expenses/summary${qs({ branchId, dateFrom: from, dateTo: to })}`),

  // ── Reports ──
  getDailySummary:  (branchId: string, dateFrom: string, dateTo: string) => request<DailySummary>('GET', `/reports/daily${qs({ branchId, dateFrom, dateTo })}`),
  // Cashier-accessible — always today, server-computed (see reports.routes.ts). Used by the
  // Daily Sales screen so staff can check the drawer without seeing revenue history.
  getTodaySummary:  (branchId: string) => request<DailySummary>('GET', `/reports/today${qs({ branchId })}`),

  // ── Auth ──
  login: async (userId: string, pin: string): Promise<Session> => {
    const data = await request<{ session: Session; token: string }>('POST', '/auth/login', { userId, pin })
    setToken(data.token)
    return data.session
  },
  logout: async (): Promise<void> => {
    try { await request('POST', '/auth/logout') } catch { /* ignore */ }
    setToken(null)
  },
  // Restoring a session on app load — deliberately more forgiving than a normal in-app API
  // call. A tablet that was just restarted can take a while to reconnect to Wi-Fi, and the
  // very first thing this app does is check the session; if that check fails because the
  // network isn't back yet (not because the login is actually invalid), the old behavior was
  // to treat it exactly like a real logout and bounce to the login screen — silently dropping
  // a staff member's still-valid session just because Wi-Fi hadn't caught up yet. Now: a
  // genuine 401 (server reachable, token really is invalid/expired) is trusted immediately,
  // but anything else (offline, DNS still resolving, server still booting) retries with
  // backoff for up to ~15s before giving up, which comfortably covers a normal Wi-Fi
  // reconnect after a restart. The stored token is only ever cleared on that genuine 401.
  getSession: async (): Promise<Session | null> => {
    if (!getToken()) return null
    const delays = [0, 1000, 2000, 3000, 4000, 5000]
    for (const delay of delays) {
      if (delay) await new Promise(r => setTimeout(r, delay))
      const result = await checkSessionOnce()
      if (result.definitive) return result.session
    }
    // Still unreachable after all retries — give up for this load rather than hang forever.
    // The token itself is untouched, so the next successful load (once the network's back)
    // restores the session normally instead of forcing a fresh login.
    return null
  },
  listUsers: (branchId: string) => request<User[]>('GET', `/auth/users${qs({ branchId })}`),

  // ── Attendance / Time Clock (staff sign in/out with a photo as proof) ──
  getTodayAttendance: (branchId: string) => request<AttendanceLog[]>('GET', `/attendance/today${qs({ branchId })}`),
  clockAttendance: (branchId: string, userId: string, clockType: ClockType, photo?: string) =>
    request<AttendanceLog>('POST', '/attendance/clock', { branchId, userId, clockType, photo }),
  // ownerToken is only needed when called pre-auth (the Login screen's Time Clock tab, after a
  // PIN check there). From inside the app the owner is already signed in, so it's omitted and
  // the normal stored session token is used instead.
  getAttendanceSummary: (branchId: string, month: string, ownerToken?: string) =>
    request<AttendanceSummaryRow[]>('GET', `/attendance/summary${qs({ branchId, month })}`, undefined, ownerToken ? { overrideToken: ownerToken } : undefined),
  getAttendanceLogs: (branchId: string, month: string) =>
    request<AttendanceLog[]>('GET', `/attendance/logs${qs({ branchId, month })}`),

  // ── Staff management (owner PIN required, verified inline without touching the real session) ──
  verifyOwnerPin: (ownerId: string, pin: string) => request<{ session: Session; token: string }>('POST', '/auth/login', { userId: ownerId, pin }),
  addStaff: (branchId: string, fullName: string, ownerToken: string) =>
    request<User>('POST', '/auth/users', { branch_id: branchId, full_name: fullName }, { overrideToken: ownerToken }),
  removeStaff: (userId: string, ownerToken: string) =>
    request<{ success: boolean }>('PATCH', `/auth/users/${userId}/deactivate`, undefined, { overrideToken: ownerToken }),
  // ownerToken is optional here too — omitted when called from an already-authenticated
  // owner session (e.g. the Attendance screen), passed when called pre-auth. currentPin is
  // only required (and checked server-side) when userId is the caller's own account — an
  // owner resetting a staff member's forgotten PIN doesn't need to supply it.
  changeStaffPin: (userId: string, pin: string, opts?: { ownerToken?: string; currentPin?: string }) =>
    request<{ success: boolean }>('PATCH', `/auth/users/${userId}/pin`, { pin, currentPin: opts?.currentPin }, opts?.ownerToken ? { overrideToken: opts.ownerToken } : undefined),
  // Called from the Attendance screen, which already requires an owner session — no ownerToken needed.
  setStaffDailyRate: (userId: string, dailyRate: number) =>
    request<{ success: boolean }>('PATCH', `/auth/users/${userId}/rate`, { dailyRate }),

  // ── Settings ──
  getSetting: (key: string) => request<{ value: string | null }>('GET', `/settings/${key}`).then(r => r.value),
  setSetting: (key: string, value: string) => request<void>('PUT', `/settings/${key}`, { value }),
}

export type Api = typeof api
