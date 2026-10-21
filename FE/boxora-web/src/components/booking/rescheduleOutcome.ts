import { humanizeEnum, type StatusMeta } from '../../constants/statusMeta'

/**
 * Label and tone of a reschedule history outcome. `constants/statusMeta` has no
 * getter for it, so the mapping lives here; unknown outcomes are humanized and neutral.
 */
const OUTCOME_META: Record<string, StatusMeta> = {
  CONFIRMED: { label: 'Đã xác nhận', tone: 'success' },
  APPROVED: { label: 'Đã duyệt', tone: 'success' },
  PENDING: { label: 'Chờ xử lý', tone: 'warning' },
  REJECTED: { label: 'Bị từ chối', tone: 'danger' },
  CANCELLED: { label: 'Đã hủy', tone: 'neutral' },
}

export function getRescheduleOutcomeMeta(outcome: string | null | undefined): StatusMeta {
  const key = String(outcome ?? '').trim().toUpperCase()
  if (!key) return { label: '—', tone: 'neutral' }
  return OUTCOME_META[key] ?? { label: humanizeEnum(key), tone: 'neutral' }
}
