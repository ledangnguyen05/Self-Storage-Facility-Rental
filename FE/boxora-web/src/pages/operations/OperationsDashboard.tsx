import React, { useState, useEffect } from 'react'
import { reportService } from '../../services/reportService'
import { facilityService } from '../../services/facilityService'
import { Facility, FacilityPolicy, RevenueReport, OccupancyReport, OverdueDebtReport } from '../../types'

export const OperationsDashboard: React.FC = () => {
  // Policy configuration state
  const [miniPrice, setMiniPrice] = useState('650.000')
  const [standardPrice, setStandardPrice] = useState('1.450.000')
  const [climatePrice, setClimatePrice] = useState('2.350.000')
  const [depositOption, setDepositOption] = useState<'1month' | '2months'>('1month')
  const [discount3M, setDiscount3M] = useState('-5')
  const [discount6M, setDiscount6M] = useState('-10')
  const [discount12M, setDiscount12M] = useState('-15')
  const [graceDays, setGraceDays] = useState('03 Ngày')
  const [lateFee, setLateFee] = useState('50.000')
  const [lockoutDay, setLockoutDay] = useState('Ngày thứ 05')

  // Live reports and facilities from BE
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>('all')
  const [currentPolicy, setCurrentPolicy] = useState<FacilityPolicy | null>(null)
  const [revenueData, setRevenueData] = useState<RevenueReport | null>(null)
  const [occupancyData, setOccupancyData] = useState<OccupancyReport | null>(null)
  const [debtData, setDebtData] = useState<OverdueDebtReport | null>(null)
  const [isReportsLoading, setIsReportsLoading] = useState(true)
  const [facilitySort, setFacilitySort] = useState<'revenue' | 'occupancy'>('revenue')

  // Notification toast
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [toastIsError, setToastIsError] = useState(false)

  useEffect(() => {
    void loadDashboardData()
  }, [selectedFacilityId])

  const loadDashboardData = async () => {
    setIsReportsLoading(true)
    const today = new Date()
    const fromDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
    const toDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    try {
      const [facRes, revRes, occRes, debtRes, polRes] = await Promise.allSettled([
        facilityService.getFacilities(),
        reportService.getRevenueReport(fromDate, toDate),
        reportService.getOccupancyReport(),
        reportService.getOverdueDebtReport(selectedFacilityId === 'all' ? undefined : { facilityId: selectedFacilityId }),
        selectedFacilityId === 'all'
          ? Promise.resolve(null)
          : facilityService.getPolicyByFacilityId(selectedFacilityId),
      ])
      if (facRes.status === 'fulfilled' && facRes.value?.content) {
        setFacilities(facRes.value.content)
      }
      if (revRes.status === 'fulfilled' && revRes.value) {
        setRevenueData(revRes.value)
      }
      if (occRes.status === 'fulfilled' && occRes.value) {
        setOccupancyData(occRes.value)
      }
      if (debtRes.status === 'fulfilled' && debtRes.value) {
        setDebtData(debtRes.value)
      }
      if (polRes.status === 'fulfilled' && polRes.value) {
        const pol = polRes.value
        setCurrentPolicy(pol)
        if (pol.lateFeePerDay != null) setLateFee(pol.lateFeePerDay.toLocaleString('vi-VN'))
        if (pol.gracePeriodDays != null) setGraceDays(`${pol.gracePeriodDays} Ngày`)
        if (pol.discount3Months != null) setDiscount3M(`-${pol.discount3Months}`)
        if (pol.discount6Months != null) setDiscount6M(`-${pol.discount6Months}`)
        if (pol.discount12Months != null) setDiscount12M(`-${pol.discount12Months}`)
        if (pol.overdueSealingDays != null) setLockoutDay(`Ngày thứ ${pol.overdueSealingDays}`)
        if (pol.depositPercent != null) setDepositOption(pol.depositPercent >= 200 ? '2months' : '1month')
      } else {
        setCurrentPolicy(null)
      }
    } catch {
      // Keep static defaults on network error
    } finally {
      setIsReportsLoading(false)
    }
  }

  const occupancyRows = [...(occupancyData?.byFacility ?? [])]
    .filter((row) => selectedFacilityId === 'all' || row.facilityId === selectedFacilityId)
    .sort((a, b) => {
      if (facilitySort === 'occupancy') return b.occupancyRate - a.occupancyRate
      const aRevenue = revenueData?.byFacility?.find((item) => item.facilityId === a.facilityId)?.totalRevenue ?? -1
      const bRevenue = revenueData?.byFacility?.find((item) => item.facilityId === b.facilityId)?.totalRevenue ?? -1
      return bRevenue - aRevenue
    })
  const revenueForScope = selectedFacilityId === 'all'
    ? revenueData?.systemSummary?.totalRevenue
    : revenueData?.byFacility?.find((item) => item.facilityId === selectedFacilityId)?.totalRevenue
  const occupancyForScope = selectedFacilityId === 'all'
    ? occupancyData?.systemSummary
    : occupancyData?.byFacility?.find((item) => item.facilityId === selectedFacilityId)
  const periodLabel = revenueData?.fromDate && revenueData?.toDate
    ? `${new Date(`${revenueData.fromDate}T00:00:00`).toLocaleDateString('vi-VN')} – ${new Date(`${revenueData.toDate}T00:00:00`).toLocaleDateString('vi-VN')}`
    : 'Kỳ hiện tại'
  const formatCurrency = (value?: number) => value == null ? '—' : value.toLocaleString('vi-VN')

  const showToast = (msg: string, isError = false) => {
    setToastMessage(msg)
    setToastIsError(isError)
    setTimeout(() => setToastMessage(null), 3000)
  }

  const handleSavePolicies = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (selectedFacilityId === 'all') {
        showToast('Hãy chọn một cơ sở cụ thể trước khi lưu chính sách.', true)
        return
      }
      const payload: Partial<FacilityPolicy> = {
        facilityId: selectedFacilityId,
        lateFeePerDay: Number(lateFee.replace(/\D/g, '')),
        discount3Months: Math.abs(Number(discount3M)) || 0,
        discount6Months: Math.abs(Number(discount6M)) || 0,
        discount12Months: Math.abs(Number(discount12M)) || 0,
        depositPercent: depositOption === '2months' ? 200 : 100,
        gracePeriodDays: Number.parseInt(graceDays, 10) || 0,
        overdueSealingDays: Number.parseInt(lockoutDay.replace(/\D/g, ''), 10) || 5,
      }
      const saved = currentPolicy?.id
        ? await facilityService.updatePolicy(currentPolicy.id, payload)
        : await facilityService.createPolicy(payload)
      setCurrentPolicy(saved)
      showToast(`Đã lưu chính sách cho ${facilities.find(facility => facility.id === selectedFacilityId)?.name || 'cơ sở đã chọn'}.`)
    } catch (error) {
      showToast('Không lưu được chính sách. Dữ liệu chưa được cập nhật; vui lòng thử lại.', true)
    }
  }

  const handleExportRevenueCsv = () => {
    const rows = revenueData?.byFacility
    if (!rows?.length) {
      showToast('Chưa có dữ liệu doanh thu để xuất.', true)
      return
    }
    const csvRows = [
      ['Cơ sở', 'Tổng doanh thu (VND)', 'Tiền thuê (VND)', 'Tiền cọc (VND)', 'Gia hạn (VND)', 'Số thanh toán'],
      ...rows
        .filter(row => selectedFacilityId === 'all' || row.facilityId === selectedFacilityId)
        .map(row => [row.facilityName, row.totalRevenue, row.rentalFeeRevenue, row.depositRevenue, row.renewalFeeRevenue ?? 0, row.paymentCount ?? 0]),
    ]
    const csv = '\uFEFF' + csvRows.map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `boxora-doanh-thu-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
    showToast('Đã tải báo cáo doanh thu CSV.')
  }

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-24 right-8 z-50 flex items-center gap-2 px-4 py-3 bg-neutral-900 text-white rounded-lg shadow-xl border border-neutral-700 animate-in fade-in duration-200">
          <span className={`material-symbols-outlined text-[20px] ${toastIsError ? 'text-rose-400' : 'text-emerald-400'}`}>{toastIsError ? 'error' : 'check_circle'}</span>
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* TOP CONTEXT & C-LEVEL STRIP */}
      <div className="relative w-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none"></div>
        <div className="absolute left-1/3 -bottom-16 h-48 w-48 rounded-full bg-teal-500/10 blur-2xl pointer-events-none"></div>

        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-col gap-2 max-w-2xl text-left">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold ${isReportsLoading ? 'bg-slate-50 border-slate-200 text-slate-600' : revenueData && occupancyData && debtData ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${isReportsLoading ? 'bg-slate-400' : revenueData && occupancyData && debtData ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                {isReportsLoading ? 'Đang tải báo cáo' : revenueData && occupancyData && debtData ? 'Dữ liệu hệ thống' : 'Dữ liệu chưa đầy đủ'}
              </span>
            </div>
            <h1 className="text-2xl font-bold font-headline text-slate-900 tracking-tight">
              Doanh thu &amp; vận hành hệ thống
            </h1>
            <p className="text-sm text-slate-600">
              Theo dõi doanh thu, công suất kho, công nợ và chính sách tại các cơ sở.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="flex items-center bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs">
              <span className="material-symbols-outlined text-cyan-600 text-[20px] mr-2">apartment</span>
              <div className="flex flex-col text-left">
                <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider leading-none">Phạm vi cơ sở</span>
                <select 
                  value={selectedFacilityId}
                  onChange={(e) => setSelectedFacilityId(e.target.value)}
                  className="bg-transparent font-mono text-xs text-slate-900 focus:outline-none cursor-pointer pr-4 font-semibold"
                >
                  <option value="all">Tất cả cơ sở{facilities.length > 0 ? ` (${facilities.length})` : ''}</option>
                  {facilities.map((fac) => (
                    <option key={fac.id} value={fac.id}>{fac.name} ({fac.city})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 shadow-xs">
              <span className="material-symbols-outlined text-slate-500 text-[20px] mr-2">calendar_month</span>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 uppercase font-semibold leading-none">Kỳ báo cáo</span>
                <span className="font-mono text-xs text-slate-900 font-semibold">
                  {periodLabel}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 ml-auto lg:ml-0">
              <button 
                type="button" 
                onClick={handleExportRevenueCsv}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-medium transition-all shadow-xs border border-slate-200"
              >
                <span className="material-symbols-outlined text-[18px]">table_view</span>
                Tải CSV
              </button>
              <button 
                type="button" 
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 text-white hover:bg-neutral-800 rounded-lg text-xs font-semibold transition-all shadow-sm"
              >
                <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
                In / lưu PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4 EXECUTIVE SUMMARY KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="relative overflow-hidden rounded-xl bg-white p-5 shadow-sm border border-slate-200 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="text-xs uppercase font-semibold text-slate-500 tracking-wider">Tổng Doanh Thu Hệ Thống</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold font-mono text-slate-900">
                  {revenueForScope != null ? revenueForScope.toLocaleString('vi-VN') : '—'}
                </span>
                <span className="text-xs text-slate-500 font-mono">VNĐ</span>
              </div>
            </div>
            <div className="h-10 w-10 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600 border border-orange-100">
              <span className="material-symbols-outlined text-[22px]">payments</span>
            </div>
          </div>
          <div className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
            {revenueData?.systemSummary?.paymentCount != null
              ? `${revenueData.systemSummary.paymentCount.toLocaleString('vi-VN')} giao dịch trong kỳ`
              : 'Chưa có dữ liệu doanh thu'}
          </div>
        </div>

        {/* Metric 2 */}
        <div className="relative overflow-hidden rounded-xl bg-white p-5 shadow-sm border border-slate-200 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="text-xs uppercase font-semibold text-slate-500 tracking-wider">Tỷ Lệ Lấp Đầy Bình Quân</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold font-mono text-slate-900">
                  {occupancyForScope?.occupancyRate != null ? `${occupancyForScope.occupancyRate.toFixed(1)}%` : '—'}
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  {occupancyForScope?.occupiedUnits != null ? `${occupancyForScope.occupiedUnits} / ${occupancyForScope.totalUnits}` : 'kho'}
                </span>
              </div>
            </div>
            <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100">
              <span className="material-symbols-outlined text-[22px]">pie_chart</span>
            </div>
          </div>
          <div className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
            {occupancyForScope?.availableUnits != null ? `Còn trống: ${occupancyForScope.availableUnits} kho` : 'Chưa có dữ liệu công suất'}
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-2">
            <div className="bg-blue-600 h-full rounded-full" style={{ width: `${occupancyForScope?.occupancyRate ?? 0}%` }}></div>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="relative overflow-hidden rounded-xl bg-white p-5 shadow-sm border border-slate-200 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="text-xs uppercase font-semibold text-slate-500 tracking-wider">Tỷ Lệ Gia Hạn Hợp Đồng</span>
              <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold font-mono text-slate-900">—</span>
              <span className="text-xs text-slate-500 font-mono">Chưa có dữ liệu</span>
              </div>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100">
              <span className="material-symbols-outlined text-[22px]">autorenew</span>
            </div>
          </div>
          <div className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
            Chưa có báo cáo hợp đồng tái ký
          </div>
        </div>

        {/* Metric 4 */}
        <div className="relative overflow-hidden rounded-xl bg-white p-5 shadow-sm border border-slate-200 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="text-xs uppercase font-semibold text-slate-500 tracking-wider">Nợ Xấu &amp; Quá Hạn Thu</span>
              <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold font-mono text-rose-600">{debtData ? debtData.totalDebtAmount.toLocaleString('vi-VN') : '—'}</span>
                <span className="text-xs text-slate-500 font-mono">VNĐ</span>
              </div>
            </div>
            <div className="h-10 w-10 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600 border border-rose-100">
              <span className="material-symbols-outlined text-[22px]">gavel</span>
            </div>
          </div>
          <div className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
            {debtData
              ? `${debtData.totalOverdueCount} khoản quá hạn · ${debtData.accessBlockedCount} kho đã khóa`
              : 'Chưa có dữ liệu công nợ'}
          </div>
        </div>
      </div>

      {/* CHARTS ROW: STACKED REVENUE & DONUT CHURN */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Stacked Revenue Bar Chart (8 cols) */}
        <div className="lg:col-span-8 bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Xu hướng doanh thu</h2>
              <p className="text-xs text-amber-700">Dữ liệu minh họa 11/2024–04/2025; API hiện chưa cung cấp lịch sử theo tháng.</p>
            </div>
            <div className="flex items-center gap-3 text-slate-600 text-xs font-medium">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-slate-900"></span>Tiền thuê kho</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-orange-600"></span>Kho mát nhiệt độ</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-orange-400"></span>Dịch vụ phụ trợ</span>
            </div>
          </div>

          {/* Bar Columns Container */}
          <div className="w-full h-64 flex items-end justify-between gap-3 sm:gap-6 pt-4 pb-2 px-2 border-b border-slate-200">
            {/* T11/24 */}
            <div className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
              <div className="w-full flex flex-col items-center gap-0.5 h-[55%]">
                <div className="w-full max-w-[44px] bg-orange-400 rounded-t h-[15%]" title="Phụ trợ: 18Tr"></div>
                <div className="w-full max-w-[44px] bg-orange-600 h-[25%]" title="Kho lạnh: 32Tr"></div>
                <div className="w-full max-w-[44px] bg-slate-900 rounded-b h-[60%]" title="Kho thường: 76Tr"></div>
              </div>
              <span className="text-[11px] text-slate-500">T11/24</span>
              <span className="font-mono text-xs text-slate-800 font-bold">1.12 tỷ</span>
            </div>

            {/* T12/24 */}
            <div className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
              <div className="w-full flex flex-col items-center gap-0.5 h-[62%]">
                <div className="w-full max-w-[44px] bg-orange-400 rounded-t h-[16%]" title="Phụ trợ: 22Tr"></div>
                <div className="w-full max-w-[44px] bg-orange-600 h-[26%]" title="Kho lạnh: 36Tr"></div>
                <div className="w-full max-w-[44px] bg-slate-900 rounded-b h-[58%]" title="Kho thường: 80Tr"></div>
              </div>
              <span className="text-[11px] text-slate-500">T12/24</span>
              <span className="font-mono text-xs text-slate-800 font-bold">1.21 tỷ</span>
            </div>

            {/* T01/25 */}
            <div className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
              <div className="w-full flex flex-col items-center gap-0.5 h-[68%]">
                <div className="w-full max-w-[44px] bg-orange-400 rounded-t h-[18%]" title="Phụ trợ: 26Tr"></div>
                <div className="w-full max-w-[44px] bg-orange-600 h-[27%]" title="Kho lạnh: 39Tr"></div>
                <div className="w-full max-w-[44px] bg-slate-900 rounded-b h-[55%]" title="Kho thường: 80Tr"></div>
              </div>
              <span className="text-[11px] text-slate-500">T01/25</span>
              <span className="font-mono text-xs text-slate-800 font-bold">1.27 tỷ</span>
            </div>

            {/* T02/25 */}
            <div className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
              <div className="w-full flex flex-col items-center gap-0.5 h-[65%]">
                <div className="w-full max-w-[44px] bg-orange-400 rounded-t h-[17%]" title="Phụ trợ: 24Tr"></div>
                <div className="w-full max-w-[44px] bg-orange-600 h-[26%]" title="Kho lạnh: 37Tr"></div>
                <div className="w-full max-w-[44px] bg-slate-900 rounded-b h-[57%]" title="Kho thường: 79Tr"></div>
              </div>
              <span className="text-[11px] text-slate-500">T02/25 (Tết)</span>
              <span className="font-mono text-xs text-slate-800 font-bold">1.24 tỷ</span>
            </div>

            {/* T03/25 */}
            <div className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
              <div className="w-full flex flex-col items-center gap-0.5 h-[76%]">
                <div className="w-full max-w-[44px] bg-orange-400 rounded-t h-[20%]" title="Phụ trợ: 32Tr"></div>
                <div className="w-full max-w-[44px] bg-orange-600 h-[28%]" title="Kho lạnh: 45Tr"></div>
                <div className="w-full max-w-[44px] bg-slate-900 rounded-b h-[52%]" title="Kho thường: 83Tr"></div>
              </div>
              <span className="text-[11px] text-slate-500">T03/25</span>
              <span className="font-mono text-xs text-slate-800 font-bold">1.36 tỷ</span>
            </div>

            {/* T04/25 Active */}
            <div className="flex-1 flex flex-col items-center gap-2 h-full justify-end relative">
              <div className="w-full flex flex-col items-center gap-0.5 h-[88%]">
                <div className="w-full max-w-[44px] bg-orange-400 rounded-t h-[22%]" title="Phụ trợ: 38Tr"></div>
                <div className="w-full max-w-[44px] bg-orange-600 h-[30%]" title="Kho lạnh: 52Tr"></div>
                <div className="w-full max-w-[44px] bg-slate-900 rounded-b h-[48%]" title="Kho thường: 83Tr"></div>
              </div>
              <span className="text-[11px] font-bold text-orange-600">T04/25</span>
              <span className="font-mono text-xs text-orange-600 font-bold">1.43 tỷ</span>
            </div>
          </div>

          <div className="mt-4 p-3 bg-slate-50 rounded-lg flex flex-wrap items-center justify-between gap-2 border border-slate-200">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-orange-600 text-[20px]">insights</span>
              <span className="text-xs text-slate-700 font-medium">
                Báo cáo xu hướng theo nhóm dịch vụ sẽ hiển thị khi có API lịch sử doanh thu.
              </span>
            </div>
            <span className="text-xs font-medium text-slate-500">Chưa có API phân tích lịch sử</span>
          </div>
        </div>

        {/* Donut Renewal Trends Chart (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Tình hình tái ký</h2>
              <p className="text-xs text-amber-700">Biểu đồ minh họa · chưa có dữ liệu hợp đồng</p>
            </div>
            <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-xs font-bold text-slate-800 border border-slate-200">
              6 Tháng
            </span>
          </div>

          <div className="relative flex items-center justify-center my-4">
            <svg className="w-40 h-40 -rotate-90" viewBox="0 0 160 160">
              <circle className="text-slate-100" cx="80" cy="80" fill="transparent" r="64" stroke="currentColor" strokeWidth="14"></circle>
              <circle className="text-orange-600" cx="80" cy="80" fill="transparent" r="64" stroke="currentColor" strokeDasharray="402" strokeDashoffset="60" strokeLinecap="round" strokeWidth="14"></circle>
              <circle className="text-slate-900" cx="80" cy="80" fill="transparent" r="64" stroke="currentColor" strokeDasharray="402" strokeDashoffset="240" strokeLinecap="round" strokeWidth="14"></circle>
            </svg>
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className="text-3xl font-extrabold font-mono text-slate-900 leading-none">94%</span>
              <span className="text-[10px] uppercase font-semibold text-slate-400 mt-1">Tái ký thành công</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-200">
              <span className="flex items-center gap-2 text-xs text-slate-700">
                <span className="h-2.5 w-2.5 rounded-full bg-orange-600"></span>
                Tự động gia hạn qua Ví/Thẻ
              </span>
              <span className="font-mono text-xs font-bold text-slate-900">71.5%</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-200">
              <span className="flex items-center gap-2 text-xs text-slate-700">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-900"></span>
                Tái ký qua Quầy &amp; QR
              </span>
              <span className="font-mono text-xs font-bold text-slate-900">22.7%</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-200">
              <span className="flex items-center gap-2 text-xs text-slate-500">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-300"></span>
                Chấm dứt hợp đồng/Trả kho
              </span>
              <span className="font-mono text-xs font-bold text-orange-600">5.8%</span>
            </div>
          </div>
        </div>
      </div>

      {/* MULTI-FACILITY PERFORMANCE TABLE */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-orange-600 text-[24px]">view_list</span>
              <h2 className="text-base font-bold text-slate-900">So sánh các cơ sở</h2>
            </div>
            <p className="text-xs text-slate-500">Công suất và doanh thu trong kỳ báo cáo. Dấu “—” là chưa có số liệu.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-slate-500 sm:inline">Sắp xếp:</span>
            <button
              type="button"
              aria-pressed={facilitySort === 'revenue'}
              onClick={() => setFacilitySort('revenue')}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${facilitySort === 'revenue' ? 'border-slate-300 bg-slate-100 text-slate-900' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}
            >
              Doanh thu
            </button>
            <button
              type="button"
              aria-pressed={facilitySort === 'occupancy'}
              onClick={() => setFacilitySort('occupancy')}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${facilitySort === 'occupancy' ? 'border-slate-300 bg-slate-100 text-slate-900' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}
            >
              Lấp đầy
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-mono uppercase border-y border-slate-200">
                <th className="py-3 px-4 font-semibold">Tên Cơ Sở &amp; Quản Lý</th>
                <th className="py-3 px-3 font-semibold">Địa Chỉ Chi Nhánh</th>
                <th className="py-3 px-3 text-right font-semibold">Tổng Kho</th>
                <th className="py-3 px-4 font-semibold text-center">Tỷ Lệ Lấp Đầy</th>
                <th className="py-3 px-4 text-right font-semibold">Tổng doanh thu</th>
                <th className="py-3 px-4 text-right font-semibold">Doanh thu thuê</th>
                <th className="py-3 px-3 text-center font-semibold">Kho trống</th>
                <th className="py-3 px-4 text-center font-semibold">Thao Tác</th>
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
                            {bf.occupiedUnits} kho đang thuê{facilityInfo?.contactPhone ? ` · Hotline: ${facilityInfo.contactPhone}` : ''}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-slate-600">
                        {facilityInfo?.address ? `${facilityInfo.address}, ${facilityInfo.city}` : '—'}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-900">{bf.totalUnits} kho</td>
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
                        {facilityRevenue?.totalRevenue != null ? `${facilityRevenue.totalRevenue.toLocaleString('vi-VN')} đ` : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-orange-600">
                        {facilityRevenue?.rentalFeeRevenue != null ? `${facilityRevenue.rentalFeeRevenue.toLocaleString('vi-VN')} đ` : '—'}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 text-[11px] font-semibold border border-slate-200">
                          {bf.availableUnits} kho trống
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button 
                          type="button" 
                          onClick={() => setSelectedFacilityId(bf.facilityId)}
                          aria-label={`Lọc báo cáo theo ${bf.facilityName}`}
                          title={`Lọc báo cáo theo ${bf.facilityName}`}
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
                  <td colSpan={8} className="py-6 text-center text-slate-500">
                    {isReportsLoading ? 'Đang tải báo cáo...' : 'Chưa có dữ liệu cơ sở trong kỳ báo cáo.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4-TIER DYNAMIC PRICING MATRIX & BUSINESS POLICY ENGINE */}
      <form onSubmit={handleSavePolicies} className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600 border border-orange-100">
              <span className="material-symbols-outlined text-[24px]">tune</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Cấu Hình Quy Tắc Kinh Doanh &amp; Chính Sách Giá Động (Pricing Matrix)
              </h2>
              <p className="text-xs text-slate-500">Lưu các trường chính sách được API hỗ trợ cho cơ sở đang chọn. Bảng giá theo diện tích chỉ để tham khảo.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              type="button" 
              onClick={() => {
                setMiniPrice('650.000')
                setStandardPrice('1.450.000')
                setClimatePrice('2.350.000')
                setDepositOption('1month')
                setDiscount3M('-5')
                setDiscount6M('-10')
                setDiscount12M('-15')
                showToast('Đã khôi phục thông số chính sách mặc định')
              }}
              className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all border border-slate-200"
            >
              Khôi phục mặc định
            </button>
            <button 
              type="submit" 
              disabled={selectedFacilityId === 'all' || isReportsLoading}
              title={selectedFacilityId === 'all' ? 'Chọn một cơ sở cụ thể để lưu chính sách' : undefined}
              className="px-4 py-2 rounded-lg bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[18px]">save</span>
              Lưu chính sách cơ sở
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* Tier 1: Base Pricing */}
          <div className="bg-slate-50 rounded-xl p-4 flex flex-col justify-between border border-slate-200">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs uppercase font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-orange-600 text-[18px]">sell</span>
                  1. Bảng Giá Tiêu Chuẩn
                </span>
                <span className="px-2 py-0.5 rounded bg-white text-xs font-semibold text-orange-600 border border-slate-200">Đang bật</span>
              </div>
              <p className="text-xs text-slate-500 mb-3">Giá tham khảo theo diện tích; API chính sách hiện chưa lưu các trường giá này.</p>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between p-2 rounded bg-white border border-slate-200">
                  <span className="text-xs text-slate-800">Kho Mini (1 - 3m²)</span>
                  <div className="flex items-center gap-1">
                    <input 
                      type="text" 
                      value={miniPrice}
                      onChange={(e) => setMiniPrice(e.target.value)}
                      disabled
                      className="w-20 text-right bg-slate-50 rounded px-1.5 py-0.5 font-mono text-xs font-bold text-slate-900 focus:outline-none border border-slate-200" 
                    />
                    <span className="text-xs text-slate-400">đ</span>
                  </div>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-white border border-slate-200">
                  <span className="text-xs text-slate-800">Kho Tiêu Chuẩn (4 - 10m²)</span>
                  <div className="flex items-center gap-1">
                    <input 
                      type="text" 
                      value={standardPrice}
                      onChange={(e) => setStandardPrice(e.target.value)}
                      disabled
                      className="w-20 text-right bg-slate-50 rounded px-1.5 py-0.5 font-mono text-xs font-bold text-slate-900 focus:outline-none border border-slate-200" 
                    />
                    <span className="text-xs text-slate-400">đ</span>
                  </div>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-white border border-slate-200">
                  <span className="text-xs text-slate-800">Kho Mát Điện Toán</span>
                  <div className="flex items-center gap-1">
                    <input 
                      type="text" 
                      value={climatePrice}
                      onChange={(e) => setClimatePrice(e.target.value)}
                      disabled
                      className="w-20 text-right bg-slate-50 rounded px-1.5 py-0.5 font-mono text-xs font-bold text-orange-600 focus:outline-none border border-slate-200" 
                    />
                    <span className="text-xs text-slate-400">đ</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-2 text-slate-500 text-xs flex items-center justify-between border-t border-slate-200">
              <span>Hệ số giờ cao điểm:</span>
              <span className="font-mono font-bold text-slate-800">+0% (Thường nhật)</span>
            </div>
          </div>

          {/* Tier 2: Security Deposit */}
          <div className="bg-slate-50 rounded-xl p-4 flex flex-col justify-between border border-slate-200">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs uppercase font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-slate-800 text-[18px]">account_balance_wallet</span>
                  2. Tiền Cọc Đảm Bảo
                </span>
                <span className="px-2 py-0.5 rounded bg-white text-xs font-semibold text-slate-800 border border-slate-200">Bắt buộc</span>
              </div>
              <p className="text-xs text-slate-500 mb-3">Chính sách bảo chứng tài sản &amp; thiết bị IoT:</p>
              <div className="flex flex-col gap-2">
                <label className="flex items-start gap-2 p-2 rounded bg-white border border-slate-200 cursor-pointer">
                  <input 
                    type="radio" 
                    name="deposit" 
                    checked={depositOption === '1month'}
                    onChange={() => setDepositOption('1month')}
                    className="mt-1 accent-orange-600" 
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-900">Mặc định: 01 Tháng Tiền Thuê</span>
                    <span className="text-[11px] text-slate-500">Khách cá nhân và DN nhỏ &lt; 6 tháng</span>
                  </div>
                </label>
                <label className="flex items-start gap-2 p-2 rounded bg-white border border-slate-200 cursor-pointer">
                  <input 
                    type="radio" 
                    name="deposit" 
                    checked={depositOption === '2months'}
                    onChange={() => setDepositOption('2months')}
                    className="mt-1 accent-orange-600" 
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-900">Cố định: 02 Tháng Tiền Thuê</span>
                    <span className="text-[11px] text-slate-500">Kho điều hòa hoặc thuê &gt; 100m²</span>
                  </div>
                </label>
              </div>
            </div>
            <div className="mt-4 pt-2 text-slate-500 text-xs flex items-center justify-between border-t border-slate-200">
              <span>Thời gian hoàn cọc:</span>
              <span className="font-mono font-bold text-slate-800">Tối đa 48h làm việc</span>
            </div>
          </div>

          {/* Tier 3: Tenure Discount */}
          <div className="bg-slate-50 rounded-xl p-4 flex flex-col justify-between border border-slate-200">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs uppercase font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-orange-600 text-[18px]">percent</span>
                  3. Chiết Khấu Kỳ Hạn
                </span>
                <span className="px-2 py-0.5 rounded bg-white text-xs font-semibold text-slate-800 border border-slate-200">Kích hoạt</span>
              </div>
              <p className="text-xs text-slate-500 mb-3">Khuyến khích ký dài hạn &amp; giảm tỷ lệ churn:</p>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between p-2 rounded bg-white border border-slate-200">
                  <span className="text-xs text-slate-800">Trả trước 3 Tháng</span>
                  <div className="flex items-center gap-1">
                    <input 
                      type="text" 
                      value={discount3M}
                      onChange={(e) => setDiscount3M(e.target.value)}
                      className="w-12 text-center bg-slate-50 rounded px-1.5 py-0.5 font-mono text-xs font-bold text-orange-600 focus:outline-none border border-slate-200" 
                    />
                    <span className="text-xs text-slate-800">%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-white border border-slate-200">
                  <span className="text-xs text-slate-800">Trả trước 6 Tháng</span>
                  <div className="flex items-center gap-1">
                    <input 
                      type="text" 
                      value={discount6M}
                      onChange={(e) => setDiscount6M(e.target.value)}
                      className="w-12 text-center bg-slate-50 rounded px-1.5 py-0.5 font-mono text-xs font-bold text-orange-600 focus:outline-none border border-slate-200" 
                    />
                    <span className="text-xs text-slate-800">%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-white border border-slate-200">
                  <span className="text-xs text-slate-800">Trả trước 12 Tháng</span>
                  <div className="flex items-center gap-1">
                    <input 
                      type="text" 
                      value={discount12M}
                      onChange={(e) => setDiscount12M(e.target.value)}
                      className="w-12 text-center bg-slate-50 rounded px-1.5 py-0.5 font-mono text-xs font-bold text-orange-600 focus:outline-none border border-slate-200" 
                    />
                    <span className="text-xs text-slate-800">%</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-2 text-slate-500 text-xs flex items-center justify-between border-t border-slate-200">
              <span>Tặng thêm:</span>
              <span className="font-mono font-semibold text-slate-800">Free 10 thùng carton cho 12T</span>
            </div>
          </div>

          {/* Tier 4: Overdue & Penalty */}
          <div className="bg-slate-50 rounded-xl p-4 flex flex-col justify-between border border-slate-200">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs uppercase font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-rose-600 text-[18px]">lock_clock</span>
                  4. Xử Lý Quá Hạn
                </span>
                <span className="px-2 py-0.5 rounded bg-white text-xs font-semibold text-rose-600 border border-slate-200">Tự Động IoT</span>
              </div>
              <p className="text-xs text-slate-500 mb-3">Quy chuẩn thu hồi công nợ &amp; điều khiển khóa:</p>
              <div className="flex flex-col gap-2">
                <div className="p-2 rounded bg-white border border-slate-200 flex flex-col gap-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-800">Thời gian ân hạn:</span>
                    <span className="font-mono text-xs font-bold text-slate-900">{graceDays}</span>
                  </div>
                  <span className="text-[10px] text-slate-500">Không áp dụng phí phạt trễ hạn.</span>
                </div>
                <div className="p-2 rounded bg-white border border-slate-200 flex flex-col gap-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-800">Phạt từ Ngày thứ 4:</span>
                    <span className="font-mono text-xs font-bold text-orange-600">{lateFee} đ/ngày</span>
                  </div>
                  <span className="text-[10px] text-slate-500">Tự cộng vào biên lai kế tiếp.</span>
                </div>
                <div className="p-2 rounded bg-white border border-slate-200 flex flex-col gap-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-rose-700">Khóa cổng điện tử:</span>
                    <span className="font-mono text-xs font-bold text-rose-700">{lockoutDay}</span>
                  </div>
                  <span className="text-[10px] text-slate-500">Ngắt mã PIN &amp; quyền App.</span>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-2 text-slate-500 text-xs flex items-center justify-between border-t border-slate-200">
              <span>Thông báo tự động:</span>
              <span className="font-mono font-bold text-slate-800">SMS + Email + Zalo ZNS</span>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
