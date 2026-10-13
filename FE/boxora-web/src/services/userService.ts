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
    const response = await api.get('/api/v1/users', { params: { size: 100, ...params } })
    return response.data?.data?.content ? { data: response.data.data.content } : { data: [] }
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
