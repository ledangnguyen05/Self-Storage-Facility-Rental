import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { User } from '../../../types'
import {
  supportTicketService,
  SupportTicketRecord,
  SupportTicketCategory,
} from '../../../services/supportTicketService'
import { toast } from '../../../utils/toast'
import { handoverService } from '../../../services/handoverService'
import { paymentService } from '../../../services/paymentService'

export interface CustomerSupportPanelProps {
  user: User | null
  activeContracts: any[]
  contracts: any[]
  initialUnit?: string
  initialCategory?: SupportTicketCategory
  initialContent?: string
  initialTitle?: string
}

const CATEGORY_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  RETURN_REFUND: { label: 'Trả kho trước hạn & hoàn tiền', icon: 'currency_exchange', color: 'bg-amber-100 text-amber-900 border-amber-300' },
  RETURN_EXPIRED: { label: 'Trả kho khi hết hạn hợp đồng', icon: 'assignment_return', color: 'bg-purple-100 text-purple-900 border-purple-300' },
  LOCK_ISSUE: { label: 'Sự cố khóa thông minh / Kẹt cửa', icon: 'lock_reset', color: 'bg-rose-100 text-rose-900 border-rose-300' },
  PIN_CODE: { label: 'Cấp lại mã PIN mới', icon: 'pin', color: 'bg-blue-100 text-blue-900 border-blue-300' },
  ACCESS_ISSUE: { label: 'Ủy quyền mở kho / Ra vào', icon: 'key', color: 'bg-cyan-100 text-cyan-900 border-cyan-300' },
  CLIMATE_TEMP: { label: 'Kiểm tra nhiệt độ / độ ẩm', icon: 'thermostat', color: 'bg-teal-100 text-teal-900 border-teal-300' },
  PAYMENT_ISSUE: { label: 'Thanh toán & Hóa đơn', icon: 'receipt_long', color: 'bg-indigo-100 text-indigo-900 border-indigo-300' },
  FACILITY_DAMAGE: { label: 'Hư hỏng cơ sở vật chất', icon: 'build', color: 'bg-orange-100 text-orange-900 border-orange-300' },
  CLEANLINESS_PEST: { label: 'Vệ sinh & Côn trùng', icon: 'pest_control', color: 'bg-lime-100 text-lime-900 border-lime-300' },
  OTHER: { label: 'Yêu cầu khác', icon: 'help_outline', color: 'bg-slate-100 text-slate-800 border-slate-300' },
}

const POPULAR_BANKS = [
  'Vietcombank (VCB)',
  'MB Bank (MBB)',
  'Techcombank (TCB)',
  'VietinBank (CTG)',
  'BIDV',
  'ACB',
  'VPBank',
  'TPBank',
  'Sacombank',
  'VIB',
  'HDBank',
  'Khác (Nhập tên ngân hàng)',
]

export const CustomerSupportPanel: React.FC<CustomerSupportPanelProps> = ({
  user,
  activeContracts,
  contracts,
  initialUnit,
  initialCategory,
  initialContent,
  initialTitle,
}) => {
  // Navigation sub-tab: 'form' (Tạo mới) | 'history' (Lịch sử)
  const [subTab, setSubTab] = useState<'form' | 'history'>('form')

  // Support Form State
  const [ticketUnit, setTicketUnit] = useState<string>(initialUnit || '')
  const [ticketCategory, setTicketCategory] = useState<SupportTicketCategory>(initialCategory || 'LOCK_ISSUE')
  const [ticketTitle, setTicketTitle] = useState<string>(initialTitle || '')
  const [ticketContent, setTicketContent] = useState<string>(initialContent || '')

  // Keep state synced when props change (e.g. user clicks "Yêu cầu trả kho" on a specific unit)
  useEffect(() => {
    if (initialUnit) {
      setTicketUnit(initialUnit)
    } else if (activeContracts.length > 0 && !ticketUnit) {
      setTicketUnit(activeContracts[0].unitCode)
    }
  }, [initialUnit, activeContracts])

  useEffect(() => {
    if (initialCategory) {
      setTicketCategory(initialCategory)
    }
  }, [initialCategory])

  useEffect(() => {
    if (initialContent !== undefined && initialContent !== '') {
      setTicketContent(initialContent)
    }
  }, [initialContent])

  useEffect(() => {
    if (initialTitle !== undefined && initialTitle !== '') {
      setTicketTitle(initialTitle)
    }
  }, [initialTitle])

  useEffect(() => {
    if (initialUnit || initialCategory) {
      setSubTab('form')
    }
  }, [initialUnit, initialCategory])
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null)
  const [evidencePreviewUrl, setEvidencePreviewUrl] = useState<string | null>(null)
  const [isSubmittingTicket, setIsSubmittingTicket] = useState<boolean>(false)
  const [ticketSubmitSuccess, setTicketSubmitSuccess] = useState<boolean>(false)
  const [ticketError, setTicketError] = useState<string>('')

  // Step 9: Flow 7 Rating Modal State
  const [ratingModalTicket, setRatingModalTicket] = useState<SupportTicketRecord | null>(null)
  const [ratingStars, setRatingStars] = useState<number>(5)
  const [ratingFeedback, setRatingFeedback] = useState<string>('')
  const [isSubmittingRating, setIsSubmittingRating] = useState<boolean>(false)

  // Support Ticket History State
  const [tickets, setTickets] = useState<SupportTicketRecord[]>([])
  const [isLoadingTickets, setIsLoadingTickets] = useState<boolean>(false)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [filterCategory, setFilterCategory] = useState<string>('ALL')
  const [filterStatus, setFilterStatus] = useState<string>('ALL')
  const [filterUnit, setFilterUnit] = useState<string>('ALL')
  const [filterFromDate, setFilterFromDate] = useState<string>('')
  const [filterToDate, setFilterToDate] = useState<string>('')
  const [currentPage, setCurrentPage] = useState<number>(1)
  const pageSize = 6

  // Detail Modal State
  const [selectedTicket, setSelectedTicket] = useState<SupportTicketRecord | null>(null)
  const [reopenReasonText, setReopenReasonText] = useState<string>('')
  const [showReopenInput, setShowReopenInput] = useState<boolean>(false)
  const [isActingOnTicket, setIsActingOnTicket] = useState<boolean>(false)

  // Bank Info Modal / Form State for RETURN_REFUND
  const [bankInfoTicket, setBankInfoTicket] = useState<SupportTicketRecord | null>(null)
  const [bankName, setBankName] = useState<string>('')
  const [bankAccountNumber, setBankAccountNumber] = useState<string>('')
  const [bankAccountName, setBankAccountName] = useState<string>('')
  const [bankNote, setBankNote] = useState<string>('')
  const [isSubmittingBank, setIsSubmittingBank] = useState<boolean>(false)
  const [bankSuccessMsg, setBankSuccessMsg] = useState<string | null>(null)
  const [bankErrorMsg, setBankErrorMsg] = useState<string | null>(null)

  // Task 16: Customer Settlement Review & Decision
  const [returnSettlementMap, setReturnSettlementMap] = useState<Record<string, any>>({})
  const [showCustomerDisputeModal, setShowCustomerDisputeModal] = useState(false)
  const [customerDisputeReason, setCustomerDisputeReason] = useState('')
  const [customerDisputeEvidence, setCustomerDisputeEvidence] = useState('')
  const [isSubmittingCustomerDecision, setIsSubmittingCustomerDecision] = useState(false)
  const [isPayingCompensation, setIsPayingCompensation] = useState(false)

  // Initialize selected unit
  useEffect(() => {
    if (activeContracts.length > 0 && !ticketUnit) {
      setTicketUnit(activeContracts[0].unitCode)
    }
  }, [activeContracts, ticketUnit])

  // Fetch Tickets strictly for current user
  const loadMyTickets = useCallback(async () => {
    if (!user?.id) return
    setIsLoadingTickets(true)
    try {
      const data = await supportTicketService.getMyTickets(user.id)
      setTickets(Array.isArray(data) ? data : [])
    } catch (err: any) {
      console.warn('Failed to load customer tickets:', err)
    } finally {
      setIsLoadingTickets(false)
    }
  }, [user?.id])

  useEffect(() => {
    loadMyTickets()
  }, [loadMyTickets])

  // Handle Create Ticket
  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.id) {
      setTicketError('Vui lòng đăng nhập để gửi yêu cầu hỗ trợ.')
      return
    }
    if (!ticketContent.trim()) {
      setTicketError('Vui lòng nhập chi tiết nội dung sự cố / yêu cầu.')
      return
    }

    setIsSubmittingTicket(true)
    setTicketError('')

    try {
      const activeUnit = contracts.find(c => c.unitCode === ticketUnit)
      const defaultTitle = ticketCategory === 'RETURN_REFUND'
        ? `Yêu cầu trả kho trước hạn & hoàn tiền #${ticketUnit}`
        : ticketCategory === 'RETURN_EXPIRED'
        ? `Yêu cầu trả kho khi hết hạn hợp đồng #${ticketUnit}`
        : ticketCategory === 'LOCK_ISSUE'
        ? `Sự cố khóa thông minh kho #${ticketUnit}`
        : ticketCategory === 'PIN_CODE'
        ? `Yêu cầu cấp lại mã PIN kho #${ticketUnit}`
        : `Yêu cầu hỗ trợ kho #${ticketUnit}`

      let uploadedEvidenceUrl: string | undefined = undefined
      if (evidenceFile) {
        try {
          uploadedEvidenceUrl = await supportTicketService.uploadAttachment(evidenceFile)
        } catch (uploadErr) {
          console.warn('Lỗi khi tải ảnh minh chứng:', uploadErr)
        }
      }

      const payload = {
        customerId: user.id,
        bookingId: activeUnit?.bookingId || (activeUnit?.id?.length === 36 ? activeUnit.id : undefined),
        storageUnitId: activeUnit?.storageUnitId || activeUnit?.unitId,
        unitCode: ticketUnit && ticketUnit !== 'general' ? ticketUnit : undefined,
        facilityId: activeUnit?.facilityId,
        category: ticketCategory,
        title: ticketTitle.trim() || defaultTitle,
        description: ticketContent.trim(),
        priority: ticketCategory === 'LOCK_ISSUE' || ticketCategory === 'PIN_CODE' ? 'HIGH' : 'MEDIUM',
        attachmentUrl: uploadedEvidenceUrl,
        imageEvidence: uploadedEvidenceUrl,
        evidenceUrls: uploadedEvidenceUrl ? [uploadedEvidenceUrl] : undefined,
      }

      await supportTicketService.createTicket(payload)
      setTicketSubmitSuccess(true)
      setTicketContent('')
      setTicketTitle('')
      setEvidenceFile(null)
      setEvidencePreviewUrl(null)
      await loadMyTickets()

      setTimeout(() => {
        setTicketSubmitSuccess(false)
        setSubTab('history')
      }, 2500)
    } catch (err: any) {
      console.error('Error creating ticket:', err)
      setTicketError(err?.response?.data?.message || err?.message || 'Không thể gửi yêu cầu hỗ trợ. Vui lòng thử lại.')
    } finally {
      setIsSubmittingTicket(false)
    }
  }

  // Handle Submit Bank Information for Refund
  const handleSubmitBankInfo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!bankInfoTicket) return
    if (!bankName.trim() || !bankAccountNumber.trim() || !bankAccountName.trim()) {
      setBankErrorMsg('Vui lòng điền đầy đủ Tên ngân hàng, Số tài khoản và Tên chủ tài khoản.')
      return
    }

    setIsSubmittingBank(true)
    setBankErrorMsg(null)
    setBankSuccessMsg(null)

    try {
      await supportTicketService.submitBankInfo(bankInfoTicket.id, {
        bankName: bankName.trim(),
        bankAccountNumber: bankAccountNumber.trim(),
        bankAccountName: bankAccountName.trim().toUpperCase(),
        note: bankNote.trim() || undefined,
      })
      if (bankInfoTicket.bookingId) {
        try {
          await handoverService.submitCustomerDecision(bankInfoTicket.bookingId, {
            decision: 'AGREED',
            bankName: bankName.trim(),
            bankAccountNumber: bankAccountNumber.trim(),
            bankAccountName: bankAccountName.trim().toUpperCase()
          })
          const updated = await handoverService.calculateSettlement(bankInfoTicket.bookingId)
          if (updated) {
            setReturnSettlementMap(prev => ({ ...prev, [bankInfoTicket.bookingId!]: updated }))
          }
        } catch (decisionErr) {
          console.warn('Could not sync bank info with handover record:', decisionErr)
        }
      }
      setBankSuccessMsg('Đã lưu thông tin tài khoản ngân hàng thành công! Bộ phận kế toán/quản trị sẽ tiến hành đối soát và giải ngân tiền hoàn.')
      await loadMyTickets()
      setTimeout(() => {
        setBankInfoTicket(null)
        setBankSuccessMsg(null)
        if (selectedTicket?.id === bankInfoTicket.id) {
          setSelectedTicket(prev => prev ? {
            ...prev,
            bankName: bankName.trim(),
            bankAccountNumber: bankAccountNumber.trim(),
            bankAccountName: bankAccountName.trim().toUpperCase(),
            refundStatus: 'PENDING_ADMIN_PAYOUT',
          } : null)
        }
      }, 2500)
    } catch (err: any) {
      console.error('Bank info submit error:', err)
      setBankErrorMsg(err?.response?.data?.message || err?.message || 'Không thể lưu thông tin tài khoản ngân hàng.')
    } finally {
      setIsSubmittingBank(false)
    }
  }

  // Handle Close Ticket (Customer satisfied)
  const handleOpenRatingModal = (ticket: SupportTicketRecord) => {
    setRatingModalTicket(ticket)
    setRatingStars(5)
    setRatingFeedback('')
  }

  const handleSubmitRating = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ratingModalTicket) return
    setIsSubmittingRating(true)
    try {
      await supportTicketService.closeTicketWithRating(ratingModalTicket.id, {
        rating: ratingStars,
        feedback: ratingFeedback.trim() || undefined,
        note: `Khách hàng đánh giá ${ratingStars} sao và xác nhận đóng ticket`,
      })
      toast.success('Cảm ơn bạn đã phản hồi và đánh giá dịch vụ!')
      setRatingModalTicket(null)
      await loadMyTickets()
      if (selectedTicket?.id === ratingModalTicket.id) {
        setSelectedTicket(prev => prev ? {
          ...prev,
          status: 'CLOSED',
          rating: ratingStars,
          customerFeedback: ratingFeedback.trim() || undefined,
        } : null)
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không thể gửi đánh giá và đóng ticket.')
    } finally {
      setIsSubmittingRating(false)
    }
  }

  const handleCloseTicket = async (ticketId: string) => {
    const t = tickets.find(item => item.id === ticketId) || selectedTicket || ({ id: ticketId, title: 'Yêu cầu hỗ trợ' } as SupportTicketRecord)
    handleOpenRatingModal(t)
  }

  // Handle Reopen Ticket
  const handleReopenTicket = async (ticketId: string) => {
    if (!reopenReasonText.trim()) {
      toast.warning('Vui lòng nhập lý do yêu cầu xử lý lại sự cố.')
      return
    }
    setIsActingOnTicket(true)
    try {
      await supportTicketService.reopenTicket(ticketId, reopenReasonText.trim())
      await loadMyTickets()
      setShowReopenInput(false)
      setReopenReasonText('')
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket(prev => prev ? { ...prev, status: 'REOPENED', reopenReason: reopenReasonText.trim() } : null)
      }
      toast.success('Đã gửi yêu cầu xử lý lại sự cố thành công.')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không thể mở lại yêu cầu.')
    } finally {
      setIsActingOnTicket(false)
    }
  }

  // Task 16: Load settlement details for return tickets
  useEffect(() => {
    if (selectedTicket?.bookingId && (selectedTicket.category === 'RETURN_REFUND' || selectedTicket.category === 'RETURN_EXPIRED')) {
      const bId = selectedTicket.bookingId
      handoverService.calculateSettlement(bId).then(res => {
        if (res) {
          setReturnSettlementMap(prev => ({ ...prev, [bId]: res }))
        }
      }).catch(err => {
        console.warn('Could not load settlement for booking', bId, err)
      })
    }
  }, [selectedTicket])

  // Handler for customer decision: AGREE
  const handleCustomerAgree = async (ticket: SupportTicketRecord, settlement: any) => {
    if (!ticket.bookingId) return
    const netRefund = settlement?.netRefundAmount || 0
    if (netRefund > 0) {
      // Directly prompt modal for customer to enter bank details
      setBankInfoTicket(ticket)
      setBankName(ticket.bankName || '')
      setBankAccountNumber(ticket.bankAccountNumber || '')
      setBankAccountName(ticket.bankAccountName || user?.fullName || '')
      return
    }

    setIsSubmittingCustomerDecision(true)
    try {
      await handoverService.submitCustomerDecision(ticket.bookingId, {
        decision: 'AGREED'
      })
      toast.success('Quý khách đã đồng ý với quyết định quyết toán trả kho!')
      const updated = await handoverService.calculateSettlement(ticket.bookingId)
      if (updated) {
        setReturnSettlementMap(prev => ({ ...prev, [ticket.bookingId!]: updated }))
      }
    } catch (err: any) {
      toast.error('Lỗi gửi xác nhận: ' + (err.response?.data?.message || err.message))
    } finally {
      setIsSubmittingCustomerDecision(false)
    }
  }

  // Handler for customer decision: DISPUTE
  const handleCustomerDisputeSubmit = async (ticket: SupportTicketRecord) => {
    if (!ticket.bookingId || !customerDisputeReason.trim()) {
      toast.warning('Vui lòng nhập lý do khiếu nại.')
      return
    }
    setIsSubmittingCustomerDecision(true)
    try {
      const evidenceList = customerDisputeEvidence.trim() ? [customerDisputeEvidence.trim()] : []
      await handoverService.submitCustomerDecision(ticket.bookingId, {
        decision: 'DISPUTED',
        disputeReason: customerDisputeReason.trim(),
        disputeEvidenceUrls: evidenceList
      })
      toast.success('Đã gửi khiếu nại thành công. Quản lý cơ sở sẽ xem xét giải quyết!')
      setShowCustomerDisputeModal(false)
      setCustomerDisputeReason('')
      setCustomerDisputeEvidence('')
      const updated = await handoverService.calculateSettlement(ticket.bookingId)
      if (updated) {
        setReturnSettlementMap(prev => ({ ...prev, [ticket.bookingId!]: updated }))
      }
    } catch (err: any) {
      toast.error('Lỗi gửi khiếu nại: ' + (err.response?.data?.message || err.message))
    } finally {
      setIsSubmittingCustomerDecision(false)
    }
  }

  const handleCancelDisputeSubmit = async (ticket: SupportTicketRecord) => {
    if (!ticket.bookingId) return
    const isConfirmed = window.confirm(
      'Bạn có chắc chắn muốn hủy yêu cầu khiếu nại này không?\n\nSau khi hủy, biên bản quyết toán sẽ quay lại trạng thái chờ bạn phản hồi.'
    )
    if (!isConfirmed) return

    setIsSubmittingCustomerDecision(true)
    try {
      await handoverService.cancelDispute(ticket.bookingId)
      toast.success('Đã hủy yêu cầu khiếu nại thành công!')
      const updated = await handoverService.calculateSettlement(ticket.bookingId)
      if (updated) {
        setReturnSettlementMap(prev => ({ ...prev, [ticket.bookingId!]: updated }))
      }
      loadMyTickets()
    } catch (err: any) {
      toast.error('Lỗi khi hủy khiếu nại: ' + (err.response?.data?.message || err.message))
    } finally {
      setIsSubmittingCustomerDecision(false)
    }
  }

  // Handler for customer payment of compensation via VNPay
  const handlePayCompensationVNPay = async (ticket: SupportTicketRecord, additionalDue: number) => {
    if (!ticket.bookingId) return
    setIsPayingCompensation(true)
    try {
      const response = await paymentService.createVNPayPayment({
        bookingId: ticket.bookingId,
        amount: additionalDue,
        paymentType: 'RETURN_COMPENSATION'
      })
      if (response?.paymentUrl) {
        window.location.href = response.paymentUrl
      } else {
        toast.error('Không thể tạo liên kết thanh toán VNPay.')
      }
    } catch (err: any) {
      toast.error('Lỗi thanh toán bồi thường: ' + (err.response?.data?.message || err.message))
    } finally {
      setIsPayingCompensation(false)
    }
  }

  // Filtered & Paginated Tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchCode = (t.ticketCode || t.ticketNumber || t.id).toLowerCase().includes(q)
        const matchTitle = (t.title || '').toLowerCase().includes(q)
        const matchDesc = (t.description || '').toLowerCase().includes(q)
        const matchUnit = (t.unitCode || '').toLowerCase().includes(q)
        if (!matchCode && !matchTitle && !matchDesc && !matchUnit) return false
      }
      // Category filter
      if (filterCategory !== 'ALL' && t.category !== filterCategory) return false
      // Status filter
      if (filterStatus !== 'ALL' && t.status !== filterStatus) return false
      // Unit filter
      if (filterUnit !== 'ALL' && t.unitCode !== filterUnit) return false
      // Date range
      if (filterFromDate && t.createdAt) {
        if (new Date(t.createdAt) < new Date(filterFromDate)) return false
      }
      if (filterToDate && t.createdAt) {
        const toDateEnd = new Date(filterToDate)
        toDateEnd.setHours(23, 59, 59, 999)
        if (new Date(t.createdAt) > toDateEnd) return false
      }
      return true
    })
  }, [tickets, searchQuery, filterCategory, filterStatus, filterUnit, filterFromDate, filterToDate])

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / pageSize))
  const paginatedTickets = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredTickets.slice(start, start + pageSize)
  }, [filteredTickets, currentPage, pageSize])

  const formatVND = (amount?: number) => {
    if (typeof amount !== 'number') return '—'
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)
  }

  const formatTimeStr = (dateStr?: string) => {
    if (!dateStr) return '—'
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
            <span>Chờ tiếp nhận</span>
          </span>
        )
      case 'IN_PROGRESS':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
            <span className="material-symbols-outlined text-[13px] text-blue-600">check_circle</span>
            <span>Đã được chấp nhận</span>
          </span>
        )
      case 'RESOLVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <span className="material-symbols-outlined text-[13px] text-emerald-600">verified</span>
            <span>Đã giải quyết</span>
          </span>
        )
      case 'CLOSED':
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-300">Đã đóng</span>
      case 'REOPENED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
            <span className="material-symbols-outlined text-[13px] text-rose-600">replay</span>
            <span>Mở lại xử lý</span>
          </span>
        )
      default:
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">{status}</span>
    }
  }

  const getRefundBadge = (ticket: SupportTicketRecord) => {
    if (ticket.category !== 'RETURN_REFUND') return null
    const rStatus = ticket.refundStatus || 'PENDING_FM_APPROVAL'
    switch (rStatus) {
      case 'PENDING_FM_APPROVAL':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">Chờ quản lý duyệt</span>
      case 'AWAITING_CUSTOMER_BANK_INFO':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-900 border border-orange-300 animate-pulse">
            <span>Cần cung cấp STK</span>
          </span>
        )
      case 'PENDING_ADMIN_PAYOUT':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-50 text-cyan-800 border border-cyan-200">Đang giải ngân</span>
      case 'COMPLETED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-900 border border-emerald-300">Đã hoàn tiền</span>
      case 'REJECTED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-800 border border-rose-200">Từ chối hoàn</span>
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Tab Bar: Gửi Yêu Cầu vs Lịch Sử Yêu Cầu */}
      <div className="bg-white rounded-2xl p-2 border border-slate-200 flex items-center gap-2 shadow-xs">
        <button
          type="button"
          onClick={() => setSubTab('form')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            subTab === 'form'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">add_circle</span>
          <span>Gửi Yêu Cầu Hỗ Trợ Mới</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setSubTab('history')
            loadMyTickets()
          }}
          className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            subTab === 'history'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">history</span>
          <span>Lịch Sử Yêu Cầu Hỗ Trợ</span>
          {tickets.length > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-extrabold ${
              subTab === 'history' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'
            }`}>
              {tickets.length}
            </span>
          )}
        </button>
      </div>

      {/* SUB-TAB 1: FORM GỬI YÊU CẦU MỚI */}
      {subTab === 'form' && (
        <section className="bg-white rounded-2xl p-6 md:p-8 border border-slate-200 shadow-xs">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Info Column */}
            <div className="lg:col-span-5 flex flex-col gap-4 text-left">
              <div className="flex items-center gap-1.5 text-blue-600 font-mono text-xs font-bold">
                <span className="material-symbols-outlined text-[16px]">headset_mic</span>
                <span>TRUNG TÂM PHẢN HỒI KHÁCH HÀNG BOXORA</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900">
                Hỗ Trợ Kỹ Thuật &amp; Khóa Kho
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Đội ngũ kỹ thuật và nhân viên vận hành Boxora luôn sẵn sàng tiếp nhận và giải quyết mọi sự cố về kho lưu trữ, cửa cuốn, bảo mật và yêu cầu dịch vụ của bạn.
              </p>

              <div className="mt-2 flex flex-col gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-blue-600">call</span>
                  <span>Hotline cơ sở: <strong className="text-slate-900 font-bold">1900 6828</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-emerald-600">schedule</span>
                  <span>Thời gian tiếp nhận: <strong>24/7 trực tuyến</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-amber-600">security</span>
                  <span>Bảo vệ chốt cổng hỗ trợ người thân &amp; xe tải ra vào</span>
                </div>
              </div>

              {/* Notice for return requests */}
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-[11.5px] text-amber-900 space-y-1">
                <p className="font-bold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px] text-amber-700">info</span>
                  <span>Lưu ý về Yêu cầu trả kho:</span>
                </p>
                <p>
                  • <strong>Trả kho trước hạn &amp; hoàn tiền:</strong> Quản lý cơ sở sẽ xem xét, đối soát quyết toán và tiếp nhận số tài khoản ngân hàng để hoàn tiền cọc hợp lệ.
                </p>
                <p>
                  • <strong>Trả kho khi hết hạn hợp đồng:</strong> Tiến hành nghiệm thu thực địa hiện trường, lập biên bản đối soát và giải phóng kho.
                </p>
              </div>
            </div>

            {/* Right Form Column */}
            <div className="lg:col-span-7 bg-slate-50 border border-slate-200 p-6 rounded-xl">
              {ticketSubmitSuccess ? (
                <div className="py-12 text-center flex flex-col items-center justify-center gap-3 animate-in fade-in">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-xs">
                    <span className="material-symbols-outlined text-[32px]">task_alt</span>
                  </div>
                  <h4 className="font-bold text-slate-900 text-base">Yêu Cầu Đã Được Tiếp Nhận Thành Công!</h4>
                  <p className="text-xs text-slate-500 max-w-sm">
                    Nhân viên phụ trách đang xử lý và sẽ phản hồi hoặc liên hệ lại với bạn. Bạn có thể theo dõi tiến độ tại tab <strong>Lịch Sử Yêu Cầu</strong>.
                  </p>
                </div>
              ) : (
                <form className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left" onSubmit={handleSubmitTicket}>
                  {ticketError && (
                    <div role="alert" className="sm:col-span-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px]">error</span>
                      <span>{ticketError}</span>
                    </div>
                  )}

                  {/* Kho liên quan */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      Kho lưu trữ liên quan
                    </label>
                    <select
                      value={ticketUnit}
                      onChange={(e) => setTicketUnit(e.target.value)}
                      className="h-10 px-3 bg-white border border-slate-300 text-slate-900 text-xs font-semibold rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {(() => {
                        const contractsList = activeContracts.length > 0 ? activeContracts : contracts
                        return (
                          <>
                            {contractsList.length > 0 ? (
                              contractsList.map(c => (
                                <option key={c.unitCode} value={c.unitCode}>
                                  Kho #{c.unitCode} ({c.facilityName || 'Boxora'})
                                </option>
                              ))
                            ) : (
                              <option value="general">Chưa có kho hoạt động</option>
                            )}
                            {ticketUnit && !contractsList.some(c => c.unitCode === ticketUnit) && ticketUnit !== 'general' && (
                              <option value={ticketUnit}>Kho #{ticketUnit}</option>
                            )}
                            <option value="general">Khác / Thắc mắc chung</option>
                          </>
                        )
                      })()}
                    </select>
                  </div>

                  {/* Vấn đề cần hỗ trợ (Separated return requests) */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      Vấn đề cần hỗ trợ
                    </label>
                    <select
                      value={ticketCategory}
                      onChange={(e) => setTicketCategory(e.target.value as SupportTicketCategory)}
                      className="h-10 px-3 bg-white border border-slate-300 text-slate-900 text-xs font-semibold rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <optgroup label="🔐 Lỗi truy cập / Khóa IoT">
                        <option value="LOCK_ISSUE">Sự cố khóa thông minh / Kẹt cửa cuốn (Lock Issue)</option>
                        <option value="PIN_CODE">Cấp lại mã PIN mới (PIN Code)</option>
                        <option value="ACCESS_ISSUE">Ủy quyền mở kho / Ra vào cơ sở (Access)</option>
                      </optgroup>
                      <optgroup label="💳 Sự cố thanh toán & Hoàn tiền">
                        <option value="PAYMENT_ISSUE">Sai sót hóa đơn / Phí phạt quá hạn (Billing)</option>
                        <option value="RETURN_REFUND">👉 Trả kho trước hạn &amp; hoàn tiền cọc</option>
                        <option value="RETURN_EXPIRED">👉 Trả kho khi hết hạn hợp đồng</option>
                      </optgroup>
                      <optgroup label="🛠️ Vệ sinh / Bảo trì / Hư hỏng vật lý">
                        <option value="FACILITY_DAMAGE">Kho thấm dột / Hư hỏng cơ sở vật chất (Damage/Leak)</option>
                        <option value="CLEANLINESS_PEST">Vệ sinh &amp; Côn trùng (Cleanliness/Pest)</option>
                        <option value="CLIMATE_TEMP">Nhiệt độ &amp; Độ ẩm phòng kho mát</option>
                      </optgroup>
                      <optgroup label="❓ Khác">
                        <option value="OTHER">Yêu cầu hỗ trợ khác</option>
                      </optgroup>
                    </select>
                  </div>

                  {/* Tiêu đề ngắn gọn */}
                  <div className="sm:col-span-2 flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      Tiêu đề tóm tắt (tùy chọn)
                    </label>
                    <input
                      type="text"
                      value={ticketTitle}
                      onChange={(e) => setTicketTitle(e.target.value)}
                      placeholder=""
                      className="h-10 px-3 bg-white border border-slate-300 text-slate-900 text-xs rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Mô tả chi tiết nội dung */}
                  <div className="sm:col-span-2 flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      Mô tả chi tiết nội dung <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      rows={4}
                      value={ticketContent}
                      onChange={(e) => setTicketContent(e.target.value)}
                      required
                      placeholder="Mô tả cụ thể sự cố cần xử lý, thời gian xảy ra, hoặc mong muốn hỗ trợ của bạn..."
                      className="p-3 bg-white border border-slate-300 text-slate-900 text-xs rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                  </div>

                  {/* Đính kèm hình ảnh minh chứng hiện trường */}
                  <div className="sm:col-span-2 flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center justify-between">
                      <span>Đính kèm hình ảnh minh chứng hiện trường (tùy chọn)</span>
                      <span className="text-[10px] text-slate-400 font-normal">Hỗ trợ JPG, PNG, WEBP</span>
                    </label>
                    <div className="flex items-center gap-3">
                      <label className="cursor-pointer px-4 py-2 bg-white border border-dashed border-slate-300 hover:border-blue-500 rounded-lg text-xs font-semibold text-slate-700 flex items-center gap-2 hover:bg-blue-50/50 transition-colors">
                        <span className="material-symbols-outlined text-[18px] text-blue-600">add_photo_alternate</span>
                        <span>{evidenceFile ? 'Đổi ảnh khác' : 'Chọn ảnh chụp hiện trường'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) {
                              setEvidenceFile(file)
                              setEvidencePreviewUrl(URL.createObjectURL(file))
                            }
                          }}
                        />
                      </label>
                      {evidenceFile && (
                        <div className="flex items-center gap-2 p-1.5 bg-white border border-slate-200 rounded-lg">
                          {evidencePreviewUrl && (
                            <img
                              src={evidencePreviewUrl}
                              alt="Minh chứng"
                              className="w-8 h-8 object-cover rounded border border-slate-200"
                            />
                          )}
                          <span className="text-xs text-slate-600 truncate max-w-[200px]">{evidenceFile.name}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setEvidenceFile(null)
                              setEvidencePreviewUrl(null)
                            }}
                            className="text-slate-400 hover:text-rose-600 text-xs px-1 cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="sm:col-span-2 flex items-center justify-between pt-2">
                    <span className="text-[11px] text-slate-500">
                      Hỗ trợ tiếp nhận 24/7 qua cổng trực tuyến và hotline cơ sở
                    </span>
                    <button
                      type="submit"
                      disabled={isSubmittingTicket}
                      className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-blue-600/20 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                    >
                      {isSubmittingTicket ? (
                        <>
                          <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Đang gửi...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[16px]">send</span>
                          <span>Gửi Yêu Cầu</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </section>
      )}

      {/* SUB-TAB 2: LỊCH SỬ YÊU CẦU HỖ TRỢ CỦA KHÁCH HÀNG */}
      {subTab === 'history' && (
        <section className="bg-white rounded-2xl p-6 md:p-8 border border-slate-200 shadow-xs space-y-6 text-left">
          {/* Header & Reload */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>Lịch Sử Yêu Cầu Hỗ Trợ Của Bạn</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
                  {filteredTickets.length} / {tickets.length} yêu cầu
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Theo dõi tiến trình giải quyết sự cố, phê duyệt trả kho và thông tin giải ngân hoàn tiền.
              </p>
            </div>

            <button
              type="button"
              onClick={loadMyTickets}
              disabled={isLoadingTickets}
              className="px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
            >
              <span className={`material-symbols-outlined text-[16px] ${isLoadingTickets ? 'animate-spin' : ''}`}>
                refresh
              </span>
              <span>Làm mới</span>
            </button>
          </div>

          {/* Search & Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Search */}
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-[18px]">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
                placeholder="Tìm mã phiếu, tiêu đề..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>

            {/* Filter Category */}
            <div>
              <select
                value={filterCategory}
                onChange={(e) => {
                  setFilterCategory(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white font-medium"
              >
                <option value="ALL">Tất cả loại yêu cầu</option>
                <option value="RETURN_REFUND">Trả kho trước hạn &amp; hoàn tiền</option>
                <option value="RETURN_EXPIRED">Trả kho khi hết hạn</option>
                <option value="LOCK_ISSUE">Khóa thông minh / Kẹt cửa</option>
                <option value="PIN_CODE">Cấp lại mã PIN</option>
                <option value="ACCESS_ISSUE">Ủy quyền ra vào</option>
                <option value="PAYMENT_ISSUE">Thanh toán &amp; Hóa đơn</option>
                <option value="OTHER">Khác</option>
              </select>
            </div>

            {/* Filter Status */}
            <div>
              <select
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white font-medium"
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="OPEN">Chờ tiếp nhận (OPEN)</option>
                <option value="IN_PROGRESS">Đã được chấp nhận (IN_PROGRESS)</option>
                <option value="RESOLVED">Đã giải quyết (RESOLVED)</option>
                <option value="CLOSED">Đã đóng (CLOSED)</option>
                <option value="REOPENED">Mở lại (REOPENED)</option>
              </select>
            </div>

            {/* From Date */}
            <div>
              <input
                type="date"
                value={filterFromDate}
                onChange={(e) => {
                  setFilterFromDate(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                title="Từ ngày"
              />
            </div>

            {/* To Date */}
            <div>
              <input
                type="date"
                value={filterToDate}
                onChange={(e) => {
                  setFilterToDate(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                title="Đến ngày"
              />
            </div>
          </div>

          {/* Ticket Table */}
          {isLoadingTickets ? (
            <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
              <span className="inline-block w-6 h-6 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin" />
              <span className="text-xs">Đang tải lịch sử yêu cầu...</span>
            </div>
          ) : paginatedTickets.length === 0 ? (
            <div className="py-16 text-center rounded-2xl bg-slate-50 border border-dashed border-slate-300 flex flex-col items-center justify-center gap-3">
              <span className="material-symbols-outlined text-[36px] text-slate-300">inbox</span>
              <p className="text-xs font-semibold text-slate-600">
                {tickets.length === 0
                  ? 'Bạn chưa có yêu cầu hỗ trợ nào. Khi gửi yêu cầu, toàn bộ lịch sử sẽ hiển thị tại đây.'
                  : 'Không tìm thấy yêu cầu nào phù hợp với bộ lọc hiện tại.'}
              </p>
              {tickets.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('')
                    setFilterCategory('ALL')
                    setFilterStatus('ALL')
                    setFilterUnit('ALL')
                    setFilterFromDate('')
                    setFilterToDate('')
                  }}
                  className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  Xóa bộ lọc
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] tracking-wider font-bold">
                    <th className="py-3 px-4">Mã Phiếu</th>
                    <th className="py-3 px-4">Loại Yêu Cầu</th>
                    <th className="py-3 px-4">Kho &amp; Cơ Sở</th>
                    <th className="py-3 px-4">Tiêu Đề &amp; Mô Tả</th>
                    <th className="py-3 px-4 text-center">Trạng Thái</th>
                    <th className="py-3 px-4">Ngày Gửi</th>
                    <th className="py-3 px-4 text-right">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedTickets.map((t) => {
                    const catInfo = CATEGORY_LABELS[t.category] || CATEGORY_LABELS.OTHER
                    const isReturnRefund = t.category === 'RETURN_REFUND'
                    const needsBank = isReturnRefund && t.refundStatus === 'AWAITING_CUSTOMER_BANK_INFO'

                    return (
                      <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Mã phiếu */}
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                          {t.ticketCode || t.ticketNumber || `#${t.id.slice(0, 8)}`}
                        </td>

                        {/* Loại yêu cầu */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${catInfo.color}`}>
                            <span className="material-symbols-outlined text-[14px]">{catInfo.icon}</span>
                            <span>{catInfo.label}</span>
                          </span>
                        </td>

                        {/* Kho & Cơ sở */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-semibold text-slate-900">
                            {t.unitCode ? `Kho #${t.unitCode}` : 'Chung'}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {t.facilityName || 'Tại cơ sở'}
                          </div>
                        </td>

                        {/* Tiêu đề & Mô tả */}
                        <td className="py-3.5 px-4 max-w-xs">
                          <div className="font-bold text-slate-900 truncate">
                            {t.title || 'Yêu cầu hỗ trợ'}
                          </div>
                          <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                            {t.description}
                          </p>
                          {/* Refund badge */}
                          {isReturnRefund && (
                            <div className="mt-1 flex items-center gap-1.5">
                              {getRefundBadge(t)}
                              {t.refundAmount && (
                                <span className="font-mono text-[10.5px] font-bold text-emerald-700">
                                  {formatVND(t.refundAmount)}
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Trạng thái */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {getStatusBadge(t.status)}
                        </td>

                        {/* Ngày gửi */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-slate-600 font-mono text-[11px]">
                          {formatTimeStr(t.createdAt)}
                        </td>

                        {/* Thao tác */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {needsBank && (
                              <button
                                type="button"
                                onClick={() => {
                                  setBankInfoTicket(t)
                                  setBankName(t.bankName || '')
                                  setBankAccountNumber(t.bankAccountNumber || '')
                                  setBankAccountName(t.bankAccountName || user?.fullName || '')
                                }}
                                className="px-2.5 py-1 rounded-lg bg-orange-500 hover:bg-orange-600 active:scale-98 text-white font-bold text-[11px] transition-all cursor-pointer shadow-xs flex items-center gap-1 animate-pulse"
                              >
                                <span className="material-symbols-outlined text-[13px]">account_balance</span>
                                <span>Nhập STK</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => setSelectedTicket(t)}
                              className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition-colors cursor-pointer"
                            >
                              Chi tiết
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-500">
                Hiển thị trang <strong>{currentPage}</strong> / <strong>{totalPages}</strong> (Tổng {filteredTickets.length} yêu cầu)
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-40 text-xs font-semibold cursor-pointer"
                >
                  Trang trước
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }).map((_, idx) => (
                    <button
                      key={idx + 1}
                      type="button"
                      onClick={() => setCurrentPage(idx + 1)}
                      className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        currentPage === idx + 1
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-40 text-xs font-semibold cursor-pointer"
                >
                  Trang sau
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* DETAIL MODAL: Xem Chi Tiết Phiếu Yêu Cầu Hỗ Trợ */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden text-left max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-[20px]">description</span>
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-slate-900">
                      Chi Tiết Yêu Cầu {selectedTicket.ticketCode || selectedTicket.ticketNumber || `#${selectedTicket.id.slice(0, 8)}`}
                    </h3>
                    {getStatusBadge(selectedTicket.status)}
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Gửi lúc: {formatTimeStr(selectedTicket.createdAt)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedTicket(null)
                  setShowReopenInput(false)
                }}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-700">
              {/* Context Box */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[11px] text-slate-500 block">Loại yêu cầu</span>
                  <span className="font-bold text-slate-900 block mt-0.5">
                    {CATEGORY_LABELS[selectedTicket.category]?.label || selectedTicket.category}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">Kho &amp; Cơ sở</span>
                  <span className="font-bold text-slate-900 block mt-0.5">
                    {selectedTicket.unitCode ? `Kho #${selectedTicket.unitCode}` : 'Chung'} · {selectedTicket.facilityName || 'Tại cơ sở'}
                  </span>
                </div>
                {selectedTicket.assignedStaffName && (
                  <div>
                    <span className="text-[11px] text-slate-500 block">Nhân viên phụ trách</span>
                    <span className="font-semibold text-slate-800 block mt-0.5">
                      {selectedTicket.assignedStaffName} {selectedTicket.assignedStaffPhone ? `(${selectedTicket.assignedStaffPhone})` : ''}
                    </span>
                  </div>
                )}
                {selectedTicket.updatedAt && (
                  <div>
                    <span className="text-[11px] text-slate-500 block">Cập nhật lần cuối</span>
                    <span className="font-mono text-slate-700 block mt-0.5">
                      {formatTimeStr(selectedTicket.updatedAt)}
                    </span>
                  </div>
                )}
              </div>

              {/* OPEN Notification Banner */}
              {selectedTicket.status === 'OPEN' && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3">
                  <span className="material-symbols-outlined text-[22px] text-amber-600 shrink-0">hourglass_top</span>
                  <div>
                    <div className="font-bold text-xs text-amber-900">
                      Yêu cầu đang chờ tiếp nhận
                    </div>
                    <p className="text-[11px] text-amber-700 mt-0.5 leading-relaxed">
                      Yêu cầu của bạn đã được gửi đến ban quản lý cơ sở. Nhân viên và Quản lý cơ sở sẽ kiểm tra, xác nhận và lên lịch hẹn nghiệm thu / xử lý trong thời gian sớm nhất.
                    </p>
                  </div>
                </div>
              )}

              {/* IN_PROGRESS Notification Banner */}
              {selectedTicket.status === 'IN_PROGRESS' && (
                <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 flex items-start gap-3">
                  <span className="material-symbols-outlined text-[22px] text-blue-600 shrink-0">check_circle</span>
                  <div>
                    <div className="font-bold text-xs text-blue-900">
                      Yêu cầu đã được chấp nhận — {selectedTicket.assignedStaffName ? `Nhân viên ${selectedTicket.assignedStaffName}` : 'Nhân viên cơ sở'} đang tiếp nhận &amp; xử lý
                    </div>
                    <p className="text-[11px] text-blue-700 mt-0.5 leading-relaxed">
                      Cơ sở đã tiếp nhận yêu cầu và lên lịch nghiệm thu / xử lý hiện trường. Quý khách vui lòng theo dõi thông báo và liên hệ hotline <strong>1900 6828</strong> nếu cần hỗ trợ gấp.
                    </p>
                  </div>
                </div>
              )}

              {/* Title & Description */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Tiêu đề &amp; Nội dung yêu cầu
                </span>
                <p className="font-bold text-slate-900 text-sm">
                  {selectedTicket.title}
                </p>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {selectedTicket.description}
                </div>
              </div>

              {/* Evidence Images */}
              {(selectedTicket.imageEvidence || (selectedTicket.evidenceUrls && selectedTicket.evidenceUrls.length > 0)) && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Ảnh minh chứng đính kèm:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {[selectedTicket.imageEvidence, ...(selectedTicket.evidenceUrls || [])].filter((url, idx, arr) => Boolean(url) && arr.indexOf(url) === idx).map((imgUrl, i) => (
                      <a key={i} href={imgUrl} target="_blank" rel="noreferrer" className="block w-20 h-20 rounded-lg overflow-hidden border border-slate-200 hover:opacity-80 transition-opacity">
                        <img src={imgUrl} alt="Minh chứng" className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Customer Rating Display for CLOSED ticket (Flow 7 Bước 9) */}
              {selectedTicket.status === 'CLOSED' && selectedTicket.rating && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900">Đánh giá dịch vụ từ bạn:</span>
                    <div className="flex items-center text-amber-500">
                      {Array.from({ length: 5 }).map((_, idx) => (
                        <span key={idx} className="material-symbols-outlined text-[16px]">
                          {idx < selectedTicket.rating! ? 'star' : 'star_border'}
                        </span>
                      ))}
                    </div>
                    <span className="font-bold text-xs">({selectedTicket.rating}/5 sao)</span>
                  </div>
                  {selectedTicket.customerFeedback && (
                    <p className="text-xs text-amber-800 italic">"{selectedTicket.customerFeedback}"</p>
                  )}
                </div>
              )}

              {/* Refund Info Section for RETURN_REFUND & RETURN_EXPIRED (Task 16 Settlement Flow) */}
              {(selectedTicket.category === 'RETURN_REFUND' || selectedTicket.category === 'RETURN_EXPIRED') && (() => {
                const currentTkt = selectedTicket
                if (!currentTkt) return null
                const bId = currentTkt.bookingId
                const settlement = bId ? returnSettlementMap[bId] : null
                const netRefund = settlement?.netRefundAmount ?? (currentTkt.refundAmount || 0)
                const additionalDue = settlement?.additionalAmountDue ?? 0
                const isOverDeposit = additionalDue > 0
                const depositPaid = settlement?.depositPaid ?? 0
                const totalDeductions = settlement?.totalDeductions ?? settlement?.totalDeduction ?? 0
                const isConfirmed = settlement ? Boolean(settlement.settlementConfirmed) : true
                const decision = settlement?.customerDecision

                const isDepositDeducted =
                  Number(totalDeductions) > 0 ||
                  Number(additionalDue) > 0 ||
                  (Number(depositPaid) > 0 && Number(netRefund) < Number(depositPaid)) ||
                  Number(settlement?.doorFee || 0) > 0 ||
                  Number(settlement?.cleaningFee || 0) > 0 ||
                  Number(settlement?.wallStructureFee || 0) > 0 ||
                  Number(settlement?.smartLockFee || 0) > 0 ||
                  Number(settlement?.lostCardFee || 0) > 0 ||
                  Number(settlement?.overdueDebt || 0) > 0 ||
                  Number(settlement?.damageFee || 0) > 0

                return (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 space-y-3 text-amber-950">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-amber-700">currency_exchange</span>
                      <span>Quyết toán trả kho &amp; Đối soát cọc (Phiên bản V{settlement?.settlementVersion || 1}):</span>
                    </span>
                    {getRefundBadge(currentTkt)}
                  </div>

                  {/* Chi tiết đối soát */}
                  <div className="p-3 bg-white/80 rounded-xl border border-amber-200 text-xs space-y-1.5">
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Tiền cọc ban đầu đã đóng:</span>
                      <strong className="font-mono text-slate-900">{formatVND(depositPaid)}</strong>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Tổng chi phí khấu trừ (thiệt hại, vệ sinh, thiết bị):</span>
                      <strong className="font-mono text-rose-600">-{formatVND(totalDeductions)}</strong>
                    </div>

                    <div className="pt-2 border-t border-amber-200">
                      {isOverDeposit ? (
                        <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-300 text-rose-950 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold">Khoản bồi thường cần thanh toán:</span>
                            <span className="font-mono font-extrabold text-rose-700 text-sm">+{formatVND(additionalDue)}</span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span>Tiền hoàn trả:</span>
                            <span className="font-mono font-bold">0đ</span>
                          </div>
                        </div>
                      ) : (
                        <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-950 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold">Số tiền hoàn trả quý khách:</span>
                            <span className="font-mono font-extrabold text-emerald-700 text-sm">{formatVND(netRefund)}</span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span>Khoản cần nộp thêm:</span>
                            <span className="font-mono font-bold">0đ</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Task 16.3: QUYẾT ĐỊNH CỦA KHÁCH HÀNG (2 NÚT BẤM HOẶC TRẠNG THÁI) */}
                  {isConfirmed && (
                    <div className="pt-1">
                      {(!decision || decision === 'AWAITING_CUSTOMER_CONFIRMATION') ? (
                        <div className="space-y-2">
                          <div className="text-[11px] text-amber-800 font-semibold">
                            Nhân viên đã chốt biên bản kiểm tra &amp; tính phí. Vui lòng xem xét và phản hồi:
                          </div>
                          <div className={isDepositDeducted ? "grid grid-cols-2 gap-2" : "flex justify-end"}>
                            <button
                              type="button"
                              onClick={() => handleCustomerAgree(currentTkt, settlement)}
                              disabled={isSubmittingCustomerDecision}
                              className={isDepositDeducted
                                ? "py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition disabled:opacity-50"
                                : "w-full sm:w-auto py-2.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition disabled:opacity-50"
                              }
                            >
                              <span className="material-symbols-outlined text-[16px]">check_circle</span>
                              <span>Đồng ý với quyết định</span>
                            </button>
                            {isDepositDeducted && (
                              <button
                                type="button"
                                onClick={() => setShowCustomerDisputeModal(true)}
                                disabled={isSubmittingCustomerDecision}
                                className="py-2.5 px-3 rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition disabled:opacity-50"
                              >
                                <span className="material-symbols-outlined text-[16px]">report_problem</span>
                                <span>Khiếu nại</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ) : decision === 'AGREED' ? (
                        <div className="space-y-2">
                          <div className="p-2.5 rounded-lg bg-emerald-100/80 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[16px] text-emerald-700">task_alt</span>
                            <span>Quý khách đã đồng ý với quyết định quyết toán trả kho.</span>
                          </div>

                          {/* Trường hợp 1: Nhận hoàn tiền -> Cung cấp tài khoản */}
                          {!isOverDeposit && netRefund > 0 && (
                            <div className="p-3 bg-white rounded-xl border border-amber-200 text-xs space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500">Tài khoản nhận hoàn tiền:</span>
                                {currentTkt.bankAccountNumber ? (
                                  <span className="font-mono font-bold text-slate-800">
                                    {currentTkt.bankName} · ****{currentTkt.bankAccountNumber.slice(-4)} ({currentTkt.bankAccountName})
                                  </span>
                                ) : (
                                  <span className="text-amber-700 font-bold">Chưa cung cấp</span>
                                )}
                              </div>
                              {!currentTkt.bankAccountNumber && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setBankInfoTicket(currentTkt)
                                    setBankName(currentTkt.bankName || '')
                                    setBankAccountNumber(currentTkt.bankAccountNumber || '')
                                    setBankAccountName(currentTkt.bankAccountName || user?.fullName || '')
                                  }}
                                  className="w-full py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-[15px]">account_balance</span>
                                  <span>Cung cấp số tài khoản nhận tiền hoàn</span>
                                </button>
                              )}
                            </div>
                          )}

                          {/* Trường hợp 2: Khách nợ thêm -> Thanh toán VNPay Sandbox */}
                          {isOverDeposit && additionalDue > 0 && (
                            <div className="p-3 bg-white rounded-xl border border-rose-200 text-xs space-y-2">
                              {settlement?.additionalPaymentStatus === 'PAID' ? (
                                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-900 font-bold flex items-center gap-1.5">
                                  <span className="material-symbols-outlined text-[16px] text-emerald-700">verified</span>
                                  <span>Đã thanh toán bồi thường {formatVND(additionalDue)} qua VNPay (Mã GD: {settlement.additionalPaymentTxnRef || 'Thành công'})</span>
                                </div>
                              ) : (
                                <div className="space-y-1.5">
                                  <p className="text-slate-600 text-[11px]">
                                    Quý khách có thể thanh toán trực tiếp khoản bồi thường qua cổng thanh toán VNPay Sandbox:
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => handlePayCompensationVNPay(currentTkt, additionalDue)}
                                    disabled={isPayingCompensation}
                                    className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition disabled:opacity-50"
                                  >
                                    <span className="material-symbols-outlined text-[16px]">credit_card</span>
                                    <span>{isPayingCompensation ? 'Đang tạo liên kết...' : `Thanh toán bồi thường ${formatVND(additionalDue)} qua VNPay Sandbox`}</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : decision === 'DISPUTED' ? (
                        <div className="p-3 rounded-xl bg-rose-100/80 border border-rose-300 text-rose-900 text-xs space-y-2">
                          <div className="font-bold flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-[16px] text-rose-700">warning</span>
                              <span>Quý khách đã gửi khiếu nại về quyết toán này.</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCancelDisputeSubmit(currentTkt)}
                              disabled={isSubmittingCustomerDecision}
                              className="px-2.5 py-1 rounded-lg bg-white hover:bg-rose-50 border border-rose-300 text-rose-700 font-bold text-[11px] flex items-center gap-1 cursor-pointer transition disabled:opacity-50"
                            >
                              <span className="material-symbols-outlined text-[13px]">undo</span>
                              <span>Hủy yêu cầu khiếu nại</span>
                            </button>
                          </div>
                          <p className="italic text-[11px]">Lý do: "{settlement?.disputeReason || 'Chưa đồng ý với chi phí khấu trừ'}"</p>
                          <p className="text-[10px] text-slate-600 pt-0.5">
                            Hồ sơ đang được chuyển lên Quản lý cơ sở (Facility Manager) xem xét hòa giải và điều chỉnh. Mọi khoản thanh toán / giải ngân được tạm ngưng.
                          </p>
                        </div>
                      ) : null}
                    </div>
                  )}

                  {currentTkt.transferTransactionRef && (
                    <div className="text-[11px] bg-emerald-50 text-emerald-950 p-2.5 rounded-lg border border-emerald-300 mt-1 space-y-1">
                      <div>
                        <strong>Mã giao dịch giải ngân:</strong> <span className="font-mono font-bold">{currentTkt.transferTransactionRef}</span>
                      </div>
                      {currentTkt.transferConfirmedAt && (
                        <div>Thời gian chuyển khoản: {formatTimeStr(currentTkt.transferConfirmedAt)}</div>
                      )}
                      {currentTkt.transferProofUrl && (
                        <a
                          href={currentTkt.transferProofUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-bold text-blue-600 hover:underline pt-0.5"
                        >
                          <span className="material-symbols-outlined text-[14px]">receipt</span>
                          <span>Xem biên lai chuyển khoản ngân hàng</span>
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )})()}

              {/* Resolution Note if resolved/closed */}
              {selectedTicket.resolutionNote && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-1">
                  <span className="font-bold text-[11px] uppercase tracking-wider block text-emerald-800">
                    Phản hồi &amp; Kết quả xử lý từ Boxora:
                  </span>
                  <p className="whitespace-pre-wrap leading-relaxed">{selectedTicket.resolutionNote}</p>
                  {selectedTicket.resolvedAt && (
                    <div className="text-[10px] text-emerald-700 pt-1 font-mono">
                      Xử lý xong lúc: {formatTimeStr(selectedTicket.resolvedAt)}
                    </div>
                  )}
                </div>
              )}

              {/* Reopen note if any */}
              {selectedTicket.reopenReason && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-950 space-y-1">
                  <span className="font-bold text-[11px] uppercase tracking-wider block text-rose-800">
                    Lý do yêu cầu xử lý lại:
                  </span>
                  <p className="whitespace-pre-wrap leading-relaxed">{selectedTicket.reopenReason}</p>
                </div>
              )}

              {/* Reopen Input Form */}
              {showReopenInput && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-300 space-y-2">
                  <label className="text-[11px] font-bold text-slate-700 block">
                    Nhập chi tiết lý do sự cố chưa được khắc phục triệt để:
                  </label>
                  <textarea
                    rows={2}
                    value={reopenReasonText}
                    onChange={(e) => setReopenReasonText(e.target.value)}
                    placeholder="Mô tả cụ thể vấn đề vẫn còn tồn đọng..."
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 outline-none focus:ring-2 focus:ring-rose-500 resize-none"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowReopenInput(false)}
                      className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold cursor-pointer"
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      disabled={isActingOnTicket || !reopenReasonText.trim()}
                      onClick={() => handleReopenTicket(selectedTicket.id)}
                      className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {isActingOnTicket ? 'Đang gửi...' : 'Xác nhận mở lại'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {selectedTicket.status === 'RESOLVED' && !showReopenInput && (
                  <>
                    <button
                      type="button"
                      disabled={isActingOnTicket}
                      onClick={() => handleCloseTicket(selectedTicket.id)}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[15px]">check_circle</span>
                      <span>Hài Lòng &amp; Đóng Phiếu</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowReopenInput(true)}
                      className="px-3.5 py-2 rounded-xl border border-rose-300 hover:bg-rose-50 text-rose-700 text-xs font-bold transition-colors cursor-pointer"
                    >
                      Yêu cầu xử lý lại
                    </button>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedTicket(null)
                  setShowReopenInput(false)
                }}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BANK INFO MODAL: Khách hàng nhập STK ngân hàng nhận tiền hoàn */}
      {bankInfoTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden text-left animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-5 border-b border-orange-100 bg-gradient-to-r from-orange-50 to-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-10 h-10 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-[22px]">account_balance</span>
                </span>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    Cung Cấp Thông Tin Ngân Hàng
                  </h3>
                  <span className="text-[11px] text-orange-800 font-mono">
                    Yêu cầu: {bankInfoTicket.ticketCode || bankInfoTicket.ticketNumber || `#${bankInfoTicket.id.slice(0, 8)}`}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setBankInfoTicket(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSubmitBankInfo} className="p-6 space-y-4 text-xs text-left">
              {bankSuccessMsg && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 font-medium flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  <span>{bankSuccessMsg}</span>
                </div>
              )}

              {bankErrorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 font-medium flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  <span>{bankErrorMsg}</span>
                </div>
              )}

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
                Số tiền hoàn đã duyệt: <strong className="font-mono text-emerald-700 text-xs">{bankInfoTicket.refundAmount ? formatVND(bankInfoTicket.refundAmount) : 'Theo biên bản quyết toán'}</strong>. Vui lòng cung cấp chính xác tài khoản ngân hàng chính chủ của bạn để nhận chuyển khoản.
              </div>

              {/* Ngân hàng */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block text-[11px] uppercase tracking-wider">
                  Ngân hàng thụ hưởng <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  list="popular-banks-list"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  required
                  placeholder="Chọn hoặc nhập tên ngân hàng (Ví dụ: Vietcombank, MB Bank...)"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white"
                />
                <datalist id="popular-banks-list">
                  {POPULAR_BANKS.map(b => (
                    <option key={b} value={b} />
                  ))}
                </datalist>
              </div>

              {/* Số tài khoản */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block text-[11px] uppercase tracking-wider">
                  Số tài khoản ngân hàng <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={bankAccountNumber}
                  onChange={(e) => setBankAccountNumber(e.target.value.replace(/\s+/g, ''))}
                  required
                  placeholder="Nhập số tài khoản ngân hàng..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white tracking-wider"
                />
              </div>

              {/* Tên chủ tài khoản */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block text-[11px] uppercase tracking-wider">
                  Tên chủ tài khoản (Không dấu) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={bankAccountName}
                  onChange={(e) => setBankAccountName(e.target.value.toUpperCase())}
                  required
                  placeholder="Ví dụ: NGUYEN VAN A"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 uppercase outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white"
                />
              </div>

              {/* Ghi chú */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block text-[11px] uppercase tracking-wider">
                  Ghi chú thêm (tùy chọn)
                </label>
                <input
                  type="text"
                  value={bankNote}
                  onChange={(e) => setBankNote(e.target.value)}
                  placeholder="Chi nhánh ngân hàng hoặc lời nhắn..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white"
                />
              </div>

              {/* Footer */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  disabled={isSubmittingBank}
                  onClick={() => setBankInfoTicket(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingBank}
                  className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition-all shadow-md shadow-orange-600/20 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSubmittingBank ? (
                    <>
                      <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">save</span>
                      <span>Xác Nhận Lưu Thông Tin</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RATING MODAL: Đánh giá chất lượng xử lý sự cố & Đóng ticket (Flow 7 Bước 9) */}
      {ratingModalTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden text-left animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-[20px]">star</span>
                </span>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    Đánh Giá Chất Lượng Phục Vụ
                  </h3>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Phiếu #{ratingModalTicket.ticketCode || ratingModalTicket.id.slice(0, 8)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRatingModalTicket(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitRating} className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">Tiêu đề sự cố:</span>
                <p className="font-semibold text-slate-800 text-xs truncate">{ratingModalTicket.title}</p>
                {ratingModalTicket.resolutionNote && (
                  <p className="text-[11px] text-emerald-700 bg-emerald-50 p-2 rounded border border-emerald-200 mt-1">
                    <strong>Kết quả:</strong> {ratingModalTicket.resolutionNote}
                  </p>
                )}
              </div>

              {/* Star Rating Selector */}
              <div className="flex flex-col items-center justify-center py-2 space-y-2">
                <span className="text-xs font-bold text-slate-700">Bạn hài lòng với kết quả xử lý này chứ?</span>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRatingStars(star)}
                      className="p-1 text-amber-400 hover:scale-125 transition-transform cursor-pointer focus:outline-none"
                    >
                      <span className="material-symbols-outlined text-[32px]">
                        {star <= ratingStars ? 'star' : 'star_border'}
                      </span>
                    </button>
                  ))}
                </div>
                <span className="text-xs font-bold text-amber-700">
                  {ratingStars === 5 && '🌟 Rất hài lòng'}
                  {ratingStars === 4 && '👍 Hài lòng'}
                  {ratingStars === 3 && '😐 Bình thường'}
                  {ratingStars === 2 && '👎 Chưa hài lòng'}
                  {ratingStars === 1 && '⚠️ Rất không hài lòng'}
                </span>
              </div>

              {/* Feedback Comment */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                  Ý kiến đóng góp / Lời nhắn (tùy chọn)
                </label>
                <textarea
                  rows={3}
                  value={ratingFeedback}
                  onChange={(e) => setRatingFeedback(e.target.value)}
                  placeholder="Chia sẻ trải nghiệm của bạn về thái độ phục vụ và tốc độ xử lý..."
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  disabled={isSubmittingRating}
                  onClick={() => setRatingModalTicket(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRating}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSubmittingRating ? (
                    <>
                      <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">check_circle</span>
                      <span>Xác Nhận &amp; Đóng Yêu Cầu</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
