import { api } from '../lib/axios'
import { StorageUnit } from '../types'

export const storageUnitService = {
  async getUnits(params?: { facilityId?: string; floorLevel?: string; status?: string }) {
    const response = await api.get('/api/v1/storage-units', { params })
    return response.data?.data as StorageUnit[]
  },

  async getById(id: string) {
    const response = await api.get(`/api/v1/storage-units/${id}`)
    return response.data?.data as StorageUnit
  },

  async createUnit(data: Partial<StorageUnit> & { unitTypeId: string }) {
    const response = await api.post('/api/v1/storage-units', data)
    return response.data?.data as StorageUnit
  },

  async updateUnit(id: string, data: Partial<StorageUnit>) {
    const response = await api.put(`/api/v1/storage-units/${id}`, data)
    return response.data?.data as StorageUnit
  },

  async deleteUnit(id: string) {
    const response = await api.delete(`/api/v1/storage-units/${id}`)
    return response.data
  },

  async toggleMaintenance(id: string) {
    const response = await api.patch(`/api/v1/storage-units/${id}/toggle-maintenance`)
    return response.data?.data as StorageUnit
  },

  async getUnitTypes() {
    const response = await api.get('/api/v1/unit-types')
    return response.data?.data
  },
}

