/**
 * Chuẩn hóa xử lý ngày giờ & múi giờ Việt Nam (Asia/Ho_Chi_Minh, UTC+7) cho toàn bộ hệ thống Boxora.
 * Đảm bảo đồng bộ tuyệt đối giữa Frontend và Backend, không bị lệch ngày/giờ do toISOString() chuyển về UTC.
 */

export const VIETNAM_TIMEZONE = 'Asia/Ho_Chi_Minh'

/**
 * Lấy chuỗi ngày YYYY-MM-DD theo đúng múi giờ Việt Nam (Asia/Ho_Chi_Minh, UTC+7).
 * Nhận vào Date, string hoặc timestamp. Mặc định là thời điểm hiện tại.
 */
export const getVietnamDateString = (dateInput: Date | string | number = new Date()): string => {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput)
  if (isNaN(d.getTime())) {
    const today = new Date()
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: VIETNAM_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(today)
  }
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: VIETNAM_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

/**
 * Lấy chuỗi giờ HH:mm (24 giờ) theo đúng múi giờ Việt Nam (Asia/Ho_Chi_Minh).
 */
export const getVietnamTimeString = (dateInput: Date | string | number = new Date()): string => {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput)
  if (isNaN(d.getTime())) return '09:00'
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: VIETNAM_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
}

/**
 * Định dạng ngày sang DD/MM/YYYY chuẩn mực Việt Nam.
 * Ưu tiên trích xuất chuỗi YYYY-MM-DD trước để tránh parse nhầm UTC của new Date('YYYY-MM-DD').
 */
export const formatVietnamDate = (dateVal?: Date | string | number | null, fallback = ''): string => {
  if (!dateVal) return fallback
  if (typeof dateVal === 'string') {
    const clean = dateVal.split('T')[0].trim()
    const parts = clean.split('-')
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`
    }
  }
  try {
    const d = dateVal instanceof Date ? dateVal : new Date(dateVal)
    if (isNaN(d.getTime())) return fallback || String(dateVal)
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: VIETNAM_TIMEZONE,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(d)
  } catch {
    return fallback || String(dateVal)
  }
}

/**
 * Định dạng ngày giờ sang DD/MM/YYYY HH:mm hoặc HH:mm DD/MM/YYYY theo giờ Việt Nam.
 */
export const formatVietnamDateTime = (dateVal?: Date | string | number | null, fallback = ''): string => {
  if (!dateVal) return fallback
  try {
    const d = dateVal instanceof Date ? dateVal : new Date(dateVal)
    if (isNaN(d.getTime())) return fallback || String(dateVal)
    const dateFormatted = new Intl.DateTimeFormat('vi-VN', {
      timeZone: VIETNAM_TIMEZONE,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(d)
    const timeFormatted = new Intl.DateTimeFormat('en-GB', {
      timeZone: VIETNAM_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d)
    return `${dateFormatted} (${timeFormatted})`
  } catch {
    return fallback || String(dateVal)
  }
}

/**
 * Lấy ngày mai theo múi giờ Việt Nam dưới dạng chuỗi YYYY-MM-DD
 */
export const getVietnamTomorrowDateString = (): string => {
  const todayStr = getVietnamDateString()
  const [y, m, d] = todayStr.split('-').map(Number)
  const tomorrow = new Date(Date.UTC(y, m - 1, d + 1, 12, 0, 0))
  return getVietnamDateString(tomorrow)
}

/**
 * Tính số phút tính từ 00:00 của thời điểm hiện tại tại Việt Nam
 */
export const getVietnamCurrentMinutes = (refDate: Date = new Date()): number => {
  const parts = getVietnamTimeString(refDate).split(':')
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10)
}

