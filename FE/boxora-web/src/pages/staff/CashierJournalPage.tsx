import React, { useState, useEffect, useMemo } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { paymentService, PaymentItem } from '../../services/paymentService'
import { Facility } from '../../types'

const localDateInput = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const getWeekRange = (refDate: Date): { from: string; to: string } => {
  const d = new Date(refDate)
  const day = d.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setDate(d.getDate() + diffToMonday)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return {
    from: localDateInput(monday),
    to: localDateInput(sunday)
  }
}

export type DatePreset = 'TODAY' | 'THIS_WEEK' | 'LAST_WEEK' | 'THIS_MONTH' | 'LAST_MONTH' | 'ALL' | 'CUSTOM'

const paymentTypeLabel = (type: string) => ({
  DEPOSIT: 'Tiền cọc',
  RENTAL_FEE: 'Tiền thuê',
  RENEWAL_FEE: 'Gia hạn thuê',
  EXTRA_CHARGE: 'Phụ phí',
  BOOKING_PAYMENT: 'Thanh toán đơn đặt'
}[type] || type)

const paymentStatusLabel = (status: string) => ({
  PAID: 'Đã thanh toán',
  PENDING: 'Chờ thanh toán',
  FAILED: 'Thất bại',
  EXPIRED: 'Hết hạn',
  REFUND_PENDING: 'Chờ hoàn tiền',
  REFUNDED: 'Đã hoàn tiền'
}[status] || status)

export const CashierJournalPage: React.FC = () => {
  const { user } = useAuth()
  const { selectedFacility, facilities: contextFacilities } = useOutletContext<{
    selectedFacility?: string
    facilities?: Facility[]
  }>() || {}

  const [payments, setPayments] = useState<PaymentItem[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'RENTAL' | 'DEPOSIT' | 'BOOKING_PAYMENT'>('ALL')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'PENDING' | 'FAILED' | 'EXPIRED' | 'REFUND_PENDING' | 'REFUNDED'>('ALL')
  const [periodStart, setPeriodStart] = useState(() => localDateInput(new Date()))
  const [periodEnd, setPeriodEnd] = useState(() => localDateInput(new Date()))
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1)
  const pageSize = 10

  const activeFacilityId = useMemo(() => {
    if (user?.role?.name === 'FACILITY_MANAGER' || user?.role?.name === 'STAFF') {
      return user.facilityId
    }
    return selectedFacility && selectedFacility !== 'ALL' ? selectedFacility : undefined
  }, [user, selectedFacility])

  const currentFacilityName = useMemo(() => {
    if (user?.facilityName) return user.facilityName
    if (activeFacilityId && contextFacilities) {
      const match = contextFacilities.find(f => f.id === activeFacilityId)
      if (match) return match.name
    }
    return 'Cơ sở chưa xác nhận'
  }, [user?.facilityName, activeFacilityId, contextFacilities])

  const fetchPayments = async () => {
    setIsLoading(true)
    setFetchError(null)
    if ((user?.role?.name === 'STAFF' || user?.role?.name === 'FACILITY_MANAGER') && !user.facilityId) {
      setPayments([])
      setFetchError('No facility is assigned to this account.')
      setIsLoading(false)
      return
    }
    try {
      const allPayments: PaymentItem[] = []
      let page = 0
      let totalPages = 1
      do {
        const result = await paymentService.getPaymentsPage({
          page,
          size: 100,
          facilityId: activeFacilityId,
          fromDate: `${periodStart}T00:00:00`,
          toDate: `${periodEnd}T23:59:59`
        })
        allPayments.push(...(result?.content || []))
        totalPages = result?.totalPages || 0
        page += 1
      } while (page < totalPages)
      setPayments(allPayments)
    } catch (err: any) {
      console.warn('Failed to fetch payment journal:', err)
      setFetchError(err?.response?.data?.message || err?.message || 'Could not load the payment journal.')
      setPayments([])
    } finally {
      setIsLoading(false)
    }
  }


  useEffect(() => {
    fetchPayments()
  }, [activeFacilityId, periodStart, periodEnd, user?.role?.name, user?.facilityId])

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, typeFilter, statusFilter, periodStart, periodEnd])

  // Calculations
  const shiftTotalCollected = useMemo(() => {
    return payments
      .filter(p => p.status === 'PAID')
      .reduce((sum, p) => sum + (p.amount || 0), 0)
  }, [payments])

  const shiftRentalRevenue = useMemo(() => {
    return payments
      .filter(p => p.status === 'PAID' && ['RENTAL_FEE', 'RENEWAL_FEE', 'EXTRA_CHARGE'].includes(p.paymentType))
      .reduce((sum, p) => sum + (p.amount || 0), 0)
  }, [payments])

  const shiftDepositRevenue = useMemo(() => {
    return payments
      .filter(p => p.status === 'PAID' && p.paymentType === 'DEPOSIT')
      .reduce((sum, p) => sum + (p.amount || 0), 0)
  }, [payments])

  const shiftBookingPayments = useMemo(() => payments
    .filter(p => p.status === 'PAID' && p.paymentType === 'BOOKING_PAYMENT')
    .reduce((sum, p) => sum + (p.amount || 0), 0), [payments])

  const completedRefunds = useMemo(() => payments
    .filter(p => p.status === 'REFUNDED')
    .reduce((sum, p) => sum + (p.amount || 0), 0), [payments])

  // Filtered Payments
  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      // Type filter
      if (typeFilter === 'DEPOSIT' && p.paymentType !== 'DEPOSIT') return false
      if (typeFilter === 'BOOKING_PAYMENT' && p.paymentType !== 'BOOKING_PAYMENT') return false
      if (typeFilter === 'RENTAL' && !['RENTAL_FEE', 'RENEWAL_FEE', 'EXTRA_CHARGE'].includes(p.paymentType)) return false

      // Status filter
      if (statusFilter !== 'ALL' && p.status !== statusFilter) return false

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim()
        const matchId = p.id.toLowerCase().includes(query) || (p.transactionId && p.transactionId.toLowerCase().includes(query))
        const matchUnit = p.unitCode && p.unitCode.toLowerCase().includes(query)
        const matchCust = p.customerName && p.customerName.toLowerCase().includes(query)
        if (!matchId && !matchUnit && !matchCust) return false
      }

      return true
    })
  }, [payments, typeFilter, statusFilter, searchQuery])

  // Pagination Slice
  const totalItems = filteredPayments.length
  const totalPages = Math.ceil(totalItems / pageSize) || 1
  const paginatedPayments = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    return filteredPayments.slice(startIndex, startIndex + pageSize)
  }, [filteredPayments, currentPage, pageSize])

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/60 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[28px]">point_of_sale</span>
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Báo Cáo Doanh Thu, Dòng Tiền Cơ Sở &amp; Thu Ngân
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                {currentFacilityName}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Nhật ký thanh toán trong kỳ. Trạng thái chờ, thất bại và hoàn tiền được hạch toán tách biệt với thực nhận.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchPayments}
            disabled={isLoading}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
            title="Tải lại danh sách thanh toán mới nhất"
          >
            <span className={`material-symbols-outlined text-[16px] ${isLoading ? 'animate-spin' : ''}`}>
              refresh
            </span>
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* 4 Financial KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Tổng thực thu */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Tổng thu ngân thực nhận</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <span className="material-symbols-outlined text-[18px]">payments</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">
              {isLoading ? (
                <span className="inline-block w-28 h-7 bg-slate-100 animate-pulse rounded"></span>
              ) : (
                `${shiftTotalCollected.toLocaleString('vi-VN')} ₫`
              )}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              <span className="font-semibold text-emerald-600">
                {payments.filter(p => p.status === 'PAID').length}
              </span> giao dịch đã thanh toán
              <div>Thanh toán đơn đặt: {isLoading ? "Đang tải..." : `${shiftBookingPayments.toLocaleString("vi-VN")} ₫`}</div>
            </div>
          </div>
        </div>

        {/* Card 2: Tiền thuê */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Thu tiền thuê kho &amp; gia hạn</span>
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <span className="material-symbols-outlined text-[18px]">receipt_long</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-blue-900 font-mono tracking-tight">
              {isLoading ? (
                <span className="inline-block w-28 h-7 bg-slate-100 animate-pulse rounded"></span>
              ) : (
                `${shiftRentalRevenue.toLocaleString('vi-VN')} ₫`
              )}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Phí dịch vụ lưu trữ định kỳ
            </div>
          </div>
        </div>

        {/* Card 3: Tiền cọc */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Thu tiền cọc nhận kho (Ký quỹ)</span>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <span className="material-symbols-outlined text-[18px]">savings</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-amber-900 font-mono tracking-tight">
              {isLoading ? (
                <span className="inline-block w-28 h-7 bg-slate-100 animate-pulse rounded"></span>
              ) : (
                `${shiftDepositRevenue.toLocaleString('vi-VN')} ₫`
              )}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Cọc giữ kho &amp; bảo chứng tài sản
            </div>
          </div>
        </div>

        {/* Completed refunds: Tỷ lệ khớp lệnh */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Tiền hoàn cọc đã chi trả</span>
            <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
              <span className="material-symbols-outlined text-[18px]">task_alt</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">
              {isLoading ? <span className="inline-block w-20 h-7 bg-slate-100 animate-pulse rounded"></span> : `${completedRefunds.toLocaleString('vi-VN')} ₫`}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Tiền hoàn cọc đã chi trả; hiển thị tách biệt với thực thu
            </div>
          </div>
        </div>
      </div>

      {/* Main Ledger Table with Search, Filter & Pagination */}
      {fetchError && <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">{fetchError}</div>}
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
                placeholder="Tìm mã GD, mã kho (#A-101), khách hàng..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white font-mono"
              />
            </div>

            <label className="flex items-center gap-1.5 text-[11px] text-slate-600">
              Từ ngày
              <input type="date" value={periodStart} max={periodEnd} onChange={(e) => setPeriodStart(e.target.value)} className="px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg" />
            </label>
            <label className="flex items-center gap-1.5 text-[11px] text-slate-600">
              Đến ngày
              <input type="date" value={periodEnd} min={periodStart} onChange={(e) => setPeriodEnd(e.target.value)} className="px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg" />
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none cursor-pointer"
            >
              <option value="ALL">Tất cả loại giao dịch</option>
              <option value="RENTAL">Tiền thuê, gia hạn &amp; phụ phí</option>
              <option value="DEPOSIT">Tiền cọc</option>
              <option value="BOOKING_PAYMENT">Thanh toán đơn đặt</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none cursor-pointer"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="PAID">Đã thanh toán / Đã thu</option>
              <option value="PENDING">Đang chờ xử lý</option>
              <option value="FAILED">Thất bại</option>
              <option value="EXPIRED">Hết hạn</option>
              <option value="REFUND_PENDING">Chờ hoàn tiền</option>
              <option value="REFUNDED">Đã hoàn tiền</option>
            </select>
          </div>
        </div>

        {/* Real Ledger Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <th className="py-3 px-3.5">Mã GD / Giờ nhận</th>
                <th className="py-3 px-3.5">Khách hàng</th>
                <th className="py-3 px-3.5">Mã Kho</th>
                <th className="py-3 px-3.5">Loại thanh toán</th>
                <th className="py-3 px-3.5">Phương thức</th>
                <th className="py-3 px-3.5 text-right">Số tiền</th>
                <th className="py-3 px-3.5 text-center">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined animate-spin text-[20px] text-emerald-600">
                        progress_activity
                      </span>
                      <span>Đang nạp dữ liệu thu ngân trực tiếp từ database...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedPayments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-[32px] text-slate-300">receipt_long</span>
                      <span>Không tìm thấy giao dịch nào phù hợp với bộ lọc hiện tại.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedPayments.map((p) => {
                  const isSuccess = p.status === 'PAID'
                  const isPending = p.status === 'PENDING' || p.status === 'REFUND_PENDING'

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3.5">
                        <div className="font-mono font-medium text-slate-900">{(p.transactionId || p.id).slice(0, 18)}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {p.paymentTime
                            ? new Date(p.paymentTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                            : '—'}
                        </div>
                      </td>
                      <td className="py-3 px-3.5 font-medium text-slate-800">
                        {p.customerName || 'Unknown customer'}
                      </td>
                      <td className="py-3 px-3.5">
                        <span className="font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                          {p.unitCode || 'N/A'}
                        </span>
                      </td>
                      <td className="py-3 px-3.5">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                          p.paymentType === 'DEPOSIT'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          {paymentTypeLabel(p.paymentType)}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-slate-600 font-medium">
                        {p.paymentMethod || 'Unspecified'}
                      </td>
                      <td className="py-3 px-3.5 text-right font-bold text-slate-900 font-mono">
                        {p.status === 'REFUNDED' ? '−' : ''}{p.amount.toLocaleString('vi-VN')} ₫
                      </td>
                      <td className="py-3 px-3.5 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          isSuccess
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : isPending
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}>
                          {paymentStatusLabel(p.status)}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Toolbar - Centered */}
        <div className="relative flex flex-col md:flex-row items-center justify-between gap-3 pt-3.5 border-t border-slate-100 text-xs text-slate-500">
          <div className="text-center md:text-left">
            Hiển thị <span className="font-semibold text-slate-800 font-mono">{totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1}</span> -{' '}
            <span className="font-semibold text-slate-800 font-mono">{Math.min(currentPage * pageSize, totalItems)}</span> trên tổng số{' '}
            <span className="font-semibold text-slate-800 font-mono">{totalItems}</span> giao dịch
          </div>

          <div className="flex items-center justify-center gap-1.5 md:absolute md:left-1/2 md:-translate-x-1/2">
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

          <div className="hidden md:block w-28 pointer-events-none" aria-hidden="true" />
        </div>
      </div>
    </div>
  )
}
