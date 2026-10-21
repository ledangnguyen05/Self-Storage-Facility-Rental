import type { FacilityPolicy, FacilityPolicyPriceInput, UnitType } from '@/types'

/**
 * State of the per-branch price list. One row per unit type, keyed by unit type id.
 * A row that is not `enabled` has no branch price: that unit type uses the global price and the system discount ladder.
 */
export interface PriceRowState {
  enabled: boolean
  /** Digits only (VND per month). */
  price: string
  /** Percent text, e.g. "12.5". */
  d3: string
  d6: string
  d12: string
}

export type PriceFormState = Record<string, PriceRowState>
export type DiscountKey = 'd3' | 'd6' | 'd12'
export type PriceRowErrors = Partial<Record<'price' | DiscountKey, string>>

/** The system discount ladder a unit type gets without a branch price (mirrors the backend `PricingRules`). */
export const SYSTEM_DISCOUNT_DEFAULTS: Record<DiscountKey, number> = { d3: 5, d6: 10, d12: 15 }

export const DISCOUNT_COLUMNS: ReadonlyArray<{ key: DiscountKey; label: string; months: number }> = [
  { key: 'd3', label: 'Giảm từ 3 tháng (%)', months: 3 },
  { key: 'd6', label: 'Giảm từ 6 tháng (%)', months: 6 },
  { key: 'd12', label: 'Giảm từ 12 tháng (%)', months: 12 },
]

export const digitsOf = (text: string): string => text.replace(/\D/g, '')

const percentText = (value: number | undefined | null): string => (value == null ? '0' : String(value))

/** A freshly enabled row starts from the global price and the system discounts, so enabling it changes nothing by itself. */
export function enabledRowFor(unitType: UnitType): PriceRowState {
  return {
    enabled: true,
    price: String(Math.round(Number(unitType.basePricePerMonth) || 0)),
    d3: String(SYSTEM_DISCOUNT_DEFAULTS.d3),
    d6: String(SYSTEM_DISCOUNT_DEFAULTS.d6),
    d12: String(SYSTEM_DISCOUNT_DEFAULTS.d12),
  }
}

export function toPriceFormState(unitTypes: readonly UnitType[], policy: FacilityPolicy | null): PriceFormState {
  const state: PriceFormState = {}
  for (const unitType of unitTypes) {
    const price = policy?.prices?.find(item => item.unitTypeId === unitType.id)
    state[unitType.id] = price
      ? {
          enabled: true,
          price: String(Math.round(Number(price.monthlyPrice) || 0)),
          d3: percentText(price.discount3MonthPercent),
          d6: percentText(price.discount6MonthPercent),
          d12: percentText(price.discount12MonthPercent),
        }
      : { enabled: false, price: '', d3: '', d6: '', d12: '' }
  }
  return state
}

export function validatePriceForm(state: PriceFormState): Record<string, PriceRowErrors> {
  const errors: Record<string, PriceRowErrors> = {}
  for (const [unitTypeId, row] of Object.entries(state)) {
    if (!row.enabled) continue
    const rowErrors: PriceRowErrors = {}
    const price = Number(digitsOf(row.price))
    if (!price || price <= 0) rowErrors.price = 'Giá thuê phải lớn hơn 0.'
    for (const { key } of DISCOUNT_COLUMNS) {
      const text = row[key].trim().replace(',', '.')
      const value = Number(text)
      if (text === '' || !Number.isFinite(value)) rowErrors[key] = 'Nhập số từ 0 đến 100.'
      else if (value < 0 || value > 100) rowErrors[key] = 'Từ 0 đến 100.'
    }
    if (Object.keys(rowErrors).length > 0) errors[unitTypeId] = rowErrors
  }
  return errors
}

/** The `prices` list to send: enabled rows only. Sending it replaces the whole branch price list. */
export function toPricePayload(state: PriceFormState): FacilityPolicyPriceInput[] {
  return Object.entries(state)
    .filter(([, row]) => row.enabled)
    .map(([unitTypeId, row]) => ({
      unitTypeId,
      monthlyPrice: Number(digitsOf(row.price)),
      discount3MonthPercent: Number(row.d3.replace(',', '.')),
      discount6MonthPercent: Number(row.d6.replace(',', '.')),
      discount12MonthPercent: Number(row.d12.replace(',', '.')),
    }))
}

export function isPriceFormDirty(initial: PriceFormState, current: PriceFormState): boolean {
  const normalise = (row: PriceRowState | undefined) =>
    row?.enabled ? [true, digitsOf(row.price), Number(row.d3), Number(row.d6), Number(row.d12)].join('|') : 'off'
  const ids = new Set([...Object.keys(initial), ...Object.keys(current)])
  for (const id of ids) {
    if (normalise(initial[id]) !== normalise(current[id])) return true
  }
  return false
}
