import { api } from '../lib/axios'
import type { RequestOptions, StorageUnit, UnitType } from '../types'

export interface StorageUnitCreateRequest {
  unitCode: string
  floorLevel: string
  facilityId: string
  unitTypeId: string
  pricePerMonth?: number
}

export const storageUnitService = {
  /**
   * `scope: 'public'` is for the public "Thuê kho" page: units of every ACTIVE branch (occupied ones included, shown as
   * rented), never narrowed to the signed-in staff member's facility, and always without tenant data.
   */
  async getUnits(params?: { facilityId?: string; floorLevel?: string; status?: string; scope?: 'public' }, opts?: RequestOptions) {
    const response = await api.get('/api/v1/storage-units', { params, signal: opts?.signal })
    return response.data?.data as StorageUnit[]
  },

  async getPublicUnits(opts?: RequestOptions) {
    const units = await storageUnitService.getUnits({ scope: 'public' }, opts)
    return Array.isArray(units) ? units : []
  },

  async getById(id: string, opts?: RequestOptions) {
    const response = await api.get(`/api/v1/storage-units/${id}`, { signal: opts?.signal })
    return response.data?.data as StorageUnit
  },

  async createUnit(data: StorageUnitCreateRequest): Promise<StorageUnit> {
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

  async getUnitTypes(opts?: RequestOptions): Promise<UnitType[]> {
    const response = await api.get('/api/v1/unit-types', { signal: opts?.signal })
    return response.data?.data as UnitType[]
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
    return response.data?.data as UnitType
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
    return response.data?.data as UnitType
  },
}

