import React, { useState, useEffect } from 'react'
import { Booking, BookingCancelResponse } from '../../types'
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

  useEffect(() => {
    if (!isOpen || !booking) {
      setSelectedReason('')
      setCustomReason('')
      setSubmitError(null)
      setSuccessResult(null)
      setIsSubmitting(false)
    }
  }, [isOpen, booking])

  if (!isOpen || !booking) return null

  const handleConfirmCancel = async () => {
    const finalReason = customReason.trim() || selectedReason || 'Khách hàng yêu cầu hủy đơn'
    setIsSubmitting(true)
    setSubmitError(null)

    // Handle local guest reservations
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
      const res = await bookingService.cancelBooking(booking.id, finalReason)
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

  const expectedDate = (booking as any).checkInDate || booking.expectedCheckInAt || booking.startDate

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-100 dark:border-rose-900 shrink-0">
              <span className="material-symbols-outlined text-[22px]">event_busy</span>
            </div>
            <div>
              <h3 className="font-headline text-base font-bold text-slate-900 dark:text-white">
                Hủy Đơn Đặt Giữ Chỗ Kho
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
            /* Success Screen */
            <div className="py-6 text-center space-y-4 animate-in fade-in zoom-in-95">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-xs">
                <span className="material-symbols-outlined text-[36px]">check_circle</span>
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white">Đã Hủy Đơn Đặt Giữ Chỗ Thành Công</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
                  {successResult.message || `Đơn đặt chỗ #${booking.bookingCode} đã được hủy theo yêu cầu. Vị trí giữ chỗ đã được giải phóng trên hệ thống.`}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-left space-y-2.5 max-w-md mx-auto text-xs">
                <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-700">
                  <span className="text-slate-500 dark:text-slate-400">Mã đơn:</span>
                  <strong className="font-mono text-slate-900 dark:text-white">#{successResult.bookingCode || booking.bookingCode}</strong>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-700">
                  <span className="text-slate-500 dark:text-slate-400">Trạng thái mới:</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300">
                    ĐÃ HỦY
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-700">
                  <span className="text-slate-500 dark:text-slate-400">Giải phóng ngăn kho:</span>
                  <strong className="text-emerald-700 dark:text-emerald-400 font-semibold">✓ Đã chuyển về trống (Sẵn sàng)</strong>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-700">
                  <span className="text-slate-500 dark:text-slate-400">Chi phí phát sinh / Phí phạt:</span>
                  <strong className="font-mono font-bold text-slate-800 dark:text-slate-200">0 ₫ (Miễn phí)</strong>
                </div>
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
                  className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-sm"
                >
                  Hoàn Tất &amp; Đóng
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Notice Box: No Deposit / No Refund on Reservation Cancellation */}
              <div className="p-4 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-blue-950 dark:text-blue-200 space-y-2">
                <div className="flex items-center gap-2 font-bold text-xs text-blue-900 dark:text-blue-300">
                  <span className="material-symbols-outlined text-[18px] text-blue-600 dark:text-blue-400">info</span>
                  <span>Đặt Giữ Chỗ Miễn Phí &amp; Không Có Hoàn Cọc</span>
                </div>
                <p className="text-xs leading-relaxed text-blue-900/90 dark:text-blue-300/90">
                  Đơn đặt giữ chỗ của quý khách là dịch vụ đặt trước trực tuyến hoàn toàn <strong>miễn phí</strong> (chưa phát sinh giao dịch thanh toán nào). Khi quý khách xác nhận hủy:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-[11px] text-blue-900/80 dark:text-blue-300/80">
                  <li><strong>Không có hoàn cọc</strong> vì quý khách chưa thanh toán tiền cọc khi tạo đơn đặt chỗ.</li>
                  <li><strong>Không phát sinh bất kỳ khoản phí phạt</strong> nào.</li>
                  <li>Vị trí ngăn kho giữ chỗ sẽ được giải phóng ngay lập tức cho khách hàng khác trên hệ thống.</li>
                </ul>
                <div className="pt-1.5 text-[11px] text-blue-800/80 dark:text-blue-400/80 italic border-t border-blue-200/60 dark:border-blue-800/60">
                  * Tiền cọc và tiền thuê chỉ thanh toán trực tiếp tại quầy khi quý khách đến check-in và ký hợp đồng cùng nhân viên.
                </div>
              </div>

              {/* Booking Summary Box */}
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
                  <span className="text-slate-500 dark:text-slate-400">Vị trí kho dự kiến:</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {booking.unitCode ? `Kho #${booking.unitCode}` : 'Vị trí xác nhận khi nhận kho'}
                  </span>
                </div>
                {expectedDate && (
                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-slate-500 dark:text-slate-400">Lịch hẹn check-in:</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {String(expectedDate).split('T')[0]}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center py-1 border-t border-slate-200/60 dark:border-slate-700">
                  <span className="text-slate-500 dark:text-slate-400">Tình trạng thanh toán:</span>
                  <span className="font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800 text-[11px]">
                    Chưa thanh toán (Thanh toán tại quầy khi check-in)
                  </span>
                </div>
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-500 dark:text-slate-400">Phí hủy đơn:</span>
                  <strong className="text-emerald-700 dark:text-emerald-400 font-bold text-xs">0 ₫ (Miễn phí)</strong>
                </div>
              </div>

              {/* Warning Notice */}
              <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-300 text-[11px] flex items-start gap-2">
                <span className="material-symbols-outlined text-[16px] text-amber-700 dark:text-amber-400 shrink-0 mt-0.5">warning</span>
                <p className="leading-relaxed">
                  Khi xác nhận hủy, vị trí giữ chỗ sẽ được mở lại ngay lập tức trên hệ thống cho khách hàng khác có nhu cầu thuê.
                </p>
              </div>

              {/* Cancellation Reason Section */}
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
              disabled={isSubmitting}
              onClick={handleConfirmCancel}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer disabled:bg-slate-300"
            >
              {isSubmitting ? (
                <>
                  <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                  <span>Đang xử lý hủy...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">cancel</span>
                  <span>Xác Nhận Hủy Đặt Chỗ</span>
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
