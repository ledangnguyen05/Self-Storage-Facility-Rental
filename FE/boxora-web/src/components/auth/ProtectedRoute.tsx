import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { buildLoginRedirect, getPortalForRole } from '../../constants/routes'
import { useAuth } from '../../context/AuthContext'
import type { RoleType } from '../../types'

interface ProtectedRouteProps {
  /** Roles allowed to see `children`. Omit to only require a signed-in user. */
  allowedRoles?: readonly RoleType[]
  children: React.ReactElement
}

/** Neutral full-area loading state used while the session is being resolved. */
export const SessionLoading: React.FC<{ label?: string }> = ({ label = 'Đang tải phiên làm việc…' }) => (
  <div className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-3 bg-canvas text-fg-muted" role="status" aria-live="polite">
    <span className="h-6 w-6 animate-spin rounded-full border-2 border-line-strong border-t-accent" aria-hidden="true" />
    <span className="text-sm">{label}</span>
  </div>
)

/**
 * Redirects anonymous users to `/login?redirect=…` and users whose role is not
 * in `allowedRoles` to their own portal.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles, children }) => {
  const { user, role, isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return <SessionLoading />

  if (!isAuthenticated || !user) {
    return <Navigate to={buildLoginRedirect(`${location.pathname}${location.search}`)} replace />
  }

  if (allowedRoles && allowedRoles.length > 0 && role && !allowedRoles.includes(role)) {
    return <Navigate to={getPortalForRole(role)} replace />
  }

  return children
}

export default ProtectedRoute
