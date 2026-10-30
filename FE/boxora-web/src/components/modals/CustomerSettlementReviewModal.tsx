import React, { useState, useEffect, useMemo } from 'react'
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
  Info,
  Undo2,
  Camera,
  Image as ImageIcon,
  ZoomIn
} from 'lucide-react'
import { handoverService, ReturnSettlementDetail, SettlementSnapshot } from '../../services/handoverService'
import { paymentService } from '../../services/paymentService'
import { toast } from '../../utils/toast'
import { getApiBaseUrl } from '../../lib/axios'

const resolveReceiptUrl = (url: string | null | undefined): string => {
  if (!url) return ''
  const trimmed = url.trim()
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('data:')
  ) {
    return trimmed
  }
  const cleanUrl = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  const base = getApiBaseUrl()
  const cleanBase = base ? base.replace(/\/api\/?$/, '') : ''
  return cleanBase ? `${cleanBase}${cleanUrl}` : cleanUrl
}

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
  readOnly?: boolean
  initialVersion?: number
  onUpdated?: () => void
}

export const CustomerSettlementReviewModal: React.FC<CustomerSettlementReviewModalProps> = ({
  isOpen,
  onClose,
  bookingId,
  readOnly = false,
  initialVersion,
  onUpdated
}) => {
  const [settlement, setSettlement] = useState<ReturnSettlementDetail | null>(null)
  const [selectedVersion, setSelectedVersion] = useState<number | null>(initialVersion || null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [viewStep, setViewStep] = useState<'VIEW' | 'FORM_BANK' | 'FORM_DISPUTE' | 'FORM_PAY'>('VIEW')

  // Bank Form State
  const [bankName, setBankName] = useState(POPULAR_BANKS[0])
  const [bankAccountNumber, setBankAccountNumber] = useState('')
  const [bankAccountName, setBankAccountName] = useState('')
  const [showBankConfirmModal, setShowBankConfirmModal] = useState(false)
  const [bankDisclaimerChecked, setBankDisclaimerChecked] = useState(false)
  const [previewProofModal, setPreviewProofModal] = useState<string | null>(null)

  // Dispute Form State
  const [disputeReason, setDisputeReason] = useState('')
  const [disputeEvidenceUrls, setDisputeEvidenceUrls] = useState('')

  const fetchSettlement = async () => {
    if (!bookingId) return
    setLoading(true)
    try {
      const data = await handoverService.calculateSettlement(bookingId)
      setSettlement(data)
      if (initialVersion) {
        setSelectedVersion(initialVersion)
      } else if (data.settlementVersion) {
        setSelectedVersion(data.settlementVersion)
      }
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
      if (initialVersion) {
        setSelectedVersion(initialVersion)
      }
      void fetchSettlement()
    }
  }, [isOpen, bookingId, initialVersion])

  const evidencePhotosList: string[] = useMemo(() => {
    if (!settlement) return []
    const rawPhotos = (settlement as any).evidencePhotos || (settlement as any).photoUrls
    if (Array.isArray(rawPhotos)) {
      return rawPhotos.map(String).map((s: string) => s.trim()).filter(Boolean)
    }
    if (typeof rawPhotos === 'string' && (rawPhotos as string).trim()) {
      return (rawPhotos as string).split(/[;,|]/).map((s: string) => s.trim()).filter(Boolean)
    }
    return []
  }, [settlement])

  const disputeEvidenceList: string[] = useMemo(() => {
    if (!settlement) return []
    const rawEvidence = (settlement as any).disputeEvidenceUrls
    if (!rawEvidence) return []
    if (Array.isArray(rawEvidence)) {
      return rawEvidence.map(String).map((s: string) => s.trim()).filter(Boolean)
    }
    if (typeof rawEvidence === 'string' && (rawEvidence as string).trim()) {
      return (rawEvidence as string).split(/[;,|\n]/).map((s: string) => s.trim()).filter(Boolean)
    }
    return []
  }, [settlement])

  if (!isOpen) return null

  const snapshotsList: SettlementSnapshot[] = useMemo(() => {
    return settlement?.snapshots || []
  }, [settlement])

  const activeSnapshot: SettlementSnapshot | null = useMemo(() => {
    if (!settlement) return null
    if (selectedVersion && snapshotsList.length > 0) {
      const match = snapshotsList.find(s => s.settlementVersion === selectedVersion)
      if (match) return match
    }
    return null
  }, [settlement, selectedVersion, snapshotsList])

  const currentViewingVersion = activeSnapshot?.settlementVersion || selectedVersion || settlement?.settlementVersion || 1
  const isViewingLatestVersion = settlement ? currentViewingVersion === (settlement.settlementVersion || 1) : true

  // Dữ liệu đối soát hiển thị động theo phiên bản đang xem
  const displayDepositPaid = activeSnapshot != null ? Number(activeSnapshot.depositAmount || 0) : Number(settlement?.depositPaid || 0)
  const displayDoorFee = activeSnapshot != null ? Number(activeSnapshot.doorFee || 0) : Number(settlement?.doorFee || 0)
  const displayCleaningFee = activeSnapshot != null ? Number(activeSnapshot.cleaningFee || 0) : Number(settlement?.cleaningFee || 0)
  const displayWallStructureFee = activeSnapshot != null ? Number(activeSnapshot.wallStructureFee || 0) : Number(settlement?.wallStructureFee || 0)
  const displaySmartLockFee = activeSnapshot != null ? Number(activeSnapshot.smartLockFee || 0) : Number(settlement?.smartLockFee || 0)
  const displayLostCardFee = activeSnapshot != null ? Number(activeSnapshot.lostCardFee || 0) : Number(settlement?.lostCardFee || 0)
  const displayOverdueDebt = activeSnapshot != null ? Number(activeSnapshot.overdueDebt || 0) : Number(settlement?.overdueDebt || 0)
  const displayTotalDeduction = activeSnapshot != null ? Number(activeSnapshot.totalDeductions || 0) : Number(settlement?.totalDeduction || 0)
  const displayNetRefund = activeSnapshot != null ? Number(activeSnapshot.refundAmount || 0) : Number(settlement?.netRefundAmount || 0)
  const displayAdditionalDue = activeSnapshot != null ? Number(activeSnapshot.additionalAmountDue || 0) : Number(settlement?.additionalAmountDue || 0)
  const displayIsOverDeposit = displayAdditionalDue > 0

  const displayConfirmedByName = activeSnapshot?.confirmedByName || settlement?.settlementConfirmedByName || 'Nhân viên Boxora'
  const displayConfirmedAt = activeSnapshot?.confirmedAt || settlement?.settlementConfirmedAt
  const displayCustomerDecision = activeSnapshot?.customerDecision || settlement?.customerDecision || 'NONE'
  const displayNotes = activeSnapshot?.notes || settlement?.approvalNotes

  const isOverDeposit = displayIsOverDeposit
  const netRefund = displayNetRefund
  const additionalDue = displayAdditionalDue
  const depositPaid = displayDepositPaid
  const totalDeduction = displayTotalDeduction

  // Chỉ cho phép khiếu nại khi tiền cọc thực sự bị khấu trừ hoặc có phát sinh chi phí bồi thường/sửa chữa
  const isDepositDeducted = settlement
    ? Number(totalDeduction) > 0 ||
      Number(additionalDue) > 0 ||
      (Number(depositPaid) > 0 && Number(netRefund) < Number(depositPaid)) ||
      Number(settlement.doorFee || 0) > 0 ||
      Number(settlement.cleaningFee || 0) > 0 ||
      Number(settlement.wallStructureFee || 0) > 0 ||
      Number(settlement.smartLockFee || 0) > 0 ||
      Number(settlement.lostCardFee || 0) > 0 ||
      Number(settlement.overdueDebt || 0) > 0 ||
      Number(settlement.damageFee || 0) > 0
    : false

  // 1. Customer agrees with refund -> Prompt confirmation dialog
  const handlePromptBankConfirm = (e: React.FormEvent) => {
    e.preventDefault()
    if (!bankAccountNumber.trim()) {
      toast.warning('Vui lòng nhập số tài khoản ngân hàng nhận tiền hoàn.')
      return
    }
    if (!bankAccountName.trim()) {
      toast.warning('Vui lòng nhập tên chủ tài khoản ngân hàng.')
      return
    }
    setBankDisclaimerChecked(false)
    setShowBankConfirmModal(true)
  }

  // 1.1 Customer confirms bank details & disclaimer -> Submit to Facility Manager
  const handleConfirmAndSubmitBank = async () => {
    if (!bankDisclaimerChecked) {
      toast.warning('Vui lòng đánh dấu xác nhận thông tin số tài khoản đã chính xác.')
      return
    }
    setSubmitting(true)
    try {
      await handoverService.submitCustomerDecision(bookingId, {
        decision: 'AGREED',
        settlementVersion: settlement?.settlementVersion,
        bankName,
        bankAccountNumber: bankAccountNumber.trim(),
        bankAccountName: bankAccountName.trim().toUpperCase()
      })
      toast.success(
        'Đã gửi thông tin tài khoản ngân hàng thành công! Quản lý cơ sở (Facility Manager) sẽ tiến hành kiểm tra và thực hiện chuyển tiền hoàn cọc cho bạn.'
      )
      setShowBankConfirmModal(false)
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
        settlementVersion: settlement?.settlementVersion,
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

  // 5. Customer cancels dispute
  const handleCancelDispute = async () => {
    const isConfirmed = window.confirm(
      'Bạn có chắc chắn muốn hủy yêu cầu khiếu nại này không?\n\nSau khi hủy, biên bản quyết toán sẽ trở về trạng thái chờ bạn phản hồi.'
    )
    if (!isConfirmed) return

    setSubmitting(true)
    try {
      await handoverService.cancelDispute(bookingId)
      toast.success('Đã hủy yêu cầu khiếu nại thành công!')
      setViewStep('VIEW')
      await fetchSettlement()
      if (onUpdated) onUpdated()
    } catch (err: any) {
      toast.error('Lỗi khi hủy khiếu nại: ' + (err?.response?.data?.message || err.message))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto">
      <div className="relative w-full max-w-xl sm:max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)] overflow-hidden my-auto animate-in zoom-in-95">
        {/* Header cố định */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 shrink-0 bg-white">
          <div className="flex items-center gap-2.5 text-indigo-700">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 leading-tight flex items-center gap-2 flex-wrap">
                <span>Biên Bản Nghiệm Thu &amp; Quyết Toán Trả Kho</span>
                {readOnly && (
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-bold tracking-wide">
                    Chỉ xem
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500 font-mono">
                Buồng kho #{settlement?.unitCode || '...'} • Mã đơn #{settlement?.bookingCode || '...'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center cursor-pointer transition shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Vùng body cuộn mượt mà chống tràn khi zoom in / zoom out */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0 space-y-4">

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
            {/* Selector chọn phiên bản nghiệm thu & quyết toán */}
            {snapshotsList.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-slate-50 via-indigo-50/40 to-slate-50 border border-indigo-100/90 shadow-2xs space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-indigo-600">history</span>
                    <span className="font-bold text-slate-800">
                      Lịch sử các phiên bản quyết toán ({snapshotsList.length} phiên bản)
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-indigo-700 bg-indigo-100/80 px-2.5 py-0.5 rounded-full font-bold">
                    Đang xem: Phiên bản V{currentViewingVersion} {isViewingLatestVersion ? '(Mới nhất)' : '(Lưu trữ cũ)'}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 pt-0.5">
                  {snapshotsList.map((s: SettlementSnapshot) => {
                    const isSelected = s.settlementVersion === currentViewingVersion
                    const isLatest = s.settlementVersion === (settlement.settlementVersion || 1)
                    return (
                      <button
                        key={s.id || s.settlementVersion}
                        type="button"
                        onClick={() => setSelectedVersion(s.settlementVersion)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25 ring-2 ring-indigo-400'
                            : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs'
                        }`}
                      >
                        <span className="font-mono">Phiên bản V{s.settlementVersion}</span>
                        {isLatest ? (
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                            isSelected ? 'bg-indigo-800 text-indigo-100' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            Mới nhất
                          </span>
                        ) : (
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                            isSelected ? 'bg-indigo-700 text-indigo-200' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {s.settlementVersion === 1 ? 'Ban đầu' : 'Cũ'}
                          </span>
                        )}
                        <span className="text-[11px] font-mono opacity-90">
                          {Number(s.refundAmount || 0) > 0
                            ? `• Hoàn ${Number(s.refundAmount || 0).toLocaleString('vi-VN')}đ`
                            : `• Trừ ${Number(s.totalDeductions || 0).toLocaleString('vi-VN')}đ`}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Trạng thái phiên bản đang xem */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded bg-indigo-100 text-indigo-800 font-bold font-mono text-[11px]">
                  Phiên bản V{currentViewingVersion}
                </span>
                <span className="text-slate-600">
                  Chốt bởi: <strong>{displayConfirmedByName}</strong>
                </span>
                {displayConfirmedAt && (
                  <span className="text-[11px] text-slate-400 font-mono">
                    ({new Date(displayConfirmedAt).toLocaleString('vi-VN')})
                  </span>
                )}
              </div>
              <div>
                {displayCustomerDecision === 'AGREED' ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px] flex items-center gap-1">
                    <CheckCircle2 size={12} /> Bạn đã đồng ý
                  </span>
                ) : displayCustomerDecision === 'DISPUTED' ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold text-[11px] flex items-center gap-1">
                    <AlertTriangle size={12} /> Đang khiếu nại (Chờ Quản lý Cơ sở)
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[11px]">
                    ⏳ Chờ bạn phản hồi
                  </span>
                )}
              </div>
            </div>

            {/* Banner Ghi chú giải trình điều chỉnh chi phí (nếu có ghi chú hoặc sai sót nhập liệu thừa/thiếu) */}
            {displayNotes && (
              <div className="p-3.5 rounded-xl bg-amber-50/90 border border-amber-300/80 text-xs text-amber-950 space-y-1 shadow-2xs">
                <div className="flex items-center gap-1.5 font-bold text-amber-950">
                  <span className="material-symbols-outlined text-[16px] text-amber-700">edit_note</span>
                  <span>Ghi chú giải trình điều chỉnh (Phiên bản V{currentViewingVersion}):</span>
                </div>
                <p className="text-[11px] leading-relaxed pl-5 whitespace-pre-line font-medium text-amber-900">
                  {displayNotes}
                </p>
              </div>
            )}

            {/* Cảnh báo khi người dùng đang xem phiên bản lưu trữ cũ */}
            {!isViewingLatestVersion && (
              <div className="p-3 rounded-xl bg-slate-100 border border-slate-300 text-xs flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-slate-700">
                  <span className="material-symbols-outlined text-[16px] text-slate-500">archive</span>
                  <span>Bạn đang xem biên bản lưu trữ phiên bản V{currentViewingVersion} (Chỉ xem).</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedVersion(settlement.settlementVersion || 1)}
                  className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] cursor-pointer shadow-xs transition"
                >
                  Xem phiên bản mới nhất (V{settlement.settlementVersion || 1})
                </button>
              </div>
            )}

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
                      <span className={`font-mono font-semibold ${displayDoorFee > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                        {displayDoorFee > 0 ? `-${displayDoorFee.toLocaleString('vi-VN')} ₫` : '0 ₫'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <span className="text-slate-600">3. Chi phí dọn dẹp &amp; vệ sinh kho:</span>
                      <span className={`font-mono font-semibold ${displayCleaningFee > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                        {displayCleaningFee > 0 ? `-${displayCleaningFee.toLocaleString('vi-VN')} ₫` : '0 ₫'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <span className="text-slate-600">4. Chi phí khắc phục hư hại vách / sàn / trần:</span>
                      <span className={`font-mono font-semibold ${displayWallStructureFee > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                        {displayWallStructureFee > 0 ? `-${displayWallStructureFee.toLocaleString('vi-VN')} ₫` : '0 ₫'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <span className="text-slate-600">5. Chi phí sửa chữa ổ khóa SmartLock IoT:</span>
                      <span className={`font-mono font-semibold ${displaySmartLockFee > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                        {displaySmartLockFee > 0 ? `-${displaySmartLockFee.toLocaleString('vi-VN')} ₫` : '0 ₫'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <span className="text-slate-600">6. Phí bồi thường mất thẻ từ / phụ kiện:</span>
                      <span className={`font-mono font-semibold ${displayLostCardFee > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                        {displayLostCardFee > 0 ? `-${displayLostCardFee.toLocaleString('vi-VN')} ₫` : '0 ₫'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <span className="text-slate-600">7. Công nợ / cước thuê trễ hạn (nếu có):</span>
                      <span className={`font-mono font-semibold ${displayOverdueDebt > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                        {displayOverdueDebt > 0 ? `-${displayOverdueDebt.toLocaleString('vi-VN')} ₫` : '0 ₫'}
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
                      Tiền cọc ban đầu đủ bù đắp các chi phí sửa chữa. Sau khi quý khách xác nhận đồng ý và cung cấp số tài khoản ngân hàng, Quản lý cơ sở (Facility Manager) sẽ tiến hành kiểm tra và thực hiện chuyển khoản hoàn tiền cọc cho bạn trong mục Xử lý hoàn tiền.
                    </p>
                  </div>
                )}
                {/* 3.1. HÌNH ẢNH BẰNG CHỨNG NGHIỆM THU HIỆN TRƯỜNG (BƯỚC 6) */}
                <div className="space-y-3 p-4 rounded-xl bg-slate-50 border border-slate-200/90 text-xs shadow-2xs">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="font-bold flex items-center gap-1.5 text-indigo-950">
                      <Camera size={16} className="text-indigo-600" />
                      <span>Hình ảnh kiểm tra &amp; nghiệm thu hiện trường (Bước 6)</span>
                    </div>
                    {evidencePhotosList.length > 0 ? (
                      <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-bold">
                        {evidencePhotosList.length} ảnh hiện trường
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">Chưa tải ảnh</span>
                    )}
                  </div>

                  {evidencePhotosList.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                      {evidencePhotosList.map((photoUrl, pIdx) => {
                        const resolvedUrl = resolveReceiptUrl(photoUrl)
                        return (
                          <div
                            key={pIdx}
                            onClick={() => setPreviewProofModal(resolvedUrl)}
                            className="group relative aspect-4/3 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shadow-2xs hover:shadow-md transition-all cursor-pointer"
                          >
                            <img
                              src={resolvedUrl}
                              alt={`Bằng chứng hiện trường ${pIdx + 1}`}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                              onError={(e) => {
                                const target = e.currentTarget
                                target.onerror = null
                                target.src = 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80'
                              }}
                            />
                            <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/40 flex items-center justify-center transition-colors">
                              <span className="material-symbols-outlined text-white text-[22px] opacity-0 group-hover:opacity-100 transition-opacity drop-shadow">
                                zoom_in
                              </span>
                            </div>
                            <div className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded bg-black/70 text-white font-mono text-[9px] font-bold">
                              Ảnh #{pIdx + 1}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="p-4 rounded-lg bg-white border border-dashed border-slate-200 text-center text-slate-400 space-y-1">
                      <Camera size={20} className="mx-auto text-slate-300" />
                      <p className="text-[11px]">Chưa có ảnh chụp hiện trường nào được ghi nhận ở bước 6.</p>
                    </div>
                  )}
                  {evidencePhotosList.length > 0 && (
                    <p className="text-[11px] text-slate-500 italic">
                      * Nhấp vào từng ảnh để phóng to xem chi tiết hiện trạng buồng kho khi nghiệm thu trả kho.
                    </p>
                  )}
                </div>


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
                              ✓ Quản lý cơ sở đã chuyển khoản hoàn tiền thành công! (Mã GD: {settlement.refundTransactionId || 'FT2630018942'})
                            </span>
                          ) : (
                            <span>
                              ⏳ Hồ sơ đang được chuyển trực tiếp cho Quản lý cơ sở (Facility Manager) để tiến hành lệnh chuyển khoản hoàn tiền trong mục Xử lý hoàn tiền.
                            </span>
                          )}
                        </div>

                        {settlement.refundStatus === 'REFUNDED' && settlement.transferProofUrl && (
                          <div className="pt-2.5 border-t border-slate-100 space-y-2">
                            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 space-y-2">
                              <div className="flex items-center justify-between text-xs font-bold text-emerald-900">
                                <span className="flex items-center gap-1.5">
                                  <CheckCircle2 size={15} className="text-emerald-600" />
                                  <span>Ảnh biên lai / UNC chuyển khoản hoàn tiền:</span>
                                </span>
                                <a
                                  href={resolveReceiptUrl(settlement.transferProofUrl)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-emerald-700 hover:text-emerald-800 text-[11px] underline flex items-center gap-1"
                                >
                                  <span>Mở ảnh gốc</span>
                                  <ExternalLink size={12} />
                                </a>
                              </div>
                              <div
                                className="relative h-44 rounded-lg overflow-hidden border border-emerald-300 bg-white cursor-pointer group shadow-2xs"
                                onClick={() => setPreviewProofModal(resolveReceiptUrl(settlement.transferProofUrl))}
                              >
                                <img
                                  src={resolveReceiptUrl(settlement.transferProofUrl)}
                                  alt="Biên lai chuyển khoản hoàn tiền"
                                  className="w-full h-full object-contain transition group-hover:scale-102"
                                />
                                <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition">
                                  🔍 Nhấp để xem kích thước lớn
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
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
                            {!readOnly && (
                              <button
                                type="button"
                                onClick={handleProceedVNPayCompensation}
                                disabled={submitting}
                                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
                              >
                                <CreditCard size={13} />
                                <span>Thanh toán VNPay Sandbox ngay</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {settlement.customerDecision === 'DISPUTED' && (
                  <div className="p-4 rounded-xl bg-rose-50 border border-rose-300 space-y-3 text-xs">
                    <div className="font-bold text-rose-900 flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <MessageSquareWarning size={16} className="text-rose-600" />
                        <span>Đơn khiếu nại của bạn đang chờ Quản lý cơ sở giải quyết</span>
                      </div>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-rose-200 space-y-1 text-slate-700">
                      <span className="text-slate-500 font-semibold text-[11px]">Nội dung khiếu nại đã gửi:</span>
                      <p className="italic font-medium">"{settlement.disputeReason || 'Khách hàng không đồng ý với khoản chi phí khấu trừ hiện tại.'}"</p>
                      {disputeEvidenceList.length > 0 && (
                        <div className="pt-1.5 border-t border-rose-100 space-y-1 text-[11px]">
                          <span className="text-slate-500 font-semibold">Minh chứng đính kèm:</span>
                          <div className="flex flex-col gap-1">
                            {disputeEvidenceList.map((url, uIdx) => (
                              <a
                                key={uIdx}
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-indigo-600 hover:text-indigo-700 underline font-mono font-medium truncate max-w-sm flex items-center gap-1"
                              >
                                <span>{url}</span>
                                <ExternalLink size={11} className="shrink-0" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    {settlement.disputeResolutionNote && (
                      <div className="bg-emerald-50 p-2.5 rounded-lg border border-emerald-200 space-y-1 text-emerald-950">
                        <span className="text-emerald-800 font-semibold text-[11px]">Phản hồi từ Quản lý cơ sở ({settlement.disputeResolvedByName}):</span>
                        <p className="font-medium">"{settlement.disputeResolutionNote}"</p>
                      </div>
                    )}
                    <p className="text-[11px] text-rose-800">
                      Chỉ Quản lý cơ sở mới có thẩm quyền phân xử đơn khiếu nại này. Vui lòng chờ nhân viên liên hệ hoặc theo dõi kết quả tại đây.
                    </p>

                    {/* Button Hủy yêu cầu khiếu nại */}
                    {!readOnly && !settlement.disputeResolutionNote && (
                      <div className="pt-2 border-t border-rose-200 flex flex-col sm:flex-row items-center justify-between gap-2">
                        <span className="text-[11px] text-slate-500 italic">
                          Bạn có thể rút lại khiếu nại nếu muốn đồng ý quyết toán hoặc cập nhật lại.
                        </span>
                        <button
                          type="button"
                          onClick={handleCancelDispute}
                          disabled={submitting}
                          className="w-full sm:w-auto px-4 py-2 rounded-xl bg-white hover:bg-rose-100 border border-rose-300 text-rose-700 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs transition disabled:opacity-50 hover:shadow-xs"
                        >
                          <Undo2 size={14} className={submitting ? 'animate-spin' : ''} />
                          <span>{submitting ? 'Đang hủy khiếu nại...' : 'Hủy yêu cầu khiếu nại'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* HAI BUTTON CHÍNH NẾU ĐANG CHỜ PHẢN HỒI (PENDING) - CHỈ HIỂN THỊ KHI KHÔNG PHẢI READ-ONLY VÀ ĐANG Ở BẢN MỚI NHẤT */}
                {!readOnly && isViewingLatestVersion && (!settlement.customerDecision || settlement.customerDecision === 'PENDING') && (
                  <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-end gap-2.5">
                    {isDepositDeducted && (
                      <button
                        type="button"
                        onClick={() => setViewStep('FORM_DISPUTE')}
                        className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-rose-300 bg-white hover:bg-rose-50 text-rose-700 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition shadow-2xs"
                      >
                        <MessageSquareWarning size={15} />
                        <span>Khiếu nại kết quả</span>
                      </button>
                    )}

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

                {/* FOOTER CHỈ XEM DÀNH CHO CÁC ĐƠN CŨ HOẶC KHI ĐANG XEM BẢN LƯU TRỮ CŨ */}
                {(readOnly || !isViewingLatestVersion) && (
                  <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/80 -mx-6 -mb-6 p-4 rounded-b-2xl">
                    <div className="flex items-center gap-2 text-slate-600 text-xs">
                      <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                        <Info size={14} />
                      </div>
                      <span className="leading-relaxed">
                        Biên bản lưu trữ ở chế độ <strong>Chỉ xem</strong>. Quyết định xác nhận nhận tiền hoàn hoặc khiếu nại chỉ thực hiện trên đơn quyết toán mới nhất sau khi tính toán lại.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={onClose}
                      className="w-full sm:w-auto px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition active:scale-98 cursor-pointer shrink-0"
                    >
                      Đóng
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* FORM 1: NHẬP THÔNG TIN NGÂN HÀNG KHI ĐỒNG Ý HOÀN TIỀN */}
            {viewStep === 'FORM_BANK' && (
              <form onSubmit={handlePromptBankConfirm} className="space-y-4 text-xs">
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                    <Building2 size={15} />
                    <span>Cung cấp số tài khoản nhận tiền hoàn cọc ({netRefund.toLocaleString('vi-VN')} ₫)</span>
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    Sau khi bạn xác nhận, thông tin tài khoản ngân hàng sẽ được chuyển trực tiếp cho <strong>Quản lý cơ sở (Facility Manager)</strong> để tiến hành đối soát và thực hiện lệnh chuyển khoản hoàn tiền.
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
                    <span>{submitting ? 'Đang xử lý...' : 'Tiếp Tục & Xác Nhận Tài Khoản'}</span>
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

      {/* MODAL XÁC NHẬN LẠI THÔNG TIN TÀI KHOẢN NGÂN HÀNG & MIỄN TRỪ TRÁCH NHIỆM */}
      {showBankConfirmModal && (
        <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95">
            <div className="flex items-start gap-3 pb-3 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 leading-tight">
                  Xác Nhận Thông Tin Chuyển Khoản Hoàn Cọc
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Vui lòng đối soát kỹ thông tin người thụ hưởng trước khi gửi lên Quản lý cơ sở.
                </p>
              </div>
            </div>

            {/* Chi tiết thông tin chuyển khoản */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Ngân hàng thụ hưởng:</span>
                <span className="font-bold text-slate-900">{bankName}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Số tài khoản nhận tiền:</span>
                <span className="font-mono font-extrabold text-blue-700 text-sm tracking-wider">
                  {bankAccountNumber.trim()}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Tên chủ tài khoản:</span>
                <span className="font-bold text-slate-900 uppercase">
                  {bankAccountName.trim().toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500">Số tiền hoàn cọc nhận:</span>
                <span className="font-mono font-extrabold text-emerald-700 text-sm">
                  {netRefund.toLocaleString('vi-VN')} ₫
                </span>
              </div>
            </div>

            {/* Khối cảnh báo miễn trừ trách nhiệm */}
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-950 space-y-1.5 text-xs">
              <div className="font-bold flex items-center gap-1.5 text-rose-900 text-[11px] uppercase tracking-wide">
                <AlertTriangle size={14} className="text-rose-600 shrink-0" />
                <span>Cảnh báo quan trọng về tài khoản thụ hưởng:</span>
              </div>
              <p className="text-[11px] text-rose-800 leading-relaxed">
                Quý khách vui lòng kiểm tra thật kỹ từng ký tự Số tài khoản và Tên chủ tài khoản. Boxora sẽ tiến hành lệnh chuyển khoản hoàn tiền trực tiếp theo đúng thông tin quý khách cung cấp tại đây.
              </p>
              <p className="text-[11px] text-rose-900 font-bold leading-relaxed">
                Trường hợp có sai sót về số tài khoản hoặc thông tin người thụ hưởng từ phía quý khách dẫn đến việc chuyển nhầm người nhận hoặc thất thoát, cơ sở lưu trữ Boxora hoàn toàn không chịu trách nhiệm.
              </p>
            </div>

            {/* Checkbox cam kết */}
            <label className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-slate-50 cursor-pointer select-none text-xs">
              <input
                type="checkbox"
                checked={bankDisclaimerChecked}
                onChange={(e) => setBankDisclaimerChecked(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
              />
              <span className="text-[11px] text-slate-700 font-medium leading-snug">
                Tôi đã kiểm tra kỹ và xác nhận số tài khoản ngân hàng trên là chính xác. Tôi chịu hoàn toàn trách nhiệm về tính chính xác của thông tin này.
              </span>
            </label>

            {/* Action buttons */}
            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowBankConfirmModal(false)}
                disabled={submitting}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-xs cursor-pointer hover:bg-slate-50"
              >
                Kiểm tra lại
              </button>
              <button
                type="button"
                onClick={handleConfirmAndSubmitBank}
                disabled={!bankDisclaimerChecked || submitting}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition"
              >
                <CheckCircle2 size={15} />
                <span>{submitting ? 'Đang gửi...' : 'Xác Nhận & Gửi Cho Quản Lý Cơ Sở'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal xem phóng to ảnh biên lai chuyển khoản */}
      {previewProofModal && (
        <div
          className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setPreviewProofModal(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full p-4 shadow-2xl border border-slate-200 space-y-3 cursor-default animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                <Camera size={15} className="text-indigo-600" />
                <span>Xem Phóng To Hình Ảnh / Bằng Chứng Đối Soát Boxora</span>
              </span>
              <button
                type="button"
                onClick={() => setPreviewProofModal(null)}
                className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>
            <div className="rounded-xl overflow-hidden bg-slate-950 flex items-center justify-center max-h-[75vh]">
              <img
                src={previewProofModal}
                alt="Phóng to biên lai"
                className="max-h-[75vh] w-auto object-contain"
              />
            </div>
            <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
              <span>Được ghi nhận trực tiếp từ Quản lý Boxora</span>
              <button
                type="button"
                onClick={() => setPreviewProofModal(null)}
                className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
