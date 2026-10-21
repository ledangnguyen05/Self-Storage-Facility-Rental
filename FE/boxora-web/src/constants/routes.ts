import type { RoleType } from '../types'

/** Every role, in display order. */
export const ROLES: readonly RoleType[] = ['ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER', 'STAFF', 'CUSTOMER']

/** Landing portal for each role. The only role → path mapping in the app. */
export const PORTAL_BY_ROLE: Record<RoleType, string> = {
  ADMIN: '/portal/admin',
  BUSINESS_MANAGER: '/portal/business-manager',
  FACILITY_MANAGER: '/portal/facility-manager',
  STAFF: '/portal/staff',
  CUSTOMER: '/portal/customer',
}

/** Portal sub-routes and the roles allowed to open each (used by App routes and redirects). */
export const PORTAL_ROUTE_ROLES = {
  '/portal/customer': ['CUSTOMER', 'ADMIN'],
  '/portal/staff': ['STAFF', 'ADMIN'],
  '/portal/facility-manager': ['FACILITY_MANAGER', 'BUSINESS_MANAGER', 'ADMIN'],
  '/portal/business-manager': ['BUSINESS_MANAGER', 'ADMIN'],
  '/portal/admin': ['ADMIN', 'BUSINESS_MANAGER'],
  '/portal/cashier': ['STAFF', 'FACILITY_MANAGER', 'BUSINESS_MANAGER', 'ADMIN'],
  '/portal/tickets': ['STAFF', 'FACILITY_MANAGER', 'BUSINESS_MANAGER', 'ADMIN'],
  '/portal/overdue': ['FACILITY_MANAGER', 'BUSINESS_MANAGER', 'ADMIN'],
  '/portal/shifts': ['FACILITY_MANAGER', 'BUSINESS_MANAGER', 'ADMIN'],
  '/portal/finance': ['STAFF', 'FACILITY_MANAGER', 'BUSINESS_MANAGER', 'ADMIN'],
} as const satisfies Record<string, readonly RoleType[]>

export type PortalPath = keyof typeof PORTAL_ROUTE_ROLES

/** Public, unauthenticated pages that are valid post-login redirect targets. */
export const PUBLIC_ROUTES = [
  '/',
  '/landing',
  '/units',
  '/explore-units',
  '/payment-result',
  '/terms',
  '/standards',
  '/policies',
] as const

export const AUTH_ROUTES = { login: '/login', register: '/register', resetPassword: '/reset-password' } as const

const isRole = (value: unknown): value is RoleType =>
  typeof value === 'string' && (ROLES as readonly string[]).includes(value)

/** Portal path for a role. Unknown or missing roles fall back to the customer portal. */
export function getPortalForRole(role: RoleType | string | null | undefined): string {
  return isRole(role) ? PORTAL_BY_ROLE[role] : PORTAL_BY_ROLE.CUSTOMER
}

/** Builds `/login?redirect=…` for a protected path. */
export function buildLoginRedirect(path: string): string {
  return `${AUTH_ROUTES.login}?redirect=${encodeURIComponent(path)}`
}

/**
 * Normalises a candidate redirect to a same-origin path (pathname + search + hash).
 * Returns null for absolute URLs, protocol-relative URLs, backslash tricks and
 * anything that resolves to another origin.
 */
function toSameOriginPath(path: string | null | undefined): URL | null {
  if (!path || typeof path !== 'string') return null
  const trimmed = path.trim()
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) return null
  for (let i = 0; i < trimmed.length; i += 1) {
    if (trimmed.charCodeAt(i) < 0x20) return null
  }
  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
    const url = new URL(trimmed, origin)
    return url.origin === origin ? url : null
  } catch {
    return null
  }
}

/** True for same-origin `/portal…` paths or one of PUBLIC_ROUTES. */
export function isSafeRedirect(path: string | null | undefined): boolean {
  const url = toSameOriginPath(path)
  if (!url) return false
  const { pathname } = url
  if (pathname === '/portal' || pathname.startsWith('/portal/')) return true
  return (PUBLIC_ROUTES as readonly string[]).includes(pathname)
}

/** Whether `role` may open `path` according to PORTAL_ROUTE_ROLES (public paths are always allowed). */
export function canRoleAccessPath(role: RoleType | string | null | undefined, path: string): boolean {
  const url = toSameOriginPath(path)
  if (!url) return false
  const { pathname } = url
  if (!pathname.startsWith('/portal')) return true
  if (pathname === '/portal' || pathname === '/portal/') return true
  const entry = (Object.keys(PORTAL_ROUTE_ROLES) as PortalPath[]).find(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  )
  if (!entry) return false
  return isRole(role) && (PORTAL_ROUTE_ROLES[entry] as readonly RoleType[]).includes(role)
}

/**
 * Where to send a user after login: the `redirect` query value when it is safe
 * and allowed for the role, otherwise the role's portal.
 * `navigate(getPostLoginPath(user.role?.name, searchParams.get('redirect')))`
 */
export function getPostLoginPath(role: RoleType | string | null | undefined, redirect?: string | null): string {
  if (redirect) {
    let decoded = redirect
    try {
      decoded = decodeURIComponent(redirect)
    } catch {
      decoded = redirect
    }
    if (isSafeRedirect(decoded) && canRoleAccessPath(role, decoded)) {
      const url = toSameOriginPath(decoded)
      if (url) return `${url.pathname}${url.search}${url.hash}`
    }
  }
  return getPortalForRole(role)
}
