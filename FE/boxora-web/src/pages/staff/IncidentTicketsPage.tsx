import React, { useState, useEffect, useMemo } from 'react'
import { supportTicketService, SupportTicketRecord } from '../../services/supportTicketService'
import { useAuth } from '../../context/AuthContext'

interface TicketItem {
  id: string
  backendId?: string
  title: string
  detail: string
  location: string
  priority: string
  staff: string
  time: string
  status: string
  evidenceUrls?: string[]
}

export const IncidentTicketsPage: React.FC = () => {
  const { user } = useAuth()
  const [tickets, setTickets] = useState<TicketItem[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'IN_PROGRESS' | 'RESOLVED'>('ALL')

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(10)

  // Create Ticket Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newCategory, setNewCategory] = useState('LOCK_ISSUE')
  const [newUnitCode, setNewUnitCode] = useState('')
  const [newPriority, setNewPriority] = useState('MEDIUM')
  const [newDescription, setNewDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitNotice, setSubmitNotice] = useState<string | null>(null)

  // Evidence Preview Modal State
  const [activeEvidence, setActiveEvidence] = useState<{
    id: string
    title: string
    detail: string
    location: string
    evidenceUrls?: string[]
  } | null>(null)

  const fetchTickets = async () => {
    setIsLoading(true)
    try {
      const res = await supportTicketService.getQueue()
      if (res && Array.isArray(res)) {
        const mapped: TicketItem[] = res.map((t: SupportTicketRecord) => ({
          id: t.ticketCode || (t.id ? `#TK-${t.id.slice(0, 4)}` : '#TK-0000'),
          backendId: t.id,
          title: t.title || 'Sự cố thiết bị',
          detail: t.customerName ? `${t.customerName} - ${t.description || 'Chi tiết hiện trường'}` : (t.description || 'Chi tiết hiện trường'),
          location: t.unitCode ? `Kho #${t.unitCode}` : (t.category || 'Khu vực kho'),
          priority: t.priority || 'MEDIUM',
          staff: t.customerName ? `Khách: ${t.customerName}` : (user?.fullName || 'Nhân viên trực ca'),
          time: t.createdAt ? new Date(t.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'Hôm nay',
          status: t.status || 'IN_PROGRESS',
          evidenceUrls: t.evidenceUrls
        }))
        setTickets(mapped)
      } else {
        setTickets([])
      }
    } catch (err) {
      console.warn('Failed to fetch ticket queue:', err)
      setTickets([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchTickets()
  }, [])

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, priorityFilter, statusFilter, pageSize])

  const handleResolveTicket = async (ticketId: string, backendId?: string) => {
    try {
      const targetId = backendId || ticketId.replace('#', '')
      if (targetId) {
        await supportTicketService.resolveTicket(targetId, 'Đã kiểm tra hiện trường và xử lý xong tại chỗ bởi nhân viên')
        setTickets(prev => prev.map(t => (t.id === ticketId || (backendId && t.backendId === backendId)) ? { ...t, status: 'RESOLVED' } : t))
      }
    } catch (err: any) {
      console.error('Ticket resolve failed:', err)
      const msg = err?.response?.data?.message || err?.message || 'Không thể cập nhật trạng thái phiếu sự cố trên máy chủ.'
      alert(msg)
    }
  }

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return

    setIsSubmitting(true)
    try {
      const createdTicket = await supportTicketService.createTicket({
        category: newCategory,
        title: newTitle.trim(),
        description: newDescription.trim() || 'Báo cáo sự cố tại hiện trường',
        priority: newPriority
      })

      const ticketCode = createdTicket?.ticketCode
        ? `#${createdTicket.ticketCode}`
        : createdTicket?.id
          ? `#TK-${createdTicket.id.slice(0, 8).toUpperCase()}`
          : ''

      const newTk: TicketItem = {
        id: ticketCode,
        title: newTitle.trim(),
        detail: newDescription.trim() || 'Sự cố được nhân viên trực tiếp ghi nhận tại hiện trường.',
        location: newUnitCode.trim() ? `Kho #${newUnitCode.trim()}` : 'Khu vực cơ sở',
        priority: newPriority,
        staff: user?.fullName || 'Nhân viên trực ca',
        time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        status: 'IN_PROGRESS'
      }

      setTickets([newTk, ...tickets])
      setSubmitNotice('Đã tạo phiếu sự cố thành công!')
      setTimeout(() => {
        setIsCreateModalOpen(false)
        setSubmitNotice(null)
        setNewTitle('')
        setNewUnitCode('')
        setNewDescription('')
      }, 1000)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Filtered Tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      // Priority filter
      if (priorityFilter !== 'ALL' && t.priority !== priorityFilter) return false

      // Status filter
      if (statusFilter === 'IN_PROGRESS' && t.status === 'RESOLVED') return false
      if (statusFilter === 'RESOLVED' && t.status !== 'RESOLVED') return false

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim()
        const matchId = t.id.toLowerCase().includes(query)
        const matchTitle = t.title.toLowerCase().includes(query)
        const matchDetail = t.detail.toLowerCase().includes(query)
        const matchLoc = t.location.toLowerCase().includes(query)
        const matchStaff = t.staff.toLowerCase().includes(query)
        if (!matchId && !matchTitle && !matchDetail && !matchLoc && !matchStaff) return false
      }

      return true
    })
  }, [tickets, priorityFilter, statusFilter, searchQuery])

  // KPI Metrics
  const inProgressCount = useMemo(() => tickets.filter(t => t.status !== 'RESOLVED').length, [tickets])
  const criticalCount = useMemo(() => tickets.filter(t => t.priority === 'CRITICAL' || t.priority === 'HIGH').length, [tickets])
  const resolvedCount = useMemo(() => tickets.filter(t => t.status === 'RESOLVED').length, [tickets])

  // Pagination Slice
  const totalItems = filteredTickets.length
  const totalPages = Math.ceil(totalItems / pageSize) || 1
  const paginatedTickets = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    return filteredTickets.slice(startIndex, startIndex + pageSize)
  }, [filteredTickets, currentPage, pageSize])

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case 'CRITICAL':
        return 'bg-rose-50 text-rose-700 border-rose-300 ring-1 ring-rose-200'
      case 'HIGH':
        return 'bg-orange-50 text-orange-700 border-orange-200'
      case 'MEDIUM':
        return 'bg-amber-50 text-amber-800 border-amber-200'
      case 'LOW':
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200'
    }
  }

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 border border-rose-200/60 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[28px]">build_circle</span>
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Danh Sách Ticket Xử Lý Sự Cố Tại Chỗ
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                On-site Issue Queue
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Điều phối nhân sự kỹ thuật, an ninh và xử lý tức thời các vấn đề khóa thông minh, cửa cuốn, nguồn điện và phần cứng
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchTickets}
            disabled={isLoading}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
          >
            <span className={`material-symbols-outlined text-[16px] ${isLoading ? 'animate-spin' : ''}`}>
              refresh
            </span>
            <span>Làm mới</span>
          </button>
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-slate-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">add_alert</span>
            <span>Tạo Báo Cáo Mới</span>
          </button>
        </div>
      </div>

      {/* 4 Incident KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Tổng ticket */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Tổng sự cố ghi nhận</span>
            <div className="p-1.5 rounded-lg bg-slate-100 text-slate-700">
              <span className="material-symbols-outlined text-[18px]">confirmation_number</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">
              {isLoading ? <span className="inline-block w-16 h-7 bg-slate-100 animate-pulse rounded"></span> : tickets.length}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Toàn bộ sự cố trong ca làm việc
            </div>
          </div>
        </div>

        {/* Card 2: Đang xử lý */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Sự cố đang xử lý</span>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <span className="material-symbols-outlined text-[18px]">pending_actions</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-amber-900 font-mono tracking-tight">
              {isLoading ? <span className="inline-block w-16 h-7 bg-slate-100 animate-pulse rounded"></span> : inProgressCount}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Cần nhân viên có mặt xử lý
            </div>
          </div>
        </div>

        {/* Card 3: Khẩn cấp */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Mức độ Khẩn / Nguy cấp</span>
            <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
              <span className="material-symbols-outlined text-[18px]">warning</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-rose-700 font-mono tracking-tight">
              {isLoading ? <span className="inline-block w-16 h-7 bg-slate-100 animate-pulse rounded"></span> : criticalCount}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Ưu tiên phản ứng dưới 15 phút
            </div>
          </div>
        </div>

        {/* Card 4: Đã hoàn tất */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Đã nghiệm thu xử lý xong</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-emerald-700 font-mono tracking-tight">
              {isLoading ? <span className="inline-block w-16 h-7 bg-slate-100 animate-pulse rounded"></span> : resolvedCount}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Khôi phục trạng thái an toàn
            </div>
          </div>
        </div>
      </div>

      {/* Main Ticket Queue Table with Search, Filter & Pagination */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col gap-4">
        {/* Controls Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap flex-1">
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm mã ticket, mô tả sự cố, kho, kỹ thuật..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-rose-500 focus:bg-white font-mono"
              />
            </div>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as any)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none cursor-pointer"
            >
              <option value="ALL">Tất cả mức ưu tiên</option>
              <option value="CRITICAL">Nguy cấp (Critical)</option>
              <option value="HIGH">Ưu tiên cao (High)</option>
              <option value="MEDIUM">Bình thường (Medium)</option>
              <option value="LOW">Thấp (Low)</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none cursor-pointer"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="IN_PROGRESS">Đang xử lý (In Progress)</option>
              <option value="RESOLVED">Đã giải quyết (Resolved)</option>
            </select>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-slate-500 font-medium">Hiển thị:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 cursor-pointer"
            >
              <option value={5}>5 / trang</option>
              <option value={10}>10 / trang</option>
              <option value={20}>20 / trang</option>
            </select>
          </div>
        </div>

        {/* Tickets Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 font-mono uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3.5">Mã Ticket</th>
                <th className="py-3 px-3.5">Mô Tả Chi Tiết Sự Cố</th>
                <th className="py-3 px-3.5">Vị Trí &amp; Kho</th>
                <th className="py-3 px-3.5 text-center">Độ Ưu Tiên</th>
                <th className="py-3 px-3.5">Phụ Trách</th>
                <th className="py-3 px-3.5">Thời Gian</th>
                <th className="py-3 px-3.5 text-center">Trạng Thái</th>
                <th className="py-3 px-3.5 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined animate-spin text-[20px] text-rose-600">
                        progress_activity
                      </span>
                      <span>Đang nạp danh sách ticket xử lý sự cố...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedTickets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-[32px] text-slate-300">task_alt</span>
                      <span>Không có sự cố nào phù hợp với bộ lọc hiện tại. Cơ sở hoạt động ổn định!</span>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedTickets.map((t) => {
                  const isResolved = t.status === 'RESOLVED'

                  return (
                    <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3.5">
                        <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {t.id}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 max-w-sm">
                        <div className="font-semibold text-slate-900 text-xs mb-0.5">{t.title}</div>
                        <div className="text-[11px] text-slate-500 line-clamp-2">{t.detail}</div>
                      </td>
                      <td className="py-3 px-3.5">
                        <span className="font-mono font-medium text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                          {t.location}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold border ${getPriorityBadge(t.priority)}`}>
                          {t.priority}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-slate-700 font-medium">
                        {t.staff}
                      </td>
                      <td className="py-3 px-3.5 text-slate-500 font-mono text-[11px]">
                        {t.time}
                      </td>
                      <td className="py-3 px-3.5 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          isResolved
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}>
                          {isResolved ? 'Đã giải quyết' : 'Đang xử lý'}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {!isResolved ? (
                            <button
                              type="button"
                              onClick={() => handleResolveTicket(t.id, t.backendId)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] shadow-2xs transition-all cursor-pointer flex items-center gap-1"
                              title="Xác nhận hoàn tất xử lý hiện trường"
                            >
                              <span className="material-symbols-outlined text-[13px]">check</span>
                              <span>Xong</span>
                            </button>
                          ) : (
                            <span className="text-emerald-600 text-xs font-semibold flex items-center gap-0.5">
                              <span className="material-symbols-outlined text-[15px]">verified</span>
                              <span>Hoàn tất</span>
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => setActiveEvidence(t)}
                            className="p-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                            title="Xem chi tiết sự cố"
                          >
                            <span className="material-symbols-outlined text-[17px]">visibility</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs text-slate-500">
          <div>
            Hiển thị <span className="font-semibold text-slate-800 font-mono">{totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1}</span> -{' '}
            <span className="font-semibold text-slate-800 font-mono">{Math.min(currentPage * pageSize, totalItems)}</span> trên tổng số{' '}
            <span className="font-semibold text-slate-800 font-mono">{totalItems}</span> ticket sự cố
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              title="Trang trước"
            >
              <span className="material-symbols-outlined text-[16px]">chevron_left</span>
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNumber => {
              if (
                totalPages > 7 &&
                pageNumber !== 1 &&
                pageNumber !== totalPages &&
                Math.abs(pageNumber - currentPage) > 2
              ) {
                if (pageNumber === 2 || pageNumber === totalPages - 1) {
                  return <span key={pageNumber} className="px-1 text-slate-400">...</span>
                }
                return null
              }

              const isActive = currentPage === pageNumber
              return (
                <button
                  key={pageNumber}
                  type="button"
                  onClick={() => setCurrentPage(pageNumber)}
                  className={`min-w-[28px] h-7 px-2 rounded-lg font-mono text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {pageNumber}
                </button>
              )
            })}

            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              title="Trang kế tiếp"
            >
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Tạo Báo Cáo Sự Cố Mới */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-rose-100 text-rose-600">
                  <span className="material-symbols-outlined text-[20px]">add_alert</span>
                </div>
                <h3 className="text-base font-bold text-slate-900">Tạo Phiếu Xử Lý Sự Cố Tại Chỗ</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="p-5 flex flex-col gap-4">
              {submitNotice && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-emerald-600">check_circle</span>
                  <span>{submitNotice}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tiêu đề sự cố *</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ví dụ: Kẹt cửa cuốn kho A-102, Hỏng khóa điện tử..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-rose-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Danh mục sự cố</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none cursor-pointer"
                  >
                    <option value="LOCK_ISSUE">Khóa điện tử SmartLock</option>
                    <option value="HARDWARE_DOOR">Cửa cuốn &amp; Bản lề cơ khí</option>
                    <option value="FACILITY_DAMAGE">Cơ sở vật chất &amp; Sàn kho</option>
                    <option value="CLIMATE_CONTROL">Cảm biến nhiệt ẩm vi khí hậu</option>
                    <option value="ELECTRICAL">Hệ thống điện &amp; Chiếu sáng</option>
                    <option value="OTHER">Vấn đề khác</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Mức độ ưu tiên</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none cursor-pointer"
                  >
                    <option value="LOW">Thấp (Low - trong 24h)</option>
                    <option value="MEDIUM">Vừa (Medium - trong ca trực)</option>
                    <option value="HIGH">Cao (High - trong 2h)</option>
                    <option value="CRITICAL">Nguy cấp (Critical - xử lý ngay)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Vị trí / Mã kho liên quan</label>
                <input
                  type="text"
                  value={newUnitCode}
                  onChange={(e) => setNewUnitCode(e.target.value)}
                  placeholder="Ví dụ: A-102, B-205, Hành lang số 2..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-rose-500 focus:bg-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mô tả hiện trường</label>
                <textarea
                  rows={3}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Mô tả chi tiết nguyên nhân, hiện trạng hư hỏng hoặc yêu cầu phối hợp kỹ thuật..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-rose-500 focus:bg-white resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">save</span>
                  <span>{isSubmitting ? 'Đang tạo...' : 'Lưu & Phân Phối'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Xem Chi Tiết & Minh Chứng */}
      {activeEvidence && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-xs bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-slate-800">
                  {activeEvidence.id}
                </span>
                <h3 className="text-sm font-bold text-slate-900 truncate max-w-[240px]">
                  {activeEvidence.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveEvidence(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="p-4 flex flex-col gap-3">
              <div className="text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="text-slate-500 text-[11px] mb-1">Vị trí: <strong className="text-slate-800 font-mono">{activeEvidence.location}</strong></div>
                <div className="text-slate-700 leading-relaxed">{activeEvidence.detail}</div>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                  Minh chứng ảnh hiện trường
                </span>
                <div className="w-full h-44 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center relative">
                  <img
                    src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800&auto=format&fit=crop&q=80"
                    alt="Hiện trường sự cố"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-2 left-2 px-2 py-1 bg-slate-900/80 backdrop-blur-xs rounded text-white text-[10px] font-mono">
                    Ảnh ghi nhận camera giám sát
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setActiveEvidence(null)}
                  className="px-4 py-2 bg-slate-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
