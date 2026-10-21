import { humanizeEnum } from '@/constants/statusMeta'
import type { Permission } from '@/types'

/** A permission as the backend sends it (`name` is the code, `permissionGroup` the matrix group). */
export type PermissionRecord = Permission

const GROUP_LABELS: Record<string, string> = {
  USER: 'Người dùng',
  ROLE: 'Vai trò',
  PERMISSION: 'Quyền hạn',
  ROLE_PERMISSION: 'Phân quyền vai trò',
  FACILITY: 'Cơ sở',
  UNIT_TYPE: 'Loại kho',
  STORAGE_UNIT: 'Kho',
  BOOKING: 'Đặt kho',
  CONTRACT: 'Hợp đồng',
  PAYMENT: 'Thanh toán',
  REFUND: 'Hoàn tiền',
  RENEWAL: 'Gia hạn',
  POLICY: 'Chính sách',
  DISCOUNT: 'Ưu đãi',
  FEE: 'Phí',
  HANDOVER: 'Bàn giao',
  ACCESS_CREDENTIAL: 'Mã truy cập',
  OVERDUE: 'Quá hạn và niêm phong',
  STAFF_ASSIGNMENT: 'Phân ca',
  SUPPORT: 'Sự cố và hỗ trợ',
  REPORT: 'Báo cáo',
  ACTIVITY_LOG: 'Nhật ký hoạt động',
  LOGIN_HISTORY: 'Lịch sử đăng nhập',
}

const OTHER_GROUP = 'OTHER'

const ACTION_VERBS: Record<string, string> = { VIEW: 'Xem', CREATE: 'Tạo', UPDATE: 'Cập nhật', DELETE: 'Xóa' }

/** What each permission prefix acts on, used to phrase `<Xem|Tạo|Cập nhật|Xóa> <đối tượng>`. */
const RESOURCE_NOUNS: Record<string, string> = {
  ACCESS_CREDENTIAL: 'mã truy cập của kho',
  ACTIVITY_LOG: 'nhật ký hoạt động và kiểm toán',
  BOOKING: 'đơn đặt kho',
  CONTRACT: 'hợp đồng thuê',
  DISCOUNT: 'ưu đãi',
  FACILITY: 'cơ sở',
  FEE: 'loại phí',
  LOGIN_HISTORY: 'lịch sử đăng nhập',
  PAYMENT: 'giao dịch thanh toán',
  PERMISSION: 'quyền hạn',
  POLICY: 'chính sách cơ sở',
  ROLE: 'vai trò',
  STAFF_ASSIGNMENT: 'phân công nhân viên',
  STORAGE_UNIT: 'kho',
  SUPPORT: 'phiếu hỗ trợ',
  UNIT_TYPE: 'loại kho',
  USER: 'tài khoản',
}

/** Permissions whose meaning is not just "<action> <resource>". */
const PERMISSION_DESCRIPTION_OVERRIDES: Record<string, string> = {
  ACCESS_CREDENTIAL_REVOKE: 'Thu hồi mã truy cập của kho',
  ACCESS_CREDENTIAL_UPDATE: 'Cấp lại mã PIN hoặc mã truy cập',
  BOOKING_CANCEL: 'Hủy đơn đặt kho',
  HANDOVER_CREATE: 'Hoàn tất bàn giao nhận kho hoặc nghiệm thu trả kho',
  HANDOVER_VIEW: 'Xem hồ sơ bàn giao và trả kho',
  OVERDUE_PROCESS: 'Duyệt xử lý quá hạn và niêm phong',
  OVERDUE_VIEW: 'Xem các trường hợp quá hạn',
  REFUND_APPROVE: 'Duyệt hoàn tiền cọc',
  REFUND_VIEW: 'Xem yêu cầu hoàn tiền cọc',
  RENEWAL_CREATE: 'Tạo và thanh toán yêu cầu gia hạn',
  RENEWAL_VIEW: 'Xem yêu cầu gia hạn',
  REPORT_VIEW: 'Xem báo cáo kinh doanh',
  ROLE_PERMISSION_ASSIGN: 'Gán quyền cho vai trò',
  ROLE_PERMISSION_REVOKE: 'Thu hồi quyền khỏi vai trò',
  ROLE_PERMISSION_VIEW: 'Xem quyền đã gán cho vai trò',
  STAFF_ASSIGNMENT_CREATE: 'Phân công nhân viên vào cơ sở',
  STAFF_ASSIGNMENT_DELETE: 'Gỡ phân công nhân viên',
  CONTRACT_UPDATE: 'Cập nhật trạng thái hợp đồng thuê',
}

const VIETNAMESE_DIACRITICS = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i

/**
 * Vietnamese description of a permission. The database seeds some of them in English, so those are rebuilt
 * from the permission code; a description that is already Vietnamese is kept as written.
 */
export function describePermission(permission: Pick<PermissionRecord, 'name' | 'description'>): string | undefined {
  const original = permission.description?.trim() || undefined
  if (original && VIETNAMESE_DIACRITICS.test(original)) return original
  const override = PERMISSION_DESCRIPTION_OVERRIDES[permission.name]
  if (override) return override
  const separator = permission.name.lastIndexOf('_')
  if (separator > 0) {
    const verb = ACTION_VERBS[permission.name.slice(separator + 1)]
    const noun = RESOURCE_NOUNS[permission.name.slice(0, separator)]
    if (verb && noun) return `${verb} ${noun}`
  }
  return original
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
  ADMIN: 'Quản trị toàn bộ hệ thống',
  BUSINESS_MANAGER: 'Giám đốc vận hành, theo dõi toàn chuỗi cơ sở',
  FACILITY_MANAGER: 'Quản lý vận hành một cơ sở',
  STAFF: 'Nhân viên vận hành tại một cơ sở',
  CUSTOMER: 'Khách hàng thuê kho',
}

/** Vietnamese description of a role (the seeded ones are in English); custom roles keep what was typed. */
export function describeRole(role: { name: string; description?: string | null }): string | undefined {
  const original = role.description?.trim() || undefined
  if (original && VIETNAMESE_DIACRITICS.test(original)) return original
  return ROLE_DESCRIPTIONS[role.name.toUpperCase()] ?? original
}

export const getPermissionGroupKey = (permission: PermissionRecord): string =>
  (permission.permissionGroup || OTHER_GROUP).toUpperCase()

export const getPermissionGroupLabel = (groupKey: string): string =>
  groupKey === OTHER_GROUP ? 'Khác' : (GROUP_LABELS[groupKey] ?? humanizeEnum(groupKey))

export interface PermissionGroup {
  key: string
  label: string
  permissions: PermissionRecord[]
}

/** Permissions bucketed by group, groups and permissions sorted by label / code. */
export function groupPermissions(permissions: readonly PermissionRecord[]): PermissionGroup[] {
  const groups = new Map<string, PermissionRecord[]>()
  for (const permission of permissions) {
    const key = getPermissionGroupKey(permission)
    groups.set(key, [...(groups.get(key) ?? []), permission])
  }
  return [...groups.entries()]
    .map(([key, items]) => ({
      key,
      label: getPermissionGroupLabel(key),
      permissions: items.sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'vi'))
}
