import React, { useEffect } from 'react'
import { Booking } from '../../types'

export type EarlyCheckInActionType = 'ASSIGN_UNIT' | 'ASSIGN_PHYSICAL_UNIT' | 'ENTER_RECEPTION' | 'CLAIM_RECEPTION'

export interface BookingScheduleInfo {
  targetDate: Date | null
  isPremature: boolean
  dateFormatted: string
  timeFormatted: string
  fullAppointmentText: string
  relativeText: string
  badgeClass: string
  diffDays: number
  diffHours: number
}

/**
 * Checks whether a booking's scheduled check-in date/time has not yet arrived.
 * Returns true if target date/time is in the future relative to current time.
 */
export const getBookingScheduleInfo = (
  booking: Booking | null | undefined,
  now = new Date()
): BookingScheduleInfo => {
  if (!booking) {
    return {
      targetDate: null,
      isPremature: false,
      dateFormatted: '',
      timeFormatted: '',
      fullAppointmentText: '',
      relativeText: '',
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
      diffDays: 0,
      diffHours: 0,
    }
  }

  let targetDate: Date | null = null

  // 1. Try expectedCheckInAt
  if (booking.expectedCheckInAt) {
    const parsed = new Date(booking.expectedCheckInAt)
    if (!isNaN(parsed.getTime())) {
      targetDate = parsed
    }
  }

  // 2. Try checkInDate or startDate combined with checkInTime
  if (!targetDate) {
    const rawDate = (booking as any).checkInDate || booking.startDate
    const rawTime = (booking as any).checkInTime || '09:00'
    const timeClean = String(rawTime).split(' - ')[0].trim() || '09:00'

    if (rawDate) {
      if (rawDate.includes('T')) {
        const parsed = new Date(rawDate)
        if (!isNaN(parsed.getTime())) {
          targetDate = parsed
        }
      } else {
        const timePart = timeClean.length === 5 ? `${timeClean}:00` : timeClean
        const parsed = new Date(`${rawDate}T${timePart}`)
        if (!isNaN(parsed.getTime())) {
          targetDate = parsed
        } else {
          const fallbackDate = new Date(rawDate)
          if (!isNaN(fallbackDate.getTime())) {
            targetDate = fallbackDate
          }
        }
      }
    }
  }

  if (!targetDate) {
    return {
      targetDate: null,
      isPremature: false,
      dateFormatted: booking.startDate || 'Chưa xác định',
      timeFormatted: 'Giờ hẹn',
      fullAppointmentText: booking.startDate || 'Lịch hẹn chưa xác định',
      relativeText: '',
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
      diffDays: 0,
      diffHours: 0,
    }
  }

  const dateFormatted = targetDate.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  const timeFormatted = targetDate.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  })

  // Compare timestamps
  const diffMs = targetDate.getTime() - now.getTime()
  const isPremature = diffMs > 0
  const diffHours = Math.round(diffMs / (1000 * 60 * 60))

  // Calculate day difference based on calendar dates
  const targetMidnight = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()).getTime()
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const diffDays = Math.round((targetMidnight - nowMidnight) / (1000 * 60 * 60 * 24))

  let relativeText = ''
  let badgeClass = 'bg-slate-100 text-slate-700 border-slate-200'
  if (diffDays === 0) {
    if (diffMs > 0) {
      const hoursLeft = Math.max(1, Math.round(diffMs / (1000 * 60 * 60)))
      relativeText = `Hôm nay (sau ${hoursLeft} giờ)`
      badgeClass = 'bg-amber-100 text-amber-900 border-amber-300'
    } else {
      relativeText = 'Hôm nay'
      badgeClass = 'bg-emerald-100 text-emerald-900 border-emerald-300'
    }
  } else if (diffDays > 0) {
    relativeText = `${diffDays} ngày tới`
    badgeClass = 'bg-blue-50 text-blue-800 border-blue-200'
  } else {
    relativeText = `Quá ${Math.abs(diffDays)} ngày`
    badgeClass = 'bg-rose-50 text-rose-800 border-rose-200'
  }

  const fullAppointmentText = `${timeFormatted} - ${dateFormatted}${relativeText ? ` (${relativeText})` : ''}`

  return {
    targetDate,
    isPremature,
    dateFormatted,
    timeFormatted,
    fullAppointmentText,
    relativeText,
    badgeClass,
    diffDays,
    diffHours,
  }
}

export const isBookingBeforeCheckInTime = (
  booking: Booking | null | undefined,
  now = new Date()
): { isPremature: boolean; formattedAppointment: string; scheduleInfo: BookingScheduleInfo } => {
  const scheduleInfo = getBookingScheduleInfo(booking, now)
  return {
    isPremature: scheduleInfo.isPremature,
    formattedAppointment: scheduleInfo.fullAppointmentText,
    scheduleInfo,
  }
}

export interface EarlyCheckInConfirmModalProps {
  isOpen: boolean
  booking: Booking | null
  actionType: EarlyCheckInActionType
  onConfirm: () => void
  onClose: () => void
}

export const EarlyCheckInConfirmModal: React.FC<EarlyCheckInConfirmModalProps> = ({
  isOpen,
  booking,
  actionType,
  onConfirm,
  onClose,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen || !booking) return null

  const schedule = getBookingScheduleInfo(booking)

  const actionTitle =
    actionType === 'ASSIGN_UNIT' || actionType === 'ASSIGN_PHYSICAL_UNIT'
      ? 'Check-in'
      : actionType === 'ENTER_RECEPTION'
      ? 'Check-in'
      : 'Tiếp nhận đón khách'

  const actionDescription =
    actionType === 'ASSIGN_UNIT' || actionType === 'ASSIGN_PHYSICAL_UNIT'
      ? 'Check-in và gán ô kho vật lý đang trống cho khách hàng trước ngày hẹn'
      : actionType === 'ENTER_RECEPTION'
      ? 'Mở bàn tiếp đón để đối soát CCCD, nghiệm thu và Check-in cho khách'
      : 'Tiếp nhận ca đón khách và phân công nhân sự phụ trách'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="early-checkin-modal-title"
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-amber-200 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Warm Amber Accent */}
        <div className="px-6 py-4 border-b border-amber-100 dark:border-amber-900/50 flex items-center justify-between bg-gradient-to-r from-amber-50 via-amber-50/70 to-white dark:from-amber-950/40 dark:via-slate-900 dark:to-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 border border-amber-300/80 shadow-xs">
              <span className="material-symbols-outlined text-[24px]">schedule</span>
            </div>
            <div>
              <h3 id="early-checkin-modal-title" className="text-base font-bold text-slate-900 dark:text-white">
                Xác Nhận Thao Tác Trước Lịch Hẹn
              </h3>
              <p className="text-[11px] text-amber-800 dark:text-amber-400 font-medium">
                Vận hành bàn giao &amp; tiếp đón khách hàng Boxora
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 text-xs text-slate-700 dark:text-slate-300 max-h-[78vh] overflow-y-auto">
          {/* Main Confirmation Callout (Exact user-requested prompt) */}
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-200 flex items-start gap-3 shadow-xs">
            <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-[24px] shrink-0 mt-0.5">
              warning
            </span>
            <div className="space-y-2">
              <p className="text-sm font-bold text-amber-950 dark:text-amber-200 leading-snug">
                Khách đang nhận kho sớm hơn lịch hẹn. Bạn có chắc chắn muốn tiếp tục?
              </p>
              <div className="text-[11px] space-y-1 text-amber-900 dark:text-amber-300">
                <p><strong>Lịch Hẹn Check-in Nhận Kho:</strong> {schedule.fullAppointmentText}</p>
                <p>Chưa đến ngày check-in. Thời điểm đúng để thực hiện tiếp nhận kho từ: <strong>{schedule.timeFormatted} ngày {schedule.dateFormatted}</strong>.</p>
                <p className="italic bg-amber-100/60 dark:bg-amber-900/30 p-2 rounded-lg border border-amber-200 dark:border-amber-800/60">
                  <strong>Quy tắc xử lý:</strong> Nên theo quy trình tiếp nhận đúng lịch. Tuy nhiên, nếu cơ sở có đủ điều kiện phục vụ và khách cần nhận kho gấp thì nhân viên được phân quyền có thể xác nhận tiếp nhận sớm.
                </p>
              </div>
              <p className="text-[11px] text-amber-800 dark:text-amber-400 leading-relaxed pt-1 border-t border-amber-200/60 dark:border-amber-800/40">
                Thao tác: <strong className="underline underline-offset-2">{actionTitle}</strong> — {actionDescription}.
              </p>
            </div>
          </div>

          {/* Booking Context Box */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-3">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-200/80 dark:border-slate-700">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Mã đơn &amp; Hợp đồng:</span>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-700 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-600">
                  {booking.bookingCode}
                </span>
                {booking.contractCode && (
                  <span className="text-[11px] text-cyan-700 dark:text-cyan-400 font-semibold">
                    HĐ: {booking.contractCode}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Khách hàng</span>
                <span className="font-bold text-slate-900 dark:text-white block">{booking.customerName || 'N/A'}</span>
                {booking.customerPhone && (
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono block">
                    {booking.customerPhone}
                  </span>
                )}
              </div>

              <div>
                <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Cơ sở &amp; Kho</span>
                <span className="font-bold text-slate-900 dark:text-white block">
                  {booking.facilityName || 'Tại cơ sở'}
                </span>
                <span className="text-[11px] font-mono text-cyan-800 dark:text-cyan-400 block">
                  {booking.unitCode ? `Kho #${booking.unitCode}` : 'Chưa gán ô kho vật lý'}
                </span>
              </div>
            </div>

            {/* Scheduled Appointment Highlights */}
            <div className="pt-2.5 border-t border-slate-200/80 dark:border-slate-700 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-amber-600 dark:text-amber-400">
                  event_upcoming
                </span>
                <span className="text-slate-500 dark:text-slate-400 text-[11px]">Lịch hẹn nhận kho:</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                  {schedule.timeFormatted} · {schedule.dateFormatted}
                </span>
                {schedule.relativeText && (
                  <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-cyan-50 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
                    {schedule.relativeText}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Practical Note */}
          <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed bg-slate-50/60 dark:bg-slate-800/40 p-3 rounded-lg border border-slate-200/60 dark:border-slate-800">
            💡 <strong>Quy trình thực tế:</strong> Khách hàng đã chủ động đặt lịch hẹn vào khung giờ trên. Nếu khách hàng đến sớm tại cơ sở hoặc đã liên hệ trước với bộ phận vận hành, bạn có thể bấm <strong>&ldquo;Xác nhận tiếp tục&rdquo;</strong> để thực hiện thao tác.
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition cursor-pointer"
          >
            Hủy bỏ
          </button>

          <button
            type="button"
            onClick={() => {
              onClose()
              onConfirm()
            }}
            className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-98 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-amber-600/20 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">check</span>
            <span>Xác nhận tiếp tục</span>
          </button>
        </div>
      </div>
    </div>
  )
}
