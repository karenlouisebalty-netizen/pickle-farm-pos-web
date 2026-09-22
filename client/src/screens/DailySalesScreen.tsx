import { useState, useEffect, useCallback } from 'react'
import { useSessionStore } from '../stores/sessionStore'
import { formatPeso } from '../shared/utils'

// Staff-facing view of today's sales — so a cashier can check the cash in the drawer
// against what the system says came in. Deliberately fixed to today only: no date
// picker, no week/month/custom range. Owner/manager get the full Reports screen
// (with history, CSV export, and void) elsewhere; this is just "did I collect the
// right amount today."
function MetricCard({ label, value, sub, icon, accent }: { label: string; value: string; sub?: string; icon: string; accent?: boolean }) {
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

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })
}

export function DailySalesScreen() {
  const session = useSessionStore(s => s.session)
  const [summary, setSummary] = useState<any>(null)
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null)
  const [markingPaid, setMarkingPaid] = useState<string | null>(null)
  const [startingCashInput, setStartingCashInput] = useState('')
  const [editingStartingCash, setEditingStartingCash] = useState(false)
  const [savingStartingCash, setSavingStartingCash] = useState(false)

  const today = new Date().toISOString().slice(0, 10)

  const load = useCallback(async (showSpinner: boolean) => {
    if (!session) return
    if (showSpinner) setLoading(true)
    try {
      const [sum, txns] = await Promise.all([
        window.electronAPI.getTodaySummary(session.branch_id),
        window.electronAPI.listTransactions(session.branch_id, today),
      ])
      setSummary(sum)
      // Only completed sales — voided/refunded ones don't count toward "what I collected",
      // and showing them here would make the list not add up to the totals above.
      setTransactions((txns || []).filter((t: any) => t.status === 'completed'))
      setLastLoadedAt(new Date())
      // Don't stomp on whatever the cashier is mid-typing during the 60s auto-refresh.
      setStartingCashInput(prev => (editingStartingCash ? prev : String(sum?.starting_cash ?? 0)))
    } finally {
      if (showSpinner) setLoading(false)
    }
  }, [session, today, editingStartingCash])

  useEffect(() => { load(true) }, [load])

  // Keep it current through a shift without staff having to think about refreshing.
  useEffect(() => {
    const id = setInterval(() => load(false), 60000)
    return () => clearInterval(id)
  }, [load])

  async function handleSaveStartingCash() {
    if (!session) return
    const parsed = Number(startingCashInput)
    if (!Number.isFinite(parsed) || parsed < 0) return
    setSavingStartingCash(true)
    try {
      await window.electronAPI.setStartingCash(session.branch_id, today, parsed, session.user_id)
      setEditingStartingCash(false)
      await load(false)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to save starting cash')
    } finally {
      setSavingStartingCash(false)
    }
  }

  async function handleMarkPaid(txnId: string) {
    setMarkingPaid(txnId)
    try {
      await window.electronAPI.markTransactionPaid(txnId)
      await load(false)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to mark as paid')
    } finally {
      setMarkingPaid(null)
    }
  }

  const fmt = (n: number) => formatPeso(n || 0)
  const cashTotal = summary?.payment_breakdown?.cash || 0

  if (loading) return (
    <div className="h-full flex items-center justify-center text-gray-400">
      <div className="text-center">
        <i className="ti ti-loader-2 text-4xl opacity-30 block mb-2" />
        <p className="text-sm">Loading today's sales...</p>
      </div>
    </div>
  )

  return (
    <div className="h-full overflow-y-auto bg-cream">
      <div className="sticky top-0 bg-cream border-b border-border px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2 z-10">
        <div>
          <h1 className="text-lg font-medium text-dg">Daily Sales</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} · {session?.branch_name}
          </p>
        </div>
        <button
          onClick={() => load(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-white text-xs font-medium text-gray-600 hover:bg-surface transition-colors"
        >
          <i className="ti ti-refresh text-sm" /> Refresh
        </button>
      </div>

      <div className="p-4 sm:p-6 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard accent icon="ti-currency-peso" label="Total Sales Today" value={fmt(summary?.total_revenue)} sub={`${summary?.transaction_count || 0} transactions`} />
          <MetricCard icon="ti-cash" label="Cash Sales" value={fmt(cashTotal)} sub="Net of change given" />
          <MetricCard icon="ti-clock" label="Outstanding (Unpaid)" value={fmt(summary?.outstanding_total)} sub={(summary?.outstanding_total || 0) > 0 ? 'Still owed to you' : 'All settled'} />
          <MetricCard icon="ti-tag" label="Discounts Given" value={fmt(summary?.discount_total)} sub="Today" />
        </div>

        {/* Cash drawer — starting float + today's net cash sales = what should be counted at close */}
        <div className="bg-white rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-dg">Cash Drawer</span>
            {!editingStartingCash && (
              <button
                onClick={() => setEditingStartingCash(true)}
                className="text-xs font-medium text-olive hover:opacity-80"
              >
                {summary?.starting_cash > 0 ? 'Edit starting cash' : 'Set starting cash'}
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <div className="text-xs text-gray-500 mb-1">Starting cash (float)</div>
              {editingStartingCash ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-sm text-gray-400">₱</span>
                  <input
                    type="number"
                    min={0}
                    step="1"
                    autoFocus
                    value={startingCashInput}
                    onChange={e => setStartingCashInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSaveStartingCash()}
                    className="w-28 border border-border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-olive"
                  />
                  <button
                    onClick={handleSaveStartingCash}
                    disabled={savingStartingCash}
                    className="text-xs font-medium text-white bg-dg rounded-lg px-2.5 py-1.5 disabled:opacity-50"
                  >
                    {savingStartingCash ? '...' : 'Save'}
                  </button>
                </div>
              ) : (
                <div className="text-lg font-medium text-dg">{fmt(summary?.starting_cash)}</div>
              )}
              <div className="text-xs text-gray-400 mt-0.5">What was in the drawer at the start of today</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">+ Net cash sales</div>
              <div className="text-lg font-medium text-dg">{fmt(cashTotal)}</div>
              <div className="text-xs text-gray-400 mt-0.5">Cash tendered minus change given</div>
            </div>
            <div className="bg-surface rounded-lg p-2.5 -m-0.5">
              <div className="text-xs text-gray-500 mb-1">= Expected in drawer</div>
              <div className="text-lg font-semibold text-dg">{fmt(summary?.expected_cash_total)}</div>
              <div className="text-xs text-gray-400 mt-0.5">Count your drawer against this</div>
            </div>
          </div>
        </div>

        {summary && summary.collected_total > 0 && (
          <div className="bg-white rounded-xl border border-border p-4">
            <div className="text-sm font-medium text-dg mb-3">Payment breakdown <span className="text-xs font-normal text-gray-400">(collected only)</span></div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {Object.entries(summary.payment_breakdown).filter(([, v]: any) => v > 0).map(([method, amt]: any) => (
                <div key={method} className="text-center">
                  <div className="text-sm font-medium text-dg">{fmt(amt)}</div>
                  <div className="text-xs text-gray-400 capitalize mt-0.5">{method.replace('_', ' ')}</div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-surface overflow-hidden">
                    <div className="h-full rounded-full bg-olive" style={{ width: `${Math.round((amt / summary.collected_total) * 100)}%` }} />
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">{Math.round((amt / summary.collected_total) * 100)}%</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <span className="text-sm font-medium text-dg">Today's Transactions ({transactions.length})</span>
          </div>
          {transactions.length === 0 ? (
            <div className="text-center py-12">
              <i className="ti ti-receipt-off text-3xl text-gray-300" />
              <p className="text-sm text-gray-400 mt-2">No sales yet today</p>
            </div>
          ) : (
            <div>
              {transactions.map(t => (
                <div key={t.id} className="px-4 py-3 flex items-center gap-3 border-b border-border last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">{fmtTime(t.created_at)}</span>
                      {t.customer_name && <span className="text-xs bg-surface px-1.5 py-0.5 rounded text-gray-600">{t.customer_name}</span>}
                      {t.payment_status === 'unpaid' && <span className="text-[10px] font-medium bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">UNPAID</span>}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5 truncate">{(t.items || []).slice(0, 3).map((i: any) => i.item_name).join(', ')}{(t.items || []).length > 3 ? '...' : ''}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-medium text-dg">{fmt(t.total)}</div>
                    <div className="text-xs text-gray-400 capitalize">{t.payments?.[0]?.payment_method || 'cash'}</div>
                  </div>
                  {t.payment_status === 'unpaid' && (
                    <button
                      onClick={() => handleMarkPaid(t.id)}
                      disabled={markingPaid === t.id}
                      className="flex-shrink-0 text-xs font-medium text-green-700 border border-green-300 rounded-lg px-2.5 py-1.5 hover:bg-green-50 transition-colors disabled:opacity-50"
                    >
                      {markingPaid === t.id ? '...' : 'Mark Paid'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {lastLoadedAt && (
          <p className="text-[11px] text-gray-400 text-center">Last updated {lastLoadedAt.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })} · refreshes automatically</p>
        )}
      </div>
    </div>
  )
}
