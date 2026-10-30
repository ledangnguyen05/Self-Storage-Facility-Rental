import React, { useState, useEffect } from 'react'
import { StaffAssignmentResponse } from '../../../services/staffAssignmentService'
import { formatShiftLabel, formatRoleInShift, formatShiftTimeRange } from '../../../constants/shiftConstants'

interface ShiftDeleteConfirmModalProps {
  isOpen: boolean
  assignment: StaffAssignmentResponse | null
  onClose: () => void
  onConfirm: (assignment: StaffAssignmentResponse, reason?: string) => Promise<void>
}

const formatVN = (dateStr?: string | null): string => {
  if (!dateStr) return '—'
  const parts = dateStr.split('-')
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }
  return dateStr
}

const getDayOfWeekVN = (dateStr?: string | null): string => {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']
    return days[d.getDay()] || ''
  } catch {
    return ''
  }
}

export const ShiftDeleteConfirmModal: React.FC<ShiftDeleteConfirmModalProps> = ({
  isOpen,
  assignment,
  onClose,
  onConfirm
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState<string>('')
  const [selectedPresetReason, setSelectedPresetReason] = useState<string>('')

  const PRESET_REASONS = [
    'Nhân viên xin nghỉ đột xuất / việc riêng',
    'Điều chỉnh lại kế hoạch phân ca của cơ sở',
    'Thay đổi vị trí và phân khu làm việc',
    'Trùng lịch hoặc sai sót khi tạo ca'
  ]

  useEffect(() => {
    if (isOpen) {
      setIsSubmitting(false)
      setErrorMessage(null)
      setCancelReason('')
      setSelectedPresetReason('')
    }
  }, [isOpen, assignment])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose()
      }
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, isSubmitting, onClose])

  if (!isOpen || !assignment) return null

  const handleSelectPreset = (reason: string) => {
    if (selectedPresetReason === reason) {
      setSelectedPresetReason('')
      setCancelReason('')
    } else {
      setSelectedPresetReason(reason)
      setCancelReason(reason)
    }
  }

  const handleConfirmAction = async () => {
    if (isSubmitting) return
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const finalReason = cancelReason.trim() || selectedPresetReason || undefined
      await onConfirm(assignment, finalReason)
      onClose()
    } catch (err: any) {
      console.error('Failed to cancel shift assignment:', err)
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Không thể hủy phân công ca trực. Vui lòng thử lại.'
      setErrorMessage(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const staffName = assignment.staffFullName || assignment.staffUsername || 'Nhân sự chưa đặt tên'
  const staffInitial = staffName.charAt(0).toUpperCase()
  const shiftTimeStr = formatShiftTimeRange(assignment)
  const dayOfWeek = getDayOfWeekVN(assignment.assignedDate)
  const dateFormatted = formatVN(assignment.assignedDate)

  const isMorning = assignment.shift === 'MORNING'
  const isNight = assignment.shift === 'NIGHT'

  const shiftBadgeStyle = isMorning
    ? 'bg-amber-50 text-amber-800 border-amber-200'
    : isNight
    ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
    : 'bg-blue-50 text-blue-800 border-blue-200'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={() => {
        if (!isSubmitting) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-shift-modal-title"
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-rose-100 bg-gradient-to-r from-rose-50/90 via-red-50/50 to-orange-50/30 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-rose-100 border border-rose-200/80 text-rose-600 flex items-center justify-center shrink-0 shadow-xs">
              <span className="material-symbols-outlined text-[24px]">event_busy</span>
            </div>
            <div>
              <h3 id="delete-shift-modal-title" className="text-base font-bold text-slate-900 tracking-tight">
                Xác nhận hủy phân công ca trực
              </h3>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                Mã phân công: <span className="font-mono text-slate-700 font-semibold">#{assignment.id.slice(0, 8).toUpperCase()}</span> · Thao tác quản lý nhân sự
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            aria-label="Đóng"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100/80 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4.5 overflow-y-auto text-xs text-slate-700">
          {/* Main prompt */}
          <p className="text-slate-600 text-xs leading-relaxed">
            Bạn đang yêu cầu hủy phân công ca làm việc này. Vui lòng rà soát lại thông tin nhân sự và ca trực bên dưới trước khi xác nhận.
          </p>

          {/* Shift Details Summary Card */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3 shadow-2xs">
            {/* Staff info header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                  {staffInitial}
                </div>
                <div>
                  <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <span>{staffName}</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200/60">
                      {assignment.staffRole || 'STAFF'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    {assignment.staffEmail || assignment.staffUsername || 'boxora.staff'}
                  </div>
                </div>
              </div>
            </div>

            {/* Shift grid details */}
            <div className="grid grid-cols-2 gap-3 text-xs pt-1">
              {/* Ngày trực */}
              <div className="space-y-1">
                <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px] text-slate-400">calendar_today</span>
                  <span>Ngày làm việc</span>
                </div>
                <div className="font-semibold text-slate-800">
                  {dayOfWeek}, <span className="font-mono">{dateFormatted}</span>
                </div>
              </div>

              {/* Ca trực */}
              <div className="space-y-1">
                <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px] text-slate-400">schedule</span>
                  <span>Ca & Khung giờ</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] border ${shiftBadgeStyle}`}>
                    {formatShiftLabel(assignment.shift)}
                  </span>
                  <span className="font-mono text-slate-700 text-[11px] font-semibold">
                    {shiftTimeStr}
                  </span>
                </div>
              </div>

              {/* Phân khu phụ trách */}
              <div className="space-y-1">
                <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px] text-slate-400">domain</span>
                  <span>Phân khu & Vị trí</span>
                </div>
                <div className="font-medium text-slate-800">
                  {assignment.assignedZone || 'Khu vực quầy tiếp tân'}
                </div>
              </div>

              {/* Vai trò trong ca */}
              <div className="space-y-1">
                <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px] text-slate-400">badge</span>
                  <span>Vai trò ca trực</span>
                </div>
                <div className="font-semibold text-indigo-700">
                  {formatRoleInShift(assignment.roleInShift)}
                </div>
              </div>
            </div>

            {/* Ghi chú ban đầu (nếu có) */}
            {assignment.notes && (
              <div className="pt-2 border-t border-slate-200/60 text-[11px]">
                <span className="text-slate-500 font-medium">Ghi chú điều phối: </span>
                <span className="text-slate-700 italic">"{assignment.notes}"</span>
              </div>
            )}
          </div>

          {/* Warning Banner */}
          <div className="rounded-xl border border-amber-200/80 bg-gradient-to-r from-amber-50/90 to-orange-50/50 p-3.5 flex gap-3 text-amber-950">
            <span className="material-symbols-outlined text-amber-600 text-[22px] shrink-0 mt-0.5">
              warning
            </span>
            <div className="space-y-1 leading-relaxed">
              <div className="font-bold text-amber-900 text-xs">
                Lưu ý quan trọng khi hủy phân ca:
              </div>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-800/90 pl-0.5">
                <li>
                  Ca trực sẽ được chuyển sang trạng thái <strong className="text-amber-950 font-bold">ĐÃ HỦY (CANCELLED)</strong> và rút khỏi lịch trực của nhân viên.
                </li>
                <li>
                  Nhân viên sẽ <strong className="text-amber-950 font-bold">không thể Check-in</strong> hay chấm công cho ca này.
                </li>
                <li>
                  Thao tác sẽ được ghi nhận vào <strong className="text-amber-950 font-bold">Nhật ký kiểm toán hệ thống (Audit Log)</strong>.
                </li>
              </ul>
            </div>
          </div>

          {/* Preset Reasons (Optional) */}
          <div className="space-y-2">
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              Lý do hủy phân công <span className="font-normal text-slate-400 lowercase">(tùy chọn)</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_REASONS.map((reason) => {
                const isSelected = selectedPresetReason === reason
                return (
                  <button
                    key={reason}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleSelectPreset(reason)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-rose-100 text-rose-800 border border-rose-300 font-semibold'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70 border border-slate-200'
                    }`}
                  >
                    {isSelected ? '✓ ' : ''}{reason}
                  </button>
                )
              })}
            </div>
            <input
              type="text"
              value={cancelReason}
              onChange={(e) => {
                setCancelReason(e.target.value)
                setSelectedPresetReason('')
              }}
              placeholder="Nhập ghi chú lý do hủy ca nếu có..."
              disabled={isSubmitting}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-colors bg-white"
            />
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-rose-600 shrink-0">
                error
              </span>
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            Giữ lại ca trực
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleConfirmAction}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white font-bold text-xs shadow-md shadow-rose-500/20 flex items-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Đang hủy phân công...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[16px]">delete_forever</span>
                <span>Xác nhận hủy phân công</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
