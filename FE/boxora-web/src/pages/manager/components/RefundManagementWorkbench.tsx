import React, { useState, useEffect, useMemo, useRef } from 'react'
import { refundService, RefundRequestItem, RefundStatusType } from '../../../services/refundService'
import { toast } from '../../../utils/toast'

interface RefundManagementWorkbenchProps {
  facilityId?: string
  facilityName?: string
}

export const RefundManagementWorkbench: React.FC<RefundManagementWorkbenchProps> = ({
  facilityId,
  facilityName
}) => {
  const [refunds, setRefunds] = useState<RefundRequestItem[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [selectedRefund, setSelectedRefund] = useState<RefundRequestItem | null>(null)

  // Action Modals
  const [isProcessModalOpen, setIsProcessModalOpen] = useState<boolean>(false)
  const [isRejectModalOpen, setIsRejectModalOpen] = useState<boolean>(false)
  const [isViewProofModalOpen, setIsViewProofModalOpen] = useState<boolean>(false)

  // Form State for Process Transfer
  const [transactionReference, setTransactionReference] = useState<string>('')
  const [recipientEmail, setRecipientEmail] = useState<string>('')
  const [processNotes, setProcessNotes] = useState<string>('')
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [proofPreviewUrl, setProofPreviewUrl] = useState<string>('')
  const [uploadedProofUrl, setUploadedProofUrl] = useState<string>('')
  const [isUploadingProof, setIsUploadingProof] = useState<boolean>(false)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Form State for Reject
  const [rejectionReason, setRejectionReason] = useState<string>('')

  const fetchRefunds = async () => {
    try {
      setLoading(true)
      const data = await refundService.getAll({
        facilityId: facilityId && facilityId !== 'ALL' ? facilityId : undefined
      })
      if (data && Array.isArray(data.content)) {
        setRefunds(data.content)
      } else if (Array.isArray(data)) {
        setRefunds(data)
      } else {
        setRefunds([])
      }
    } catch (err: any) {
      console.error('Failed to load refund requests', err)
      toast.error('Không thể nạp danh sách yêu cầu hoàn tiền: ' + (err?.response?.data?.message || err.message))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRefunds()
  }, [facilityId])

  // Copy to clipboard helper
  const copyToClipboard = (text: string, label: string) => {
    if (!text) return
    navigator.clipboard.writeText(text).then(() => {
      toast.success(`Đã sao chép ${label}: ${text}`)
    }).catch(() => {
      toast.error('Không thể sao chép vào bộ nhớ đệm')
    })
  }

  // Open Process Modal
  const handleOpenProcess = (refund: RefundRequestItem) => {
    setSelectedRefund(refund)
    setTransactionReference('')
    setRecipientEmail(refund.customerEmail || '')
    setProcessNotes('')
    setProofFile(null)
    setProofPreviewUrl('')
    setUploadedProofUrl(refund.transferProofUrl || '')
    setIsProcessModalOpen(true)
  }

  // Open Reject Modal
  const handleOpenReject = (refund: RefundRequestItem) => {
    setSelectedRefund(refund)
    setRejectionReason('')
    setIsRejectModalOpen(true)
  }

  // Open View Proof Modal
  const handleOpenViewProof = (refund: RefundRequestItem) => {
    setSelectedRefund(refund)
    setIsViewProofModalOpen(true)
  }

  // Handle file select & auto upload
  const handleProofFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Vui lòng chọn tệp hình ảnh hợp lệ (PNG, JPG, WEBP)')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Kích thước ảnh không được vượt quá 10MB')
      return
    }

    setProofFile(file)
    const localUrl = URL.createObjectURL(file)
    setProofPreviewUrl(localUrl)

    try {
      setIsUploadingProof(true)
      const uploadedUrl = await refundService.uploadProof(file)
      setUploadedProofUrl(uploadedUrl)
      toast.success('Đã tải ảnh biên lai thành công')
    } catch (err: any) {
      console.error('Upload proof failed', err)
      toast.error('Lỗi khi tải ảnh lên máy chủ: ' + (err?.response?.data?.message || err.message))
    } finally {
      setIsUploadingProof(false)
    }
  }

  // Submit Process Transfer
  const handleSubmitProcess = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedRefund) return

    if (!transactionReference.trim()) {
      toast.error('Vui lòng nhập Mã giao dịch ngân hàng / Số tham chiếu UNC')
      return
    }

    if (!uploadedProofUrl && !proofFile) {
      toast.error('Vui lòng tải lên ảnh chụp biên lai chuyển khoản / ủy nhiệm chi')
      return
    }

    try {
      setIsSubmitting(true)

      let finalProofUrl = uploadedProofUrl
      if (proofFile && !finalProofUrl) {
        finalProofUrl = await refundService.uploadProof(proofFile)
        setUploadedProofUrl(finalProofUrl)
      }

      await refundService.processRefund(selectedRefund.id, {
        transactionReference: transactionReference.trim(),
        processNotes: processNotes.trim(),
        transferProofUrl: finalProofUrl,
        recipientEmail: recipientEmail.trim()
      })

      // Đồng bộ localStorage và giải phóng trạng thái giữ buồng kho
      try {
        const rawRes = localStorage.getItem('boxora_guest_reservations')
        if (rawRes) {
          const list = JSON.parse(rawRes)
          if (Array.isArray(list)) {
            const updated = list.map((item: any) => {
              const match =
                (selectedRefund.bookingCode && item.bookingCode === selectedRefund.bookingCode) ||
                (selectedRefund.bookingId && (item.id === selectedRefund.bookingId || item.backendBookingId === selectedRefund.bookingId))
              if (match) {
                return {
                  ...item,
                  status: 'CANCELLED',
                  paymentStatus: 'REFUNDED',
                  refundStatus: 'AWAITING_CUSTOMER_CONFIRMATION'
                }
              }
              return item
            })
            localStorage.setItem('boxora_guest_reservations', JSON.stringify(updated))
          }
        }
      } catch (storageErr) {
        console.warn('Sync boxora_guest_reservations error:', storageErr)
      }

      // Phát các sự kiện toàn hệ thống để cập nhật lại số lượng buồng kho còn trống
      window.dispatchEvent(new CustomEvent('boxora:storage-units-refresh'))
      window.dispatchEvent(new CustomEvent('boxora_reservation_status_changed'))
      window.dispatchEvent(new CustomEvent('boxora_reservation_updated', {
        detail: { bookingCode: selectedRefund.bookingCode, status: 'CANCELLED' }
      }))
      window.dispatchEvent(new CustomEvent('boxora_rental_updated'))
      window.dispatchEvent(new Event('boxora:notifications-refresh'))

      toast.success(`Đã xác nhận chuyển tiền ${formatVND(selectedRefund.finalRefundAmount)} cho khách hàng! Số lượng buồng kho đã được giải phóng.`)
      setIsProcessModalOpen(false)
      setSelectedRefund(null)
      fetchRefunds()
    } catch (err: any) {
      console.error('Failed to process refund', err)
      toast.error('Lỗi khi xác nhận hoàn tiền: ' + (err?.response?.data?.message || err.message))
    } finally {
      setIsSubmitting(false)
    }
  }

  // Submit Rejection
  const handleSubmitReject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedRefund) return

    if (!rejectionReason.trim()) {
      toast.error('Vui lòng nhập lý do từ chối yêu cầu')
      return
    }

    try {
      setIsSubmitting(true)
      await refundService.reviewRefund(selectedRefund.id, {
        action: 'REJECT',
        approved: false,
        rejectionReason: rejectionReason.trim(),
        reviewNote: rejectionReason.trim(),
        reviewNotes: rejectionReason.trim()
      })

      window.dispatchEvent(new CustomEvent('boxora_reservation_updated', {
        detail: { bookingCode: selectedRefund.bookingCode, status: 'REJECTED' }
      }))
      window.dispatchEvent(new Event('boxora:notifications-refresh'))

      toast.info(`Đã từ chối yêu cầu hoàn tiền #${selectedRefund.requestCode}`)
      setIsRejectModalOpen(false)
      setSelectedRefund(null)
      fetchRefunds()
    } catch (err: any) {
      console.error('Failed to reject refund', err)
      toast.error('Lỗi khi từ chối yêu cầu: ' + (err?.response?.data?.message || err.message))
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatVND = (amount?: number) => {
    if (typeof amount !== 'number') return '0 ₫'
    return `${amount.toLocaleString('vi-VN')} ₫`
  }

  const formatDate = (isoStr?: string) => {
    if (!isoStr) return 'N/A'
    try {
      const d = new Date(isoStr)
      return d.toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
    } catch {
      return isoStr
    }
  }

  // Filtered List
  const filteredRefunds = useMemo(() => {
    return refunds.filter(item => {
      // Status Filter
      if (statusFilter === 'PENDING') {
        if (item.status !== 'PENDING_REVIEW' && item.status !== 'APPROVED') return false
      } else if (statusFilter === 'PROCESSED') {
        if (
          item.status !== 'AWAITING_CUSTOMER_CONFIRMATION' &&
          item.status !== 'PROCESSED' &&
          item.status !== 'COMPLETED' &&
          item.status !== 'RECONCILED'
        ) {
          return false
        }
      } else if (statusFilter === 'REJECTED') {
        if (item.status !== 'REJECTED') return false
      }

      // Search Filter
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim()
        const matchCode = item.requestCode?.toLowerCase().includes(query)
        const matchBooking = item.bookingCode?.toLowerCase().includes(query)
        const matchName = item.customerName?.toLowerCase().includes(query)
        const matchPhone = item.customerPhone?.toLowerCase().includes(query)
        const matchBankAcc = item.bankAccountNumber?.toLowerCase().includes(query)
        const matchBankName = item.bankName?.toLowerCase().includes(query)
        if (!matchCode && !matchBooking && !matchName && !matchPhone && !matchBankAcc && !matchBankName) {
          return false
        }
      }

      return true
    })
  }, [refunds, statusFilter, searchTerm])

  // KPIs
  const kpiPendingCount = useMemo(() => {
    return refunds.filter(r => r.status === 'PENDING_REVIEW' || r.status === 'APPROVED').length
  }, [refunds])

  const kpiPendingAmount = useMemo(() => {
    return refunds
      .filter(r => r.status === 'PENDING_REVIEW' || r.status === 'APPROVED')
      .reduce((sum, r) => sum + (r.finalRefundAmount || 0), 0)
  }, [refunds])

  const kpiCompletedCount = useMemo(() => {
    return refunds.filter(
      r =>
        r.status === 'AWAITING_CUSTOMER_CONFIRMATION' ||
        r.status === 'PROCESSED' ||
        r.status === 'COMPLETED' ||
        r.status === 'RECONCILED'
    ).length
  }, [refunds])

  const kpiTotalCompletedAmount = useMemo(() => {
    return refunds
      .filter(
        r =>
          r.status === 'AWAITING_CUSTOMER_CONFIRMATION' ||
          r.status === 'PROCESSED' ||
          r.status === 'COMPLETED' ||
          r.status === 'RECONCILED'
      )
      .reduce((sum, r) => sum + (r.finalRefundAmount || 0), 0)
  }, [refunds])

  const getStatusBadge = (status: RefundStatusType) => {
    switch (status) {
      case 'PENDING_REVIEW':
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            Chờ Quản Lý Chuyển Tiền
          </span>
        )
      case 'AWAITING_CUSTOMER_CONFIRMATION':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            Đã Chuyển Tiền (Chờ khách đối soát)
          </span>
        )
      case 'PROCESSED':
      case 'COMPLETED':
      case 'RECONCILED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Đã Hoàn Tiền Thành Công
          </span>
        )
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            Từ Chối Hoàn Tiền
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            {status}
          </span>
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
                <span className="material-symbols-outlined text-2xl">account_balance</span>
              </span>
              <div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  Quản Lý Hoàn Tiền Hủy Đặt Chỗ Kho
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Kiểm tra số tài khoản ngân hàng khách hàng, thực hiện chuyển tiền hoàn cọc và tải ảnh chứng từ ủy nhiệm chi
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchRefunds}
              disabled={loading}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition disabled:opacity-50 cursor-pointer"
              title="Làm mới danh sách"
            >
              <span className={`material-symbols-outlined text-[18px] ${loading ? 'animate-spin' : ''}`}>
                refresh
              </span>
              <span>Làm mới</span>
            </button>
          </div>
        </div>

        {/* METRICS / KPIS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100">
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">Chờ Chuyển Tiền</span>
              <span className="material-symbols-outlined text-amber-600">hourglass_top</span>
            </div>
            <div className="text-2xl font-black text-amber-900 mt-2">{kpiPendingCount} đơn</div>
            <div className="text-xs text-amber-700 mt-1 font-medium">Cần xử lý thanh toán chuyển khoản</div>
          </div>

          <div className="bg-orange-50/70 border border-orange-200/80 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-orange-800 uppercase tracking-wider">Tiền Chờ Hoàn</span>
              <span className="material-symbols-outlined text-orange-600">payments</span>
            </div>
            <div className="text-2xl font-black text-orange-900 mt-2">{formatVND(kpiPendingAmount)}</div>
            <div className="text-xs text-orange-700 mt-1 font-medium">Tổng tiền cọc hoàn cho khách</div>
          </div>

          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Đã Giải Ngân Hoàn Tiền</span>
              <span className="material-symbols-outlined text-emerald-600">verified</span>
            </div>
            <div className="text-2xl font-black text-emerald-900 mt-2">{kpiCompletedCount} đơn</div>
            <div className="text-xs text-emerald-700 mt-1 font-medium">Đã tải ảnh biên lai chuyển tiền</div>
          </div>

          <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-800 uppercase tracking-wider">Tổng Tiền Đã Hoàn</span>
              <span className="material-symbols-outlined text-blue-600">account_balance_wallet</span>
            </div>
            <div className="text-2xl font-black text-blue-900 mt-2">{formatVND(kpiTotalCompletedAmount)}</div>
            <div className="text-xs text-blue-700 mt-1 font-medium">Tổng giải ngân thành công</div>
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              statusFilter === 'ALL'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Tất cả ({refunds.length})
          </button>
          <button
            onClick={() => setStatusFilter('PENDING')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1 ${
              statusFilter === 'PENDING'
                ? 'bg-amber-600 text-white'
                : 'text-amber-800 bg-amber-50 hover:bg-amber-100'
            }`}
          >
            <span>Chờ Chuyển Tiền</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/30 font-black">{kpiPendingCount}</span>
          </button>
          <button
            onClick={() => setStatusFilter('PROCESSED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1 ${
              statusFilter === 'PROCESSED'
                ? 'bg-emerald-600 text-white'
                : 'text-emerald-800 bg-emerald-50 hover:bg-emerald-100'
            }`}
          >
            <span>Đã Chuyển Tiền</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/30 font-black">{kpiCompletedCount}</span>
          </button>
          <button
            onClick={() => setStatusFilter('REJECTED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              statusFilter === 'REJECTED'
                ? 'bg-rose-600 text-white'
                : 'text-rose-800 bg-rose-50 hover:bg-rose-100'
            }`}
          >
            Đã Từ Chối
          </button>
        </div>

        <div className="w-full md:w-80 relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
            search
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Tìm mã đơn, tên, SĐT, STK..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
          />
        </div>
      </div>

      {/* TABLE DATA LIST */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <span className="material-symbols-outlined text-4xl animate-spin text-amber-500 mb-2">
              sync
            </span>
            <p className="text-sm font-medium">Đang nạp danh sách yêu cầu hoàn tiền...</p>
          </div>
        ) : filteredRefunds.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">
              inbox
            </span>
            <p className="text-sm font-bold text-slate-700">Không tìm thấy yêu cầu hoàn tiền nào</p>
            <p className="text-xs text-slate-400 mt-1">
              {searchTerm
                ? 'Không có kết quả phù hợp với từ khóa tìm kiếm.'
                : 'Hiện chưa có đơn khách hủy cọc nào cần xử lý.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Mã Đơn &amp; Thời Gian</th>
                  <th className="py-3.5 px-4">Khách Hàng</th>
                  <th className="py-3.5 px-4">Số Tiền Hoàn</th>
                  <th className="py-3.5 px-4">Tài Khoản Thụ Hưởng (Chuyển Tiền)</th>
                  <th className="py-3.5 px-4">Trạng Thái</th>
                  <th className="py-3.5 px-4 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredRefunds.map(refund => {
                  const isPending = refund.status === 'PENDING_REVIEW' || refund.status === 'APPROVED'
                  const isDone =
                    refund.status === 'AWAITING_CUSTOMER_CONFIRMATION' ||
                    refund.status === 'PROCESSED' ||
                    refund.status === 'COMPLETED' ||
                    refund.status === 'RECONCILED'

                  return (
                    <tr key={refund.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Booking Code & Time */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="font-mono font-bold text-indigo-700 text-sm">
                          #{refund.bookingCode || 'N/A'}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {refund.requestCode}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px] text-slate-400">schedule</span>
                          <span>{formatDate(refund.createdAt)}</span>
                        </div>
                      </td>

                      {/* Customer Details */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="font-bold text-slate-900">{refund.customerName || 'Khách hàng'}</div>
                        <div className="text-[11px] text-slate-600 mt-0.5 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px] text-slate-400">call</span>
                          <span>{refund.customerPhone || 'N/A'}</span>
                        </div>
                        {refund.reason && (
                          <div className="text-[11px] text-slate-500 italic mt-1 bg-slate-50 rounded p-1 border border-slate-100 max-w-xs">
                            "{refund.reason}"
                          </div>
                        )}
                      </td>

                      {/* Refund Amount */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="font-black text-amber-700 text-sm">
                          {formatVND(refund.finalRefundAmount)}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Tổng đã đóng: {formatVND(refund.requestedAmount)}
                        </div>
                        {refund.deductionAmount > 0 && (
                          <div className="text-[10px] text-rose-600">
                            Khấu trừ: -{formatVND(refund.deductionAmount)}
                          </div>
                        )}
                      </td>

                      {/* Bank Details (HIGHLIGHTED & ONE-CLICK COPY) */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="bg-indigo-50/60 border border-indigo-200/80 rounded-xl p-2.5 max-w-xs shadow-2xs">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[11px] font-bold text-indigo-950 uppercase truncate" title={refund.bankName}>
                              {refund.bankName || 'Ngân hàng'}
                            </span>
                            <span className="material-symbols-outlined text-indigo-600 text-[16px]">
                              credit_card
                            </span>
                          </div>

                          <div className="mt-1.5 flex items-center justify-between gap-2 bg-white px-2 py-1.5 rounded-lg border border-indigo-200">
                            <span className="font-mono font-black text-slate-900 text-sm tracking-wider select-all">
                              {refund.bankAccountNumber || '---'}
                            </span>
                            <button
                              onClick={() => copyToClipboard(refund.bankAccountNumber, 'Số tài khoản')}
                              className="p-1 rounded hover:bg-indigo-100 text-indigo-700 transition cursor-pointer"
                              title="Sao chép số tài khoản"
                            >
                              <span className="material-symbols-outlined text-[16px]">content_copy</span>
                            </button>
                          </div>

                          <div className="mt-1 text-[11px] font-semibold text-indigo-900 uppercase truncate">
                            {refund.bankAccountName || '---'}
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 align-top">
                        <div>{getStatusBadge(refund.status)}</div>
                        {refund.transactionReference && (
                          <div className="mt-1.5 text-[11px] font-mono text-slate-600 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[13px] text-slate-400">receipt</span>
                            <span>Mã GD: {refund.transactionReference}</span>
                          </div>
                        )}
                        {refund.processedByName && (
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Bởi: {refund.processedByName}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 align-top text-right">
                        <div className="flex flex-col items-end gap-1.5">
                          {isPending && (
                            <>
                              <button
                                onClick={() => handleOpenProcess(refund)}
                                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[16px]">payments</span>
                                <span>Chuyển tiền &amp; Tải ảnh</span>
                              </button>

                              <button
                                onClick={() => handleOpenReject(refund)}
                                className="w-full sm:w-auto inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 transition cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[14px]">cancel</span>
                                <span>Từ chối</span>
                              </button>
                            </>
                          )}

                          {isDone && (
                            <button
                              onClick={() => handleOpenViewProof(refund)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 transition cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[16px]">visibility</span>
                              <span>Xem chứng từ UNC</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: PROCESS TRANSFER (CHUYỂN KHOẢN & TẢI ẢNH ỦY NHIỆM CHI) */}
      {isProcessModalOpen && selectedRefund && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-xl w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200">
                  <span className="material-symbols-outlined text-2xl">price_check</span>
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Xác Nhận Đã Chuyển Khoản Hoàn Tiền
                  </h3>
                  <p className="text-xs text-slate-500">
                    Đơn hủy #{selectedRefund.bookingCode} • Hoàn cọc {formatVND(selectedRefund.finalRefundAmount)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsProcessModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* BENEFICIARY BANK BOX */}
            <div className="mt-5 p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200">
              <div className="text-xs font-bold text-indigo-900 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Thông tin thụ hưởng ngân hàng của khách</span>
                <span className="text-[11px] font-normal text-indigo-700">Sao chép để chuyển khoản</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-indigo-600 text-[11px]">Ngân hàng:</span>
                  <div className="font-bold text-slate-900 mt-0.5">{selectedRefund.bankName}</div>
                </div>

                <div>
                  <span className="text-indigo-600 text-[11px]">Chủ tài khoản:</span>
                  <div className="font-bold text-slate-900 uppercase mt-0.5">{selectedRefund.bankAccountName}</div>
                </div>

                <div className="sm:col-span-2 bg-white p-2.5 rounded-xl border border-indigo-200 flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Số tài khoản chuyển</span>
                    <div className="font-mono font-black text-indigo-700 text-base select-all">
                      {selectedRefund.bankAccountNumber}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(selectedRefund.bankAccountNumber, 'Số tài khoản')}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[15px]">content_copy</span>
                    <span>Sao chép STK</span>
                  </button>
                </div>

                <div className="sm:col-span-2 bg-amber-50 p-2.5 rounded-xl border border-amber-200 flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] text-amber-800 uppercase font-semibold">Số tiền cần chuyển hoàn</span>
                    <div className="font-black text-amber-900 text-lg">
                      {formatVND(selectedRefund.finalRefundAmount)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(String(selectedRefund.finalRefundAmount), 'Số tiền')}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[15px]">content_copy</span>
                    <span>Sao chép số tiền</span>
                  </button>
                </div>
              </div>
            </div>

            {/* FORM INPUTS */}
            <form onSubmit={handleSubmitProcess} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Mã giao dịch ngân hàng / Số tham chiếu UNC <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={transactionReference}
                  onChange={e => setTransactionReference(e.target.value)}
                  placeholder="Ví dụ: VCB20261028123456 hoặc FT261099238..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {/* PROOF IMAGE UPLOAD */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Ảnh chụp biên lai chuyển tiền / Ủy nhiệm chi <span className="text-rose-500">*</span>
                </label>
                <div className="border-2 border-dashed border-slate-300 rounded-2xl p-4 text-center hover:border-emerald-400 transition bg-slate-50/50">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleProofFileChange}
                    className="hidden"
                    id="transfer-proof-file"
                  />

                  {proofPreviewUrl || uploadedProofUrl ? (
                    <div className="space-y-3">
                      <div className="relative inline-block max-h-56 overflow-hidden rounded-xl border border-slate-200 shadow-xs">
                        <img
                          src={proofPreviewUrl || uploadedProofUrl}
                          alt="Biên lai chuyển khoản"
                          className="max-h-56 w-auto object-contain rounded-xl"
                        />
                        {isUploadingProof && (
                          <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center text-white text-xs font-bold gap-2">
                            <span className="material-symbols-outlined animate-spin text-lg">sync</span>
                            <span>Đang tải ảnh lên...</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-center gap-2">
                        <label
                          htmlFor="transfer-proof-file"
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 cursor-pointer transition"
                        >
                          Chọn ảnh khác
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setProofFile(null)
                            setProofPreviewUrl('')
                            setUploadedProofUrl('')
                            if (fileInputRef.current) fileInputRef.current.value = ''
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 cursor-pointer transition"
                        >
                          Xóa ảnh
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label
                      htmlFor="transfer-proof-file"
                      className="cursor-pointer flex flex-col items-center justify-center gap-1.5 py-4"
                    >
                      <span className="flex items-center justify-center w-12 h-12 rounded-full bg-emerald-50 text-emerald-600">
                        <span className="material-symbols-outlined text-2xl">add_photo_alternate</span>
                      </span>
                      <span className="text-xs font-bold text-slate-700">
                        Nhấn để chọn ảnh chụp màn hình chuyển khoản
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Hỗ trợ PNG, JPG, JPEG (Tối đa 10MB)
                      </span>
                    </label>
                  )}
                </div>
              </div>

              {/* RECIPIENT EMAIL */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Email nhận xác nhận hoàn tiền của khách
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-[18px]">email</span>
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={e => setRecipientEmail(e.target.value)}
                    placeholder="VD: khachhang@gmail.com..."
                    className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Hệ thống sẽ gửi email thông báo kèm ảnh biên nhận chuyển khoản tới địa chỉ này ngay sau khi xác nhận.
                </p>
              </div>

              {/* PROCESS NOTES */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Ghi chú xử lý (Tùy chọn)
                </label>
                <textarea
                  rows={2}
                  value={processNotes}
                  onChange={e => setProcessNotes(e.target.value)}
                  placeholder="Ghi chú thêm về giao dịch hoàn tiền..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {/* ACTION BUTTONS */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsProcessModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || isUploadingProof || (!uploadedProofUrl && !proofFile)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {isSubmitting ? (
                    <>
                      <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">check_circle</span>
                      <span>Xác nhận đã chuyển tiền</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: REJECT REFUND */}
      {isRejectModalOpen && selectedRefund && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 text-rose-600">
                <span className="material-symbols-outlined">cancel</span>
                <span>Từ Chối Yêu Cầu Hoàn Tiền</span>
              </h3>
              <button
                onClick={() => setIsRejectModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <p className="text-xs text-slate-600 mt-3">
              Bạn có chắc chắn muốn từ chối yêu cầu hoàn tiền cho đơn <strong>#{selectedRefund.bookingCode}</strong> ({formatVND(selectedRefund.finalRefundAmount)})?
            </p>

            <form onSubmit={handleSubmitReject} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Lý do từ chối <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  placeholder="Nhập lý do chi tiết từ chối yêu cầu hoàn tiền..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRejectModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !rejectionReason.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {isSubmitting ? 'Đang xử lý...' : 'Xác nhận từ chối'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: VIEW PROOF & TRANSACTION DETAILS */}
      {isViewProofModalOpen && selectedRefund && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 text-indigo-700">
                <span className="material-symbols-outlined">receipt_long</span>
                <span>Chứng Từ Chuyển Khoản Hoàn Tiền</span>
              </h3>
              <button
                onClick={() => setIsViewProofModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 text-[11px]">Mã đơn đặt chỗ:</span>
                  <div className="font-mono font-bold text-slate-900">#{selectedRefund.bookingCode}</div>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px]">Số tiền hoàn:</span>
                  <div className="font-bold text-emerald-700">{formatVND(selectedRefund.finalRefundAmount)}</div>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px]">Mã giao dịch / UNC:</span>
                  <div className="font-mono font-bold text-indigo-700">{selectedRefund.transactionReference || 'N/A'}</div>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px]">Người xử lý:</span>
                  <div className="font-semibold text-slate-800">{selectedRefund.processedByName || 'Quản lý cơ sở'}</div>
                </div>
              </div>

              {selectedRefund.transferProofUrl ? (
                <div>
                  <span className="text-slate-500 font-semibold block mb-1.5">Ảnh chụp biên lai chuyển tiền:</span>
                  <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-100 text-center">
                    <img
                      src={selectedRefund.transferProofUrl}
                      alt="Biên lai chuyển tiền"
                      className="max-h-96 w-full object-contain"
                    />
                  </div>
                  <div className="mt-2 text-center">
                    <a
                      href={selectedRefund.transferProofUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline font-bold"
                    >
                      <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                      <span>Mở ảnh kích thước đầy đủ</span>
                    </a>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="material-symbols-outlined text-3xl mb-1">image_not_supported</span>
                  <p>Chưa có ảnh chứng từ tải lên cho đơn này</p>
                </div>
              )}
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setIsViewProofModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
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

