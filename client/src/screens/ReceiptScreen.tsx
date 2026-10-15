import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import type { Transaction } from '../shared/types'
import { formatPeso, formatDate, formatTime } from '../shared/utils'

export function ReceiptScreen() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const txn: Transaction = state?.txn

  function handlePrint() {
    document.body.classList.remove('print-stub')
    window.print()
  }

  // Printing the Free Refresher stub reuses the browser's print dialog, same as the
  // receipt itself, but needs to show a DIFFERENT element while the receipt stays hidden —
  // toggled with a body class rather than the receipt's own #receipt-print id, so only one
  // of the two print-CSS blocks below is ever active at a time. Cleared automatically once
  // the print dialog closes (works for both "Print" and "Cancel"), as a safety net in case a
  // later Print Receipt click reuses this same page view.
  function handlePrintStub() {
    document.body.classList.add('print-stub')
    window.print()
  }
  useEffect(() => {
    function clear() { document.body.classList.remove('print-stub') }
    window.addEventListener('afterprint', clear)
    return () => { window.removeEventListener('afterprint', clear); clear() }
  }, [])

  if (!txn) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <div className="text-center">
          <i className="ti ti-receipt-off text-4xl block mb-2 opacity-30" />
          <p>No transaction data</p>
          <button onClick={() => navigate('/pos')} className="mt-4 text-sm text-olive hover:underline">← New sale</button>
        </div>
      </div>
    )
  }

  const created = new Date(txn.created_at)
  const cashPayment = txn.payments.find(p => p.payment_method === 'cash')

  // One {name, flavor} pair per unit of quantity, across every "Free Refreshers" line on
  // this sale (there's normally just one such line, but a sale could ring up more than one
  // product that includes the promo) — this is what the claim stub prints.
  const refresherStubs = txn.items.flatMap(item =>
    (item.refresher_flavors ?? []).map((flavor, i) => ({
      name: item.customer_names?.[i] || 'Player',
      flavor,
    }))
  )

  return (
    <div className="h-full bg-cream flex">
      <style>{`
        @media print {
          body:not(.print-stub) * { visibility: hidden; }
          body:not(.print-stub) #receipt-print, body:not(.print-stub) #receipt-print * { visibility: visible; }
          body:not(.print-stub) #receipt-print { position: fixed; top: 0; left: 0; width: 58mm; }

          /* The stub is display:none on screen (inline style) — this rule forces it visible
             and in-flow for printing specifically when body.print-stub is set, overriding
             that inline style (needs !important since an inline style otherwise always wins). */
          body.print-stub * { visibility: hidden; }
          body.print-stub #refresher-stub-print { display: block !important; visibility: visible; position: fixed; top: 0; left: 0; width: 58mm; }
          body.print-stub #refresher-stub-print * { visibility: visible; }
        }
      `}</style>

      {/* Left: 58mm receipt preview */}
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-xs text-gray-400 print:hidden">58mm paper preview</p>

        {/* Receipt paper simulation */}
        <div className="bg-gray-100 p-3 rounded shadow-inner print:bg-white print:p-0 print:shadow-none" id="receipt-print">
          <div
            className="bg-white font-mono text-[11px] leading-relaxed text-gray-900 px-3 py-3"
            style={{ width: '220px', wordBreak: 'break-word' }}
          >
            <div className="text-center font-bold text-[13px] mb-0.5">THE PICKLE FARM</div>
            <div className="text-center text-[9px] text-gray-500">9070 Binambangan St Brgy. 4</div>
            <div className="text-center text-[9px] text-gray-500 mb-2">Indang, Cavite</div>
            {txn.payment_status === 'unpaid' && (
              <div className="text-center font-bold text-[11px] border border-dashed border-gray-500 py-0.5 mb-1">*** NOT YET PAID ***</div>
            )}
            {txn.payment_status === 'unpaid' && txn.debtor_name && (
              <div className="text-center text-[10px] text-gray-600 mb-1">Owed by: {txn.debtor_name}</div>
            )}
            {txn.is_backdated && (
              <div className="text-center text-[9px] text-gray-500 mb-1">(logged after the fact)</div>
            )}
            {txn.is_advance_payment && (
              <div className="text-center text-[9px] text-gray-500 mb-1">(advance payment — paid today)</div>
            )}

            <div className="border-t border-dashed border-gray-400 my-1.5" />
            <div className="flex justify-between"><span>Receipt #:</span><span>{txn.receipt_number}</span></div>
            <div className="flex justify-between"><span>Date:</span><span>{formatDate(created)}</span></div>
            <div className="flex justify-between"><span>Time:</span><span>{formatTime(created)}</span></div>
            <div className="flex justify-between"><span>Cashier:</span><span>{txn.cashier?.full_name}</span></div>
            {txn.customer && <div className="flex justify-between"><span>Member:</span><span>{txn.customer.full_name}</span></div>}
            <div className="border-t border-dashed border-gray-400 my-1.5" />

            {txn.items.map(item => (
              <div key={item.id}>
                <div className="flex justify-between">
                  <span className="flex-1 mr-1">{item.quantity > 1 ? `${item.item_name} x${item.quantity}` : item.item_name}</span>
                  <span>{formatPeso(item.line_total)}</span>
                </div>
                {item.customer_names && item.customer_names.length > 0 && (
                  <div className="text-[9px] text-gray-500">{item.customer_names.join(', ')}</div>
                )}
              </div>
            ))}

            <div className="border-t border-dashed border-gray-400 my-1.5" />
            <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>{formatPeso(txn.subtotal)}</span></div>
            {txn.discount_total > 0 && (
              <div className="flex justify-between text-gray-500"><span>Discount</span><span>-{formatPeso(txn.discount_total)}</span></div>
            )}
            <div className="flex justify-between font-bold"><span>TOTAL</span><span>{formatPeso(txn.total)}</span></div>

            <div className="border-t border-dashed border-gray-400 my-1.5" />
            {txn.payments.map(p => (
              <div key={p.id}>
                <div className="flex justify-between text-gray-500"><span>Payment:</span><span>{p.payment_method.replace('_',' ').toUpperCase()}</span></div>
                <div className="flex justify-between text-gray-500"><span>Amount:</span><span>{formatPeso(p.amount)}</span></div>
                {p.payment_method === 'cash' && p.change_given > 0 && (
                  <div className="flex justify-between font-bold"><span>Change:</span><span>{formatPeso(p.change_given)}</span></div>
                )}
              </div>
            ))}

            <div className="text-center mt-2 text-[10px] text-gray-500">
              <div>Thank You For Playing!</div>
              <div>See You Again At</div>
              <div className="font-bold">The Pickle Farm</div>
            </div>
            <div className="text-center text-[9px] text-gray-300 mt-1">✂ - - - - - - - - - -</div>
          </div>
        </div>
      </div>

      {/* Printable claim stub — never shown on screen (display:none inline); the CSS above
          forces it visible only while printing with body.print-stub set (by handlePrintStub
          below). Kept OUTSIDE the print:hidden right panel — a display:none ancestor would
          take this down with it no matter what this element's own print CSS says. The
          on-screen summary inside the right panel is the preview people actually see. */}
      <div id="refresher-stub-print" style={{ display: 'none', width: '220px' }}>
        <div className="font-mono text-[11px] leading-relaxed text-gray-900 px-3 py-3 bg-white" style={{ wordBreak: 'break-word' }}>
          <div className="text-center font-bold text-[13px] mb-0.5">THE PICKLE FARM</div>
          <div className="text-center text-[9px] text-gray-500">9070 Binambangan St Brgy. 4</div>
          <div className="text-center text-[9px] text-gray-500 mb-2">Indang, Cavite</div>
          <div className="text-center font-bold text-[11px] border border-dashed border-gray-500 py-0.5 mb-1">*** FREE REFRESHER ***</div>
          <div className="border-t border-dashed border-gray-400 my-1.5" />
          {refresherStubs.map((s, i) => (
            <div key={i} className="flex justify-between"><span>{s.name}</span><span className="font-bold">{s.flavor}</span></div>
          ))}
          <div className="border-t border-dashed border-gray-400 my-1.5" />
          <div className="flex justify-between"><span>Receipt #:</span><span>{txn.receipt_number}</span></div>
          <div className="flex justify-between"><span>Date:</span><span>{formatDate(created)}</span></div>
          <div className="flex justify-between"><span>Time:</span><span>{formatTime(created)}</span></div>
          <div className="text-center mt-2 text-[10px] text-gray-500">Claim anytime at the refreshers station</div>
          <div className="text-center text-[9px] text-gray-300 mt-1">✂ - - - - - - - - - -</div>
        </div>
      </div>

      {/* Right: controls */}
      <div className="w-56 bg-white border-l border-border p-4 flex flex-col gap-3 print:hidden">
        <p className="text-xs font-medium text-dg">
          {txn.payment_status === 'unpaid' ? (
            <><i className="ti ti-clock text-orange-500 mr-1" />Sale complete — <span className="text-orange-600">not yet paid</span></>
          ) : (
            <><i className="ti ti-circle-check text-green-600 mr-1" />Sale complete</>
          )}
        </p>
        {txn.is_backdated && (
          <p className="text-xs text-gray-500 -mt-2 flex items-center gap-1"><i className="ti ti-history" /> Logged for {formatDate(new Date(txn.created_at))}, not today</p>
        )}
        {txn.is_advance_payment && (
          <p className="text-xs text-gray-500 -mt-2 flex items-center gap-1"><i className="ti ti-calendar-time" /> Paid today — for {formatDate(new Date(txn.created_at))}, {formatTime(new Date(txn.created_at))}</p>
        )}
        <div className="bg-surface rounded-lg p-3 text-xs space-y-1">
          <div className="flex justify-between"><span className="text-gray-500">Receipt</span><span className="font-medium">{txn.receipt_number}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Total</span><span className="font-medium text-dg">{formatPeso(txn.total)}</span></div>
          {cashPayment && cashPayment.change_given > 0 && (
            <div className="flex justify-between"><span className="text-gray-500">Change</span><span className="font-bold text-dg">{formatPeso(cashPayment.change_given)}</span></div>
          )}
          {txn.payment_status === 'unpaid' && (
            <div className="flex justify-between"><span className="text-gray-500">Status</span><span className="font-bold text-orange-600">UNPAID</span></div>
          )}
          {txn.payment_status === 'unpaid' && txn.debtor_name && (
            <div className="flex justify-between"><span className="text-gray-500">Owed by</span><span className="font-medium text-dg">{txn.debtor_name}</span></div>
          )}
        </div>
        {txn.payment_status === 'unpaid' && (
          <p className="text-xs text-orange-600 -mt-1">Remember to mark this paid later from Reports or Daily Sales once the money comes in.</p>
        )}

        <button onClick={handlePrint}
          className="w-full py-2.5 bg-dg text-white text-sm font-medium rounded-lg hover:bg-dg-light flex items-center justify-center gap-1.5">
          <i className="ti ti-printer" />
          Print Receipt
        </button>

        {refresherStubs.length > 0 && (
          <div className="bg-surface rounded-lg p-3">
            <p className="text-xs font-medium text-dg mb-2 flex items-center gap-1"><i className="ti ti-glass-full text-olive" /> Free Refresher{refresherStubs.length > 1 ? 's' : ''}</p>
            <div className="space-y-1 mb-2">
              {refresherStubs.map((s, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <span className="text-gray-600">{s.name}</span>
                  <span className="font-medium text-dg">{s.flavor}</span>
                </div>
              ))}
            </div>
            <button onClick={handlePrintStub}
              className="w-full py-2 bg-olive text-white text-xs font-medium rounded-lg hover:opacity-90 flex items-center justify-center gap-1.5">
              <i className="ti ti-printer" />
              Print Stub
            </button>
          </div>
        )}

        <button onClick={() => navigate('/pos')}
          className="w-full py-2.5 bg-surface border border-border text-sm font-medium text-dg rounded-lg hover:bg-cream flex items-center justify-center gap-1.5">
          <i className="ti ti-plus" /> New Sale
        </button>

        <button onClick={() => navigate('/')}
          className="w-full py-2.5 text-sm text-gray-500 hover:text-dg flex items-center justify-center gap-1.5">
          <i className="ti ti-dashboard" /> Dashboard
        </button>
      </div>
    </div>
  )
}
