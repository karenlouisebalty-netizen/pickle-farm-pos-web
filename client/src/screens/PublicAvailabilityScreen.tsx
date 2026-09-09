import { useState, useEffect, useCallback, useRef } from 'react'

// ─────────────────────────────────────────────────────────────
// Public, unauthenticated court-availability calendar. No login needed —
// this is the page you share with customers so they can see open time
// slots themselves instead of asking. It reads live off the same
// reservations that get created whenever staff book a court (either from
// the Reservations screen or by ringing up a Court Rental at the POS) —
// nothing else changes about how staff work.
// ─────────────────────────────────────────────────────────────

const BRANCH_ID = 'branch-pf-001'
const COURTS = ['Court 1', 'Court 2']
const DISPLAY_START = 6   // 6:00 AM default window — extended automatically
const DISPLAY_END = 22    // 10:00 PM              if a booking falls outside it
const HOUR_PX = 56
const REFRESH_MS = 30000

type Booking = { court_name: string; start_time: string; end_time: string }
type AvailabilityResponse = { branch_name: string; contact_number: string | null; date: string; bookings: Booking[] }

function todayStr() { return new Date().toISOString().slice(0, 10) }
function addDays(date: string, n: number) { const d = new Date(date + 'T00:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
function fmtDate(date: string) { return new Date(date + 'T00:00:00').toLocaleDateString('en-PH', { weekday: 'long', month: 'short', day: 'numeric' }) }
function fmtDateShort(date: string) { return new Date(date + 'T00:00:00').toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' }) }
function fmtTime(t: string) { return new Date('2000-01-01T' + t).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' }) }
function timeToMins(t: string) { const [h, m] = t.split(':').map(Number); return h * 60 + m }

async function fetchAvailability(date: string): Promise<AvailabilityResponse> {
  const res = await fetch(`/api/public/availability?branchId=${BRANCH_ID}&date=${date}`)
  if (!res.ok) throw new Error('Could not load availability')
  return res.json()
}

function DayTimeline({ data, loading }: { data: AvailabilityResponse | null; loading: boolean }) {
  const bookings = data?.bookings ?? []

  // Default 6am–10pm window, auto-extended so a booking is never hidden.
  let rangeStart = DISPLAY_START
  let rangeEnd = DISPLAY_END
  for (const b of bookings) {
    rangeStart = Math.min(rangeStart, Math.floor(timeToMins(b.start_time) / 60))
    rangeEnd = Math.max(rangeEnd, Math.ceil(timeToMins(b.end_time) / 60))
  }
  const hours = Array.from({ length: rangeEnd - rangeStart + 1 }, (_, i) => rangeStart + i)
  const totalMins = (rangeEnd - rangeStart) * 60
  const colHeight = (rangeEnd - rangeStart) * HOUR_PX

  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      <div className="grid grid-cols-[52px_1fr_1fr] border-b border-border">
        <div className="p-2" />
        {COURTS.map(c => (
          <div key={c} className="p-2.5 border-l border-border text-center">
            <div className="text-sm font-medium text-dg">{c}</div>
          </div>
        ))}
      </div>

      <div className="relative overflow-x-auto">
        {loading && !data ? (
          <p className="text-sm text-gray-400 p-6 text-center">Loading availability…</p>
        ) : (
          <div className="grid grid-cols-[52px_1fr_1fr] relative" style={{ minHeight: colHeight }}>
            {/* Hour gridlines + labels */}
            <div className="relative">
              {hours.map(h => (
                <div key={h} className="absolute left-0 right-0 text-[10px] text-gray-400 px-1 -translate-y-1/2"
                     style={{ top: ((h - rangeStart) * HOUR_PX) }}>
                  {h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`}
                </div>
              ))}
            </div>

            {COURTS.map(court => (
              <div key={court} className="relative border-l border-border">
                {hours.map(h => (
                  <div key={h} className="absolute left-0 right-0 border-t border-border/70"
                       style={{ top: (h - rangeStart) * HOUR_PX }} />
                ))}
                {bookings.filter(b => b.court_name === court).map((b, i) => {
                  const top = ((timeToMins(b.start_time) - rangeStart * 60) / totalMins) * colHeight
                  const height = Math.max(((timeToMins(b.end_time) - timeToMins(b.start_time)) / totalMins) * colHeight, 22)
                  return (
                    <div key={i}
                      className="absolute left-1 right-1 rounded-lg bg-maroon text-white text-[11px] px-2 py-1 shadow-sm overflow-hidden"
                      style={{ top, height }}
                    >
                      <div className="font-medium">Booked</div>
                      <div className="opacity-85">{fmtTime(b.start_time)}–{fmtTime(b.end_time)}</div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 px-4 py-2.5 border-t border-border text-xs text-gray-500">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-maroon inline-block" />Booked</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-white border border-border inline-block" />Available</span>
      </div>
    </div>
  )
}

function WeekOverview({ startDate, onPickDay }: { startDate: string; onPickDay: (d: string) => void }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(startDate, i))
  const [weekData, setWeekData] = useState<Record<string, Booking[]>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all(days.map(d => fetchAvailability(d).then(r => [d, r.bookings] as const).catch(() => [d, []] as const)))
      .then(entries => { if (!cancelled) setWeekData(Object.fromEntries(entries)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate])

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {days.map(d => {
        const bookings = weekData[d] || []
        return (
          <button
            key={d}
            onClick={() => onPickDay(d)}
            className="bg-white rounded-xl border border-border p-4 text-left hover:border-olive transition-colors"
          >
            <div className="text-sm font-medium text-dg mb-2">{fmtDateShort(d)}</div>
            {loading ? (
              <p className="text-xs text-gray-400">Loading…</p>
            ) : bookings.length === 0 ? (
              <p className="text-xs text-green-700 font-medium">Wide open all day</p>
            ) : (
              <div className="space-y-1.5">
                {COURTS.map(court => {
                  const courtBookings = bookings.filter(b => b.court_name === court)
                  if (courtBookings.length === 0) return null
                  return (
                    <div key={court} className="text-xs">
                      <span className="text-gray-400">{court}: </span>
                      <span className="text-gray-600">
                        {courtBookings.map(b => `${fmtTime(b.start_time)}–${fmtTime(b.end_time)}`).join(', ')}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function PublicAvailabilityScreen() {
  const [view, setView] = useState<'day' | 'week'>('day')
  const [date, setDate] = useState(todayStr())
  const [data, setData] = useState<AvailabilityResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback((d: string, silent = false) => {
    if (!silent) setLoading(true)
    fetchAvailability(d)
      .then(r => { setData(r); setLastUpdated(new Date()) })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load(date)
  }, [date, load])

  // Auto-refresh so it feels live without anyone hitting reload.
  useEffect(() => {
    if (view !== 'day') return
    intervalRef.current = setInterval(() => load(date, true), REFRESH_MS)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [date, view, load])

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-dg flex items-center justify-center mx-auto mb-3">
            <span className="text-white font-semibold text-lg">PF</span>
          </div>
          <h1 className="text-xl font-medium text-dg">{data?.branch_name || 'The Pickle Farm'}</h1>
          <p className="text-sm text-gray-500 mt-1">Court Availability</p>
          {data?.contact_number && (
            <p className="text-xs text-gray-400 mt-1">Book a slot: {data.contact_number}</p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div className="flex gap-1 bg-surface border border-border rounded-lg p-1">
            <button
              onClick={() => setView('day')}
              className={`px-3 h-8 rounded-md text-xs font-medium transition-colors ${view === 'day' ? 'bg-white text-dg shadow-sm' : 'text-gray-500'}`}
            >
              Day
            </button>
            <button
              onClick={() => setView('week')}
              className={`px-3 h-8 rounded-md text-xs font-medium transition-colors ${view === 'week' ? 'bg-white text-dg shadow-sm' : 'text-gray-500'}`}
            >
              This Week
            </button>
          </div>

          {view === 'day' && (
            <div className="flex items-center gap-1.5">
              <button onClick={() => setDate(d => addDays(d, -1))} className="w-8 h-8 rounded-lg border border-border bg-white text-gray-600 text-sm">‹</button>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="px-2.5 h-8 rounded-lg border border-border text-sm bg-white outline-none"
              />
              <button onClick={() => setDate(d => addDays(d, 1))} className="w-8 h-8 rounded-lg border border-border bg-white text-gray-600 text-sm">›</button>
              {date !== todayStr() && (
                <button onClick={() => setDate(todayStr())} className="px-2.5 h-8 rounded-lg border border-border bg-white text-xs text-gray-600">Today</button>
              )}
            </div>
          )}
        </div>

        {view === 'day' ? (
          <>
            <div className="text-sm font-medium text-dg mb-3">{fmtDate(date)}</div>
            <DayTimeline data={data} loading={loading} />
            <div className="flex items-center justify-between mt-3">
              <p className="text-[11px] text-gray-400">
                {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}` : ''}
              </p>
              <button onClick={() => load(date)} className="text-[11px] text-olive font-medium hover:opacity-80">
                <i className="ti ti-refresh mr-1" />Refresh
              </button>
            </div>
          </>
        ) : (
          <WeekOverview startDate={todayStr()} onPickDay={d => { setDate(d); setView('day') }} />
        )}
      </div>
    </div>
  )
}
