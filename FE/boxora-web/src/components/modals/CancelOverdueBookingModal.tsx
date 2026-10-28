import React, { useState, useEffect } from 'react'
import { Booking } from '../../types'
import { getBookingScheduleInfo } from './EarlyCheckInConfirmModal'

export interface CancelOverdueBookingModalProps {
  isOpen: boolean
  booking: Booking | null
  userRoleTitle?: string
  onConfirm: (booking: Booking, reason: string) => Promise<void> | void
  onClose: () => void
}

export const CancelOverdueBookingModal: React.FC<CancelOverdueBookingModalProps> = ({
  isOpen,
  booking,
  userRoleTitle = 'Nhân viên quầy Boxora',
  onConfirm,
  onClose,
}) => {
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && booking) {
      setReason(
        `Hủy đơn do quá hạn 48 giờ sau lịch hẹn check-in nhưng khách hàng chưa đến làm thủ tục tiếp nhận tại quầy`
      )
      setErrorMsg(null)
      setIsSubmitting(false)
    }
  }, [isOpen, booking])

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

  if (!isOpen || !booking) return null

  const schedule = getBookingScheduleInfo(booking)
  const unitText = booking.unitCode ? `Kho #${booking.unitCode}` : (booking.unitTypeName || 'buồng kho')
  const facilityText = booking.facilityName || 'Cơ sở Boxora'
  const contractCodeText = booking.contractCode || `CTR-${booking.bookingCode}`

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!reason.trim()) {
      setErrorMsg('Vui lòng nhập lý do hủy đơn.')
      return
    }
    try {
      setIsSubmitting(true)
      setErrorMsg(null)
      await onConfirm(booking, reason.trim())
    } catch (err: any) {
      setErrorMsg(err?.message || 'Có lỗi xảy ra khi thực hiện hủy đơn.')
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={() => {
        if (!isSubmitting) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-overdue-modal-title"
    >
      <div
        className="w-full max-w-xl max-h-[92vh] rounded-3xl border border-rose-200 dark:border-rose-900/60 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden flex flex-col text-left animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Danger Rose Gradient */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-rose-700 via-rose-800 to-rose-900 text-white flex items-center justify-between border-b border-rose-800 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-white/15 border border-white/20 text-white flex items-center justify-center shrink-0 shadow-xs">
              <span className="material-symbols-outlined text-[24px]">event_busy</span>
            </span>
            <div className="min-w-0">
              <h3 id="cancel-overdue-modal-title" className="font-extrabold text-sm sm:text-base leading-tight truncate">
                Xác Nhận Hủy Đơn Quá Hạn 48 Giờ
              </h3>
              <div className="flex items-center gap-2 mt-0.5 text-xs font-mono text-rose-100 flex-wrap">
                <span>Mã đơn: <strong className="text-white font-bold">{booking.bookingCode}</strong></span>
                <span>•</span>
                <span>HĐ: <strong className="text-white font-bold">{contractCodeText}</strong></span>
              </div>
            </div>
          </div>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/20 hover:bg-black/35 text-white/80 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0 disabled:opacity-50"
            title="Đóng hộp thoại"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 text-xs sm:text-sm">
          {/* Overdue Alert Banner */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-rose-50/90 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-start gap-3 text-rose-900 dark:text-rose-200">
            <span className="material-symbols-outlined text-rose-600 dark:text-rose-400 text-[22px] shrink-0 mt-0.5">
              warning
            </span>
            <div className="text-xs leading-relaxed">
              <p className="font-bold text-rose-950 dark:text-rose-100 text-[13px] mb-0.5">
                Đơn đặt giữ chỗ đã quá thời hạn tiếp nhận check-in
              </p>
              <p>
                Đơn <strong>{booking.bookingCode}</strong> của khách hàng <strong>{booking.customerName || 'N/A'}</strong> đã quá 48 giờ sau lịch hẹn ({schedule.relativeText || 'quá thời hạn'}) nhưng chưa được tiếp nhận tại quầy.
              </p>
            </div>
          </div>

          {/* Booking Summary Box */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-2.5">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Thông tin đơn đặt kho
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-slate-400">person</span>
                <span className="text-slate-600 dark:text-slate-300">Khách hàng:</span>
                <strong className="text-slate-900 dark:text-white truncate">{booking.customerName || 'N/A'}</strong>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-slate-400">call</span>
                <span className="text-slate-600 dark:text-slate-300">SĐT:</span>
                <strong className="text-slate-900 dark:text-white font-mono">{booking.customerPhone || 'Không có'}</strong>
              </div>
              <div className="flex items-center gap-2 sm:col-span-2">
                <span className="material-symbols-outlined text-[16px] text-slate-400">mail</span>
                <span className="text-slate-600 dark:text-slate-300">Email:</span>
                <strong className="text-slate-900 dark:text-white font-mono truncate">{booking.customerEmail || 'Chưa cung cấp'}</strong>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-slate-400">location_on</span>
                <span className="text-slate-600 dark:text-slate-300">Cơ sở:</span>
                <strong className="text-slate-900 dark:text-white">{facilityText}</strong>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-slate-400">shelves</span>
                <span className="text-slate-600 dark:text-slate-300">Buồng kho:</span>
                <strong className="text-slate-900 dark:text-white">{unitText} ({booking.rentalMonths || 1} tháng)</strong>
              </div>
              <div className="flex items-center gap-2 sm:col-span-2">
                <span className="material-symbols-outlined text-[16px] text-blue-500">calendar_clock</span>
                <span className="text-slate-600 dark:text-slate-300">Lịch hẹn check-in:</span>
                <strong className="text-slate-900 dark:text-white">
                  {schedule.dateFormatted || (booking as any).checkInDate || booking.startDate || 'N/A'} lúc {schedule.timeFormatted || (booking as any).checkInTime || '09:00'}
                </strong>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ml-1 ${schedule.badgeClass}`}>
                  {schedule.relativeText || 'Quá hạn'}
                </span>
              </div>
            </div>
          </div>

          {/* Consequence Checklist */}
          <div className="space-y-2">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Các thao tác hệ thống sẽ thực thi tự động:
            </div>

            <div className="space-y-2">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 font-bold text-[11px] mt-0.5">
                  1
                </span>
                <div className="text-xs">
                  <div className="font-bold text-slate-800 dark:text-slate-100">
                    Cập nhật trạng thái đơn sang <span className="text-rose-600 dark:text-rose-400">ĐÃ HỦY (CANCELLED)</span>
                  </div>
                  <div className="text-slate-500 text-[11.5px] mt-0.5">
                    Hồ sơ đặt chỗ sẽ đóng lại và lưu vết lịch sử nhân viên hủy đơn.
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 font-bold text-[11px] mt-0.5">
                  2
                </span>
                <div className="text-xs">
                  <div className="font-bold text-slate-800 dark:text-slate-100">
                    Giải phóng buồng <strong className="text-emerald-700 dark:text-emerald-400">{unitText}</strong> về trạng thái <strong className="text-emerald-700 dark:text-emerald-400">TRỐNG (AVAILABLE)</strong>
                  </div>
                  <div className="text-slate-500 text-[11.5px] mt-0.5">
                    Hoàn lại số lượng khả dụng tại cơ sở {facilityText} ở Bước 2 quy trình đặt kho trực tuyến.
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 font-bold text-[11px] mt-0.5">
                  3
                </span>
                <div className="text-xs">
                  <div className="font-bold text-slate-800 dark:text-slate-100">
                    Tự động gửi email thông báo hủy đơn đến khách hàng
                  </div>
                  <div className="text-slate-500 text-[11.5px] mt-0.5 font-mono truncate">
                    Gửi tới: <span className="text-blue-600 dark:text-blue-400 font-semibold">{booking.customerEmail || 'email khách hàng'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Reason Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Lý do hủy đơn ghi nhận hệ thống &amp; gửi cho khách:
            </label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value)
                if (errorMsg) setErrorMsg(null)
              }}
              disabled={isSubmitting}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500 transition disabled:opacity-50"
              placeholder="Nhập lý do hủy đơn..."
            />
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-100 text-rose-800 text-xs font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">error</span>
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-slate-500 hidden sm:block">
            Thao tác bởi: <strong className="text-slate-700 dark:text-slate-300">{userRoleTitle}</strong>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer disabled:opacity-50"
            >
              Hủy bỏ / Giữ lại
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSubmit}
              className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-98 text-white text-xs font-bold shadow-md shadow-rose-600/30 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Đang xử lý hủy đơn...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">event_busy</span>
                  <span>Xác nhận hủy đơn &amp; Giải phóng kho</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
