import { UnitType, FacilityPolicy, FacilityPolicyPrice } from '../types'
import { facilityPolicyService } from './facilityPolicyService'

export interface FacilityUnitTypeOverride {
  unitTypeId: string
  isActive?: boolean
  basePricePerMonth?: number
  depositAmount?: number
  acPricePerMonth?: number | null
  isDeleted?: boolean
  isCustomForFacility?: boolean
  typeName?: string
  dimensions?: string
  areaSqm?: number
  volumeM3?: number
  lengthM?: number
  widthM?: number
  heightM?: number
  imageUrl?: string
}

const STORAGE_PREFIX = 'boxora_facility_unittypes_'
export const FACILITY_UNIT_TYPES_UPDATED_EVENT = 'boxora_facility_unittypes_updated'

export const facilityUnitTypeService = {
  /**
   * Retrieves all overrides and custom unit types for a given facility from localStorage.
   */
  getFacilityOverrides(facilityId: string): Record<string, FacilityUnitTypeOverride> {
    if (!facilityId) return {}
    try {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}${facilityId}`)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed === 'object') {
          return parsed
        }
      }
      return {}
    } catch {
      return {}
    }
  },

  /**
   * Saves the overrides map for a facility to localStorage and dispatches sync events.
   */
  saveFacilityOverrides(facilityId: string, overrides: Record<string, FacilityUnitTypeOverride>): void {
    if (!facilityId) return
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${facilityId}`, JSON.stringify(overrides))
      localStorage.setItem('boxora_facility_unittypes_last_sync', `${facilityId}_${Date.now()}`)

      window.dispatchEvent(
        new CustomEvent(FACILITY_UNIT_TYPES_UPDATED_EVENT, {
          detail: { facilityId },
        })
      )
      window.dispatchEvent(new Event(FACILITY_UNIT_TYPES_UPDATED_EVENT))
      window.dispatchEvent(new Event('boxora_unit_types_updated'))
    } catch (e) {
      console.error('Failed to save facility unit types to localStorage:', e)
    }
  },

  /**
   * Merges global unit types with facility policy prices and facility-specific overrides.
   */
  getFacilityUnitTypes(
    facilityId: string,
    globalTypes: UnitType[],
    policy?: FacilityPolicy | null
  ): UnitType[] {
    if (!facilityId) return globalTypes

    const overrides = this.getFacilityOverrides(facilityId)
    const policyPrices = policy?.prices || []

    const result: UnitType[] = []
    const processedIds = new Set<string>()

    // 1. Process global types with per-facility policy prices and overrides
    for (const gt of globalTypes) {
      const ov = overrides[gt.id]
      if (ov?.isDeleted) continue

      processedIds.add(gt.id)

      const pp = policyPrices.find((p) => p.unitTypeId === gt.id)

      const basePrice =
        ov?.basePricePerMonth !== undefined
          ? Number(ov.basePricePerMonth)
          : pp?.monthlyPrice !== undefined
          ? Number(pp.monthlyPrice)
          : Number(gt.basePricePerMonth || 0)

      const acPrice =
        ov?.acPricePerMonth !== undefined
          ? ov.acPricePerMonth !== null && Number(ov.acPricePerMonth) > 0 ? Number(ov.acPricePerMonth) : undefined
          : pp?.acMonthlyPrice !== undefined
          ? pp.acMonthlyPrice !== null && Number(pp.acMonthlyPrice) > 0 ? Number(pp.acMonthlyPrice) : undefined
          : gt.acPricePerMonth !== undefined && gt.acPricePerMonth !== null && Number(gt.acPricePerMonth) > 0
          ? Number(gt.acPricePerMonth)
          : undefined

      const isActive =
        ov?.isActive !== undefined ? Boolean(ov.isActive) : gt.isActive ?? true

      result.push({
        ...gt,
        typeName: ov?.typeName || gt.typeName,
        dimensions: ov?.dimensions || gt.dimensions,
        areaSqm: ov?.areaSqm ?? gt.areaSqm,
        volumeM3: ov?.volumeM3 ?? gt.volumeM3,
        lengthM: ov?.lengthM ?? gt.lengthM,
        widthM: ov?.widthM ?? gt.widthM,
        heightM: ov?.heightM ?? gt.heightM,
        basePricePerMonth: basePrice,
        acPricePerMonth: acPrice,
        isActive,
        imageUrl: ov?.imageUrl !== undefined ? ov.imageUrl : gt.imageUrl,
      })
    }

    // 2. Append facility-specific custom unit types
    for (const [id, ov] of Object.entries(overrides)) {
      if (processedIds.has(id) || ov.isDeleted) continue
      if (ov.isCustomForFacility) {
        result.push({
          id,
          typeName: ov.typeName || 'Kho tùy chỉnh',
          dimensions: ov.dimensions || `${ov.lengthM || 2}m x ${ov.widthM || 2}m x ${ov.heightM || 2.5}m`,
          areaSqm: ov.areaSqm ?? 4,
          volumeM3: ov.volumeM3 ?? 10,
          lengthM: ov.lengthM,
          widthM: ov.widthM,
          heightM: ov.heightM,
          basePricePerMonth: Number(ov.basePricePerMonth || 0),
          depositAmount: Number(ov.basePricePerMonth || 0),
          acPricePerMonth: ov.acPricePerMonth != null && Number(ov.acPricePerMonth) > 0 ? Number(ov.acPricePerMonth) : undefined,
          isActive: ov.isActive ?? true,
          imageUrl: ov.imageUrl,
        })
      }
    }

    return result.sort((a, b) => (a.areaSqm || 0) - (b.areaSqm || 0))
  },

  /**
   * Updates a unit type's configuration or prices strictly for a facility.
   * Also syncs with the facility policy prices backend if policy is provided.
   */
  async saveFacilityUnitType(
    facilityId: string,
    unitType: UnitType,
    policy?: FacilityPolicy | null
  ): Promise<UnitType> {
    const overrides = this.getFacilityOverrides(facilityId)
    const existing = overrides[unitType.id] || {}

    const updatedOverride: FacilityUnitTypeOverride = {
      ...existing,
      unitTypeId: unitType.id,
      typeName: unitType.typeName,
      dimensions: unitType.dimensions,
      areaSqm: unitType.areaSqm,
      volumeM3: unitType.volumeM3,
      lengthM: unitType.lengthM,
      widthM: unitType.widthM,
      heightM: unitType.heightM,
      basePricePerMonth: unitType.basePricePerMonth,
      acPricePerMonth: unitType.acPricePerMonth != null && Number(unitType.acPricePerMonth) > 0 ? Number(unitType.acPricePerMonth) : null,
      isActive: unitType.isActive ?? true,
      imageUrl: unitType.imageUrl !== undefined ? unitType.imageUrl : existing.imageUrl,
    }

    overrides[unitType.id] = updatedOverride
    this.saveFacilityOverrides(facilityId, overrides)

    // Sync price to backend facility policy if policy is available
    if (policy && policy.id) {
      try {
        const currentPrices: FacilityPolicyPrice[] = policy.prices ? [...policy.prices] : []
        const existingIdx = currentPrices.findIndex((p) => p.unitTypeId === unitType.id)
        const priceItem: FacilityPolicyPrice = {
          unitTypeId: unitType.id,
          monthlyPrice: unitType.basePricePerMonth || 0,
          acMonthlyPrice: unitType.acPricePerMonth != null && Number(unitType.acPricePerMonth) > 0 ? Number(unitType.acPricePerMonth) : undefined,
          discount3MonthPercent: 0,
          discount6MonthPercent: 0,
          discount12MonthPercent: 0,
        }

        if (existingIdx >= 0) {
          currentPrices[existingIdx] = { ...currentPrices[existingIdx], ...priceItem }
        } else {
          currentPrices.push(priceItem)
        }

        await facilityPolicyService.update(policy.id, {
          prices: currentPrices,
        })
      } catch (err) {
        console.warn('Could not sync facility policy price to backend:', err)
      }
    }

    return unitType
  },

  /**
   * Creates a new unit type specifically for a facility.
   */
  async createFacilityUnitType(
    facilityId: string,
    data: Omit<FacilityUnitTypeOverride, 'unitTypeId'>,
    policy?: FacilityPolicy | null
  ): Promise<UnitType> {
    const overrides = this.getFacilityOverrides(facilityId)
    const newId = `fut_${facilityId.substring(0, 8)}_${Date.now()}`

    const newOverride: FacilityUnitTypeOverride = {
      ...data,
      unitTypeId: newId,
      isCustomForFacility: true,
      isActive: data.isActive ?? true,
      basePricePerMonth: Number(data.basePricePerMonth || 0),
      depositAmount: Number(data.basePricePerMonth || 0),
      acPricePerMonth: data.acPricePerMonth != null && Number(data.acPricePerMonth) > 0 ? Number(data.acPricePerMonth) : undefined,
      imageUrl: data.imageUrl,
    }

    overrides[newId] = newOverride
    this.saveFacilityOverrides(facilityId, overrides)

    const createdUnitType: UnitType = {
      id: newId,
      typeName: data.typeName || 'Kho mới',
      dimensions: data.dimensions || `${data.lengthM || 2}m x ${data.widthM || 2}m x ${data.heightM || 2.5}m`,
      areaSqm: data.areaSqm ?? 4,
      volumeM3: data.volumeM3 ?? 10,
      lengthM: data.lengthM,
      widthM: data.widthM,
      heightM: data.heightM,
      basePricePerMonth: Number(data.basePricePerMonth || 0),
      depositAmount: Number(data.basePricePerMonth || 0),
      acPricePerMonth: data.acPricePerMonth != null && Number(data.acPricePerMonth) > 0 ? Number(data.acPricePerMonth) : undefined,
      isActive: data.isActive ?? true,
      imageUrl: data.imageUrl,
    }

    return createdUnitType
  },

  /**
   * Toggles the active/inactive status of a unit type strictly for a facility.
   */
  toggleFacilityUnitTypeStatus(facilityId: string, unitTypeId: string, isActive: boolean): void {
    const overrides = this.getFacilityOverrides(facilityId)
    overrides[unitTypeId] = {
      ...(overrides[unitTypeId] || { unitTypeId }),
      isActive,
    }
    this.saveFacilityOverrides(facilityId, overrides)
  },

  /**
   * Deletes a unit type strictly for a facility.
   */
  deleteFacilityUnitType(facilityId: string, unitTypeId: string): void {
    const overrides = this.getFacilityOverrides(facilityId)
    overrides[unitTypeId] = {
      ...(overrides[unitTypeId] || { unitTypeId }),
      isDeleted: true,
    }
    this.saveFacilityOverrides(facilityId, overrides)
  },
}
