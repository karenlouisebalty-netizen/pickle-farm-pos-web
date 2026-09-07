import { useEffect } from 'react'
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

function AuthGuard({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useSessionStore(s => s.isAuthenticated)()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

// Blocks cashiers from the Dashboard and Reports screens (revenue/income),
// even via a direct URL — not just hiding the nav link.
function ManagerOnly({ children }: { children: React.ReactNode }) {
  const session = useSessionStore(s => s.session)
  if (session?.role === 'cashier') return <Navigate to="/pos" replace />
  return <>{children}</>
}

export default function App() {
  const setSession = useSessionStore(s => s.setSession)

  // Restore session on reload
  useEffect(() => {
    window.electronAPI.getSession().then(s => {
      if (s) setSession(s)
    })
  }, [setSession])

  return (
    <Routes>
      <Route path="/login" element={<LoginScreen />} />
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
        <Route path="/settings"     element={<ProductsScreen />} />
        <Route path="*"             element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
