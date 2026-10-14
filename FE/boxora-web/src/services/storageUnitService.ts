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

  async adjustUnitTypePrice(
    id: string,
    data: {
      newPrice: number
      reason: string
      effectiveFrom?: string
      cascadeToAvailableUnits?: boolean
    }
  ) {
    const response = await api.post(`/api/v1/unit-types/${id}/price-adjustment`, {
      ...data,
      cascadeToAvailableUnits: data.cascadeToAvailableUnits ?? true,
    })
    return response.data?.data
  },

  async updateUnitType(
    id: string,
    data: {
      typeName?: string
      dimensions?: string
      areaSqm?: number
      depositAmount?: number
      basePricePerMonth?: number
      priceChangeReason?: string
    }
  ) {
    const response = await api.put(`/api/v1/unit-types/${id}`, data)
    return response.data?.data
  },
}

