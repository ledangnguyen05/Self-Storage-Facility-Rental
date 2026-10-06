import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { DashboardLayout } from './components/layout/DashboardLayout'
import { ProtectedRoute } from './components/auth/ProtectedRoute'

// Public Pages (Authentication & Landing)
import { LoginPage } from './pages/public/LoginPage'
import { RegisterPage } from './pages/public/RegisterPage'
import { HomePage } from './pages/public/HomePage'

// StorageOps Pro Portals (Matching Prototype Stitch Files)
import { CustomerDashboard } from './pages/customer/CustomerDashboard'
import { StaffDashboard } from './pages/staff/StaffDashboard'
import { ManagerDashboard } from './pages/manager/ManagerDashboard'
import { OperationsDashboard } from './pages/operations/OperationsDashboard'
import { AdminDashboard } from './pages/admin/AdminDashboard'

// Root redirect handler based on user role
function RootRedirect() {
  const { isAuthenticated, role, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-3 text-white">
        <div className="w-10 h-10 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin"></div>
        <span className="font-mono text-xs text-slate-400">Khởi động StorageOps Pro...</span>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  switch (role) {
    case 'ADMIN':
      return <Navigate to="/portal/admin" replace />
    case 'BUSINESS_MANAGER':
      return <Navigate to="/portal/business-manager" replace />
    case 'FACILITY_MANAGER':
      return <Navigate to="/portal/facility-manager" replace />
    case 'STAFF':
      return <Navigate to="/portal/staff" replace />
    case 'CUSTOMER':
    default:
      return <Navigate to="/portal/customer" replace />
  }
}

function MainContent() {
  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] font-sans antialiased text-slate-900">
      <main className="flex-1">
        <Routes>
          {/* Root '/' routes to Login (if anonymous) or Role Dashboard (if authenticated) */}
          <Route path="/" element={<RootRedirect />} />

          {/* Authentication & Standalone Pages */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/landing" element={<HomePage />} />

          {/* Core StorageOps Pro Portal with RBAC Route Protection */}
          <Route
            path="/portal"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<RootRedirect />} />

            {/* 1. Customer Portal: Strictly Customer and Admin */}
            <Route
              path="customer"
              element={
                <ProtectedRoute allowedRoles={['CUSTOMER', 'ADMIN']}>
                  <CustomerDashboard />
                </ProtectedRoute>
              }
            />

            {/* 2. Staff Portal: Staff, Facility Manager, Admin */}
            <Route
              path="staff"
              element={
                <ProtectedRoute allowedRoles={['STAFF', 'FACILITY_MANAGER', 'ADMIN']}>
                  <StaffDashboard />
                </ProtectedRoute>
              }
            />

            {/* 3. Facility Manager Portal: Facility Manager, Business Manager, Admin */}
            <Route
              path="facility-manager"
              element={
                <ProtectedRoute allowedRoles={['FACILITY_MANAGER', 'BUSINESS_MANAGER', 'ADMIN']}>
                  <ManagerDashboard />
                </ProtectedRoute>
              }
            />

            {/* 4. Business Manager Portal: Business Manager, Admin */}
            <Route
              path="business-manager"
              element={
                <ProtectedRoute allowedRoles={['BUSINESS_MANAGER', 'ADMIN']}>
                  <OperationsDashboard />
                </ProtectedRoute>
              }
            />

            {/* 5. System Admin Portal: Strictly Admin */}
            <Route
              path="admin"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* Direct Friendly URLs with Automatic Route Guards */}
          <Route path="/customer" element={<Navigate to="/portal/customer" replace />} />
          <Route path="/staff" element={<Navigate to="/portal/staff" replace />} />
          <Route path="/facility-manager" element={<Navigate to="/portal/facility-manager" replace />} />
          <Route path="/manager" element={<Navigate to="/portal/facility-manager" replace />} />
          <Route path="/operations" element={<Navigate to="/portal/business-manager" replace />} />
          <Route path="/business" element={<Navigate to="/portal/business-manager" replace />} />
          <Route path="/admin" element={<Navigate to="/portal/admin" replace />} />

          {/* Fallback */}
          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </main>
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
