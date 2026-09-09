import { useState, useEffect, useMemo } from 'react'
import { useSessionStore } from '../stores/sessionStore'
import { todayString } from '../shared/utils'

const CATEGORIES = [
  { value: 'all', label: 'All Items' },
  { value: 'food_drinks', label: 'Food & Drinks' },
  { value: 'merchandise', label: 'Merchandise' },
  { value: 'rental', label: 'Equipment Rental' },
  { value: 'court_rental', label: 'Court Rental' },
  { value: 'open_play', label: 'Open Play' },
  { value: 'coaching', label: 'Coaching' },
]

const WASTE_REASONS = [
  { value: 'spoiled', label: 'Spoiled' },
  { value: 'expired', label: 'Expired' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'dropped', label: 'Dropped / Broken' },
  { value: 'other', label: 'Other' },
]

const fmt = (n) => '₱' + (n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })

function StockBadge({ qty, threshold }) {
  if (qty === 0) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Out of stock</span>
  if (qty <= threshold) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">Low stock</span>
  return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">In stock</span>
}

function StockModal({ product, mode, onClose, onDone }) {
  const [qty, setQty] = useState(1)
  const [reason, setReason] = useState('')
  const [cost, setCost] = useState('')
  const [loading, setLoading] = useState(false)
  async function handleSubmit() {
    if (!qty || qty < 1) return
    setLoading(true)
    try {
      if (mode === 'in') {
        await window.electronAPI.stockIn(product.id, qty, cost ? parseFloat(cost) : undefined, reason || undefined)
      } else {
        await window.electronAPI.stockOut(product.id, qty, reason || undefined)
      }
      onDone()
    } finally { setLoading(false) }
  }
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-medium text-dg">{mode === 'in' ? 'Stock In' : 'Stock Out'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><i className="ti ti-x" /></button>
        </div>
        <div className="text-sm text-gray-600 mb-4">{product.name} &mdash; current stock: <span className="font-medium text-dg">{product.stock_qty}</span></div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Quantity</label>
            <input type="number" min={1} value={qty} onChange={e => setQty(parseInt(e.target.value) || 1)} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-olive" />
          </div>
          {mode === 'in' && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Unit cost (optional)</label>
              <input type="number" min={0} step="0.01" value={cost} onChange={e => setCost(e.target.value)} placeholder="0.00" className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-olive" />
            </div>
          )}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Reason (optional)</label>
            <input type="text" value={reason} onChange={e => setReason(e.target.value)} placeholder={mode === 'in' ? 'e.g. Delivery from supplier' : 'e.g. Damaged'} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-olive" />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-border text-sm text-gray-600 hover:bg-surface">Cancel</button>
          <button onClick={handleSubmit} disabled={loading} className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white ${mode === 'in' ? 'bg-dg hover:bg-dg-light' : 'bg-maroon hover:opacity-90'} disabled:opacity-50`}>
            {loading ? 'Saving...' : mode === 'in' ? 'Add Stock' : 'Remove Stock'}
          </button>
        </div>
      </div>
    </div>
  )
}

function MovementsModal({ product, onClose }) {
  const [movements, setMovements] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    window.electronAPI.listMovements(product.id).then(setMovements).finally(() => setLoading(false))
  }, [product.id])
  const typeColor = (t) => ({ sale: 'text-red-600', stock_in: 'text-green-600', stock_out: 'text-orange-600', adjustment: 'text-blue-600', refund: 'text-purple-600' }[t] || 'text-gray-600')
  const typeLabel = (t) => ({ sale: 'Sale', stock_in: 'Stock In', stock_out: 'Stock Out', adjustment: 'Adjustment', refund: 'Refund' }[t] || t)
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="text-base font-medium text-dg">Stock History</h2>
            <p className="text-xs text-gray-500 mt-0.5">{product.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><i className="ti ti-x" /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-4">
          {loading ? <div className="text-center py-8 text-gray-400 text-sm">Loading...</div>
          : movements.length === 0 ? <div className="text-center py-8 text-gray-400 text-sm">No stock movements yet</div>
          : (movements as any[]).map((m) => (
            <div key={m.id} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
              <div className={`text-xs font-medium w-20 ${typeColor(m.movement_type)}`}>{typeLabel(m.movement_type)}</div>
              <div className="flex-1">
                <div className="text-xs text-gray-700">{m.reason || '—'}</div>
                <div className="text-xs text-gray-400 mt-0.5">{m.user_name} · {new Date(m.created_at).toLocaleDateString('en-PH')}</div>
              </div>
              <div className="text-right">
                <div className={`text-sm font-medium ${m.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>{m.quantity > 0 ? '+' : ''}{m.quantity}</div>
                <div className="text-xs text-gray-400">{m.stock_before} → {m.stock_after}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Daily Count tab ────────────────────────────────────────────
// Staff enter only one number per item: the actual physical count,
// either "start of shift" or "end of shift". Nothing else to compute.
function DailyCountTab({ products, session }) {
  const [date, setDate] = useState(todayString())
  const [countType, setCountType] = useState('start')
  const [existing, setExisting] = useState({}) // productId -> { start, end }
  const [inputs, setInputs] = useState({}) // productId -> string
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)

  const tracked = useMemo(() => (products as any[]).filter(p => p.track_inventory && p.is_active), [products])

  async function load() {
    if (!session) return
    setLoading(true)
    const rows = await window.electronAPI.getInventoryCounts(session.branch_id, date)
    const map = {}
    for (const r of rows as any[]) {
      map[r.product_id] = { ...(map[r.product_id] || {}), [r.count_type]: r.quantity }
    }
    setExisting(map)
    const nextInputs = {}
    for (const p of tracked) {
      const v = map[p.id]?.[countType]
      nextInputs[p.id] = v != null ? String(v) : ''
    }
    setInputs(nextInputs)
    setLoading(false)
  }

  useEffect(() => { load() }, [session, date])
  useEffect(() => {
    const nextInputs = {}
    for (const p of tracked) {
      const v = existing[p.id]?.[countType]
      nextInputs[p.id] = v != null ? String(v) : ''
    }
    setInputs(nextInputs)
  }, [countType])

  async function handleSave() {
    const counts = Object.entries(inputs)
      .filter(([, v]) => v !== '' && v != null)
      .map(([productId, v]) => ({ productId, quantity: parseInt(String(v), 10) }))
      .filter(c => !isNaN(c.quantity) && c.quantity >= 0)
    if (counts.length === 0) return
    setSaving(true)
    try {
      await window.electronAPI.submitInventoryCounts(session.branch_id, date, countType, counts)
      setSavedMsg(true)
      setTimeout(() => setSavedMsg(false), 2500)
      await load()
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none" />
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button onClick={() => setCountType('start')} className={`px-4 py-2 text-sm font-medium ${countType === 'start' ? 'bg-dg text-white' : 'bg-white text-gray-600 hover:bg-surface'}`}>Beginning of Shift</button>
          <button onClick={() => setCountType('end')} className={`px-4 py-2 text-sm font-medium ${countType === 'end' ? 'bg-dg text-white' : 'bg-white text-gray-600 hover:bg-surface'}`}>End of Shift</button>
        </div>
        {savedMsg && <span className="text-xs text-green-700 flex items-center gap-1"><i className="ti ti-check" /> Counts saved</span>}
      </div>
      <p className="text-xs text-gray-500">Enter the actual number of each item you can physically count right now. Everything else — consumption, tally against sales, waste — is calculated automatically once both counts are in.</p>
      <div className="bg-white rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm min-w-[520px]">
          <thead>
            <tr className="border-b border-border bg-surface">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Product</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">System Stock</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 w-40">{countType === 'start' ? 'Beginning Count' : 'Ending Count'}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={3} className="text-center py-12 text-gray-400 text-sm">Loading...</td></tr>
            : tracked.length === 0 ? <tr><td colSpan={3} className="text-center py-12 text-gray-400 text-sm">No tracked items</td></tr>
            : tracked.map((p: any) => (
              <tr key={p.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2.5 font-medium text-dg text-sm">{p.name}</td>
                <td className="px-4 py-2.5 text-right text-xs text-gray-400">{p.stock_qty}</td>
                <td className="px-4 py-2.5 text-right">
                  <input
                    type="number" min={0}
                    value={inputs[p.id] ?? ''}
                    onChange={e => setInputs(prev => ({ ...prev, [p.id]: e.target.value }))}
                    className="w-24 border border-border rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-olive"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={handleSave} disabled={saving || loading} className="px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-dg hover:bg-dg-light disabled:opacity-50">
        {saving ? 'Saving...' : `Save ${countType === 'start' ? 'Beginning' : 'Ending'} Counts`}
      </button>
    </div>
  )
}

// ── Waste tab ────────────────────────────────────────────────
function WasteTab({ products, session }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [productId, setProductId] = useState('')
  const [qty, setQty] = useState(1)
  const [reason, setReason] = useState('spoiled')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const tracked = useMemo(() => (products as any[]).filter(p => p.track_inventory && p.is_active), [products])
  const today = todayString()

  async function load() {
    if (!session) return
    setLoading(true)
    const rows = await window.electronAPI.getWasteLog(session.branch_id, today)
    setEntries(rows)
    setLoading(false)
  }
  useEffect(() => { load() }, [session])

  async function handleLog() {
    if (!productId || !qty || qty < 1) return
    setSaving(true)
    try {
      await window.electronAPI.logWaste(productId, qty, reason, notes || undefined)
      setProductId(''); setQty(1); setReason('spoiled'); setNotes('')
      await load()
    } finally { setSaving(false) }
  }

  const totalCostToday = (entries as any[]).reduce((sum, e) => sum + (e.total_cost || 0), 0)

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-border p-4">
        <h3 className="text-sm font-medium text-dg mb-3">Log Waste</h3>
        <div className="flex items-end gap-3 flex-wrap">
          <div className="min-w-48">
            <label className="text-xs text-gray-500 mb-1 block">Item</label>
            <select value={productId} onChange={e => setProductId(e.target.value)} className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none">
              <option value="">Select item...</option>
              {tracked.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Quantity</label>
            <input type="number" min={1} value={qty} onChange={e => setQty(parseInt(e.target.value) || 1)} className="w-24 px-3 py-2 text-sm border border-border rounded-lg focus:outline-none" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Reason</label>
            <select value={reason} onChange={e => setReason(e.target.value)} className="px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none">
              {WASTE_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-40">
            <label className="text-xs text-gray-500 mb-1 block">Notes (optional)</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. left out overnight" className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none" />
          </div>
          <button onClick={handleLog} disabled={saving || !productId} className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-maroon hover:opacity-90 disabled:opacity-50">
            {saving ? 'Logging...' : 'Log Waste'}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">Logging waste removes it from stock and automatically records its cost as an expense — no separate expense entry needed.</p>
      </div>

      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
          <h3 className="text-sm font-medium text-dg">Today's Waste</h3>
          <span className="text-xs text-gray-500">Total cost: <span className="font-medium text-maroon">{fmt(totalCostToday)}</span></span>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Item</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Qty</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Reason</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Cost</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Logged by</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={5} className="text-center py-8 text-gray-400 text-sm">Loading...</td></tr>
            : entries.length === 0 ? <tr><td colSpan={5} className="text-center py-8 text-gray-400 text-sm">No waste logged today</td></tr>
            : (entries as any[]).map(e => (
              <tr key={e.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2.5 text-dg font-medium">{e.product_name}</td>
                <td className="px-4 py-2.5 text-right">{e.quantity}</td>
                <td className="px-4 py-2.5 capitalize text-gray-600">{e.reason}{e.notes ? ` — ${e.notes}` : ''}</td>
                <td className="px-4 py-2.5 text-right text-maroon">{fmt(e.total_cost)}</td>
                <td className="px-4 py-2.5 text-gray-500 text-xs">{e.user_name} · {new Date(e.created_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}

// ── Reconciliation tab ─────────────────────────────────────────
function ReconciliationTab({ session }) {
  const [date, setDate] = useState(todayString())
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    if (!session) return
    setLoading(true)
    const data = await window.electronAPI.getReconciliation(session.branch_id, date)
    setRows(data)
    setLoading(false)
  }
  useEffect(() => { load() }, [session, date])

  const varianceCount = (rows as any[]).filter(r => r.status === 'variance').length

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none" />
        {varianceCount > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium">
            <i className="ti ti-alert-triangle text-sm" />{varianceCount} item{varianceCount === 1 ? '' : 's'} with unexplained variance
          </div>
        )}
      </div>
      <p className="text-xs text-gray-500">Beginning minus Ending is what actually left the shelf. That's compared automatically against what POS sales plus logged waste say should have left. A non-zero variance means the two don't tally.</p>
      <div className="bg-white rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="border-b border-border bg-surface">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Product</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Beginning</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Ending</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Actual Used</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Sold (POS)</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Waste</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Expected Used</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Variance</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={8} className="text-center py-12 text-gray-400 text-sm">Loading...</td></tr>
            : rows.length === 0 ? <tr><td colSpan={8} className="text-center py-12 text-gray-400 text-sm">No tracked items</td></tr>
            : (rows as any[]).map(r => (
              <tr key={r.product_id} className={`border-b border-border last:border-0 ${r.status === 'variance' ? 'bg-red-50/50' : ''}`}>
                <td className="px-4 py-2.5 font-medium text-dg">{r.product_name}</td>
                <td className="px-4 py-2.5 text-right">{r.start_qty ?? '—'}</td>
                <td className="px-4 py-2.5 text-right">{r.end_qty ?? '—'}</td>
                <td className="px-4 py-2.5 text-right font-medium">{r.actual_used ?? '—'}</td>
                <td className="px-4 py-2.5 text-right text-gray-600">{r.sold_qty}</td>
                <td className="px-4 py-2.5 text-right text-gray-600">{r.wasted_qty}</td>
                <td className="px-4 py-2.5 text-right text-gray-600">{r.expected_used}</td>
                <td className="px-4 py-2.5 text-right">
                  {r.status === 'pending' && <span className="text-xs text-gray-400">Pending counts</span>}
                  {r.status === 'ok' && <span className="text-green-700 font-medium">0</span>}
                  {r.status === 'variance' && <span className="text-red-700 font-medium">{r.variance > 0 ? '+' : ''}{r.variance}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function InventoryScreen() {
  const session = useSessionStore(s => s.session)
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [showLowOnly, setShowLowOnly] = useState(false)
  const [stockModal, setStockModal] = useState<{ product: any; mode: 'in' | 'out' } | null>(null)
  const [movementsModal, setMovementsModal] = useState<any>(null)
  const [tab, setTab] = useState<'products' | 'count' | 'waste' | 'reconciliation'>('products')

  async function loadProducts() {
    if (!session) return
    setLoading(true)
    const all = await window.electronAPI.getProducts(session.branch_id)
    setProducts(all)
    setLoading(false)
  }

  useEffect(() => { loadProducts() }, [session])

  const filtered = (products as any[]).filter(p => {
    if (category !== 'all' && p.category !== category) return false
    if (showLowOnly && p.stock_qty > p.low_stock_threshold) return false
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const lowStockCount = (products as any[]).filter(p => p.track_inventory && p.stock_qty <= p.low_stock_threshold).length

  const TABS = [
    { key: 'products', label: 'Products' },
    { key: 'count', label: 'Daily Count' },
    { key: 'waste', label: 'Waste' },
    { key: 'reconciliation', label: 'Reconciliation' },
  ]

  return (
    <div className="h-full overflow-y-auto bg-cream">
      {stockModal && <StockModal product={stockModal.product} mode={stockModal.mode} onClose={() => setStockModal(null)} onDone={() => { setStockModal(null); loadProducts() }} />}
      {movementsModal && <MovementsModal product={movementsModal} onClose={() => setMovementsModal(null)} />}
      <div className="sticky top-0 bg-cream border-b border-border px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2 z-10">
        <div>
          <h1 className="text-lg font-medium text-dg">Inventory</h1>
          <p className="text-xs text-gray-500 mt-0.5">{products.length} products · {session?.branch_name}</p>
        </div>
        {lowStockCount > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 border border-orange-200 rounded-lg text-xs text-orange-700 font-medium">
            <i className="ti ti-alert-triangle text-sm" />{lowStockCount} low stock {lowStockCount === 1 ? 'item' : 'items'}
          </div>
        )}
      </div>
      <div className="px-6 pt-3">
        <div className="flex gap-1 border-b border-border">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as any)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t.key ? 'border-dg text-dg' : 'border-transparent text-gray-500 hover:text-dg'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="px-6 py-4 space-y-4">
        {tab === 'products' && (
          <>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-48">
                <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                <input type="text" placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-olive" />
              </div>
              <select value={category} onChange={e => setCategory(e.target.value)} className="px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none">
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <button onClick={() => setShowLowOnly(!showLowOnly)} className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-colors ${showLowOnly ? 'bg-orange-50 border-orange-300 text-orange-700' : 'bg-white border-border text-gray-600 hover:bg-surface'}`}>
                <i className="ti ti-alert-triangle text-sm" />Low stock only
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total products', value: products.length, icon: 'ti-box', warn: false },
                { label: 'Tracked items', value: (products as any[]).filter(p => p.track_inventory).length, icon: 'ti-chart-bar', warn: false },
                { label: 'Low stock', value: lowStockCount, icon: 'ti-alert-triangle', warn: lowStockCount > 0 },
                { label: 'Out of stock', value: (products as any[]).filter(p => p.track_inventory && p.stock_qty === 0).length, icon: 'ti-package-off', warn: true },
              ].map(card => (
                <div key={card.label} className={`rounded-xl p-4 border ${card.warn && card.value > 0 ? 'bg-orange-50 border-orange-200' : 'bg-white border-border'}`}>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1"><i className={`ti ${card.icon} text-sm`} />{card.label}</div>
                  <div className={`text-2xl font-medium ${card.warn && card.value > 0 ? 'text-orange-700' : 'text-dg'}`}>{card.value}</div>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-xl border border-border overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b border-border bg-surface">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Product</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Category</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Price</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Stock</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-gray-500">Status</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? <tr><td colSpan={6} className="text-center py-12 text-gray-400 text-sm">Loading...</td></tr>
                  : filtered.length === 0 ? <tr><td colSpan={6} className="text-center py-12 text-gray-400 text-sm">No products found</td></tr>
                  : filtered.map((p: any) => (
                    <tr key={p.id} className="border-b border-border last:border-0 hover:bg-surface/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-dg text-sm">{p.name}</div>
                        {p.sku && <div className="text-xs text-gray-400 mt-0.5">SKU: {p.sku}</div>}
                      </td>
                      <td className="px-4 py-3"><span className="text-xs capitalize text-gray-600">{p.category?.replace('_', ' ')}</span></td>
                      <td className="px-4 py-3 text-right font-medium text-dg">{fmt(p.price)}</td>
                      <td className="px-4 py-3 text-right">
                        {p.track_inventory ? <span className={`font-medium ${p.stock_qty === 0 ? 'text-red-600' : p.stock_qty <= p.low_stock_threshold ? 'text-orange-600' : 'text-dg'}`}>{p.stock_qty}</span>
                        : <span className="text-gray-400 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {p.track_inventory ? <StockBadge qty={p.stock_qty} threshold={p.low_stock_threshold} />
                        : <span className="text-xs text-gray-400">Not tracked</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {p.track_inventory && (
                            <>
                              <button onClick={() => setStockModal({ product: p, mode: 'in' })} className="px-2 py-1 rounded-md text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100">+ In</button>
                              <button onClick={() => setStockModal({ product: p, mode: 'out' })} className="px-2 py-1 rounded-md text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100">− Out</button>
                            </>
                          )}
                          <button onClick={() => setMovementsModal(p)} className="px-2 py-1 rounded-md text-xs text-gray-500 hover:bg-surface"><i className="ti ti-history" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {tab === 'count' && <DailyCountTab products={products} session={session} />}
        {tab === 'waste' && <WasteTab products={products} session={session} />}
        {tab === 'reconciliation' && <ReconciliationTab session={session} />}
      </div>
    </div>
  )
}
