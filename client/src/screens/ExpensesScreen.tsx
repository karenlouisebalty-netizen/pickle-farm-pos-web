import { useState, useEffect } from 'react'
import { useSessionStore } from '../stores/sessionStore'
import { formatPeso, todayString } from '../shared/utils'
import { EXPENSE_CATEGORIES } from '../shared/constants'

const CATEGORY_META: Record<string, { label: string; color: string }> = {
  rent:        { label: 'Rent',        color: 'bg-blue-50 text-blue-700 border-blue-200' },
  utilities:   { label: 'Utilities',   color: 'bg-purple-50 text-purple-700 border-purple-200' },
  supplies:    { label: 'Supplies',    color: 'bg-teal-50 text-teal-700 border-teal-200' },
  salaries:    { label: 'Salaries',    color: 'bg-red-50 text-red-700 border-red-200' },
  maintenance: { label: 'Maintenance', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  food:        { label: 'Food',        color: 'bg-green-50 text-green-700 border-green-200' },
  other:       { label: 'Other',       color: 'bg-gray-100 text-gray-600 border-gray-200' },
}

function CategoryBadge({ category }: { category: string }) {
  const meta = CATEGORY_META[category] || CATEGORY_META.other
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${meta.color}`}>{meta.label}</span>
}

function firstOfMonth(): string {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

function AddExpenseModal({ branchId, createdBy, onClose, onDone }: { branchId: string; createdBy?: string; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<string>('supplies')
  const [description, setDescription] = useState('')
  const [expenseDate, setExpenseDate] = useState(todayString())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) { setError('Enter a valid amount'); return }
    if (!expenseDate) { setError('Pick a date'); return }
    setLoading(true)
    setError('')
    try {
      await window.electronAPI.createExpense({
        branch_id: branchId,
        amount: amt,
        category,
        description: description.trim() || undefined,
        expense_date: expenseDate,
        created_by: createdBy,
      })
      onDone()
    } catch (e: any) {
      setError(e?.message || 'Could not save expense')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-medium text-dg">Add Expense</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><i className="ti ti-x" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Amount</label>
            <input type="number" min={0} step="0.01" autoFocus value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-olive" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-olive bg-white">
              {EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Date</label>
            <input type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-olive" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Description (optional)</label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Water bill for August"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-olive" />
          </div>
          {error && <div className="text-xs text-red-600">{error}</div>}
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-border text-sm text-gray-600 hover:bg-surface">Cancel</button>
          <button onClick={handleSubmit} disabled={loading} className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white bg-dg hover:bg-dg-light disabled:opacity-50">
            {loading ? 'Saving...' : 'Add Expense'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function ExpensesScreen() {
  const session = useSessionStore(s => s.session)
  const [dateFrom, setDateFrom] = useState(firstOfMonth())
  const [dateTo, setDateTo] = useState(todayString())
  const [expenses, setExpenses] = useState<any[]>([])
  const [summary, setSummary] = useState<{ total: number; byCategory: { category: string; total: number }[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)

  async function load() {
    if (!session) return
    setLoading(true)
    try {
      const [list, sum] = await Promise.all([
        window.electronAPI.listExpenses(session.branch_id, dateFrom, dateTo),
        window.electronAPI.expenseSummary(session.branch_id, dateFrom, dateTo),
      ])
      setExpenses(list || [])
      setSummary(sum)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [session, dateFrom, dateTo])

  function resetToThisMonth() {
    setDateFrom(firstOfMonth())
    setDateTo(todayString())
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this expense? This cannot be undone.')) return
    await window.electronAPI.deleteExpense(id)
    load()
  }

  return (
    <div className="h-full overflow-y-auto bg-cream">
      {showAdd && session && (
        <AddExpenseModal
          branchId={session.branch_id}
          createdBy={session.user_id}
          onClose={() => setShowAdd(false)}
          onDone={() => { setShowAdd(false); load() }}
        />
      )}

      <div className="sticky top-0 bg-cream border-b border-border px-6 py-3 flex items-center justify-between z-10">
        <div>
          <h1 className="text-lg font-medium text-dg">Expenses</h1>
          <p className="text-xs text-gray-500 mt-0.5">{expenses.length} entries · {session?.branch_name}</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-dg text-white text-xs font-medium hover:bg-dg-light">
          <i className="ti ti-plus text-sm" />Add Expense
        </button>
      </div>

      <div className="px-6 py-4 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">From</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="px-3 py-1.5 rounded-lg border border-border text-sm bg-white outline-none" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">To</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="px-3 py-1.5 rounded-lg border border-border text-sm bg-white outline-none" />
          </div>
          <button onClick={resetToThisMonth} className="px-3 py-1.5 rounded-lg border border-border bg-white text-xs text-gray-600 hover:bg-surface">This month</button>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <div className="rounded-xl p-4 border bg-white border-border col-span-1">
            <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1"><i className="ti ti-receipt-2 text-sm" />Total expenses</div>
            <div className="text-2xl font-medium text-dg">{formatPeso(summary?.total || 0)}</div>
          </div>
          <div className="rounded-xl p-4 border bg-white border-border col-span-3">
            <div className="text-xs text-gray-500 mb-2">By category</div>
            {(!summary || summary.byCategory.length === 0) ? (
              <div className="text-xs text-gray-400">No expenses in this range</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {summary.byCategory.map(c => (
                  <div key={c.category} className="flex items-center gap-1.5">
                    <CategoryBadge category={c.category} />
                    <span className="text-xs font-medium text-dg">{formatPeso(c.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Date</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Category</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Description</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Added by</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Amount</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={6} className="text-center py-12 text-gray-400 text-sm">Loading...</td></tr>
              : expenses.length === 0 ? <tr><td colSpan={6} className="text-center py-12 text-gray-400 text-sm">No expenses in this range</td></tr>
              : expenses.map((e: any) => (
                <tr key={e.id} className="border-b border-border last:border-0 hover:bg-surface/50 transition-colors">
                  <td className="px-4 py-3 text-dg">{new Date(e.expense_date + 'T00:00:00').toLocaleDateString('en-PH')}</td>
                  <td className="px-4 py-3"><CategoryBadge category={e.category} /></td>
                  <td className="px-4 py-3 text-gray-600">{e.description || <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{e.created_by_name || '—'}</td>
                  <td className="px-4 py-3 text-right font-medium text-dg">{formatPeso(e.amount)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end">
                      <button onClick={() => handleDelete(e.id)} className="px-2 py-1 rounded-md text-xs text-red-500 hover:bg-red-50"><i className="ti ti-trash" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
