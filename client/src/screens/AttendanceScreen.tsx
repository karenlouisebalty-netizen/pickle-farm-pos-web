import { useState, useEffect, Fragment } from 'react'
import { useSessionStore } from '../stores/sessionStore'
import { formatPeso } from '../shared/utils'
import type { AttendanceLog, AttendanceSummaryRow, User, ClockType } from '../shared/types'

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

const CLOCK_TYPE_LABEL: Record<ClockType, string> = {
  in: 'In', out: 'Out', break_start: 'Break Start', break_end: 'Break End',
}
const CLOCK_TYPE_BADGE_CLASS: Record<ClockType, string> = {
  in: 'bg-green-100 text-green-700',
  out: 'bg-gray-100 text-gray-500',
  break_start: 'bg-orange-100 text-orange-700',
  break_end: 'bg-olive/10 text-dg',
}

function PhotoPreviewModal({ log, onClose }: { log: AttendanceLog; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="aspect-[4/3] bg-gray-100 flex items-center justify-center">
          {log.photo ? (
            <img src={log.photo} alt="" className="w-full h-full object-cover" />
          ) : (
            <i className="ti ti-user text-4xl text-gray-300" />
          )}
        </div>
        <div className="p-4">
          <div className="font-medium text-dg">{log.user_name}</div>
          <div className="text-sm text-gray-500">
            {CLOCK_TYPE_LABEL[log.clock_type]} &mdash; {fmtDateTime(log.captured_at)}
          </div>
          <button
            onClick={onClose}
            className="mt-3 w-full h-10 rounded-lg border border-border text-dg font-medium hover:bg-surface transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function ChangePinModal({ user, onClose, onDone }: { user: User; onClose: () => void; onDone: () => void }) {
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function submit() {
    if (pin.length < 4) { setError('PIN must be at least 4 digits.'); return }
    if (pin !== confirm) { setError('PINs don’t match.'); return }
    setLoading(true)
    setError('')
    try {
      await window.electronAPI.changeStaffPin(user.id, pin)
      setSuccess(true)
      setTimeout(onDone, 1200)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not change PIN.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs mx-4 p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-medium text-dg">Change PIN</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><i className="ti ti-x" /></button>
        </div>
        <p className="text-xs text-gray-500 mb-4">New PIN for {user.full_name}.</p>

        {success ? (
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg p-3 text-center">
            <i className="ti ti-check mr-1" />PIN updated.
          </div>
        ) : (
          <>
            <input
              type="password"
              inputMode="numeric"
              autoFocus
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full border border-border rounded-lg px-3 py-2 text-center text-lg tracking-widest mb-2 focus:outline-none focus:ring-2 focus:ring-olive"
              placeholder="New PIN"
            />
            <input
              type="password"
              inputMode="numeric"
              value={confirm}
              onChange={e => setConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={e => e.key === 'Enter' && submit()}
              className="w-full border border-border rounded-lg px-3 py-2 text-center text-lg tracking-widest mb-2 focus:outline-none focus:ring-2 focus:ring-olive"
              placeholder="Confirm PIN"
            />
            {error && <div className="text-red-600 text-xs mb-2 text-center">{error}</div>}
            <button
              onClick={submit}
              disabled={pin.length < 4 || loading}
              className="w-full h-11 rounded-lg bg-dg text-white font-semibold hover:bg-dg-light transition-colors disabled:opacity-40"
            >
              {loading ? 'Saving...' : 'Save New PIN'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

/** Change the signed-in owner's own PIN — unlike resetting a staff member's, this requires
 *  proving you know the CURRENT PIN first (both client-side, for a quick error, and
 *  server-side, which is what actually enforces it). */
function ChangeOwnPinModal({ userId, onClose, onDone }: { userId: string; onClose: () => void; onDone: () => void }) {
  const [currentPin, setCurrentPin] = useState('')
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function submit() {
    if (!currentPin) { setError('Enter your current PIN.'); return }
    if (pin.length < 4) { setError('New PIN must be at least 4 digits.'); return }
    if (pin !== confirm) { setError('New PINs don’t match.'); return }
    setLoading(true)
    setError('')
    try {
      await window.electronAPI.changeStaffPin(userId, pin, { currentPin })
      setSuccess(true)
      setTimeout(onDone, 1200)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not change PIN.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs mx-4 p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-medium text-dg">Change Your PIN</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><i className="ti ti-x" /></button>
        </div>
        <p className="text-xs text-gray-500 mb-4">Confirm your current PIN, then set a new one.</p>

        {success ? (
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg p-3 text-center">
            <i className="ti ti-check mr-1" />PIN updated.
          </div>
        ) : (
          <>
            <input
              type="password"
              inputMode="numeric"
              autoFocus
              value={currentPin}
              onChange={e => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full border border-border rounded-lg px-3 py-2 text-center text-lg tracking-widest mb-2 focus:outline-none focus:ring-2 focus:ring-olive"
              placeholder="Current PIN"
            />
            <div className="h-px bg-border my-3" />
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full border border-border rounded-lg px-3 py-2 text-center text-lg tracking-widest mb-2 focus:outline-none focus:ring-2 focus:ring-olive"
              placeholder="New PIN"
            />
            <input
              type="password"
              inputMode="numeric"
              value={confirm}
              onChange={e => setConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={e => e.key === 'Enter' && submit()}
              className="w-full border border-border rounded-lg px-3 py-2 text-center text-lg tracking-widest mb-2 focus:outline-none focus:ring-2 focus:ring-olive"
              placeholder="Confirm New PIN"
            />
            {error && <div className="text-red-600 text-xs mb-2 text-center">{error}</div>}
            <button
              onClick={submit}
              disabled={!currentPin || pin.length < 4 || loading}
              className="w-full h-11 rounded-lg bg-dg text-white font-semibold hover:bg-dg-light transition-colors disabled:opacity-40"
            >
              {loading ? 'Saving...' : 'Save New PIN'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

/** Inline-editable daily pay rate for one staff member — saves on blur/Enter when changed. */
function DailyRateInput({ user, onSaved }: { user: User; onSaved: (userId: string, rate: number) => void }) {
  const [value, setValue] = useState(String(user.daily_rate ?? 0))
  const [saving, setSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)

  useEffect(() => { setValue(String(user.daily_rate ?? 0)) }, [user.daily_rate])

  async function save() {
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed < 0) { setValue(String(user.daily_rate ?? 0)); return }
    if (parsed === user.daily_rate) return
    setSaving(true)
    try {
      await window.electronAPI.setStaffDailyRate(user.id, parsed)
      onSaved(user.id, parsed)
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 1500)
    } catch {
      setValue(String(user.daily_rate ?? 0))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {justSaved && <span className="text-[11px] text-green-600">Saved</span>}
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-400">₱</span>
        <input
          type="number"
          min={0}
          step="1"
          value={value}
          onChange={e => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          disabled={saving}
          className="w-20 border border-border rounded-lg px-2 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-olive disabled:opacity-50"
        />
        <span className="text-xs text-gray-400">/day</span>
      </div>
    </div>
  )
}

function fmtDay(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })
}

/** Expandable per-day breakdown for one staff member's month — hours worked and break time
 *  consumed each day, straight from the summary the server already computes (AttendanceSummaryRow.days). */
function DayBreakdownRows({ row }: { row: AttendanceSummaryRow }) {
  return (
    <tr>
      <td colSpan={6} className="bg-surface/60 px-4 py-3">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-gray-400">
              <th className="font-medium py-1 pr-2">Date</th>
              <th className="font-medium py-1 pr-2 text-right">Hours Worked</th>
              <th className="font-medium py-1 pr-2 text-right">Break Time</th>
              <th className="font-medium py-1 text-right">Paid</th>
            </tr>
          </thead>
          <tbody>
            {row.days.map(d => (
              <tr key={d.date} className="border-t border-border/60">
                <td className="py-1.5 pr-2 text-gray-600">{fmtDay(d.date)}</td>
                <td className="py-1.5 pr-2 text-right text-dg">{d.hours.toFixed(2)} hrs</td>
                <td className="py-1.5 pr-2 text-right text-gray-500">{d.break_hours > 0 ? `${d.break_hours.toFixed(2)} hrs` : '—'}</td>
                <td className="py-1.5 text-right">
                  {d.paid
                    ? <span className="text-[10px] font-medium bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">Paid</span>
                    : <span className="text-[10px] font-medium bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">Not paid</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </td>
    </tr>
  )
}

export function AttendanceScreen() {
  const session = useSessionStore(s => s.session)
  const branchId = session?.branch_id || 'branch-pf-001'
  const [tab, setTab] = useState<'summary' | 'photos' | 'staff'>('summary')
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [summary, setSummary] = useState<AttendanceSummaryRow[]>([])
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set())
  const [logs, setLogs] = useState<AttendanceLog[]>([])
  const [staffList, setStaffList] = useState<User[]>([])
  const [staffFilter, setStaffFilter] = useState<string>('all')
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<AttendanceLog | null>(null)
  const [pinTarget, setPinTarget] = useState<User | null>(null)
  const [ownPinModalOpen, setOwnPinModalOpen] = useState(false)

  function refreshStaff() {
    window.electronAPI.listUsers(branchId).then(setStaffList)
  }
  useEffect(() => { refreshStaff() }, [branchId])

  useEffect(() => {
    setLoading(true)
    setStaffFilter('all')
    Promise.all([
      window.electronAPI.getAttendanceSummary(branchId, month),
      window.electronAPI.getAttendanceLogs(branchId, month),
    ])
      .then(([s, l]) => { setSummary(s); setLogs(l) })
      .finally(() => setLoading(false))
  }, [branchId, month])

  const staffNames = Array.from(new Set(logs.map(l => l.user_name || l.user_id))).sort()
  const filteredLogs = staffFilter === 'all' ? logs : logs.filter(l => (l.user_name || l.user_id) === staffFilter)

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-medium text-dg">Attendance</h1>
            <p className="text-sm text-gray-500 mt-0.5">Clock-in/out photos, hours, and days worked — for payroll.</p>
          </div>
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-olive"
          />
        </div>

        <div className="flex gap-1 bg-surface border border-border rounded-lg p-1 w-fit mb-6">
          <button
            onClick={() => setTab('summary')}
            className={`px-4 h-9 rounded-md text-sm font-medium transition-colors ${tab === 'summary' ? 'bg-white text-dg shadow-sm' : 'text-gray-500 hover:text-dg'}`}
          >
            Summary
          </button>
          <button
            onClick={() => setTab('photos')}
            className={`px-4 h-9 rounded-md text-sm font-medium transition-colors ${tab === 'photos' ? 'bg-white text-dg shadow-sm' : 'text-gray-500 hover:text-dg'}`}
          >
            Photo Log
          </button>
          <button
            onClick={() => setTab('staff')}
            className={`px-4 h-9 rounded-md text-sm font-medium transition-colors ${tab === 'staff' ? 'bg-white text-dg shadow-sm' : 'text-gray-500 hover:text-dg'}`}
          >
            Manage Staff
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : tab === 'summary' ? (
          summary.length === 0 ? (
            <p className="text-sm text-gray-500">No attendance records for this month.</p>
          ) : (
            <div className="bg-white rounded-xl shadow-card border border-border overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-border bg-surface">
                    <th className="py-3 px-4 font-medium">Staff</th>
                    <th className="py-3 px-4 font-medium text-right">Days Present</th>
                    <th className="py-3 px-4 font-medium text-right">Total Hours</th>
                    <th className="py-3 px-4 font-medium text-right">Break Hours</th>
                    <th className="py-3 px-4 font-medium text-right">Daily Rate</th>
                    <th className="py-3 px-4 font-medium text-right">Salary</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map(r => {
                    const expanded = expandedUsers.has(r.user_id)
                    return (
                      <Fragment key={r.user_id}>
                        <tr
                          onClick={() => setExpandedUsers(prev => {
                            const next = new Set(prev)
                            if (next.has(r.user_id)) next.delete(r.user_id); else next.add(r.user_id)
                            return next
                          })}
                          className="border-b border-border last:border-0 cursor-pointer hover:bg-surface/50"
                        >
                          <td className="py-3 px-4 font-medium text-dg">
                            <span className="flex items-center gap-1.5">
                              <i className={`ti ti-chevron-right text-xs text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                              {r.full_name}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right text-dg">{r.days_present}</td>
                          <td className="py-3 px-4 text-right text-dg">{r.total_hours.toFixed(2)}</td>
                          <td className="py-3 px-4 text-right text-gray-500">{r.total_break_hours.toFixed(2)}</td>
                          <td className="py-3 px-4 text-right text-gray-500">{formatPeso(r.daily_rate)}/day</td>
                          <td className="py-3 px-4 text-right font-semibold text-dg">{formatPeso(r.total_salary)}</td>
                        </tr>
                        {expanded && <DayBreakdownRows row={r} />}
                      </Fragment>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-surface">
                    <td className="py-3 px-4 font-medium text-dg" colSpan={5}>Total payroll this month</td>
                    <td className="py-3 px-4 text-right font-semibold text-dg">
                      {formatPeso(summary.reduce((sum, r) => sum + r.total_salary, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )
        ) : tab === 'photos' ? (
          <>
            {staffNames.length > 0 && (
              <select
                value={staffFilter}
                onChange={e => setStaffFilter(e.target.value)}
                className="border border-border rounded-lg px-3 py-2 text-sm bg-white mb-4 focus:outline-none focus:ring-2 focus:ring-olive"
              >
                <option value="all">All Staff</option>
                {staffNames.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            )}

            {filteredLogs.length === 0 ? (
              <p className="text-sm text-gray-500">No clock-in/out photos for this selection.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {filteredLogs.map(log => (
                  <button
                    key={log.id}
                    onClick={() => setPreview(log)}
                    className="bg-white rounded-xl border border-border overflow-hidden text-left hover:border-olive transition-colors"
                  >
                    <div className="aspect-[4/3] bg-gray-100 flex items-center justify-center overflow-hidden">
                      {log.photo ? (
                        <img src={log.photo} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <i className="ti ti-user text-3xl text-gray-300" />
                      )}
                    </div>
                    <div className="p-2">
                      <div className="text-xs font-medium text-dg truncate">{log.user_name}</div>
                      <div className="flex items-center justify-between mt-1">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${CLOCK_TYPE_BADGE_CLASS[log.clock_type]}`}>
                          {CLOCK_TYPE_LABEL[log.clock_type]}
                        </span>
                        <span className="text-[10px] text-gray-400">{fmtDateTime(log.captured_at)}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-card border border-border p-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-dg">Your PIN</div>
                <div className="text-xs text-gray-500 mt-0.5">{session?.full_name} (Owner) — changing it requires your current PIN.</div>
              </div>
              <button
                onClick={() => setOwnPinModalOpen(true)}
                className="text-xs font-medium text-olive hover:opacity-80 flex-shrink-0"
              >
                Change PIN
              </button>
            </div>
            <div className="bg-white rounded-xl shadow-card border border-border overflow-hidden">
            {staffList.filter(u => u.role !== 'owner').length === 0 ? (
              <p className="text-sm text-gray-500 p-4">No staff yet — add one from the Time Clock tab on the sign-in screen.</p>
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-border bg-surface">
                    <th className="py-3 px-4 font-medium">Staff</th>
                    <th className="py-3 px-4 font-medium">Role</th>
                    <th className="py-3 px-4 font-medium text-right">Daily Rate</th>
                    <th className="py-3 px-4 font-medium text-right">PIN</th>
                  </tr>
                </thead>
                <tbody>
                  {staffList.filter(u => u.role !== 'owner').map(u => (
                    <tr key={u.id} className="border-b border-border last:border-0">
                      <td className="py-3 px-4 font-medium text-dg">{u.full_name}</td>
                      <td className="py-3 px-4 text-gray-500 capitalize">{u.role}</td>
                      <td className="py-3 px-4">
                        <DailyRateInput
                          user={u}
                          onSaved={(userId, rate) => setStaffList(list => list.map(x => x.id === userId ? { ...x, daily_rate: rate } : x))}
                        />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setPinTarget(u)}
                          className="text-xs font-medium text-olive hover:opacity-80"
                        >
                          Change PIN
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
            </div>
          </div>
        )}
      </div>

      {preview && <PhotoPreviewModal log={preview} onClose={() => setPreview(null)} />}
      {pinTarget && (
        <ChangePinModal
          user={pinTarget}
          onClose={() => setPinTarget(null)}
          onDone={() => setPinTarget(null)}
        />
      )}
      {ownPinModalOpen && session && (
        <ChangeOwnPinModal
          userId={session.user_id}
          onClose={() => setOwnPinModalOpen(false)}
          onDone={() => setOwnPinModalOpen(false)}
        />
      )}
    </div>
  )
}
