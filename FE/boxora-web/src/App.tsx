import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { DashboardLayout } from './components/layout/DashboardLayout'
import { ProtectedRoute } from './components/auth/ProtectedRoute'

// Public Pages (Authentication & Landing)
import { LoginPage } from './pages/public/LoginPage'
import { RegisterPage } from './pages/public/RegisterPage'
import { HomePage } from './pages/public/HomePage'
import { BookingPage } from './pages/public/BookingPage'
import { UnitsExplorerPage } from './pages/public/UnitsExplorerPage'
import { TermsAndStandardsPage } from './pages/public/TermsAndStandardsPage'
import { ResetPasswordPage } from './pages/public/ResetPasswordPage'
import { PaymentResultPage } from './pages/public/PaymentResultPage'
<<<<<<< Updated upstream
import { FacilitiesPage } from './pages/public/FacilitiesPage'
=======
import { OnlineBookingContractPage } from './pages/customer/OnlineBookingContractPage'
import { MyBookingsPage } from './pages/customer/MyBookingsPage'
>>>>>>> Stashed changes

// StorageOps Pro Portals (Matching Prototype Stitch Files)

import { CustomerDashboard } from './pages/customer/CustomerDashboard'
import { StaffDashboard } from './pages/staff/StaffDashboard'
import { ManagerDashboard } from './pages/manager/ManagerDashboard'
import { OperationsDashboard } from './pages/operations/OperationsDashboard'
import { AdminDashboard } from './pages/admin/AdminDashboard'
import { CashierJournalPage } from './pages/staff/CashierJournalPage'
import { IncidentTicketsPage } from './pages/staff/IncidentTicketsPage'
import { OverdueManagementPage } from './pages/manager/OverdueManagementPage'
import { ShiftRosterPage } from './pages/manager/ShiftRosterPage'
import { BoxoraChatWidget } from './components/chat/BoxoraChatWidget'

// Root redirect handler based on user role
function RootRedirect() {
  const { isAuthenticated, role, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-3 text-white">
        <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
        <span className="text-xs text-slate-400 font-medium">Đang kết nối hệ thống Boxora...</span>
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
<<<<<<< Updated upstream
    default:
=======
    default: {
      const access = checkCustomerPortalAccess(user)
      if (!access.hasAccess) {
        return <Navigate to="/my-bookings" replace />
      }
>>>>>>> Stashed changes
      return <Navigate to="/portal/customer" replace />
  }
}

function MainContent() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)] font-sans antialiased text-[var(--on-surface)]">
      <main className="flex-1">
        <Routes>
          {/* Public Landing Page & Authentication */}
          <Route path="/" element={<HomePage />} />
          <Route path="/landing" element={<HomePage />} />
          <Route path="/booking" element={<BookingPage />} />
          <Route path="/dat-kho" element={<BookingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Dedicated Storage Units Explorer & Booking Dashboard */}
          <Route path="/units" element={<UnitsExplorerPage />} />
          <Route path="/explore-units" element={<UnitsExplorerPage />} />
          <Route path="/facilities" element={<FacilitiesPage />} />
          <Route path="/branches" element={<FacilitiesPage />} />
          <Route path="/my-requests" element={<Navigate to="/portal/customer?tab=requests" replace />} />
          <Route
            path="/reserve"
            element={
              <ProtectedRoute allowedRoles={['CUSTOMER', 'ADMIN']}>
                <CustomerDashboard bookingOnly />
              </ProtectedRoute>
            }
          />
          <Route path="/payment-result" element={<PaymentResultPage />} />

          {/* Boxora Terms & Standards Dashboard */}
          <Route
            path="/my-bookings"
            element={
              <ProtectedRoute allowedRoles={['CUSTOMER']}>
                <MyBookingsPage />
              </ProtectedRoute>
            }
          />
          <Route path="/customer/bookings" element={<Navigate to="/my-bookings" replace />} />

          <Route path="/terms" element={<TermsAndStandardsPage />} />
          <Route path="/standards" element={<TermsAndStandardsPage />} />
          <Route path="/policies" element={<TermsAndStandardsPage />} />

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

<<<<<<< HEAD
            {/* 2. Staff Portal: Staff, Facility Manager, Admin */}
            <Route
              path="staff"
              element={
                <ProtectedRoute allowedRoles={['STAFF', 'FACILITY_MANAGER', 'ADMIN']}>
=======
            {/* 2. Staff Portal: operational access is reserved for Staff & Facility Manager */}
            <Route
              path="staff"
              element={
                <ProtectedRoute allowedRoles={['STAFF', 'FACILITY_MANAGER']}>
>>>>>>> dc54f515e9b5c06f6639b5efd5c5ed3a26213a2c
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
            {/* 6. Cashier Journal Portal: Staff, Facility Manager, Business Manager, Admin */}
            <Route
              path="cashier"
              element={
                <ProtectedRoute allowedRoles={['STAFF', 'FACILITY_MANAGER', 'BUSINESS_MANAGER', 'ADMIN']}>
                  <CashierJournalPage />
                </ProtectedRoute>
              }
            />

            {/* 7. Incident Tickets Portal: Staff, Facility Manager, Business Manager, Admin */}
            <Route
              path="tickets"
              element={
                <ProtectedRoute allowedRoles={['STAFF', 'FACILITY_MANAGER', 'BUSINESS_MANAGER', 'ADMIN']}>
                  <IncidentTicketsPage />
                </ProtectedRoute>
              }
            />

            {/* 8. Overdue Delinquency Management: Facility Manager, Business Manager, Admin */}
            <Route
              path="overdue"
              element={
                <ProtectedRoute allowedRoles={['FACILITY_MANAGER', 'BUSINESS_MANAGER', 'ADMIN']}>
                  <OverdueManagementPage />
                </ProtectedRoute>
              }
            />

            {/* 9. Shift Roster & Workforce: Facility Manager, Business Manager, Admin */}
            <Route
              path="shifts"
              element={
                <ProtectedRoute allowedRoles={['FACILITY_MANAGER', 'BUSINESS_MANAGER', 'ADMIN']}>
                  <ShiftRosterPage />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* Direct Friendly URLs with Automatic Route Guards */}
          <Route path="/customer" element={<Navigate to="/portal/customer" replace />} />
          <Route path="/staff" element={<Navigate to="/portal/staff" replace />} />
          <Route path="/facility-manager" element={<Navigate to="/portal/facility-manager" replace />} />
          <Route path="/manager" element={<Navigate to="/portal/facility-manager" replace />} />
          <Route path="/cashier" element={<Navigate to="/portal/cashier" replace />} />
          <Route path="/tickets" element={<Navigate to="/portal/tickets" replace />} />
          <Route path="/overdue" element={<Navigate to="/portal/overdue" replace />} />
          <Route path="/shifts" element={<Navigate to="/portal/shifts" replace />} />
          <Route path="/operations" element={<Navigate to="/portal/business-manager" replace />} />
          <Route path="/business" element={<Navigate to="/portal/business-manager" replace />} />
          <Route path="/admin" element={<Navigate to="/portal/admin" replace />} />

          {/* Fallback */}
          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </main>

      {/* Boxora AI Smart Assistant Chatbot */}
      <BoxoraChatWidget />
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
