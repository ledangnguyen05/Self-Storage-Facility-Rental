import { api } from '../lib/axios'
import type { PageResult, Role, RolePermission } from '../types'

export const roleService = {
  async getAll(params?: { search?: string; isActive?: boolean; page?: number; size?: number }) {
    const response = await api.get('/api/v1/roles', { params })
    return response.data?.data as PageResult<Role>
  },

  async getById(id: string) {
    const response = await api.get(`/api/v1/roles/${id}`)
    return response.data?.data as Role
  },

  async create(data: { name: string; description?: string }) {
    const response = await api.post('/api/v1/roles', data)
    return response.data?.data as Role
  },

  async update(id: string, data: { name: string; description?: string }) {
    const response = await api.put(`/api/v1/roles/${id}`, data)
    return response.data?.data as Role
  },

  async delete(id: string) {
    const response = await api.delete(`/api/v1/roles/${id}`)
    return response.data
  },

  /**
   * Permissions the role currently holds. The backend also returns revoked assignments (kept for history),
   * so only the active ones are returned here.
   */
  async getPermissionsByRoleId(roleId: string) {
    const response = await api.get(`/api/v1/role-permissions/by-role/${roleId}`)
    const rows = (response.data?.data ?? []) as RolePermission[]
    return rows.filter(item => item.isActive !== false)
  },

  /**
   * REPLACES the role's permission set: permissions in `permissionIds` are granted, every other permission of
   * the role is revoked, and an empty list revokes all of them. Resolves to the active set after saving.
   */
  async bulkAssignPermissions(roleId: string, permissionIds: string[]) {
    const response = await api.post('/api/v1/role-permissions/bulk-assign', {
      roleId,
      permissionIds,
    })
    return ((response.data?.data ?? []) as RolePermission[]).filter(item => item.isActive !== false)
  },
}
