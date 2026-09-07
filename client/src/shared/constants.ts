export const PAYMENT_METHODS = [
  { value: 'cash',          label: 'Cash',          icon: 'ti-cash' },
  { value: 'gcash',         label: 'GCash',         icon: 'ti-device-mobile' },
  { value: 'maya',          label: 'Maya',          icon: 'ti-device-mobile-dollar' },
  { value: 'credit_card',   label: 'Credit Card',   icon: 'ti-credit-card' },
  { value: 'bank_transfer', label: 'Bank Transfer', icon: 'ti-building-bank' },
] as const

export const SKILL_LEVELS = [
  { value: 'beginner',     label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced',     label: 'Advanced' },
] as const

export const COURTS = ['court_1', 'court_2'] as const
export const COURT_LABELS: Record<string, string> = {
  court_1: 'Court 1',
  court_2: 'Court 2',
}

export const MEMBERSHIP_TYPES = [
  { value: 'monthly',   label: 'Monthly',   months: 1  },
  { value: 'quarterly', label: 'Quarterly', months: 3  },
  { value: 'annual',    label: 'Annual',    months: 12 },
] as const

export const PRODUCT_CATEGORIES = [
  { value: 'open_play',    label: 'Open Play'    },
  { value: 'court_rental', label: 'Court Rental' },
  { value: 'rental',       label: 'Rentals'      },
  { value: 'food_drinks',  label: 'Food & Drinks'},
  { value: 'merchandise',  label: 'Merchandise'  },
  { value: 'coaching',     label: 'Coaching'     },
] as const

export const EXPENSE_CATEGORIES = [
  { value: 'rent',        label: 'Rent'        },
  { value: 'utilities',   label: 'Utilities'   },
  { value: 'supplies',    label: 'Supplies'    },
  { value: 'salaries',    label: 'Salaries'    },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'food',        label: 'Food'        },
  { value: 'other',       label: 'Other'       },
] as const

export const RECEIPT_WIDTH = 32
export const DEFAULT_LOW_STOCK_THRESHOLD = 5
