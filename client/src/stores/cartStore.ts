import { create } from 'zustand'
import type { CartItem, CartDiscount, Product } from '../shared/types'
import { calcDiscount } from '../shared/utils'

interface CartStore {
  items: CartItem[]
  discount: CartDiscount
  memberName: string | null
  // PWD / Senior Citizen discount — 20% off, but ONLY on Open Play, Court Rental, and Rentals
  // (paddles, etc.). Mutually exclusive with the Member discount: this app only carries one
  // discount reason per sale, so turning one on clears the other.
  pwdSeniorActive: boolean

  addItem:      (product: Product) => void
  removeItem:   (productId: string) => void
  updateQty:    (productId: string, qty: number) => void
  setDiscount:  (discount: CartDiscount) => void
  setMember:    (name: string | null, discountPct: number) => void
  setPwdSeniorDiscount: (active: boolean) => void
  clearCart:    () => void
  addNote:      (productId: string, note: string) => void

  // Computed
  subtotal:       () => number
  discountAmount: () => number
  total:          () => number
  itemCount:      () => number
}

export const useCartStore = create<CartStore>((set, get) => ({
  items:      [],
  discount:   { type: 'pct', value: 0, reason: '' },
  memberName: null,
  pwdSeniorActive: false,

  addItem(product) {
    set(state => {
      const existing = state.items.find(i => i.product_id === product.id)
      if (existing) {
        return {
          items: state.items.map(i =>
            i.product_id === product.id
              ? { ...i, quantity: i.quantity + 1, line_total: (i.quantity + 1) * i.unit_price - i.discount }
              : i
          ),
        }
      }
      const newItem: CartItem = {
        product_id: product.id,
        item_name:  product.name,
        unit_price: product.price,
        quantity:   1,
        discount:   0,
        line_total: product.price,
        category:   product.category,
      }
      return { items: [...state.items, newItem] }
    })
  },

  removeItem(productId) {
    set(state => ({ items: state.items.filter(i => i.product_id !== productId) }))
  },

  updateQty(productId, qty) {
    if (qty <= 0) {
      get().removeItem(productId)
      return
    }
    set(state => ({
      items: state.items.map(i =>
        i.product_id === productId
          ? { ...i, quantity: qty, line_total: qty * i.unit_price - i.discount }
          : i
      ),
    }))
  },

  setDiscount(discount) {
    set({ discount })
  },

  setMember(name, discountAmt) {
    set({
      memberName: name,
      memberDiscountPerHour: name ? discountAmt : 0,
      // Selecting a member replaces any active PWD/Senior discount — only one discount
      // reason can be active on a sale at a time.
      pwdSeniorActive: name ? false : get().pwdSeniorActive,
      discount: name
        ? { type: 'fixed', value: discountAmt, reason: 'Member discount' }
        : { type: 'pct', value: 0, reason: '' },
    })
  },

  setPwdSeniorDiscount(active) {
    set({
      pwdSeniorActive: active,
      // Activating PWD/Senior replaces any active member discount, for the same reason.
      memberName: active ? null : get().memberName,
      memberDiscountPerHour: active ? 0 : (get() as any).memberDiscountPerHour,
      discount: active
        ? { type: 'fixed', value: 0, reason: 'PWD/Senior Discount (20%)' }
        : { type: 'pct', value: 0, reason: '' },
    })
  },

  clearCart() {
    set({ items: [], discount: { type: 'pct', value: 0, reason: '' }, memberName: null, pwdSeniorActive: false })
  },

  addNote(productId, note) {
    set(state => ({
      items: state.items.map(i =>
        i.product_id === productId ? { ...i, notes: note } : i
      ),
    }))
  },

  subtotal() {
    return get().items.reduce((sum, i) => sum + i.line_total, 0)
  },

  discountAmount() {
    const state = get()
    const d = state.discount
    if (state.pwdSeniorActive) {
      // 20% off, but only on Open Play, Court Rental, and Rentals (paddles, etc.) line items
      // — never food & drinks, merchandise, or coaching.
      const eligible = state.items.filter(i => i.category === 'open_play' || i.category === 'court_rental' || i.category === 'rental')
      const eligibleSubtotal = eligible.reduce((sum, i) => sum + i.line_total, 0)
      return Math.round(eligibleSubtotal * 0.20)
    }
    if (state.memberName && d.type === 'fixed') {
      let totalHours = 0
      for (const item of state.items) {
        if (item.notes) {
          try {
            const note = JSON.parse(item.notes)
            if (note.duration) totalHours += parseFloat(note.duration) * item.quantity
          } catch {}
        }
      }
      const perHour = (state as any).memberDiscountPerHour || 100
      return totalHours > 0 ? totalHours * perHour : d.value
    }
    const sub = state.subtotal()
    return calcDiscount(sub, d.type, d.value)
  },

  total() {
    return get().subtotal() - get().discountAmount()
  },

  itemCount() {
    return get().items.reduce((sum, i) => sum + i.quantity, 0)
  },
}))
