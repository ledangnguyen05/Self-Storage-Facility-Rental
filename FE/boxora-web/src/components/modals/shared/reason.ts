/** Value of the shared ReasonPicker: one optional preset plus one optional free-text note. */
export interface ReasonValue {
  preset: string
  note: string
}

export const EMPTY_REASON: ReasonValue = { preset: '', note: '' }

/** Reason presets for cancelling a booking. */
export const CANCEL_REASON_PRESETS = [
  'Thay đổi kế hoạch lưu trữ đồ đạc',
  'Tìm được cơ sở khác gần hơn',
  'Cần đổi sang kích thước ngăn kho khác',
  'Lịch công tác hoặc chuyển nhà thay đổi',
  'Thời gian nhận kho chưa phù hợp',
  'Lý do cá nhân khác',
] as const

/** Reason presets for rescheduling the check-in appointment. */
export const RESCHEDULE_REASON_PRESETS = [
  'Thay đổi kế hoạch vận chuyển đồ đạc',
  'Bận việc cá nhân đột xuất',
  'Cần thêm thời gian đóng gói hàng hóa',
  'Chờ phương tiện vận tải',
  'Trùng lịch công tác',
  'Lý do khác',
] as const

/**
 * Text sent to the backend. A preset and a note are combined ("Preset: note");
 * when both are empty the caller's neutral fallback is used.
 */
export function resolveReason(value: ReasonValue, fallback: string): string {
  const note = value.note.trim()
  if (value.preset && note) return `${value.preset}: ${note}`
  return note || value.preset || fallback
}
