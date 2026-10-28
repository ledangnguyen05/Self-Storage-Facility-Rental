import React, { useState, useEffect } from 'react'
import { Booking, BookingCancelResponse, BookingCancellationPreview } from '../../types'
import { bookingService } from '../../services/bookingService'

interface BookingCancelModalProps {
  isOpen: boolean
  booking: Booking | null
  onClose: () => void
  onSuccess: (result: BookingCancelResponse) => void
}

const REASON_PRESETS = [
  'Thay đổi kế hoạch lưu trữ đồ đạc',
  'Tìm được cơ sở khác gần hơn',
  'Cần đổi sang kích thước ngăn kho khác',
  'Lịch công tác / chuyển nhà thay đổi',
  'Thời gian nhận kho chưa phù hợp',
  'Lý do cá nhân khác',
]

const POPULAR_BANKS = [
  { code: 'VCB', name: 'Vietcombank (Ngoại Thương Việt Nam)' },
  { code: 'MB', name: 'MB Bank (Quân Đội)' },
  { code: 'TCB', name: 'Techcombank (Kỹ Thương Việt Nam)' },
  { code: 'CTG', name: 'VietinBank (Công Thương Việt Nam)' },
  { code: 'BIDV', name: 'BIDV (Đầu Tư và Phát Triển)' },
  { code: 'ACB', name: 'ACB (Á Châu)' },
  { code: 'VPB', name: 'VPBank (Việt Nam Thịnh Vượng)' },
  { code: 'TPB', name: 'TPBank (Tiên Phong)' },
  { code: 'STB', name: 'Sacombank (Sài Gòn Thương Tín)' },
  { code: 'VIB', name: 'VIB (Quốc Tế)' },
  { code: 'VBA', name: 'Agribank (Nông Nghiệp & PTNT)' },
  { code: 'HDB', name: 'HDBank (Phát Triển TP.HCM)' },
  { code: 'SHB', name: 'SHB (Sài Gòn - Hà Nội)' },
  { code: 'OCB', name: 'OCB (Phương Đông)' },
  { code: 'MSB', name: 'MSB (Hàng Hải)' },
  { code: 'OTHER', name: 'Ngân hàng khác (tự nhập)' },
]

export const BookingCancelModal: React.FC<BookingCancelModalProps> = ({
  isOpen,
  booking,
  onClose,
  onSuccess,
}) => {
  const [selectedReason, setSelectedReason] = useState('')
  const [customReason, setCustomReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [successResult, setSuccessResult] = useState<BookingCancelResponse | null>(null)
  const [preview, setPreview] = useState<BookingCancellationPreview | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)

  // Thông tin tài khoản ngân hàng hoàn tiền (Dành riêng cho Phương thức 1: Thanh toán trực tuyến)
  const [bankCode, setBankCode] = useState('VCB')
  const [customBankName, setCustomBankName] = useState('')
  const [bankAccountNumber, setBankAccountNumber] = useState('')
  const [bankAccountName, setBankAccountName] = useState('')
  const [contactEmail, setContactEmail] = useState('')

  // Xác định đơn hàng là Phương thức 1 (Thanh toán online qua VNPay, có cọc/tiền thuê cần hoàn) hay Phương thức 2 (Trả sau tại cơ sở, 0đ)
  const depositPaid = Number(preview?.depositPaid ?? booking?.depositPaid ?? 0)
  const isOnlinePaidBooking = Boolean(
    booking &&
    depositPaid > 0 &&
    booking.signingMethod !== 'IN_PERSON' &&
    booking.paymentStatus !== 'UNPAID' &&
    (booking.status || '').toUpperCase() !== 'PENDING_CONTACT' &&
    (booking.status || '').toUpperCase() !== 'PENDING_PAYMENT' &&
    (booking.status || '').toUpperCase() !== 'PENDING_SIGNATURE' &&
    preview?.milestoneStage !== 'STAGE_PENDING_NO_PAYMENT' &&
    (
      booking.paymentStatus === 'PAID' ||
      (booking.status || '').toUpperCase() === 'PAID_CONFIRMED' ||
      (booking.status || '').toUpperCase() === 'PAID_AND_SIGNED' ||
      (booking.status || '').toUpperCase() === 'PAID_PENDING_ASSIGNMENT' ||
      (booking.status || '').toUpperCase() === 'AWAITING_CHECKIN' ||
      (booking.status || '').toUpperCase() === 'CONFIRMED' ||
      preview?.milestoneStage === 'STAGE_1_FULL_REFUND' ||
      preview?.milestoneStage === 'STAGE_2_PARTIAL_REFUND' ||
      preview?.milestoneStage === 'STAGE_3_OVER_48H_REFUND'
    )
  )

  useEffect(() => {
    if (!isOpen || !booking) {
      setSelectedReason('')
      setCustomReason('')
      setSubmitError(null)
      setSuccessResult(null)
      setPreview(null)
      setLoadingPreview(false)
      setIsSubmitting(false)
      setBankCode('VCB')
      setCustomBankName('')
      setBankAccountNumber('')
      setBankAccountName('')
      return
    }

    // Reset state for new modal opening
    setSelectedReason('')
    setCustomReason('')
    setSubmitError(null)
    setSuccessResult(null)
    setBankCode('VCB')
    setCustomBankName('')
    setBankAccountNumber('')
    setBankAccountName(booking.customerName ? booking.customerName.toUpperCase() : '')
    setContactEmail(booking.customerEmail || '')

    // CHỈ gọi API tính toán hoàn tiền nếu là đơn đã thanh toán online cọc (Phương thức 1)
    const hasOnlineDeposit =
      Number(booking.depositPaid || 0) > 0 &&
      booking.signingMethod !== 'IN_PERSON' &&
      booking.paymentStatus !== 'UNPAID' &&
      (booking.status || '').toUpperCase() !== 'PENDING_CONTACT' &&
      (booking.status || '').toUpperCase() !== 'PENDING_PAYMENT' &&
      (booking.status || '').toUpperCase() !== 'PENDING_SIGNATURE'
    if (hasOnlineDeposit && booking.id && !booking.id.startsWith('LOCAL-RES-')) {
      setLoadingPreview(true)
      bookingService
        .getCancellationPreview(booking.id)
        .then((res) => {
          setPreview(res)
        })
        .catch((err) => {
          console.warn('Failed to load cancellation preview:', err)
          setPreview(null)
        })
        .finally(() => {
          setLoadingPreview(false)
        })
    } else {
      setPreview(null)
      setLoadingPreview(false)
    }
  }, [isOpen, booking])

  if (!isOpen || !booking) return null

  const depositAmount = preview?.depositPaid ?? booking.depositPaid ?? 0
  const rentalFee = preview?.totalRentalFee ?? booking.totalRentalFee ?? 0
  const totalPaidOnline = Number(rentalFee) + Number(depositAmount)

  // Tính toán minh bạch chi tiết tiền thuê & tiền cọc
  const depositRefundPercent = preview?.refundPercentage ?? 100
  const depositRefundAmount = Math.round(Number(depositAmount) * (depositRefundPercent / 100))
  const depositPenaltyAmount = Math.max(0, Number(depositAmount) - depositRefundAmount)
  const rentRefundAmount = Number(rentalFee) // Hoàn 100% tiền thuê do khách chưa nhận kho
  const totalRefundAmount = preview?.refundAmount !== undefined && preview.refundAmount >= (rentRefundAmount + depositRefundAmount)
    ? preview.refundAmount
    : (rentRefundAmount + depositRefundAmount)
  const penaltyAmount = preview?.penaltyAmount ?? depositPenaltyAmount
  const expectedDate = (booking as any).checkInDate || booking.expectedCheckInAt || booking.startDate

  const resolvedBankName = bankCode === 'OTHER'
    ? customBankName.trim()
    : (POPULAR_BANKS.find(b => b.code === bankCode)?.name || bankCode)

  const handleConfirmCancel = async () => {
    const finalReason = customReason.trim() || selectedReason || 'Khách hàng yêu cầu hủy đơn'
    
    // Nếu là đơn đã thanh toán online cọc (Phương thức 1), kiểm tra thông tin tài khoản ngân hàng hoàn tiền
    if (isOnlinePaidBooking) {
      if (!resolvedBankName) {
        setSubmitError('Vui lòng chọn hoặc nhập tên ngân hàng thụ hưởng.')
        return
      }
      if (!bankAccountNumber.trim()) {
        setSubmitError('Vui lòng nhập số tài khoản ngân hàng nhận tiền hoàn.')
        return
      }
      if (!bankAccountName.trim()) {
        setSubmitError('Vui lòng nhập tên chủ tài khoản ngân hàng.')
        return
      }
    }

    setIsSubmitting(true)
    setSubmitError(null)

    // Xử lý đơn lưu tạm local của khách vãng lai
    if (booking.id?.startsWith('LOCAL-RES-')) {
      try {
        const raw = localStorage.getItem('boxora_guest_reservations')
        if (raw) {
          const list = JSON.parse(raw)
          const remaining = list.filter((r: any) => r.bookingCode !== booking.bookingCode)
          localStorage.setItem('boxora_guest_reservations', JSON.stringify(remaining))
        }
      } catch (e) {
        console.warn('Error clearing local reservation:', e)
      }
      const localResult: BookingCancelResponse = {
        bookingId: booking.id,
        bookingCode: booking.bookingCode,
        status: 'CANCELLED',
        milestoneStage: 'STAGE_PENDING_NO_PAYMENT',
        refundPercentage: 0,
        refundAmount: 0,
        penaltyAmount: 0,
        unitReleased: true,
        cancelledAt: new Date().toISOString(),
        cancellationReason: finalReason,
        message: 'Đã hủy đơn đặt giữ chỗ thành công.',
      }
      setSuccessResult(localResult)
      onSuccess(localResult)
      setIsSubmitting(false)
      return
    }

    try {
      const payload = isOnlinePaidBooking
        ? {
            cancellationReason: finalReason,
            bankName: resolvedBankName,
            bankAccountNumber: bankAccountNumber.trim(),
            bankAccountName: bankAccountName.trim().toUpperCase(),
            customerEmail: contactEmail.trim() || booking.customerEmail || undefined,
          }
        : {
            cancellationReason: finalReason,
            customerEmail: contactEmail.trim() || booking.customerEmail || undefined,
          }

      const res = await bookingService.cancelBooking(booking.id, payload)
      setSuccessResult(res)
      onSuccess(res)
    } catch (err: any) {
      console.error('Cancel booking error:', err)
      const msg = err?.response?.data?.message || err?.message || 'Hủy đơn đặt kho thất bại. Vui lòng thử lại sau.'
      setSubmitError(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${
              isOnlinePaidBooking
                ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900'
                : 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900'
            }`}>
              <span className="material-symbols-outlined text-[22px]">
                {isOnlinePaidBooking ? 'currency_exchange' : 'event_busy'}
              </span>
            </div>
            <div>
              <h3 className="font-headline text-base font-bold text-slate-900 dark:text-white">
                {isOnlinePaidBooking ? 'Yêu Cầu Hủy Đơn & Hoàn Tiền Cọc' : 'Hủy Đơn Đặt Giữ Chỗ Kho'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                Mã đơn: #{booking.bookingCode} · {booking.facilityName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-700 dark:text-slate-300 flex-1">
          {successResult ? (
            /* ========================================================= */
            /* MÀN HÌNH THÔNG BÁO KẾT QUẢ SAU KHI HỦY / GỬI YÊU CẦU HOÀN TIỀN */
            /* ========================================================= */
            <div className="py-4 text-center space-y-4 animate-in fade-in zoom-in-95">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto shadow-xs ${
                isOnlinePaidBooking
                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                  : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
              }`}>
                <span className="material-symbols-outlined text-[36px]">
                  {isOnlinePaidBooking ? 'hourglass_top' : 'check_circle'}
                </span>
              </div>

              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white">
                  {isOnlinePaidBooking
                    ? 'Đã Gửi Yêu Cầu Hủy & Hoàn Tiền Thành Công'
                    : 'Đã Hủy Đơn Đặt Giữ Chỗ Thành Công'}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
                  {isOnlinePaidBooking
                    ? `Yêu cầu hủy đơn và hoàn tiền cọc cho mã #${booking.bookingCode} đã được chuyển đến Quản lý cơ sở (${booking.facilityName}) để kiểm tra đối soát và hoàn tiền cọc vào tài khoản của quý khách.`
                    : (successResult.message || `Đơn đặt chỗ #${booking.bookingCode} đã được hủy theo yêu cầu. Vị trí giữ chỗ đã được giải phóng trên hệ thống và không phát sinh bất kỳ khoản phí nào.`)}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-left space-y-2.5 max-w-md mx-auto text-xs">
                <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-700">
                  <span className="text-slate-500 dark:text-slate-400">Mã đơn đặt chỗ:</span>
                  <strong className="font-mono text-slate-900 dark:text-white">#{successResult.bookingCode || booking.bookingCode}</strong>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-700">
                  <span className="text-slate-500 dark:text-slate-400">Trạng thái mới:</span>
                  {isOnlinePaidBooking ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                      <span>HỦY ĐƠN HOÀN TIỀN CHỜ XÁC NHẬN</span>
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300">
                      ĐÃ HỦY
                    </span>
                  )}
                </div>

                {isOnlinePaidBooking && (successResult.refundRequestCode || successResult.refundRequestId) && (
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-700">
                    <span className="text-slate-500 dark:text-slate-400">Mã yêu cầu hoàn cọc:</span>
                    <strong className="font-mono text-blue-600 dark:text-blue-400 font-bold">
                      #{successResult.refundRequestCode || 'REF-PENDING'}
                    </strong>
                  </div>
                )}

                <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-700">
                  <span className="text-slate-500 dark:text-slate-400">Giải phóng buồng kho:</span>
                  <strong className="text-emerald-700 dark:text-emerald-400 font-semibold">✓ Đã chuyển về sẵn sàng</strong>
                </div>

                {isOnlinePaidBooking ? (
                  <>
                    <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-700">
                      <span className="text-slate-500 dark:text-slate-400">Tiền thuê kho hoàn trả:</span>
                      <strong className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {Number(rentRefundAmount).toLocaleString('vi-VN')} ₫ (100% chưa nhận kho)
                      </strong>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-700">
                      <span className="text-slate-500 dark:text-slate-400">Tiền cọc hoàn trả:</span>
                      <strong className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {Number(depositRefundAmount).toLocaleString('vi-VN')} ₫ ({depositRefundPercent}%)
                      </strong>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-700 bg-emerald-50/60 dark:bg-emerald-950/30 px-2 rounded-lg">
                      <span className="text-slate-700 dark:text-slate-200 font-bold">Tổng tiền hoàn trả thực tế:</span>
                      <strong className="font-mono font-black text-sm text-emerald-700 dark:text-emerald-400">
                        {Number(successResult.refundAmount || totalRefundAmount).toLocaleString('vi-VN')} ₫
                      </strong>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-700">
                      <span className="text-slate-500 dark:text-slate-400">Tài khoản nhận tiền:</span>
                      <strong className="text-slate-800 dark:text-slate-200 font-mono text-[11px] text-right">
                        {bankAccountNumber} - {bankAccountName} ({resolvedBankName})
                      </strong>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-700">
                      <span className="text-slate-500 dark:text-slate-400">Đơn vị xử lý:</span>
                      <span className="text-blue-700 dark:text-blue-300 font-bold">
                        Quản lý cơ sở {booking.facilityName}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-700">
                    <span className="text-slate-500 dark:text-slate-400">Chi phí phát sinh:</span>
                    <strong className="text-slate-700 dark:text-slate-300 font-semibold">
                      0 ₫ (Miễn phí)
                    </strong>
                  </div>
                )}

                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500 dark:text-slate-400">Lý do hủy:</span>
                  <span className="text-slate-800 dark:text-slate-200 font-medium truncate max-w-[220px]">
                    {successResult.cancellationReason || 'Khách hàng yêu cầu hủy'}
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-sm"
                >
                  Hoàn Tất &amp; Đóng
                </button>
              </div>
            </div>
          ) : (
            <>
              {loadingPreview ? (
                <div className="p-6 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-center space-y-2">
                  <span className="material-symbols-outlined text-2xl text-blue-600 animate-spin">progress_activity</span>
                  <p className="text-xs text-slate-500">Đang kiểm tra chính sách hoàn tiền cọc...</p>
                </div>
              ) : isOnlinePaidBooking ? (
                /* ============================================================== */
                /* PHƯƠNG THỨC 1: ĐÃ THANH TOÁN ONLINE -> HIỂN THỊ CHÍNH SÁCH 3 MỐC */
                /* ============================================================== */
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 text-indigo-950 dark:text-indigo-200 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-xs text-indigo-900 dark:text-indigo-300">
                        <span className="material-symbols-outlined text-[18px] text-indigo-600 dark:text-indigo-400">verified</span>
                        <span>Chính Sách Hủy Đơn &amp; Hoàn Tiền Cọc</span>
                      </div>
                      {preview?.timeRemainingLabel && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300">
                          {preview.timeRemainingLabel}
                        </span>
                      )}
                    </div>

                    <p className="text-xs leading-relaxed text-indigo-900/90 dark:text-indigo-200/90">
                      Đơn hàng đã thanh toán trực tuyến tiền cọc và tiền thuê qua cổng VNPay. Quy định hoàn tiền theo 3 mốc thời gian:
                    </p>

                    <div className="grid grid-cols-3 gap-1.5 text-[10px] text-center font-medium">
                      <div className={`p-1.5 rounded-lg border ${preview?.milestoneStage === 'STAGE_1_FULL_REFUND' ? 'bg-emerald-100 border-emerald-400 text-emerald-900 font-bold dark:bg-emerald-950 dark:text-emerald-200' : 'bg-white/60 dark:bg-slate-800/50 border-indigo-200/70 dark:border-indigo-900 text-slate-600 dark:text-slate-400'}`}>
                        <div>Mốc 1 (≤ 24h)</div>
                        <div className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">Hoàn 100% cọc</div>
                      </div>
                      <div className={`p-1.5 rounded-lg border ${preview?.milestoneStage === 'STAGE_2_PARTIAL_REFUND' ? 'bg-amber-100 border-amber-400 text-amber-900 font-bold dark:bg-amber-950 dark:text-amber-200' : 'bg-white/60 dark:bg-slate-800/50 border-indigo-200/70 dark:border-indigo-900 text-slate-600 dark:text-slate-400'}`}>
                        <div>Mốc 2 (24h - 48h)</div>
                        <div className="font-bold text-amber-600 dark:text-amber-400 mt-0.5">Hoàn 70% cọc</div>
                      </div>
                      <div className={`p-1.5 rounded-lg border ${preview?.milestoneStage === 'STAGE_3_OVER_48H_REFUND' ? 'bg-rose-100 border-rose-400 text-rose-900 font-bold dark:bg-rose-950 dark:text-rose-200' : 'bg-white/60 dark:bg-slate-800/50 border-indigo-200/70 dark:border-indigo-900 text-slate-600 dark:text-slate-400'}`}>
                        <div>Mốc 3 (&gt; 48h)</div>
                        <div className="font-bold text-rose-600 dark:text-rose-400 mt-0.5">Hoàn 50% cọc</div>
                      </div>
                    </div>

                    {preview?.policyDescription && (
                      <div className="p-2 rounded-lg bg-white/70 dark:bg-slate-900/60 border border-indigo-100 dark:border-indigo-900 text-[11px] text-indigo-950 dark:text-indigo-200 leading-relaxed">
                        <strong>Áp dụng cho đơn này:</strong> {preview.policyDescription}
                      </div>
                    )}
                  </div>

                  {/* THÔNG TIN TÀI KHOẢN NGÂN HÀNG ĐỂ HOÀN TIỀN (BẮT BUỘC) */}
                  <div className="p-4 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-xl space-y-3">
                    <div className="flex items-center gap-2 text-amber-900 dark:text-amber-300 font-bold text-xs">
                      <span className="material-symbols-outlined text-[18px] text-amber-600 dark:text-amber-400">account_balance</span>
                      <span>Thông Tin Tài Khoản Ngân Hàng Nhận Tiền Hoàn</span>
                    </div>
                    <p className="text-[11px] text-amber-800/90 dark:text-amber-300/90 leading-relaxed">
                      Vui lòng điền thông tin tài khoản ngân hàng chính chủ để <strong>Quản lý cơ sở ({booking.facilityName})</strong> kiểm tra đối soát và hoàn tiền cọc cho quý khách:
                    </p>

                    <div className="space-y-2.5">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                          Ngân hàng thụ hưởng <span className="text-rose-500">*</span>:
                        </label>
                        <select
                          value={bankCode}
                          onChange={(e) => setBankCode(e.target.value)}
                          className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                        >
                          {POPULAR_BANKS.map((b) => (
                            <option key={b.code} value={b.code}>
                              {b.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {bankCode === 'OTHER' && (
                        <div>
                          <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                            Tên ngân hàng khác <span className="text-rose-500">*</span>:
                          </label>
                          <input
                            type="text"
                            value={customBankName}
                            onChange={(e) => setCustomBankName(e.target.value)}
                            placeholder="Nhập tên ngân hàng của quý khách..."
                            className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                            Số tài khoản ngân hàng <span className="text-rose-500">*</span>:
                          </label>
                          <input
                            type="text"
                            value={bankAccountNumber}
                            onChange={(e) => setBankAccountNumber(e.target.value.replace(/[^0-9]/g, ''))}
                            placeholder="VD: 1029384756..."
                            className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                            Tên chủ tài khoản <span className="text-rose-500">*</span>:
                          </label>
                          <input
                            type="text"
                            value={bankAccountName}
                            onChange={(e) => setBankAccountName(e.target.value.toUpperCase())}
                            placeholder="VD: NGUYEN VAN A"
                            className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono uppercase text-slate-800 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                          Email nhận thư xác nhận hoàn tiền:
                        </label>
                        <input
                          type="email"
                          value={contactEmail}
                          onChange={(e) => setContactEmail(e.target.value)}
                          placeholder="Nhập email của quý khách (VD: email@gmail.com)..."
                          className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                        />
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Quản lý cơ sở sẽ gửi email ủy nhiệm chi kèm ảnh biên lai đến hòm thư này.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* TÓM TẮT ĐƠN ĐẶT CHỖ */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2 text-xs">
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-500 dark:text-slate-400">Mã đơn đặt chỗ:</span>
                  <strong className="font-mono text-slate-900 dark:text-white">#{booking.bookingCode}</strong>
                </div>
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-500 dark:text-slate-400">Cơ sở lưu trữ:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{booking.facilityName}</span>
                </div>
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-500 dark:text-slate-400">Vị trí buồng kho:</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {booking.unitCode ? `Kho #${booking.unitCode}` : (booking.unitTypeName || 'Vị trí chọn khi nhận kho tại quầy')}
                  </span>
                </div>
                {expectedDate && (
                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-slate-500 dark:text-slate-400">Lịch hẹn nhận kho:</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {String(expectedDate).split('T')[0]}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center py-1 border-t border-slate-200/60 dark:border-slate-700">
                  <span className="text-slate-500 dark:text-slate-400">Hình thức đặt giữ chỗ:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {isOnlinePaidBooking
                      ? '1. Ký HĐ & Thanh toán trực tuyến'
                      : '2. Ký HĐ & Thanh toán tại cơ sở (0 ₫ hôm nay)'}
                  </span>
                </div>

                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-500 dark:text-slate-400">Tình trạng thanh toán:</span>
                  {isOnlinePaidBooking ? (
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 text-[11px]">
                      ✓ Đã thanh toán trực tuyến qua VNPay
                    </span>
                  ) : (
                    <span className="font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800 text-[11px]">
                      Chưa thanh toán (0 ₫ hôm nay)
                    </span>
                  )}
                </div>

                {isOnlinePaidBooking && (
                  <>
                    <div className="flex justify-between items-center py-0.5">
                      <span className="text-slate-500 dark:text-slate-400">Tiền thuê kho đã thanh toán:</span>
                      <strong className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs">
                        {Number(rentalFee).toLocaleString('vi-VN')} ₫
                        {booking.rentalMonths ? ` (${booking.rentalMonths} tháng)` : ''}
                      </strong>
                    </div>

                    <div className="flex justify-between items-center py-0.5">
                      <span className="text-slate-500 dark:text-slate-400">Tiền cọc bảo đảm đã thanh toán:</span>
                      <strong className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs">
                        {Number(depositAmount).toLocaleString('vi-VN')} ₫
                      </strong>
                    </div>

                    <div className="flex justify-between items-center py-1 border-t border-slate-200/60 dark:border-slate-700">
                      <span className="text-slate-600 dark:text-slate-300 font-semibold">Tổng chi phí đã thanh toán:</span>
                      <strong className="font-mono font-black text-xs text-slate-900 dark:text-white">
                        {Number(totalPaidOnline).toLocaleString('vi-VN')} ₫
                      </strong>
                    </div>

                    <div className="pt-2 mt-1 border-t border-dashed border-slate-200 dark:border-slate-700 space-y-1.5 bg-emerald-50/50 dark:bg-emerald-950/20 p-2.5 rounded-xl border border-emerald-100 dark:border-emerald-900/50">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                        Chi tiết hoàn tiền theo chính sách
                      </div>

                      <div className="flex justify-between items-center py-0.5 text-[11px]">
                        <span className="text-slate-600 dark:text-slate-400">• Hoàn tiền thuê kho (100% chưa nhận kho):</span>
                        <strong className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                          +{Number(rentRefundAmount).toLocaleString('vi-VN')} ₫
                        </strong>
                      </div>

                      <div className="flex justify-between items-center py-0.5 text-[11px]">
                        <span className="text-slate-600 dark:text-slate-400">• Hoàn tiền cọc ({depositRefundPercent}%):</span>
                        <strong className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                          +{Number(depositRefundAmount).toLocaleString('vi-VN')} ₫
                        </strong>
                      </div>

                      {depositPenaltyAmount > 0 && (
                        <div className="flex justify-between items-center py-0.5 text-[11px]">
                          <span className="text-rose-600 dark:text-rose-400">• Khấu trừ phí giữ chỗ ({100 - depositRefundPercent}% cọc):</span>
                          <strong className="font-mono font-bold text-rose-600 dark:text-rose-400">
                            -{Number(depositPenaltyAmount).toLocaleString('vi-VN')} ₫
                          </strong>
                        </div>
                      )}

                      <div className="flex justify-between items-center pt-1 border-t border-emerald-200/70 dark:border-emerald-800">
                        <span className="font-bold text-emerald-900 dark:text-emerald-200 text-xs">Tổng tiền hoàn trả dự kiến:</span>
                        <strong className="font-mono font-black text-sm text-emerald-700 dark:text-emerald-400">
                          {Number(totalRefundAmount).toLocaleString('vi-VN')} ₫
                        </strong>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* LƯU Ý / CẢNH BÁO */}
              {isOnlinePaidBooking ? (
                <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 text-blue-900 dark:text-blue-300 text-[11px] flex items-start gap-2">
                  <span className="material-symbols-outlined text-[16px] text-blue-700 dark:text-blue-400 shrink-0 mt-0.5">info</span>
                  <p className="leading-relaxed">
                    Yêu cầu hủy đơn và hoàn tiền sẽ được gửi trực tiếp đến <strong>Quản lý cơ sở ({booking.facilityName})</strong>. Quản lý sẽ kiểm tra đối soát và chuyển trạng thái đơn sang <strong>Hủy đơn hoàn tiền chờ xác nhận</strong> để hoàn tất chuyển khoản <strong>{Number(totalRefundAmount).toLocaleString('vi-VN')} ₫</strong> (bao gồm tiền thuê kho và tiền cọc hoàn trả) cho quý khách.
                  </p>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-300 text-[11px] flex items-start gap-2">
                  <span className="material-symbols-outlined text-[16px] text-amber-700 dark:text-amber-400 shrink-0 mt-0.5">warning</span>
                  <p className="leading-relaxed">
                    Khi xác nhận hủy, vị trí giữ chỗ sẽ được mở lại ngay lập tức trên hệ thống cho khách hàng khác có nhu cầu thuê. Đơn của quý khách chưa phát sinh thanh toán nên không có phí phạt hay hoàn cọc.
                  </p>
                </div>
              )}

              {/* Lý do hủy đặt giữ chỗ */}
              <div className="space-y-2 pt-1">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block">
                  Lý do hủy đặt giữ chỗ:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {REASON_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setSelectedReason(preset)
                        setCustomReason('')
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer ${
                        selectedReason === preset
                          ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300 font-bold'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                <textarea
                  rows={2}
                  value={customReason}
                  onChange={(e) => {
                    setCustomReason(e.target.value)
                    if (e.target.value) setSelectedReason('')
                  }}
                  placeholder="Hoặc nhập chi tiết lý do hủy (tùy chọn)..."
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-rose-400 focus:bg-white dark:focus:bg-slate-900 transition-all resize-none"
                />
              </div>

              {submitError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl text-xs flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  <span>{submitError}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        {!successResult && (
          <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl text-xs border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer disabled:opacity-50"
            >
              Giữ Lại Đơn
            </button>
            <button
              type="button"
              disabled={isSubmitting || (isOnlinePaidBooking && (!bankAccountNumber.trim() || !bankAccountName.trim() || !resolvedBankName))}
              onClick={handleConfirmCancel}
              className={`px-5 py-2.5 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                isOnlinePaidBooking
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              {isSubmitting ? (
                <>
                  <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                  <span>{isOnlinePaidBooking ? 'Đang gửi yêu cầu hoàn tiền...' : 'Đang xử lý hủy...'}</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">
                    {isOnlinePaidBooking ? 'send' : 'cancel'}
                  </span>
                  <span>
                    {isOnlinePaidBooking ? 'Gửi Yêu Cầu Hủy & Hoàn Tiền' : 'Xác Nhận Hủy Đặt Chỗ'}
                  </span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default BookingCancelModal
