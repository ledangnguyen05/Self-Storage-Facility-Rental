import { humanizeEnum } from '@/constants/statusMeta'

/** Vietnamese label of each backend `ActivityAction`. Unknown actions fall back to a humanized name. */
const ACTION_LABELS: Record<string, string> = {
  // Authentication
  LOGIN_SUCCESS: 'Đăng nhập thành công',
  LOGIN_FAILED: 'Đăng nhập thất bại',
  LOGOUT: 'Đăng xuất',
  PASSWORD_CHANGE: 'Đổi mật khẩu',
  PASSWORD_RESET_REQUESTED: 'Yêu cầu đặt lại mật khẩu',
  PASSWORD_RESET_COMPLETED: 'Đặt lại mật khẩu',
  REFRESH_TOKEN_REVOKED: 'Thu hồi phiên đăng nhập',
  // User, role, permission
  USER_CREATE: 'Tạo tài khoản',
  USER_UPDATE: 'Cập nhật tài khoản',
  USER_DEACTIVATE: 'Khóa tài khoản',
  USER_ACTIVATE: 'Kích hoạt tài khoản',
  USER_ASSIGN_ROLE: 'Gán vai trò',
  USER_ASSIGN_FACILITY_SCOPE: 'Gán phạm vi cơ sở',
  ROLE_CREATE: 'Tạo vai trò',
  ROLE_UPDATE: 'Cập nhật vai trò',
  ROLE_DELETE: 'Xóa vai trò',
  PERMISSION_CREATE: 'Tạo quyền hạn',
  PERMISSION_UPDATE: 'Cập nhật quyền hạn',
  PERMISSION_DELETE: 'Xóa quyền hạn',
  ROLE_PERMISSION_ASSIGN: 'Cấp quyền cho vai trò',
  ROLE_PERMISSION_REVOKE: 'Thu hồi quyền của vai trò',
  // Facility and policy
  FACILITY_CREATE: 'Tạo cơ sở',
  FACILITY_UPDATE: 'Cập nhật cơ sở',
  FACILITY_DEACTIVATE: 'Ngừng hoạt động cơ sở',
  UNIT_TYPE_CREATE: 'Tạo loại kho',
  UNIT_TYPE_UPDATE: 'Cập nhật loại kho',
  UNIT_TYPE_DELETE: 'Xóa loại kho',
  PRICE_CREATE: 'Tạo giá niêm yết',
  PRICE_UPDATE: 'Điều chỉnh giá niêm yết',
  FACILITY_POLICY_CREATE: 'Ban hành chính sách cơ sở',
  FACILITY_POLICY_UPDATE: 'Cập nhật chính sách cơ sở',
  FACILITY_POLICY_DELETE: 'Xóa chính sách cơ sở',
  FACILITY_POLICY_EXCEPTION: 'Cấp / thu hồi quyền sửa chính sách ngoại lệ',
  FEE_CREATE: 'Tạo loại phí',
  FEE_UPDATE: 'Cập nhật loại phí',
  FEE_WAIVE: 'Miễn phí',
  DISCOUNT_CREATE: 'Tạo ưu đãi',
  DISCOUNT_UPDATE: 'Cập nhật ưu đãi',
  DISCOUNT_ACTIVATE: 'Kích hoạt ưu đãi',
  DISCOUNT_DEACTIVATE: 'Ngừng ưu đãi',
  // Storage unit
  STORAGE_UNIT_CREATE: 'Tạo kho',
  STORAGE_UNIT_UPDATE: 'Cập nhật kho',
  STORAGE_UNIT_STATUS_CHANGE: 'Đổi trạng thái kho',
  STORAGE_UNIT_ASSIGN: 'Gán kho cho khách',
  STORAGE_UNIT_RELEASE: 'Giải phóng kho',
  // Reservation and payment
  RESERVATION_CREATE: 'Tạo đặt kho',
  RESERVATION_UPDATE: 'Cập nhật đặt kho',
  RESERVATION_CANCEL: 'Hủy đặt kho',
  RESERVATION_EXPIRE: 'Đặt kho hết hạn giữ chỗ',
  PAYMENT_INITIATED: 'Khởi tạo thanh toán',
  PAYMENT_CONFIRMED: 'Xác nhận thanh toán',
  PAYMENT_FAILED: 'Thanh toán thất bại',
  PAYMENT_DUPLICATE_IGNORED: 'Bỏ qua thanh toán trùng',
  CONTRACT_CREATE: 'Tạo hợp đồng',
  CONTRACT_SIGNED: 'Ký hợp đồng',
  // Check-in, handover, access
  CHECKIN_RESCHEDULE: 'Đổi lịch nhận kho',
  CHECKIN_VERIFIED: 'Xác minh nhận kho',
  HANDOVER_COMPLETE: 'Hoàn tất bàn giao',
  ACCESS_CREDENTIAL_ISSUE: 'Cấp mã truy cập',
  ACCESS_CREDENTIAL_UPDATE: 'Cập nhật mã truy cập',
  ACCESS_CREDENTIAL_REVOKE: 'Thu hồi mã truy cập',
  MASTER_KEY_OVERRIDE: 'Mở khóa bằng khóa chủ',
  // Renewal and overdue
  RENEWAL_REQUEST: 'Yêu cầu gia hạn',
  RENEWAL_PAID: 'Thanh toán gia hạn',
  CONTRACT_EXTENDED: 'Gia hạn hợp đồng',
  OVERDUE_DETECTED: 'Phát hiện quá hạn',
  OVERDUE_ACCESS_DISABLED: 'Khóa truy cập do quá hạn',
  OVERDUE_SEALING_APPROVED: 'Duyệt niêm phong kho',
  OVERDUE_UNIT_LOCKED: 'Khóa kho do quá hạn',
  OVERDUE_REMINDER_SENT: 'Gửi nhắc nợ quá hạn',
  // Checkout and refund
  CHECKOUT_REQUEST: 'Yêu cầu trả kho',
  CHECKOUT_INSPECTION_COMPLETE: 'Hoàn tất nghiệm thu trả kho',
  DAMAGE_FEE_RECORDED: 'Ghi nhận phí hư hỏng',
  REFUND_REQUEST_CREATE: 'Tạo yêu cầu hoàn tiền',
  REFUND_APPROVE: 'Duyệt hoàn tiền',
  REFUND_PROCESS: 'Xử lý hoàn tiền',
  REFUND_PROCESSED: 'Đã chuyển tiền hoàn',
  REFUND_CONFIRM: 'Khách xác nhận hoàn tiền',
  REFUND_RECONCILE: 'Đối soát hoàn tiền',
  // Support and staff
  SUPPORT_TICKET_CREATE: 'Tạo sự cố',
  SUPPORT_TICKET_UPDATE: 'Cập nhật sự cố',
  SUPPORT_TICKET_ASSIGN: 'Phân công sự cố',
  SUPPORT_TICKET_RESOLVE: 'Giải quyết sự cố',
  SUPPORT_TICKET_CLOSE: 'Đóng sự cố',
  SUPPORT_TICKET_REOPEN: 'Mở lại sự cố',
  SUPPORT_TICKET_CONTACT_BOM: 'Liên hệ Giám đốc vận hành',
  STAFF_ASSIGNMENT_CREATE: 'Phân ca nhân viên',
  STAFF_ASSIGNMENT_UPDATE: 'Cập nhật phân ca',
  STAFF_ASSIGNMENT_REMOVE: 'Hủy phân ca',
  // Reports
  REPORT_EXPORTED: 'Xuất báo cáo',
}

export const getAuditActionLabel = (action: string | null | undefined): string => {
  if (!action) return '—'
  return ACTION_LABELS[action.toUpperCase()] ?? humanizeEnum(action)
}

const LOG_TYPE_LABELS: Record<string, string> = { LOGIN: 'Đăng nhập', LOGOUT: 'Đăng xuất', DATA_ACTION: 'Thao tác dữ liệu' }

export const getLogTypeLabel = (logType: string | null | undefined): string => {
  if (!logType) return '—'
  return LOG_TYPE_LABELS[logType.toUpperCase()] ?? humanizeEnum(logType)
}

/** Log categories the backend can filter on (`logType`). */
export const AUDIT_LOG_TYPE_OPTIONS = [
  { value: '', label: 'Tất cả loại' },
  { value: 'LOGIN', label: 'Đăng nhập' },
  { value: 'LOGOUT', label: 'Đăng xuất' },
  { value: 'DATA_ACTION', label: 'Thao tác dữ liệu' },
] as const

/**
 * Business areas the backend can filter on (`domain`). Each area groups the audit actions of one part of the
 * product, so "all policy changes" or "all ticket events" is a single choice.
 */
export const AUDIT_DOMAIN_OPTIONS = [
  { value: '', label: 'Mọi nhóm thao tác' },
  { value: 'AUTH', label: 'Đăng nhập và mật khẩu' },
  { value: 'ACCOUNT', label: 'Tài khoản và phân quyền' },
  { value: 'FACILITY', label: 'Cơ sở, chính sách và kho' },
  { value: 'BOOKING', label: 'Đặt kho và hợp đồng' },
  { value: 'PAYMENT', label: 'Thanh toán và hoàn tiền' },
  { value: 'ACCESS', label: 'Bàn giao và mã truy cập' },
  { value: 'OVERDUE', label: 'Quá hạn và niêm phong' },
  { value: 'SUPPORT', label: 'Sự cố và phân ca' },
  { value: 'REPORT', label: 'Báo cáo' },
] as const

export const AUDIT_STATUS_OPTIONS = [
  { value: '', label: 'Mọi trạng thái' },
  { value: 'SUCCESS', label: 'Thành công' },
  { value: 'FAILED', label: 'Thất bại' },
] as const
