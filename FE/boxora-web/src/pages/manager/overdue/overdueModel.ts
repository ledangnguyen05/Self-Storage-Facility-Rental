import { AlarmClock, Gavel, Hourglass, Lock, type LucideIcon } from 'lucide-react'
import type { Tone } from '@/components/ui'
import type { OverdueLedgerItem, OverduePolicyInfo, OverdueStage } from '@/services/overdueService'
import type { ResolvedFacilityPolicy } from '@/utils/facilityPolicyDefaults'

/** Delinquency pipeline, in the order a contract moves through it. Keys match the backend `overdueStage`. */
export const OVERDUE_STAGE_KEYS = ['GRACE_PERIOD', 'WARNING', 'ACCESS_BLOCKED', 'ELIGIBLE_FOR_SEALING'] as const satisfies readonly OverdueStage[]
export type OverdueStageKey = (typeof OVERDUE_STAGE_KEYS)[number]

export interface OverdueStageInfo {
  key: OverdueStageKey
  label: string
  tone: Tone
  icon: LucideIcon
  /** What happens at this stage. */
  summary: string
}

export const OVERDUE_STAGES: Record<OverdueStageKey, OverdueStageInfo> = {
  GRACE_PERIOD: { key: 'GRACE_PERIOD', label: 'Ân hạn', tone: 'info', icon: Hourglass, summary: 'Chưa tính phí trễ hạn' },
  WARNING: { key: 'WARNING', label: 'Trễ hạn', tone: 'warning', icon: AlarmClock, summary: 'Tính phí trễ hạn, nhắc nợ' },
  ACCESS_BLOCKED: { key: 'ACCESS_BLOCKED', label: 'Khóa truy cập', tone: 'danger', icon: Lock, summary: 'Thu hồi mã PIN và khóa kho' },
  ELIGIBLE_FOR_SEALING: {
    key: 'ELIGIBLE_FOR_SEALING',
    // "Niêm phong" alone reads as already sealed; this stage only means the unit may now be sealed.
    label: 'Đủ điều kiện niêm phong',
    tone: 'danger',
    icon: Gavel,
    summary: 'Lập biên bản niêm phong',
  },
}

/** The three thresholds of a facility policy that drive the stages. */
export interface StageThresholds {
  graceDays: number
  accessDisableDays: number
  sealingDays: number
}

export const thresholdsFromPolicy = (policy: ResolvedFacilityPolicy): StageThresholds => ({
  graceDays: policy.overdueGraceDays,
  accessDisableDays: policy.overdueAccessDisableDays,
  sealingDays: policy.overdueSealingDays,
})

export const thresholdsFromLedger = (policy: OverduePolicyInfo): StageThresholds => ({
  graceDays: policy.graceDays,
  accessDisableDays: policy.accessDisableDays,
  sealingDays: policy.sealingDays,
})

const isStageKey = (value: unknown): value is OverdueStageKey =>
  typeof value === 'string' && (OVERDUE_STAGE_KEYS as readonly string[]).includes(value)

/**
 * Same rule as the backend `OverdueFeeCalculator`: grace while days <= grace, access blocked from the access-disable
 * day, sealing from the sealing day (sealing wins over blocking).
 */
export function computeOverdueStage(daysOverdue: number, t: StageThresholds): OverdueStageKey {
  if (daysOverdue >= t.sealingDays) return 'ELIGIBLE_FOR_SEALING'
  if (daysOverdue >= t.accessDisableDays) return 'ACCESS_BLOCKED'
  if (daysOverdue <= t.graceDays) return 'GRACE_PERIOD'
  return 'WARNING'
}

/** The backend computes the stage with each row's own facility policy; the row thresholds are the fallback. */
export function getOverdueStage(item: Pick<OverdueLedgerItem, 'overdueStage' | 'daysOverdue' | 'graceDays' | 'accessDisableDays' | 'sealingDays'>): OverdueStageKey {
  if (isStageKey(item.overdueStage)) return item.overdueStage
  return computeOverdueStage(Number(item.daysOverdue) || 0, {
    graceDays: item.graceDays,
    accessDisableDays: item.accessDisableDays,
    sealingDays: item.sealingDays,
  })
}

const dayRange = (from: number, to?: number) => {
  if (to === undefined) return `Từ ngày ${from}`
  if (to < from) return 'Không áp dụng'
  return from === to ? `Ngày ${from}` : `Ngày ${from} đến ${to}`
}

/** Day range of each stage for one facility's policy (days counted after the contract end date). */
export function getStageThreshold(key: OverdueStageKey, t: StageThresholds): string {
  const blockFrom = Math.max(1, Math.min(t.accessDisableDays, t.sealingDays))
  const sealFrom = Math.max(1, t.sealingDays)
  switch (key) {
    case 'GRACE_PERIOD':
      return t.graceDays > 0 ? dayRange(1, Math.min(t.graceDays, blockFrom - 1)) : 'Không áp dụng'
    case 'WARNING':
      return dayRange(t.graceDays + 1, blockFrom - 1)
    case 'ACCESS_BLOCKED':
      return dayRange(blockFrom, sealFrom - 1)
    case 'ELIGIBLE_FOR_SEALING':
      return dayRange(sealFrom)
  }
}

/** One-line explanation of the late fee for a row. */
export function describeLateFee(item: Pick<OverdueLedgerItem, 'dailyLateFee' | 'chargeableLateDays' | 'graceDays'>, format: (value: number) => string): string {
  if (item.chargeableLateDays <= 0) return `Trong ${item.graceDays} ngày ân hạn, chưa tính phí`
  return `${item.chargeableLateDays} ngày × ${format(item.dailyLateFee)}`
}
