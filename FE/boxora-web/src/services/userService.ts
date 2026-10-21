import { api } from '../lib/axios'
import type { PageResult, Permission, RequestOptions, Role, RoleType, User } from '../types'
import { normalizeUser, type RawUser } from '../utils/normalizeUser'

/** `UserCreateRequest`. The backend assigns the role from `roleId` (CUSTOMER when missing). */
export interface UserCreatePayload {
  username: string
  email: string
  password: string
  fullName?: string
  phone?: string
  roleId?: string
  facilityId?: string
  /** Not read by the backend: resolve it to `roleId` (roleService.getAll) before calling createUser. */
  roleName?: RoleType | string
}

/** `UserUpdateRequest`. Every field is optional (a partial update); `phone` is only validated when sent. */
export interface UserUpdatePayload {
  username?: string
  fullName?: string
  phone?: string
  isActive?: boolean
  roleId?: string
  facilityId?: string
}

const toUser = (item: RawUser): User => ({ ...normalizeUser(item), isActive: item.isActive !== false })

/** `UserSummaryResponse`: counts of the accounts matching a filter, independent of paging. */
export interface UserSummary {
  total: number
  active: number
  inactive: number
  /** Role name (ADMIN, STAFF...) to number of accounts. */
  byRole: Record<string, number>
}

export interface UserFilterParams {
  role?: string
  facilityId?: string
  search?: string
  isActive?: boolean
}

export const userService = {
  async getUsers(params?: { search?: string; isActive?: boolean; page?: number; size?: number }, opts?: RequestOptions) {
    const response = await api.get('/api/v1/users', { params, signal: opts?.signal })
    return response.data?.data as PageResult<User>
  },

  /** Normalized users (role resolved from role / roleName). `'ALL'` filters are dropped. */
  async getAllUsers(
    params?: { role?: string; facilityId?: string; search?: string; isActive?: boolean; size?: number },
    opts?: RequestOptions
  ) {
    const queryParams: Record<string, string | number | boolean> = { size: params?.size || 100 }
    if (params?.role && params.role !== 'ALL') queryParams.role = params.role
    if (params?.facilityId && params.facilityId !== 'ALL' && params.facilityId.trim() !== '') {
      queryParams.facilityId = params.facilityId
    }
    if (params?.search && params.search.trim() !== '') queryParams.search = params.search.trim()
    if (params?.isActive !== undefined) queryParams.isActive = params.isActive

    const response = await api.get('/api/v1/users', { params: queryParams, signal: opts?.signal })
    const rawContent = (response.data?.data?.content || []) as RawUser[]
    return { data: rawContent.map(toUser) }
  },

  /** Account counts for the same filters as the list (`'ALL'` and blank filters are dropped). */
  async getSummary(params?: UserFilterParams, opts?: RequestOptions): Promise<UserSummary> {
    const queryParams: Record<string, string | boolean> = {}
    if (params?.role && params.role !== 'ALL') queryParams.role = params.role
    if (params?.facilityId && params.facilityId !== 'ALL' && params.facilityId.trim() !== '') queryParams.facilityId = params.facilityId
    if (params?.search && params.search.trim() !== '') queryParams.search = params.search.trim()
    if (params?.isActive !== undefined) queryParams.isActive = params.isActive

    const response = await api.get('/api/v1/users/summary', { params: queryParams, signal: opts?.signal })
    const data = (response.data?.data ?? {}) as Partial<UserSummary>
    return {
      total: data.total ?? 0,
      active: data.active ?? 0,
      inactive: data.inactive ?? 0,
      byRole: data.byRole ?? {},
    }
  },

  async createUser(data: UserCreatePayload) {
    const response = await api.post('/api/v1/users', data)
    return response.data
  },

  async toggleActive(id: string) {
    const response = await api.patch(`/api/v1/users/${id}/toggle-active`)
    return response.data?.data as User
  },

  async updateUser(id: string, data: UserUpdatePayload) {
    const response = await api.put(`/api/v1/users/${id}`, data)
    return response.data?.data as User
  },

  async deleteUser(id: string) {
    const response = await api.delete(`/api/v1/users/${id}`)
    return response.data
  },

  async getRoles(opts?: RequestOptions) {
    const response = await api.get('/api/v1/roles', { signal: opts?.signal })
    return response.data?.data as PageResult<Role>
  },

  async getPermissions(opts?: RequestOptions) {
    const response = await api.get('/api/v1/permissions', { signal: opts?.signal })
    return response.data?.data as PageResult<Permission>
  },
}
