import React from 'react'
import { Modal } from '../ui/Modal'
import {
  Calendar,
  Clock,
  MapPin,
  Box,
  User,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  CalendarCheck,
  ShieldCheck,
  X,
} from 'lucide-react'

export interface PayLaterAppointmentConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => Promise<void> | void
  isSubmitting?: boolean
  facilityName?: string
  facilityAddress?: string
  unitName?: string
  rentalDuration?: string
  checkInDate?: string
  checkInTime?: string
  customerName?: string
  customerPhone?: string
  customerIdCard?: string
  totalEstimate?: number
  depositAmount?: number
  rentAmount?: number
}

export const PayLaterAppointmentConfirmModal: React.FC<PayLaterAppointmentConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isSubmitting = false,
  facilityName,
  facilityAddress,
  unitName,
  rentalDuration,
  checkInDate,
  checkInTime,
  customerName,
  customerPhone,
  customerIdCard,
  totalEstimate = 0,
  depositAmount = 0,
  rentAmount = 0,
}) => {
  const { periodTitle, periodSub } = React.useMemo(() => {
    if (!checkInTime) return { periodTitle: 'Trong giờ làm việc', periodSub: '' }
    const match = checkInTime.match(/^(.*?)\s*\((.*?)\)$/)
    if (match) {
      return { periodTitle: match[1].trim(), periodSub: match[2].trim() }
    }
    return { periodTitle: checkInTime, periodSub: '' }
  }, [checkInTime])

  return (
    <Modal isOpen={isOpen} onClose={isSubmitting ? () => {} : onClose} maxWidth="md">
      <div className="space-y-4 text-left">
        {/* Header with Icon */}
        <div className="flex items-start gap-3.5 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-950/70 border border-blue-200/80 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0 shadow-xs">
            <CalendarCheck size={22} />
          </div>
          <div className="space-y-0.5">
            <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
              Xác nhận đặt lịch giữ chỗ kho
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Quý khách vui lòng kiểm tra lại thời gian hẹn tiếp đón và thông tin buồng kho trước khi xác nhận.
            </p>
          </div>
        </div>

        {/* Highlight Banner: Appointment Schedule */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50/70 dark:from-blue-950/40 dark:to-indigo-950/30 border border-blue-200/80 dark:border-blue-800/70 shadow-xs space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900 dark:text-blue-200 uppercase tracking-wider">
            <Clock size={14} className="text-blue-600 dark:text-blue-400" />
            <span>Lịch hẹn đón tiếp tại cơ sở</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-white/90 dark:bg-slate-900/80 border border-blue-100 dark:border-slate-800 flex flex-col justify-between">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">Ngày nhận bàn giao</span>
              <strong className="text-slate-900 dark:text-white font-extrabold text-xs sm:text-sm flex items-center gap-1.5 mt-0.5">
                <Calendar size={14} className="text-blue-600 dark:text-blue-400 shrink-0" />
                <span>{checkInDate || 'Chưa chọn'}</span>
              </strong>
            </div>

            <div className="p-2.5 rounded-xl bg-white/90 dark:bg-slate-900/80 border border-blue-100 dark:border-slate-800 flex flex-col justify-between">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">Khung giờ tiếp đón</span>
              <div className="text-blue-700 dark:text-blue-300 font-extrabold text-xs sm:text-sm flex items-start gap-1.5 mt-0.5 leading-snug">
                <Clock size={14} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="flex flex-wrap items-baseline gap-x-1.5">
                  <span>{periodTitle}</span>
                  {periodSub && (
                    <span className="text-[11px] sm:text-xs font-semibold text-blue-600 dark:text-blue-400">
                      ({periodSub})
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-white/90 dark:bg-slate-900/80 border border-blue-100 dark:border-slate-800 text-xs flex items-start gap-2">
            <MapPin size={15} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <strong className="text-slate-900 dark:text-white block font-bold truncate">
                {facilityName || 'Cơ sở Boxora'}
              </strong>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                {facilityAddress || 'Địa chỉ cơ sở tiếp đón'}
              </span>
            </div>
          </div>
        </div>

        {/* Detailed Booking Information Card */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-1">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold flex items-center gap-1">
              <Box size={12} /> Buồng kho &amp; Thời hạn
            </span>
            <p className="font-bold text-slate-900 dark:text-white truncate">
              {unitName || 'Kho lưu trữ Boxora'}
            </p>
            <p className="text-[11px] text-slate-600 dark:text-slate-300">
              Thời gian thuê: <strong>{rentalDuration || '1 tháng'}</strong>
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-1">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold flex items-center gap-1">
              <User size={12} /> Người nhận bàn giao
            </span>
            <p className="font-bold text-slate-900 dark:text-white truncate">
              {customerName || 'Khách hàng'} • {customerPhone || ''}
            </p>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
              CCCD/Hộ chiếu: <strong>{customerIdCard || 'Chưa cung cấp'}</strong>
            </p>
          </div>
        </div>

        {/* Payment Policy Breakdown Card */}
        <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-600 dark:text-emerald-400" />
              <span>Thanh toán giữ chỗ hôm nay:</span>
            </span>
            <strong className="text-emerald-700 dark:text-emerald-300 font-extrabold text-sm sm:text-base">
              0 ₫ (Miễn phí)
            </strong>
          </div>
          <div className="pt-1 border-t border-emerald-200/60 dark:border-emerald-800/40 text-[11px] text-emerald-800 dark:text-emerald-300/90 leading-relaxed flex items-start gap-1.5">
            <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <span>
              Chi phí dự kiến thanh toán tại cơ sở vào ngày nhận kho: <strong>{totalEstimate.toLocaleString('vi-VN')} ₫</strong> (bao gồm tiền thuê: {rentAmount.toLocaleString('vi-VN')} ₫ và cọc hoàn lại: {depositAmount.toLocaleString('vi-VN')} ₫).
            </span>
          </div>
        </div>

        {/* Note Alert */}
        <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/90 dark:border-amber-800/70 text-[11px] text-amber-900 dark:text-amber-200 flex items-start gap-2">
          <AlertCircle size={15} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Quý khách vui lòng mang theo bản gốc <strong>CCCD / Hộ chiếu</strong> đến cơ sở đúng khung giờ đã hẹn để nhân viên đối soát, ký hợp đồng điện tử và bàn giao mã PIN khóa thông minh IoT.
          </p>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
          >
            Kiểm tra lại
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => void onConfirm()}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Đang xử lý đặt lịch...</span>
              </>
            ) : (
              <>
                <CalendarCheck size={16} />
                <span>Xác nhận đặt lịch</span>
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default PayLaterAppointmentConfirmModal
