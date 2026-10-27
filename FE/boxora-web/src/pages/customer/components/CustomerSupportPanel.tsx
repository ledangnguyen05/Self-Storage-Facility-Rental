import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { User } from '../../../types'
import {
  supportTicketService,
  SupportTicketRecord,
  SupportTicketCategory,
} from '../../../services/supportTicketService'

export interface CustomerSupportPanelProps {
  user: User | null
  activeContracts: any[]
  contracts: any[]
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
}) => {
  // Navigation sub-tab: 'form' (Tạo mới) | 'history' (Lịch sử)
  const [subTab, setSubTab] = useState<'form' | 'history'>('form')

  // Support Form State
  const [ticketUnit, setTicketUnit] = useState<string>('')
  const [ticketCategory, setTicketCategory] = useState<SupportTicketCategory>('LOCK_ISSUE')
  const [ticketTitle, setTicketTitle] = useState<string>('')
  const [ticketContent, setTicketContent] = useState<string>('')
  const [isSubmittingTicket, setIsSubmittingTicket] = useState<boolean>(false)
  const [ticketSubmitSuccess, setTicketSubmitSuccess] = useState<boolean>(false)
  const [ticketError, setTicketError] = useState<string>('')

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
      }

      await supportTicketService.createTicket(payload)
      setTicketSubmitSuccess(true)
      setTicketContent('')
      setTicketTitle('')
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
  const handleCloseTicket = async (ticketId: string) => {
    setIsActingOnTicket(true)
    try {
      await supportTicketService.closeTicket(ticketId, 'Khách hàng xác nhận hài lòng và đóng yêu cầu')
      await loadMyTickets()
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket(prev => prev ? { ...prev, status: 'CLOSED' } : null)
      }
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Không thể đóng yêu cầu.')
    } finally {
      setIsActingOnTicket(false)
    }
  }

  // Handle Reopen Ticket
  const handleReopenTicket = async (ticketId: string) => {
    if (!reopenReasonText.trim()) {
      alert('Vui lòng nhập lý do yêu cầu xử lý lại sự cố.')
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
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Không thể mở lại yêu cầu.')
    } finally {
      setIsActingOnTicket(false)
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
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">Đã tiếp nhận</span>
      case 'IN_PROGRESS':
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">Đang xử lý</span>
      case 'RESOLVED':
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">Đã giải quyết</span>
      case 'CLOSED':
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-300">Đã đóng</span>
      case 'REOPENED':
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">Mở lại xử lý</span>
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
                      {activeContracts.length > 0 ? (
                        activeContracts.map(c => (
                          <option key={c.unitCode} value={c.unitCode}>
                            Kho #{c.unitCode} ({c.facilityName})
                          </option>
                        ))
                      ) : (
                        <option value="general">Chưa có kho hoạt động</option>
                      )}
                      <option value="general">Khác / Thắc mắc chung</option>
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
                      <option value="LOCK_ISSUE">Sự cố khóa thông minh / Kẹt cửa cuốn</option>
                      <option value="PIN_CODE">Yêu cầu cấp lại mã PIN mới</option>
                      <option value="RETURN_REFUND">👉 Yêu cầu trả kho trước hạn &amp; hoàn tiền</option>
                      <option value="RETURN_EXPIRED">👉 Yêu cầu trả kho khi hết hạn hợp đồng</option>
                      <option value="ACCESS_ISSUE">Ủy quyền mở kho cho tài xế / người thân</option>
                      <option value="CLIMATE_TEMP">Kiểm tra nhiệt độ / độ ẩm phòng kho</option>
                      <option value="PAYMENT_ISSUE">Hỗ trợ thanh toán &amp; Hóa đơn VAT</option>
                      <option value="OTHER">Vấn đề khác</option>
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
                      placeholder="Ví dụ: Cửa cuốn kẹt ray, Cần hướng dẫn thủ tục hoàn cọc..."
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
                <option value="OPEN">Đã tiếp nhận (OPEN)</option>
                <option value="IN_PROGRESS">Đang xử lý (IN_PROGRESS)</option>
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

              {/* Refund Info Section for RETURN_REFUND */}
              {selectedTicket.category === 'RETURN_REFUND' && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 space-y-2 text-amber-950">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-amber-700">currency_exchange</span>
                      <span>Thông tin quyết toán &amp; hoàn tiền:</span>
                    </span>
                    {getRefundBadge(selectedTicket)}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div>
                      <span className="text-amber-800 text-[11px] block">Số tiền hoàn duyệt:</span>
                      <strong className="text-sm font-mono text-emerald-700 block">
                        {selectedTicket.refundAmount ? formatVND(selectedTicket.refundAmount) : 'Chờ đối soát thực địa'}
                      </strong>
                    </div>

                    <div>
                      <span className="text-amber-800 text-[11px] block">Tài khoản thụ hưởng:</span>
                      {selectedTicket.bankAccountNumber ? (
                        <span className="font-mono text-xs block">
                          {selectedTicket.bankName} · ****{selectedTicket.bankAccountNumber.slice(-4)} ({selectedTicket.bankAccountName})
                        </span>
                      ) : (
                        <span className="italic text-amber-700 text-xs block">Chưa cung cấp</span>
                      )}
                    </div>
                  </div>

                  {selectedTicket.fmApprovalNote && (
                    <div className="text-[11px] bg-white/70 p-2 rounded-lg border border-amber-200 mt-1">
                      <strong>Ghi chú duyệt của quản lý:</strong> {selectedTicket.fmApprovalNote}
                    </div>
                  )}

                  {selectedTicket.transferTransactionRef && (
                    <div className="text-[11px] bg-emerald-50 text-emerald-950 p-2.5 rounded-lg border border-emerald-300 mt-1 space-y-1">
                      <div>
                        <strong>Mã giao dịch giải ngân:</strong> <span className="font-mono font-bold">{selectedTicket.transferTransactionRef}</span>
                      </div>
                      {selectedTicket.transferConfirmedAt && (
                        <div>Thời gian chuyển khoản: {formatTimeStr(selectedTicket.transferConfirmedAt)}</div>
                      )}
                      {selectedTicket.transferProofUrl && (
                        <a
                          href={selectedTicket.transferProofUrl}
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

                  {/* Button to open bank form if awaiting */}
                  {selectedTicket.refundStatus === 'AWAITING_CUSTOMER_BANK_INFO' && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setBankInfoTicket(selectedTicket)
                          setBankName(selectedTicket.bankName || '')
                          setBankAccountNumber(selectedTicket.bankAccountNumber || '')
                          setBankAccountName(selectedTicket.bankAccountName || user?.fullName || '')
                        }}
                        className="w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">account_balance</span>
                        <span>Cung Cấp Thông Tin Ngân Hàng Nhận Tiền Hoàn</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

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
    </div>
  )
}
