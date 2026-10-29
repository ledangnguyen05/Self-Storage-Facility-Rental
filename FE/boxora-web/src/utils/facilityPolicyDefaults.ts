import { FacilityPolicy } from '../types'

export type FacilityPolicyValues = Required<Pick<
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
>>

export const FACILITY_POLICY_DEFAULTS: FacilityPolicyValues = {
  isActive: true,
  depositPercentage: 100,
  renewalWindowDays: 3,
  minimumRentalMonths: 1,
  cancellationFullRefundHours: 24,
  cancellationPartialRefundHours: 48,
  cancellationPartialRefundPercent: 70,
  returnNoticeDays: 0,
  depositRefundSlaDays: 5,
  dailyLateFee: 50000,
  overdueGraceDays: 1,
  overdueAccessDisableDays: 3,
  overdueSealingDays: 7,
}

export const createDefaultFacilityPolicy = (facilityId: string): FacilityPolicy => ({
  id: '',
  facilityId,
  ...FACILITY_POLICY_DEFAULTS,
})
