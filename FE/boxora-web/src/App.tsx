import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { Navbar } from './components/layout/Navbar'
import { Footer } from './components/layout/Footer'
import { DashboardLayout } from './components/layout/DashboardLayout'

// Public Pages
import { HomePage } from './pages/public/HomePage'
import { FacilitiesPage } from './pages/public/FacilitiesPage'
import { LoginPage } from './pages/public/LoginPage'
import { RegisterPage } from './pages/public/RegisterPage'

// Portal Dashboards
import { CustomerDashboard } from './pages/customer/CustomerDashboard'
import { StaffDashboard } from './pages/staff/StaffDashboard'
import { ManagerDashboard } from './pages/manager/ManagerDashboard'
import { OperationsDashboard } from './pages/operations/OperationsDashboard'
import { AdminDashboard } from './pages/admin/AdminDashboard'

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="min-h-screen flex flex-col bg-[var(--surface-canvas)] font-sans antialiased text-[var(--color-primary)]">
          <Navbar />
          
          <main className="flex-1">
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<HomePage />} />
              <Route path="/facilities" element={<FacilitiesPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Authenticated Role Portals wrapped in DashboardLayout */}
              <Route path="/portal" element={<DashboardLayout />}>
                <Route index element={<Navigate to="/portal/customer" replace />} />
                <Route path="customer" element={<CustomerDashboard />} />
                <Route path="staff" element={<StaffDashboard />} />
                <Route path="facility-manager" element={<ManagerDashboard />} />
                <Route path="business-manager" element={<OperationsDashboard />} />
                <Route path="admin" element={<AdminDashboard />} />
              </Route>

              {/* Convenience Shortcuts */}
              <Route path="/dashboard" element={<Navigate to="/portal/customer" replace />} />
              <Route path="/admin" element={<Navigate to="/portal/admin" replace />} />
              <Route path="/staff" element={<Navigate to="/portal/staff" replace />} />
              <Route path="/manager" element={<Navigate to="/portal/facility-manager" replace />} />
              <Route path="/operations" element={<Navigate to="/portal/business-manager" replace />} />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>

          <Footer />
        </div>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
