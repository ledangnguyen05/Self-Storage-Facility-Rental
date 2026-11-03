import { FacilityPolicy } from '../types'

export type FacilityPolicyValues = Required<Pick<
  FacilityPolicy,
  | 'isActive'
  | 'depositPercentage'
  | 'renewalWindowDays'
  | 'minimumRentalMonths'
  | 'minimumRentalDays'
  | 'cancellationFullRefundHours'
  | 'cancellationPartialRefundHours'
  | 'cancellationPartialRefundPercent'
  | 'cancellationAfter48hRefundPercent'
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
  minimumRentalDays: 30,
  cancellationFullRefundHours: 24,
  cancellationPartialRefundHours: 48,
  cancellationPartialRefundPercent: 70,
  cancellationAfter48hRefundPercent: 50,
  returnNoticeDays: 0,
  depositRefundSlaDays: 5,
  dailyLateFee: 200000,
  overdueGraceDays: 1,
  overdueAccessDisableDays: 3,
  overdueSealingDays: 7,
}

export const createDefaultFacilityPolicy = (facilityId: string): FacilityPolicy => ({
  id: '',
  facilityId,
  ...FACILITY_POLICY_DEFAULTS,
})
