export interface CustomDiscount {
  id: string
  months: number
  percent: number
  label: string
  isActive: boolean
}

const DISCOUNTS_SYNC_KEY = 'boxora_discounts_last_sync'
const DISCOUNTS_UPDATED_EVENT = 'boxora_custom_discounts_updated'

export const customDiscountService = {
  /**
   * Retrieves all custom discounts for a facility.
   * Checks facility-specific storage first; if none exists yet, falls back to legacy/global discounts.
   */
  getAllDiscounts(facilityId?: string | null): CustomDiscount[] {
    const effectiveFacId =
      facilityId ||
      localStorage.getItem('boxora_selected_facility_id') ||
      localStorage.getItem('boxora_admin_selected_facility_id')

    try {
      if (effectiveFacId) {
        const facSaved = localStorage.getItem(`boxora_custom_discounts_${effectiveFacId}`)
        if (facSaved) {
          const parsed = JSON.parse(facSaved)
          if (Array.isArray(parsed) && parsed.length > 0) {
            return this.normalizeDiscounts(parsed)
          }
        }
      }

      // Fallback to legacy/global storage key
      const globalSaved = localStorage.getItem('boxora_custom_discounts')
      if (globalSaved) {
        const parsed = JSON.parse(globalSaved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          return this.normalizeDiscounts(parsed)
        }
      }
      return []
    } catch {
      return []
    }
  },

  /**
   * Retrieves only active custom discounts (isActive === true && percent > 0)
   */
  getActiveDiscounts(facilityId?: string | null): CustomDiscount[] {
    const all = this.getAllDiscounts(facilityId)
    return all.filter((d) => (d.isActive === true || String(d.isActive) === 'true') && Number(d.percent) > 0)
  },

  /**
   * Saves custom discounts per facility, and dispatches sync events
   */
  saveDiscounts(facilityId: string | null | undefined, discounts: CustomDiscount[]): void {
    const effectiveFacId =
      facilityId ||
      localStorage.getItem('boxora_admin_selected_facility_id') ||
      localStorage.getItem('boxora_selected_facility_id')

    const normalized = this.normalizeDiscounts(discounts)
    const json = JSON.stringify(normalized)

    try {
      if (effectiveFacId) {
        localStorage.setItem(`boxora_custom_discounts_${effectiveFacId}`, json)
      }
      // Also update global fallback so any unresolved lookup can access it
      localStorage.setItem('boxora_custom_discounts', json)
      localStorage.setItem(DISCOUNTS_SYNC_KEY, `${effectiveFacId || 'global'}_${Date.now()}`)

      // Dispatch custom event in current window
      window.dispatchEvent(
        new CustomEvent(DISCOUNTS_UPDATED_EVENT, {
          detail: { facilityId: effectiveFacId, discounts: normalized },
        })
      )
      // Also plain event for generic listeners
      window.dispatchEvent(new Event(DISCOUNTS_UPDATED_EVENT))
    } catch (e) {
      console.error('Failed to save custom discounts to localStorage:', e)
    }
  },

  /**
   * Normalizes discount objects to ensure correct types
   */
  normalizeDiscounts(items: any[]): CustomDiscount[] {
    if (!Array.isArray(items)) return []
    return items
      .filter((it) => it && typeof it === 'object')
      .map((it) => ({
        id: String(it.id || `disc_${it.months || Date.now()}`),
        months: Number(it.months) || 1,
        percent: Number(it.percent) || 0,
        label: String(it.label || `Kỳ hạn ưu đãi ${it.months} tháng`),
        isActive: it.isActive === true || it.isActive === 'true',
      }))
      .sort((a, b) => a.months - b.months)
  },
}
