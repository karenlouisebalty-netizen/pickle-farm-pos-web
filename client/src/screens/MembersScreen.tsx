import { useState, useEffect } from 'react'
import { useSessionStore } from '../stores/sessionStore'

const MEMBERSHIP_TYPES = [
  { value: 'monthly', label: 'Monthly', months: 1 },
  { value: 'quarterly', label: 'Quarterly', months: 3 },
  { value: 'annual', label: 'Annual', months: 12 },
]

function StatusBadge({ expiryDate, isActive }) {
  if (!isActive) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Inactive</span>
  const today = new Date().toISOString().slice(0, 10)
  const expiry = expiryDate?.slice(0, 10)
  if (!expiry || expiry < today) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Expired</span>
  const daysLeft = Math.ceil((new Date(expiry).getTime() - new Date(today).getTime()) / 86400000)
  if (daysLeft <= 7) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">Expiring soon</span>
  return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Active</span>
}

function NewMemberModal({ onClose, onDone }) {
  const [step, setStep] = useState<'search'|'create'>('search')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [selected, setSelected] = useState<any>(null)
  const [type, setType] = useState('monthly')
  const [discountPct, setDiscountPct] = useState(0)
  const [loading, setLoading] = useState(false)
  const [newName, setNewName] = useState('')
  const [newContact, setNewContact] = useState('')

  async function search() {
    if (!query.trim()) return
    const res = await window.electronAPI.lookupMember(query)
    setResults(res)
  }

  async function handleCreate() {
    if (!selected && (!newName.trim())) return
    setLoading(true)
    try {
      await window.electronAPI.createMember({
        customer_id: selected?.customer_id || null,
        full_name: selected?.full_name || newName,
        contact_number: selected?.contact_number || newContact,
        membership_type: type,
        discount_pct: discountPct,
      })
      onDone()
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-medium text-dg">New Member</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><i className="ti ti-x" /></button>
        </div>

        {step === 'search' && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Search existing customer</label>
              <div className="flex gap-2">
                <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()}
                  placeholder="Name or contact number..."
                  className="flex-1 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-olive" />
                <button onClick={search} className="px-3 py-2 rounded-lg bg-dg text-white text-sm"><i className="ti ti-search" /></button>
              </div>
            </div>
            {results.length > 0 && (
              <div className="border border-border rounded-lg overflow-hidden">
                {(results as any[]).map(r => (
                  <button key={r.id} onClick={() => { setSelected(r); setStep('create') }}
                    className="w-full text-left px-4 py-3 border-b border-border last:border-0 hover:bg-surface text-sm">
                    <div className="font-medium text-dg">{r.full_name}</div>
                    <div className="text-xs text-gray-400">{r.contact_number}</div>
                  </button>
                ))}
              </div>
            )}
            <div className="text-center">
              <button onClick={() => setStep('create')} className="text-xs text-olive hover:underline">
                + Register new person instead
              </button>
            </div>
          </div>
        )}

        {step === 'create' && (
          <div className="space-y-3">
            {selected ? (
              <div className="flex items-center gap-3 p-3 bg-surface rounded-lg">
                <div className="w-8 h-8 rounded-full bg-dg text-white flex items-center justify-center text-sm font-medium">
                  {selected.full_name?.[0]}
                </div>
                <div>
                  <div className="text-sm font-medium text-dg">{selected.full_name}</div>
                  <div className="text-xs text-gray-400">{selected.contact_number}</div>
                </div>
                <button onClick={() => { setSelected(null); setStep('search') }} className="ml-auto text-gray-400 hover:text-gray-600"><i className="ti ti-x text-xs" /></button>
              </div>
            ) : (
              <>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Full name</label>
                  <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Juan dela Cruz"
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-olive" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Contact number</label>
                  <input value={newContact} onChange={e => setNewContact(e.target.value)} placeholder="09xx xxx xxxx"
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-olive" />
                </div>
              </>
            )}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Membership type</label>
              <div className="grid grid-cols-3 gap-2">
                {MEMBERSHIP_TYPES.map(t => (
                  <button key={t.value} onClick={() => setType(t.value)}
                    className={`py-2 rounded-lg border text-sm font-medium transition-colors ${type === t.value ? 'bg-dg text-white border-dg' : 'border-border text-gray-600 hover:bg-surface'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-3 bg-olive/10 rounded-lg flex items-center gap-2">
              <i className="ti ti-discount text-olive" />
              <span className="text-sm text-dg font-medium">₱100 off court rentals</span>
            </div>
            <div className="flex gap-2 mt-2">
              <button onClick={() => setStep('search')} className="flex-1 px-4 py-2 rounded-lg border border-border text-sm text-gray-600 hover:bg-surface">Back</button>
              <button onClick={handleCreate} disabled={loading || (!selected && !newName.trim())}
                className="flex-1 px-4 py-2 rounded-lg bg-dg text-white text-sm font-medium disabled:opacity-50">
                {loading ? 'Saving...' : 'Create Member'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function RenewModal({ member, onClose, onDone }) {
  const [type, setType] = useState(member.membership_type || 'monthly')
  const [loading, setLoading] = useState(false)

  async function handleRenew() {
    setLoading(true)
    try {
      await window.electronAPI.renewMember(member.id, type)
      onDone()
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-medium text-dg">Renew Membership</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><i className="ti ti-x" /></button>
        </div>
        <div className="text-sm text-gray-600 mb-4">{member.full_name} · <span className="font-mono text-xs">{member.member_code}</span></div>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {MEMBERSHIP_TYPES.map(t => (
            <button key={t.value} onClick={() => setType(t.value)}
              className={`py-2 rounded-lg border text-sm font-medium transition-colors ${type === t.value ? 'bg-dg text-white border-dg' : 'border-border text-gray-600 hover:bg-surface'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="p-3 bg-olive/10 rounded-lg flex items-center gap-2 mb-4">
          <i className="ti ti-discount text-olive" />
          <span className="text-sm text-dg font-medium">₱100 off court rentals</span>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-border text-sm text-gray-600 hover:bg-surface">Cancel</button>
          <button onClick={handleRenew} disabled={loading} className="flex-1 px-4 py-2 rounded-lg bg-dg text-white text-sm font-medium disabled:opacity-50">
            {loading ? 'Renewing...' : 'Renew'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function MembersScreen() {
  const session = useSessionStore(s => s.session)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all'|'active'|'expired'>('all')
  const [showNew, setShowNew] = useState(false)
  const [renewModal, setRenewModal] = useState<any>(null)

  async function loadMembers() {
    if (!session) return
    setLoading(true)
    const res = await window.electronAPI.lookupMember('')
    setMembers(res)
    setLoading(false)
  }

  useEffect(() => { loadMembers() }, [session])

  const today = new Date().toISOString().slice(0, 10)

  const filtered = (members as any[]).filter(m => {
    if (search && !m.full_name?.toLowerCase().includes(search.toLowerCase()) && !m.member_code?.includes(search) && !m.contact_number?.includes(search)) return false
    if (filter === 'active') return m.is_active && m.expiry_date?.slice(0, 10) >= today
    if (filter === 'expired') return !m.is_active || m.expiry_date?.slice(0, 10) < today
    return true
  })

  const activeCount = (members as any[]).filter(m => m.is_active && m.expiry_date?.slice(0, 10) >= today).length
  const expiredCount = (members as any[]).filter(m => !m.is_active || m.expiry_date?.slice(0, 10) < today).length

  return (
    <div className="h-full overflow-y-auto bg-cream">
      {showNew && <NewMemberModal onClose={() => setShowNew(false)} onDone={() => { setShowNew(false); loadMembers() }} />}
      {renewModal && <RenewModal member={renewModal} onClose={() => setRenewModal(null)} onDone={() => { setRenewModal(null); loadMembers() }} />}

      <div className="sticky top-0 bg-cream border-b border-border px-6 py-3 flex items-center justify-between z-10">
        <div>
          <h1 className="text-lg font-medium text-dg">Members</h1>
          <p className="text-xs text-gray-500 mt-0.5">{activeCount} active · {session?.branch_name}</p>
        </div>
        <button onClick={() => setShowNew(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-dg text-white text-xs font-medium hover:bg-dg-light">
          <i className="ti ti-plus text-sm" /> New Member
        </button>
      </div>

      <div className="px-6 py-4 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-border p-4">
            <div className="text-xs text-gray-500 mb-1 flex items-center gap-1"><i className="ti ti-users text-sm" />Total members</div>
            <div className="text-2xl font-medium text-dg">{members.length}</div>
          </div>
          <div className="bg-white rounded-xl border border-border p-4">
            <div className="text-xs text-gray-500 mb-1 flex items-center gap-1"><i className="ti ti-circle-check text-sm" />Active</div>
            <div className="text-2xl font-medium text-green-600">{activeCount}</div>
          </div>
          <div className="bg-white rounded-xl border border-border p-4">
            <div className="text-xs text-gray-500 mb-1 flex items-center gap-1"><i className="ti ti-clock text-sm" />Expired</div>
            <div className="text-2xl font-medium text-red-600">{expiredCount}</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
            <input type="text" placeholder="Search by name, code, or contact..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-olive" />
          </div>
          <div className="flex rounded-lg border border-border overflow-hidden text-xs">
            {(['all','active','expired'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-2 font-medium capitalize transition-colors ${filter === f ? 'bg-dg text-white' : 'bg-white text-gray-500 hover:bg-surface'}`}>
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Member</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Code</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Type</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Benefit</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Expires</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500">Status</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={7} className="text-center py-12 text-gray-400 text-sm">Loading...</td></tr>
              : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400 text-sm">
                  {search ? 'No members found' : 'No members yet — add your first one!'}
                </td></tr>
              ) : filtered.map((m: any) => (
                <tr key={m.id} className="border-b border-border last:border-0 hover:bg-surface/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-dg">{m.full_name}</div>
                    <div className="text-xs text-gray-400">{m.contact_number}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{m.member_code}</td>
                  <td className="px-4 py-3 capitalize text-xs text-gray-600">{m.membership_type}</td>
                  <td className="px-4 py-3 text-xs text-olive font-medium">₱100 off court rental</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{m.expiry_date?.slice(0, 10) || '—'}</td>
                  <td className="px-4 py-3 text-center"><StatusBadge expiryDate={m.expiry_date} isActive={m.is_active} /></td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setRenewModal(m)} className="px-3 py-1 rounded-md text-xs font-medium bg-dg/10 text-dg hover:bg-dg/20 transition-colors">
                      Renew
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
