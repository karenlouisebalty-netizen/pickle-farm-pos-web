import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSessionStore } from '../stores/sessionStore'

function MetricCard({ label, value, sub, icon, accent }) {
  return (
    <div className={`rounded-xl p-4 border ${accent ? 'bg-dg border-dg' : 'bg-white border-border'}`}>
      <div className={`flex items-center gap-1.5 text-xs mb-2 ${accent ? 'text-white/60' : 'text-gray-500'}`}>
        <i className={`ti ${icon} text-sm`} />
        {label}
      </div>
      <div className={`text-2xl font-medium ${accent ? 'text-white' : 'text-dg'}`}>{value}</div>
      {sub && <div className={`text-xs mt-1 ${accent ? 'text-white/50' : 'text-gray-400'}`}>{sub}</div>}
    </div>
  )
}

export function DashboardScreen() {
  const navigate = useNavigate()
  const session = useSessionStore(s => s.session)
  const [summary, setSummary] = useState(null)
  const [lowStock, setLowStock] = useState([])
  const [recentTxns, setRecentTxns] = useState([])
  const [expenses, setExpenses] = useState([])
  const [expenseSummary, setExpenseSummary] = useState<{total:number,byCategory:any[]}>({total:0,byCategory:[]})
  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [expenseForm, setExpenseForm] = useState({amount:'',category:'rent',description:'',expense_date:new Date().toISOString().slice(0,10)})
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<'today'|'week'|'month'|'custom'>('today')
  const [customFrom, setCustomFrom] = useState(new Date().toISOString().slice(0,10))
  const [customTo, setCustomTo] = useState(new Date().toISOString().slice(0,10))

  const today = new Date().toISOString().slice(0, 10)

  function getDateFrom(r: 'today'|'week'|'month'|'custom') {
    if (r === 'custom') return customFrom
    const d = new Date()
    if (r === 'week') d.setDate(d.getDate() - 6)
    if (r === 'month') d.setDate(d.getDate() - 29)
    return d.toISOString().slice(0, 10)
  }

  function getDateTo(r: 'today'|'week'|'month'|'custom') {
    if (r === 'custom') return customTo
    return today
  }

  useEffect(() => {
    if (!session) return
    if (range === 'custom' && (!customFrom || !customTo)) return
    setLoading(true)
    const dateFrom = getDateFrom(range)
    const dateTo = getDateTo(range)
    Promise.all([
      window.electronAPI.getDailySummary(session.branch_id, dateFrom, dateTo),
      window.electronAPI.getLowStock(session.branch_id),
      window.electronAPI.listTransactions(session.branch_id, dateFrom, dateTo),
      window.electronAPI.listExpenses(session.branch_id, dateFrom, dateTo),
      window.electronAPI.expenseSummary(session.branch_id, dateFrom, dateTo),
    ]).then(([sum, stock, txns, exps, expSum]) => {
      setSummary(sum)
      setLowStock(stock)
      setRecentTxns(txns.slice(0, 5))
      setExpenses(exps)
      setExpenseSummary(expSum)
    }).finally(() => setLoading(false))
  }, [session, range, customFrom, customTo])

  const fmt = (n) => "₱" + (n || 0).toLocaleString("en-PH", {minimumFractionDigits:2})
  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"

  const rangeLabel = range === 'today' ? 'today'
    : range === 'week' ? 'last 7 days'
    : range === 'month' ? 'last 30 days'
    : `${customFrom} to ${customTo}`


  const EXPENSE_CATEGORIES = ['rent','utilities','supplies','salaries','maintenance','food','other']

  async function handleAddExpense() {
    if (!expenseForm.amount || !session) return
    await window.electronAPI.createExpense({
      branch_id: session.branch_id,
      amount: parseFloat(expenseForm.amount),
      category: expenseForm.category,
      description: expenseForm.description,
      expense_date: expenseForm.expense_date,
      created_by: session.user_id,
    })
    setExpenseForm({amount:'',category:'rent',description:'',expense_date:new Date().toISOString().slice(0,10)})
    setShowExpenseModal(false)
    const dateFrom = getDateFrom(range)
    const dateTo = getDateTo(range)
    const [exps, expSum] = await Promise.all([
      window.electronAPI.listExpenses(session.branch_id, dateFrom, dateTo),
      window.electronAPI.expenseSummary(session.branch_id, dateFrom, dateTo),
    ])
    setExpenses(exps)
    setExpenseSummary(expSum)
  }

  async function handleDeleteExpense(id: string) {
    await window.electronAPI.deleteExpense(id)
    const dateFrom = getDateFrom(range)
    const dateTo = getDateTo(range)
    const [exps, expSum] = await Promise.all([
      window.electronAPI.listExpenses(session.branch_id, dateFrom, dateTo),
      window.electronAPI.expenseSummary(session.branch_id, dateFrom, dateTo),
    ])
    setExpenses(exps)
    setExpenseSummary(expSum)
  }

  if (loading) return (
    <div className="h-full flex items-center justify-center text-gray-400">
      <div className="text-center">
        <i className="ti ti-loader-2 text-4xl opacity-30 block mb-2" />
        <p className="text-sm">Loading dashboard...</p>
      </div>
    </div>
  )

  return (
    <div className="h-full overflow-y-auto bg-cream">
      <div className="sticky top-0 bg-cream border-b border-border px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-medium text-dg">{greeting}, {session?.full_name}</h1>
          <p className="text-xs text-gray-500 mt-0.5">{new Date().toLocaleDateString("en-PH", {weekday:"long",year:"numeric",month:"long",day:"numeric"})} · {session?.branch_name}</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-border overflow-hidden text-xs">
              {(['today','week','month','custom'] as const).map(r => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-3 py-1.5 font-medium transition-colors ${range===r ? 'bg-dg text-white' : 'bg-white text-gray-500 hover:bg-surface'}`}
                >
                  {r === 'today' ? 'Today' : r === 'week' ? 'This Week' : r === 'month' ? 'This Month' : 'Custom'}
                </button>
              ))}
            </div>
            {range === 'custom' && (
              <div className="flex items-center gap-1.5 text-xs">
                <input
                  type="date"
                  value={customFrom}
                  max={customTo}
                  onChange={e => setCustomFrom(e.target.value)}
                  className="px-2 py-1.5 rounded-lg border border-border bg-white text-gray-700 outline-none focus:border-olive"
                />
                <span className="text-gray-400">to</span>
                <input
                  type="date"
                  value={customTo}
                  min={customFrom}
                  max={new Date().toISOString().slice(0,10)}
                  onChange={e => setCustomTo(e.target.value)}
                  className="px-2 py-1.5 rounded-lg border border-border bg-white text-gray-700 outline-none focus:border-olive"
                />
              </div>
            )}
          </div>
          <button onClick={() => navigate("/pos")} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-dg text-white text-xs font-medium hover:bg-dg-light">
            <i className="ti ti-plus text-sm" /> New Sale
          </button>
        </div>
      </div>
      <div className="p-4 sm:p-6 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
          <MetricCard accent icon="ti-currency-peso" label={`Total Sales (${rangeLabel})`} value={fmt(summary?.total_revenue)} sub={`${summary?.transaction_count || 0} transactions`} />
          <MetricCard icon="ti-cash" label="Collected" value={fmt(summary?.collected_total)} sub="Actual money in" />
          <MetricCard icon="ti-clock" label="Outstanding" value={fmt(summary?.outstanding_total)} sub={(summary?.outstanding_total||0) > 0 ? "Still owed to you" : "All settled"} />
          <MetricCard icon="ti-receipt" label="Transactions" value={String(summary?.transaction_count || 0)} sub={`Completed ${rangeLabel}`} />
          <MetricCard icon="ti-run" label="Open play" value={String(summary?.open_play_count || 0)} sub={`Players ${rangeLabel}`} />
          <MetricCard icon="ti-tournament" label="Court rentals" value={String(summary?.court_rental_count || 0)} sub={`Bookings ${rangeLabel}`} />
          <MetricCard icon="ti-alert-triangle" label="Low stock alerts" value={String(lowStock.length)} sub={lowStock.length > 0 ? "Items need restock" : "All good"} />
          <MetricCard icon="ti-tag" label="Discounts" value={fmt(summary?.discount_total)} sub={`Given ${rangeLabel}`} />
          <MetricCard icon="ti-trending-down" label="Total expenses" value={fmt(expenseSummary.total)} sub={`${rangeLabel}`} />
          <MetricCard accent icon="ti-coin" label="Net profit" value={fmt((summary?.collected_total||0) - expenseSummary.total)} sub={`Collected minus expenses`} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-dg">Recent transactions</span>
              <button onClick={() => navigate("/pos")} className="text-xs text-olive hover:underline">New sale</button>
            </div>
            {recentTxns.length > 0 ? recentTxns.map(txn => (
              <div key={txn.id} className="flex items-center gap-2 py-2 border-b border-border last:border-0">
                <span className="text-xs font-mono text-gray-400 w-16">{txn.receipt_number}</span>
                <span className="flex-1 text-xs text-gray-700 truncate">{txn.items?.map(i => i.item_name).slice(0,2).join(", ")}</span>
                {txn.payment_status === 'unpaid' && <span className="text-[10px] font-medium bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">UNPAID</span>}
                {txn.is_backdated && <span className="text-[10px] font-medium bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">logged</span>}
                {txn.is_advance_payment && <span className="text-[10px] font-medium bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">advance</span>}
                <span className="text-xs font-medium text-dg">{fmt(txn.total)}</span>
              </div>
            )) : (
              <div className="text-center py-8 text-gray-400">
                <i className="ti ti-receipt-off text-3xl opacity-20 block mb-2" />
                <p className="text-xs">No sales {rangeLabel}</p>
                <button onClick={() => navigate("/pos")} className="mt-2 text-xs text-olive hover:underline">Start a sale →</button>
              </div>
            )}
          </div>
          <div className="bg-white rounded-xl border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-maroon flex items-center gap-1"><i className="ti ti-alert-triangle" />Inventory alerts</span>
              <button onClick={() => navigate("/inventory")} className="text-xs text-olive hover:underline">Manage</button>
            </div>
            {lowStock.length > 0 ? lowStock.slice(0,5).map(p => (
              <div key={p.id} className="flex items-center gap-2 py-2 border-b border-border last:border-0">
                <div className="w-6 h-6 rounded bg-orange-50 flex items-center justify-center flex-shrink-0">
                  <i className="ti ti-alert-triangle text-orange-500 text-xs" />
                </div>
                <span className="flex-1 text-xs text-gray-800">{p.name}</span>
                <span className="text-xs font-medium text-red-600">{p.stock_qty} left</span>
              </div>
            )) : (
              <div className="text-center py-8 text-gray-400">
                <i className="ti ti-circle-check text-3xl text-green-500 opacity-60 block mb-2" />
                <p className="text-xs">All stock levels OK</p>
              </div>
            )}
          </div>
        </div>
        {/* Expenses Section */}
        <div className="bg-white rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-dg">Expenses</span>
            <button onClick={() => setShowExpenseModal(true)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-dg text-white text-xs font-medium">
              <i className="ti ti-plus text-sm" /> Add Expense
            </button>
          </div>
          {expenseSummary.byCategory.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              {expenseSummary.byCategory.map((c:any) => (
                <div key={c.category} className="bg-surface rounded-lg p-2 text-center">
                  <div className="text-xs font-medium text-dg">{fmt(c.total)}</div>
                  <div className="text-xs text-gray-400 capitalize mt-0.5">{c.category}</div>
                </div>
              ))}
            </div>
          )}
          {(expenses as any[]).length === 0 ? (
            <div className="text-center py-6 text-gray-400 text-xs">No expenses recorded {rangeLabel}</div>
          ) : (
            <div className="space-y-1">
              {(expenses as any[]).slice(0,8).map((e:any) => (
                <div key={e.id} className="flex items-center gap-2 py-1.5 border-b border-border last:border-0">
                  <span className="text-xs capitalize text-gray-500 w-20">{e.category}</span>
                  <span className="flex-1 text-xs text-gray-700 truncate">{e.description || '—'}</span>
                  <span className="text-xs text-gray-400">{e.expense_date}</span>
                  <span className="text-xs font-medium text-maroon">{fmt(e.amount)}</span>
                  <button onClick={() => handleDeleteExpense(e.id)} className="text-gray-300 hover:text-red-500 text-xs"><i className="ti ti-trash" /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Expense Modal */}
        {showExpenseModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-medium text-dg">Add Expense</h2>
                <button onClick={() => setShowExpenseModal(false)} className="text-gray-400"><i className="ti ti-x" /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Amount</label>
                  <input type="number" min={0} step="0.01" value={expenseForm.amount}
                    onChange={e => setExpenseForm(f => ({...f, amount: e.target.value}))}
                    placeholder="0.00" className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-olive" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Category</label>
                  <select value={expenseForm.category} onChange={e => setExpenseForm(f => ({...f, category: e.target.value}))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none">
                    {EXPENSE_CATEGORIES.map(cat => <option key={cat} value={cat} className="capitalize">{cat}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Description</label>
                  <input type="text" value={expenseForm.description}
                    onChange={e => setExpenseForm(f => ({...f, description: e.target.value}))}
                    placeholder="e.g. Monthly rent" className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-olive" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Date</label>
                  <input type="date" value={expenseForm.expense_date}
                    onChange={e => setExpenseForm(f => ({...f, expense_date: e.target.value}))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={() => setShowExpenseModal(false)} className="flex-1 px-4 py-2 rounded-lg border border-border text-sm text-gray-600">Cancel</button>
                <button onClick={handleAddExpense} disabled={!expenseForm.amount}
                  className="flex-1 px-4 py-2 rounded-lg bg-dg text-white text-sm font-medium disabled:opacity-50">Save</button>
              </div>
            </div>
          </div>
        )}

        {summary && summary.collected_total > 0 && (
          <div className="bg-white rounded-xl border border-border p-4">
            <div className="text-sm font-medium text-dg mb-3">Payment breakdown <span className="text-xs font-normal text-gray-400">(collected only — excludes unpaid sales)</span></div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {Object.entries(summary.payment_breakdown).filter(([,v]) => v > 0).map(([method, amt]) => (
                <div key={method} className="text-center">
                  <div className="text-sm font-medium text-dg">{fmt(amt)}</div>
                  <div className="text-xs text-gray-400 capitalize mt-0.5">{method.replace("_"," ")}</div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-surface overflow-hidden">
                    <div className="h-full rounded-full bg-olive" style={{width:`${Math.round(amt/summary.collected_total*100)}%`}} />
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">{Math.round(amt/summary.collected_total*100)}%</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
