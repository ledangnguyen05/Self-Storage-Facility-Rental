import { SITE_CONFIG } from '../../../constants/siteConfig'
import { getApiErrorCode, getApiErrorMessage } from '../../../lib/apiError'

/**
 * Backend `ErrorCode`s whose copy is extended with a next step. Every other code (captcha 303/304, Google
 * 305/307, rate limit 612, email delivery 610, validation 601...) already carries a Vietnamese server message.
 * A username collision (201) no longer exists: the server derives a unique username on registration.
 */
const AUTH_ERROR_COPY: Record<number, string> = {
  202: 'Email này đã được đăng ký. Hãy đăng nhập hoặc dùng email khác.',
  203: `Tài khoản đang bị khóa. Vui lòng liên hệ hotline ${SITE_CONFIG.hotline.display} để được hỗ trợ.`,
  300: 'Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.',
}

/** Message for a failed login / registration / Google call. */
export function describeAuthError(err: unknown, fallback: string): string {
  const code = getApiErrorCode(err)
  if (code !== undefined && AUTH_ERROR_COPY[code]) return AUTH_ERROR_COPY[code]
  return getApiErrorMessage(err, fallback)
}
