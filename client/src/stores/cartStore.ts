import { create } from 'zustand'
import type { CartItem, CartDiscount, Product } from '../shared/types'
import { calcDiscount } from '../shared/utils'

interface CartStore {
  items: CartItem[]
  discount: CartDiscount
  memberName: string | null

  addItem:      (product: Product) => void
  removeItem:   (productId: string) => void
  updateQty:    (productId: string, qty: number) => void
  setDiscount:  (discount: CartDiscount) => void
  setMember:    (name: string | null, discountPct: number) => void
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
      discount: name
        ? { type: 'fixed', value: discountAmt, reason: 'Member discount' }
        : { type: 'pct', value: 0, reason: '' },
    })
  },

  clearCart() {
    set({ items: [], discount: { type: 'pct', value: 0, reason: '' }, memberName: null })
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
