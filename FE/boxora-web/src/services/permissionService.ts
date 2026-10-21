import { api } from '../lib/axios'
import type { PageResult, Permission } from '../types'

export const permissionService = {
  async getAll(params?: { search?: string; isActive?: boolean; page?: number; size?: number }) {
    const response = await api.get('/api/v1/permissions', { params: { size: 100, ...params } })
    return response.data?.data as PageResult<Permission>
  },

  async getById(id: string) {
    const response = await api.get(`/api/v1/permissions/${id}`)
    return response.data?.data as Permission
  },

  /** `PermissionCreateRequest`: name (code) and permissionGroup are required. */
  async create(data: { name: string; permissionGroup: string; description?: string }) {
    const response = await api.post('/api/v1/permissions', data)
    return response.data?.data as Permission
  },

  /** `PermissionUpdateRequest`: name and permissionGroup are required. */
  async update(id: string, data: { name: string; permissionGroup: string; description?: string; isActive?: boolean }) {
    const response = await api.put(`/api/v1/permissions/${id}`, data)
    return response.data?.data as Permission
  },

  async delete(id: string) {
    const response = await api.delete(`/api/v1/permissions/${id}`)
    return response.data
  },
}
