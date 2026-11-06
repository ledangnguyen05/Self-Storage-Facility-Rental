import { api } from '../lib/axios'
import { Permission } from '../types'
import { PageResult } from './userService'

export const permissionService = {
  async getAll(params?: { search?: string; isActive?: boolean; page?: number; size?: number }) {
    const response = await api.get('/api/v1/permissions', { params: { size: 100, ...params } })
    return response.data?.data as PageResult<Permission>
  },

  async getById(id: string) {
    const response = await api.get(`/api/v1/permissions/${id}`)
    return response.data?.data as Permission
  },

  async create(data: { name: string; permissionGroup?: string; code?: string; description?: string }) {
    const permName = (data.name || data.code || '').trim().toUpperCase()
    const group = (data.permissionGroup || permName.split('_')[0] || 'SYSTEM').trim().toUpperCase()
    const payload = {
      name: permName,
      permissionGroup: group,
      description: data.description?.trim() || 'Quyền thực thi tác vụ hệ thống',
    }
    const response = await api.post('/api/v1/permissions', payload)
    return response.data?.data as Permission
  },

  async update(id: string, data: { name?: string; permissionGroup?: string; code?: string; description?: string }) {
    const payload = {
      name: data.name ? data.name.trim().toUpperCase() : undefined,
      permissionGroup: data.permissionGroup ? data.permissionGroup.trim().toUpperCase() : undefined,
      description: data.description?.trim(),
    }
    const response = await api.put(`/api/v1/permissions/${id}`, payload)
    return response.data?.data as Permission
  },

  async delete(id: string) {
    const response = await api.delete(`/api/v1/permissions/${id}`)
    return response.data
  },
}
