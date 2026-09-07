import { useState, useEffect } from 'react'
import { useSessionStore } from '../stores/sessionStore'
import { formatPeso } from '../shared/utils'

function addDays(date, n){const d=new Date(date+'T00:00:00');d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)}
function fmtDate(date){return new Date(date+'T00:00:00').toLocaleDateString('en-PH',{weekday:'long',month:'long',day:'numeric',year:'numeric'})}
function fmtTime(iso){return new Date(iso).toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit'})}

function exportCSV(date, summary, transactions){
  const rows=[
    ['Date',date],
    ['Total Revenue',summary?.total_revenue||0],
    ['Transactions',summary?.transaction_count||0],
    ['Open Play',summary?.open_play_count||0],
    ['Court Rentals',summary?.court_rental_count||0],
    ['Discounts',summary?.discount_total||0],
    [],
    ['Transaction ID','Time','Items','Payment','Amount','Discount'],
    ...transactions.map(t=>[
      t.id.slice(0,8),
      fmtTime(t.created_at),
      (t.items||[]).map(i=>i.item_name+'x'+i.quantity).join('; '),
      t.payments?.[0]?.payment_method||'',
      t.total_amount,
      t.discount_amount||0
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

export function ReportsScreen(){
  const session=useSessionStore(s=>s.session)
  const [date,setDate]=useState(new Date().toISOString().slice(0,10))
  const [summary,setSummary]=useState(null)
  const [transactions,setTransactions]=useState([])
  const [loading,setLoading]=useState(false)
  const [expanded,setExpanded]=useState(null)

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

  const isToday=date===new Date().toISOString().slice(0,10)

  return (
    <div className='h-full overflow-y-auto bg-cream'>
      <div className='sticky top-0 bg-cream border-b border-border px-5 py-3 flex items-center justify-between z-10'>
        <div>
          <h1 className='text-lg font-medium text-dg'>Reports</h1>
          <p className='text-xs text-gray-500'>{fmtDate(date)}</p>
        </div>
        <div className='flex items-center gap-2'>
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
          <div className='grid grid-cols-5 gap-3'>
            {[
              {label:'Revenue',value:formatPeso(summary?.total_revenue||0),icon:'ti-currency-peso',color:'text-dg'},
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
                    </div>
                    <div className='text-xs text-gray-400 mt-0.5'>{(t.items||[]).slice(0,3).map(i=>i.item_name).join(', ')}{(t.items||[]).length>3?'...':''}</div>
                  </div>
                  <div className='text-right'>
                    <div className='text-sm font-medium text-dg'>{formatPeso(t.total_amount)}</div>
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
                            <td className='py-1 text-dg'>{item.item_name}{item.notes&&item.notes.startsWith('{')&&(()=>{try{const b=JSON.parse(item.notes);return <span className='text-olive ml-1'>({b.court} {b.startTime}-{b.endTime})</span>}catch{return null}})()}</td>
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
                        {t.discount_amount>0&&<div className='text-gray-500'>Discount: <span className='font-medium text-maroon'>-{formatPeso(t.discount_amount)}</span></div>}
                      </div>
                      <div className='text-right'>
                        <div className='text-gray-500'>Total</div>
                        <div className='text-base font-bold text-dg'>{formatPeso(t.total_amount)}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
