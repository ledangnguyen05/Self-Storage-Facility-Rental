import React, { useState, useEffect, useMemo } from 'react'
import { reportService } from '../../services/reportService'
import { facilityService } from '../../services/facilityService'
import { useAuth } from '../../context/AuthContext'
import { OverdueDebtItem, Facility, OverdueDebtReport } from '../../types'
import { NoticeDispatcherModal } from './modals/NoticeDispatcherModal'
import { AssetSealingModal } from './modals/AssetSealingModal'
import { overdueService } from '../../services/overdueService'
import { toast } from '../../utils/toast'

export const OverdueManagementPage: React.FC = () => {
  const { user } = useAuth()
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>('')
  const [overdueItems, setOverdueItems] = useState<OverdueDebtItem[]>([])
  const [reportSummary, setReportSummary] = useState<OverdueDebtReport | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStage, setFilterStage] = useState<'ALL' | 'GRACE_PERIOD' | 'WARNING' | 'ACCESS_BLOCKED' | 'ELIGIBLE_FOR_SEALING' | 'POLICY_UNCONFIGURED'>('ALL')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 6

  // Notice & Sealing Modals State
  const [noticeModalData, setNoticeModalData] = useState<{
    unitCode: string
    tenantName: string
    contractCode: string
    daysOverdue: number
    baseDebt: string
    penaltyFee: string
    totalDebt: string
  } | null>(null)

  const [sealingModalData, setSealingModalData] = useState<{
    unitCode: string
    unitId?: string
    tenantName: string
    contractCode: string
    contractId?: string
    facilityId?: string
    overdueDays: number
    totalDebt: string
  } | null>(null)

  const [confirmLockoutItem, setConfirmLockoutItem] = useState<OverdueDebtItem | null>(null)
  const [isLocking, setIsLocking] = useState(false)
  const [lockoutError, setLockoutError] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 4000)
  }

  // Load facilities
  useEffect(() => {
    const loadFacilities = async () => {
      try {
        const res = await facilityService.getFacilities()
        const facs = res?.content || []
        setFacilities(facs)
        const userFacId = user?.facilityId
        if (userFacId && facs.some(f => f.id === userFacId)) {
          setSelectedFacilityId(userFacId)
        } else if (facs.length > 0) {
          setSelectedFacilityId(facs[0].id)
        }
      } catch (err) {
        console.warn('Failed to load facilities:', err)
      }
    }
    loadFacilities()
  }, [user])

  // Fetch overdue debts for facility
  const fetchOverdueReport = async () => {
    if (!selectedFacilityId) return
    setIsLoading(true)
    try {
      const data = await reportService.getOverdueDebtReport({ facilityId: selectedFacilityId })
      setOverdueItems(data?.items || [])
      setReportSummary(data || null)
    } catch (err) {
      console.warn('Failed to fetch overdue debt report:', err)
      setOverdueItems([])
      setReportSummary(null)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchOverdueReport()
  }, [selectedFacilityId])

  const currentFacilityName = useMemo(() => {
    return facilities.find(f => f.id === selectedFacilityId)?.name || 'Cơ sở Boxora'
  }, [facilities, selectedFacilityId])

  // KPIs
  const totalDebtAmount = reportSummary?.totalDebtAmount
  const blockedCount = reportSummary?.accessBlockedCount ?? 0
  const eligibleSealingCount = reportSummary?.eligibleForSealingCount ?? 0
  const policyUnconfiguredCount = reportSummary?.policyUnconfiguredCount ?? 0

  const formatAmount = (amount?: number | null) =>
    amount == null ? 'Chưa đối soát' : `${amount.toLocaleString('vi-VN')} ₫`

  // Filtered Items
  const filteredItems = useMemo(() => {
    return overdueItems.filter(item => {
      const matchSearch =
        item.unitCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.contractCode?.toLowerCase().includes(searchTerm.toLowerCase())

      if (!matchSearch) return false

      if (filterStage === 'ACCESS_BLOCKED') {
        return item.overdueStage === 'ACCESS_BLOCKED'
      }
      if (filterStage === 'ELIGIBLE_FOR_SEALING') {
        return item.overdueStage === 'ELIGIBLE_FOR_SEALING'
      }
      if (filterStage === 'GRACE_PERIOD') {
        return item.overdueStage === 'GRACE_PERIOD'
      }
      if (filterStage === 'WARNING') {
        return item.overdueStage === 'WARNING'
      }
      if (filterStage === 'POLICY_UNCONFIGURED') {
        return item.overdueStage === 'POLICY_UNCONFIGURED'
      }

      return true
    })
  }, [overdueItems, searchTerm, filterStage])

  // Pagination
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage) || 1
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredItems.slice(start, start + itemsPerPage)
  }, [filteredItems, currentPage, itemsPerPage])

  const handleLockoutConfirm = async () => {
    if (!confirmLockoutItem?.contractId) {
      setLockoutError('A rental contract is required for PIN/QR revocation.')
      return
    }
    setIsLocking(true)
    setLockoutError(null)
    try {
      await overdueService.lockoutContract(
        confirmLockoutItem.contractId,
        `Overdue ${confirmLockoutItem.daysOverdue} days (balance: ${formatAmount(confirmLockoutItem.totalDebt)})`
      )
      showToast(`Đã thu hồi PIN/QR trong Boxora cho kho #${confirmLockoutItem.unitCode}. Trạng thái khóa vật lý chưa được xác minh.`)
      setConfirmLockoutItem(null)
      await fetchOverdueReport()
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Không thể thực hiện khóa kho. Vui lòng kiểm tra quyền hoặc kết nối máy chủ.'
      setLockoutError(msg)
      showToast(`Lỗi khóa kho: ${msg}`)
    } finally {
      setIsLocking(false)
    }
  }

  const handleExportCsv = () => {
    if (overdueItems.length === 0) {
      toast.warning('Không có dữ liệu nợ cước để xuất CSV.')
      return
    }
    const headers = ['Mã Kho', 'Khách Hàng', 'Mã HĐ', 'Số Ngày Quá Hạn', 'Cước Nợ (VNĐ)', 'Phí Phạt (VNĐ)', 'Tổng Nợ (VNĐ)', 'Giai Đoạn Xử Lý']
    const rows = overdueItems.map(i => [
      i.unitCode || '',
      i.customerName || '',
      i.contractCode || i.bookingCode || '',
      i.daysOverdue || 0,
      i.unpaidRent ?? '',
      i.totalLateFee ?? '',
      i.totalDebt ?? '',
      i.overdueStage || ''
    ])
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `Bao_Cao_No_Cuoc_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="flex flex-col gap-6 w-full text-left">
      
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl border border-slate-700 flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <span className="material-symbols-outlined text-emerald-400">check_circle</span>
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[28px]">warning</span>
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Xử Lý Nợ Cước Quá Hạn &amp; Thu Hồi PIN/QR
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                {currentFacilityName}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Theo dõi kỳ hạn thanh toán, gửi thông báo nhắc cước, thu hồi PIN/QR trong Boxora và chuẩn bị thủ tục niêm phong. Tình trạng khóa vật lý chưa được xác minh.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {facilities.length > 1 && (
            <select
              value={selectedFacilityId}
              onChange={e => setSelectedFacilityId(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-slate-400"
            >
              {facilities.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={fetchOverdueReport}
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
            onClick={handleExportCsv}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            <span>Xuất CSV</span>
          </button>
        </div>
      </div>

      {/* 4 Financial & Risk KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Tổng nợ cước cần thu</span>
            <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
              <span className="material-symbols-outlined text-[18px]">money_off</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-rose-700 font-mono tracking-tight">
              {formatAmount(totalDebtAmount)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Ước tính theo hợp đồng và chính sách; khoản chưa đối soát sẽ để trống.
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Kho vi phạm quá hạn</span>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <span className="material-symbols-outlined text-[18px]">report_problem</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">
              {reportSummary?.totalOverdueCount ?? 0}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Hợp đồng cần theo dõi tại cơ sở
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Đạt ngưỡng thu hồi PIN/QR</span>
            <div className="p-1.5 rounded-lg bg-orange-50 text-orange-600">
              <span className="material-symbols-outlined text-[18px]">lock_person</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-orange-700 font-mono tracking-tight">
              {blockedCount}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Ngưỡng chính sách dựa trên số ngày quá hạn
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Đủ điều kiện niêm phong</span>
            <div className="p-1.5 rounded-lg bg-red-50 text-red-600">
              <span className="material-symbols-outlined text-[18px]">gavel</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-red-700 font-mono tracking-tight">
              {eligibleSealingCount}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Ngưỡng theo chính sách cơ sở; trạng thái khóa vật lý chưa xác minh
            </div>
          </div>
        </div>
      </div>

      {/* Main Delinquency Ledger */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col gap-5">
        
        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 flex-wrap">
            {(['ALL', 'GRACE_PERIOD', 'WARNING', 'ACCESS_BLOCKED', 'ELIGIBLE_FOR_SEALING', 'POLICY_UNCONFIGURED'] as const).map(stage => {
              const label =
                stage === 'ALL' ? 'Tất cả' :
                stage === 'GRACE_PERIOD' ? 'Ân hạn nhắc cước' :
                stage === 'WARNING' ? 'Cảnh báo' :
                stage === 'ACCESS_BLOCKED' ? 'Đạt ngưỡng thu hồi PIN/QR' :
                stage === 'POLICY_UNCONFIGURED' ? 'Thiếu chính sách' : 'Đủ điều kiện niêm phong'
              
              const count =
                stage === 'ALL' ? (reportSummary?.totalOverdueCount ?? 0) :
                stage === 'GRACE_PERIOD' ? (reportSummary?.gracePeriodCount ?? 0) :
                stage === 'WARNING' ? (reportSummary?.warningCount ?? 0) :
                stage === 'ACCESS_BLOCKED' ? blockedCount :
                stage === 'POLICY_UNCONFIGURED' ? policyUnconfiguredCount : eligibleSealingCount

              return (
                <button
                  key={stage}
                  type="button"
                  onClick={() => { setFilterStage(stage); setCurrentPage(1) }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    filterStage === stage
                      ? 'bg-slate-900 text-white shadow-md shadow-slate-900/25 ring-2 ring-slate-900/10'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {label} ({count})
                </button>
              )
            })}
          </div>

          <div className="relative w-full sm:w-64">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400">
              search
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1) }}
              placeholder="Tìm theo kho, mã HĐ, khách..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>
        </div>

        {/* Overdue Cases Stack */}
        <div className="flex flex-col gap-3">
          {isLoading ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              <span className="material-symbols-outlined text-4xl animate-spin mb-2">progress_activity</span>
              <p>Đang kiểm tra dữ liệu nợ cước thời gian thực từ database...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs bg-slate-50 rounded-2xl border border-slate-200">
              <span className="material-symbols-outlined text-[42px] text-emerald-500 mb-2">verified</span>
              <p className="font-bold text-slate-800 text-base">Cơ sở không có nợ cước quá hạn</p>
              <p className="text-slate-500 text-xs mt-1">Tất cả khách hàng tại {currentFacilityName} đang duy trì thanh toán đúng hạn.</p>
            </div>
          ) : (
            paginatedItems.map(item => {
              const isEligibleSealing = item.overdueStage === 'ELIGIBLE_FOR_SEALING'
              const isBlocked = item.overdueStage === 'ACCESS_BLOCKED'
              const isWarning = item.overdueStage === 'WARNING'

              return (
                <div
                  key={item.contractId || item.bookingId || item.unitCode}
                  className="flex flex-col lg:flex-row lg:items-center justify-between p-4 bg-slate-50 hover:bg-slate-100/70 rounded-xl gap-4 border border-slate-200 transition-all shadow-2xs"
                >
                  <div className="flex flex-col gap-1.5 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-md bg-rose-600 text-white font-mono text-xs font-bold">
                        Kho #{item.unitCode}
                      </span>
                      <span className="text-sm font-bold text-slate-900">
                        {item.customerName || 'Khách hàng'}
                      </span>
                      <span className="font-mono text-xs text-slate-500 font-semibold">
                        {item.contractCode ? `(HĐ #${item.contractCode})` : `(Đặt kho #${item.bookingCode || 'chưa có mã'})`}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        isEligibleSealing
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : isBlocked
                          ? 'bg-orange-50 text-orange-700 border-orange-200'
                          : isWarning
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {isEligibleSealing ? 'Đạt ngưỡng niêm phong theo chính sách' : isBlocked ? 'Đạt ngưỡng thu hồi PIN/QR' : isWarning ? 'Cảnh báo theo chính sách' : item.overdueStage === 'GRACE_PERIOD' ? 'Ân hạn theo chính sách' : 'Thiếu chính sách cơ sở'}
                      </span>
                    </div>

                    <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-slate-600 text-xs mt-1">
                      <span className="text-rose-600 font-bold flex items-center gap-1">
                        <span className="material-symbols-outlined text-[15px]">schedule</span>
                        Quá hạn {item.daysOverdue} ngày
                      </span>
                      <span>Cước theo hồ sơ: <strong className="font-mono text-slate-900">{formatAmount(item.unpaidRent)}</strong></span>
                      <span>Phí phạt: <strong className="font-mono text-rose-600">{formatAmount(item.totalLateFee)}</strong></span>
                      <span>Tổng nợ: <strong className="font-mono text-rose-700 font-bold">{formatAmount(item.totalDebt)}</strong></span>
                    </div>

                    <div className="text-[11px] text-slate-500">
                      Khách hàng: <strong>{item.customerName}</strong> &bull; SĐT: {item.customerPhone || 'Theo hồ sơ HĐ'}
                    </div>
                  </div>

                  {/* Actions Column */}
                  <div className="flex items-center gap-2 shrink-0 self-end lg:self-center">
                    <button
                      type="button"
                      onClick={() => setNoticeModalData({
                        unitCode: item.unitCode,
                        tenantName: item.customerName || 'Khách hàng',
                        contractCode: item.contractCode || item.bookingCode || 'N/A',
                        daysOverdue: Number(item.daysOverdue) || 0,
                        baseDebt: formatAmount(item.unpaidRent),
                        penaltyFee: formatAmount(item.totalLateFee),
                        totalDebt: formatAmount(item.totalDebt)
                      })}
                      className="px-3 py-2 rounded-lg bg-white text-slate-800 text-xs font-semibold border border-slate-200 hover:bg-slate-50 transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px] text-blue-600">forward_to_inbox</span>
                      <span>Gửi thông báo</span>
                    </button>

                    <button
                      type="button"
                      disabled={!item.contractId}
                      onClick={() => setConfirmLockoutItem(item)}
                      title={!item.contractId ? 'No contract is associated with this booking' : undefined}
                      className="px-3 py-2 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="material-symbols-outlined text-[16px]">lock_person</span>
                      <span>Thu hồi PIN/QR</span>
                    </button>

                    {isEligibleSealing && item.contractId && (
                      <button
                        type="button"
                        onClick={() => setSealingModalData({
                          unitCode: item.unitCode,
                          unitId: item.unitId,
                          tenantName: item.customerName || 'Khách hàng',
                          contractCode: item.contractCode || item.bookingCode || 'N/A',
                          contractId: item.contractId || undefined,
                          overdueDays: Number(item.daysOverdue) || 0,
                          totalDebt: formatAmount(item.totalDebt),
                          facilityId: selectedFacilityId
                        })}
                        className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all flex items-center gap-1 shadow-xs cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">gavel</span>
                        <span>Niêm phong</span>
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Pagination Controls - Centered */}
        {filteredItems.length > itemsPerPage && (
          <div className="relative flex flex-col md:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100 text-xs text-slate-500">
            <div className="text-center md:text-left">
              Hiển thị <span className="font-semibold text-slate-800 font-mono">{paginatedItems.length}</span> trên tổng số <span className="font-semibold text-slate-800 font-mono">{filteredItems.length}</span> khoản nợ
            </div>
            <div className="flex items-center justify-center gap-2 md:absolute md:left-1/2 md:-translate-x-1/2">
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-semibold transition-colors"
              >
                Trang trước
              </button>
              <span className="font-mono font-bold text-slate-900 px-2 py-1 rounded-md bg-slate-100 border border-slate-200">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-semibold transition-colors"
              >
                Trang sau
              </button>
            </div>

            <div className="hidden md:block w-28 pointer-events-none" aria-hidden="true" />
          </div>
        )}

      </div>

      {/* Notice Dispatcher Modal */}
      {noticeModalData && (
        <NoticeDispatcherModal
          isOpen={!!noticeModalData}
          onClose={() => setNoticeModalData(null)}
          noticeData={noticeModalData}
          onSendNotice={(msg) => {
            showToast(msg)
            setNoticeModalData(null)
          }}
        />
      )}

      {/* Asset Sealing Modal */}
      {sealingModalData && (
        <AssetSealingModal
          isOpen={!!sealingModalData}
          onClose={() => setSealingModalData(null)}
          unitCode={sealingModalData.unitCode}
          unitId={sealingModalData.unitId}
          tenantName={sealingModalData.tenantName}
          contractCode={sealingModalData.contractCode}
          contractId={sealingModalData.contractId}
          overdueDays={sealingModalData.overdueDays}
          totalDebt={sealingModalData.totalDebt}
          facilityId={sealingModalData.facilityId}
          onCompleteSealing={(msg) => {
            showToast(msg)
            setSealingModalData(null)
            fetchOverdueReport()
          }}
        />
      )}

      {/* Lockout Confirm Modal */}
      {confirmLockoutItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-4">
            <div className="flex items-start gap-3.5">
              <div className="p-3 rounded-xl bg-rose-100 text-rose-700 shrink-0">
                <span className="material-symbols-outlined text-[26px]">lock_person</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Xác nhận thu hồi PIN/QR trong Boxora
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Thu hồi PIN/QR đang lưu trong Boxora cho kho #{confirmLockoutItem.unitCode} của khách hàng{' '}
                  <strong>{confirmLockoutItem.customerName}</strong> (Quá hạn {confirmLockoutItem.daysOverdue} ngày).
                  Thao tác này không xác nhận hoặc điều khiển khóa vật lý; trạng thái khóa tại kho chưa được xác minh.
                </p>
              </div>
            </div>

            {lockoutError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">error</span>
                <span>{lockoutError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isLocking}
                onClick={() => {
                  setConfirmLockoutItem(null)
                  setLockoutError(null)
                }}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={isLocking}
                onClick={handleLockoutConfirm}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer shadow-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                {isLocking ? (
                  <>
                    <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                    <span>Đang ngắt quyền truy cập...</span>
                  </>
                ) : (
                  <span>Xác nhận thu hồi PIN/QR</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
