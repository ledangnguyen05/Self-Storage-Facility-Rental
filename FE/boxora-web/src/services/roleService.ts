import { api } from '../lib/axios'
import { Role, RolePermission } from '../types'
import { PageResult } from './userService'

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

  async getPermissionsByRoleId(roleId: string) {
    const response = await api.get(`/api/v1/role-permissions/by-role/${roleId}`)
    return response.data?.data as RolePermission[]
  },

  async bulkAssignPermissions(roleId: string, permissionIds: string[]) {
    const response = await api.post('/api/v1/role-permissions/bulk-assign', {
      roleId,
      permissionIds,
    })
    return response.data?.data as RolePermission[]
  },
}
