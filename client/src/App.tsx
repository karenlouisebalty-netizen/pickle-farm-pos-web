import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { ReportsScreen } from './screens/ReportsScreen'
import { ReservationsScreen } from './screens/ReservationsScreen'
import { OpenPlayScreen } from './screens/OpenPlayScreen'
import { DashboardScreen } from './screens/DashboardScreen'
import { ProductsScreen } from './screens/ProductsScreen'
import { LoginScreen } from './screens/LoginScreen'
import { POSScreen } from './screens/POSScreen'
import { CheckoutScreen } from './screens/CheckoutScreen'
import { ReceiptScreen } from './screens/ReceiptScreen'
import { useSessionStore } from './stores/sessionStore'
import { InventoryScreen } from './screens/InventoryScreen'
import { ExpensesScreen } from './screens/ExpensesScreen'
import { MembersScreen } from './screens/MembersScreen'
import { AttendanceScreen } from './screens/AttendanceScreen'
import { PublicAvailabilityScreen } from './screens/PublicAvailabilityScreen'

function AuthGuard({ children }: { children: React.ReactNode }) {
  // Select `session` itself, not the isAuthenticated() function — a selector that always
  // returns the same function reference never re-renders this component when the session
  // changes, so a page that loads with a valid token would flash to /login and get stuck
  // there even after the session finished restoring. Matters a lot more on iPad than laptop,
  // since Safari reloads backgrounded tabs far more aggressively (switching apps, screen
  // lock, etc.) — every one of those reloads was silently bouncing a signed-in staff member
  // back to the login screen.
  const session = useSessionStore(s => s.session)
  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}

// Blocks cashiers from the Dashboard and Reports screens (revenue/income),
// even via a direct URL — not just hiding the nav link.
function ManagerOnly({ children }: { children: React.ReactNode }) {
  const session = useSessionStore(s => s.session)
  if (session?.role === 'cashier') return <Navigate to="/pos" replace />
  return <>{children}</>
}

// Staff photos and payroll hours are owner-only, even via a direct URL.
function OwnerOnly({ children }: { children: React.ReactNode }) {
  const session = useSessionStore(s => s.session)
  if (session?.role !== 'owner') return <Navigate to="/pos" replace />
  return <>{children}</>
}

export default function App() {
  const setSession = useSessionStore(s => s.setSession)
  const [checkedSession, setCheckedSession] = useState(false)

  // Restore session on reload. Wait for this to finish before deciding whether to show
  // /login — otherwise a signed-in user reloading the page (common on iPad, where Safari
  // reloads backgrounded tabs far more often than a laptop browser does) gets redirected
  // to /login on the very first render, before the restored session ever has a chance to load.
  useEffect(() => {
    window.electronAPI.getSession().then(s => {
      if (s) setSession(s)
    }).finally(() => setCheckedSession(true))
  }, [setSession])

  if (!checkedSession) {
    return <div className="h-screen flex items-center justify-center bg-cream text-gray-400 text-sm">Loading...</div>
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginScreen />} />
      {/* Public, no login needed — the shareable court-availability link. */}
      <Route path="/availability" element={<PublicAvailabilityScreen />} />
      <Route element={<AuthGuard><AppLayout /></AuthGuard>}>
        <Route path="/"             element={<ManagerOnly><DashboardScreen /></ManagerOnly>} />
        <Route path="/pos"          element={<POSScreen />} />
        <Route path="/checkout"     element={<CheckoutScreen />} />
        <Route path="/receipt"      element={<ReceiptScreen />} />
        <Route path="/openplay"     element={<OpenPlayScreen />} />
        <Route path="/reservations" element={<ReservationsScreen />} />
        <Route path="/members"             element={<MembersScreen />} />
        <Route path="/inventory"           element={<InventoryScreen />} />
        <Route path="/expenses"           element={<ExpensesScreen />} />
        <Route path="/reports"      element={<ManagerOnly><ReportsScreen /></ManagerOnly>} />
        <Route path="/attendance"   element={<OwnerOnly><AttendanceScreen /></OwnerOnly>} />
        <Route path="/settings"     element={<ProductsScreen />} />
        <Route path="*"             element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
