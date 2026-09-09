import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useSessionStore } from '../../stores/sessionStore'

const NAV = [
  { to: '/',            icon: 'ti-dashboard',     label: 'Dashboard'    },
  { to: '/pos',         icon: 'ti-shopping-cart',  label: 'POS / Sales'  },
  { to: '/openplay',    icon: 'ti-run',            label: 'Open Play'    },
  { to: '/reservations',icon: 'ti-calendar',       label: 'Reservations' },
]

const NAV2 = [
  { to: '/members',     icon: 'ti-id-badge',       label: 'Members'      },
  { to: '/inventory',   icon: 'ti-package',        label: 'Inventory'    },
  { to: '/expenses',    icon: 'ti-receipt-2',      label: 'Expenses'     },
]

const NAV3 = [
  { to: '/reports',     icon: 'ti-chart-bar',      label: 'Reports'      },
  { to: '/attendance',  icon: 'ti-camera',         label: 'Attendance'   },
  { to: '/settings',    icon: 'ti-settings',       label: 'Settings'     },
]

function SideLink({ to, icon, label }: { to: string; icon: string; label: string }) {
  return (
    <NavLink to={to} end={to === '/'}
      className={({ isActive }) =>
        `flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors ${
          isActive
            ? 'bg-olive text-white'
            : 'text-white/55 hover:bg-white/10 hover:text-white'
        }`
      }>
      <i className={`ti ${icon} text-base`} />
      {label}
    </NavLink>
  )
}

export function AppLayout() {
  const navigate = useNavigate()
  const session = useSessionStore(s => s.session)
  const setSession = useSessionStore(s => s.setSession)
  const isCashier = session?.role === 'cashier'
  const isOwner = session?.role === 'owner'

  async function handleLogout() {
    await window.electronAPI.logout()
    setSession(null)
    navigate('/login')
  }

  // Cashiers don't see the Dashboard (revenue/income) or Reports —
  // those stay manager/owner only. Attendance (staff photos + payroll
  // hours) is owner only. Settings stays visible either way.
  const nav1 = isCashier ? NAV.filter(n => n.to !== '/') : NAV
  const nav3 = NAV3.filter(n => {
    if (n.to === '/reports') return !isCashier
    if (n.to === '/attendance') return isOwner
    return true
  })
  const nav3HasReports = nav3.some(n => n.to === '/reports')

  return (
    <div className="flex h-screen bg-cream overflow-hidden">
      {/* Sidebar */}
      <aside className="w-48 bg-dg flex flex-col flex-shrink-0">
        <div className="px-4 pt-7 pb-4 border-b border-white/10">
          <div className="text-sm font-medium text-white leading-tight">The Pickle Farm</div>
          <div className="text-[10px] text-white/40 mt-0.5">Point of Sale System</div>
        </div>

        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {nav1.map(n => <SideLink key={n.to} {...n} />)}
          <div className="h-px bg-white/10 my-2" />
          <div className="text-[10px] text-white/25 px-2.5 py-1 uppercase tracking-wider">Management</div>
          {NAV2.map(n => <SideLink key={n.to} {...n} />)}
          {nav3.length > 0 && (
            <>
              <div className="h-px bg-white/10 my-2" />
              <div className="text-[10px] text-white/25 px-2.5 py-1 uppercase tracking-wider">{nav3HasReports ? 'Reports' : 'More'}</div>
              {nav3.map(n => <SideLink key={n.to} {...n} />)}
            </>
          )}
        </nav>

        <div className="p-2 border-t border-white/10">
          <div className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-white/8 cursor-pointer group">
            <div className="w-7 h-7 rounded-full bg-olive flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
              {session?.full_name?.slice(0, 2).toUpperCase() ?? '??'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-white/80 truncate">{session?.full_name}</div>
              <div className="text-[10px] text-white/40 capitalize">{session?.role}</div>
            </div>
            <button onClick={handleLogout} className="text-white/30 hover:text-white/70 opacity-0 group-hover:opacity-100 transition-opacity">
              <i className="ti ti-logout text-sm" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
