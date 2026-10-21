import { ROLES } from '../constants/routes'
import { getJwtRole } from '../lib/jwt'
import type { RoleType, User } from '../types'

/** Loose shape of a user as returned by the backend (`UserResponse`) or stored by older builds. */
export interface RawUser {
  id?: string | null
  username?: string | null
  email?: string | null
  fullName?: string | null
  phone?: string | null
  avatar?: string | null
  isActive?: boolean | null
  roleId?: string | null
  roleName?: string | null
  role?: { id?: string | null; name?: string | null; description?: string | null } | string | null
  facilityId?: string | null
  facilityName?: string | null
  facilityCode?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

/** `'admin'`, `'ROLE_ADMIN'` → `'ADMIN'`; anything that is not a known role → undefined. */
export function toRoleType(value: unknown): RoleType | undefined {
  if (typeof value !== 'string') return undefined
  const key = value.trim().toUpperCase().replace(/^ROLE_/, '')
  return (ROLES as readonly string[]).includes(key) ? (key as RoleType) : undefined
}

/** Role from `role.name`, then `roleName`, then the access token's `role` claim. */
export function resolveUserRole(raw: RawUser | null | undefined, accessToken?: string | null): RoleType | undefined {
  const roleObjectName = typeof raw?.role === 'string' ? raw.role : raw?.role?.name
  return toRoleType(roleObjectName) ?? toRoleType(raw?.roleName) ?? toRoleType(getJwtRole(accessToken))
}

const str = (value: string | null | undefined): string | undefined =>
  typeof value === 'string' && value !== '' ? value : undefined

/**
 * Converts any backend / stored user into the app `User` shape. Keys whose value
 * is unknown are omitted, so `{ ...currentUser, ...normalizeUser(partial) }`
 * never wipes existing fields.
 */
export function normalizeUser(raw: RawUser | null | undefined, accessToken?: string | null): User {
  const roleName = resolveUserRole(raw, accessToken)
  const roleObject = raw?.role && typeof raw.role === 'object' ? raw.role : undefined
  const roleId = str(roleObject?.id) ?? str(raw?.roleId)

  const user: User = {
    // Required on User; omitted (not blanked) when unknown so partial merges stay safe.
    id: str(raw?.id) as string,
    username: str(raw?.username) as string,
    email: str(raw?.email) as string,
    fullName: str(raw?.fullName),
    phone: str(raw?.phone),
    avatar: str(raw?.avatar),
    role: roleName
      ? { id: roleId, name: roleName, description: str(roleObject?.description) ?? roleName }
      : undefined,
    roleName: roleName ?? str(raw?.roleName),
    roleId,
    facilityId: str(raw?.facilityId),
    facilityName: str(raw?.facilityName),
    facilityCode: str(raw?.facilityCode),
    isActive: raw?.isActive === undefined || raw?.isActive === null ? undefined : raw.isActive !== false,
    createdAt: str(raw?.createdAt),
    updatedAt: str(raw?.updatedAt),
  }

  return Object.fromEntries(Object.entries(user).filter(([, v]) => v !== undefined)) as unknown as User
}
