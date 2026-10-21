import type { FacilityPolicy } from '../types'

/**
 * The single frontend fallback for facility policy numbers. Values mirror the
 * backend: `entity/FacilityPolicy` @Builder.Default values, the
 * `V1__create_tables.sql` column defaults, the `V5__seed_facilities_and_policies.sql`
 * seed (deposit 100 %, late fee 50 000 ₫) and the service-level fallbacks in
 * BookingCancellationServiceImpl / ReportServiceImpl / ContractRenewalServiceImpl.
 * Never copy these numbers into components: use `resolvePolicy()`.
 */
export type FacilityPolicyValues = Required<
  Pick<
    FacilityPolicy,
    | 'isActive'
    | 'depositPercentage'
    | 'renewalWindowDays'
    | 'minimumRentalMonths'
    | 'cancellationFullRefundHours'
    | 'cancellationPartialRefundHours'
    | 'cancellationPartialRefundPercent'
    | 'returnNoticeDays'
    | 'depositRefundSlaDays'
    | 'dailyLateFee'
    | 'overdueGraceDays'
    | 'overdueAccessDisableDays'
    | 'overdueSealingDays'
  >
>

export const FACILITY_POLICY_DEFAULTS: Readonly<FacilityPolicyValues> = Object.freeze({
  isActive: true,
  depositPercentage: 100,
  renewalWindowDays: 3,
  minimumRentalMonths: 1,
  cancellationFullRefundHours: 48,
  cancellationPartialRefundHours: 24,
  cancellationPartialRefundPercent: 50,
  returnNoticeDays: 0,
  depositRefundSlaDays: 5,
  dailyLateFee: 50000,
  overdueGraceDays: 1,
  overdueAccessDisableDays: 3,
  overdueSealingDays: 7,
})

/**
 * Booking hold rules. Stored on the policy entity but not exposed by
 * FacilityPolicyResponse; the pricing quote returns the effective values
 * (`holdGraceHours`, `maxHoldDays`). Defaults from entity/FacilityPolicy and
 * BookingServiceImpl / PricingServiceImpl fallbacks.
 */
export const BOOKING_HOLD_DEFAULTS = Object.freeze({
  holdGraceHours: 24,
  maxHoldDays: 14,
})

/** A complete policy: every numeric field present. */
export type ResolvedFacilityPolicy = FacilityPolicy & FacilityPolicyValues

const POLICY_KEYS = Object.keys(FACILITY_POLICY_DEFAULTS) as (keyof FacilityPolicyValues)[]

/**
 * Merges a (possibly partial or missing) policy with the backend defaults.
 * `null`, `undefined` and non-finite numbers fall back; real zeros are kept.
 *
 *   const policy = resolvePolicy(await facilityPolicyService.getByFacilityId(id).catch(() => null))
 */
export function resolvePolicy(policy?: Partial<FacilityPolicy> | null, facilityId = ''): ResolvedFacilityPolicy {
  const base: FacilityPolicy = {
    ...policy,
    id: policy?.id ?? '',
    facilityId: policy?.facilityId ?? facilityId,
  }
  const resolved: Record<string, unknown> = { ...base }
  for (const key of POLICY_KEYS) {
    const value: unknown = policy?.[key]
    const fallback = FACILITY_POLICY_DEFAULTS[key]
    if (typeof fallback === 'number') {
      const n = typeof value === 'number' ? value : Number(value)
      resolved[key] = value !== null && value !== undefined && value !== '' && Number.isFinite(n) ? n : fallback
    } else {
      resolved[key] = typeof value === 'boolean' ? value : fallback
    }
  }
  return resolved as unknown as ResolvedFacilityPolicy
}

/** True when `policy` is a placeholder built from defaults (no backend id). */
export const isDefaultPolicy = (policy?: Partial<FacilityPolicy> | null): boolean => !policy?.id

/** Placeholder policy for a facility without one (kept for existing callers). */
export const createDefaultFacilityPolicy = (facilityId: string): FacilityPolicy => resolvePolicy(null, facilityId)
