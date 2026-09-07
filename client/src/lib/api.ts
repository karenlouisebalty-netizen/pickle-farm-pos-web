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
} from '../shared/types'

const TOKEN_KEY = 'pf_pos_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}
function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {}
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401) {
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
  voidTxn:          (txnId: string)                   => request<Transaction>('POST', `/pos/transactions/${txnId}/void`),
  getProducts:      (branchId: string)                => request<Product[]>('GET', `/pos/products${qs({ branchId })}`),
  updateProduct:    (id: string, updates: { name?: string; price?: number }) => request<Product>('PATCH', `/pos/products/${id}`, updates),
  createProduct:    (data: { branch_id: string; name: string; category: ProductCategory; price: number; track_inventory: boolean; stock_qty?: number; low_stock_threshold?: number; sku?: string }) => request<Product>('POST', '/pos/products', data),
  getTransaction:   (id: string)                       => request<Transaction>('GET', `/pos/transactions/${id}`),
  listTransactions: (branchId: string, dateFrom: string, dateTo?: string) => request<Transaction[]>('GET', `/pos/transactions${qs({ branchId, dateFrom, dateTo: dateTo ?? dateFrom })}`),

  // ── Inventory ──
  stockIn:  (productId: string, qty: number, cost?: number, reason?: string) => request<void>('POST', '/inventory/stock-in', { productId, qty, cost, reason }),
  stockOut: (productId: string, qty: number, reason?: string)                => request<void>('POST', '/inventory/stock-out', { productId, qty, reason }),
  listMovements: (productId: string) => request<any[]>('GET', `/inventory/movements/${productId}`),
  getLowStock:   (branchId: string)  => request<Product[]>('GET', `/inventory/low-stock${qs({ branchId })}`),

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
  getSession: (): Promise<Session | null> => {
    if (!getToken()) return Promise.resolve(null)
    return request<Session>('GET', '/auth/session').catch(() => null)
  },
  listUsers: (branchId: string) => request<User[]>('GET', `/auth/users${qs({ branchId })}`),

  // ── Settings ──
  getSetting: (key: string) => request<{ value: string | null }>('GET', `/settings/${key}`).then(r => r.value),
  setSetting: (key: string, value: string) => request<void>('PUT', `/settings/${key}`, { value }),
}

export type Api = typeof api
