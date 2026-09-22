import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCartStore } from '../stores/cartStore'
import { useSessionStore } from '../stores/sessionStore'
import type { Product, ProductCategory } from '../shared/types'
import { PRODUCT_CATEGORIES } from '../shared/constants'
import { formatPeso } from '../shared/utils'

const CATEGORY_ICONS: Record<ProductCategory, string> = {
  open_play:    'ti-run',
  court_rental: 'ti-tournament',
  rental:       'ti-tennis',
  food_drinks:  'ti-coffee',
  merchandise:  'ti-shirt',
  coaching:     'ti-star',
}

const DURATIONS=['1','1.5','2','3','4','5','6','8','10','12','14','16','18','20','22']

function getEndTime(start,dur){const [h,m]=start.split(':').map(Number);const t=h*60+m+Math.round(parseFloat(dur)*60);const eh=Math.floor(t/60);const em=t%60;return String(eh>23?23:eh).padStart(2,'0')+':'+String(eh>23?59:em).padStart(2,'0')}

export function POSScreen() {
  const navigate = useNavigate()
  const session = useSessionStore(s => s.session)
  const { items, addItem, removeItem, updateQty, clearCart, discount, setMember, memberName, pwdSeniorActive, setPwdSeniorDiscount, subtotal, discountAmount, total, itemCount } = useCartStore()
  const [products, setProducts] = useState([])
  const [activeCat, setActiveCat] = useState('all')
  const [search, setSearch] = useState('')
  const [courtModal, setCourtModal] = useState(null)
  const [courtBooking, setCourtBooking] = useState({court:'Court 1',date:new Date().toISOString().slice(0,10),startTime:'08:00',duration:'1'})
  const [courtError, setCourtError] = useState('')
  const [memberModal, setMemberModal] = useState(false)
  const [pwdModal, setPwdModal] = useState(false)
  const [memberQuery, setMemberQuery] = useState('')
  const [memberResults, setMemberResults] = useState([])
  const [checkingCourt, setCheckingCourt] = useState(false)

  useEffect(() => {
    if (!session) return
    window.electronAPI.getProducts(session.branch_id).then(setProducts)
  }, [session])

  const filtered = useMemo(() => {
    let list = activeCat === 'all' ? products : products.filter(p => p.category === activeCat)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p => p.name.toLowerCase().includes(q))
    }
    return list
  }, [products, activeCat, search])

  const cartMap = useMemo(() => new Map(items.map(i => [i.product_id, i.quantity])), [items])

  async function handleProductClick(product) {
    if (product.category === 'court_rental') {
      setCourtError(''); setCourtModal({product})
    } else {
      addItem(product)
    }
  }

  async function confirmCourtBooking() {
    if (!session || !courtModal) return
    setCheckingCourt(true); setCourtError('')
    try {
      const endTime = getEndTime(courtBooking.startTime, courtBooking.duration)
      const existing = await window.electronAPI.listReservations(session.branch_id, courtBooking.date)
      const conflict = existing.filter(r => r.court_name === courtBooking.court && r.status !== 'cancelled' && r.start_time < endTime && r.end_time > courtBooking.startTime)
      if (conflict.length > 0) { setCourtError(courtBooking.court + ' already booked ' + conflict[0].start_time + ' - ' + conflict[0].end_time); return }
      const note = JSON.stringify({court:courtBooking.court,date:courtBooking.date,startTime:courtBooking.startTime,endTime,duration:courtBooking.duration})
      const totalPrice=courtModal.product.price*parseFloat(courtBooking.duration)
      const pricedProduct={...courtModal.product,price:totalPrice}
      addItem(pricedProduct)
      useCartStore.getState().addNote(courtModal.product.id, note)
      setCourtModal(null)
    } catch(e) { setCourtError('Failed to check availability') }
    finally { setCheckingCourt(false) }
  }

  return (
    <div className="flex h-full bg-cream">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-11 bg-dg flex items-center gap-2 px-4 flex-shrink-0">
          <span className="text-xs font-medium text-white/80 bg-white/10 px-3 py-1 rounded-full">
            POS — New Sale
          </span>
          {session && <span className="text-xs text-white/60 ml-auto">{session.full_name}</span>}
        </div>
        <div className="flex gap-1.5 px-3 py-2 border-b border-border flex-shrink-0 overflow-x-auto">
          <button onClick={() => setActiveCat('all')} className={"px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap " + (activeCat === 'all' ? 'bg-dg text-white' : 'bg-surface text-gray-600')}>
            All ({products.length})
          </button>
          {PRODUCT_CATEGORIES.map(cat => (
            <button key={cat.value} onClick={() => setActiveCat(cat.value)} className={"px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap " + (activeCat === cat.value ? 'bg-dg text-white' : 'bg-surface text-gray-600')}>
              {cat.label}
            </button>
          ))}
        </div>
        <div className="px-3 py-2 flex-shrink-0">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products…" className="w-full px-3 py-1.5 rounded-lg border border-border text-sm outline-none focus:border-olive bg-white"/>
        </div>
        <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 gap-2 content-start">
          {filtered.length === 0 && <p className="text-sm col-span-2 text-center text-gray-400 py-8">No products found</p>}
          {filtered.map(product => {
            const qty = cartMap.get(product.id) ?? 0
            return (
              <button key={product.id} onClick={() => handleProductClick(product)}
                className={"relative p-3 rounded-xl border text-left transition-all " + (qty > 0 ? 'border-olive bg-olive/5' : 'border-border bg-white hover:border-olive/50')}>
                <div className="text-xs text-gray-400 mb-1">
                  <i className={`ti ${CATEGORY_ICONS[product.category]} mr-1`} />
                  {PRODUCT_CATEGORIES.find(c => c.value === product.category)?.label}
                </div>
                <div className="text-sm font-medium text-dg leading-tight mb-1">{product.name}</div>
                <div className="text-base font-medium text-maroon">{formatPeso(product.price)}</div>
                {product.track_inventory && (
                  <div className={`text-xs mt-1 ${product.stock_qty <= product.low_stock_threshold ? 'text-red-500' : 'text-gray-400'}`}>
                    Stock: {product.stock_qty}
                  </div>
                )}
                {qty > 0 && <span className="absolute top-2 right-2 bg-olive text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-medium">{qty}</span>}
              </button>
            )
          })}
        </div>
      </div>

      <div className="w-72 flex flex-col border-l border-border bg-white flex-shrink-0">
        <div className="h-11 bg-dg flex items-center px-4 flex-shrink-0">
          <span className="text-sm font-medium text-white">Order</span>
          {itemCount() > 0 && <button onClick={clearCart} className="ml-auto text-white/60 hover:text-white text-xs">Clear</button>}
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {items.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <i className="ti ti-shopping-cart-off text-4xl opacity-30" />
              <p className="text-xs text-center opacity-60">Tap a product to add it</p>
            </div>
          )}
          {items.map(item => (
            <div key={item.product_id} className="py-2 border-b border-border last:border-0">
              <div className="flex justify-between items-start mb-1">
                <span className="text-gray-700 text-sm flex-1 pr-2">{item.item_name} {item.quantity > 1 && <span className="text-gray-400">x{item.quantity}</span>}</span>
                <button onClick={() => removeItem(item.product_id)} className="text-gray-300 hover:text-maroon text-sm leading-none">×</button>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <button onClick={() => updateQty(item.product_id, item.quantity - 1)} className="w-5 h-5 rounded border border-border text-xs flex items-center justify-center hover:bg-surface">−</button>
                  <span className="text-xs w-6 text-center">{item.quantity}</span>
                  <button onClick={() => updateQty(item.product_id, item.quantity + 1)} className="w-5 h-5 rounded border border-border text-xs flex items-center justify-center hover:bg-surface">+</button>
                </div>
                <span className="text-sm font-medium text-dg">{formatPeso(item.line_total)}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="p-3 border-t border-border flex-shrink-0">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Subtotal</span><span>{formatPeso(subtotal())}</span>
          </div>
          {discountAmount() > 0 && (
            <div className="flex justify-between text-xs text-maroon mb-1">
              <span>{discount.reason || 'Discount'}</span>
              <span>−{formatPeso(discountAmount())}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-medium text-dg mt-2 pt-2 border-t border-border">
            <span>Total</span><span>{formatPeso(total())}</span>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={() => setMemberModal(true)} className="flex-1 py-2 rounded-lg bg-surface border border-border text-xs font-medium hover:bg-cream text-gray-500">
              <i className="ti ti-id-badge mr-1" />{memberName ? memberName : 'Member'}
            </button>
            <button onClick={() => setPwdModal(true)} className={"flex-1 py-2 rounded-lg border text-xs font-medium " + (pwdSeniorActive ? 'bg-olive/10 border-olive text-dg' : 'bg-surface border-border hover:bg-cream text-gray-500')}>
              <i className="ti ti-wheelchair mr-1" />{pwdSeniorActive ? 'PWD/Senior ✓' : 'PWD/Senior'}
            </button>
            <button
              disabled={items.length === 0}
              onClick={() => navigate('/checkout')}
              className="flex-1 px-4 py-2 rounded-lg bg-dg text-white text-xs font-medium disabled:opacity-40 disabled:cursor-default flex items-center justify-center gap-1">
              Pay {formatPeso(total())}
            </button>
          </div>
        </div>
      </div>

      {memberModal&&(
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'>
          <div className='bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6'>
            <div className='flex items-center justify-between mb-4'>
              <h2 className='text-base font-medium text-dg'>Member Lookup</h2>
              <button onClick={() => { setMemberModal(false); setMemberQuery(''); setMemberResults([]) }} className='text-gray-400'><i className='ti ti-x' /></button>
            </div>
            {memberName && (
              <div className='flex items-center gap-2 p-3 bg-green-50 rounded-lg mb-3'>
                <i className='ti ti-circle-check text-green-600' />
                <span className='text-sm text-green-700 font-medium'>{memberName} — ₱100 off court rentals</span>
                <button onClick={() => { setMember('', 0); setMemberModal(false) }} className='ml-auto text-gray-400 text-xs'>Remove</button>
              </div>
            )}
            {pwdSeniorActive && !memberName && (
              <p className='text-xs text-orange-600 mb-3'>Picking a member here will replace the active PWD/Senior discount.</p>
            )}
            <div className='flex gap-2 mb-3'>
              <input value={memberQuery} onChange={e => setMemberQuery(e.target.value)}
                onKeyDown={async e => { if(e.key==='Enter'){ const r = await window.electronAPI.lookupMember(memberQuery); setMemberResults(r) }}}
                placeholder='Name or contact number...'
                className='flex-1 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none' />
              <button onClick={async () => { const r = await window.electronAPI.lookupMember(memberQuery); setMemberResults(r) }}
                className='px-3 py-2 rounded-lg bg-dg text-white text-sm'><i className='ti ti-search' /></button>
            </div>
            {(memberResults as any[]).length > 0 && (
              <div className='border border-border rounded-lg overflow-hidden mb-3'>
                {(memberResults as any[]).map((m:any) => {
                  const today = new Date().toISOString().slice(0,10)
                  const active = m.is_active && m.expiry_date?.slice(0,10) >= today
                  return (
                    <button key={m.id} disabled={!active}
                      onClick={() => { setMember(m.full_name, 100); setMemberModal(false); setMemberQuery(''); setMemberResults([]) }}
                      className='w-full text-left px-4 py-3 border-b border-border last:border-0 hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed'>
                      <div className='flex items-center justify-between'>
                        <div>
                          <div className='text-sm font-medium text-dg'>{m.full_name}</div>
                          <div className='text-xs text-gray-400'>{m.member_code} · {m.membership_type}</div>
                        </div>
                        {active ? <span className='text-xs text-green-600 font-medium'>Active</span> : <span className='text-xs text-red-500'>Expired</span>}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
            <button onClick={() => { setMemberModal(false); setMemberQuery(''); setMemberResults([]) }}
              className='w-full py-2 rounded-lg border border-border text-sm text-gray-600 hover:bg-surface'>Close</button>
          </div>
        </div>
      )}
      {pwdModal&&(
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'>
          <div className='bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6'>
            <div className='flex items-center justify-between mb-4'>
              <h2 className='text-base font-medium text-dg'>PWD / Senior Citizen Discount</h2>
              <button onClick={() => setPwdModal(false)} className='text-gray-400'><i className='ti ti-x' /></button>
            </div>
            <p className='text-xs text-gray-500 mb-4'>
              20% off — applies only to Open Play, Court Rental, and Rentals (paddles, etc.) in this order. Food &amp; drinks, merchandise, and coaching are not discounted.
            </p>
            {pwdSeniorActive ? (
              <div className='flex items-center gap-2 p-3 bg-green-50 rounded-lg mb-3'>
                <i className='ti ti-circle-check text-green-600' />
                <span className='text-sm text-green-700 font-medium'>Applied — {formatPeso(discountAmount())} off</span>
                <button onClick={() => setPwdSeniorDiscount(false)} className='ml-auto text-gray-400 text-xs'>Remove</button>
              </div>
            ) : (
              <>
                {memberName && (
                  <p className='text-xs text-orange-600 mb-3'>This will replace the active Member discount ({memberName}).</p>
                )}
                <button onClick={() => setPwdSeniorDiscount(true)} className='w-full py-2.5 rounded-lg bg-dg text-white text-sm font-medium hover:bg-dg-light mb-3'>
                  Apply 20% Discount
                </button>
              </>
            )}
            <button onClick={() => setPwdModal(false)} className='w-full py-2 rounded-lg border border-border text-sm text-gray-600 hover:bg-surface'>Close</button>
          </div>
        </div>
      )}
      {courtModal&&(
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'>
          <div className='bg-white rounded-xl p-5 w-96 border border-border shadow-xl'>
            <h3 className='text-sm font-medium text-dg mb-1'>Court Rental Booking</h3>
            <p className='text-xs text-gray-500 mb-4'>{courtModal.product.name}</p>
            <div className='space-y-3'>
              <div>
                <label className='text-xs font-medium text-gray-600 mb-1 block'>Court</label>
                <div className='grid grid-cols-2 gap-2'>
                  {['Court 1','Court 2'].map(c=>(
                    <button key={c} onClick={()=>setCourtBooking(b=>({...b,court:c}))} className={'py-2 rounded-lg border text-xs font-medium '+(courtBooking.court===c?'bg-dg text-white border-dg':'border-border text-gray-600')}>{c}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className='text-xs font-medium text-gray-600 mb-1 block'>Date</label>
                <input type='date' value={courtBooking.date} onChange={e=>setCourtBooking(b=>({...b,date:e.target.value}))} className='w-full px-3 py-2 rounded-lg border border-border text-sm outline-none focus:border-olive'/>
              </div>
              <div>
                <label className='text-xs font-medium text-gray-600 mb-1 block'>Start Time</label>
                <input type='time' value={courtBooking.startTime} onChange={e=>setCourtBooking(b=>({...b,startTime:e.target.value}))} className='w-full px-3 py-2 rounded-lg border border-border text-sm outline-none focus:border-olive'/>
              </div>
              <div>
                <label className='text-xs font-medium text-gray-600 mb-1 block'>Duration</label>
                <div className='grid grid-cols-5 gap-1.5'>
                  {DURATIONS.map(d=>(
                    <button key={d} onClick={()=>setCourtBooking(b=>({...b,duration:d}))} className={'py-1.5 rounded-lg border text-xs font-medium '+(courtBooking.duration===d?'bg-olive text-white border-olive':'border-border text-gray-600')}>{d}h</button>
                  ))}
                </div>
              </div>
              <div className='bg-surface rounded-lg p-3 text-xs flex justify-between'>
                <span className='text-gray-500'>End time</span>
                <span className='font-medium text-dg'>{getEndTime(courtBooking.startTime,courtBooking.duration)}</span>
              </div>
              {courtError&&<p className='text-xs text-red-500 bg-red-50 rounded-lg p-2'>{courtError}</p>}
            </div>
            <div className='flex gap-2 mt-4'>
              <button onClick={()=>setCourtModal(null)} className='flex-1 py-2 rounded-lg bg-surface border border-border text-sm text-gray-600'>Cancel</button>
              <button onClick={confirmCourtBooking} disabled={checkingCourt} className='flex-1 py-2 rounded-lg bg-dg text-white text-sm font-medium disabled:opacity-40'>{checkingCourt?'Checking...':'Add to Cart'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
