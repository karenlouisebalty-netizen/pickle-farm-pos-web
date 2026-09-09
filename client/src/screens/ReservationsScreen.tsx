import { useState, useEffect } from 'react'
import { useSessionStore } from '../stores/sessionStore'

function fmtTime(t: string){return new Date('2000-01-01T'+t).toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit'})}
function addDays(date: string, n: number){const d=new Date(date);d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)}
function fmtDate(date: string){return new Date(date+'T00:00:00').toLocaleDateString('en-PH',{weekday:'short',month:'short',day:'numeric'})}
function getEndTime(start: string, dur: string){const [h,m]=start.split(':').map(Number);const t=h*60+m+Math.round(parseFloat(dur)*60);return String(Math.floor(t/60)%24).padStart(2,'0')+':'+String(t%60).padStart(2,'0')}
function getWeekDates(date: string){const d=new Date(date+'T00:00:00');const day=d.getDay();const mon=new Date(d);mon.setDate(d.getDate()-day+1);return Array.from({length:7},(_,i)=>{const x=new Date(mon);x.setDate(mon.getDate()+i);return x.toISOString().slice(0,10)})}
function timeToMins(t: string){const [h,m]=t.split(':').map(Number);return h*60+m}

const HOURS=Array.from({length:24},(_,i)=>i)
const COURTS=['Court 1','Court 2']
const STATUS_COLORS: Record<string,string>={confirmed:'bg-dg text-white',cancelled:'bg-gray-200 text-gray-500',no_show:'bg-red-100 text-red-700',completed:'bg-green-100 text-green-700',open_play:'bg-olive text-white'}
const DURATIONS=['1','1.5','2','3','4','5','6','8','10','12','14','16','18','20','22']

export function ReservationsScreen(){
  const session=useSessionStore(s=>s.session)
  const [view,setView]=useState('day')
  const [date,setDate]=useState(new Date().toISOString().slice(0,10))
  const [reservations,setReservations]=useState([])
  const [weekRes,setWeekRes]=useState({})
  const [showModal,setShowModal]=useState(false)
  const [selected,setSelected]=useState(null)
  const [error,setError]=useState('')
  const [saving,setSaving]=useState(false)
  const [form,setForm]=useState({court:'Court 1',date:new Date().toISOString().slice(0,10),startTime:'08:00',duration:'1',bookerName:'',contactNumber:'',notes:'',depositAmount:'0',type:'court_rental'} as any)

  const weekDates=getWeekDates(date)

  async function loadDay(d: string){
    if(!session)return
    const res=await window.electronAPI.listReservations(session.branch_id,d)
    setReservations(res)
  }

  async function loadWeek(){
    if(!session)return
    const results: Record<string,Reservation[]>={}
    await Promise.all(weekDates.map(async d=>{
      results[d]=await window.electronAPI.listReservations(session.branch_id,d)
    }))
    setWeekRes(results)
  }

  useEffect(()=>{
    if(view==='day')loadDay(date)
    else loadWeek()
  },[session,date,view])

  function openNew(court?: string, d?: string, startTime?: string){
    setSelected(null)
    setForm((f:any)=>({...f,court:court||'Court 1',date:d||date,startTime:startTime||'08:00',duration:'1',bookerName:'',contactNumber:'',notes:'',depositAmount:'0',type:'court_rental'}))
    setError('')
    setShowModal(true)
  }

  async function save(){
    if(!session||!form.bookerName.trim()){setError('Booker name is required');return}
    setSaving(true);setError('')
    try{
      const endTime=getEndTime(form.startTime,form.duration)
      await window.electronAPI.createReservation({
        branch_id:session.branch_id,
        court_name:form.court,
        reservation_date:form.date,
        start_time:form.startTime,
        end_time:endTime,
        booker_name:form.bookerName,
        contact_number:form.contactNumber||undefined,
        notes:form.notes||undefined,
        deposit_amount:parseFloat(form.depositAmount)||0,
        status:'confirmed',
        is_recurring:false,
      })
      setShowModal(false)
      if(view==='day')loadDay(date)
      else loadWeek()
    }catch(e:any){setError(e.message||'Failed to save')}
    finally{setSaving(false)}
  }

  async function cancel(id: string){
    await window.electronAPI.cancelReservation(id)
    if(view==='day')loadDay(date)
    else loadWeek()
    setSelected(null)
  }

  const dayRes=reservations.filter(r=>r.status!=='cancelled')

  return (
    <div className='h-full overflow-y-auto bg-cream'>
      <div className='sticky top-0 bg-cream border-b border-border px-4 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-2 z-10'>
        <div className='flex items-center gap-3'>
          <h1 className='text-lg font-medium text-dg'>Reservations</h1>
          <div className='flex rounded-lg border border-border overflow-hidden'>
            <button onClick={()=>setView('day')} className={'px-3 py-1.5 text-xs font-medium '+(view==='day'?'bg-dg text-white':'bg-white text-gray-600')}>Day</button>
            <button onClick={()=>setView('week')} className={'px-3 py-1.5 text-xs font-medium '+(view==='week'?'bg-dg text-white':'bg-white text-gray-600')}>Week</button>
          </div>
        </div>
        <div className='flex items-center gap-2 flex-wrap'>
          <button onClick={()=>setDate(d=>addDays(d,-1))} className='px-2 py-1.5 rounded-lg border border-border bg-white text-gray-600 text-sm'>‹</button>
          <input type='date' value={date} onChange={e=>setDate(e.target.value)} className='px-3 py-1.5 rounded-lg border border-border text-sm outline-none'/>
          <button onClick={()=>setDate(d=>addDays(d,1))} className='px-2 py-1.5 rounded-lg border border-border bg-white text-gray-600 text-sm'>›</button>
          <button onClick={()=>setDate(new Date().toISOString().slice(0,10))} className='px-3 py-1.5 rounded-lg border border-border bg-white text-xs text-gray-600'>Today</button>
          <button onClick={()=>openNew()} className='px-3 py-1.5 rounded-lg bg-dg text-white text-xs font-medium flex items-center gap-1'><i className='ti ti-plus'/>New Booking</button>
        </div>
      </div>

      {view==='day'&&(
        <div className='p-4'>
          <div className='text-sm font-medium text-dg mb-3'>{fmtDate(date)}</div>
          <div className='bg-white rounded-xl border border-border overflow-hidden'>
            <div className='grid grid-cols-3 border-b border-border'>
              <div className='p-3 text-xs text-gray-400 font-medium'>Time</div>
              {COURTS.map(c=>(
                <div key={c} className='p-3 border-l border-border'>
                  <div className='text-xs font-medium text-dg'>{c}</div>
                  <div className='text-xs text-gray-400'>{dayRes.filter(r=>r.court_name===c).length} bookings</div>
                </div>
              ))}
            </div>
            <div className='relative'>
              {HOURS.map(h=>(
                <div key={h} className='grid grid-cols-3 border-b border-border last:border-0' style={{minHeight:'60px'}}>
                  <div className='p-2 text-xs text-gray-400 flex-shrink-0'>{String(h).padStart(2,'0')}:00</div>
                  {COURTS.map(court=>{
                    const slotStart=String(h).padStart(2,'0')+':00'
                    const slotEnd=String((h+1)%24).padStart(2,'0')+':00'
                    const booking=dayRes.find(r=>r.court_name===court&&r.start_time<=slotStart&&r.end_time>slotStart)
                    const isStart=booking&&booking.start_time===slotStart
                    const isFree=!booking
                    return(
                      <div key={court} className='border-l border-border p-1 relative cursor-pointer hover:bg-surface'
                        onClick={()=>isFree?openNew(court,date,slotStart):setSelected(booking||null)}>
                        {isStart&&booking&&(
                          <div className={'rounded-lg p-2 text-xs '+(STATUS_COLORS[booking.status]||'bg-dg text-white')}>
                            <div className='font-medium truncate'>{booking.booker_name}</div>
                            <div className='opacity-80'>{fmtTime(booking.start_time)} - {fmtTime(booking.end_time)}</div>
                            {booking.notes&&<div className='opacity-70 truncate'>{booking.notes}</div>}
                          </div>
                        )}
                        {booking&&!isStart&&<div className='h-full bg-dg/10 rounded'/>}
                        {isFree&&<div className='h-full flex items-center justify-center opacity-40 hover:opacity-100 transition-opacity'><span className='text-xs text-olive'>+ Book</span></div>}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {view==='week'&&(
        <div className='p-4'>
          <div className='bg-white rounded-xl border border-border overflow-x-auto'>
            <div className='min-w-[720px]'>
            <div className='grid border-b border-border' style={{gridTemplateColumns:'80px repeat(7, 1fr)'}}>
              <div className='p-3 text-xs text-gray-400'>Court</div>
              {weekDates.map(d=>(
                <div key={d} className={'p-2 text-center border-l border-border '+(d===new Date().toISOString().slice(0,10)?'bg-dg/5':'')}>
                  <div className='text-xs font-medium text-dg'>{new Date(d+'T00:00:00').toLocaleDateString('en-PH',{weekday:'short'})}</div>
                  <div className='text-xs text-gray-400'>{new Date(d+'T00:00:00').getDate()}</div>
                </div>
              ))}
            </div>
            {COURTS.map(court=>(
              <div key={court} className='grid border-b border-border last:border-0' style={{gridTemplateColumns:'80px repeat(7, 1fr)'}}>
                <div className='p-3 text-xs font-medium text-dg flex items-center'>{court}</div>
                {weekDates.map(d=>{
                  const dayBookings=(weekRes[d]||[]).filter(r=>r.court_name===court&&r.status!=='cancelled')
                  return(
                    <div key={d} className='border-l border-border p-1 min-h-16 cursor-pointer hover:bg-surface' onClick={()=>{setDate(d);setView('day')}}>
                      {dayBookings.length===0?(
                        <div className='h-full flex items-center justify-center'><span className='text-xs text-gray-300'>Free</span></div>
                      ):dayBookings.map(r=>(
                        <div key={r.id} className={'rounded text-xs p-1 mb-0.5 truncate '+(STATUS_COLORS[r.status]||'bg-dg text-white')}>
                          {fmtTime(r.start_time)} {r.booker_name}
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            ))}
            </div>
          </div>
        </div>
      )}

      {selected&&(
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'>
          <div className='bg-white rounded-xl p-5 w-80 border border-border shadow-xl'>
            <h3 className='text-sm font-medium text-dg mb-1'>{selected.booker_name}</h3>
            <p className='text-xs text-gray-500 mb-3'>{selected.court_name} · {fmtDate(selected.reservation_date)}</p>
            <div className='space-y-2 mb-4'>
              <div className='flex justify-between text-xs'><span className='text-gray-500'>Time</span><span className='font-medium'>{fmtTime(selected.start_time)} - {fmtTime(selected.end_time)}</span></div>
              {selected.contact_number&&<div className='flex justify-between text-xs'><span className='text-gray-500'>Contact</span><span>{selected.contact_number}</span></div>}
              {selected.deposit_amount>0&&<div className='flex justify-between text-xs'><span className='text-gray-500'>Deposit</span><span>₱{selected.deposit_amount}</span></div>}
              {selected.notes&&<div className='flex justify-between text-xs'><span className='text-gray-500'>Notes</span><span className='text-right max-w-40'>{selected.notes}</span></div>}
              <div className='flex justify-between text-xs'><span className='text-gray-500'>Status</span><span className={'px-2 py-0.5 rounded-full text-xs font-medium '+(STATUS_COLORS[selected.status]||'')}>{selected.status}</span></div>
            </div>
            <div className='flex gap-2'>
              <button onClick={()=>setSelected(null)} className='flex-1 py-2 rounded-lg bg-surface border border-border text-sm text-gray-600'>Close</button>
              {selected.status!=='cancelled'&&<button onClick={()=>cancel(selected.id)} className='flex-1 py-2 rounded-lg bg-maroon text-white text-sm font-medium'>Cancel Booking</button>}
            </div>
          </div>
        </div>
      )}

      {showModal&&(
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'>
          <div className='bg-white rounded-xl p-5 w-96 border border-border shadow-xl max-h-screen overflow-y-auto'>
            <h3 className='text-sm font-medium text-dg mb-4'>New Booking</h3>
            <div className='space-y-3'>
              <div>
                <label className='text-xs font-medium text-gray-600 mb-1 block'>Type</label>
                <div className='grid grid-cols-2 gap-2'>
                  {[['court_rental','Court Rental'],['open_play','Open Play']].map(([v,l])=>(
                    <button key={v} onClick={()=>setForm(f=>({...f,type:v}))} className={'py-2 rounded-lg border text-xs font-medium '+(form.type===v?'bg-dg text-white border-dg':'border-border text-gray-600')}>{l}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className='text-xs font-medium text-gray-600 mb-1 block'>Court</label>
                <div className='grid grid-cols-2 gap-2'>
                  {COURTS.map(c=>(
                    <button key={c} onClick={()=>setForm(f=>({...f,court:c}))} className={'py-2 rounded-lg border text-xs font-medium '+(form.court===c?'bg-dg text-white border-dg':'border-border text-gray-600')}>{c}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className='text-xs font-medium text-gray-600 mb-1 block'>Date</label>
                <input type='date' value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} className='w-full px-3 py-2 rounded-lg border border-border text-sm outline-none focus:border-olive'/>
              </div>
              <div>
                <label className='text-xs font-medium text-gray-600 mb-1 block'>Start Time</label>
                <input type='time' value={form.startTime} onChange={e=>setForm(f=>({...f,startTime:e.target.value}))} className='w-full px-3 py-2 rounded-lg border border-border text-sm outline-none focus:border-olive'/>
              </div>
              <div>
                <label className='text-xs font-medium text-gray-600 mb-1 block'>Duration</label>
                <div className='grid grid-cols-5 gap-1.5'>
                  {DURATIONS.map(d=>(
                    <button key={d} onClick={()=>setForm(f=>({...f,duration:d}))} className={'py-1.5 rounded-lg border text-xs font-medium '+(form.duration===d?'bg-olive text-white border-olive':'border-border text-gray-600')}>{d}h</button>
                  ))}
                </div>
              </div>
              <div className='bg-surface rounded-lg p-2 text-xs flex justify-between'>
                <span className='text-gray-500'>End time</span>
                <span className='font-medium text-dg'>{getEndTime(form.startTime,form.duration)}</span>
              </div>
              <div>
                <label className='text-xs font-medium text-gray-600 mb-1 block'>Booker Name *</label>
                <input value={form.bookerName} onChange={e=>setForm(f=>({...f,bookerName:e.target.value}))} placeholder='Full name' className='w-full px-3 py-2 rounded-lg border border-border text-sm outline-none focus:border-olive'/>
              </div>
              <div>
                <label className='text-xs font-medium text-gray-600 mb-1 block'>Contact Number</label>
                <input value={form.contactNumber} onChange={e=>setForm(f=>({...f,contactNumber:e.target.value}))} placeholder='09XX XXX XXXX' className='w-full px-3 py-2 rounded-lg border border-border text-sm outline-none focus:border-olive'/>
              </div>
              <div>
                <label className='text-xs font-medium text-gray-600 mb-1 block'>Deposit Amount</label>
                <input type='number' value={form.depositAmount} onChange={e=>setForm(f=>({...f,depositAmount:e.target.value}))} className='w-full px-3 py-2 rounded-lg border border-border text-sm outline-none focus:border-olive'/>
              </div>
              <div>
                <label className='text-xs font-medium text-gray-600 mb-1 block'>Notes</label>
                <textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} rows={2} placeholder='Any special requests...' className='w-full px-3 py-2 rounded-lg border border-border text-sm outline-none focus:border-olive resize-none'/>
              </div>
              {error&&<p className='text-xs text-red-500 bg-red-50 rounded-lg p-2'>{error}</p>}
            </div>
            <div className='flex gap-2 mt-4'>
              <button onClick={()=>setShowModal(false)} className='flex-1 py-2 rounded-lg bg-surface border border-border text-sm text-gray-600'>Cancel</button>
              <button onClick={save} disabled={saving} className='flex-1 py-2 rounded-lg bg-dg text-white text-sm font-medium disabled:opacity-40'>{saving?'Saving...':'Save Booking'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
