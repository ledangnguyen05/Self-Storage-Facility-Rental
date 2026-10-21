import {
  getBookingStatusMeta,
  getContractStatusMeta,
  getFacilityStatusMeta,
  getHandoverStatusMeta,
  getPaymentStatusMeta,
  getRefundStatusMeta,
  getRoleMeta,
  getSealingStatusMeta,
  getStaffAssignmentStatusMeta,
  getTicketStatusMeta,
  getUnitStatusMeta,
  humanizeEnum,
} from '@/constants/statusMeta'
import type { ActivityLog } from '@/types'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** A backend enum constant such as `PENDING_PAYMENT`. */
const ENUM_CODE_PATTERN = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/

/** Status vocabularies the audit log can carry, tried in order. A getter that does not know a code returns its humanised form. */
const ENUM_LABEL_GETTERS = [
  getRoleMeta,
  getBookingStatusMeta,
  getUnitStatusMeta,
  getContractStatusMeta,
  getPaymentStatusMeta,
  getRefundStatusMeta,
  getTicketStatusMeta,
  getFacilityStatusMeta,
  getSealingStatusMeta,
  getHandoverStatusMeta,
  getStaffAssignmentStatusMeta,
]

/** Vietnamese label of a stored status / role code; never the raw constant. */
function describeCode(code: string): string {
  const fallback = humanizeEnum(code)
  for (const getMeta of ENUM_LABEL_GETTERS) {
    const label = getMeta(code).label
    if (label && label !== fallback) return label
  }
  return fallback
}

/** The backend serialises the flag as `critical`; the shared type calls it `isCritical`. */
export const isCriticalLog = (log: ActivityLog): boolean => Boolean((log as ActivityLog & { critical?: boolean }).critical ?? log.isCritical)

/**
 * Readable form of the JSON the backend keeps in `oldValue` / `newValue`: plain text for scalars, indented JSON for
 * objects, and null when there is nothing meaningful to show. Status and role codes are written in Vietnamese, the
 * locked / active flag in words, and a bare id (which an administrator cannot read) is left out; the description
 * already names the target.
 */
export function formatLogValue(raw: string | null | undefined, action?: string | null): string | null {
  if (raw === null || raw === undefined || raw.trim() === '' || raw.trim() === 'null') return null
  const kind = (action ?? '').toUpperCase()
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed === null) return null
    if (typeof parsed === 'boolean') {
      if (kind === 'USER_ACTIVATE' || kind === 'USER_DEACTIVATE') return parsed ? 'Đang hoạt động' : 'Đã khóa'
      return parsed ? 'Có' : 'Không'
    }
    if (typeof parsed === 'string') {
      if (UUID_PATTERN.test(parsed)) return null
      return ENUM_CODE_PATTERN.test(parsed) ? describeCode(parsed) : parsed
    }
    if (typeof parsed === 'number') return String(parsed)
    return JSON.stringify(parsed, null, 2)
  } catch {
    return UUID_PATTERN.test(raw.trim()) ? null : raw
  }
}

/** Who performed the action: account name, then email, then the address typed on a failed login. */
export const getLogActorName = (log: ActivityLog): string =>
  log.userName || log.userFullName || log.userEmail || log.emailAttempted || log.username || 'Hệ thống'

/** Email shown under the name, only when the name is not already the email. */
export const getLogActorEmail = (log: ActivityLog): string | null => {
  const email = log.userEmail || log.emailAttempted
  return email && (log.userName || log.userFullName) ? email : null
}
