// ─────────────────────────────────────────────
// SHARED TYPES — mirrors the desktop app's shared/types.ts
// ─────────────────────────────────────────────

export type PaymentMethod = 'cash' | 'gcash' | 'maya' | 'credit_card' | 'bank_transfer'
export type UserRole = 'owner' | 'manager' | 'cashier'
export type TxnStatus = 'completed' | 'refunded' | 'voided'
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

export interface AttendanceLog {
  id: string
  branch_id: string
  user_id: string
  user_name?: string
  clock_type: 'in' | 'out'
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
  total_salary: number
  days: Array<{ date: string; hours: number; paid: boolean; amount: number }>
}

export interface DailySummary {
  date: string
  total_revenue: number
  transaction_count: number
  discount_total: number
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
