import { useState, useEffect, useRef } from 'react'
import type { User, AttendanceLog, AttendanceSummaryRow } from '../shared/types'

const BRANCH_ID = 'branch-pf-001'

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
}

// ── Camera capture ──────────────────────────────────────────
function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')

  async function start() {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setReady(true)
    } catch {
      setError('Camera access is needed to clock in/out. Please allow camera access and try again.')
    }
  }
  function stop() {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setReady(false)
  }
  function capture(): string | null {
    const video = videoRef.current
    if (!video || !video.videoWidth) return null
    const targetW = 320
    const scale = targetW / video.videoWidth
    const canvas = document.createElement('canvas')
    canvas.width = targetW
    canvas.height = Math.round(video.videoHeight * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.6)
  }
  return { videoRef, ready, error, start, stop, capture }
}

// ── Clock in/out modal (photo proof) ────────────────────────
function ClockModal({ user, clockType, onClose, onDone }: {
  user: User; clockType: 'in' | 'out'; onClose: () => void; onDone: (photo: string) => Promise<void>
}) {
  const cam = useCamera()
  const [captured, setCaptured] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    cam.start()
    return () => cam.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleCapture() {
    const photo = cam.capture()
    if (photo) { setCaptured(photo); cam.stop() }
  }
  function retake() {
    setCaptured(null)
    cam.start()
  }
  async function confirm() {
    if (!captured) return
    setSubmitting(true)
    try { await onDone(captured) } finally { setSubmitting(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-medium text-dg">
            {clockType === 'in' ? 'Clock In' : 'Clock Out'} &mdash; {user.full_name}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><i className="ti ti-x" /></button>
        </div>

        <div className="rounded-lg overflow-hidden bg-black aspect-[4/3] flex items-center justify-center mb-4">
          {cam.error ? (
            <p className="text-white text-sm text-center px-4">{cam.error}</p>
          ) : captured ? (
            <img src={captured} alt="Captured" className="w-full h-full object-cover" />
          ) : (
            <video ref={cam.videoRef} muted playsInline className="w-full h-full object-cover" />
          )}
        </div>

        {!captured ? (
          <button
            onClick={handleCapture}
            disabled={!cam.ready}
            className="w-full h-12 rounded-lg bg-dg text-white font-semibold hover:bg-dg-light transition-colors disabled:opacity-40"
          >
            <i className="ti ti-camera mr-2" />Take Photo
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={retake} className="flex-1 h-12 rounded-lg border border-border text-dg font-medium hover:bg-surface transition-colors">
              Retake
            </button>
            <button
              onClick={confirm}
              disabled={submitting}
              className="flex-1 h-12 rounded-lg bg-olive text-white font-semibold hover:opacity-90 transition-colors disabled:opacity-40"
            >
              {submitting ? 'Saving...' : `Confirm ${clockType === 'in' ? 'Clock In' : 'Clock Out'}`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Owner PIN gate ───────────────────────────────────────────
function OwnerPinModal({ owner, title, onClose, onVerified }: {
  owner: User; title: string; onClose: () => void; onVerified: (token: string) => void
}) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit() {
    if (pin.length < 4) return
    setLoading(true)
    setError('')
    try {
      const { token } = await window.electronAPI.verifyOwnerPin(owner.id, pin)
      onVerified(token)
    } catch {
      setError('Incorrect owner PIN.')
      setPin('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs mx-4 p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-medium text-dg">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><i className="ti ti-x" /></button>
        </div>
        <p className="text-xs text-gray-500 mb-4">Owner PIN required.</p>
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          value={pin}
          onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          onKeyDown={e => e.key === 'Enter' && submit()}
          className="w-full border border-border rounded-lg px-3 py-2 text-center text-lg tracking-widest mb-2 focus:outline-none focus:ring-2 focus:ring-olive"
          placeholder="••••••"
        />
        {error && <div className="text-red-600 text-xs mb-2 text-center">{error}</div>}
        <button
          onClick={submit}
          disabled={pin.length < 4 || loading}
          className="w-full h-11 rounded-lg bg-dg text-white font-semibold hover:bg-dg-light transition-colors disabled:opacity-40"
        >
          {loading ? '...' : 'Continue'}
        </button>
      </div>
    </div>
  )
}

// ── Add staff modal ──────────────────────────────────────────
function AddStaffModal({ ownerToken, onClose, onDone }: { ownerToken: string; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit() {
    if (!name.trim()) return
    setLoading(true)
    setError('')
    try {
      await window.electronAPI.addStaff(BRANCH_ID, name.trim(), ownerToken)
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add staff.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-medium text-dg">Add Staff</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><i className="ti ti-x" /></button>
        </div>
        <label className="text-xs text-gray-500 mb-1 block">Staff full name</label>
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          className="w-full border border-border rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-olive"
          placeholder="e.g. Juan Dela Cruz"
        />
        <p className="text-xs text-gray-400 mb-3">New staff start with PIN <span className="font-mono">1234</span> — they can be told to use this to sign in.</p>
        {error && <div className="text-red-600 text-xs mb-2">{error}</div>}
        <button
          onClick={submit}
          disabled={!name.trim() || loading}
          className="w-full h-11 rounded-lg bg-dg text-white font-semibold hover:bg-dg-light transition-colors disabled:opacity-40"
        >
          {loading ? 'Adding...' : 'Add Staff'}
        </button>
      </div>
    </div>
  )
}

// ── Remove staff modal ───────────────────────────────────────
function RemoveStaffModal({ staff, ownerToken, onClose, onDone }: {
  staff: User[]; ownerToken: string; onClose: () => void; onDone: () => void
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function remove(id: string) {
    setLoading(true)
    try {
      await window.electronAPI.removeStaff(id, ownerToken)
      onDone()
    } finally {
      setLoading(false)
    }
  }

  const removable = staff.filter(u => u.role !== 'owner')

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-medium text-dg">Remove Staff</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><i className="ti ti-x" /></button>
        </div>
        {removable.length === 0 ? (
          <p className="text-sm text-gray-500">No staff to remove.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {removable.map(u => (
              <div key={u.id} className="flex items-center justify-between border border-border rounded-lg px-3 py-2">
                <span className="text-sm text-dg">{u.full_name}</span>
                {confirmId === u.id ? (
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmId(null)} className="text-xs text-gray-500 hover:text-dg">Cancel</button>
                    <button
                      onClick={() => remove(u.id)}
                      disabled={loading}
                      className="text-xs font-medium text-white bg-maroon rounded px-2 py-1 hover:opacity-90 disabled:opacity-40"
                    >
                      {loading ? '...' : 'Confirm'}
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmId(u.id)} className="text-xs font-medium text-maroon hover:opacity-80">Remove</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Monthly attendance / payroll summary modal ───────────────
function MonthlySummaryModal({ ownerToken, onClose }: { ownerToken: string; onClose: () => void }) {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [rows, setRows] = useState<AttendanceSummaryRow[] | null>(null)
  const [loading, setLoading] = useState(false)

  async function load(m: string) {
    setLoading(true)
    try {
      const data = await window.electronAPI.getAttendanceSummary(BRANCH_ID, m, ownerToken)
      setRows(data)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load(month) }, [month]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-medium text-dg">Monthly Attendance</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><i className="ti ti-x" /></button>
        </div>
        <input
          type="month"
          value={month}
          onChange={e => setMonth(e.target.value)}
          className="border border-border rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-olive"
        />
        {loading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : !rows || rows.length === 0 ? (
          <p className="text-sm text-gray-500">No attendance records for this month.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-border">
                <th className="py-2">Staff</th>
                <th className="py-2 text-right">Days Present</th>
                <th className="py-2 text-right">Total Hours</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.user_id} className="border-b border-border last:border-0">
                  <td className="py-2 text-dg">{r.full_name}</td>
                  <td className="py-2 text-right">{r.days_present}</td>
                  <td className="py-2 text-right font-medium text-dg">{r.total_hours.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────
export function TimeClockPanel({ users, onStaffChanged }: { users: User[]; onStaffChanged: () => void }) {
  const [today, setToday] = useState<AttendanceLog[]>([])
  const [clockTarget, setClockTarget] = useState<{ user: User; type: 'in' | 'out' } | null>(null)
  const [notice, setNotice] = useState('')

  const [pinGate, setPinGate] = useState<null | 'add' | 'remove' | 'summary'>(null)
  const [ownerToken, setOwnerToken] = useState<{ purpose: 'add' | 'remove' | 'summary'; token: string } | null>(null)

  const owner = users.find(u => u.role === 'owner')
  const staff = users.filter(u => u.role !== 'owner')

  async function refreshToday() {
    try { setToday(await window.electronAPI.getTodayAttendance(BRANCH_ID)) } catch { /* ignore */ }
  }
  useEffect(() => { refreshToday() }, [])

  function statusFor(userId: string): 'in' | 'out' {
    const last = today.find(a => a.user_id === userId)
    return last?.clock_type === 'in' ? 'in' : 'out'
  }

  async function handleDone(photo: string) {
    if (!clockTarget) return
    const { user, type } = clockTarget
    await window.electronAPI.clockAttendance(BRANCH_ID, user.id, type, photo)
    setClockTarget(null)
    await refreshToday()
    setNotice(`${user.full_name} clocked ${type} at ${fmtTime(new Date().toISOString())}`)
    setTimeout(() => setNotice(''), 4000)
  }

  return (
    <div className="w-full max-w-sm">
      {notice && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg p-2 mb-3 text-center">
          <i className="ti ti-check mr-1" />{notice}
        </div>
      )}

      <p className="text-sm font-medium text-gray-600 mb-3 text-center">Tap your name to clock in or out</p>

      <div className="flex flex-col gap-2 mb-4">
        {staff.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No staff yet — add one below.</p>}
        {staff.map(u => {
          const status = statusFor(u.id)
          return (
            <button
              key={u.id}
              onClick={() => setClockTarget({ user: u, type: status === 'in' ? 'out' : 'in' })}
              className="w-full p-3 rounded-lg border border-border text-left hover:border-olive hover:bg-surface transition-colors flex items-center justify-between"
            >
              <span className="font-medium text-dg">{u.full_name}</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status === 'in' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {status === 'in' ? 'Clocked In — tap to clock out' : 'Tap to clock in'}
              </span>
            </button>
          )
        })}
      </div>

      {owner && (
        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border">
          <button onClick={() => setPinGate('add')} className="text-xs font-medium text-dg border border-border rounded-lg py-2 hover:bg-surface transition-colors">
            <i className="ti ti-user-plus block text-base mb-0.5" />Add Staff
          </button>
          <button onClick={() => setPinGate('remove')} className="text-xs font-medium text-dg border border-border rounded-lg py-2 hover:bg-surface transition-colors">
            <i className="ti ti-user-minus block text-base mb-0.5" />Remove Staff
          </button>
          <button onClick={() => setPinGate('summary')} className="text-xs font-medium text-dg border border-border rounded-lg py-2 hover:bg-surface transition-colors">
            <i className="ti ti-calendar-stats block text-base mb-0.5" />Attendance
          </button>
        </div>
      )}

      {clockTarget && (
        <ClockModal
          user={clockTarget.user}
          clockType={clockTarget.type}
          onClose={() => setClockTarget(null)}
          onDone={handleDone}
        />
      )}

      {pinGate && owner && (
        <OwnerPinModal
          owner={owner}
          title={pinGate === 'add' ? 'Add Staff' : pinGate === 'remove' ? 'Remove Staff' : 'Monthly Attendance'}
          onClose={() => setPinGate(null)}
          onVerified={(token) => { setOwnerToken({ purpose: pinGate, token }); setPinGate(null) }}
        />
      )}

      {ownerToken?.purpose === 'add' && (
        <AddStaffModal
          ownerToken={ownerToken.token}
          onClose={() => setOwnerToken(null)}
          onDone={() => { setOwnerToken(null); onStaffChanged() }}
        />
      )}
      {ownerToken?.purpose === 'remove' && (
        <RemoveStaffModal
          staff={staff}
          ownerToken={ownerToken.token}
          onClose={() => setOwnerToken(null)}
          onDone={() => { setOwnerToken(null); onStaffChanged() }}
        />
      )}
      {ownerToken?.purpose === 'summary' && (
        <MonthlySummaryModal ownerToken={ownerToken.token} onClose={() => setOwnerToken(null)} />
      )}
    </div>
  )
}
