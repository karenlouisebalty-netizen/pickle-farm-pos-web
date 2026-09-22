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
  /** One name per unit of quantity, for Open Play / Court Rental lines. Stored as JSON in
   *  the DB; the server parses it back into a plain string array before sending it out. */
  customer_names?: string[]
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
  /** True when this sale was assigned a FUTURE date/time — an advance payment. The money
   *  was collected today, but the sale lands in the assigned date's reports instead of
   *  today's. Mutually exclusive with is_backdated (one custom date is either past or future). */
  is_advance_payment: boolean
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
  /** Client-side only (not persisted as its own column) — the product's category, kept on
   *  the cart line so Checkout can tell which items need names without re-fetching products. */
  category?: ProductCategory
  /** One name per unit of quantity, required at checkout for Open Play / Court Rental items
   *  (2x Open Play → 2 names) so there's a record of who played/booked even for a quick sale
   *  rung up straight from the product grid. Omitted/ignored for every other category. */
  customer_names?: string[]
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
  /** Manager/owner only (enforced server-side) — log this sale under a different date
   *  (YYYY-MM-DD) instead of right now. A PAST date backdates the sale (a forgotten entry);
   *  a FUTURE date makes it an advance payment (money collected today for a sale that lands
   *  in that future date's reports instead). Omit for a normal live sale. */
  transaction_date?: string
  /** Optional 24-hour "HH:MM", paired with transaction_date — the exact time to assign,
   *  as picked in the browser's local clock. Omit to keep today's real time-of-day (the
   *  original backdate behavior, still fine when only the date matters). */
  transaction_time?: string
}

export type WasteReason = 'spoiled' | 'expired' | 'damaged' | 'dropped' | 'other'

export interface InventoryCount {
  id: string
  branch_id: string
  product_id: string
  user_id: string
  user_name?: string
  count_date: string
  count_type: 'start' | 'end'
  quantity: number
  created_at: string
  updated_at: string
}

export interface WasteEntry {
  id: string
  branch_id: string
  product_id: string
  product_name?: string
  user_id: string
  user_name?: string
  quantity: number
  reason: WasteReason
  notes?: string
  unit_cost: number
  total_cost: number
  expense_id?: string
  waste_date: string
  created_at: string
}

export interface ReconciliationRow {
  product_id: string
  product_name: string
  category: ProductCategory
  start_qty: number | null
  end_qty: number | null
  sold_qty: number
  wasted_qty: number
  actual_used: number | null
  expected_used: number
  variance: number | null
  status: 'pending' | 'ok' | 'variance'
}

export type ClockType = 'in' | 'out' | 'break_start' | 'break_end'

export interface AttendanceLog {
  id: string
  branch_id: string
  user_id: string
  user_name?: string
  clock_type: ClockType
  photo?: string | null
  captured_at: string
}

export interface AttendanceSummaryRow {
  user_id: string
  full_name: string
  daily_rate: number
  days_present: number
  paid_days: number
  total_hours: number
  /** Total break time this month, in hours — already subtracted out of `total_hours` and
   *  each day's `hours` below. Purely informational: pay is a flat daily rate either way,
   *  so breaks never change what's owed (see `paid_days`/`total_salary`). */
  total_break_hours: number
  total_salary: number
  days: Array<{ date: string; hours: number; break_hours: number; paid: boolean; amount: number }>
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
  /** Cash float staff started the drawer with, summed across every day in this range. */
  starting_cash: number
  /** What should physically be in the drawer: starting_cash + net cash collected
   *  (payment_breakdown.cash, which is already change-adjusted). */
  expected_cash_total: number
}

export interface Session {
  user_id: string
  full_name: string
  role: UserRole
  branch_id: string
  branch_name: string
  logged_in_at: string
}
