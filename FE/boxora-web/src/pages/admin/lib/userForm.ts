import { PASSWORD_MIN_LENGTH, hasMarkupOrControlChars } from '@/pages/public/auth/credentialRules'
import type { Role, User } from '@/types'

export type UserFormMode = 'create' | 'edit'

export interface UserFormValues {
  fullName: string
  username: string
  email: string
  phone: string
  password: string
  roleId: string
  facilityId: string
}

export type UserFormErrors = Partial<Record<keyof UserFormValues, string>>

/** Roles that work inside one facility and therefore need a facility assignment. */
const FACILITY_ROLES = ['STAFF', 'FACILITY_MANAGER']

/** Same rule as the backend (`UserCreateRequest.phone`). */
const PHONE_PATTERN = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const USERNAME_PATTERN = /^[A-Za-z0-9._-]+$/
/** `UserCreateRequest.password` is `@Size(max = 72)` (bcrypt ignores everything after 72 bytes). */
const PASSWORD_MAX_LENGTH = 72

export const roleNeedsFacility = (roleName: string | undefined): boolean => FACILITY_ROLES.includes((roleName ?? '').toUpperCase())

export const findRole = (roles: readonly Role[], roleId: string): Role | undefined => roles.find(role => role.id === roleId)

export const getUserRoleName = (user: Pick<User, 'role' | 'roleName'>): string | undefined => user.role?.name ?? user.roleName

/** Initial values of the form: blank for a new account (role defaults to STAFF), the account's data when editing. */
export function initialUserFormValues(mode: UserFormMode, roles: readonly Role[], user?: User): UserFormValues {
  if (mode === 'edit' && user) {
    const roleName = getUserRoleName(user)
    const roleId = user.role?.id ?? user.roleId ?? roles.find(role => role.name === roleName)?.id ?? ''
    return {
      fullName: user.fullName ?? '',
      username: user.username,
      email: user.email,
      phone: user.phone ?? '',
      password: '',
      roleId,
      facilityId: user.facilityId ?? '',
    }
  }
  return {
    fullName: '',
    username: '',
    email: '',
    phone: '',
    password: '',
    roleId: roles.find(role => role.name === 'STAFF')?.id ?? roles[0]?.id ?? '',
    facilityId: '',
  }
}

export function validateUserForm(values: UserFormValues, mode: UserFormMode, roles: readonly Role[]): UserFormErrors {
  const errors: UserFormErrors = {}
  const fullName = values.fullName.trim()
  if (!fullName) errors.fullName = 'Nhập họ và tên.'
  else if (fullName.length < 3 || fullName.length > 30) errors.fullName = 'Họ và tên dài từ 3 đến 30 ký tự.'
  else if (hasMarkupOrControlChars(fullName)) errors.fullName = 'Họ và tên không được chứa ký tự < hoặc >.'

  // Required when creating; optional when editing (accounts made with Google sign-in may not have one yet).
  if (!values.phone.trim()) {
    if (mode === 'create') errors.phone = 'Nhập số điện thoại.'
  } else if (!PHONE_PATTERN.test(values.phone.trim())) {
    errors.phone = 'Số di động Việt Nam gồm 10 chữ số, bắt đầu bằng 0 hoặc +84.'
  }

  if (mode === 'create') {
    const username = values.username.trim()
    if (!username) errors.username = 'Nhập tên đăng nhập.'
    else if (username.length < 3 || username.length > 30) errors.username = 'Tên đăng nhập dài từ 3 đến 30 ký tự.'
    else if (!USERNAME_PATTERN.test(username)) errors.username = 'Chỉ dùng chữ, số, dấu chấm, gạch ngang và gạch dưới.'

    if (!values.email.trim()) errors.email = 'Nhập email.'
    else if (!EMAIL_PATTERN.test(values.email.trim())) errors.email = 'Email không hợp lệ.'

    if (!values.password) errors.password = 'Nhập mật khẩu ban đầu.'
    else if (values.password.length < PASSWORD_MIN_LENGTH) errors.password = `Mật khẩu tối thiểu ${PASSWORD_MIN_LENGTH} ký tự.`
    else if (values.password.length > PASSWORD_MAX_LENGTH) errors.password = `Mật khẩu tối đa ${PASSWORD_MAX_LENGTH} ký tự.`
  }

  const role = findRole(roles, values.roleId)
  if (!role) errors.roleId = 'Chọn vai trò.'
  else if (roleNeedsFacility(role.name) && !values.facilityId) errors.facilityId = 'Chọn cơ sở trực thuộc cho vai trò này.'

  return errors
}
