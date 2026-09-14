// ─────────────────────────────────────────────
// SHARED TYPES — mirrors the desktop app's shared/types.ts
// ─────────────────────────────────────────────

export type PaymentMethod = 'cash' | 'gcash' | 'maya' | 'credit_card' | 'bank_transfer'
export type UserRole = 'owner' | 'manager' | 'cashier'
export type TxnStatus = 'completed' | 'refunded' | 'voided'
/** Whether the money for a completed sale has actually been collected yet.
 *  'unpaid' is for sales made on credit/utang — recorded and inventory-deducted
 *  like any other sale, just not yet paid for. Defaults to 'paid'. */
export type PaymentStatus = 'paid' | 'unpaid'
export type SkillLevel = 'beginner' | 'intermediate' | 'advanced'
export type MembershipType = 'monthly' | 'quarterly' | 'annual'
export type MovementType = 'sale' | 'stock_in' | 'stock_out' | 'adjustment' | 'refund'
export type ReservationStatus = 'confirmed' | 'cancelled' | 'no_show' | 'completed'
export type ExpenseCategory = 'rent' | 'utilities' | 'supplies' | 'salaries' | 'maintenance' | 'food' | 'other'
export type ProductCategory =
  | 'open_play' | 'court_rental' | 'rental'
  | 'food_drinks' | 'merchandise' | 'coaching'

export interface Branch {
  id: string
  name: string
  address: string
  contact_number?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  branch_id: string
  full_name: string
  email?: string
  role: UserRole
  is_active: boolean
  last_login_at?: string
  created_at: string
  /** Flat amount paid per day worked — payroll, set by the owner. */
  daily_rate: number
}

export interface Customer {
  id: string
  branch_id: string
  full_name: string
  contact_number?: string
  email?: string
  notes?: string
  total_visits: number
  created_at: string
}

export interface Member {
  id: string
  customer_id: string
  member_code: string
  membership_type: MembershipType
  start_date: string
  expiry_date: string
  discount_pct: number
  is_active: boolean
  created_at: string
  customer?: Customer
}

export interface Product {
  id: string
  branch_id: string
  name: string
  category: ProductCategory
  price: number
  cost?: number
  stock_qty: number
  low_stock_threshold: number
  track_inventory: boolean
  sku?: string
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface TransactionItem {
  id: string
  transaction_id: string
  product_id?: string
  item_name: string
  unit_price: number
  quantity: number
  discount: number
  line_total: number
  notes?: string
}

export interface Payment {
  id: string
  transaction_id: string
  payment_method: PaymentMethod
  amount: number
  change_given: number
  reference_number?: string
  created_at: string
}

export interface Transaction {
  id: string
  branch_id: string
  cashier_id: string
  customer_id?: string
  receipt_number: string
  subtotal: number
  discount_total: number
  total: number
  status: TxnStatus
  notes?: string
  created_at: string
  updated_at: string
  items: TransactionItem[]
  payments: Payment[]
  cashier?: Pick<User, 'id' | 'full_name'>
  customer?: Pick<Customer, 'id' | 'full_name'>
  /** Has the money for this sale actually been collected? See PaymentStatus. */
  payment_status: PaymentStatus
  /** When it was (or was confirmed) paid — set at checkout if paid immediately,
   *  or when someone later marks an unpaid sale as paid. Null while unpaid. */
  paid_at?: string | null
  /** Who confirmed the money was collected — the cashier at checkout, or
   *  whoever marks it paid later. Null while unpaid. */
  paid_by?: string | null
  paid_by_name?: string
  /** True when this sale's date was typed in by a manager/owner (a forgotten entry, or
   *  recovering lost data) rather than captured live at checkout. Purely informational —
   *  it still counts normally everywhere (revenue, stock, payment status). */
  is_backdated: boolean
}

export interface OpenPlayRegistration {
  id: string
  branch_id: string
  transaction_id?: string
  player_name: string
  contact_number?: string
  skill_level: SkillLevel
  court_assigned?: string
  play_date: string
  check_in_at: string
  checked_out_at?: string
}

export interface Reservation {
  id: string
  branch_id: string
  customer_id?: string
  transaction_id?: string
  court_name: string
  reservation_date: string
  start_time: string
  end_time: string
  booker_name: string
  contact_number?: string
  status: ReservationStatus
  deposit_amount: number
  notes?: string
  is_recurring: boolean
  created_at: string
}

export interface InventoryMovement {
  id: string
  product_id: string
  user_id: string
  movement_type: MovementType
  quantity: number
  unit_cost?: number
  stock_before: number
  stock_after: number
  reference_id?: string
  reason?: string
  created_at: string
  product?: Pick<Product, 'id' | 'name'>
}

export interface Expense {
  id: string
  branch_id: string
  amount: number
  category: ExpenseCategory
  description?: string
  expense_date: string
  created_by?: string
  created_at: string
  created_by_name?: string
}

export interface ExpenseSummary {
  total: number
  byCategory: Array<{ category: ExpenseCategory; total: number }>
}

export interface CartItem {
  product_id: string
  item_name: string
  unit_price: number
  quantity: number
  discount: number
  line_total: number
  notes?: string
}

export interface CartDiscount {
  type: 'pct' | 'fixed'
  value: number
  reason: string
}

export interface CheckoutPayload {
  branch_id: string
  cashier_id: string
  customer_id?: string
  items: Omit<CartItem, 'line_total'>[]
  payments: Omit<Payment, 'id' | 'transaction_id' | 'created_at'>[]
  discount: CartDiscount
  notes?: string
  /** Defaults to 'paid' server-side when omitted, so older clients keep working unchanged. */
  payment_status?: PaymentStatus
  /** Manager/owner only (enforced server-side) — log this sale under a past date (YYYY-MM-DD)
   *  instead of right now. Omit for a normal live sale. */
  transaction_date?: string
}

export interface DailySummary {
  date: string
  /** Every completed sale, paid or not — what's "punched" into the system. */
  total_revenue: number
  transaction_count: number
  discount_total: number
  /** Only the paid portion of total_revenue — the actual money collected. */
  collected_total: number
  /** total_revenue minus collected_total — what's still owed on credit/unpaid sales. */
  outstanding_total: number
  /** Only counts payments on transactions that are actually paid. */
  payment_breakdown: Record<PaymentMethod, number>
  top_items: Array<{ name: string; qty: number; revenue: number }>
  open_play_count: number
  court_rental_count: number
}

export interface Session {
  user_id: string
  full_name: string
  role: UserRole
  branch_id: string
  branch_name: string
  logged_in_at: string
}
