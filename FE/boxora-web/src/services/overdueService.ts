import { api } from '../lib/axios'
import type { RequestOptions } from '../types'

/** Delinquency stage computed by the backend (`OverdueFeeCalculator`) with each facility's own policy. */
export type OverdueStage = 'GRACE_PERIOD' | 'WARNING' | 'ACCESS_BLOCKED' | 'ELIGIBLE_FOR_SEALING'

/** Overdue thresholds the backend enforces for one facility (`OverduePolicyResponse`). */
export interface OverduePolicyInfo {
  graceDays: number
  accessDisableDays: number
  sealingDays: number
  dailyLateFee: number
  /** True when the facility has no active policy and the system defaults apply. */
  defaultPolicy: boolean
}

/**
 * One overdue contract (`OverdueLedgerItemResponse`). Customer and facility fields are null when the source data
 * has none. `totalDebt = max(0, unpaidRent + totalLateFee - paidSinceDue)`.
 */
export interface OverdueLedgerItem {
  contractId: string
  contractCode: string
  contractStatus: string | null
  bookingId: string | null
  bookingCode: string | null
  bookingStatus: string | null
  customerId: string | null
  customerName: string | null
  customerPhone: string | null
  customerEmail: string | null
  unitId: string | null
  unitCode: string | null
  unitStatus: string | null
  facilityId: string | null
  facilityName: string | null
  startDate: string | null
  /** Contract end date: rent was paid up to this day. */
  dueDate: string | null
  daysOverdue: number
  graceDays: number
  accessDisableDays: number
  sealingDays: number
  defaultPolicy: boolean
  monthlyFee: number | null
  /** Rent for the time kept after the due date (one monthly fee per started 30-day block). */
  unpaidRent: number
  dailyLateFee: number
  chargeableLateDays: number
  totalLateFee: number
  /** Rent or extra-charge payments received after the due date, already deducted. */
  paidSinceDue: number
  totalDebt: number
  overdueStage: OverdueStage
  accessLocked: boolean
  accessLockedAt: string | null
  /** Manager reprieve: access stays open and is not locked again before this date. */
  accessHoldUntil: string | null
  sealed: boolean
  sealingRecordId: string | null
  sealingProtocolNumber: string | null
  sealedAt: string | null
  lastReminderAt: string | null
  lastReminderStatus: 'SENT' | 'FAILED' | null
  reminderCount: number
  accruedLateFee: number | null
  lastAssessedOn: string | null
  canRemind: boolean
  canLockout: boolean
  canSeal: boolean
  canRestoreAccess: boolean
  canUnseal: boolean
}

/** GET /overdue/ledger (`OverdueLedgerResponse`). */
export interface OverdueLedger {
  asOfDate: string
  facilityId: string | null
  /** Policy of `facilityId`; null when several facilities are listed. */
  policy: OverduePolicyInfo | null
  totalOverdueCount: number
  totalDebtAmount: number
  totalUnpaidRent: number
  totalLateFees: number
  totalPaidSinceDue: number
  gracePeriodCount: number
  warningCount: number
  accessBlockedCount: number
  eligibleForSealingCount: number
  accessLockedCount: number
  sealedCount: number
  items: OverdueLedgerItem[]
}

export interface LockoutResponse {
  contractId: string
  contractCode?: string
  bookingId?: string
  unitCode?: string
  status: 'SUCCESS' | 'ALREADY_LOCKED'
  message: string
  reason?: string
  lockedAt?: string
  pinRevoked: boolean
  /** True only when the tenant email was accepted by the mail server; null when no email applies. */
  customerNotified?: boolean | null
  /** How the tenant was told (in-app notification, email outcome). */
  notificationMessage?: string | null
}

/** Outcome of lifting a lockout (`AccessRestorationResponse`). */
export interface AccessRestorationResult {
  contractId: string
  contractCode?: string
  unitCode?: string
  contractStatus?: string
  bookingStatus?: string
  unitStatus?: string
  accessRestored: boolean
  /** A new PIN/QR was issued; the tenant sees it in the customer portal. */
  pinReissued: boolean
  /** Nothing outstanding any more (contract renewed). */
  settled: boolean
  accessHoldUntil?: string | null
  sealed: boolean
  message: string
  customerNotified?: boolean | null
  notificationMessage?: string | null
}

/** Returned only after the mail server accepted the reminder (`OverdueReminderResponse`). */
export interface OverdueReminderResult {
  contractId: string
  contractCode?: string
  sentTo: string
  sentAt: string
  daysOverdue: number
  totalDebt: number
  reminderCount: number
}

const num = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const normalizeItem = (raw: OverdueLedgerItem): OverdueLedgerItem => ({
  ...raw,
  daysOverdue: num(raw.daysOverdue),
  unpaidRent: num(raw.unpaidRent),
  dailyLateFee: num(raw.dailyLateFee),
  totalLateFee: num(raw.totalLateFee),
  paidSinceDue: num(raw.paidSinceDue),
  totalDebt: num(raw.totalDebt),
  reminderCount: num(raw.reminderCount),
})

export const overdueService = {
  /** Facility-scoped ledger. Facility managers and staff always get their own facility. */
  async getLedger(facilityId?: string, opts?: RequestOptions): Promise<OverdueLedger> {
    const response = await api.get('/api/v1/overdue/ledger', { params: facilityId ? { facilityId } : undefined, signal: opts?.signal })
    const data = response.data?.data as OverdueLedger
    return { ...data, items: (data?.items ?? []).map(normalizeItem) }
  },

  /**
   * Revokes the PIN/QR and locks the unit; the tenant is notified. Rejected (409) before the access-disable day of the policy,
   * and while the manager's access hold is running unless `overrideAccessHold` is set with a written `reason`.
   */
  async lockoutContract(contractId: string, reason?: string, overrideAccessHold = false): Promise<LockoutResponse> {
    const response = await api.post(`/api/v1/overdue/contracts/${contractId}/lockout`, {
      reason,
      ...(overrideAccessHold ? { overrideAccessHold: true } : {}),
    })
    return response.data?.data as LockoutResponse
  },

  /** "Mở khóa truy cập". `holdUntil` (yyyy-MM-dd) only matters while the contract is still past its end date. */
  async restoreAccess(contractId: string, payload: { reason: string; holdUntil?: string }): Promise<AccessRestorationResult> {
    const response = await api.post(`/api/v1/overdue/contracts/${contractId}/restore-access`, payload)
    return response.data?.data as AccessRestorationResult
  },

  /** Sends the overdue email synchronously. Rejects when the customer has no email or the mail server refused it. */
  async sendReminder(contractId: string): Promise<OverdueReminderResult> {
    const response = await api.post(`/api/v1/overdue/contracts/${contractId}/reminders`)
    return response.data?.data as OverdueReminderResult
  },
}
