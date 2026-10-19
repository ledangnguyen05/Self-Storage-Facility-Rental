import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Booking } from '../../types'

export interface ReceptionShiftAlertModalProps {
  isOpen: boolean
  onClose: () => void
  message: string
  booking?: Booking | null
  role?: 'STAFF' | 'FACILITY_MANAGER' | string
  canCheckInToday?: boolean
  onCheckInNow?: () => Promise<void> | void
  isCheckingIn?: boolean
}

export const ReceptionShiftAlertModal: React.FC<ReceptionShiftAlertModalProps> = ({
  isOpen,
  onClose,
  message,
  booking,
  role = 'STAFF',
  canCheckInToday = false,
  onCheckInNow,
  isCheckingIn = false,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isCheckingIn) {
        onClose()
      }
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, isCheckingIn, onClose])

  if (!isOpen) return null

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !isCheckingIn) {
      onClose()
    }
  }

  const handleDirectCheckIn = async () => {
    if (onCheckInNow) {
      try {
        await onCheckInNow()
        onClose()
      } catch {
        // Error is handled inside onCheckInNow
      }
    }
  }

  const formatBookingCheckinDate = () => {
    if (!booking) return ''
    if (booking.expectedCheckInAt) {
      const d = new Date(booking.expectedCheckInAt)
      if (!isNaN(d.getTime())) {
        return (
          d.toLocaleDateString('vi-VN') +
          ' ' +
          d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        )
      }
    }
    return booking.startDate || ''
  }

  const isFutureCheckin = (() => {
    if (!booking?.expectedCheckInAt && !booking?.startDate) return false
    const dateStr = booking.expectedCheckInAt
      ? booking.expectedCheckInAt.slice(0, 10)
      : booking.startDate
    const todayStr = new Date().toISOString().slice(0, 10)
    return dateStr > todayStr
  })()

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="reception-alert-title"
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Warm Amber Accent */}
        <div className="px-6 py-4 border-b border-amber-100 flex items-center justify-between bg-gradient-to-r from-amber-50 via-amber-50/60 to-white">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 border border-amber-300/80 shadow-xs">
              <span className="material-symbols-outlined text-[26px]">event_busy</span>
            </div>
            <div>
              <h3 id="reception-alert-title" className="text-base font-bold text-slate-900">
                Chưa Đủ Điều Kiện Tiếp Nhận Khách
              </h3>
              <p className="text-[11px] text-amber-800 font-medium">
                Yêu cầu ca trực & xác nhận điểm danh theo quy chuẩn
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isCheckingIn}
            onClick={onClose}
            aria-label="Đóng"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 text-xs text-slate-700 max-h-[78vh] overflow-y-auto">
          {/* Main Error Box */}
          <div className="p-4 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-950 flex items-start gap-3 shadow-xs">
            <span className="material-symbols-outlined text-amber-600 text-[22px] shrink-0 mt-0.5">
              warning
            </span>
            <div className="text-xs leading-relaxed font-semibold">
              {message}
            </div>
          </div>

          {/* Booking Context Details (If Available) */}
          {booking && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">Thông tin lượt đặt kho:</span>
                <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                  {booking.bookingCode}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block text-[11px]">Khách hàng</span>
                  <span className="font-bold text-slate-900">{booking.customerName || 'N/A'}</span>
                  {booking.customerPhone && (
                    <span className="text-[11px] text-slate-500 font-mono block">
                      {booking.customerPhone}
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Ngăn kho & Cơ sở</span>
                  <span className="font-mono font-bold text-cyan-800">#{booking.unitCode}</span>
                  <span className="text-[11px] text-slate-600 truncate block">
                    {booking.facilityName || 'Tại cơ sở'}
                  </span>
                </div>
                <div className="col-span-2 pt-2 border-t border-slate-200/50 flex items-center justify-between">
                  <span className="text-slate-500 text-[11px]">Ngày hẹn check-in:</span>
                  <div className="text-right">
                    <span className="font-mono font-bold text-slate-900">
                      {formatBookingCheckinDate()}
                    </span>
                    {isFutureCheckin && (
                      <span className="inline-block ml-2 px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-mono text-[10px] font-semibold">
                        Lịch hẹn tương lai
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Operating Policy Explanation */}
          <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3.5 text-xs text-blue-900 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-blue-950 text-[11px] uppercase tracking-wide">
              <span className="material-symbols-outlined text-[16px] text-blue-600">policy</span>
              Quy định thẩm quyền & điều kiện tiếp nhận:
            </div>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-blue-800/90 pl-1">
              <li>
                <strong>Phân ca trực đúng ngày:</strong> Chỉ nhân sự có lịch trực được phân công tại cơ sở vào <em>ngày hẹn check-in</em> mới được phép tiếp nhận.
              </li>
              <li>
                <strong>Đã điểm danh vào ca:</strong> Nhân sự phải hoàn tất xác nhận điểm danh vào ca trực trước khi thao tác tiếp đón khách.
              </li>
            </ul>
          </div>
        </div>

        {/* Actions Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isCheckingIn}
            className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 text-xs font-bold transition cursor-pointer disabled:opacity-50"
          >
            Đã hiểu
          </button>

          {/* Contextual Action Button */}
          {role === 'FACILITY_MANAGER' ? (
            <Link
              to="/portal/shifts"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">calendar_month</span>
              <span>Xếp ca & Quản trị lịch trực</span>
            </Link>
          ) : canCheckInToday && onCheckInNow ? (
            <button
              type="button"
              onClick={handleDirectCheckIn}
              disabled={isCheckingIn}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[16px]">how_to_reg</span>
              <span>{isCheckingIn ? 'Đang điểm danh...' : 'Điểm danh vào ca ngay'}</span>
            </button>
          ) : (
            <Link
              to="/portal/staff/shifts"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">schedule</span>
              <span>Xem lịch trực của tôi</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

export default ReceptionShiftAlertModal
