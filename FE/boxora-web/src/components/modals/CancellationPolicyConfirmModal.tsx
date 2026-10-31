import React, { useState, useEffect } from 'react'
import { Modal } from '../ui/Modal'
import {
  FileText,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Building,
  CheckCircle2,
  Calendar,
  CreditCard,
  XCircle,
  HelpCircle,
  ArrowRight,
  Info,
} from 'lucide-react'
import { CancellationPolicyDetail } from '../../types'

export interface CancellationPolicyConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => Promise<void> | void
  isSubmitting?: boolean
  policyDetail: CancellationPolicyDetail | null
  isLoadingPolicy?: boolean
  policyError?: string | null
  bookingInfo: {
    facilityName: string
    unitName: string
    rentalDuration: string
    startDate: string
    endDate: string
    totalRent: number
    depositAmount: number
    totalPayment: number
    paymentMethodName?: string
  }
}

export const CancellationPolicyConfirmModal: React.FC<CancellationPolicyConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isSubmitting = false,
  policyDetail,
  isLoadingPolicy = false,
  policyError = null,
  bookingInfo,
}) => {
  const [agreed, setAgreed] = useState<boolean>(false)

  // Reset agreement checkbox when opening
  useEffect(() => {
    if (isOpen) {
      setAgreed(false)
    }
  }, [isOpen])

  const formatVnd = (amount: number = 0) => {
    return new Intl.NumberFormat('vi-VN').format(Math.round(amount))
  }

  const isPolicyValid = Boolean(policyDetail && policyDetail.isConfigured && policyDetail.policyVersion)

  return (
    <Modal isOpen={isOpen} onClose={isSubmitting ? () => {} : onClose} maxWidth="2xl">
      <div className="space-y-4 text-left">
        {/* Header */}
        <div className="flex items-start gap-3.5 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/70 border border-amber-200/80 dark:border-amber-800/80 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0 shadow-xs">
            <FileText size={22} />
          </div>
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
                ĐIỀU KHOẢN HỦY HỢP ĐỒNG &amp; HOÀN TIỀN
              </h3>
              {policyDetail?.policyVersion && (
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  {policyDetail.policyVersion}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Trước khi tiến hành ký hợp đồng và thanh toán, quý khách vui lòng đọc kỹ chính sách hủy hợp đồng và hoàn tiền của Boxora.
            </p>
          </div>
        </div>

        {/* Cảnh báo nếu chính sách chưa được cấu hình */}
        {(!isLoadingPolicy && !isPolicyValid) && (
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-2.5">
            <AlertTriangle size={18} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="block font-bold">Chưa thể xác nhận điều khoản giao dịch</strong>
              <p className="text-[11px] leading-relaxed">
                {policyError ||
                  'Cơ sở hiện chưa được Quản trị viên thiết lập đầy đủ chính sách hủy hợp đồng & hoàn tiền trong hệ thống. Để bảo vệ quyền lợi tài chính minh bạch cho khách hàng, hệ thống tạm thời chưa cho phép ký hợp đồng hoặc xác nhận giao dịch khi chưa có chính sách được phê duyệt.'}
              </p>
              <p className="text-[11px] font-medium text-rose-700 dark:text-rose-300 pt-0.5">
                Vui lòng liên hệ Hotline Boxora <strong>1900 6868</strong> hoặc báo quản trị viên cơ sở để cập nhật chính sách.
              </p>
            </div>
          </div>
        )}

        {/* Nội dung điều khoản chi tiết (Scrollable box) */}
        <div className="max-h-[50vh] overflow-y-auto pr-1 space-y-3.5 text-xs text-slate-700 dark:text-slate-300 leading-relaxed border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 bg-slate-50/50 dark:bg-slate-900/40">
          
          {/* Mục A */}
          <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-2 shadow-2xs">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-xs uppercase tracking-wide">
              <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center text-[11px] font-bold">A</span>
              <h4>Trường hợp khách hàng đổi ý trước khi nhận kho</h4>
            </div>
            <ul className="list-disc pl-5 space-y-1 text-slate-600 dark:text-slate-400 text-[11px]">
              <li>Khách hàng có thể gửi yêu cầu hủy hợp đồng sau khi ký và thanh toán.</li>
              <li>Boxora tiếp nhận và kiểm tra yêu cầu dựa trên hợp đồng đã ký và chính sách áp dụng.</li>
              <li>Số tiền hoàn được xác định dựa trên số tiền đã thanh toán, các khoản phải thanh toán hợp lệ và điều khoản hủy đã thỏa thuận.</li>
              <li>Tiền đặt cọc bảo đảm được quyết toán riêng, không mặc định bị mất khi khách yêu cầu hủy.</li>
              <li>Sau khi yêu cầu được chấp thuận, Boxora tiến hành quy trình hoàn tiền theo phương thức và thời hạn áp dụng.</li>
            </ul>
          </div>

          {/* Mục B */}
          <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-2 shadow-2xs">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-xs uppercase tracking-wide">
              <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center text-[11px] font-bold">B</span>
              <h4>Trường hợp khách hàng đã nhận bàn giao kho</h4>
            </div>
            <ul className="list-disc pl-5 space-y-1 text-slate-600 dark:text-slate-400 text-[11px]">
              <li>Khách hàng cần lấy toàn bộ tài sản ra khỏi kho.</li>
              <li>Boxora kiểm tra tình trạng kho và xác nhận bàn giao lại.</li>
              <li>Boxora thu hồi quyền truy cập SmartLock theo quy trình.</li>
              <li>Tiền thuê, tiền cọc và các khoản phát sinh hợp lệ được quyết toán theo hợp đồng.</li>
              <li>Hợp đồng chỉ được hoàn tất chấm dứt sau khi xử lý các nghĩa vụ liên quan.</li>
            </ul>
          </div>

          {/* Mục C */}
          <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-2 shadow-2xs">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-xs uppercase tracking-wide">
              <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center text-[11px] font-bold">C</span>
              <h4>Trường hợp lỗi từ phía Boxora</h4>
            </div>
            <ul className="list-disc pl-5 space-y-1 text-slate-600 dark:text-slate-400 text-[11px]">
              <li>Nếu Boxora không thể bàn giao kho theo cam kết hoặc vi phạm nghĩa vụ cung cấp dịch vụ, yêu cầu hủy sẽ được xem xét theo trách nhiệm của Boxora.</li>
              <li>Không tự động áp dụng phí hủy dành cho khách hàng trong trường hợp lỗi thuộc về Boxora.</li>
              <li>Việc hoàn tiền được thực hiện theo hợp đồng và quy định pháp luật hiện hành.</li>
            </ul>
          </div>

          {/* Mục D: Phí hủy và thời gian hoàn tiền (Trích xuất từ chính sách cơ sở thực tế) */}
          <div className="p-3.5 rounded-xl bg-gradient-to-br from-amber-50/70 to-orange-50/40 dark:from-amber-950/30 dark:to-orange-950/20 border border-amber-200 dark:border-amber-800/70 space-y-2.5">
            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-bold text-xs uppercase tracking-wide">
              <span className="w-5 h-5 rounded-full bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-200 flex items-center justify-center text-[11px] font-bold">D</span>
              <h4>Phí hủy &amp; Thời gian xử lý hoàn tiền (Theo chính sách cơ sở)</h4>
            </div>

            {isPolicyValid ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
                <div className="p-2.5 rounded-lg bg-white/90 dark:bg-slate-900/90 border border-amber-100 dark:border-amber-900/50 space-y-1">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase block">Thời hạn hủy hoàn cọc 100%</span>
                  <strong className="text-emerald-700 dark:text-emerald-400 block font-bold text-xs">
                    Trong vòng {policyDetail?.cancellationFullRefundHours ?? 24} giờ
                  </strong>
                  <span className="text-[10px] text-slate-500 block">Kể từ thời điểm đặt kho thành công</span>
                </div>

                <div className="p-2.5 rounded-lg bg-white/90 dark:bg-slate-900/90 border border-amber-100 dark:border-amber-900/50 space-y-1">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase block">Hủy hoàn một phần</span>
                  <strong className="text-amber-700 dark:text-amber-400 block font-bold text-xs">
                    Hoàn {policyDetail?.cancellationPartialRefundPercent ?? 70}% tiền cọc
                  </strong>
                  <span className="text-[10px] text-slate-500 block">
                    Trong vòng {policyDetail?.cancellationPartialRefundHours ?? 48} giờ (khấu trừ phí hủy {100 - (policyDetail?.cancellationPartialRefundPercent ?? 70)}%)
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-white/90 dark:bg-slate-900/90 border border-amber-100 dark:border-amber-900/50 space-y-1">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase block">Thời hạn báo trước khi trả kho</span>
                  <strong className="text-slate-800 dark:text-slate-200 block font-bold text-xs">
                    {policyDetail?.returnNoticeDays && policyDetail.returnNoticeDays > 0
                      ? `${policyDetail.returnNoticeDays} ngày trước ngày kết thúc`
                      : 'Không yêu cầu báo trước'}
                  </strong>
                  <span className="text-[10px] text-slate-500 block">Quy định thông báo trước trả kho</span>
                </div>

                <div className="p-2.5 rounded-lg bg-white/90 dark:bg-slate-900/90 border border-amber-100 dark:border-amber-900/50 space-y-1">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase block">Thời gian xử lý hoàn tiền (SLA)</span>
                  <strong className="text-blue-700 dark:text-blue-400 block font-bold text-xs">
                    {policyDetail?.depositRefundSlaDays ?? 5} ngày làm việc
                  </strong>
                  <span className="text-[10px] text-slate-500 block">Kể từ khi yêu cầu được phê duyệt</span>
                </div>

                <div className="sm:col-span-2 p-2.5 rounded-lg bg-white/90 dark:bg-slate-900/90 border border-amber-100 dark:border-amber-900/50 text-[10px] text-slate-600 dark:text-slate-400">
                  <strong>Các khoản được khấu trừ hợp lệ:</strong> Tiền thuê tính theo thời gian thực tế kho đã sử dụng; các khoản phát sinh nếu vi phạm điều khoản lưu kho hoặc biên bản nghiệm thu trả kho (vệ sinh, hư hại vật chất nếu có).
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 italic">
                Đang chờ Quản trị viên cập nhật thông số chính sách cơ sở.
              </p>
            )}
          </div>
        </div>

        {/* 3. BẢNG THÔNG TIN GIAO DỊCH CỤ THỂ */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Thông tin giao dịch áp dụng
            </span>
            <span className="text-[10px] font-mono font-medium text-slate-500">
              Phương thức: <strong>{bookingInfo.paymentMethodName || 'VNPay'}</strong>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 block">Cơ sở bàn giao</span>
              <strong className="text-slate-900 dark:text-white font-bold block truncate">{bookingInfo.facilityName}</strong>
            </div>
            <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 block">Loại buồng kho</span>
              <strong className="text-blue-600 dark:text-blue-400 font-bold block truncate">{bookingInfo.unitName}</strong>
            </div>
            <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 block">Thời hạn thuê</span>
              <strong className="text-slate-900 dark:text-white font-bold block">{bookingInfo.rentalDuration}</strong>
            </div>
            <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 block">Thời gian</span>
              <strong className="text-slate-700 dark:text-slate-300 font-semibold block text-[10px] truncate">
                {bookingInfo.startDate} → {bookingInfo.endDate}
              </strong>
            </div>
          </div>

          {/* Bảng phân rã số tiền */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700/80 overflow-hidden bg-white dark:bg-slate-900">
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-slate-600 dark:text-slate-400">Tiền thuê kho ({bookingInfo.rentalDuration})</span>
                <span className="font-semibold text-slate-900 dark:text-white">{formatVnd(bookingInfo.totalRent)} đ</span>
              </div>
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-slate-600 dark:text-slate-400">Tiền đặt cọc bảo đảm (quyết toán riêng khi trả kho)</span>
                <span className="font-semibold text-slate-900 dark:text-white">{formatVnd(bookingInfo.depositAmount)} đ</span>
              </div>
              <div className="flex items-center justify-between px-3 py-2.5 bg-blue-50/70 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200">
                <strong className="font-bold">Tổng thanh toán hôm nay</strong>
                <strong className="text-sm font-extrabold text-blue-700 dark:text-blue-300 font-mono">
                  {formatVnd(bookingInfo.totalPayment)} đ
                </strong>
              </div>
            </div>
          </div>
        </div>

        {/* 4. CHECKBOX XÁC NHẬN ĐỒNG Ý */}
        <div className="pt-1">
          <label
            className={`flex items-start gap-2.5 p-3 rounded-xl border transition-all cursor-pointer select-none ${
              !isPolicyValid
                ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                : agreed
                ? 'bg-blue-50/80 dark:bg-blue-950/50 border-blue-500 dark:border-blue-700 text-blue-950 dark:text-blue-100 ring-2 ring-blue-500/15'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-800 dark:text-slate-200'
            }`}
          >
            <input
              type="checkbox"
              disabled={!isPolicyValid || isSubmitting}
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="w-4 h-4 mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed shrink-0"
            />
            <span className="text-xs font-semibold leading-relaxed">
              Tôi đã đọc, hiểu và đồng ý với <strong>Điều khoản hủy hợp đồng và hoàn tiền của Boxora</strong> được hiển thị ở trên.
            </span>
          </label>
        </div>

        {/* 5. HAI NÚT THAO TÁC */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs sm:text-sm font-bold transition-all cursor-pointer text-center"
          >
            Quay lại
          </button>

          <button
            type="button"
            disabled={!agreed || !isPolicyValid || isSubmitting}
            onClick={onConfirm}
            className={`w-full sm:w-auto px-6 py-2.5 rounded-xl text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 ${
              agreed && isPolicyValid && !isSubmitting
                ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/25 active:scale-98 cursor-pointer'
                : 'bg-slate-300 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed shadow-none'
            }`}
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Đang ghi nhận xác nhận...</span>
              </span>
            ) : (
              <>
                <span>Xác nhận &amp; Tiếp tục</span>
                <ArrowRight size={15} />
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  )
}
