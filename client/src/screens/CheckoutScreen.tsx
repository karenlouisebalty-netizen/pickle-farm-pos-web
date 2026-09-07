import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCartStore } from '../stores/cartStore'
import { useSessionStore } from '../stores/sessionStore'
import { formatPeso } from '../shared/utils'
import { PAYMENT_METHODS } from '../shared/constants'
import type { PaymentMethod, CheckoutPayload } from '../shared/types'

export function CheckoutScreen() {
  const navigate = useNavigate()
  const session = useSessionStore(s => s.session)
  const { items, discount, total, subtotal, discountAmount, clearCart } = useCartStore()
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [entered, setEntered] = useState('')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')

  const totalDue = total()
  const tendered = parseInt(entered || '0', 10)
  const change = tendered - totalDue

  function press(key: string) {
    if (key === 'del') { setEntered(e => e.slice(0, -1)); return }
    if (entered.length >= 7) return
    setEntered(e => e + key)
  }

  async function handleConfirm() {
    if (!session) return
    if (method === 'cash' && tendered < totalDue) return
    setProcessing(true)
    setError('')

    try {
      const payload: CheckoutPayload = {
        branch_id:   session.branch_id,
        cashier_id:  session.user_id,
        items:       items.map(({ product_id, item_name, unit_price, quantity, discount: d, notes }) =>
                       ({ product_id, item_name, unit_price, quantity, discount: d, notes })),
        payments:    [{ payment_method: method, amount: method === 'cash' ? tendered : totalDue, change_given: method === 'cash' ? change : 0 }],
        discount:    { type: 'fixed', value: discountAmount(), reason: discount.reason },
      }

      const txn = await window.electronAPI.checkout(payload)
      // Create reservations for any court rental items
      const courtItems=payload.items.filter(i=>i.notes&&i.notes.startsWith('{"court"'))
      for(const item of courtItems){
        try{
          const b=JSON.parse(item.notes)
          await window.electronAPI.createReservation({
            branch_id:session.branch_id,
            court_name:b.court,
            reservation_date:b.date,
            start_time:b.startTime,
            end_time:b.endTime,
            booker_name:payload.customer_name||'Walk-in',
            status:'confirmed',
            deposit_amount:0,
            is_recurring:false,
            transaction_id:txn.id,
          })
        }catch(e){console.error('Reservation creation failed',e)}
      }
      clearCart()
      navigate('/receipt', { state: { txn } })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Checkout failed')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="h-full bg-cream flex flex-col">
      {/* Header */}
      <div className="h-11 bg-dg flex items-center gap-3 px-4 flex-shrink-0">
        <button onClick={() => navigate('/pos')} className="text-white/60 hover:text-white">
          <i className="ti ti-arrow-left text-lg" />
        </button>
        <span className="text-sm font-medium text-white">Checkout</span>
        <span className="text-xs text-white/40">{session?.full_name}</span>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left: order summary */}
        <div className="flex-1 p-4 overflow-y-auto border-r border-border">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Order Summary</p>

          {items.map(item => (
            <div key={item.product_id} className="flex justify-between text-sm py-1.5 border-b border-border last:border-0">
              <span className="text-gray-700">{item.item_name} {item.quantity > 1 && <span className="text-gray-400">×{item.quantity}</span>}</span>
              <span className="font-medium text-dg">{formatPeso(item.line_total)}</span>
            </div>
          ))}

          {/* Totals */}
          <div className="mt-4 bg-surface rounded-lg p-3 space-y-1.5">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Subtotal</span><span>{formatPeso(subtotal())}</span>
            </div>
            {discountAmount() > 0 && (
              <div className="flex justify-between text-sm text-maroon">
                <span>{discount.reason || 'Discount'}</span>
                <span>-{formatPeso(discountAmount())}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-semibold text-dg pt-1.5 border-t border-border">
              <span>Total Due</span><span>{formatPeso(totalDue)}</span>
            </div>
          </div>

          {/* Payment method */}
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mt-4 mb-2">Payment Method</p>
          <div className="grid grid-cols-2 gap-2">
            {PAYMENT_METHODS.map(m => (
              <button
                key={m.value}
                onClick={() => setMethod(m.value as PaymentMethod)}
                className={`p-2.5 rounded-lg border text-xs font-medium text-center transition-all ${method === m.value ? 'border-dg bg-green-50 text-dg' : 'border-border text-gray-500 hover:border-olive'}`}
              >
                <i className={`ti ${m.icon} text-lg block mb-1`} />
                {m.label}
              </button>
            ))}
          </div>

          {error && (
            <div className="mt-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg p-2">{error}</div>
          )}
        </div>

        {/* Right: numpad (only for cash) */}
        <div className="w-56 p-4 flex flex-col bg-white">
          {method === 'cash' ? (
            <>
              <p className="text-xs text-gray-500 mb-1.5">Amount tendered</p>
              <div className="bg-surface rounded-lg px-3 py-2 text-2xl font-medium text-dg text-right mb-3 border border-border min-h-[48px]">
                {tendered > 0 ? formatPeso(tendered) : <span className="text-gray-300">₱0</span>}
              </div>

              {/* Numpad */}
              <div className="grid grid-cols-3 gap-1.5 mb-2">
                {['1','2','3','4','5','6','7','8','9'].map(k => (
                  <button key={k} onClick={() => press(k)}
                    className="h-11 rounded-lg bg-surface border border-border text-dg font-semibold hover:bg-cream active:scale-95 transition-transform">
                    {k}
                  </button>
                ))}
                <button onClick={() => press('del')} className="h-11 rounded-lg bg-surface border border-border text-maroon hover:bg-red-50 active:scale-95">
                  <i className="ti ti-backspace text-base" />
                </button>
                <button onClick={() => press('0')} className="h-11 rounded-lg bg-surface border border-border text-dg font-semibold hover:bg-cream active:scale-95">0</button>
                <button onClick={() => setEntered(String(totalDue))} className="h-11 rounded-lg bg-surface border border-border text-xs text-dg font-medium hover:bg-cream">Exact</button>
              </div>

              {/* Quick cash buttons */}
              <div className="grid grid-cols-3 gap-1.5 mb-3">
                {[500, 1000, 2000].map(v => (
                  <button key={v} onClick={() => setEntered(String(v))}
                    className="h-9 rounded-lg bg-surface border border-border text-xs text-dg font-medium hover:bg-cream">
                    ₱{v.toLocaleString()}
                  </button>
                ))}
              </div>

              {/* Change */}
              <div className="bg-dg rounded-lg px-3 py-2.5 flex justify-between items-center mb-3">
                <span className="text-xs text-white/60">Change</span>
                <span className="text-lg font-semibold text-white">{change >= 0 ? formatPeso(change) : '₱0'}</span>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-400 gap-2">
              <i className="ti ti-device-mobile text-4xl opacity-30" />
              <p className="text-sm font-medium text-dg">{PAYMENT_METHODS.find(m => m.value === method)?.label}</p>
              <p className="text-xs">Amount: {formatPeso(totalDue)}</p>
              <p className="text-xs opacity-60">No change calculation needed</p>
            </div>
          )}

          <button
            onClick={handleConfirm}
            disabled={processing || (method === 'cash' && tendered < totalDue)}
            className="w-full py-3 rounded-xl bg-dg text-white font-semibold text-sm hover:bg-dg-light disabled:opacity-40 disabled:cursor-default active:scale-98 transition-all"
          >
            {processing ? 'Processing…' : 'Confirm & Print Receipt'}
          </button>
        </div>
      </div>
    </div>
  )
}
