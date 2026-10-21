import React, { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { ProtectedRoute, SessionLoading } from './components/auth/ProtectedRoute'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import { DashboardLayout } from './components/layout/DashboardLayout'
import { PORTAL_ROUTE_ROLES, getPortalForRole } from './constants/routes'
import { AuthProvider, useAuth } from './context/AuthContext'

/** React.lazy for modules that only have named exports. */
function lazyNamed<K extends string>(loader: () => Promise<Record<K, React.ComponentType>>, name: K) {
  return lazy(() => loader().then((module) => ({ default: module[name] })))
}

// Public pages
const HomePage = lazyNamed(() => import('./pages/public/HomePage'), 'HomePage')
const LoginPage = lazyNamed(() => import('./pages/public/LoginPage'), 'LoginPage')
const RegisterPage = lazyNamed(() => import('./pages/public/RegisterPage'), 'RegisterPage')
const ResetPasswordPage = lazyNamed(() => import('./pages/public/ResetPasswordPage'), 'ResetPasswordPage')
const UnitsExplorerPage = lazyNamed(() => import('./pages/public/UnitsExplorerPage'), 'UnitsExplorerPage')
const PaymentResultPage = lazyNamed(() => import('./pages/public/PaymentResultPage'), 'PaymentResultPage')
const TermsAndStandardsPage = lazyNamed(() => import('./pages/public/TermsAndStandardsPage'), 'TermsAndStandardsPage')
const NotFoundPage = lazyNamed(() => import('./pages/public/NotFoundPage'), 'NotFoundPage')

// Portal pages
const CustomerDashboard = lazyNamed(() => import('./pages/customer/CustomerDashboard'), 'CustomerDashboard')
const StaffDashboard = lazyNamed(() => import('./pages/staff/StaffDashboard'), 'StaffDashboard')
const ManagerDashboard = lazyNamed(() => import('./pages/manager/ManagerDashboard'), 'ManagerDashboard')
const OperationsDashboard = lazyNamed(() => import('./pages/operations/OperationsDashboard'), 'OperationsDashboard')
const AdminDashboard = lazyNamed(() => import('./pages/admin/AdminDashboard'), 'AdminDashboard')
const CashierJournalPage = lazyNamed(() => import('./pages/staff/CashierJournalPage'), 'CashierJournalPage')
const IncidentTicketsPage = lazyNamed(() => import('./pages/staff/IncidentTicketsPage'), 'IncidentTicketsPage')
const OverdueManagementPage = lazyNamed(() => import('./pages/manager/OverdueManagementPage'), 'OverdueManagementPage')
const ShiftRosterPage = lazyNamed(() => import('./pages/manager/ShiftRosterPage'), 'ShiftRosterPage')
const RefundsPage = lazyNamed(() => import('./pages/finance/RefundsPage'), 'RefundsPage')

// Global AI assistant
const BoxoraChatWidget = lazyNamed(() => import('./components/chat/BoxoraChatWidget'), 'BoxoraChatWidget')

const RouteFallback: React.FC = () => <SessionLoading label="Đang tải…" />

/** `/portal` index: send each role to its own portal. */
function RootRedirect() {
  const { isAuthenticated, role, isLoading } = useAuth()
  if (isLoading) return <SessionLoading />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <Navigate to={getPortalForRole(role)} replace />
}

/** Portal child routes: path segment, page and the allowed roles from PORTAL_ROUTE_ROLES. */
const PORTAL_PAGES: ReadonlyArray<{ path: keyof typeof PORTAL_ROUTE_ROLES; Page: React.ComponentType }> = [
  { path: '/portal/customer', Page: CustomerDashboard },
  { path: '/portal/staff', Page: StaffDashboard },
  { path: '/portal/facility-manager', Page: ManagerDashboard },
  { path: '/portal/business-manager', Page: OperationsDashboard },
  { path: '/portal/admin', Page: AdminDashboard },
  { path: '/portal/cashier', Page: CashierJournalPage },
  { path: '/portal/tickets', Page: IncidentTicketsPage },
  { path: '/portal/overdue', Page: OverdueManagementPage },
  { path: '/portal/shifts', Page: ShiftRosterPage },
  { path: '/portal/finance', Page: RefundsPage },
]

/** Short public aliases that forward into the portal (guards apply on arrival). */
const PORTAL_ALIASES: ReadonlyArray<[string, string]> = [
  ['/customer', '/portal/customer'],
  ['/staff', '/portal/staff'],
  ['/facility-manager', '/portal/facility-manager'],
  ['/manager', '/portal/facility-manager'],
  ['/cashier', '/portal/cashier'],
  ['/tickets', '/portal/tickets'],
  ['/overdue', '/portal/overdue'],
  ['/shifts', '/portal/shifts'],
  ['/finance', '/portal/finance'],
  ['/refunds', '/portal/finance'],
  ['/operations', '/portal/business-manager'],
  ['/business', '/portal/business-manager'],
  ['/admin', '/portal/admin'],
]

function MainContent() {
  const location = useLocation()

  return (
    <div className="flex min-h-screen flex-col bg-canvas font-sans text-fg antialiased">
      <div className="flex-1">
        <ErrorBoundary resetKey={location.pathname}>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              {/* Public */}
              <Route path="/" element={<HomePage />} />
              <Route path="/landing" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/units" element={<UnitsExplorerPage />} />
              <Route path="/explore-units" element={<UnitsExplorerPage />} />
              <Route path="/payment-result" element={<PaymentResultPage />} />
              <Route path="/terms" element={<TermsAndStandardsPage />} />
              <Route path="/standards" element={<TermsAndStandardsPage />} />
              <Route path="/policies" element={<TermsAndStandardsPage />} />

              {/* Portal (RBAC per child route) */}
              <Route
                path="/portal"
                element={
                  <ProtectedRoute>
                    <DashboardLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<RootRedirect />} />
                {PORTAL_PAGES.map(({ path, Page }) => (
                  <Route
                    key={path}
                    path={path.replace('/portal/', '')}
                    element={
                      <ProtectedRoute allowedRoles={PORTAL_ROUTE_ROLES[path]}>
                        <Page />
                      </ProtectedRoute>
                    }
                  />
                ))}
              </Route>

              {PORTAL_ALIASES.map(([from, to]) => (
                <Route key={from} path={from} element={<Navigate to={to} replace />} />
              ))}

              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </div>

      {/* The assistant must never take the page down with it. */}
      <ErrorBoundary fallback={() => null}>
        <Suspense fallback={null}>
          <BoxoraChatWidget />
        </Suspense>
      </ErrorBoundary>
    </div>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <MainContent />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
