import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useLanguage } from '../../context/LanguageContext'
import { reportService } from '../../services/reportService'
import { facilityService } from '../../services/facilityService'
import { contractService, RentalContract } from '../../services/contractService'
import { Facility, RevenueReport, OccupancyReport, OverdueDebtReport } from '../../types'

const loadAllContracts = async (facilityId?: string): Promise<RentalContract[]> => {
  const firstPage = await contractService.getMyContracts({ facilityId, page: 0, size: 100 })
  const contracts = [...(firstPage.content ?? [])]
  const totalPages = firstPage.totalPages ?? 1

  for (let page = 1; page < totalPages; page += 1) {
    const result = await contractService.getMyContracts({ facilityId, page, size: 100 })
    contracts.push(...(result.content ?? []))
  }

  return contracts
}

export const OperationsDashboard: React.FC = () => {
  const { t, language } = useLanguage()
  const tr = (vietnamese: string, english: string) => t(vietnamese, english)
  const currencyLocale = language === 'vi' ? 'vi-VN' : 'en-US'
  const formatReportDate = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString(currencyLocale)
  const { selectedFacility, setSelectedFacility, facilities: contextFacilities } = useOutletContext<{
    selectedFacility?: string
    setSelectedFacility?: (facId: string) => void
    facilities?: Facility[]
  }>() || {}

  const dashboardRequestSequence = useRef(0)

  // Live reports and facilities from BE
  const [facilities, setFacilities] = useState<Facility[]>(contextFacilities || [])
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>(() =>
    !selectedFacility || selectedFacility.toUpperCase() === 'ALL' ? 'all' : selectedFacility
  )
  const [revenueData, setRevenueData] = useState<RevenueReport | null>(null)
  const [occupancyData, setOccupancyData] = useState<OccupancyReport | null>(null)
  const [debtData, setDebtData] = useState<OverdueDebtReport | null>(null)
  const [contracts, setContracts] = useState<RentalContract[] | null>(null)
  const [isReportsLoading, setIsReportsLoading] = useState(true)
  const [reportsHaveError, setReportsHaveError] = useState(false)
  const [contractLoadStatus, setContractLoadStatus] = useState<'loading' | 'available' | 'forbidden' | 'error'>('loading')
  const [facilitySort, setFacilitySort] = useState<'revenue' | 'occupancy'>('revenue')

  // Notification toast
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [toastIsError, setToastIsError] = useState(false)



  // Report Date Range State - Default to All Time (empty) so user sees full DB revenue initially
  const [fromDate, setFromDate] = useState<string>('')
  const [toDate, setToDate] = useState<string>('')
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false)
  const [tempFromDate, setTempFromDate] = useState<string>('')
  const [tempToDate, setTempToDate] = useState<string>('')

  useEffect(() => {
    if (contextFacilities && contextFacilities.length > 0) {
      setFacilities(contextFacilities)
    }
  }, [contextFacilities])

  useEffect(() => {
    const nextScope = (!selectedFacility || selectedFacility.toUpperCase() === 'ALL') ? 'all' : selectedFacility
    setSelectedFacilityId(nextScope)
  }, [selectedFacility])

  const loadDashboardData = async (fDate = fromDate, tDate = toDate, targetScope?: string) => {
    const requestSequence = ++dashboardRequestSequence.current
    setIsReportsLoading(true)
    setReportsHaveError(false)
    setRevenueData(null)
    setOccupancyData(null)
    setDebtData(null)
    setContracts(null)
    setContractLoadStatus('loading')
    try {
      const queryFrom = fDate || undefined
      const queryTo = tDate || undefined
      const scope = targetScope !== undefined ? targetScope : selectedFacilityId
      const targetFacilityId = scope === 'all' ? undefined : scope
      const [facRes, revRes, occRes, debtRes, ctRes] = await Promise.allSettled([
        facilityService.getFacilities(),
        reportService.getRevenueReport(queryFrom, queryTo, targetFacilityId),
        reportService.getOccupancyReport(targetFacilityId),
        reportService.getOverdueDebtReport(targetFacilityId ? { facilityId: targetFacilityId } : undefined),
        loadAllContracts(targetFacilityId)
      ])

      if (requestSequence !== dashboardRequestSequence.current) return

      if (facRes.status === 'fulfilled' && facRes.value?.content) {
        setFacilities(facRes.value.content)
      } else {
        setFacilities([])
      }
      if (revRes.status === 'fulfilled' && revRes.value) {
        setRevenueData(revRes.value)
      } else {
        setRevenueData(null)
      }
      if (occRes.status === 'fulfilled' && occRes.value) {
        setOccupancyData(occRes.value)
      } else {
        setOccupancyData(null)
      }
      if (debtRes.status === 'fulfilled' && debtRes.value) {
        setDebtData(debtRes.value)
      } else {
        setDebtData(null)
      }
      if (ctRes.status === 'fulfilled') {
        setContracts(ctRes.value)
        setContractLoadStatus('available')
      } else {
        setContracts(null)
        const status = (ctRes.reason as { response?: { status?: number } })?.response?.status
        setContractLoadStatus(status === 403 ? 'forbidden' : 'error')
      }
      setReportsHaveError([facRes, revRes, occRes, debtRes, ctRes].some((result) => result.status === 'rejected'))
    } catch {
      if (requestSequence === dashboardRequestSequence.current) {
        setFacilities([])
        setRevenueData(null)
        setOccupancyData(null)
        setDebtData(null)
        setContracts(null)
        setContractLoadStatus('error')
        setReportsHaveError(true)
      }
    } finally {
      if (requestSequence === dashboardRequestSequence.current) {
        setIsReportsLoading(false)
      }
    }
  }

  useEffect(() => {
    void loadDashboardData(fromDate, toDate, selectedFacilityId)
  }, [selectedFacilityId])


  const occupancyRows = [...(occupancyData?.byFacility ?? [])]
    .filter((row) => selectedFacilityId === 'all' || row.facilityId === selectedFacilityId)
    .sort((a, b) => {
      if (facilitySort === 'occupancy') return b.occupancyRate - a.occupancyRate
      const aRevenue = revenueData?.byFacility?.find((item) => item.facilityId === a.facilityId)?.totalRevenue ?? -1
      const bRevenue = revenueData?.byFacility?.find((item) => item.facilityId === b.facilityId)?.totalRevenue ?? -1
      return bRevenue - aRevenue
    })
  // The backend has already applied the requested facility scope to these summaries.
  const revenueForScope = revenueData?.systemSummary?.totalRevenue
  const paymentCountForScope = revenueData?.systemSummary?.paymentCount
  const renewalRevenueForScope = revenueData?.systemSummary?.renewalFeeRevenue
  const occupancyForScope = occupancyData?.systemSummary

  const facilityRevenueTotal = revenueData?.byFacility?.reduce((total, row) => total + (row.totalRevenue ?? 0), 0) ?? 0
  const facilityPaymentCountTotal = revenueData?.byFacility?.reduce((total, row) => total + (row.paymentCount ?? 0), 0) ?? 0
  const facilityRevenueVariance = (revenueData?.systemSummary?.totalRevenue ?? 0) - facilityRevenueTotal
  const facilityPaymentCountVariance = (revenueData?.systemSummary?.paymentCount ?? 0) - facilityPaymentCountTotal

  const validActiveContractCount = useMemo(() => {
    if (!contracts) return null
    const today = new Date().toLocaleDateString('en-CA')
    return contracts.filter((contract) =>
      contract.status === 'ACTIVE'
      && Boolean(contract.startDate && contract.endDate)
      && contract.startDate <= today
      && contract.endDate >= today
    ).length
  }, [contracts])

  const periodLabel = !fromDate && !toDate
    ? tr('Toàn bộ thời gian', 'All time')
    : fromDate && toDate
      ? `${formatReportDate(fromDate)} – ${formatReportDate(toDate)}`
      : fromDate
        ? `${tr('Từ', 'From')} ${formatReportDate(fromDate)}`
        : `${tr('Đến', 'To')} ${formatReportDate(toDate)}`

  // These chart rows are aggregated by the same PAID report query as the headline KPI.
  const monthlyRevenueData = useMemo(() => {
    return (revenueData?.monthlyRevenue ?? []).map((item) => ({
      monthKey: item.month ?? 'unknown',
      label: item.month ? `T${item.month.slice(5)}/${item.month.slice(2, 4)}` : tr('Chưa rõ ngày', 'Date unavailable'),
      rentalFee: item.rentalFeeRevenue,
      deposit: item.depositRevenue,
      renewalFee: item.renewalFeeRevenue,
      extraCharge: item.extraChargeRevenue,
      bookingPayment: item.bookingPaymentRevenue ?? 0,
      unclassified: Math.max(0, item.totalRevenue - item.rentalFeeRevenue - item.depositRevenue - item.renewalFeeRevenue - item.extraChargeRevenue - (item.bookingPaymentRevenue ?? 0)),
      total: item.totalRevenue,
      paymentCount: item.paymentCount,
    }))
  }, [revenueData, language])

  const maxMonthlyTotal = useMemo(() => {
    if (monthlyRevenueData.length === 0) return 1
    return Math.max(...monthlyRevenueData.map((m) => m.total), 1)
  }, [monthlyRevenueData])

  // Preserve unknown payment methods as a visible residual instead of attributing them.
  const paymentMethodStats = useMemo(() => {
    const methodCounts = revenueData?.paymentsByMethod ?? []
    const countForMethod = (method: string) => methodCounts
      .filter((entry) => entry.paymentMethod?.trim().toUpperCase() === method)
      .reduce((total, entry) => total + entry.paymentCount, 0)
    const vnpayCount = countForMethod('VNPAY')
    const bankCount = countForMethod('BANK_TRANSFER')
    const momoCount = countForMethod('MOMO')
    const knownCount = vnpayCount + bankCount + momoCount
    const otherMethodCount = methodCounts
      .filter((entry) => !['VNPAY', 'BANK_TRANSFER', 'MOMO'].includes(entry.paymentMethod?.trim().toUpperCase() ?? ''))
      .reduce((total, entry) => total + entry.paymentCount, 0)
    const totalCount = paymentCountForScope ?? methodCounts.reduce((total, entry) => total + entry.paymentCount, 0)
    const otherCount = otherMethodCount + Math.max(0, totalCount - knownCount - otherMethodCount)
    const percent = (count: number) => totalCount === 0 ? 0 : Math.round((count / totalCount) * 1000) / 10

    return {
      vnpayPercent: percent(vnpayCount),
      bankPercent: percent(bankCount),
      momoPercent: percent(momoCount),
      vnpayCount,
      bankCount,
      momoCount,
      otherCount,
      totalCount,
      isAvailable: Array.isArray(revenueData?.paymentsByMethod),
    }
  }, [revenueData, paymentCountForScope])

  const showToast = (msg: string, isError = false) => {
    setToastMessage(msg)
    setToastIsError(isError)
    setTimeout(() => setToastMessage(null), 3000)
  }

  const handleExportRevenueCsv = () => {
    const rows = revenueData?.byFacility
    const summary = revenueData?.systemSummary
    if (!summary || !rows) {
      showToast('Chưa có dữ liệu doanh thu để xuất.', true)
      return
    }
    const selectedFacilityName = facilities.find((facility) => facility.id === selectedFacilityId)?.name
    const scopeName = selectedFacilityId === 'all' ? tr('Toàn hệ thống', 'All facilities') : (selectedFacilityName || tr('Cơ sở đã chọn', 'Selected facility'))
    const csvRows = [
      [tr('Kỳ báo cáo', 'Report period'), periodLabel],
      [tr('Phạm vi', 'Scope'), scopeName],
      [],
      [tr('Cơ sở', 'Facility'), tr('Tổng doanh thu (VND)', 'Total revenue (VND)'), tr('Tiền thuê (VND)', 'Rental fee (VND)'), tr('Tiền cọc (VND)', 'Deposit (VND)'), tr('Gia hạn (VND)', 'Renewal (VND)'), tr('Phụ phí (VND)', 'Extra charges (VND)'), tr('Thanh toán đặt kho (VND)', 'Booking payments (VND)'), tr('Chưa phân loại (VND)', 'Unclassified (VND)'), tr('Số thanh toán', 'Payment count')],
      [selectedFacilityId === 'all' ? tr('Tổng toàn hệ thống', 'System total') : `${tr('Tổng', 'Total')} ${scopeName}`, summary.totalRevenue, summary.rentalFeeRevenue, summary.depositRevenue, summary.renewalFeeRevenue ?? 0, summary.extraChargeRevenue ?? 0, summary.bookingPaymentRevenue ?? 0, Math.max(0, summary.totalRevenue - summary.rentalFeeRevenue - summary.depositRevenue - (summary.renewalFeeRevenue ?? 0) - (summary.extraChargeRevenue ?? 0) - (summary.bookingPaymentRevenue ?? 0)), summary.paymentCount],
      ...rows
        .filter(row => selectedFacilityId === 'all' || row.facilityId === selectedFacilityId)
        .map(row => [row.facilityName, row.totalRevenue, row.rentalFeeRevenue, row.depositRevenue, row.renewalFeeRevenue ?? 0, row.extraChargeRevenue ?? 0, row.bookingPaymentRevenue ?? 0, Math.max(0, row.totalRevenue - row.rentalFeeRevenue - row.depositRevenue - (row.renewalFeeRevenue ?? 0) - (row.extraChargeRevenue ?? 0) - (row.bookingPaymentRevenue ?? 0)), row.paymentCount ?? 0]),
      ...(selectedFacilityId === 'all' && (facilityRevenueVariance !== 0 || facilityPaymentCountVariance !== 0)
        ? [[tr('Chênh lệch tổng hệ thống - tổng cơ sở', 'System total minus facility totals'), facilityRevenueVariance, '', '', '', '', '', '', facilityPaymentCountVariance]]
        : []),
    ]
    const csv = '\uFEFF' + csvRows.map(row => row.map(value => {
      const cell = String(value ?? '')
      const safeCell = /^[=+@-]/.test(cell) ? `'${cell}` : cell
      return `"${safeCell.replaceAll('"', '""')}"`
    }).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `boxora-doanh-thu-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
    showToast(tr('Đã tải báo cáo doanh thu CSV.', 'Revenue CSV downloaded.'))
  }

  return (
    <>
    <style>{`@media print {
      @page { size: landscape; margin: 12mm; }
      body * { visibility: hidden !important; }
      #operations-dashboard-report, #operations-dashboard-report * { visibility: visible !important; }
      #operations-dashboard-report { position: absolute; left: 0; top: 0; width: 100%; background: white; }
      #operations-dashboard-report .print\\:hidden { display: none !important; }
    }`}</style>
    <div id="operations-dashboard-report" className="flex flex-col gap-6 w-full">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-24 right-8 z-50 flex items-center gap-2 px-4 py-3 bg-neutral-900 text-white rounded-lg shadow-xl border border-neutral-700 animate-in fade-in duration-200">
          <span className={`material-symbols-outlined text-[20px] ${toastIsError ? 'text-rose-400' : 'text-emerald-400'}`}>{toastIsError ? 'error' : 'check_circle'}</span>
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* TOP CONTEXT & C-LEVEL STRIP */}
      <div className="relative w-full rounded-2xl bg-white p-6 shadow-sm border border-slate-200 z-10">
        {/* Background decorative blurs clipped to card border */}
        <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
          <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl"></div>
          <div className="absolute left-1/3 -bottom-16 h-48 w-48 rounded-full bg-teal-500/10 blur-2xl"></div>
        </div>

        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4 print:hidden">
          <div className="flex flex-col gap-2 max-w-2xl text-left">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold ${isReportsLoading ? 'bg-slate-50 border-slate-200 text-slate-600' : reportsHaveError ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${isReportsLoading ? 'bg-slate-400' : reportsHaveError ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                {isReportsLoading ? tr('Đang tải báo cáo', 'Loading reports') : reportsHaveError ? tr('Một số dữ liệu không tải được', 'Some data could not be loaded') : tr('Đã tải dữ liệu báo cáo', 'Report data loaded')}
              </span>
            </div>
            <h1 className="text-2xl font-bold font-headline text-slate-900 tracking-tight">
              {tr('Doanh thu & vận hành hệ thống', 'Revenue and operations')}
            </h1>
            <p className="text-sm text-slate-600">
              {tr('Theo dõi doanh thu, công suất kho, công nợ và chính sách tại các cơ sở.', 'Review revenue, unit capacity, debt, and policies across facilities.')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {/* Facility Selector Dropdown */}
            <div className="flex items-center bg-slate-50 hover:bg-slate-100 text-left px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 transition-all shadow-xs group">
              <span className="material-symbols-outlined text-blue-600 group-hover:scale-110 transition-transform text-[20px] mr-2">
                location_on
              </span>
              <div className="flex flex-col pr-1 text-left">
                <span className="text-[10px] text-slate-500 uppercase font-semibold leading-none mb-0.5">
                  {tr('Cơ sở báo cáo', 'Report facility')}
                </span>
                <select
                  value={selectedFacilityId}
                  onChange={(e) => {
                    const newFacilityId = e.target.value
                    setSelectedFacilityId(newFacilityId)
                    if (setSelectedFacility) {
                      setSelectedFacility(newFacilityId === 'all' ? 'ALL' : newFacilityId)
                    }
                  }}
                  className="bg-transparent font-mono text-xs text-slate-900 font-bold focus:outline-none cursor-pointer pr-1"
                >
                  <option value="all">{tr('Toàn hệ thống (Tất cả)', 'All facilities')}</option>
                  {facilities.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name.replace(/StoreHub\s*/gi, 'Boxora ')} ({f.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="relative z-30">
              <button
                type="button"
                onClick={() => {
                  setTempFromDate(fromDate)
                  setTempToDate(toDate)
                  setIsDatePickerOpen(!isDatePickerOpen)
                }}
                title={tr('Bấm để chọn khoảng ngày báo cáo doanh thu', 'Choose a revenue reporting date range')}
                className={`flex items-center text-left px-3 py-1.5 rounded-lg border transition-all cursor-pointer group ${
                  isDatePickerOpen
                    ? 'bg-blue-50/70 border-blue-400 shadow-md shadow-blue-500/15 ring-2 ring-blue-400/20'
                    : (fromDate || toDate)
                    ? 'bg-blue-50/40 border-blue-300 shadow-sm'
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200 hover:border-slate-300 shadow-xs'
                }`}
              >
                <span className="material-symbols-outlined text-blue-600 group-hover:scale-110 transition-transform text-[20px] mr-2">
                  calendar_month
                </span>
                <div className="flex flex-col pr-1">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold leading-none">{tr('Kỳ báo cáo', 'Report period')}</span>
                    <span className="material-symbols-outlined text-[13px] text-slate-400 group-hover:text-blue-600 transition-colors">
                      edit_calendar
                    </span>
                  </div>
                  <span className="font-mono text-xs text-slate-900 font-bold group-hover:text-blue-700 transition-colors">
                    {periodLabel}
                  </span>
                </div>
              </button>

              {/* Date Range Picker Popover */}
              {isDatePickerOpen && (() => {
                const now = new Date()
                const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
                const thisMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
                const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
                const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
                const lastMonthStart = `${firstDayLastMonth.getFullYear()}-${String(firstDayLastMonth.getMonth() + 1).padStart(2, '0')}-01`
                const lastMonthEnd = `${lastDayLastMonth.getFullYear()}-${String(lastDayLastMonth.getMonth() + 1).padStart(2, '0')}-${String(lastDayLastMonth.getDate()).padStart(2, '0')}`
                const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
                const last7Start = `${d7.getFullYear()}-${String(d7.getMonth() + 1).padStart(2, '0')}-${String(d7.getDate()).padStart(2, '0')}`
                const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
                const last30Start = `${d30.getFullYear()}-${String(d30.getMonth() + 1).padStart(2, '0')}-${String(d30.getDate()).padStart(2, '0')}`
                const thisYearStart = `${now.getFullYear()}-01-01`

                const quickPresets = [
                  {
                    id: 'ALL',
                    label: tr('Toàn bộ', 'All time'),
                    isSelected: !tempFromDate && !tempToDate,
                    apply: () => {
                      setTempFromDate('')
                      setTempToDate('')
                    },
                  },
                  {
                    id: 'THIS_MONTH',
                    label: tr('Tháng này', 'This month'),
                    isSelected: tempFromDate === thisMonthStart && tempToDate === todayStr,
                    apply: () => {
                      setTempFromDate(thisMonthStart)
                      setTempToDate(todayStr)
                    },
                  },
                  {
                    id: 'LAST_MONTH',
                    label: tr('Tháng trước', 'Last month'),
                    isSelected: tempFromDate === lastMonthStart && tempToDate === lastMonthEnd,
                    apply: () => {
                      setTempFromDate(lastMonthStart)
                      setTempToDate(lastMonthEnd)
                    },
                  },
                  {
                    id: 'LAST_7_DAYS',
                    label: tr('7 ngày qua', 'Last 7 days'),
                    isSelected: tempFromDate === last7Start && tempToDate === todayStr,
                    apply: () => {
                      setTempFromDate(last7Start)
                      setTempToDate(todayStr)
                    },
                  },
                  {
                    id: 'LAST_30_DAYS',
                    label: tr('30 ngày qua', 'Last 30 days'),
                    isSelected: tempFromDate === last30Start && tempToDate === todayStr,
                    apply: () => {
                      setTempFromDate(last30Start)
                      setTempToDate(todayStr)
                    },
                  },
                  {
                    id: 'THIS_YEAR',
                    label: tr('Năm nay', 'This year'),
                    isSelected: tempFromDate === thisYearStart && tempToDate === todayStr,
                    apply: () => {
                      setTempFromDate(thisYearStart)
                      setTempToDate(todayStr)
                    },
                  },
                ]

                return (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsDatePickerOpen(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 z-50 w-88 max-w-[90vw] bg-white rounded-xl border border-slate-200 shadow-2xl p-4 animate-in fade-in zoom-in-95 duration-150">
                      <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
                        <div className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-blue-600 text-[18px]">date_range</span>
                          <h4 className="text-xs font-bold text-slate-900">{tr('Chọn Kỳ Báo Cáo', 'Choose a report period')}</h4>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsDatePickerOpen(false)}
                          className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[18px]">close</span>
                        </button>
                      </div>

                      {/* Quick Presets */}
                      <div className="mb-3">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                          {tr('Chọn nhanh', 'Quick presets')}
                        </span>
                        <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                          {quickPresets.map(preset => (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={preset.apply}
                              className={`px-2 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer text-center transition-all ${
                                preset.isSelected
                                  ? 'bg-blue-50 text-blue-700 border-blue-400 font-bold shadow-md shadow-blue-500/25 ring-2 ring-blue-400/30'
                                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                      </div>

                    {/* Custom Date Pickers */}
                    <div className="space-y-2 mb-4 text-xs">
                      <div>
                        <label className="text-[11px] font-bold text-slate-600 block mb-1">
                          {tr('Từ ngày (Bắt đầu):', 'From date:')}
                        </label>
                        <input
                          type="date"
                          value={tempFromDate}
                          onChange={(e) => setTempFromDate(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-xs text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-blue-600 cursor-pointer"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-600 block mb-1">
                          {tr('Đến ngày (Kết thúc):', 'To date:')}
                        </label>
                        <input
                          type="date"
                          value={tempToDate}
                          onChange={(e) => setTempToDate(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-xs text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-blue-600 cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setIsDatePickerOpen(false)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
                      >
                        {tr('Đóng', 'Close')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (tempFromDate && tempToDate && tempFromDate > tempToDate) {
                            showToast(tr('Ngày bắt đầu không được lớn hơn ngày kết thúc', 'Start date must be on or before the end date.'), true)
                            return
                          }
                          setFromDate(tempFromDate)
                          setToDate(tempToDate)
                          setIsDatePickerOpen(false)
                          void loadDashboardData(tempFromDate || undefined, tempToDate || undefined)
                        }}
                        className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[16px]">check</span>
                        <span>{tr('Áp dụng kỳ', 'Apply period')}</span>
                      </button>
                    </div>
                  </div>
                </>
              )})()}
            </div>


            <div className="flex items-center gap-2 ml-auto lg:ml-0">
              <button 
                type="button" 
                onClick={handleExportRevenueCsv}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-medium transition-all shadow-xs border border-slate-200"
              >
                <span className="material-symbols-outlined text-[18px]">table_view</span>
                {tr('Tải CSV', 'Download CSV')}
              </button>
              <button 
                type="button" 
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 text-white hover:bg-neutral-800 rounded-lg text-xs font-semibold transition-all shadow-sm"
              >
                <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
                {tr('In / lưu PDF', 'Print / save PDF')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4 EXECUTIVE SUMMARY KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Metric 1: Doanh thu thuần */}
        <div className="relative overflow-hidden rounded-xl bg-white p-5 shadow-sm border border-slate-200 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="text-xs uppercase font-semibold text-slate-500 tracking-wider">{tr('Tổng doanh thu trong phạm vi', 'Revenue in selected scope')}</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold font-mono text-slate-900">
                  {revenueData ? (revenueForScope ?? 0).toLocaleString(currencyLocale) : '—'}
                </span>
                <span className="text-xs text-slate-500 font-mono">VNĐ</span>
              </div>
            </div>
            <div className="h-10 w-10 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600 border border-orange-100">
              <span className="material-symbols-outlined text-[22px]">payments</span>
            </div>
          </div>
          <div className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
            {revenueData != null
              ? `${(paymentCountForScope ?? 0).toLocaleString(currencyLocale)} ${tr('giao dịch PAID trong kỳ', 'PAID payments in period')}`
              : tr('Chưa có dữ liệu doanh thu', 'Revenue data unavailable')}
          </div>
        </div>

        {/* Metric 2 */}
        <div className="relative overflow-hidden rounded-xl bg-white p-5 shadow-sm border border-slate-200 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="text-xs uppercase font-semibold text-slate-500 tracking-wider">{tr('Tỷ lệ kho đang thuê', 'Unit occupancy rate')}</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold font-mono text-slate-900">
                  {occupancyForScope?.occupancyRate != null ? `${occupancyForScope.occupancyRate.toFixed(1)}%` : '—'}
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  {occupancyForScope?.occupiedUnits != null ? `${occupancyForScope.occupiedUnits} / ${occupancyForScope.totalUnits}` : tr('kho', 'units')}
                </span>
              </div>
            </div>
            <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100">
              <span className="material-symbols-outlined text-[22px]">pie_chart</span>
            </div>
          </div>
          <div className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
            {occupancyForScope?.availableUnits != null
              ? `${tr('Còn trống', 'Available')}: ${occupancyForScope.availableUnits} · ${tr('Đặt trước', 'Reserved')}: ${occupancyForScope.reservedUnits ?? '—'} · ${tr('Bảo trì', 'Maintenance')}: ${occupancyForScope.maintenanceUnits ?? '—'}`
              : tr('Chưa có dữ liệu công suất', 'Capacity data unavailable')}
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-2">
            <div className="bg-blue-600 h-full rounded-full" style={{ width: `${occupancyForScope?.occupancyRate ?? 0}%` }}></div>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="relative overflow-hidden rounded-xl bg-white p-5 shadow-sm border border-slate-200 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="text-xs uppercase font-semibold text-slate-500 tracking-wider">{tr('Doanh thu tái ký và gia hạn', 'Renewal revenue')}</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold font-mono text-emerald-600">
                  {revenueData ? (renewalRevenueForScope ?? 0).toLocaleString(currencyLocale) : '—'}
                </span>
                <span className="text-xs text-slate-500 font-mono">VNĐ</span>
              </div>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100">
              <span className="material-symbols-outlined text-[22px]">autorenew</span>
            </div>
          </div>
          <div className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
            {contracts == null
              ? contractLoadStatus === 'loading' ? tr('Đang tải tình trạng hợp đồng', 'Loading contract status') : contractLoadStatus === 'forbidden' ? tr('Không có quyền xem dữ liệu hợp đồng', 'Contract data access is not permitted') : tr('Không tải được tình trạng hợp đồng', 'Contract status unavailable')
              : `${validActiveContractCount ?? 0} / ${contracts.length} ${tr('hợp đồng ACTIVE còn trong thời hạn', 'ACTIVE contracts within their term')}`}
          </div>
        </div>

        {/* Metric 4 */}
        <div className="relative overflow-hidden rounded-xl bg-white p-5 shadow-sm border border-slate-200 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="text-xs uppercase font-semibold text-slate-500 tracking-wider">{tr('Công nợ quá hạn', 'Overdue debt')}</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold font-mono text-rose-600">{debtData ? (debtData.totalDebtAmount != null ? debtData.totalDebtAmount.toLocaleString(currencyLocale) : tr('Chưa đối soát', 'Unreconciled')) : '—'}</span>
                <span className="text-xs text-slate-500 font-mono">VNĐ</span>
              </div>
            </div>
            <div className="h-10 w-10 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600 border border-rose-100">
              <span className="material-symbols-outlined text-[22px]">gavel</span>
            </div>
          </div>
          <div className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
            {debtData
              ? `${debtData.totalOverdueCount} ${tr('khoản quá hạn', 'overdue records')} · ${debtData.accessBlockedCount} ${tr('đạt ngưỡng ngừng quyền truy cập; trạng thái khóa vật lý chưa xác minh', 'at the configured access suspension threshold; physical lock status is unverified')}`
              : tr('Chưa có dữ liệu công nợ', 'Debt data unavailable')}
          </div>
        </div>
      </div>

      {/* CHARTS ROW: STACKED REVENUE & DONUT CHURN (POWERED BY REAL DB DATA) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Stacked Revenue Bar Chart (8 cols) */}
        <div className="lg:col-span-8 bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">{tr('Xu hướng doanh thu theo kỳ', 'Revenue trend by period')}</h2>
              <p className="text-xs text-slate-500">
                {monthlyRevenueData.length > 0
                  ? `${tr('Doanh thu thanh toán PAID trong', 'PAID payment revenue across')} ${monthlyRevenueData.length} ${tr('nhóm tháng, cùng kỳ với KPI.', 'month groups in the KPI period.')}`
                  : isReportsLoading ? tr('Đang tải chuỗi doanh thu...', 'Loading revenue series...') : reportsHaveError ? tr('Không tải được chuỗi doanh thu.', 'Could not load the revenue series.') : tr('Không có giao dịch PAID trong kỳ đã chọn.', 'No PAID payments in the selected period.')}
              </p>
            </div>
            <div className="flex items-center gap-3 text-slate-600 text-xs font-medium flex-wrap">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-slate-900"></span>{tr('Tiền thuê kho', 'Rental fees')}</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-cyan-500"></span>{tr('Tiền cọc', 'Deposits')}</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-600"></span>{tr('Phí tái ký / gia hạn', 'Renewal fees')}</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-500"></span>{tr('Phụ phí', 'Extra charges')}</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-violet-500"></span>{tr('Thanh toán đặt kho', 'Booking payments')}</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-slate-400"></span>{tr('Chưa phân loại', 'Unclassified')}</span>
            </div>
          </div>

          {/* Bar Columns Container */}
          <div className="w-full h-64 flex items-end justify-between gap-2 sm:gap-4 pt-4 pb-2 px-2 border-b border-slate-200 overflow-x-auto">
            {monthlyRevenueData.length > 0 ? (
              monthlyRevenueData.map((m) => {
                const heightPercent = Math.max(14, Math.min(100, Math.round((m.total / maxMonthlyTotal) * 100)))
                const rentalPct = m.total > 0 ? (m.rentalFee / m.total) * 100 : 0
                const depositPct = m.total > 0 ? (m.deposit / m.total) * 100 : 0
                const renewalPct = m.total > 0 ? (m.renewalFee / m.total) * 100 : 0
                const extraChargePct = m.total > 0 ? (m.extraCharge / m.total) * 100 : 0
                const bookingPaymentPct = m.total > 0 ? (m.bookingPayment / m.total) * 100 : 0
                const unclassifiedPct = m.total > 0 ? (m.unclassified / m.total) * 100 : 0

                return (
                  <div key={m.monthKey} className="flex-1 min-w-[48px] flex flex-col items-center gap-2 h-full justify-end group">
                    <div 
                      className="w-full flex flex-col items-center gap-0.5 transition-all duration-300 group-hover:opacity-90"
                      style={{ height: `${heightPercent}%` }}
                    >
                      {unclassifiedPct > 0 && (
                        <div className="w-full max-w-[42px] bg-slate-400 rounded-t" style={{ height: `${unclassifiedPct}%` }} title={`${tr('Chưa phân loại', 'Unclassified')}: ${(m.unclassified / 1_000_000).toFixed(2)}m`} />
                      )}
                      {extraChargePct > 0 && (
                        <div
                          className={`w-full max-w-[42px] bg-amber-500 ${unclassifiedPct === 0 ? 'rounded-t' : ''}`}
                          style={{ height: `${extraChargePct}%` }}
                          title={`${tr('Phụ phí', 'Extra charges')}: ${(m.extraCharge / 1_000_000).toFixed(2)}m`}
                        />
                      )}
                      {renewalPct > 0 && (
                        <div 
                          className={`w-full max-w-[42px] bg-emerald-600 ${extraChargePct === 0 && unclassifiedPct === 0 ? 'rounded-t' : ''}`}
                          style={{ height: `${renewalPct}%` }}
                          title={`${tr('Tái ký', 'Renewals')}: ${(m.renewalFee / 1_000_000).toFixed(2)}m`}
                        />
                      )}
                      {bookingPaymentPct > 0 && (
                        <div className={`w-full max-w-[42px] bg-violet-500 ${extraChargePct === 0 && renewalPct === 0 && unclassifiedPct === 0 ? 'rounded-t' : ''}`} style={{ height: `${bookingPaymentPct}%` }} title={`${tr('Thanh toán đặt kho', 'Booking payments')}: ${(m.bookingPayment / 1_000_000).toFixed(2)}m`} />
                      )}
                      {depositPct > 0 && (
                        <div 
                          className={`w-full max-w-[42px] bg-cyan-500 ${renewalPct === 0 && extraChargePct === 0 && bookingPaymentPct === 0 && unclassifiedPct === 0 ? 'rounded-t' : ''}`}
                          style={{ height: `${depositPct}%` }}
                          title={`${tr('Tiền cọc', 'Deposits')}: ${(m.deposit / 1_000_000).toFixed(2)}m`}
                        />
                      )}
                      {rentalPct > 0 && (
                        <div 
                          className={`w-full max-w-[42px] bg-slate-900 rounded-b ${renewalPct === 0 && depositPct === 0 && extraChargePct === 0 && bookingPaymentPct === 0 && unclassifiedPct === 0 ? 'rounded-t' : ''}`}
                          style={{ height: `${rentalPct}%` }}
                          title={`${tr('Tiền thuê', 'Rental fees')}: ${(m.rentalFee / 1_000_000).toFixed(2)}m`}
                        />
                      )}
                    </div>
                    <span className="text-[11px] text-slate-600 font-semibold">{m.label}</span>
                    <span className="font-mono text-[11px] text-slate-900 font-bold">
                      {m.total >= 1_000_000 ? `${(m.total / 1_000_000).toFixed(1)}m` : `${(m.total / 1_000).toFixed(0)}k`}
                    </span>
                  </div>
                )
              })
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                {isReportsLoading ? tr('Đang tải biểu đồ doanh thu...', 'Loading revenue chart...') : reportsHaveError ? tr('Không tải được dữ liệu biểu đồ.', 'Could not load chart data.') : tr('Không có giao dịch PAID trong kỳ đã chọn.', 'No PAID payments in the selected period.')}
              </div>
            )}
          </div>

          <div className="mt-4 p-3 bg-slate-50 rounded-lg flex flex-wrap items-center justify-between gap-2 border border-slate-200">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-orange-600 text-[20px]">insights</span>
              <span className="text-xs text-slate-700 font-medium">
                {tr('Biểu đồ phân loại doanh thu PAID theo tháng xác nhận thanh toán.', 'Monthly breakdown of PAID revenue by payment confirmation date.')}
              </span>
            </div>
            <span className="text-xs font-mono font-bold text-slate-900">
              {tr('Tổng cộng', 'Total')}: {(paymentCountForScope ?? 0).toLocaleString(currencyLocale)} {tr('giao dịch PAID', 'PAID payments')}
            </span>
          </div>
        </div>

        {/* Donut Payment Channel & Contract Retention (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">{tr('Kênh thanh toán', 'Payment methods')}</h2>
              <p className="text-xs text-slate-500">
                {paymentMethodStats.isAvailable
                  ? `${tr('Phân bố từ', 'Breakdown of')} ${paymentMethodStats.totalCount} ${tr('giao dịch PAID trong kỳ.', 'PAID payments in the period.')}`
                  : tr('Chưa tải được phân bố kênh thanh toán.', 'Payment method breakdown unavailable.')}
              </p>
            </div>
            <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-xs font-bold text-slate-800 border border-slate-200">
              {tr('Phạm vi', 'Scope')}
            </span>
          </div>

          <div className="relative flex items-center justify-center my-4">
            <svg className="w-40 h-40 -rotate-90" viewBox="0 0 160 160">
              <circle className="text-slate-100" cx="80" cy="80" fill="transparent" r="64" stroke="currentColor" strokeWidth="14"></circle>
              {/* VNPay segment */}
              <circle 
                className="text-blue-600" 
                cx="80" 
                cy="80" 
                fill="transparent" 
                r="64" 
                stroke="currentColor" 
                strokeDasharray={`${402 * paymentMethodStats.vnpayPercent / 100} 402`}
                strokeDashoffset={0}
                strokeLinecap="round" 
                strokeWidth="14"
              />
              {/* Bank Transfer segment */}
              <circle 
                className="text-slate-900" 
                cx="80" 
                cy="80" 
                fill="transparent" 
                r="64" 
                stroke="currentColor" 
                strokeDasharray={`${402 * paymentMethodStats.bankPercent / 100} 402`}
                strokeDashoffset={-402 * paymentMethodStats.vnpayPercent / 100}
                strokeLinecap="round" 
                strokeWidth="14"
              />
              <circle
                className="text-amber-500"
                cx="80"
                cy="80"
                fill="transparent"
                r="64"
                stroke="currentColor"
                strokeDasharray={`${402 * paymentMethodStats.momoPercent / 100} 402`}
                strokeDashoffset={-402 * (paymentMethodStats.vnpayPercent + paymentMethodStats.bankPercent) / 100}
                strokeLinecap="round"
                strokeWidth="14"
              />
              <circle
                className="text-slate-400"
                cx="80"
                cy="80"
                fill="transparent"
                r="64"
                stroke="currentColor"
                strokeDasharray={`${402 * paymentMethodStats.otherCount / Math.max(paymentMethodStats.totalCount, 1)} 402`}
                strokeDashoffset={-402 * (paymentMethodStats.vnpayPercent + paymentMethodStats.bankPercent + paymentMethodStats.momoPercent) / 100}
                strokeLinecap="round"
                strokeWidth="14"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className="text-3xl font-extrabold font-mono text-slate-900 leading-none">
                {paymentMethodStats.totalCount}
              </span>
                    <span className="text-[10px] uppercase font-semibold text-slate-400 mt-1">{tr('Giao dịch PAID', 'PAID payments')}</span>
            </div>
          </div>

          {paymentMethodStats.isAvailable ? <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-200">
              <span className="flex items-center gap-2 text-xs text-slate-700">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-600"></span>
                {tr('Cổng VNPay (Thẻ / QR)', 'VNPay (card / QR)')}
              </span>
              <span className="font-mono text-xs font-bold text-slate-900">
                {paymentMethodStats.vnpayCount} GD ({paymentMethodStats.vnpayPercent}%)
              </span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-200">
              <span className="flex items-center gap-2 text-xs text-slate-500">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-400"></span>
                {tr('Khác / chưa xác định', 'Other / unknown')}
              </span>
              <span className="font-mono text-xs font-bold text-slate-900">
                {paymentMethodStats.otherCount} GD ({paymentMethodStats.totalCount ? Math.round(paymentMethodStats.otherCount / paymentMethodStats.totalCount * 1000) / 10 : 0}%)
              </span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-200">
              <span className="flex items-center gap-2 text-xs text-slate-700">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-900"></span>
                {tr('Chuyển khoản ngân hàng', 'Bank transfer')}
              </span>
              <span className="font-mono text-xs font-bold text-slate-900">
                {paymentMethodStats.bankCount} GD ({paymentMethodStats.bankPercent}%)
              </span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-200">
              <span className="flex items-center gap-2 text-xs text-slate-500">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500"></span>
                {tr('Ví MoMo', 'MoMo wallet')}
              </span>
              <span className="font-mono text-xs font-bold text-slate-900">
                {paymentMethodStats.momoCount} GD ({paymentMethodStats.momoPercent}%)
              </span>
            </div>
          </div> : (
            <div className="py-6 text-center text-xs text-slate-500">
                {isReportsLoading
                  ? tr('Đang tải phân bổ kênh thanh toán...', 'Loading payment methods...')
                  : reportsHaveError
                    ? tr('Không tải được phân bổ kênh thanh toán.', 'Could not load payment methods.')
                    : tr('Không có giao dịch PAID trong kỳ đã chọn.', 'No PAID payments in the selected period.')}
            </div>
          )}
        </div>
      </div>

      {/* MULTI-FACILITY PERFORMANCE TABLE */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-orange-600 text-[24px]">view_list</span>
              <h2 className="text-base font-bold text-slate-900">{tr('So sánh các cơ sở', 'Facility comparison')}</h2>
            </div>
            <p className="text-xs text-slate-500">{tr('Công suất hiện tại và doanh thu trong kỳ báo cáo.', 'Current capacity and revenue for the report period.')}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-slate-500 sm:inline">{tr('Sắp xếp:', 'Sort:')}</span>
            <button
              type="button"
              aria-pressed={facilitySort === 'revenue'}
              onClick={() => setFacilitySort('revenue')}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${facilitySort === 'revenue' ? 'border-slate-300 bg-slate-100 text-slate-900' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}
            >
              {tr('Doanh thu', 'Revenue')}
            </button>
            <button
              type="button"
              aria-pressed={facilitySort === 'occupancy'}
              onClick={() => setFacilitySort('occupancy')}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${facilitySort === 'occupancy' ? 'border-slate-300 bg-slate-100 text-slate-900' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}
            >
              {tr('Lấp đầy', 'Occupancy')}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-mono uppercase border-y border-slate-200">
                <th className="py-3 px-4 font-semibold">{tr('Tên cơ sở', 'Facility')}</th>
                <th className="py-3 px-3 font-semibold">{tr('Địa chỉ chi nhánh', 'Facility address')}</th>
                <th className="py-3 px-3 text-right font-semibold">{tr('Tổng kho', 'Total units')}</th>
                <th className="py-3 px-4 font-semibold text-center">{tr('Tỷ lệ lấp đầy', 'Occupancy rate')}</th>
                <th className="py-3 px-4 text-right font-semibold">{tr('Tổng doanh thu', 'Total revenue')}</th>
                <th className="py-3 px-4 text-right font-semibold">{tr('Doanh thu thuê', 'Rental revenue')}</th>
                <th className="py-3 px-3 text-center font-semibold">{tr('Kho trống', 'Available units')}</th>
                <th className="py-3 px-3 text-center font-semibold">{tr('Đặt trước', 'Reserved')}</th>
                <th className="py-3 px-3 text-center font-semibold">{tr('Bảo trì', 'Maintenance')}</th>
                <th className="py-3 px-4 text-center font-semibold">{tr('Thao tác', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {occupancyRows.length > 0 ? (
                occupancyRows.map((bf) => {
                  const facilityInfo = facilities.find(f => f.id === bf.facilityId)
                  const facilityRevenue = revenueData?.byFacility?.find(f => f.facilityId === bf.facilityId)
                  return (
                    <tr key={bf.facilityId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900">{bf.facilityName}</span>
                          <span className="text-[11px] text-slate-500">
                            {bf.occupiedUnits} {tr('kho đang thuê', 'units occupied')}{facilityInfo?.contactPhone ? ` · ${tr('Hotline', 'Phone')}: ${facilityInfo.contactPhone}` : ''}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-slate-600">
                        {facilityInfo?.address ? `${facilityInfo.address}${facilityInfo.city ? `, ${facilityInfo.city}` : ''}` : '—'}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-900">{bf.totalUnits} {tr('kho', 'units')}</td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1 items-center">
                          <span className="font-mono font-bold text-slate-900">{bf.occupancyRate.toFixed(1)}%</span>
                          <div className="w-24 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${bf.occupancyRate >= 70 ? 'bg-orange-600' : bf.occupancyRate >= 30 ? 'bg-blue-600' : 'bg-slate-400'}`} 
                              style={{ width: `${Math.min(100, bf.occupancyRate)}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                        {facilityRevenue?.totalRevenue != null ? `${facilityRevenue.totalRevenue.toLocaleString(currencyLocale)} ₫` : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-orange-600">
                        {facilityRevenue?.rentalFeeRevenue != null ? `${facilityRevenue.rentalFeeRevenue.toLocaleString(currencyLocale)} ₫` : '—'}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 text-[11px] font-semibold border border-slate-200">
                          {bf.availableUnits} {tr('kho trống', 'available')}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-center font-mono text-slate-700">{bf.reservedUnits ?? '—'}</td>
                      <td className="py-3.5 px-3 text-center font-mono text-slate-700">{bf.maintenanceUnits ?? '—'}</td>
                      <td className="py-3.5 px-4 text-center">
                        <button 
                          type="button" 
                          onClick={() => {
                            if (setSelectedFacility) {
                              setSelectedFacility(bf.facilityId)
                            } else {
                              setSelectedFacilityId(bf.facilityId)
                            }
                          }}
                          aria-label={`${tr('Lọc báo cáo theo', 'Filter report by')} ${bf.facilityName}`}
                          title={`${tr('Lọc báo cáo theo', 'Filter report by')} ${bf.facilityName}`}
                          className="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[18px]">visibility</span>
                        </button>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={10} className="py-6 text-center text-slate-500">
                    {isReportsLoading ? tr('Đang tải báo cáo...', 'Loading report...') : reportsHaveError ? tr('Không tải được báo cáo cơ sở.', 'Could not load facility report.') : tr('Chưa có dữ liệu cơ sở trong kỳ báo cáo.', 'No facility data for this report period.')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {selectedFacilityId === 'all' && revenueData && (facilityRevenueVariance !== 0 || facilityPaymentCountVariance !== 0) && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {tr('Chênh lệch chưa quy thuộc theo cơ sở', 'Unreconciled difference between system and facility totals')}: {facilityRevenueVariance.toLocaleString(currencyLocale)} ₫ · {facilityPaymentCountVariance} {tr('giao dịch PAID. Đây là chênh lệch tính từ báo cáo; nguyên nhân cần đối soát dữ liệu.', 'PAID payments. This is a report variance; its cause requires reconciliation.')}
          </div>
        )}
      </div>








    </div>
    </>
  )
}
