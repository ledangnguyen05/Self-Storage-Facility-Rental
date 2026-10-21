/**
 * Single source of truth for how domain enum values are shown to users:
 * a Vietnamese sentence-case label plus a Badge tone.
 *
 * Values are taken from the backend enums (com.boxora.enums.*) and the string
 * constants used by the services (ticket priority, payment method, handover
 * record type). Unknown values never leak as raw ENUM_CASE: they are
 * humanized and rendered neutral.
 *
 *   const meta = getBookingStatusMeta(booking.status)
 *   <Badge tone={meta.tone}>{meta.label}</Badge>
 */

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent'

export interface StatusMeta {
  label: string
  tone: Tone
}

export interface SelectOption<V extends string = string> {
  value: V
  label: string
}

type MetaMap = Record<string, StatusMeta>

const m = (label: string, tone: Tone = 'neutral'): StatusMeta => ({ label, tone })

/** `PENDING_REVIEW` → `Pending review`. Used only for values missing from a map. */
export function humanizeEnum(value: string): string {
  const words = value
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/\s+/g, ' ')
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : '—'
}

function createGetter(map: MetaMap) {
  return (value: string | null | undefined): StatusMeta => {
    if (value === null || value === undefined || String(value).trim() === '') return m('—')
    const key = String(value).trim().toUpperCase()
    return map[key] ?? m(humanizeEnum(String(value)))
  }
}

function toOptions<V extends string>(map: MetaMap, values: readonly V[]): SelectOption<V>[] {
  return values.map((value) => ({ value, label: map[value]?.label ?? humanizeEnum(value) }))
}

// ---------------------------------------------------------------- storage unit
export const UNIT_STATUS_VALUES = ['AVAILABLE', 'RESERVED', 'OCCUPIED', 'UNDER_MAINTENANCE', 'OVERDUE_LOCKED'] as const
const UNIT_STATUS: MetaMap = {
  AVAILABLE: m('Sẵn sàng', 'success'),
  RESERVED: m('Đã giữ chỗ', 'warning'),
  OCCUPIED: m('Đang thuê', 'info'),
  UNDER_MAINTENANCE: m('Bảo trì'),
  MAINTENANCE: m('Bảo trì'),
  OVERDUE_LOCKED: m('Khóa do quá hạn', 'danger'),
}
export const getUnitStatusMeta = createGetter(UNIT_STATUS)
export const UNIT_STATUS_OPTIONS = toOptions(UNIT_STATUS, UNIT_STATUS_VALUES)

// ---------------------------------------------------------------- booking
export const BOOKING_STATUS_VALUES = [
  'PENDING_APPROVAL',
  'PENDING_PAYMENT',
  'CONFIRMED',
  'ACTIVE',
  'CHECKOUT_REQUESTED',
  'INSPECTED',
  'COMPLETED',
  'CANCELLED',
  'OVERDUE',
] as const
const BOOKING_STATUS: MetaMap = {
  PENDING_APPROVAL: m('Chờ duyệt', 'warning'),
  PENDING_PAYMENT: m('Chờ thanh toán', 'warning'),
  CONFIRMED: m('Đã xác nhận', 'info'),
  ACTIVE: m('Đang thuê', 'success'),
  CHECKOUT_REQUESTED: m('Yêu cầu trả kho', 'warning'),
  INSPECTED: m('Đã nghiệm thu', 'info'),
  COMPLETED: m('Hoàn tất'),
  CANCELLED: m('Đã hủy'),
  OVERDUE: m('Quá hạn', 'danger'),
}
export const getBookingStatusMeta = createGetter(BOOKING_STATUS)
export const BOOKING_STATUS_OPTIONS = toOptions(BOOKING_STATUS, BOOKING_STATUS_VALUES)

/** Booking.paymentStatus (UNPAID / PARTIALLY_PAID / PAID; REFUND_PENDING / REFUNDED for a cancelled booking). */
const BOOKING_PAYMENT_STATUS: MetaMap = {
  UNPAID: m('Chưa thanh toán', 'warning'),
  PARTIALLY_PAID: m('Thanh toán một phần', 'warning'),
  PAID: m('Đã thanh toán', 'success'),
  REFUND_PENDING: m('Đang hoàn tiền', 'info'),
  REFUNDED: m('Đã hoàn tiền'),
}
export const getBookingPaymentStatusMeta = createGetter(BOOKING_PAYMENT_STATUS)

// ---------------------------------------------------------------- contract
export const CONTRACT_STATUS_VALUES = [
  'DRAFT',
  'PENDING_SIGNATURE',
  'PENDING_VERIFICATION',
  'PENDING_ACTIVATION',
  'ACTIVE',
  'OVERDUE',
  'OVERDUE_LOCKED',
  'EXPIRED',
  'TERMINATED',
  'CANCELLED',
] as const
const CONTRACT_STATUS: MetaMap = {
  DRAFT: m('Bản nháp'),
  PENDING_SIGNATURE: m('Chờ ký', 'warning'),
  PENDING_VERIFICATION: m('Chờ xác minh', 'warning'),
  PENDING_ACTIVATION: m('Chờ kích hoạt', 'info'),
  ACTIVE: m('Đang hiệu lực', 'success'),
  OVERDUE: m('Quá hạn', 'danger'),
  OVERDUE_LOCKED: m('Khóa do quá hạn', 'danger'),
  EXPIRED: m('Hết hạn'),
  TERMINATED: m('Đã chấm dứt'),
  CANCELLED: m('Đã hủy'),
}
export const getContractStatusMeta = createGetter(CONTRACT_STATUS)
export const CONTRACT_STATUS_OPTIONS = toOptions(CONTRACT_STATUS, CONTRACT_STATUS_VALUES)

const CONTRACT_RENEWAL_STATUS: MetaMap = {
  PENDING_SIGNATURE: m('Chờ ký', 'warning'),
  PENDING_PAYMENT: m('Chờ thanh toán', 'warning'),
  COMPLETED: m('Hoàn tất', 'success'),
  CANCELLED: m('Đã hủy'),
}
export const getContractRenewalStatusMeta = createGetter(CONTRACT_RENEWAL_STATUS)

// ---------------------------------------------------------------- payment
export const PAYMENT_STATUS_VALUES = ['PENDING', 'PAID', 'FAILED', 'EXPIRED', 'REFUND_PENDING', 'REFUNDED'] as const
const PAYMENT_STATUS: MetaMap = {
  PENDING: m('Chờ thanh toán', 'warning'),
  PAID: m('Đã thanh toán', 'success'),
  SUCCESS: m('Thành công', 'success'),
  FAILED: m('Thất bại', 'danger'),
  EXPIRED: m('Hết hạn'),
  REFUND_PENDING: m('Chờ hoàn tiền', 'warning'),
  REFUNDED: m('Đã hoàn tiền'),
}
export const getPaymentStatusMeta = createGetter(PAYMENT_STATUS)
export const PAYMENT_STATUS_OPTIONS = toOptions(PAYMENT_STATUS, PAYMENT_STATUS_VALUES)

export const PAYMENT_METHOD_VALUES = ['VNPAY', 'CASH', 'BANK_TRANSFER'] as const
/** Methods a staff member can record manually (ManualPaymentRecordRequest). */
export const MANUAL_PAYMENT_METHOD_VALUES = ['CASH', 'BANK_TRANSFER'] as const
const PAYMENT_METHOD: MetaMap = {
  VNPAY: m('VNPay'),
  CASH: m('Tiền mặt'),
  BANK_TRANSFER: m('Chuyển khoản'),
  MOMO: m('MoMo'),
  ONLINE: m('Trực tuyến'),
}
export const getPaymentMethodMeta = createGetter(PAYMENT_METHOD)
export const PAYMENT_METHOD_OPTIONS = toOptions(PAYMENT_METHOD, PAYMENT_METHOD_VALUES)
export const MANUAL_PAYMENT_METHOD_OPTIONS = toOptions(PAYMENT_METHOD, MANUAL_PAYMENT_METHOD_VALUES)

export const PAYMENT_TYPE_VALUES = ['BOOKING_PAYMENT', 'DEPOSIT', 'RENTAL_FEE', 'RENEWAL_FEE', 'EXTRA_CHARGE'] as const
const PAYMENT_TYPE: MetaMap = {
  BOOKING_PAYMENT: m('Thanh toán đặt kho'),
  DEPOSIT: m('Tiền cọc'),
  RENTAL_FEE: m('Tiền thuê'),
  RENEWAL_FEE: m('Phí gia hạn'),
  EXTRA_CHARGE: m('Phụ phí'),
}
export const getPaymentTypeMeta = createGetter(PAYMENT_TYPE)
export const PAYMENT_TYPE_OPTIONS = toOptions(PAYMENT_TYPE, PAYMENT_TYPE_VALUES)

// ---------------------------------------------------------------- refund
export const REFUND_STATUS_VALUES = [
  'PENDING_REVIEW',
  'APPROVED',
  'REJECTED',
  'PROCESSING_TRANSFER',
  'AWAITING_CUSTOMER_CONFIRMATION',
  'RECONCILED',
  'COMPLETED',
  'PROCESSED',
] as const
const REFUND_STATUS: MetaMap = {
  PENDING_REVIEW: m('Chờ duyệt', 'warning'),
  APPROVED: m('Đã duyệt', 'info'),
  REJECTED: m('Từ chối', 'danger'),
  PROCESSING_TRANSFER: m('Đang chuyển khoản', 'info'),
  AWAITING_CUSTOMER_CONFIRMATION: m('Chờ khách xác nhận', 'warning'),
  RECONCILED: m('Khách đã nhận tiền', 'success'),
  COMPLETED: m('Hoàn tất', 'success'),
  PROCESSED: m('Đã xử lý', 'success'),
}
export const getRefundStatusMeta = createGetter(REFUND_STATUS)
export const REFUND_STATUS_OPTIONS = toOptions(REFUND_STATUS, REFUND_STATUS_VALUES)

// ---------------------------------------------------------------- support ticket
export const TICKET_STATUS_VALUES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REOPENED'] as const
const TICKET_STATUS: MetaMap = {
  OPEN: m('Mới', 'warning'),
  PENDING: m('Chờ xử lý', 'warning'),
  REOPENED: m('Mở lại', 'warning'),
  IN_PROGRESS: m('Đang xử lý', 'info'),
  RESOLVED: m('Đã xử lý', 'success'),
  CLOSED: m('Đã đóng'),
}
export const getTicketStatusMeta = createGetter(TICKET_STATUS)
export const TICKET_STATUS_OPTIONS = toOptions(TICKET_STATUS, TICKET_STATUS_VALUES)

/** Backend accepts LOW / MEDIUM (default) / HIGH / URGENT; CRITICAL appears in legacy data. */
export const TICKET_PRIORITY_VALUES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const
const TICKET_PRIORITY: MetaMap = {
  LOW: m('Thấp', 'info'),
  MEDIUM: m('Trung bình', 'warning'),
  HIGH: m('Cao', 'danger'),
  URGENT: m('Khẩn cấp', 'danger'),
  CRITICAL: m('Nghiêm trọng', 'danger'),
}
export const getTicketPriorityMeta = createGetter(TICKET_PRIORITY)
export const TICKET_PRIORITY_OPTIONS = toOptions(TICKET_PRIORITY, TICKET_PRIORITY_VALUES)

export const TICKET_CATEGORY_VALUES = [
  'PIN_CODE',
  'LOCK_ISSUE',
  'FACILITY_DAMAGE',
  'PAYMENT_ISSUE',
  'ACCESS_ISSUE',
  'CLEANLINESS_PEST',
  'CLIMATE_TEMP',
  'OTHER',
] as const
const TICKET_CATEGORY: MetaMap = {
  PIN_CODE: m('Mã PIN'),
  LOCK_ISSUE: m('Khóa thông minh'),
  FACILITY_DAMAGE: m('Hư hỏng thiết bị'),
  PAYMENT_ISSUE: m('Thanh toán'),
  ACCESS_ISSUE: m('Truy cập kho'),
  CLEANLINESS_PEST: m('Vệ sinh và côn trùng'),
  CLIMATE_TEMP: m('Nhiệt độ và độ ẩm'),
  OTHER: m('Khác'),
  // Legacy values from early frontend builds.
  UNIT: m('Ô kho'),
  LOCK: m('Khóa thông minh'),
  ACCESS_CODE: m('Mã truy cập'),
  PAYMENT: m('Thanh toán'),
  STORED_ITEMS: m('Hàng hóa lưu kho'),
}
export const getTicketCategoryMeta = createGetter(TICKET_CATEGORY)
export const TICKET_CATEGORY_OPTIONS = toOptions(TICKET_CATEGORY, TICKET_CATEGORY_VALUES)

// ---------------------------------------------------------------- handover
/** HandoverRecord.recordType values written by HandoverServiceImpl. */
export const HANDOVER_RECORD_TYPE_VALUES = ['CHECK_IN', 'CHECK_IN_INSPECTION', 'CHECKOUT_REQUEST', 'INSPECTION', 'RETURN'] as const
const HANDOVER_RECORD_TYPE: MetaMap = {
  CHECK_IN: m('Nhận kho', 'info'),
  CHECK_IN_INSPECTION: m('Nghiệm thu nhận kho', 'info'),
  CHECKOUT_REQUEST: m('Yêu cầu trả kho', 'warning'),
  INSPECTION: m('Kiểm tra trả kho', 'info'),
  RETURN: m('Trả kho', 'success'),
}
export const getHandoverRecordTypeMeta = createGetter(HANDOVER_RECORD_TYPE)

/** Handover progress (frontend status) and return review status (backend reviewStatus). */
const HANDOVER_STATUS: MetaMap = {
  PENDING_CHECKIN: m('Chờ nhận kho', 'warning'),
  HANDED_OVER: m('Đã bàn giao', 'success'),
  RETURN_INSPECTED: m('Đã nghiệm thu trả kho', 'info'),
  PENDING_ACCOUNTING_REVIEW: m('Chờ kế toán duyệt', 'warning'),
  AUTO_REFUND_APPROVED: m('Tự động duyệt hoàn cọc', 'success'),
}
export const getHandoverStatusMeta = createGetter(HANDOVER_STATUS)

/** Debt left when return deductions exceeded the deposit (backend CustomerDebt.status). */
export const CUSTOMER_DEBT_STATUS_VALUES = ['OPEN', 'COLLECTED', 'WRITTEN_OFF'] as const
const CUSTOMER_DEBT_STATUS: MetaMap = {
  OPEN: m('Đang nợ', 'danger'),
  COLLECTED: m('Đã thu hồi', 'success'),
  WRITTEN_OFF: m('Đã xóa nợ'),
}
export const getCustomerDebtStatusMeta = createGetter(CUSTOMER_DEBT_STATUS)
export const CUSTOMER_DEBT_STATUS_OPTIONS = toOptions(CUSTOMER_DEBT_STATUS, CUSTOMER_DEBT_STATUS_VALUES)

// ---------------------------------------------------------------- role
export const ROLE_VALUES = ['ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER', 'STAFF', 'CUSTOMER'] as const
const ROLE: MetaMap = {
  ADMIN: m('Quản trị viên', 'danger'),
  BUSINESS_MANAGER: m('Giám đốc vận hành', 'accent'),
  FACILITY_MANAGER: m('Quản lý cơ sở', 'info'),
  STAFF: m('Nhân viên', 'warning'),
  CUSTOMER: m('Khách hàng', 'success'),
}
export const getRoleMeta = createGetter(ROLE)
export const ROLE_OPTIONS = toOptions(ROLE, ROLE_VALUES)

// ---------------------------------------------------------------- facility, staffing, sealing, audit
export const FACILITY_STATUS_VALUES = ['ACTIVE', 'INACTIVE', 'MAINTENANCE'] as const
const FACILITY_STATUS: MetaMap = {
  ACTIVE: m('Đang hoạt động', 'success'),
  INACTIVE: m('Ngừng hoạt động'),
  MAINTENANCE: m('Bảo trì', 'warning'),
}
export const getFacilityStatusMeta = createGetter(FACILITY_STATUS)
export const FACILITY_STATUS_OPTIONS = toOptions(FACILITY_STATUS, FACILITY_STATUS_VALUES)

export const SHIFT_VALUES = ['MORNING', 'AFTERNOON', 'NIGHT', 'FULL_DAY'] as const
const SHIFT: MetaMap = {
  MORNING: m('Ca sáng'),
  AFTERNOON: m('Ca chiều'),
  NIGHT: m('Ca đêm'),
  FULL_DAY: m('Cả ngày'),
}
export const getShiftMeta = createGetter(SHIFT)
export const SHIFT_OPTIONS = toOptions(SHIFT, SHIFT_VALUES)

const STAFF_ASSIGNMENT_STATUS: MetaMap = {
  ASSIGNED: m('Đã phân công', 'info'),
  CHECKED_IN: m('Đã vào ca', 'success'),
  COMPLETED: m('Hoàn thành'),
  ABSENT: m('Vắng mặt', 'danger'),
}
export const getStaffAssignmentStatusMeta = createGetter(STAFF_ASSIGNMENT_STATUS)

const SEALING_STATUS: MetaMap = {
  SEALED: m('Đã niêm phong', 'danger'),
  UNSEALED: m('Đã gỡ niêm phong', 'success'),
  DISPOSED: m('Đã thanh lý'),
}
export const getSealingStatusMeta = createGetter(SEALING_STATUS)

const ACTIVITY_LOG_STATUS: MetaMap = {
  SUCCESS: m('Thành công', 'success'),
  FAILED: m('Thất bại', 'danger'),
  FAILURE: m('Thất bại', 'danger'),
  WARNING: m('Cảnh báo', 'warning'),
}
export const getActivityLogStatusMeta = createGetter(ACTIVITY_LOG_STATUS)
