/**
 * Validation shared by registration, reset password and the forgot-password
 * form. Mirrors the backend DTOs (BE `RegisterRequest`, `ResetPasswordRequest`,
 * `ForgotPasswordRequest`), so a value accepted here is accepted by the API.
 */

/** `@Size(min = 5)` on `password` and `newPassword`. */
export const PASSWORD_MIN_LENGTH = 5
export const PASSWORD_HINT = `Tối thiểu ${PASSWORD_MIN_LENGTH} ký tự.`

/** `@Size(max = 30)` on `fullName`; the profile form also requires at least 3. */
export const FULL_NAME_MIN_LENGTH = 3
export const FULL_NAME_MAX_LENGTH = 30

/** Same pattern as the backend `@Pattern` on `phone`. */
export const VIETNAMESE_PHONE_PATTERN = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/

/** Same shape as the backend `@ValidEmail` (`EmailAddresses.PATTERN`): a dot-separated domain is required. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * True when `value` contains an angle bracket or a control character. The backend (`@PlainText`) refuses such names
 * because they are echoed back in mails, contracts and exports.
 */
export const hasMarkupOrControlChars = (value: string): boolean =>
  Array.from(value).some(char => {
    const code = char.charCodeAt(0)
    return char === '<' || char === '>' || code < 32 || code === 127
  })

export const FULL_NAME_MARKUP_MESSAGE = 'Họ và tên không được chứa ký tự < hoặc >.'

export const isValidEmail = (value: string): boolean => EMAIL_PATTERN.test(value.trim())

export function validatePassword(password: string): string | null {
  if (!password) return 'Vui lòng nhập mật khẩu.'
  if (password.length < PASSWORD_MIN_LENGTH) return `Mật khẩu cần có ít nhất ${PASSWORD_MIN_LENGTH} ký tự.`
  return null
}

export function validatePasswordConfirmation(password: string, confirmation: string): string | null {
  if (!confirmation) return 'Vui lòng nhập lại mật khẩu.'
  if (password !== confirmation) return 'Mật khẩu nhập lại không khớp.'
  return null
}

export function validateFullName(value: string): string | null {
  const name = value.trim()
  if (!name) return 'Vui lòng nhập họ và tên.'
  if (name.length < FULL_NAME_MIN_LENGTH || name.length > FULL_NAME_MAX_LENGTH) {
    return `Họ và tên cần từ ${FULL_NAME_MIN_LENGTH} đến ${FULL_NAME_MAX_LENGTH} ký tự.`
  }
  if (hasMarkupOrControlChars(name)) return FULL_NAME_MARKUP_MESSAGE
  return null
}

export function validateEmail(value: string): string | null {
  if (!value.trim()) return 'Vui lòng nhập email.'
  if (!isValidEmail(value)) return 'Email chưa đúng định dạng.'
  return null
}

export function validatePhone(value: string): string | null {
  if (!value.trim()) return 'Vui lòng nhập số điện thoại.'
  if (!VIETNAMESE_PHONE_PATTERN.test(value.trim())) return 'Số điện thoại Việt Nam chưa hợp lệ (ví dụ 0912345678).'
  return null
}
