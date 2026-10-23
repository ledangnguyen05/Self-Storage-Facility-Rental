import React, { useState, useEffect } from 'react'
import { Booking, BookingRescheduleEligibility, BookingRescheduleResponse } from '../../types'
import { bookingService } from '../../services/bookingService'

interface BookingRescheduleModalProps {
  isOpen: boolean
  booking: Booking | null
  onClose: () => void
  onSuccess: (updatedBooking: Booking) => void
}

const REASON_PRESETS = [
  'Thay đổi kế hoạch vận chuyển đồ đạc',
  'Bận việc cá nhân đột xuất',
  'Cần thêm thời gian đóng gói hàng hóa',
  'Chờ phương tiện vận tải / xe tải',
  'Trùng lịch công tác',
  'Lý do khác',
]

export const BookingRescheduleModal: React.FC<BookingRescheduleModalProps> = ({
  isOpen,
  booking,
  onClose,
  onSuccess,
}) => {
  const [loadingEligibility, setLoadingEligibility] = useState(false)
  const [eligibility, setEligibility] = useState<BookingRescheduleEligibility | null>(null)
  const [eligibilityError, setEligibilityError] = useState<string | null>(null)

  const [newDate, setNewDate] = useState<string>('')
  const [newTime, setNewTime] = useState<string>('09:00')
  const [selectedReason, setSelectedReason] = useState<string>('')
  const [customReason, setCustomReason] = useState<string>('')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [successResult, setSuccessResult] = useState<BookingRescheduleResponse | null>(null)

  useEffect(() => {
    if (!isOpen || !booking) {
      setEligibility(null)
      setEligibilityError(null)
      setNewDate('')
      setNewTime('09:00')
      setSelectedReason('')
      setCustomReason('')
      setSubmitError(null)
      setSuccessResult(null)
      setIsSubmitting(false)
      return
    }

    let isMounted = true
    const loadEligibility = async () => {
      setLoadingEligibility(true)
      setEligibilityError(null)
      try {
        const res = await bookingService.getRescheduleEligibility(booking.id)
        if (isMounted) {
          setEligibility(res)
          // Lịch hẹn mới đề xuất: Lấy ngày check-in hiện tại + 24 giờ (hoặc ngày mai nếu chưa có)
          const currentCheckInStr = res.currentAppointmentAt || booking.expectedCheckInAt || (booking.startDate ? `${booking.startDate}T${booking.checkInTime || '09:00'}:00` : '')

          let targetDate = new Date()
          let targetTime = booking.checkInTime || '09:00'

          if (currentCheckInStr) {
            const currentAppt = new Date(currentCheckInStr)
            if (!isNaN(currentAppt.getTime())) {
              currentAppt.setHours(currentAppt.getHours() + 24)
              targetDate = currentAppt
              const hh = String(currentAppt.getHours()).padStart(2, '0')
              const mm = String(currentAppt.getMinutes()).padStart(2, '0')
              targetTime = `${hh}:${mm}`
            } else {
              targetDate.setDate(targetDate.getDate() + 1)
            }
          } else {
            targetDate.setDate(targetDate.getDate() + 1)
          }

          // Đảm bảo thời gian đề xuất mặc định luôn >= thời điểm hiện tại + 5 tiếng 30 phút
          const minBufferTime = new Date(Date.now() + 5 * 60 * 60 * 1000 + 30 * 60 * 1000)
          if (targetDate.getTime() < minBufferTime.getTime()) {
            targetDate = new Date(minBufferTime)
            const hh = String(targetDate.getHours()).padStart(2, '0')
            const mm = String(targetDate.getMinutes()).padStart(2, '0')
            targetTime = `${hh}:${mm}`
          }

          const year = targetDate.getFullYear()
          const month = String(targetDate.getMonth() + 1).padStart(2, '0')
          const day = String(targetDate.getDate()).padStart(2, '0')
          let proposedDateStr = `${year}-${month}-${day}`

          if (res.allowedMinDate && proposedDateStr < res.allowedMinDate) {
            proposedDateStr = res.allowedMinDate
          }
          if (res.allowedMaxDate && proposedDateStr > res.allowedMaxDate) {
            proposedDateStr = res.allowedMaxDate
          }

          setNewDate(proposedDateStr)
          setNewTime(targetTime)
        }
      } catch (err: any) {
        if (isMounted) {
          console.warn('Load reschedule eligibility error:', err)
          const msg = err?.response?.data?.message || err?.message || 'Không thể kiểm tra điều kiện đổi lịch.'
          setEligibilityError(msg)
        }
      } finally {
        if (isMounted) {
          setLoadingEligibility(false)
        }
      }
    }

    void loadEligibility()
    return () => {
      isMounted = false
    }
  }, [isOpen, booking])

  if (!isOpen || !booking) return null

  // Date formatting helpers
  const formatDateTime = (dateStr?: string | null) => {
    if (!dateStr) return 'Chưa thiết lập'
    try {
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return dateStr
      return d.toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'N/A'
    try {
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return dateStr
      return d.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  const formatCurrency = (val?: number | null) => {
    if (val === undefined || val === null) return '0 ₫'
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val)
  }

  // Calculate proposed expected end date based on newDate and rentalMonths
  const calculateProposedEndDate = (startDateStr: string, months: number) => {
    if (!startDateStr) return 'N/A'
    try {
      const [y, m, d] = startDateStr.split('-').map(Number)
      const date = new Date(y, m - 1, d)
      date.setMonth(date.getMonth() + months)
      return date.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    } catch {
      return 'N/A'
    }
  }

  // Validation: Check-in appointment must be at least 5 hours from current time
  const minAllowedDateTime = new Date(Date.now() + 5 * 60 * 60 * 1000)
  const minAllowedYear = minAllowedDateTime.getFullYear()
  const minAllowedMonth = String(minAllowedDateTime.getMonth() + 1).padStart(2, '0')
  const minAllowedDay = String(minAllowedDateTime.getDate()).padStart(2, '0')
  const minAllowedDateStr = `${minAllowedYear}-${minAllowedMonth}-${minAllowedDay}`

  const effectiveMinDate = eligibility?.allowedMinDate && eligibility.allowedMinDate > minAllowedDateStr
    ? eligibility.allowedMinDate
    : minAllowedDateStr

  const selectedDateTime = (newDate && newTime) ? new Date(`${newDate}T${newTime}:00`) : null
  const isTimeTooSoon = selectedDateTime ? selectedDateTime.getTime() < minAllowedDateTime.getTime() : false

  const earliestAllowedFormatted = minAllowedDateTime.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  const handleConfirmSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!booking) return

    if (isTimeTooSoon) {
      setSubmitError(`Giờ hẹn check-in mới phải cách thời điểm hiện tại ít nhất 5 tiếng để cơ sở kịp chuẩn bị kho (sớm nhất có thể chọn: ${earliestAllowedFormatted}).`)
      return
    }

    const finalReason = customReason.trim() || selectedReason || 'Khách hàng điều chỉnh lịch hẹn nhận kho'
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const res = await bookingService.rescheduleBookingDetailed(booking.id, {
        newStartDate: newDate,
        newExpectedCheckInAt: `${newDate}T${newTime || '09:00'}:00`,
        newCheckInTime: newTime || '09:00',
        reason: finalReason,
      })
      setSuccessResult(res)
      onSuccess(res.booking)
    } catch (err: any) {
      console.error('Reschedule booking error:', err)
      const msg = err?.response?.data?.message || err?.message || 'Đổi lịch hẹn nhận kho thất bại. Vui lòng kiểm tra lại thời gian hoặc liên hệ hỗ trợ.'
      setSubmitError(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] my-auto">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-50 via-white to-cyan-50 dark:from-slate-900 dark:via-slate-850 dark:to-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <span className="material-symbols-outlined text-2xl">edit_calendar</span>
            </div>
            <div>
              <h3 className="font-bold text-base tracking-wide flex items-center gap-2">
                <span>Đổi Lịch Hẹn Check-in Nhận Kho</span>
                <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Boxora Policy
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Đơn #{booking.bookingCode} · {booking.unitCode ? `Kho #${booking.unitCode}` : 'Vị trí kho xác nhận khi check-in'} · {booking.facilityName || 'Hệ thống Boxora'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-slate-700 flex-1">
          {loadingEligibility ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-xs font-medium text-slate-500">Đang đối soát điều kiện dời lịch hẹn...</p>
            </div>
          ) : eligibilityError ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold">
                <span className="material-symbols-outlined text-base">error</span>
                <span>Không thể tải dữ liệu điều kiện đổi lịch</span>
              </div>
              <p>{eligibilityError}</p>
              <button
                type="button"
                onClick={onClose}
                className="mt-2 px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded-lg font-semibold"
              >
                Đóng
              </button>
            </div>
          ) : successResult ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
                <span className="material-symbols-outlined text-4xl">check_circle</span>
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-lg text-slate-900">Đổi Lịch Hẹn Thành Công!</h4>
                <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                  {successResult.message}
                </p>
              </div>

              {/* Updated schedule recap */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl max-w-md mx-auto text-left space-y-2 text-xs">
                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">Lịch hẹn check-in mới:</span>
                  <span className="font-bold text-blue-700">
                    {formatDateTime(successResult.booking.expectedCheckInAt)}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">Kỳ hạn thuê dự kiến:</span>
                  <span className="font-semibold text-slate-800">
                    {formatDate(successResult.booking.startDate)} → {formatDate(successResult.booking.endDate)} ({successResult.booking.rentalMonths} tháng)
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Hạn bảo lưu giữ chỗ:</span>
                  <span className="font-semibold text-amber-700">
                    {formatDateTime(successResult.booking.holdExpiresAt)}
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full max-w-md mx-auto py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer shadow-md"
                >
                  Hoàn Tất &amp; Đóng
                </button>
              </div>
            </div>
          ) : eligibility && !eligibility.eligible ? (
            /* Ineligible screen */
            <div className="p-5 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-3">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                <span className="material-symbols-outlined text-amber-600">block</span>
                <span>Đơn đặt kho hiện không đủ điều kiện đổi lịch hẹn</span>
              </div>
              <p className="text-amber-800 leading-relaxed font-medium">
                {eligibility.reasonIfNotEligible || 'Trạng thái đơn hàng không cho phép dời lịch hẹn nhận kho.'}
              </p>
              <div className="p-3 bg-white/70 rounded-lg border border-amber-200 text-slate-600 space-y-1">
                <p className="font-semibold text-slate-700">Nguyên nhân phổ biến:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Kho đã được nhân viên hoàn tất bàn giao thực tế và kích hoạt mã PIN.</li>
                  <li>Đơn hàng đã quá hạn giữ chỗ hoặc đã được hủy bỏ.</li>
                  <li>Đang trong quy trình bàn giao thực địa.</li>
                </ul>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs cursor-pointer transition-colors"
              >
                Đã Hiểu &amp; Quay Lại
              </button>
            </div>
          ) : eligibility ? (
            /* Eligible: Interactive form */
            <form onSubmit={handleConfirmSubmit} className="space-y-5">
              
              {/* Side-by-side comparison (Before vs After) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                
                {/* Current appointment */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-slate-400 text-base">calendar_today</span>
                      <span>Lịch hẹn hiện tại</span>
                    </span>
                    <span className="text-[10px] px-2 py-0.5 bg-slate-200 text-slate-700 rounded-md font-semibold">
                      Đang áp dụng
                    </span>
                  </div>
                  <div className="space-y-1 pt-1">
                    <p className="text-sm font-bold text-slate-900">
                      {formatDateTime(eligibility.currentAppointmentAt)}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Kỳ hạn dự kiến: <span className="font-medium text-slate-700">{formatDate(eligibility.expectedStartDate)} → {formatDate(eligibility.expectedEndDate)}</span>
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Hạn giữ chỗ: <span className="font-medium text-amber-700">{formatDateTime(eligibility.holdExpiresAt)}</span>
                    </p>
                  </div>
                </div>

                {/* Proposed new appointment */}
                <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-blue-900 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-blue-600 text-base">event_upcoming</span>
                      <span>Lịch hẹn mới đề xuất</span>
                    </span>
                    <span className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md font-semibold">
                      Dự kiến
                    </span>
                  </div>
                  <div className="space-y-1 pt-1">
                    <p className="text-sm font-bold text-blue-700">
                      {newTime} · {newDate ? formatDate(newDate) : 'Chưa chọn ngày'}
                    </p>
                    <p className="text-[11px] text-blue-800/80">
                      Kỳ hạn dự kiến: <span className="font-medium text-blue-900">{formatDate(newDate)} → {calculateProposedEndDate(newDate, eligibility.rentalMonths)}</span>
                    </p>
                    <p className="text-[11px] text-blue-800/80">
                      Hạn giữ chỗ: <span className="font-medium text-amber-700">+24h sau lịch hẹn</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Form Inputs: Date & Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                    <span>Ngày hẹn nhận kho mới</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    min={effectiveMinDate}
                    max={eligibility.allowedMaxDate}
                    required
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                  <p className="text-[10px] text-slate-500">
                    Khoảng cho phép: {formatDate(effectiveMinDate)} đến {formatDate(eligibility.allowedMaxDate)}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                    <span>Giờ hẹn check-in</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className={`w-full h-10 px-3 bg-white border rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 ${
                      isTimeTooSoon
                        ? 'border-amber-400 focus:ring-amber-500/20 focus:border-amber-500'
                        : 'border-slate-300 focus:ring-blue-500/20 focus:border-blue-600'
                    }`}
                  />
                  <p className="text-[10px] text-slate-500 flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs text-blue-600">schedule</span>
                    <span>Kho mở 24/7 · Tối thiểu trước 5 tiếng</span>
                  </p>
                </div>
              </div>

              {/* 5-hour warning banner */}
              {isTimeTooSoon && (
                <div className="p-3 bg-amber-50/90 border border-amber-300 rounded-xl text-amber-900 text-xs flex items-start gap-2.5 animate-in fade-in">
                  <span className="material-symbols-outlined text-base text-amber-600 shrink-0 mt-0.5">warning</span>
                  <div className="space-y-0.5">
                    <p className="font-bold text-amber-900">Giờ hẹn check-in phải trước thời điểm hiện tại ít nhất 5 tiếng</p>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      Để cơ sở Boxora kịp kiểm tra niêm phong kho và thiết lập quyền truy cập cho quý khách, vui lòng chọn giờ hẹn từ <strong>{earliestAllowedFormatted}</strong> trở đi.
                    </p>
                  </div>
                </div>
              )}

              {/* Reason Selector */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Lý do điều chỉnh lịch hẹn
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {REASON_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setSelectedReason(preset)
                        if (preset !== 'Lý do khác') setCustomReason('')
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                        selectedReason === preset
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                <textarea
                  rows={2}
                  placeholder="Ghi chú chi tiết thêm lý do dời lịch (tùy chọn)..."
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>

              {/* Boxora Transparency Guarantees Card */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 text-[11px]">
                <div className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                  <span className="material-symbols-outlined text-blue-600 text-base">verified</span>
                  <span>Cam kết minh bạch tài chính &amp; hợp đồng Boxora</span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600">
                  <div className="flex items-start gap-1.5">
                    <span className="material-symbols-outlined text-emerald-600 text-sm shrink-0 mt-0.5">check_circle</span>
                    <span>
                      <strong>Không phát sinh phụ phí:</strong> Giá thuê ({formatCurrency(eligibility.monthlyFee)}/tháng) và tiền cọc ({formatCurrency(eligibility.depositAmount)}) được giữ nguyên tuyệt đối.
                    </span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="material-symbols-outlined text-emerald-600 text-sm shrink-0 mt-0.5">check_circle</span>
                    <span>
                      <strong>Thời hạn hợp đồng:</strong> Kỳ hạn thuê giữ nguyên {eligibility.rentalMonths} tháng, ngày hiệu lực chính thức xác lập tại thời điểm bàn giao thực tế tại cơ sở.
                    </span>
                  </div>
                </div>

                {eligibility.contractSigned && (
                  <div className="p-2 bg-blue-100/60 rounded-lg text-blue-900 border border-blue-200/80 flex items-start gap-2">
                    <span className="material-symbols-outlined text-blue-700 text-sm shrink-0 mt-0.5">description</span>
                    <span>
                      Hợp đồng đã ký điện tử ({eligibility.contractStatus}) được bảo lưu trọn vẹn giá trị pháp lý và chữ ký số. Ngày bắt đầu tính phí sẽ kích hoạt khi nhân viên hoàn tất đối soát CCCD và bàn giao kho.
                    </span>
                  </div>
                )}
              </div>

              {/* Submit Error */}
              {submitError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium flex items-center gap-2">
                  <span className="material-symbols-outlined text-base shrink-0">error</span>
                  <span>{submitError}</span>
                </div>
              )}

              {/* Footer action buttons */}
              <div className="pt-2 flex items-center gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newDate || !newTime || isTimeTooSoon}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                      <span>Đang lưu lịch hẹn...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-base">check</span>
                      <span>Xác Nhận Đổi Lịch Hẹn</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          ) : null}
        </div>
      </div>
    </div>
  )
}
