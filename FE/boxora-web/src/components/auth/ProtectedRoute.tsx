import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { RoleType } from '../../types'
import { checkCustomerPortalAccess } from '../../utils/rentalAccess'
import { BoxoraMinimalLoader } from '../common/TabDataLoadingGate'

interface ProtectedRouteProps {
  allowedRoles?: RoleType[]
  children: React.ReactElement
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles, children }) => {
  const { user, role, isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <BoxoraMinimalLoader />
      </div>
    )
  }

  // If not logged in, redirect to /login
  if (!isAuthenticated || !user) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />
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
          return '/portal/customer'
      }
    }
    return <Navigate to={getTargetPortal(role)} replace />
  }

  return children
}

export default ProtectedRoute
