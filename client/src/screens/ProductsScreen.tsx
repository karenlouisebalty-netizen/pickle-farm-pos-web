import { useState, useEffect } from 'react'
import { useSessionStore } from '../stores/sessionStore'

const CAT_LABELS = {
  open_play:'Open Play', court_rental:'Court Rental', rental:'Rentals',
  food_drinks:'Food & Drinks', merchandise:'Merchandise', coaching:'Coaching'
}
const CATS = ['open_play','court_rental','rental','food_drinks','merchandise','coaching']
// Only these get physical daily counts (Daily Count / Waste / Reconciliation) — everything
// else is a service/booking, not shelf stock. Used to default the "Track inventory" checkbox
// so a new Court Rental etc. doesn't accidentally end up on those screens.
const CONSUMABLE_CATS = ['food_drinks', 'merchandise']

export function ProductsScreen() {
  const session = useSessionStore(s => s.session)
  const [products, setProducts] = useState([])
  const [editing, setEditing] = useState(null)
  const [editPrice, setEditPrice] = useState('')
  const [editName, setEditName] = useState('')
  const [toast, setToast] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [newCategory, setNewCategory] = useState('food_drinks')
  const [newTrackInventory, setNewTrackInventory] = useState(true)
  const [newStockQty, setNewStockQty] = useState('0')

  useEffect(() => {
    if (!session) return
    window.electronAPI.getProducts(session.branch_id).then(setProducts)
  }, [session])

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 2500) }

  function startEdit(p) { setEditing(p); setEditPrice(String(p.price)); setEditName(p.name) }

  async function saveEdit() {
    if (!editing) return
    const price = parseFloat(editPrice) || 0
    try {
      await window.electronAPI.updateProduct(editing.id, { name: editName, price })
      setProducts(prev => prev.map(p => p.id === editing.id ? {...p, name: editName, price} : p))
      setEditing(null)
      showToast('Updated! Price will show on POS immediately.')
    } catch (err) {
      console.error('Failed to update product:', err)
      showToast('Failed to save — please try again.')
    }
  }

  async function createProduct() {
    if (!newName.trim() || !session) { showToast('Please enter a product name.'); return }
    const price = parseFloat(newPrice) || 0
    try {
      const created = await window.electronAPI.createProduct({
        branch_id: session.branch_id,
        name: newName.trim(),
        category: newCategory,
        price,
        track_inventory: newTrackInventory,
        stock_qty: newTrackInventory ? (parseInt(newStockQty) || 0) : 0,
      })
      setProducts(prev => [...prev, created])
      setShowAdd(false)
      setNewName(''); setNewPrice(''); setNewCategory('food_drinks'); setNewTrackInventory(true); setNewStockQty('0')
      showToast('Product added!')
    } catch (err) {
      console.error('Failed to create product:', err)
      showToast('Failed to add product — please try again.')
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-cream">
      <div className="sticky top-0 bg-cream border-b border-border px-6 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-dg">Products and Pricing</h1>
          <p className="text-xs text-gray-500 mt-0.5">Click any product to edit its name or price</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-dg text-white text-sm font-medium">
          <i className="ti ti-plus" /> Add product
        </button>
      </div>
      <div className="mx-6 mt-4 mb-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5">
        <p className="text-xs text-blue-700"><strong>Court Rental tip:</strong> Price is per hour. On POS, tap + to increase quantity for more hours. 2 hours = 2x price.</p>
      </div>
      <div className="px-6 pb-8 space-y-4">
        {CATS.map(cat => {
          const items = products.filter(p => p.category === cat)
          if (!items.length) return null
          return (
            <div key={cat}>
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">{CAT_LABELS[cat]}</div>
              <div className="bg-white rounded-xl border border-border overflow-hidden">
                {items.map((p, i) => (
                  <div key={p.id} onClick={() => startEdit(p)}
                    className={'flex items-center gap-3 px-4 py-3 hover:bg-surface cursor-pointer' + (i > 0 ? ' border-t border-border' : '')}>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-dg">{p.name}</div>
                      <div className="text-xs text-gray-400">{p.track_inventory ? 'Stock: ' + p.stock_qty : 'Service'}{cat === 'court_rental' ? ' · Per hour' : ''}</div>
                    </div>
                    <div className="text-sm font-medium text-maroon">P{Number(p.price).toFixed(2)}</div>
                    <i className="ti ti-pencil text-gray-300 text-sm" />
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-5 w-72 border border-border">
            <h3 className="text-sm font-medium text-dg mb-4">Edit product</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Name</label>
                <input value={editName} onChange={e => setEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border text-sm outline-none focus:border-olive" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Price (P per unit/hour)</label>
                <input type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border text-sm outline-none focus:border-olive" min="0" step="1" />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setEditing(null)} className="flex-1 py-2 rounded-lg bg-surface border border-border text-sm text-gray-600">Cancel</button>
              <button onClick={saveEdit} className="flex-1 py-2 rounded-lg bg-dg text-white text-sm font-medium">Save</button>
            </div>
          </div>
        </div>
      )}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-5 w-80 border border-border">
            <h3 className="text-sm font-medium text-dg mb-4">Add new product</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Category</label>
                <select value={newCategory} onChange={e => {
                    const cat = e.target.value
                    setNewCategory(cat)
                    setNewTrackInventory(CONSUMABLE_CATS.includes(cat))
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-border text-sm outline-none focus:border-olive bg-white">
                  {CATS.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Name</label>
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Iced Tea"
                  className="w-full px-3 py-2 rounded-lg border border-border text-sm outline-none focus:border-olive" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Price (P{newCategory === 'court_rental' ? ' per hour' : ''})</label>
                <input type="number" value={newPrice} onChange={e => setNewPrice(e.target.value)} placeholder="0"
                  className="w-full px-3 py-2 rounded-lg border border-border text-sm outline-none focus:border-olive" min="0" step="1" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="trackInv" checked={newTrackInventory} onChange={e => setNewTrackInventory(e.target.checked)} />
                <label htmlFor="trackInv" className="text-xs text-gray-600">Track inventory / stock</label>
              </div>
              {newTrackInventory && (
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Starting stock quantity</label>
                  <input type="number" value={newStockQty} onChange={e => setNewStockQty(e.target.value)} placeholder="0"
                    className="w-full px-3 py-2 rounded-lg border border-border text-sm outline-none focus:border-olive" min="0" step="1" />
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2 rounded-lg bg-surface border border-border text-sm text-gray-600">Cancel</button>
              <button onClick={createProduct} className="flex-1 py-2 rounded-lg bg-dg text-white text-sm font-medium">Add product</button>
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-dg text-white text-sm px-4 py-2.5 rounded-xl">{toast}</div>
      )}
    </div>
  )
}
