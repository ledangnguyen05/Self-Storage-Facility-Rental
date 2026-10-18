import React, { useState, useEffect, useMemo } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { paymentService, PaymentItem } from '../../services/paymentService'
import { Facility } from '../../types'

export const CashierJournalPage: React.FC = () => {
  const { user } = useAuth()
  const { selectedFacility, facilities: contextFacilities } = useOutletContext<{
    selectedFacility?: string
    facilities?: Facility[]
  }>() || {}

  const [payments, setPayments] = useState<PaymentItem[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'RENTAL' | 'DEPOSIT'>('ALL')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SUCCESS' | 'PENDING' | 'FAILED'>('ALL')

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1)
  const pageSize = 10

  const activeFacilityId = useMemo(() => {
    if (user?.role?.name === 'FACILITY_MANAGER' || user?.role?.name === 'STAFF') {
      return user.facilityId || (selectedFacility !== 'ALL' ? selectedFacility : undefined)
    }
    return selectedFacility && selectedFacility !== 'ALL' ? selectedFacility : undefined
  }, [user, selectedFacility])

  const currentFacilityName = useMemo(() => {
    if (user?.facilityName) return user.facilityName
    if (activeFacilityId && contextFacilities) {
      const match = contextFacilities.find(f => f.id === activeFacilityId)
      if (match) return match.name
    }
    return 'Tất cả cơ sở'
  }, [user?.facilityName, activeFacilityId, contextFacilities])

  const fetchPayments = async () => {
    setIsLoading(true)
    try {
      const res = await paymentService.getPayments({
        size: 150,
        facilityId: activeFacilityId || undefined,
        status: undefined // fetch all to show realistic shift ledger
      })
      if (Array.isArray(res)) {
        setPayments(res)
      } else {
        setPayments([])
      }
    } catch (err) {
      console.warn('Failed to fetch shift payments:', err)
      setPayments([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchPayments()
  }, [activeFacilityId])

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, typeFilter, statusFilter])

  // Calculations
  const shiftTotalCollected = useMemo(() => {
    return payments
      .filter(p => p.status === 'SUCCESS' || p.status === 'PAID')
      .reduce((sum, p) => sum + (p.amount || 0), 0)
  }, [payments])

  const shiftRentalRevenue = useMemo(() => {
    return payments
      .filter(p => (p.status === 'SUCCESS' || p.status === 'PAID') && p.paymentType !== 'DEPOSIT')
      .reduce((sum, p) => sum + (p.amount || 0), 0)
  }, [payments])

  const shiftDepositRevenue = useMemo(() => {
    return payments
      .filter(p => (p.status === 'SUCCESS' || p.status === 'PAID') && p.paymentType === 'DEPOSIT')
      .reduce((sum, p) => sum + (p.amount || 0), 0)
  }, [payments])

  const successRate = useMemo(() => {
    if (payments.length === 0) return '100%'
    const successCount = payments.filter(p => p.status === 'SUCCESS' || p.status === 'PAID').length
    return `${Math.round((successCount / payments.length) * 100)}%`
  }, [payments])

  // Filtered Payments
  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      // Type filter
      if (typeFilter === 'DEPOSIT' && p.paymentType !== 'DEPOSIT') return false
      if (typeFilter === 'RENTAL' && p.paymentType === 'DEPOSIT') return false

      // Status filter
      const isSuccess = p.status === 'SUCCESS' || p.status === 'PAID'
      const isPending = p.status === 'PENDING'
      const isFailed = p.status === 'FAILED' || p.status === 'CANCELLED'

      if (statusFilter === 'SUCCESS' && !isSuccess) return false
      if (statusFilter === 'PENDING' && !isPending) return false
      if (statusFilter === 'FAILED' && !isFailed) return false

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

  const handleExportCsv = () => {
    const headers = ['Mã GD', 'Thời Gian', 'Khách Hàng', 'Mã Kho', 'Loại Giao Dịch', 'Phương Thức', 'Số Tiền (VND)', 'Trạng Thái']
    const rows = filteredPayments.map(p => [
      p.id,
      p.paymentTime ? new Date(p.paymentTime).toLocaleString('vi-VN') : '',
      `"${p.customerName || 'Khách hàng Boxora'}"`,
      p.unitCode || '',
      p.paymentType === 'DEPOSIT' ? 'Tiền ký quỹ (Cọc)' : 'Tiền thuê kho',
      p.paymentMethod || 'VNPay',
      p.amount,
      p.status === 'SUCCESS' || p.status === 'PAID' ? 'Thành công' : p.status === 'PENDING' ? 'Chờ xử lý' : 'Thất bại'
    ])

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `So_Thu_Ngan_Ca_Truc_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

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
            <p className="text-xs text-slate-500 mt-1">
              Báo cáo tài chính hợp nhất: Tổng doanh thu cơ sở, phí thuê kho, cọc lưu ký, nợ cước và sổ cái đối soát cổng VNPay
            </p>
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
          <button
            type="button"
            onClick={handleExportCsv}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            <span>Xuất CSV</span>
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
                {payments.filter(p => p.status === 'SUCCESS' || p.status === 'PAID').length}
              </span> giao dịch hợp lệ
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

        {/* Card 4: Tỷ lệ khớp lệnh */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Tỷ lệ khớp lệnh ca trực</span>
            <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
              <span className="material-symbols-outlined text-[18px]">task_alt</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">
              {isLoading ? (
                <span className="inline-block w-20 h-7 bg-slate-100 animate-pulse rounded"></span>
              ) : (
                successRate
              )}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Khớp lệnh thanh toán thành công
            </div>
          </div>
        </div>
      </div>

      {/* Main Ledger Table with Search, Filter & Pagination */}
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

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none cursor-pointer"
            >
              <option value="ALL">Tất cả loại giao dịch</option>
              <option value="RENTAL">Tiền thuê kho định kỳ</option>
              <option value="DEPOSIT">Tiền ký quỹ (Đặt cọc)</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none cursor-pointer"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="SUCCESS">Thành công (Paid)</option>
              <option value="PENDING">Đang chờ xử lý</option>
              <option value="FAILED">Thất bại / Hủy</option>
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
                  const isSuccess = p.status === 'SUCCESS' || p.status === 'PAID'
                  const isPending = p.status === 'PENDING'

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3.5">
                        <div className="font-mono font-medium text-slate-900" title={p.transactionId ? `Cổng TT: ${p.transactionId} | Mã hệ thống: ${p.id}` : `Mã nội bộ: ${p.id}`}>
                          {p.transactionId ? (
                            <span>{p.transactionId}</span>
                          ) : (
                            <span className="text-slate-600 font-mono text-xs">Mã nội bộ: {p.id}</span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {p.paymentTime
                            ? new Date(p.paymentTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                            : '—'}
                        </div>
                      </td>
                      <td className="py-3 px-3.5 font-medium text-slate-800">
                        {p.customerName || 'Khách hàng Boxora'}
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
                          {p.paymentType === 'DEPOSIT' ? 'Tiền ký quỹ (Cọc)' : 'Tiền thuê kho'}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-slate-600 font-medium">
                        {p.paymentMethod || 'VNPay'}
                      </td>
                      <td className="py-3 px-3.5 text-right font-bold text-slate-900 font-mono">
                        {p.amount.toLocaleString('vi-VN')} ₫
                      </td>
                      <td className="py-3 px-3.5 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          isSuccess
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : isPending
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}>
                          {isSuccess ? 'Thành công' : isPending ? 'Chờ xử lý' : 'Thất bại'}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
          <div>
            Hiển thị <span className="font-semibold text-slate-800 font-mono">{totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1}</span> -{' '}
            <span className="font-semibold text-slate-800 font-mono">{Math.min(currentPage * pageSize, totalItems)}</span> trên tổng số{' '}
            <span className="font-semibold text-slate-800 font-mono">{totalItems}</span> giao dịch
          </div>

          <div className="flex items-center gap-1.5 sm:ml-auto">
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
    </div>
  )
}
