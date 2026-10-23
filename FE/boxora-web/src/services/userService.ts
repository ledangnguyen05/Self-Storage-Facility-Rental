import { api } from '../lib/axios'
import { User } from '../types'

export interface PageResult<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  first: boolean
  last: boolean
}

export const userService = {
  async getUsers(params?: { search?: string; isActive?: boolean; page?: number; size?: number }) {
    const response = await api.get('/api/v1/users', { params })
    return response.data?.data as PageResult<User>
  },

  async getAllUsers(params?: { role?: string; facilityId?: string; search?: string; isActive?: boolean; size?: number }) {
    const queryParams: Record<string, any> = { size: params?.size || 100 }
    if (params?.role && params.role !== 'ALL') queryParams.role = params.role
    if (params?.facilityId && params.facilityId !== 'ALL' && params.facilityId.trim() !== '') {
      queryParams.facilityId = params.facilityId
    }
    if (params?.search && params.search.trim() !== '') queryParams.search = params.search.trim()
    if (params?.isActive !== undefined) queryParams.isActive = params.isActive

    const response = await api.get('/api/v1/users', { params: queryParams })
    const rawContent: any[] = response.data?.data?.content || []

    const normalizedUsers: User[] = rawContent.map((item: any) => ({
      id: item.id,
      username: item.username,
      email: item.email,
      fullName: item.fullName,
      phone: item.phone,
      avatar: item.avatar,
      role: item.role || (item.roleName ? {
        id: item.roleId,
        name: item.roleName,
        description: item.roleName
      } : undefined),
      roleName: item.roleName || item.role?.name,
      roleId: item.roleId || item.role?.id,
      facilityId: item.facilityId,
      facilityName: item.facilityName,
      facilityCode: item.facilityCode,
      isActive: item.isActive !== false,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    }))

    return { data: normalizedUsers }
  },

  async createUser(data: any) {
    const response = await api.post('/api/v1/users', data)
    return response.data
  },

  async toggleActive(id: string) {
    const response = await api.patch(`/api/v1/users/${id}/toggle-active`)
    return response.data?.data as User
  },

  async updateUser(id: string, data: any) {
    const response = await api.put(`/api/v1/users/${id}`, data)
    return response.data?.data as User
  },

  async deleteUser(id: string) {
    const response = await api.delete(`/api/v1/users/${id}`)
    return response.data
  },

  async getRoles() {
    const response = await api.get('/api/v1/roles')
    return response.data?.data
  },

  async getPermissions() {
    const response = await api.get('/api/v1/permissions')
    return response.data?.data
  },
}
