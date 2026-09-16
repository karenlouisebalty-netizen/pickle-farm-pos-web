import { useState, useEffect } from 'react'
import { useSessionStore } from '../stores/sessionStore'
import { formatPeso } from '../shared/utils'

function addDays(date, n){const d=new Date(date+'T00:00:00');d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)}
function fmtDate(date){return new Date(date+'T00:00:00').toLocaleDateString('en-PH',{weekday:'long',month:'long',day:'numeric',year:'numeric'})}
function fmtTime(iso){return new Date(iso).toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit'})}

function exportCSV(date, summary, transactions){
  const rows=[
    ['Date',date],
    ['Total Sales (punched)',summary?.total_revenue||0],
    ['Collected (actual money)',summary?.collected_total||0],
    ['Outstanding (unpaid)',summary?.outstanding_total||0],
    ['Transactions',summary?.transaction_count||0],
    ['Open Play',summary?.open_play_count||0],
    ['Court Rentals',summary?.court_rental_count||0],
    ['Discounts',summary?.discount_total||0],
    [],
    ['Transaction ID','Time','Items','Payment','Status','Paid?','Amount','Discount'],
    ...transactions.map(t=>[
      t.id.slice(0,8),
      fmtTime(t.created_at),
      (t.items||[]).map(i=>i.item_name+'x'+i.quantity).join('; '),
      t.payments?.[0]?.payment_method||'',
      t.status,
      t.payment_status==='unpaid'?'UNPAID':'paid',
      t.total,
      t.discount_total||0
    ])
  ]
  const csv=rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n')
  const blob=new Blob([csv],{type:'text/csv'})
  const url=URL.createObjectURL(blob)
  const a=document.createElement('a')
  a.href=url
  a.download='sales-'+date+'.csv'
  a.click()
  URL.revokeObjectURL(url)
}

// Voiding needs the owner's PIN, checked right here without touching whoever's actually
// signed in — same inline-verification pattern used for staff PINs and Time Clock actions.
function OwnerPinModal({owner,onClose,onVerified}){
  const [pin,setPin]=useState('')
  const [error,setError]=useState('')
  const [loading,setLoading]=useState(false)

  async function submit(){
    if(pin.length<4)return
    setLoading(true);setError('')
    try{
      const {token}=await window.electronAPI.verifyOwnerPin(owner.id,pin)
      onVerified(token)
    }catch{
      setError('Incorrect owner PIN.')
      setPin('')
    }finally{setLoading(false)}
  }

  return (
    <div className='fixed inset-0 bg-black/40 flex items-center justify-center z-50'>
      <div className='bg-white rounded-2xl shadow-xl w-full max-w-xs mx-4 p-6'>
        <div className='flex items-center justify-between mb-1'>
          <h2 className='text-base font-medium text-dg'>Void Transaction</h2>
          <button onClick={onClose} className='text-gray-400 hover:text-gray-600'><i className='ti ti-x'/></button>
        </div>
        <p className='text-xs text-gray-500 mb-4'>Owner PIN required.</p>
        <input
          type='password' inputMode='numeric' autoFocus
          value={pin}
          onChange={e=>setPin(e.target.value.replace(/\D/g,'').slice(0,6))}
          onKeyDown={e=>e.key==='Enter'&&submit()}
          className='w-full border border-border rounded-lg px-3 py-2 text-center text-lg tracking-widest mb-2 focus:outline-none focus:ring-2 focus:ring-olive'
          placeholder='••••••'
        />
        {error&&<div className='text-red-600 text-xs mb-2 text-center'>{error}</div>}
        <button onClick={submit} disabled={pin.length<4||loading}
          className='w-full h-11 rounded-lg bg-dg text-white font-semibold hover:bg-dg-light transition-colors disabled:opacity-40'>
          {loading?'...':'Continue'}
        </button>
      </div>
    </div>
  )
}

function VoidConfirmModal({txn,ownerToken,onClose,onDone}){
  const [reason,setReason]=useState('')
  const [error,setError]=useState('')
  const [loading,setLoading]=useState(false)
  const hasCourtItem=(txn.items||[]).some(i=>i.notes&&i.notes.startsWith('{"court"'))

  async function confirm(){
    setLoading(true);setError('')
    try{
      await window.electronAPI.voidTxn(txn.id,reason||undefined,ownerToken)
      onDone()
    }catch(e){
      setError(e instanceof Error?e.message:'Void failed')
    }finally{setLoading(false)}
  }

  return (
    <div className='fixed inset-0 bg-black/40 flex items-center justify-center z-50'>
      <div className='bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6'>
        <div className='flex items-center justify-between mb-4'>
          <h2 className='text-base font-medium text-dg'>Void this transaction?</h2>
          <button onClick={onClose} className='text-gray-400 hover:text-gray-600'><i className='ti ti-x'/></button>
        </div>
        <div className='bg-surface rounded-lg p-3 mb-3 text-sm'>
          <div className='flex justify-between'><span className='text-gray-500'>Amount</span><span className='font-medium text-dg'>{formatPeso(txn.total)}</span></div>
          <div className='text-xs text-gray-400 mt-1'>{(txn.items||[]).map(i=>i.item_name).join(', ')}</div>
        </div>
        <p className='text-xs text-gray-500 mb-3'>
          This removes it from today's revenue and reports{hasCourtItem?', and cancels the court booking it made (freeing that slot on the public calendar)':''}. This can't be undone.
        </p>
        <label className='text-xs text-gray-500 mb-1 block'>Reason (optional)</label>
        <input
          value={reason} onChange={e=>setReason(e.target.value)}
          className='w-full border border-border rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-olive'
          placeholder='e.g. rang up by mistake'
        />
        {error&&<div className='text-red-600 text-xs mb-2'>{error}</div>}
        <button onClick={confirm} disabled={loading}
          className='w-full h-11 rounded-lg bg-maroon text-white font-semibold hover:opacity-90 transition-colors disabled:opacity-40'>
          {loading?'Voiding...':'Void Transaction'}
        </button>
      </div>
    </div>
  )
}

export function ReportsScreen(){
  const session=useSessionStore(s=>s.session)
  const [date,setDate]=useState(new Date().toISOString().slice(0,10))
  const [summary,setSummary]=useState(null)
  const [transactions,setTransactions]=useState([])
  const [loading,setLoading]=useState(false)
  const [expanded,setExpanded]=useState(null)
  const [owner,setOwner]=useState(null)
  const [voidTarget,setVoidTarget]=useState(null)
  const [voidStage,setVoidStage]=useState(null) // 'pin' | 'confirm'
  const [ownerToken,setOwnerToken]=useState(null)
  const [markingPaid,setMarkingPaid]=useState(null) // transaction id currently being marked paid

  async function load(d){
    if(!session)return
    setLoading(true)
    try{
      const [sum,txns]=await Promise.all([
        window.electronAPI.getDailySummary(session.branch_id,d),
        window.electronAPI.listTransactions(session.branch_id,d)
      ])
      setSummary(sum)
      setTransactions(txns||[])
    }finally{setLoading(false)}
  }

  useEffect(()=>{load(date)},[session,date])
  useEffect(()=>{
    if(!session)return
    window.electronAPI.listUsers(session.branch_id).then(users=>setOwner(users.find(u=>u.role==='owner')||null))
  },[session])

  function openVoid(t){
    setVoidTarget(t)
    setVoidStage('pin')
    setOwnerToken(null)
  }
  function closeVoid(){
    setVoidTarget(null)
    setVoidStage(null)
    setOwnerToken(null)
  }
  function voidDone(){
    closeVoid()
    load(date)
  }

  async function handleMarkPaid(t){
    setMarkingPaid(t.id)
    try{
      await window.electronAPI.markTransactionPaid(t.id)
      await load(date)
    }catch(e){
      alert(e instanceof Error?e.message:'Failed to mark as paid')
    }finally{
      setMarkingPaid(null)
    }
  }

  const isToday=date===new Date().toISOString().slice(0,10)

  return (
    <div className='h-full overflow-y-auto bg-cream'>
      <div className='sticky top-0 bg-cream border-b border-border px-4 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-2 z-10'>
        <div>
          <h1 className='text-lg font-medium text-dg'>Reports</h1>
          <p className='text-xs text-gray-500'>{fmtDate(date)}</p>
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          <button onClick={()=>setDate(d=>addDays(d,-1))} className='px-2 py-1.5 rounded-lg border border-border bg-white text-gray-600 text-sm'>‹</button>
          <input type='date' value={date} onChange={e=>setDate(e.target.value)} className='px-3 py-1.5 rounded-lg border border-border text-sm outline-none'/>
          <button onClick={()=>setDate(d=>addDays(d,1))} disabled={isToday} className='px-2 py-1.5 rounded-lg border border-border bg-white text-gray-600 text-sm disabled:opacity-40'>›</button>
          <button onClick={()=>setDate(new Date().toISOString().slice(0,10))} className='px-3 py-1.5 rounded-lg border border-border bg-white text-xs text-gray-600'>Today</button>
          <button onClick={()=>exportCSV(date,summary,transactions)} className='px-3 py-1.5 rounded-lg bg-dg text-white text-xs font-medium flex items-center gap-1'><i className='ti ti-download'/>Export CSV</button>
        </div>
      </div>

      {loading?(
        <div className='flex items-center justify-center h-64'><div className='text-sm text-gray-400'>Loading...</div></div>
      ):(
        <div className='p-4 space-y-4'>
          <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3'>
            {[
              {label:'Total Sales (punched)',value:formatPeso(summary?.total_revenue||0),icon:'ti-currency-peso',color:'text-dg'},
              {label:'Collected (actual money)',value:formatPeso(summary?.collected_total||0),icon:'ti-cash',color:'text-green-700'},
              {label:'Outstanding (unpaid)',value:formatPeso(summary?.outstanding_total||0),icon:'ti-clock',color:(summary?.outstanding_total||0)>0?'text-orange-600':'text-gray-400'},
              {label:'Transactions',value:summary?.transaction_count||0,icon:'ti-receipt',color:'text-olive'},
              {label:'Open Play',value:summary?.open_play_count||0,icon:'ti-run',color:'text-blue-600'},
              {label:'Court Rentals',value:summary?.court_rental_count||0,icon:'ti-tournament',color:'text-maroon'},
              {label:'Discounts',value:formatPeso(summary?.discount_total||0),icon:'ti-tag',color:'text-orange-500'},
            ].map(m=>(
              <div key={m.label} className='bg-white rounded-xl border border-border p-4'>
                <div className={'text-2xl mb-1 '+m.color}><i className={'ti '+m.icon}/></div>
                <div className={'text-xl font-bold '+m.color}>{m.value}</div>
                <div className='text-xs text-gray-400 mt-0.5'>{m.label}</div>
              </div>
            ))}
          </div>

          <div className='bg-white rounded-xl border border-border overflow-hidden'>
            <div className='px-4 py-3 border-b border-border flex items-center justify-between'>
              <span className='text-sm font-medium text-dg'>Transactions ({transactions.length})</span>
              {transactions.length>0&&<span className='text-xs text-gray-400'>Click to expand</span>}
            </div>
            {transactions.length===0?(
              <div className='text-center py-12'><i className='ti ti-receipt-off text-3xl text-gray-300'/><p className='text-sm text-gray-400 mt-2'>No transactions on this date</p></div>
            ):transactions.map(t=>(
              <div key={t.id} className='border-b border-border last:border-0'>
                <div className='px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-surface' onClick={()=>setExpanded(expanded===t.id?null:t.id)}>
                  <div className='flex-1'>
                    <div className='flex items-center gap-2'>
                      <span className='text-xs font-mono text-gray-400'>{t.id.slice(0,8)}</span>
                      <span className='text-xs text-gray-500'>{fmtTime(t.created_at)}</span>
                      {t.customer_name&&<span className='text-xs bg-surface px-1.5 py-0.5 rounded text-gray-600'>{t.customer_name}</span>}
                      {t.status==='voided'&&<span className='text-[10px] font-medium bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full'>VOIDED</span>}
                      {t.status==='refunded'&&<span className='text-[10px] font-medium bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full'>REFUNDED</span>}
                      {t.status==='completed'&&t.payment_status==='unpaid'&&<span className='text-[10px] font-medium bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full'>UNPAID</span>}
                      {t.is_backdated&&<span className='text-[10px] font-medium bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full flex items-center gap-0.5'><i className='ti ti-history text-[10px]'/>logged</span>}
                      {t.is_advance_payment&&<span className='text-[10px] font-medium bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full flex items-center gap-0.5'><i className='ti ti-calendar-time text-[10px]'/>advance</span>}
                    </div>
                    <div className='text-xs text-gray-400 mt-0.5'>{(t.items||[]).slice(0,3).map(i=>i.item_name).join(', ')}{(t.items||[]).length>3?'...':''}</div>
                  </div>
                  <div className='text-right'>
                    <div className={'text-sm font-medium '+(t.status==='voided'?'text-gray-400 line-through':'text-dg')}>{formatPeso(t.total)}</div>
                    <div className='text-xs text-gray-400'>{t.payments?.[0]?.payment_method||'cash'}</div>
                  </div>
                  <i className={'ti text-gray-400 '+(expanded===t.id?'ti-chevron-up':'ti-chevron-down')}/>
                </div>
                {expanded===t.id&&(
                  <div className='px-4 pb-3 bg-surface'>
                    <table className='w-full text-xs'>
                      <thead><tr className='text-gray-400 border-b border-border'><th className='text-left py-1'>Item</th><th className='text-right py-1'>Qty</th><th className='text-right py-1'>Price</th><th className='text-right py-1'>Total</th></tr></thead>
                      <tbody>
                        {(t.items||[]).map((item,i)=>(
                          <tr key={i} className='border-b border-border last:border-0'>
                            <td className='py-1 text-dg'>{item.item_name}{item.notes&&item.notes.startsWith('{')&&(()=>{try{const b=JSON.parse(item.notes);return <span className='text-olive ml-1'>({b.court} {b.startTime}-{b.endTime})</span>}catch{return null}})()}{item.customer_names&&item.customer_names.length>0&&<span className='text-gray-400 ml-1'>— {item.customer_names.join(', ')}</span>}</td>
                            <td className='py-1 text-right text-gray-500'>{item.quantity}</td>
                            <td className='py-1 text-right text-gray-500'>{formatPeso(item.unit_price)}</td>
                            <td className='py-1 text-right font-medium'>{formatPeso(item.line_total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className='mt-2 pt-2 border-t border-border flex justify-between text-xs'>
                      <div className='space-y-0.5'>
                        <div className='text-gray-500'>Payment: <span className='font-medium text-dg'>{t.payments?.[0]?.payment_method}</span></div>
                        {t.payments?.[0]?.change_given>0&&<div className='text-gray-500'>Change: <span className='font-medium'>{formatPeso(t.payments[0].change_given)}</span></div>}
                        {t.discount_total>0&&<div className='text-gray-500'>Discount: <span className='font-medium text-maroon'>-{formatPeso(t.discount_total)}</span></div>}
                        {t.status==='completed'&&(
                          <div className='text-gray-500'>Status: {t.payment_status==='unpaid'
                            ? <span className='font-medium text-orange-700'>Not paid yet</span>
                            : <span className='font-medium text-green-700'>Paid{t.paid_by_name?` — confirmed by ${t.paid_by_name}`:''}</span>}
                          </div>
                        )}
                        {t.status!=='completed'&&t.notes&&<div className='text-gray-500'>{t.notes}</div>}
                      </div>
                      <div className='text-right'>
                        <div className='text-gray-500'>Total</div>
                        <div className='text-base font-bold text-dg'>{formatPeso(t.total)}</div>
                      </div>
                    </div>
                    {t.status==='completed'&&(
                      <div className='mt-2 pt-2 border-t border-border flex justify-end gap-2'>
                        {t.payment_status==='unpaid'&&(
                          <button onClick={(e)=>{e.stopPropagation();handleMarkPaid(t)}} disabled={markingPaid===t.id} className='text-xs font-medium text-green-700 border border-green-300 rounded-lg px-3 py-1.5 hover:bg-green-50 transition-colors disabled:opacity-50'>
                            <i className='ti ti-cash mr-1'/>{markingPaid===t.id?'Marking...':'Mark as Paid'}
                          </button>
                        )}
                        <button onClick={(e)=>{e.stopPropagation();openVoid(t)}} className='text-xs font-medium text-maroon border border-maroon/30 rounded-lg px-3 py-1.5 hover:bg-red-50 transition-colors'>
                          <i className='ti ti-ban mr-1'/>Void Transaction
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {voidTarget&&voidStage==='pin'&&owner&&(
        <OwnerPinModal owner={owner} onClose={closeVoid} onVerified={(token)=>{setOwnerToken(token);setVoidStage('confirm')}}/>
      )}
      {voidTarget&&voidStage==='confirm'&&ownerToken&&(
        <VoidConfirmModal txn={voidTarget} ownerToken={ownerToken} onClose={closeVoid} onDone={voidDone}/>
      )}
    </div>
  )
}
