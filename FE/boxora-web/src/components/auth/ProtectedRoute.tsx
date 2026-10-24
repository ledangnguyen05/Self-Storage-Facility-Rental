import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { RoleType } from '../../types'
import { checkCustomerPortalAccess } from '../../utils/rentalAccess'

interface ProtectedRouteProps {
  allowedRoles?: RoleType[]
  children: React.ReactElement
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles, children }) => {
  const { user, role, isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-4 border-orange-500/20 border-t-orange-600 rounded-full animate-spin"></div>
        <span className="font-mono text-xs text-slate-500 font-semibold tracking-wider uppercase">
          Xác thực phiên làm việc Boxora...
        </span>
      </div>
    )
  }

  // If not logged in, redirect to /login
  if (!isAuthenticated || !user) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />
  }

  // Khách hàng chưa có kho đang thuê -> TUYỆT ĐỐI KHÔNG ĐƯỢC VÀO PORTAL
  // Chuyển hướng ngay sang dashboard riêng (/my-bookings) để xem các trạng thái đơn yêu cầu
  if (role === 'CUSTOMER' && location.pathname.startsWith('/portal')) {
    const access = checkCustomerPortalAccess(user)
    if (!access.hasAccess) {
      return <Navigate to="/my-bookings" replace />
    }
  }

  // If allowedRoles is specified and current role is not permitted, automatically route them to their proper portal
  if (allowedRoles && allowedRoles.length > 0 && role && !allowedRoles.includes(role)) {
    const getTargetPortal = (r: RoleType) => {
      switch (r) {
        case 'ADMIN':
          return '/portal/admin'
        case 'BUSINESS_MANAGER':
          return '/portal/business-manager'
        case 'FACILITY_MANAGER':
          return '/portal/facility-manager'
        case 'STAFF':
          return '/portal/staff'
        case 'CUSTOMER':
        default:
          return checkCustomerPortalAccess(user).hasAccess ? '/portal/customer' : '/my-bookings'
      }
    }
    return <Navigate to={getTargetPortal(role)} replace />
  }

  return children
}

export default ProtectedRoute
