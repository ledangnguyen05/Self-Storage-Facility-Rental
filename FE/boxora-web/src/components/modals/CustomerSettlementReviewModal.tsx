import React, { useState, useEffect } from 'react'
import {
  ShieldCheck,
  X,
  AlertTriangle,
  CheckCircle2,
  Building2,
  CreditCard,
  ExternalLink,
  MessageSquareWarning,
  Send,
  RefreshCw,
  Info
} from 'lucide-react'
import { handoverService, ReturnSettlementDetail } from '../../services/handoverService'
import { paymentService } from '../../services/paymentService'
import { toast } from '../../utils/toast'

const POPULAR_BANKS = [
  'Vietcombank (VCB)',
  'MB Bank (MB)',
  'Techcombank (TCB)',
  'VietinBank (CTG)',
  'BIDV',
  'ACB',
  'VPBank',
  'TPBank',
  'Sacombank',
  'HDBank',
  'VIB',
  'SHB',
  'MSB',
  'OCB',
  'SeABank'
]

interface CustomerSettlementReviewModalProps {
  isOpen: boolean
  onClose: () => void
  bookingId: string
  onUpdated?: () => void
}

export const CustomerSettlementReviewModal: React.FC<CustomerSettlementReviewModalProps> = ({
  isOpen,
  onClose,
  bookingId,
  onUpdated
}) => {
  const [settlement, setSettlement] = useState<ReturnSettlementDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [viewStep, setViewStep] = useState<'VIEW' | 'FORM_BANK' | 'FORM_DISPUTE' | 'FORM_PAY'>('VIEW')

  // Bank Form State
  const [bankName, setBankName] = useState(POPULAR_BANKS[0])
  const [bankAccountNumber, setBankAccountNumber] = useState('')
  const [bankAccountName, setBankAccountName] = useState('')

  // Dispute Form State
  const [disputeReason, setDisputeReason] = useState('')
  const [disputeEvidenceUrls, setDisputeEvidenceUrls] = useState('')

  const fetchSettlement = async () => {
    if (!bookingId) return
    setLoading(true)
    try {
      const data = await handoverService.calculateSettlement(bookingId)
      setSettlement(data)
      if (data.bankName) setBankName(data.bankName)
      if (data.bankAccountNumber) setBankAccountNumber(data.bankAccountNumber)
      if (data.bankAccountName) setBankAccountName(data.bankAccountName)
      if (data.disputeReason) setDisputeReason(data.disputeReason)
    } catch (err: any) {
      console.error('Failed to load settlement detail:', err)
      toast.error('Không thể tải chi tiết biên bản quyết toán: ' + (err?.response?.data?.message || err.message))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen && bookingId) {
      setViewStep('VIEW')
      void fetchSettlement()
    }
  }, [isOpen, bookingId])

  if (!isOpen) return null

  const isOverDeposit = settlement ? (settlement.additionalAmountDue || 0) > 0 : false
  const netRefund = settlement ? settlement.netRefundAmount || 0 : 0
  const additionalDue = settlement ? settlement.additionalAmountDue || 0 : 0
  const depositPaid = settlement ? settlement.depositPaid || 0 : 0
  const totalDeduction = settlement ? settlement.totalDeduction || 0 : 0

  // 1. Customer agrees with refund -> Submit bank info to Business Manager
  const handleSubmitBankAndAgree = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!bankAccountNumber.trim()) {
      toast.warning('Vui lòng nhập số tài khoản ngân hàng nhận tiền hoàn.')
      return
    }
    if (!bankAccountName.trim()) {
      toast.warning('Vui lòng nhập tên chủ tài khoản ngân hàng.')
      return
    }

    setSubmitting(true)
    try {
      await handoverService.submitCustomerDecision(bookingId, {
        decision: 'AGREED',
        bankName,
        bankAccountNumber: bankAccountNumber.trim(),
        bankAccountName: bankAccountName.trim().toUpperCase()
      })
      toast.success(
        'Đã gửi thông tin tài khoản ngân hàng thành công! Quản lý kinh doanh (Business Manager) sẽ tiến hành giải ngân hoàn tiền cho bạn.'
      )
      setViewStep('VIEW')
      await fetchSettlement()
      if (onUpdated) onUpdated()
    } catch (err: any) {
      toast.error('Lỗi gửi phản hồi quyết toán: ' + (err?.response?.data?.message || err.message))
    } finally {
      setSubmitting(false)
    }
  }

  // 2. Customer agrees with break-even (netRefund == 0 && additionalDue == 0)
  const handleAgreeBreakEven = async () => {
    setSubmitting(true)
    try {
      await handoverService.submitCustomerDecision(bookingId, {
        decision: 'AGREED'
      })
      toast.success('Đã xác nhận đồng ý kết quả quyết toán đối soát!')
      setViewStep('VIEW')
      await fetchSettlement()
      if (onUpdated) onUpdated()
    } catch (err: any) {
      toast.error('Lỗi gửi phản hồi quyết toán: ' + (err?.response?.data?.message || err.message))
    } finally {
      setSubmitting(false)
    }
  }

  // 3. Customer agrees to pay additional compensation via VNPay Sandbox
  const handleProceedVNPayCompensation = async () => {
    if (!settlement) return
    setSubmitting(true)
    try {
      // First ensure decision is marked AGREED
      if (settlement.customerDecision !== 'AGREED') {
        await handoverService.submitCustomerDecision(bookingId, {
          decision: 'AGREED'
        })
      }

      const res = await paymentService.createVNPayPayment({
        bookingId,
        amount: additionalDue,
        paymentType: 'RETURN_COMPENSATION' as any,
        orderInfo: `Bồi thường trả kho buồng #${settlement.unitCode}`
      })

      if (res?.paymentUrl) {
        toast.info('Đang chuyển hướng sang cổng thanh toán VNPay Sandbox...')
        window.location.href = res.paymentUrl
      } else {
        toast.error('Không nhận được liên kết thanh toán từ cổng VNPay Sandbox.')
      }
    } catch (err: any) {
      toast.error('Không thể tạo giao dịch VNPay: ' + (err?.response?.data?.message || err.message))
    } finally {
      setSubmitting(false)
    }
  }

  // 4. Customer submits dispute to Facility Manager
  const handleSubmitDispute = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!disputeReason.trim()) {
      toast.warning('Vui lòng nhập chi tiết lý do bạn khiếu nại kết quả tính phí.')
      return
    }

    setSubmitting(true)
    try {
      await handoverService.submitCustomerDecision(bookingId, {
        decision: 'DISPUTED',
        disputeReason: disputeReason.trim(),
        disputeEvidenceUrls: disputeEvidenceUrls.trim() ? [disputeEvidenceUrls.trim()] : undefined
      })
      toast.success(
        'Đã gửi đơn khiếu nại thành công! Quản lý cơ sở (Facility Manager) sẽ tiếp nhận và trực tiếp xử lý khiếu nại của bạn.'
      )
      setViewStep('VIEW')
      await fetchSettlement()
      if (onUpdated) onUpdated()
    } catch (err: any) {
      toast.error('Lỗi gửi khiếu nại: ' + (err?.response?.data?.message || err.message))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5 text-indigo-700">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 leading-tight">
                Biên Bản Nghiệm Thu &amp; Quyết Toán Trả Kho
              </h3>
              <p className="text-xs text-slate-500 font-mono">
                Buồng kho #{settlement?.unitCode || '...'} • Mã đơn #{settlement?.bookingCode || '...'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center cursor-pointer transition"
          >
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
            <RefreshCw size={24} className="animate-spin text-indigo-600" />
            <span>Đang tải thông tin quyết toán đối soát...</span>
          </div>
        ) : !settlement ? (
          <div className="py-8 text-center text-xs text-slate-500">
            Không tìm thấy thông tin quyết toán cho đơn này.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Trạng thái quyết toán & Snapshot Version */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-bold font-mono text-[11px]">
                  Phiên bản V{settlement.settlementVersion || 1}
                </span>
                <span className="text-slate-600">
                  Chốt bởi: <strong>{settlement.settlementConfirmedByName || 'Nhân viên Boxora'}</strong>
                </span>
              </div>
              <div>
                {settlement.customerDecision === 'AGREED' ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px] flex items-center gap-1">
                    <CheckCircle2 size={12} /> Bạn đã đồng ý
                  </span>
                ) : settlement.customerDecision === 'DISPUTED' ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold text-[11px] flex items-center gap-1">
                    <AlertTriangle size={12} /> Đang khiếu nại (Chờ Facility Manager)
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[11px]">
                    ⏳ Chờ bạn phản hồi
                  </span>
                )}
              </div>
            </div>

            {/* VIEW STEP: Default Overview */}
            {viewStep === 'VIEW' && (
              <div className="space-y-4 text-xs">
                {/* Bảng chi tiết khấu trừ */}
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="bg-slate-100 px-3.5 py-2 font-bold text-slate-700 flex items-center justify-between text-xs">
                    <span>Chi tiết đối soát 7 tiêu chí kiểm tra hiện trường</span>
                    <span className="font-mono text-slate-500">Đơn vị: VNĐ</span>
                  </div>
                  <div className="p-3.5 space-y-2 bg-white divide-y divide-slate-100">
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-slate-600">1. Tiền cọc bảo đảm ban đầu đã nộp:</span>
                      <span className="font-mono font-bold text-slate-900">
                        {depositPaid.toLocaleString('vi-VN')} ₫
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <span className="text-slate-600">2. Chi phí sửa chữa cửa cuốn &amp; ray:</span>
                      <span className={`font-mono font-semibold ${settlement.doorFee > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                        {settlement.doorFee > 0 ? `-${settlement.doorFee.toLocaleString('vi-VN')} ₫` : '0 ₫'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <span className="text-slate-600">3. Chi phí dọn dẹp &amp; vệ sinh kho:</span>
                      <span className={`font-mono font-semibold ${settlement.cleaningFee > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                        {settlement.cleaningFee > 0 ? `-${settlement.cleaningFee.toLocaleString('vi-VN')} ₫` : '0 ₫'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <span className="text-slate-600">4. Chi phí khắc phục hư hại vách / sàn / trần:</span>
                      <span className={`font-mono font-semibold ${settlement.wallStructureFee > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                        {settlement.wallStructureFee > 0 ? `-${settlement.wallStructureFee.toLocaleString('vi-VN')} ₫` : '0 ₫'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <span className="text-slate-600">5. Chi phí sửa chữa ổ khóa SmartLock IoT:</span>
                      <span className={`font-mono font-semibold ${settlement.smartLockFee > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                        {settlement.smartLockFee > 0 ? `-${settlement.smartLockFee.toLocaleString('vi-VN')} ₫` : '0 ₫'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <span className="text-slate-600">6. Phí bồi thường mất thẻ từ / phụ kiện:</span>
                      <span className={`font-mono font-semibold ${settlement.lostCardFee > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                        {settlement.lostCardFee > 0 ? `-${settlement.lostCardFee.toLocaleString('vi-VN')} ₫` : '0 ₫'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <span className="text-slate-600">7. Công nợ / cước thuê trễ hạn (nếu có):</span>
                      <span className={`font-mono font-semibold ${settlement.overdueDebt > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                        {settlement.overdueDebt > 0 ? `-${settlement.overdueDebt.toLocaleString('vi-VN')} ₫` : '0 ₫'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2.5 font-bold">
                      <span className="text-slate-800">Tổng chi phí khấu trừ xác minh:</span>
                      <span className="font-mono text-rose-600">
                        {totalDeduction.toLocaleString('vi-VN')} ₫
                      </span>
                    </div>
                  </div>
                </div>

                {/* Kết quả đối soát highlight */}
                {isOverDeposit ? (
                  <div className="p-4 rounded-xl bg-rose-50 border border-rose-300 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-rose-950 text-xs">
                        Khoản khách cần thanh toán bổ sung (Bồi thường):
                      </span>
                      <span className="font-mono font-black text-rose-600 text-base">
                        +{additionalDue.toLocaleString('vi-VN')} ₫
                      </span>
                    </div>
                    <p className="text-[11px] text-rose-800 leading-relaxed">
                      Toàn bộ tiền cọc <strong>{depositPaid.toLocaleString('vi-VN')} ₫</strong> đã được khấu trừ cho chi phí sửa chữa. Quý khách cần thanh toán bổ sung số tiền trên qua cổng trực tuyến <strong>VNPay Sandbox</strong> để hoàn tất giải phóng kho.
                    </p>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-950 text-xs">
                        Số tiền bạn được hoàn trả lại:
                      </span>
                      <span className="font-mono font-black text-emerald-700 text-base">
                        {netRefund.toLocaleString('vi-VN')} ₫
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-800 leading-relaxed">
                      Tiền cọc ban đầu đủ bù đắp các chi phí sửa chữa. Sau khi quý khách xác nhận đồng ý và cung cấp số tài khoản ngân hàng, Quản lý kinh doanh (Business Manager) sẽ tiến hành chuyển khoản hoàn tiền cọc cho bạn.
                    </p>
                  </div>
                )}

                {/* Tình trạng phản hồi của khách hàng */}
                {settlement.customerDecision === 'AGREED' && (
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                      <CheckCircle2 size={16} className="text-emerald-600" />
                      <span>Bạn đã xác nhận đồng ý kết quả quyết toán</span>
                    </div>
                    {netRefund > 0 && (
                      <div className="space-y-1 text-slate-600 text-[11px] bg-white p-2.5 rounded-lg border border-slate-200">
                        <div>Ngân hàng thụ hưởng: <strong>{settlement.bankName || 'Đang cập nhật'}</strong></div>
                        <div>Số tài khoản: <strong className="font-mono">{settlement.bankAccountNumber || 'Đang cập nhật'}</strong></div>
                        <div>Tên chủ tài khoản: <strong>{settlement.bankAccountName || 'Đang cập nhật'}</strong></div>
                        <div className="pt-1 text-indigo-700 font-medium">
                          {settlement.refundStatus === 'REFUNDED' ? (
                            <span className="text-emerald-700 font-bold">
                              ✓ Business Manager đã giải ngân hoàn tiền thành công! (Mã GD: {settlement.refundTransactionId || 'FT2630018942'})
                            </span>
                          ) : (
                            <span>
                              ⏳ Hồ sơ đang được chuyển trực tiếp cho Quản lý kinh doanh (Business Manager) để tiến hành lệnh chuyển khoản hoàn tiền.
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    {isOverDeposit && (
                      <div className="space-y-1 text-slate-600 text-[11px] bg-white p-2.5 rounded-lg border border-slate-200">
                        {settlement.additionalPaymentStatus === 'PAID' ? (
                          <div className="text-emerald-700 font-bold flex items-center gap-1">
                            <CheckCircle2 size={14} />
                            <span>Bạn đã hoàn tất thanh toán bồi thường {additionalDue.toLocaleString('vi-VN')} ₫ qua VNPay thành công! (Mã GD: {settlement.additionalPaymentTxnRef})</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <span className="text-rose-700 font-semibold">Chưa hoàn tất thanh toán bổ sung</span>
                            <button
                              type="button"
                              onClick={handleProceedVNPayCompensation}
                              disabled={submitting}
                              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
                            >
                              <CreditCard size={13} />
                              <span>Thanh toán VNPay Sandbox ngay</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {settlement.customerDecision === 'DISPUTED' && (
                  <div className="p-4 rounded-xl bg-rose-50 border border-rose-300 space-y-2 text-xs">
                    <div className="font-bold text-rose-900 flex items-center gap-1.5">
                      <MessageSquareWarning size={16} className="text-rose-600" />
                      <span>Đơn khiếu nại của bạn đang chờ Quản lý cơ sở (Facility Manager) giải quyết</span>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-rose-200 space-y-1 text-slate-700">
                      <span className="text-slate-500 font-semibold text-[11px]">Nội dung khiếu nại đã gửi:</span>
                      <p className="italic font-medium">"{settlement.disputeReason || 'Khách hàng không đồng ý với khoản chi phí khấu trừ hiện tại.'}"</p>
                    </div>
                    {settlement.disputeResolutionNote && (
                      <div className="bg-emerald-50 p-2.5 rounded-lg border border-emerald-200 space-y-1 text-emerald-950">
                        <span className="text-emerald-800 font-semibold text-[11px]">Phản hồi từ Facility Manager ({settlement.disputeResolvedByName}):</span>
                        <p className="font-medium">"{settlement.disputeResolutionNote}"</p>
                      </div>
                    )}
                    <p className="text-[11px] text-rose-800">
                      Chỉ Quản lý cơ sở (Facility Manager) mới có thẩm quyền phân xử đơn khiếu nại này. Vui lòng chờ nhân viên liên hệ hoặc theo dõi kết quả tại đây.
                    </p>
                  </div>
                )}

                {/* HAI BUTTON CHÍNH NẾU ĐANG CHỜ PHẢN HỒI (PENDING) */}
                {(!settlement.customerDecision || settlement.customerDecision === 'PENDING') && (
                  <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => setViewStep('FORM_DISPUTE')}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-rose-300 bg-white hover:bg-rose-50 text-rose-700 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition shadow-2xs"
                    >
                      <MessageSquareWarning size={15} />
                      <span>Khiếu nại kết quả</span>
                    </button>

                    {netRefund > 0 ? (
                      <button
                        type="button"
                        onClick={() => setViewStep('FORM_BANK')}
                        className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition"
                      >
                        <CheckCircle2 size={15} />
                        <span>Đồng ý &amp; Nhập tài khoản nhận tiền hoàn</span>
                      </button>
                    ) : isOverDeposit ? (
                      <button
                        type="button"
                        onClick={() => setViewStep('FORM_PAY')}
                        className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition"
                      >
                        <CreditCard size={15} />
                        <span>Đồng ý &amp; Thanh toán qua VNPay Sandbox</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleAgreeBreakEven}
                        disabled={submitting}
                        className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition disabled:opacity-50"
                      >
                        <CheckCircle2 size={15} />
                        <span>{submitting ? 'Đang gửi...' : 'Đồng ý quyết toán hòa vốn'}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* FORM 1: NHẬP THÔNG TIN NGÂN HÀNG KHI ĐỒNG Ý HOÀN TIỀN */}
            {viewStep === 'FORM_BANK' && (
              <form onSubmit={handleSubmitBankAndAgree} className="space-y-4 text-xs">
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                    <Building2 size={15} />
                    <span>Cung cấp số tài khoản nhận tiền hoàn cọc ({netRefund.toLocaleString('vi-VN')} ₫)</span>
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    Sau khi bạn xác nhận, thông tin tài khoản ngân hàng sẽ được chuyển trực tiếp cho <strong>Quản lý vận hành kinh doanh (Business Manager)</strong> để tiến hành giải ngân chuyển khoản.
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Ngân hàng thụ hưởng <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium text-xs focus:bg-white focus:border-emerald-500"
                  >
                    {POPULAR_BANKS.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Số tài khoản ngân hàng <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={bankAccountNumber}
                    onChange={(e) => setBankAccountNumber(e.target.value)}
                    placeholder="VD: 0988219002 hoặc 1029384756..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 text-xs focus:bg-white focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Tên chủ tài khoản (In hoa không dấu) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={bankAccountName}
                    onChange={(e) => setBankAccountName(e.target.value.toUpperCase())}
                    placeholder="VD: LE THI HOANG YEN"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold uppercase text-slate-800 text-xs focus:bg-white focus:border-emerald-500"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setViewStep('VIEW')}
                    className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-xs cursor-pointer hover:bg-slate-50"
                  >
                    Quay lại
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition disabled:opacity-50"
                  >
                    <Send size={14} />
                    <span>{submitting ? 'Đang gửi...' : 'Xác Nhận & Gửi Cho Business Manager'}</span>
                  </button>
                </div>
              </form>
            )}

            {/* FORM 2: THANH TOÁN BỒI THƯỜNG BỔ SUNG QUA VNPAY SANDBOX */}
            {viewStep === 'FORM_PAY' && (
              <div className="space-y-4 text-xs">
                <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-950 space-y-2">
                  <div className="font-bold flex items-center gap-1.5 text-indigo-900">
                    <CreditCard size={16} />
                    <span>Xác nhận đồng ý &amp; Thanh toán bồi thường bổ sung</span>
                  </div>
                  <p className="text-[11px] text-indigo-800 leading-relaxed">
                    Bạn đồng ý với kết quả quyết toán và tiến hành thanh toán số tiền bồi thường vượt cọc là <strong>{additionalDue.toLocaleString('vi-VN')} ₫</strong>.
                  </p>
                  <div className="p-2.5 rounded-lg bg-white border border-indigo-200 flex items-center justify-between font-mono font-bold text-slate-800">
                    <span>Số tiền cần thanh toán ngay:</span>
                    <span className="text-rose-600 text-sm">+{additionalDue.toLocaleString('vi-VN')} ₫</span>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Hình thức: Cổng thanh toán trực tuyến <strong>VNPay Sandbox</strong> (Hỗ trợ quét mã VietQR, Thẻ ATM nội địa, Visa, MasterCard). Sau khi thanh toán xong, hệ thống sẽ tự động gửi thông báo web và email biên lai cho bạn.
                  </p>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setViewStep('VIEW')}
                    className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-xs cursor-pointer hover:bg-slate-50"
                  >
                    Quay lại
                  </button>
                  <button
                    type="button"
                    onClick={handleProceedVNPayCompensation}
                    disabled={submitting}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition disabled:opacity-50"
                  >
                    <ExternalLink size={14} />
                    <span>{submitting ? 'Đang tạo giao dịch...' : 'Mở Cổng Thanh Toán VNPay Sandbox'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* FORM 3: GỬI KHIẾU NẠI CHO FACILITY MANAGER */}
            {viewStep === 'FORM_DISPUTE' && (
              <form onSubmit={handleSubmitDispute} className="space-y-4 text-xs">
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-950 space-y-1.5">
                  <div className="font-bold flex items-center gap-1.5 text-rose-900">
                    <MessageSquareWarning size={16} />
                    <span>Gửi đơn khiếu nại quyết toán trả kho</span>
                  </div>
                  <p className="text-[11px] text-rose-800 leading-relaxed">
                    Đơn khiếu nại của bạn sẽ được chuyển riêng cho <strong>Quản lý cơ sở (Facility Manager)</strong> để tiếp nhận và xem xét phân xử độc lập.
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Lý do khiếu nại chi tiết <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={disputeReason}
                    onChange={(e) => setDisputeReason(e.target.value)}
                    placeholder="Mô tả cụ thể khoản chi phí khấu trừ nào bạn thấy chưa thỏa đáng hoặc hiện trạng kho khi trả..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs focus:bg-white focus:border-rose-400 leading-relaxed"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Đường dẫn ảnh / video minh chứng đính kèm (tùy chọn):
                  </label>
                  <input
                    type="url"
                    value={disputeEvidenceUrls}
                    onChange={(e) => setDisputeEvidenceUrls(e.target.value)}
                    placeholder="https://drive.google.com/... hoặc link ảnh bằng chứng"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs focus:bg-white focus:border-rose-400"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setViewStep('VIEW')}
                    className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-xs cursor-pointer hover:bg-slate-50"
                  >
                    Quay lại
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition disabled:opacity-50"
                  >
                    <Send size={14} />
                    <span>{submitting ? 'Đang gửi...' : 'Gửi Đơn Khiếu Nại Cho Facility Manager'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
