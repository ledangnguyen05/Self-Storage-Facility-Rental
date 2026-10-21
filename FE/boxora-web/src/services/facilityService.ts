import { api } from '../lib/axios'
import type { Facility, PageResult, RequestOptions } from '../types'

/** `/api/v1/facilities`. Facility policies live in `facilityPolicyService`. */
export const facilityService = {
  /**
   * `scope: 'public'` is for the public site (home, units explorer, contact menu): every ACTIVE branch, never narrowed
   * to the signed-in staff member's facility, and without manager details. Portals omit it.
   */
  async getFacilities(
    params?: { search?: string; status?: string; page?: number; size?: number; scope?: 'public' },
    opts?: RequestOptions,
  ) {
    const response = await api.get('/api/v1/facilities', { params: { size: 50, ...params }, signal: opts?.signal })
    return response.data?.data as PageResult<Facility>
  },

  /** Active branches with real `totalUnits` / `availableUnits` for the public pages. */
  async getPublicFacilities(opts?: RequestOptions) {
    const page = await facilityService.getFacilities({ scope: 'public', size: 100 }, opts)
    return Array.isArray(page?.content) ? page.content : []
  },

  async getFacilityById(id: string, opts?: RequestOptions) {
    const response = await api.get(`/api/v1/facilities/${id}`, { signal: opts?.signal })
    return response.data?.data as Facility
  },

  async createFacility(data: Partial<Facility> & { status?: string }) {
    const response = await api.post('/api/v1/facilities', data)
    return response.data?.data as Facility
  },

  async updateFacility(id: string, data: Partial<Facility> & { clearCoordinates?: boolean }) {
    const response = await api.put(`/api/v1/facilities/${id}`, data)
    return response.data?.data as Facility
  },

  async deleteFacility(id: string) {
    const response = await api.delete(`/api/v1/facilities/${id}`)
    return response.data
  },
}
