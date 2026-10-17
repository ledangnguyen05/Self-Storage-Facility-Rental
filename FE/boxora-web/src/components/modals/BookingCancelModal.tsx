import React, { useState, useEffect } from 'react'
import { Booking, BookingCancellationPreview, BookingCancelResponse } from '../../types'
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
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [preview, setPreview] = useState<BookingCancellationPreview | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const [selectedReason, setSelectedReason] = useState('')
  const [customReason, setCustomReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [successResult, setSuccessResult] = useState<BookingCancelResponse | null>(null)

  useEffect(() => {
    if (!isOpen || !booking) {
      setPreview(null)
      setPreviewError(null)
      setSelectedReason('')
      setCustomReason('')
      setSubmitError(null)
      setSuccessResult(null)
      setIsSubmitting(false)
      return
    }

    let isMounted = true
    const loadPreview = async () => {
      setLoadingPreview(true)
      setPreviewError(null)
      try {
        const res = await bookingService.getCancellationPreview(booking.id)
        if (isMounted) {
          setPreview(res)
        }
      } catch (err: any) {
        if (isMounted) {
          console.warn('Load cancellation preview error:', err)
          const msg = err?.response?.data?.message || err?.message || 'Không thể tính toán thông tin hoàn tiền hủy đơn.'
          setPreviewError(msg)
        }
      } finally {
        if (isMounted) {
          setLoadingPreview(false)
        }
      }
    }

    void loadPreview()
    return () => {
      isMounted = false
    }
  }, [isOpen, booking])

  if (!isOpen || !booking) return null

  const handleConfirmCancel = async () => {
    const finalReason = customReason.trim() || selectedReason || 'Khách hàng yêu cầu hủy đơn'
    setIsSubmitting(true)
    setSubmitError(null)
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

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100 shrink-0">
              <span className="material-symbols-outlined text-[22px]">event_busy</span>
            </div>
            <div>
              <h3 className="font-headline text-base font-bold text-slate-900">
                Hủy Đơn Đặt Giữ Chỗ Kho
              </h3>
              <p className="text-[11px] text-slate-500 font-mono">
                Mã đơn: #{booking.bookingCode} · Kho #{booking.unitCode} ({booking.facilityName})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-700 flex-1">
          {successResult ? (
            /* Success Screen */
            <div className="py-6 text-center space-y-4 animate-in fade-in zoom-in-95">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
                <span className="material-symbols-outlined text-[36px]">check_circle</span>
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900">Đã Hủy Đơn Đặt Kho Thành Công</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
                  {successResult.message || `Đơn đặt kho #${booking.bookingCode} đã được hủy và ngăn kho #${booking.unitCode} đã được giải phóng.`}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-left space-y-2 max-w-md mx-auto">
                <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">Mã đơn:</span>
                  <strong className="font-mono text-slate-900">#{successResult.bookingCode || booking.bookingCode}</strong>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">Trạng thái mới:</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                    ĐÃ HỦY
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">Giải phóng ngăn kho:</span>
                  <strong className="text-emerald-700 font-semibold">✓ Đã chuyển về trống (AVAILABLE)</strong>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">Số tiền cọc hoàn trả:</span>
                  <strong className="font-mono font-bold text-emerald-600 text-sm">
                    {Number(successResult.refundAmount || 0).toLocaleString('vi-VN')} ₫ ({successResult.refundPercentage || 0}%)
                  </strong>
                </div>
                {successResult.refundTransactionId && (
                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-500">Mã đối soát hoàn tiền:</span>
                    <strong className="font-mono text-slate-700 text-[11px]">{successResult.refundTransactionId}</strong>
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-sm"
                >
                  Hoàn Tất &amp; Đóng
                </button>
              </div>
            </div>
          ) : loadingPreview ? (
            /* Loading State */
            <div className="py-12 text-center space-y-3">
              <span className="material-symbols-outlined text-[32px] text-blue-600 animate-spin">progress_activity</span>
              <p className="text-xs text-slate-500">Đang đối soát chính sách và tính toán quyền lợi hoàn tiền cọc...</p>
            </div>
          ) : (
            <>
              {previewError && (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">info</span>
                  <span>{previewError}</span>
                </div>
              )}

              {/* 3 Milestones Policy Card */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Chính sách hoàn tiền cọc (3 Mốc quy định)
                  </span>
                  {preview && (
                    <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px] text-slate-400">schedule</span>
                      <span>{preview.timeRemainingLabel || (preview.hoursUntilCheckin < 24 ? 'Lịch hẹn còn dưới 24 giờ' : `Còn khoảng ${Math.floor(preview.hoursUntilCheckin / 24)} ngày ${preview.hoursUntilCheckin % 24} giờ đến lịch hẹn nhận kho`)}</span>
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {/* Milestone 1 */}
                  <div className={`p-2.5 rounded-xl border text-[11px] flex flex-col justify-between transition-all ${
                    preview?.milestoneStage === 'STAGE_1_FULL_REFUND'
                      ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-400 text-emerald-950 shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600 opacity-75'
                  }`}>
                    <div>
                      <div className="font-bold flex items-center justify-between">
                        <span>≥ 48 Giờ</span>
                        {preview?.milestoneStage === 'STAGE_1_FULL_REFUND' && (
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        )}
                      </div>
                      <div className="font-semibold text-emerald-700 text-xs mt-0.5">Hoàn 100% cọc</div>
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1 block">Trước giờ hẹn từ 48h trở lên</span>
                  </div>

                  {/* Milestone 2 */}
                  <div className={`p-2.5 rounded-xl border text-[11px] flex flex-col justify-between transition-all ${
                    preview?.milestoneStage === 'STAGE_2_PARTIAL_REFUND'
                      ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-400 text-amber-950 shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600 opacity-75'
                  }`}>
                    <div>
                      <div className="font-bold flex items-center justify-between">
                        <span>24h – 48 Giờ</span>
                        {preview?.milestoneStage === 'STAGE_2_PARTIAL_REFUND' && (
                          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        )}
                      </div>
                      <div className="font-semibold text-amber-700 text-xs mt-0.5">Hoàn 50% cọc</div>
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1 block">Khấu trừ 50% phí giữ kho</span>
                  </div>

                  {/* Milestone 3 */}
                  <div className={`p-2.5 rounded-xl border text-[11px] flex flex-col justify-between transition-all ${
                    preview?.milestoneStage === 'STAGE_3_NO_REFUND'
                      ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-400 text-rose-950 shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600 opacity-75'
                  }`}>
                    <div>
                      <div className="font-bold flex items-center justify-between">
                        <span>&lt; 24 Giờ</span>
                        {preview?.milestoneStage === 'STAGE_3_NO_REFUND' && (
                          <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                        )}
                      </div>
                      <div className="font-semibold text-rose-700 text-xs mt-0.5">Không hoàn cọc</div>
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1 block">Khấu trừ 100% tiền cọc</span>
                  </div>
                </div>

                {preview && (
                  <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl text-[11px] text-blue-900 flex items-start gap-2">
                    <span className="material-symbols-outlined text-[16px] text-blue-600 shrink-0 mt-0.5">verified</span>
                    <div className="leading-relaxed">
                      <strong>Áp dụng:</strong> {preview.policyDescription}
                    </div>
                  </div>
                )}
              </div>

              {/* Refund Calculations Box */}
              {preview && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Tiền cọc đã ghi nhận:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {Number(preview.depositPaid || 0).toLocaleString('vi-VN')} ₫
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Tỷ lệ hoàn tiền:</span>
                    <span className="font-mono font-bold text-slate-900">{preview.refundPercentage}%</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-t border-slate-200/60">
                    <span className="text-slate-700 font-semibold">Số tiền hoàn lại cho bạn:</span>
                    <span className="font-mono font-extrabold text-emerald-600 text-sm">
                      {Number(preview.refundAmount || 0).toLocaleString('vi-VN')} ₫
                    </span>
                  </div>
                  {Number(preview.penaltyAmount || 0) > 0 && (
                    <div className="flex justify-between items-center text-[11px] text-rose-700">
                      <span>Phí khấu trừ giữ chỗ:</span>
                      <span className="font-mono font-bold">
                        -{Number(preview.penaltyAmount || 0).toLocaleString('vi-VN')} ₫
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Warning Notice */}
              <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-900 text-[11px] flex items-start gap-2">
                <span className="material-symbols-outlined text-[16px] text-amber-700 shrink-0 mt-0.5">warning</span>
                <p className="leading-relaxed">
                  Khi xác nhận hủy, ngăn kho <strong>#{booking.unitCode}</strong> sẽ được mở khóa và giải phóng ngay lập tức trên hệ thống cho khách hàng khác thuê.
                </p>
              </div>

              {/* Cancellation Reason Section */}
              <div className="space-y-2 pt-1">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
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
                          ? 'bg-rose-50 border-rose-300 text-rose-700 font-bold'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
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
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-rose-400 focus:bg-white transition-all resize-none"
                />
              </div>

              {submitError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  <span>{submitError}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        {!successResult && (
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded-xl text-xs border border-slate-200 transition-colors cursor-pointer disabled:opacity-50"
            >
              Giữ Lại Đơn
            </button>
            <button
              type="button"
              disabled={isSubmitting || loadingPreview}
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
                  <span>Xác Nhận Hủy Đặt Kho</span>
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
