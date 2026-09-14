import { useNavigate, useLocation } from 'react-router-dom'
import type { Transaction } from '../shared/types'
import { formatPeso, formatDate, formatTime } from '../shared/utils'

export function ReceiptScreen() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const txn: Transaction = state?.txn

  function handlePrint() {
    window.print()
  }

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

  return (
    <div className="h-full bg-cream flex">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #receipt-print, #receipt-print * { visibility: visible; }
          #receipt-print { position: fixed; top: 0; left: 0; width: 58mm; }
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
            {txn.is_backdated && (
              <div className="text-center text-[9px] text-gray-500 mb-1">(logged after the fact)</div>
            )}

            <div className="border-t border-dashed border-gray-400 my-1.5" />
            <div className="flex justify-between"><span>Receipt #:</span><span>{txn.receipt_number}</span></div>
            <div className="flex justify-between"><span>Date:</span><span>{formatDate(created)}</span></div>
            <div className="flex justify-between"><span>Time:</span><span>{formatTime(created)}</span></div>
            <div className="flex justify-between"><span>Cashier:</span><span>{txn.cashier?.full_name}</span></div>
            {txn.customer && <div className="flex justify-between"><span>Member:</span><span>{txn.customer.full_name}</span></div>}
            <div className="border-t border-dashed border-gray-400 my-1.5" />

            {txn.items.map(item => (
              <div key={item.id} className="flex justify-between">
                <span className="flex-1 mr-1">{item.quantity > 1 ? `${item.item_name} x${item.quantity}` : item.item_name}</span>
                <span>{formatPeso(item.line_total)}</span>
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
        <div className="bg-surface rounded-lg p-3 text-xs space-y-1">
          <div className="flex justify-between"><span className="text-gray-500">Receipt</span><span className="font-medium">{txn.receipt_number}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Total</span><span className="font-medium text-dg">{formatPeso(txn.total)}</span></div>
          {cashPayment && cashPayment.change_given > 0 && (
            <div className="flex justify-between"><span className="text-gray-500">Change</span><span className="font-bold text-dg">{formatPeso(cashPayment.change_given)}</span></div>
          )}
          {txn.payment_status === 'unpaid' && (
            <div className="flex justify-between"><span className="text-gray-500">Status</span><span className="font-bold text-orange-600">UNPAID</span></div>
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
