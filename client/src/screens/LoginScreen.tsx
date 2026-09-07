import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSessionStore } from '../stores/sessionStore'
import type { User } from '../shared/types'
import { TimeClockPanel } from './TimeClockPanel'

export function LoginScreen() {
  const navigate = useNavigate()
  const setSession = useSessionStore(s => s.setSession)
  const [tab, setTab] = useState<'signin' | 'timeclock'>('signin')
  const [users, setUsers] = useState<User[]>([])
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function refreshUsers() {
    window.electronAPI.listUsers('branch-pf-001').then(setUsers)
  }
  useEffect(() => { refreshUsers() }, [])

  function pressKey(key: string) {
    if (key === 'del') { setPin(p => p.slice(0, -1)); return }
    if (pin.length >= 6) return
    setPin(p => p + key)
  }

  async function handleLogin() {
    if (!selectedUser || pin.length < 4) return
    setLoading(true)
    setError('')
    try {
      const session = await window.electronAPI.login(selectedUser.id, pin)
      setSession(session)
      // Cashiers land on POS directly — the Dashboard (revenue/income) is manager/owner only.
      navigate(session.role === 'cashier' ? '/pos' : '/')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Login failed')
      setPin('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center gap-8 p-8">
      {/* Branding */}
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-dg flex items-center justify-center mx-auto mb-4">
          <span className="text-white font-semibold text-xl">PF</span>
        </div>
        <h1 className="text-2xl font-medium text-dg">The Pickle Farm</h1>
        <p className="text-sm text-gray-500 mt-1">Point of Sale — Indang, Cavite</p>
      </div>

      {/* Tab switcher: Sign In (PIN pad) vs Time Clock (staff attendance) */}
      <div className="flex gap-1 bg-surface border border-border rounded-lg p-1 w-full max-w-sm">
        <button
          onClick={() => { setTab('signin'); setSelectedUser(null); setPin(''); setError('') }}
          className={`flex-1 h-9 rounded-md text-sm font-medium transition-colors ${tab === 'signin' ? 'bg-white text-dg shadow-sm' : 'text-gray-500 hover:text-dg'}`}
        >
          Sign In
        </button>
        <button
          onClick={() => setTab('timeclock')}
          className={`flex-1 h-9 rounded-md text-sm font-medium transition-colors ${tab === 'timeclock' ? 'bg-white text-dg shadow-sm' : 'text-gray-500 hover:text-dg'}`}
        >
          Time Clock
        </button>
      </div>

      {tab === 'timeclock' ? (
        <TimeClockPanel users={users} onStaffChanged={refreshUsers} />
      ) : (
      <div className="bg-white rounded-xl shadow-card border border-border p-6 w-full max-w-sm">
        {/* User selector */}
        {!selectedUser ? (
          <>
            <p className="text-sm font-medium text-gray-600 mb-4 text-center">Who's working today?</p>
            <div className="flex flex-col gap-2">
              {users.map(u => (
                <button
                  key={u.id}
                  onClick={() => setSelectedUser(u)}
                  className="w-full p-3 rounded-lg border border-border text-left hover:border-olive hover:bg-surface transition-colors"
                >
                  <div className="font-medium text-dg">{u.full_name}</div>
                  <div className="text-xs text-gray-500 capitalize">{u.role}</div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            {/* PIN entry */}
            <div className="flex items-center gap-3 mb-5">
              <button onClick={() => { setSelectedUser(null); setPin('') }} className="text-gray-400 hover:text-dg">
                <i className="ti ti-arrow-left text-lg" />
              </button>
              <div>
                <div className="font-medium text-dg">{selectedUser.full_name}</div>
                <div className="text-xs text-gray-500 capitalize">{selectedUser.role}</div>
              </div>
            </div>

            {/* PIN dots */}
            <div className="flex gap-3 justify-center mb-5">
              {[0,1,2,3,4,5].map(i => (
                <div key={i} className={`w-3 h-3 rounded-full border-2 ${i < pin.length ? 'bg-dg border-dg' : 'border-border'}`} />
              ))}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-2 mb-3 text-center">
                {error}
              </div>
            )}

            {/* Numpad */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              {['1','2','3','4','5','6','7','8','9'].map(k => (
                <button key={k} onClick={() => pressKey(k)}
                  className="h-12 rounded-lg bg-surface border border-border text-dg font-semibold text-lg hover:bg-cream transition-colors active:scale-95">
                  {k}
                </button>
              ))}
              <button onClick={() => pressKey('del')}
                className="h-12 rounded-lg bg-surface border border-border text-maroon font-semibold hover:bg-red-50 transition-colors">
                <i className="ti ti-backspace text-lg" />
              </button>
              <button onClick={() => pressKey('0')}
                className="h-12 rounded-lg bg-surface border border-border text-dg font-semibold text-lg hover:bg-cream transition-colors active:scale-95">
                0
              </button>
              <button onClick={handleLogin} disabled={pin.length < 4 || loading}
                className="h-12 rounded-lg bg-dg text-white font-semibold hover:bg-dg-light transition-colors disabled:opacity-40 active:scale-95">
                {loading ? '...' : '↵'}
              </button>
            </div>
          </>
        )}
      </div>
      )}

      <p className="text-xs text-gray-400">The Pickle Farm POS v1.0 — Offline ready</p>
    </div>
  )
}
