import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useLanguage } from '../../context/LanguageContext'
import { reportService } from '../../services/reportService'
import { facilityService } from '../../services/facilityService'
import { contractService, RentalContract } from '../../services/contractService'
import { paymentService, PaymentItem } from '../../services/paymentService'
import { Facility, RevenueReport, OccupancyReport, OverdueDebtReport } from '../../types'
import { ContractRenewalsManagementPanel } from '../../components/renewal/ContractRenewalsManagementPanel'

// Helper for contracts loading across pages
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

// Financial categorisation helpers
export const getFinancialCategory = (paymentType: string) => {
  switch (paymentType) {
    case 'RENTAL_FEE':
    case 'RENEWAL_FEE':
    case 'EXTRA_CHARGE':
      return { id: 'OPERATING_REVENUE', labelVi: 'Doanh thu hoạt động', labelEn: 'Operating revenue', color: 'emerald' }
    case 'DEPOSIT':
      return { id: 'HELD_DEPOSIT', labelVi: 'Tiền cọc giữ hộ', labelEn: 'Held deposit', color: 'cyan' }
    case 'BOOKING_PAYMENT':
      return { id: 'RESERVATION_HOLD', labelVi: 'Đặt chỗ giữ kho', labelEn: 'Reservation hold', color: 'purple' }
    default:
      return { id: 'OTHER', labelVi: 'Khoản thu khác', labelEn: 'Other collection', color: 'slate' }
  }
}

export const getPaymentTypeBadge = (paymentType: string) => {
  switch (paymentType) {
    case 'RENTAL_FEE':
      return { labelVi: 'Tiền thuê kho', labelEn: 'Rental fee', bg: 'bg-slate-900 text-white border-slate-900' }
    case 'DEPOSIT':
      return { labelVi: 'Tiền đặt cọc', labelEn: 'Deposit', bg: 'bg-cyan-50 text-cyan-800 border-cyan-300' }
    case 'RENEWAL_FEE':
      return { labelVi: 'Gia hạn / Tái ký', labelEn: 'Renewal fee', bg: 'bg-emerald-50 text-emerald-800 border-emerald-300' }
    case 'EXTRA_CHARGE':
      return { labelVi: 'Phụ phí & Dịch vụ', labelEn: 'Extra charge', bg: 'bg-amber-50 text-amber-800 border-amber-300' }
    case 'BOOKING_PAYMENT':
      return { labelVi: 'Thanh toán giữ chỗ', labelEn: 'Booking hold', bg: 'bg-purple-50 text-purple-800 border-purple-300' }
    default:
      return { labelVi: paymentType || 'Khác', labelEn: paymentType || 'Other', bg: 'bg-slate-100 text-slate-700 border-slate-300' }
  }
}

export const OperationsDashboard: React.FC = () => {
  const { t, language } = useLanguage()
  const tr = (vietnamese: string, english: string) => t(vietnamese, english)
  const currencyLocale = language === 'vi' ? 'vi-VN' : 'en-US'
  const formatVnd = (value: number) => `${Math.round(value).toLocaleString(currencyLocale)} ₫`
  const formatReportDate = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString(currencyLocale)

  const { selectedFacility, setSelectedFacility, facilities: contextFacilities } = useOutletContext<{
    selectedFacility?: string
    setSelectedFacility?: (facId: string) => void
    facilities?: Facility[]
  }>() || {}

  const dashboardRequestSequence = useRef(0)

  // Facilities & Scope
  const [facilities, setFacilities] = useState<Facility[]>(contextFacilities || [])
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>(() =>
    !selectedFacility || selectedFacility.toUpperCase() === 'ALL' ? 'all' : selectedFacility
  )

  // Live reports from BE
  const [revenueData, setRevenueData] = useState<RevenueReport | null>(null)
  const [occupancyData, setOccupancyData] = useState<OccupancyReport | null>(null)
  const [debtData, setDebtData] = useState<OverdueDebtReport | null>(null)
  const [contracts, setContracts] = useState<RentalContract[] | null>(null)
  const [isReportsLoading, setIsReportsLoading] = useState(true)
  const [reportsHaveError, setReportsHaveError] = useState(false)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date>(new Date())

  // Preset Periods State - Default to 'THIS_MONTH'
  const getInitialMonthRange = () => {
    const now = new Date()
    const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    return { start, today }
  }

  const [activePreset, setActivePreset] = useState<'TODAY' | 'LAST_7_DAYS' | 'THIS_MONTH' | 'LAST_MONTH' | 'THIS_QUARTER' | 'THIS_YEAR' | 'CUSTOM'>('THIS_MONTH')
  const [fromDate, setFromDate] = useState<string>(() => getInitialMonthRange().start)
  const [toDate, setToDate] = useState<string>(() => getInitialMonthRange().today)
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false)
  const [tempFromDate, setTempFromDate] = useState<string>(() => getInitialMonthRange().start)
  const [tempToDate, setTempToDate] = useState<string>(() => getInitialMonthRange().today)

  // Facility Sorting State
  const [facilitySort, setFacilitySort] = useState<'revenue' | 'cashIn' | 'occupancy' | 'debt'>('revenue')

  // Payment Channel Metric Toggle: COUNT | AMOUNT | RECONCILED
  const [channelMetric, setChannelMetric] = useState<'COUNT' | 'AMOUNT' | 'RECONCILED'>('COUNT')

  // Financial Transactions Table State
  const [payments, setPayments] = useState<PaymentItem[]>([])
  const [isPaymentsLoading, setIsPaymentsLoading] = useState(false)
  const [paymentsPage, setPaymentsPage] = useState(0)
  const [paymentsPageSize, setPaymentsPageSize] = useState(10)
  const [paymentsTotalElements, setPaymentsTotalElements] = useState(0)
  const [paymentsTotalPages, setPaymentsTotalPages] = useState(0)

  // Table Filters
  const [tableSearch, setTableSearch] = useState('')
  const [tableFinancialCategory, setTableFinancialCategory] = useState<string>('ALL')
  const [tablePaymentType, setTablePaymentType] = useState<string>('ALL')
  const [tablePaymentMethod, setTablePaymentMethod] = useState<string>('ALL')
  const [tablePaymentStatus, setTablePaymentStatus] = useState<string>('PAID')
  const [tableReconStatus, setTableReconStatus] = useState<string>('ALL')

  // Detail Modal
  const [selectedPaymentDetail, setSelectedPaymentDetail] = useState<PaymentItem | null>(null)

  // Notification Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [toastIsError, setToastIsError] = useState(false)

  const showToast = (msg: string, isError = false) => {
    setToastMessage(msg)
    setToastIsError(isError)
    setTimeout(() => setToastMessage(null), 3500)
  }

  useEffect(() => {
    if (contextFacilities && contextFacilities.length > 0) {
      setFacilities(contextFacilities)
    }
  }, [contextFacilities])

  useEffect(() => {
    const nextScope = (!selectedFacility || selectedFacility.toUpperCase() === 'ALL') ? 'all' : selectedFacility
    setSelectedFacilityId(nextScope)
  }, [selectedFacility])

  // Load Main Reports
  const loadDashboardData = async (fDate = fromDate, tDate = toDate, targetScope?: string) => {
    const requestSequence = ++dashboardRequestSequence.current
    setIsReportsLoading(true)
    setReportsHaveError(false)
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
      } else {
        setContracts(null)
      }

      setLastUpdatedAt(new Date())
      setReportsHaveError([facRes, revRes, occRes, debtRes].some((r) => r.status === 'rejected'))
    } catch {
      if (requestSequence === dashboardRequestSequence.current) {
        setReportsHaveError(true)
      }
    } finally {
      if (requestSequence === dashboardRequestSequence.current) {
        setIsReportsLoading(false)
      }
    }
  }

  // Load Financial Payments Table
  const loadPaymentsTable = async (fDate = fromDate, tDate = toDate, targetScope = selectedFacilityId, page = paymentsPage, size = paymentsPageSize) => {
    setIsPaymentsLoading(true)
    try {
      const queryFrom = fDate ? `${fDate}T00:00:00` : undefined
      const queryTo = tDate ? `${tDate}T23:59:59` : undefined
      const targetFacilityId = targetScope === 'all' ? undefined : targetScope
      const statusParam = tablePaymentStatus !== 'ALL' ? tablePaymentStatus : undefined
      const typeParam = tablePaymentType !== 'ALL' ? tablePaymentType : undefined

      const pageRes = await paymentService.getPaymentsPage({
        facilityId: targetFacilityId,
        status: statusParam,
        paymentType: typeParam,
        fromDate: queryFrom,
        toDate: queryTo,
        page,
        size,
      })

      if (pageRes) {
        setPayments(pageRes.content || [])
        setPaymentsTotalPages(pageRes.totalPages || 0)
        setPaymentsTotalElements(pageRes.totalElements || 0)
      }
    } catch (err) {
      console.error('Failed to load payments table', err)
      setPayments([])
    } finally {
      setIsPaymentsLoading(false)
    }
  }

  // Initial & Filter Triggers
  useEffect(() => {
    void loadDashboardData(fromDate, toDate, selectedFacilityId)
  }, [selectedFacilityId, fromDate, toDate])

  useEffect(() => {
    void loadPaymentsTable(fromDate, toDate, selectedFacilityId, paymentsPage, paymentsPageSize)
  }, [selectedFacilityId, fromDate, toDate, paymentsPage, paymentsPageSize, tablePaymentStatus, tablePaymentType])

  // Preset Handlers
  const applyPreset = (presetKey: 'TODAY' | 'LAST_7_DAYS' | 'THIS_MONTH' | 'LAST_MONTH' | 'THIS_QUARTER' | 'THIS_YEAR') => {
    const now = new Date()
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    let nextFrom = ''
    let nextTo = todayStr

    if (presetKey === 'TODAY') {
      nextFrom = todayStr
      nextTo = todayStr
    } else if (presetKey === 'LAST_7_DAYS') {
      const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      nextFrom = `${d7.getFullYear()}-${String(d7.getMonth() + 1).padStart(2, '0')}-${String(d7.getDate()).padStart(2, '0')}`
      nextTo = todayStr
    } else if (presetKey === 'THIS_MONTH') {
      nextFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
      nextTo = todayStr
    } else if (presetKey === 'LAST_MONTH') {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0)
      nextFrom = `${firstDay.getFullYear()}-${String(firstDay.getMonth() + 1).padStart(2, '0')}-01`
      nextTo = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`
    } else if (presetKey === 'THIS_QUARTER') {
      const currentQuarter = Math.floor(now.getMonth() / 3)
      const quarterStartMonth = currentQuarter * 3 + 1
      nextFrom = `${now.getFullYear()}-${String(quarterStartMonth).padStart(2, '0')}-01`
      nextTo = todayStr
    } else if (presetKey === 'THIS_YEAR') {
      nextFrom = `${now.getFullYear()}-01-01`
      nextTo = todayStr
    }

    setActivePreset(presetKey)
    setFromDate(nextFrom)
    setToDate(nextTo)
    setTempFromDate(nextFrom)
    setTempToDate(nextTo)
    setIsDatePickerOpen(false)
  }

  // Label for active period
  const periodLabel = !fromDate && !toDate
    ? tr('Toàn bộ thời gian', 'All time')
    : fromDate && toDate
      ? `${formatReportDate(fromDate)} – ${formatReportDate(toDate)}`
      : fromDate
        ? `${tr('Từ', 'From')} ${formatReportDate(fromDate)}`
        : `${tr('Đến', 'To')} ${formatReportDate(toDate)}`

  // KPI Metrics Calculation
  const summary = revenueData?.systemSummary
  const netRevenue = summary?.netRevenue ?? 0
  const totalCashIn = summary?.totalCashIn ?? 0
  const rentalRevenue = summary?.rentalRevenue ?? 0
  const totalOverdueDebt = summary?.totalOverdueDebt ?? debtData?.totalDebtAmount ?? 0
  const depositsHeld = summary?.depositsHeld ?? 0
  const refundedAmount = summary?.refundedAmount ?? 0
  const pendingRefundAmount = summary?.pendingRefundAmount ?? 0
  const pendingReconCount = summary?.pendingReconciliationCount ?? 0
  const paymentCount = summary?.paymentCount ?? 0

  // Chart 1: Monthly Recognized Net Revenue Series (EXCLUDING deposits and booking holds)
  const monthlyRevenueData = useMemo(() => {
    return (revenueData?.monthlyRevenue ?? []).map((item) => {
      const rental = item.rentalFeeRevenue || 0
      const renewal = item.renewalFeeRevenue || 0
      const extra = item.extraChargeRevenue || 0
      const netMonthRevenue = rental + renewal + extra
      return {
        monthKey: item.month ?? 'unknown',
        label: item.month ? `T${item.month.slice(5)}/${item.month.slice(2, 4)}` : tr('Chưa rõ', 'N/A'),
        rental,
        renewal,
        extra,
        netMonthRevenue,
        paymentCount: item.paymentCount,
      }
    })
  }, [revenueData, language])

  const maxMonthlyNet = useMemo(() => {
    if (monthlyRevenueData.length === 0) return 1
    return Math.max(...monthlyRevenueData.map((m) => m.netMonthRevenue), 1)
  }, [monthlyRevenueData])

  // Chart 2: Cash-in Breakdown (Cơ cấu tiền thực thu)
  const cashInBreakdown = useMemo(() => {
    const rentalFee = summary?.rentalFeeRevenue ?? 0
    const deposit = summary?.depositRevenue ?? 0
    const renewalFee = summary?.renewalFeeRevenue ?? 0
    const extraCharge = summary?.extraChargeRevenue ?? 0
    const bookingPayment = summary?.bookingPaymentRevenue ?? 0
    const sum = totalCashIn || (rentalFee + deposit + renewalFee + extraCharge + bookingPayment) || 1

    return [
      { id: 'RENTAL', label: tr('Tiền thuê kho đã thu', 'Collected rental fees'), amount: rentalFee, color: '#0f172a', bgClass: 'bg-slate-900', pct: Math.round((rentalFee / sum) * 1000) / 10 },
      { id: 'DEPOSIT', label: tr('Tiền cọc nhận vào', 'Incoming deposits'), amount: deposit, color: '#06b6d4', bgClass: 'bg-cyan-500', pct: Math.round((deposit / sum) * 1000) / 10 },
      { id: 'BOOKING', label: tr('Tiền đặt kho giữ chỗ', 'Booking reserve fees'), amount: bookingPayment, color: '#9333ea', bgClass: 'bg-purple-600', pct: Math.round((bookingPayment / sum) * 1000) / 10 },
      { id: 'RENEWAL', label: tr('Phí gia hạn / Tái ký', 'Renewal fees'), amount: renewalFee, color: '#059669', bgClass: 'bg-emerald-600', pct: Math.round((renewalFee / sum) * 1000) / 10 },
      { id: 'EXTRA', label: tr('Phụ phí & Dịch vụ', 'Extra charges & services'), amount: extraCharge, color: '#f59e0b', bgClass: 'bg-amber-500', pct: Math.round((extraCharge / sum) * 1000) / 10 },
    ].filter((item) => item.amount > 0 || totalCashIn === 0)
  }, [summary, totalCashIn, language])

  // Chart 3: Refund & Checkout Settlement Breakdown
  const refundBreakdown = revenueData?.refundBreakdown ?? {
    completedRefundAmount: refundedAmount,
    completedRefundCount: 0,
    pendingReviewAmount: 0,
    pendingReviewCount: 0,
    processingTransferAmount: pendingRefundAmount,
    processingTransferCount: 0,
    rejectedRefundAmount: 0,
    rejectedRefundCount: 0,
    totalRequestedAmount: refundedAmount + pendingRefundAmount,
    totalRefundRequests: 0,
  }

  // Chart 4: Overdue Debt by Stages
  const debtBreakdown = revenueData?.debtBreakdown ?? {
    gracePeriodAmount: 0,
    gracePeriodCount: 0,
    warningAmount: 0,
    warningCount: 0,
    accessBlockedAmount: totalOverdueDebt,
    accessBlockedCount: debtData?.accessBlockedCount ?? 0,
    eligibleForSealingAmount: 0,
    eligibleForSealingCount: 0,
    totalDebt: totalOverdueDebt,
    totalCount: debtData?.totalOverdueCount ?? 0,
  }

  // Chart 5: Multi-Facility Performance Rows
  const facilityRows = useMemo(() => {
    const list = [...(facilities || [])]
    return list.map((fac) => {
      const facRev = revenueData?.byFacility?.find((f) => f.facilityId === fac.id)
      const facOcc = occupancyData?.byFacility?.find((o) => o.facilityId === fac.id)
      return {
        id: fac.id,
        code: fac.code,
        name: fac.name.replace(/StoreHub\s*/gi, 'Boxora '),
        address: fac.address ? `${fac.address}${fac.city ? `, ${fac.city}` : ''}` : '—',
        phone: fac.contactPhone,
        netRevenue: facRev?.netRevenue ?? facRev?.totalRevenue ?? 0,
        totalCashIn: facRev?.totalCashIn ?? 0,
        rentalRevenue: facRev?.rentalRevenue ?? facRev?.rentalFeeRevenue ?? 0,
        depositsHeld: facRev?.depositsHeld ?? facRev?.depositRevenue ?? 0,
        totalOverdueDebt: facRev?.totalOverdueDebt ?? 0,
        paymentCount: facRev?.paymentCount ?? 0,
        occupancyRate: facOcc?.occupancyRate ?? 0,
        totalUnits: facOcc?.totalUnits ?? 0,
        occupiedUnits: facOcc?.occupiedUnits ?? 0,
        availableUnits: facOcc?.availableUnits ?? 0,
      }
    }).sort((a, b) => {
      if (facilitySort === 'occupancy') return b.occupancyRate - a.occupancyRate
      if (facilitySort === 'cashIn') return b.totalCashIn - a.totalCashIn
      if (facilitySort === 'debt') return b.totalOverdueDebt - a.totalOverdueDebt
      return b.netRevenue - a.netRevenue
    })
  }, [facilities, revenueData, occupancyData, facilitySort])

  // Chart 6: Payment Methods Stats
  const paymentMethodStats = useMemo(() => {
    const list = revenueData?.paymentsByMethod ?? []
    const vnpay = list.find((m) => m.paymentMethod?.toUpperCase() === 'VNPAY')
    const bank = list.find((m) => m.paymentMethod?.toUpperCase() === 'BANK_TRANSFER')
    const other = list.filter((m) => !['VNPAY', 'BANK_TRANSFER'].includes(m.paymentMethod?.toUpperCase() ?? ''))

    const vnpayCount = vnpay?.paymentCount ?? 0
    const vnpayAmount = vnpay?.totalAmount ?? 0
    const vnpayReconciled = vnpay?.reconciledAmount ?? vnpayAmount

    const bankCount = bank?.paymentCount ?? 0
    const bankAmount = bank?.totalAmount ?? 0
    const bankReconciled = bank?.reconciledAmount ?? bankAmount

    const otherCount = other.reduce((acc, curr) => acc + curr.paymentCount, 0)
    const otherAmount = other.reduce((acc, curr) => acc + (curr.totalAmount ?? 0), 0)
    const otherReconciled = other.reduce((acc, curr) => acc + (curr.reconciledAmount ?? 0), 0)

    const totalCount = vnpayCount + bankCount + otherCount || 1
    const totalAmount = vnpayAmount + bankAmount + otherAmount || 1
    const totalReconciled = vnpayReconciled + bankReconciled + otherReconciled || 1

    return {
      vnpay: { count: vnpayCount, amount: vnpayAmount, reconciled: vnpayReconciled },
      bank: { count: bankCount, amount: bankAmount, reconciled: bankReconciled },
      other: { count: otherCount, amount: otherAmount, reconciled: otherReconciled },
      totalCount,
      totalAmount,
      totalReconciled,
    }
  }, [revenueData])

  // Filtered Payments for Client Table
  const filteredPayments = useMemo(() => {
    return payments.filter((item) => {
      if (tableSearch.trim()) {
        const query = tableSearch.toLowerCase().trim()
        const matchCode = item.id.toLowerCase().includes(query) || (item.transactionId && item.transactionId.toLowerCase().includes(query)) || (item.receiptVoucherCode && item.receiptVoucherCode.toLowerCase().includes(query))
        const matchCustomer = item.customerName && item.customerName.toLowerCase().includes(query)
        const matchContract = (item.contractCode && item.contractCode.toLowerCase().includes(query)) || (item.bookingCode && item.bookingCode.toLowerCase().includes(query))
        if (!matchCode && !matchCustomer && !matchContract) return false
      }

      if (tableFinancialCategory !== 'ALL') {
        const cat = getFinancialCategory(item.paymentType)
        if (cat.id !== tableFinancialCategory) return false
      }

      if (tablePaymentMethod !== 'ALL') {
        if ((item.paymentMethod || '').toUpperCase() !== tablePaymentMethod) return false
      }

      if (tableReconStatus !== 'ALL') {
        const itemRecon = item.reconciliationStatus || 'UNRECONCILED'
        if (tableReconStatus === 'RECONCILED' && !['RECONCILED', 'AUTO_RECONCILED'].includes(itemRecon)) return false
        if (tableReconStatus === 'PENDING' && itemRecon !== 'PENDING_RECONCILIATION') return false
        if (tableReconStatus === 'UNRECONCILED' && itemRecon !== 'UNRECONCILED') return false
      }

      return true
    })
  }, [payments, tableSearch, tableFinancialCategory, tablePaymentMethod, tableReconStatus])

  // CSV Export Handlers
  const handleExportSystemCsv = async () => {
    try {
      const blob = await reportService.exportRevenueCsv(fromDate, toDate, selectedFacilityId)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `boxora-bao-cao-doanh-thu-${new Date().toISOString().slice(0, 10)}.csv`
      link.click()
      URL.revokeObjectURL(url)
      showToast(tr('Đã tải xuống file CSV báo cáo tài chính Boxora.', 'Boxora financial report CSV downloaded.'))
    } catch (err) {
      console.warn('Server CSV export failed, falling back to local dataset export:', err)
      // Fallback: Generate CSV directly from loaded revenueData
      if (revenueData) {
        const summary = revenueData.systemSummary
        const facilitiesList = revenueData.byFacility || []
        const dateRangeStr = `${fromDate || 'Toàn bộ'} - ${toDate || 'Hiện tại'}`
        const lines: string[] = []
        lines.push('BÁO CÁO DOANH THU & TÀI CHÍNH BOXORA')
        lines.push(`Kỳ báo cáo,${dateRangeStr}`)
        lines.push('')
        lines.push('TỔNG QUAN KPI (VND)')
        if (summary) {
          lines.push(`Tổng doanh thu thuần,${summary.netRevenue || 0}`)
          lines.push(`Tổng tiền thực thu,${summary.totalCashIn || 0}`)
          lines.push(`Doanh thu tiền thuê,${summary.rentalRevenue || 0}`)
          lines.push(`Công nợ phải thu,${summary.totalOverdueDebt || 0}`)
          lines.push(`Tiền cọc đang giữ,${summary.depositsHeld || 0}`)
          lines.push(`Tiền hoàn thành công,${summary.refundedAmount || 0}`)
          lines.push(`Tiền hoàn chờ xử lý,${summary.pendingRefundAmount || 0}`)
        }
        lines.push('')
        lines.push('CHI TIẾT THEO CƠ SỞ')
        lines.push('Cơ sở,Doanh thu thuần,Tiền thực thu,Doanh thu thuê,Tiền cọc giữ,Công nợ quá hạn,Tiền hoàn,Số giao dịch')
        facilitiesList.forEach((f) => {
          const name = (f.facilityName || '').replace(/"/g, '""')
          lines.push(`"${name}",${f.netRevenue || 0},${f.totalCashIn || 0},${f.rentalRevenue || 0},${f.depositsHeld || 0},${f.totalOverdueDebt || 0},${f.refundedAmount || 0},${f.paymentCount || 0}`)
        })

        const csvContent = '﻿' + lines.join('\r\n')
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `boxora-bao-cao-doanh-thu-${new Date().toISOString().slice(0, 10)}.csv`
        link.click()
        URL.revokeObjectURL(url)
        showToast(tr('Đã tải xuống file CSV báo cáo tài chính Boxora.', 'Boxora financial report CSV downloaded.'))
        return
      }

      showToast(tr('Lỗi xuất file CSV từ máy chủ.', 'Failed to export CSV from server.'), true)
    }
  }

  const handleExportTableCsv = () => {
    if (filteredPayments.length === 0) {
      showToast(tr('Không có dữ liệu giao dịch để xuất.', 'No transaction records to export.'), true)
      return
    }

    const headers = [
      'Mã giao dịch',
      'Thời gian',
      'Khách hàng',
      'Mã hợp đồng / Booking',
      'Cơ sở',
      'Loại nghiệp vụ',
      'Nhóm tài chính',
      'Số tiền (VND)',
      'Kênh thanh toán',
      'Trạng thái TT',
      'Trạng thái đối soát',
      'Người duyệt / xử lý',
      'Mã phiếu thu'
    ]

    const rows = filteredPayments.map((p) => {
      const finCat = getFinancialCategory(p.paymentType)
      const typeBadge = getPaymentTypeBadge(p.paymentType)
      return [
        p.transactionId || p.receiptVoucherCode || p.id,
        p.paymentTime || p.createdAt || '',
        p.customerName || 'N/A',
        p.contractCode || p.bookingCode || '—',
        p.facilityName || '—',
        language === 'vi' ? typeBadge.labelVi : typeBadge.labelEn,
        language === 'vi' ? finCat.labelVi : finCat.labelEn,
        p.amount || 0,
        p.paymentMethod || '—',
        p.status || '—',
        p.reconciliationStatus || 'UNRECONCILED',
        p.confirmedByName || p.collectedByName || 'Hệ thống',
        p.receiptVoucherCode || '—'
      ]
    })

    const csvContent = '\uFEFF' + [headers, ...rows].map((row) =>
      row.map((val) => {
        const cell = String(val ?? '')
        const safe = /^[=+@-]/.test(cell) ? `'${cell}` : cell
        return `"${safe.replaceAll('"', '""')}"`
      }).join(',')
    ).join('\r\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `boxora-chi-tiet-giao-dich-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
    showToast(tr('Đã tải bảng chi tiết giao dịch CSV.', 'Transaction table CSV downloaded.'))
  }

  return (
    <>
      <style>{`@media print {
        @page { size: landscape; margin: 12mm; }
        body * { visibility: hidden !important; }
        #revenue-report-root, #revenue-report-root * { visibility: visible !important; }
        #revenue-report-root { position: absolute; left: 0; top: 0; width: 100%; background: white; }
        #revenue-report-root .print\\:hidden { display: none !important; }
      }`}</style>

      <div id="revenue-report-root" className="flex flex-col gap-6 w-full pb-12">
        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed top-24 right-8 z-50 flex items-center gap-2.5 px-4 py-3 bg-slate-900 text-white rounded-xl shadow-2xl border border-slate-700 animate-in fade-in duration-200">
            <span className={`material-symbols-outlined text-[20px] ${toastIsError ? 'text-rose-400' : 'text-emerald-400'}`}>
              {toastIsError ? 'error' : 'check_circle'}
            </span>
            <span className="text-xs font-semibold">{toastMessage}</span>
          </div>
        )}

        {/* 1. HEADER & FILTER BAR */}
        <div className="relative w-full rounded-2xl bg-white p-6 shadow-sm border border-slate-200 z-20">
          <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4 print:hidden">
            <div className="flex flex-col gap-1.5 text-left">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-xs text-slate-500 font-medium">
                  {tr('Cập nhật lúc:', 'Updated at:')} <strong className="font-mono text-slate-700">{lastUpdatedAt.toLocaleTimeString(currencyLocale)} {lastUpdatedAt.toLocaleDateString(currencyLocale)}</strong>
                </span>
              </div>
              <h1 className="text-2xl lg:text-3xl font-extrabold font-headline text-slate-900 tracking-tight">
                {tr('Báo cáo doanh thu', 'Revenue Report')}
              </h1>
              <p className="text-xs sm:text-sm text-slate-600">
                {tr('Theo dõi doanh thu, dòng tiền và hiệu quả kinh doanh của Boxora', 'Monitor revenue, cash flow, and business performance across Boxora facilities')}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              {/* Facility Selector */}
              <div className="flex items-center bg-slate-50 hover:bg-slate-100 px-3 py-2 rounded-xl border border-slate-200 hover:border-slate-300 transition-all shadow-xs group">
                <span className="material-symbols-outlined text-blue-600 text-[20px] mr-2">location_on</span>
                <div className="flex flex-col text-left">
                  <span className="text-[10px] text-slate-500 uppercase font-bold leading-none mb-0.5">
                    {tr('Cơ sở', 'Facility')}
                  </span>
                  <select
                    value={selectedFacilityId}
                    onChange={(e) => {
                      const next = e.target.value
                      setSelectedFacilityId(next)
                      if (setSelectedFacility) {
                        setSelectedFacility(next === 'all' ? 'ALL' : next)
                      }
                    }}
                    className="bg-transparent font-sans text-xs text-slate-900 font-bold focus:outline-none cursor-pointer pr-1"
                  >
                    <option value="all">{tr('Toàn hệ thống (Tất cả cơ sở)', 'All facilities (System-wide)')}</option>
                    {facilities.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name.replace(/StoreHub\s*/gi, 'Boxora ')} ({f.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Period Dropdown & Quick Presets */}
              <div className="relative z-30">
                <button
                  type="button"
                  onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                  className={`flex items-center text-left px-3.5 py-2 rounded-xl border transition-all cursor-pointer group ${
                    isDatePickerOpen
                      ? 'bg-blue-50/80 border-blue-400 shadow-md ring-2 ring-blue-400/20'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                  }`}
                >
                  <span className="material-symbols-outlined text-blue-600 text-[20px] mr-2">calendar_month</span>
                  <div className="flex flex-col pr-1">
                    <span className="text-[10px] text-slate-500 uppercase font-bold leading-none mb-0.5">
                      {tr('Kỳ báo cáo', 'Reporting Period')}
                    </span>
                    <span className="font-mono text-xs text-slate-900 font-bold group-hover:text-blue-700">
                      {periodLabel}
                    </span>
                  </div>
                </button>

                {/* Popover */}
                {isDatePickerOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsDatePickerOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 z-50 w-88 max-w-[92vw] bg-white rounded-2xl border border-slate-200 shadow-2xl p-4 animate-in fade-in zoom-in-95 duration-150">
                      <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
                        <div className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-blue-600 text-[18px]">tune</span>
                          <h4 className="text-xs font-bold text-slate-900">{tr('Chọn kỳ báo cáo', 'Select Reporting Period')}</h4>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsDatePickerOpen(false)}
                          className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[18px]">close</span>
                        </button>
                      </div>

                      {/* Presets Grid */}
                      <div className="mb-4">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                          {tr('Chọn nhanh theo chu kỳ', 'Quick Presets')}
                        </span>
                        <div className="grid grid-cols-3 gap-1.5">
                          {[
                            { key: 'TODAY', label: tr('Hôm nay', 'Today') },
                            { key: 'LAST_7_DAYS', label: tr('7 ngày qua', 'Last 7 days') },
                            { key: 'THIS_MONTH', label: tr('Tháng này', 'This month') },
                            { key: 'LAST_MONTH', label: tr('Tháng trước', 'Last month') },
                            { key: 'THIS_QUARTER', label: tr('Quý này', 'This quarter') },
                            { key: 'THIS_YEAR', label: tr('Năm nay', 'This year') },
                          ].map((item) => (
                            <button
                              key={item.key}
                              type="button"
                              onClick={() => applyPreset(item.key as any)}
                              className={`px-2 py-2 rounded-lg text-xs font-semibold border cursor-pointer text-center transition-all ${
                                activePreset === item.key
                                  ? 'bg-blue-600 text-white border-blue-600 font-bold shadow-xs'
                                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Custom Range */}
                      <div className="space-y-2 mb-4 pt-3 border-t border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          {tr('Hoặc tùy chỉnh khoảng ngày', 'Or custom date range')}
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-bold text-slate-600 block mb-1">{tr('Từ ngày:', 'From date:')}</label>
                            <input
                              type="date"
                              value={tempFromDate}
                              onChange={(e) => setTempFromDate(e.target.value)}
                              className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-xs text-slate-900"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-600 block mb-1">{tr('Đến ngày:', 'To date:')}</label>
                            <input
                              type="date"
                              value={tempToDate}
                              onChange={(e) => setTempToDate(e.target.value)}
                              className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-xs text-slate-900"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Apply Custom Button */}
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => {
                            if (tempFromDate && tempToDate && tempFromDate > tempToDate) {
                              showToast(tr('Ngày bắt đầu không được lớn hơn ngày kết thúc', 'Start date cannot exceed end date'), true)
                              return
                            }
                            setActivePreset('CUSTOM')
                            setFromDate(tempFromDate)
                            setToDate(tempToDate)
                            setIsDatePickerOpen(false)
                          }}
                          className="w-full py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <span className="material-symbols-outlined text-[16px]">check_circle</span>
                          <span>{tr('Áp dụng khoảng ngày này', 'Apply custom dates')}</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* CSV & PDF Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportSystemCsv}
                  title={tr('Tải file CSV tổng quan tài chính Boxora', 'Download financial overview CSV')}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition-all border border-slate-200 shadow-xs cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px] text-emerald-600">table_chart</span>
                  {tr('Xuất CSV', 'Export CSV')}
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  title={tr('In hoặc lưu báo cáo PDF', 'Print or save report as PDF')}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px] text-cyan-400">picture_as_pdf</span>
                  {tr('In / Xuất PDF', 'Print / PDF')}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 2. THE 6 EXECUTIVE FINANCIAL KPI CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {/* KPI 1: Tổng doanh thu thuần */}
          <div className="relative rounded-2xl bg-white p-5 shadow-sm border border-slate-200 flex flex-col justify-between hover:border-slate-300 transition-all">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{tr('1. Doanh thu thuần', '1. Net Revenue')}</span>
              <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100" title={tr('Doanh thu tiền thuê + gia hạn + phụ phí đã trừ hoàn tiền hợp lệ trong kỳ. Không bao gồm tiền cọc & giữ chỗ.', 'Net recognized revenue: Rental + Renewal + Extra minus completed refunds. Excludes deposits & holds.')}>
                <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
              </div>
            </div>
            <div className="my-3">
              <div className="text-xl xl:text-2xl font-black font-mono text-slate-900 tracking-tight">
                {formatVnd(netRevenue)}
              </div>
              <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                {tr('Đã trừ hoàn tiền hợp lệ; không tính cọc & giữ chỗ', 'Deducted valid refunds; excludes deposits')}
              </p>
            </div>
            <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-emerald-700 font-semibold">
              <span>{tr('Ghi nhận kỳ:', 'Period status:')}</span>
              <span className="font-mono bg-emerald-50 px-2 py-0.5 rounded text-emerald-800 border border-emerald-200">
                {summary?.rentalRevenue ? `${Math.round(((summary.rentalRevenue) / Math.max(netRevenue, 1)) * 100)}% thuê kho` : '100%'}
              </span>
            </div>
          </div>

          {/* KPI 2: Tổng tiền thực thu */}
          <div className="relative rounded-2xl bg-white p-5 shadow-sm border border-slate-200 flex flex-col justify-between hover:border-slate-300 transition-all">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{tr('2. Tiền thực thu', '2. Total Cash-In')}</span>
              <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100" title={tr('Tổng tiền thực nhận từ các giao dịch PAID đã xác minh trong kỳ.', 'Total cash received across verified PAID payments.')}>
                <span className="material-symbols-outlined text-[20px]">payments</span>
              </div>
            </div>
            <div className="my-3">
              <div className="text-xl xl:text-2xl font-black font-mono text-blue-700 tracking-tight">
                {formatVnd(totalCashIn)}
              </div>
              <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                {tr('Dòng tiền vào thực tế từ tất cả nguồn thu', 'Actual cash inflows across all income streams')}
              </p>
            </div>
            <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600 font-medium">
              <span>{tr('Số giao dịch:', 'Payments:')}</span>
              <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                {paymentCount.toLocaleString(currencyLocale)} GD
              </span>
            </div>
          </div>

          {/* KPI 3: Doanh thu tiền thuê kho */}
          <div className="relative rounded-2xl bg-white p-5 shadow-sm border border-slate-200 flex flex-col justify-between hover:border-slate-300 transition-all">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{tr('3. Tiền thuê kho', '3. Rental Revenue')}</span>
              <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100" title={tr('Doanh thu từ hoạt động cốt lõi: tiền thuê kho và phí gia hạn trong kỳ.', 'Core revenue from unit rentals and contract renewals.')}>
                <span className="material-symbols-outlined text-[20px]">warehouse</span>
              </div>
            </div>
            <div className="my-3">
              <div className="text-xl xl:text-2xl font-black font-mono text-slate-900 tracking-tight">
                {formatVnd(rentalRevenue)}
              </div>
              <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                {tr('Doanh thu cho thuê kho & tái ký trong kỳ', 'Storage rental fees & renewed contract cycles')}
              </p>
            </div>
            <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600 font-medium">
              <span>{tr('Tái ký:', 'Renewals:')}</span>
              <span className="font-mono font-bold text-emerald-600">
                {formatVnd(summary?.renewalFeeRevenue ?? 0)}
              </span>
            </div>
          </div>

          {/* KPI 4: Công nợ phải thu */}
          <div className="relative rounded-2xl bg-white p-5 shadow-sm border border-slate-200 flex flex-col justify-between hover:border-slate-300 transition-all">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{tr('4. Công nợ phải thu', '4. Overdue Debt')}</span>
              <div className="h-8 w-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100" title={tr('Khoản tiền thuê quá hạn khách còn phải thanh toán, chia theo 4 cấp độ.', 'Customer overdue debts tracked across 4 stages.')}>
                <span className="material-symbols-outlined text-[20px]">gavel</span>
              </div>
            </div>
            <div className="my-3">
              <div className="text-xl xl:text-2xl font-black font-mono text-rose-600 tracking-tight">
                {formatVnd(totalOverdueDebt)}
              </div>
              <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                {tr('Nợ cước thuê kho quá hạn chưa thu hồi', 'Overdue storage rental fees pending collection')}
              </p>
            </div>
            <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-rose-700 font-semibold">
              <span>{tr('Khóa kho / Niêm phong:', 'Blocked / Sealing:')}</span>
              <span className="font-mono bg-rose-50 px-2 py-0.5 rounded text-rose-800 border border-rose-200">
                {debtBreakdown.accessBlockedCount + debtBreakdown.eligibleForSealingCount} {tr('kho', 'units')}
              </span>
            </div>
          </div>

          {/* KPI 5: Tiền cọc đang giữ */}
          <div className="relative rounded-2xl bg-white p-5 shadow-sm border border-slate-200 flex flex-col justify-between hover:border-slate-300 transition-all">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{tr('5. Tiền cọc đang giữ', '5. Deposits Held')}</span>
              <div className="h-8 w-8 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center border border-cyan-100" title={tr('Số dư tiền cọc quản lý an toàn theo hợp đồng đang thuê, chờ quyết toán khi trả kho.', 'Active deposit balance held safely for ongoing contracts.')}>
                <span className="material-symbols-outlined text-[20px]">lock</span>
              </div>
            </div>
            <div className="my-3">
              <div className="text-xl xl:text-2xl font-black font-mono text-cyan-700 tracking-tight">
                {formatVnd(depositsHeld)}
              </div>
              <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                {tr('Nghĩa vụ hoàn trả / quyết toán khi trả kho', 'Payable obligation awaiting checkout settlement')}
              </p>
            </div>
            <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-cyan-800 font-semibold">
              <span>{tr('Hợp đồng ACTIVE:', 'Active contracts:')}</span>
              <span className="font-mono bg-cyan-50 px-2 py-0.5 rounded text-cyan-800 border border-cyan-200">
                {contracts ? `${contracts.filter(c => c.status === 'ACTIVE').length} HĐ` : '—'}
              </span>
            </div>
          </div>

          {/* KPI 6: Hoàn tiền và giao dịch chờ xử lý */}
          <div className="relative rounded-2xl bg-white p-5 shadow-sm border border-slate-200 flex flex-col justify-between hover:border-slate-300 transition-all">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{tr('6. Hoàn tiền & Chờ XL', '6. Refunds & Pending')}</span>
              <div className="h-8 w-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100" title={tr('Số tiền đã hoàn thành công vs tiền hoàn đang chờ xử lý & giao dịch chờ đối soát.', 'Separation of completed refunds from pending review & unreconciled items.')}>
                <span className="material-symbols-outlined text-[20px]">assignment_return</span>
              </div>
            </div>
            <div className="my-3">
              <div className="text-xl xl:text-2xl font-black font-mono text-purple-700 tracking-tight">
                {formatVnd(refundedAmount)}
              </div>
              <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                {tr('Đã hoàn tiền thực tế thành công cho khách', 'Successfully refunded to customers')}
              </p>
            </div>
            <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-purple-800 font-semibold">
              <span>{tr('Chờ duyệt/chuyển:', 'Pending review:')}</span>
              <span className="font-mono bg-purple-50 px-1.5 py-0.5 rounded text-purple-800 border border-purple-200">
                {formatVnd(pendingRefundAmount)}
              </span>
            </div>
          </div>
        </div>

        {/* 3. CHARTS ROW 1: XU HƯỚNG DOANH THU & CƠ CẤU TIỀN THỰC THU */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Biểu đồ 1: Xu hướng doanh thu theo kỳ (8 cols) */}
          <div className="lg:col-span-8 bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-600 text-[22px]">bar_chart</span>
                  <h2 className="text-base font-bold text-slate-900">{tr('Biểu đồ 1: Xu hướng doanh thu theo kỳ', 'Chart 1: Revenue Trend by Period')}</h2>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {tr('Chỉ tính doanh thu thuần (thuê kho, gia hạn, phụ phí). Tuyệt đối không tính tiền cọc và tiền giữ chỗ.', 'Net recognized revenue only (Rental, Renewal, Extra). Excludes deposits and holds.')}
                </p>
              </div>

              {/* Legends */}
              <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-600">
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-slate-900"></span>{tr('Tiền thuê', 'Rental')}</span>
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-emerald-600"></span>{tr('Gia hạn', 'Renewal')}</span>
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-amber-500"></span>{tr('Phụ phí', 'Extra')}</span>
              </div>
            </div>

            {/* Bars container */}
            <div className="w-full h-64 flex items-end justify-between gap-3 pt-6 pb-2 px-2 border-b border-slate-200 overflow-x-auto">
              {monthlyRevenueData.length > 0 ? (
                monthlyRevenueData.map((m) => {
                  const heightPercent = Math.max(14, Math.min(100, Math.round((m.netMonthRevenue / maxMonthlyNet) * 100)))
                  const rentalPct = m.netMonthRevenue > 0 ? (m.rental / m.netMonthRevenue) * 100 : 0
                  const renewalPct = m.netMonthRevenue > 0 ? (m.renewal / m.netMonthRevenue) * 100 : 0
                  const extraPct = m.netMonthRevenue > 0 ? (m.extra / m.netMonthRevenue) * 100 : 0

                  return (
                    <div key={m.monthKey} className="flex-1 min-w-[56px] flex flex-col items-center gap-2 h-full justify-end group">
                      <div className="w-full flex flex-col items-center gap-0.5 transition-all duration-300 group-hover:scale-105" style={{ height: `${heightPercent}%` }}>
                        {extraPct > 0 && (
                          <div className="w-full max-w-[46px] bg-amber-500 rounded-t" style={{ height: `${extraPct}%` }} title={`${tr('Phụ phí', 'Extra')}: ${formatVnd(m.extra)}`} />
                        )}
                        {renewalPct > 0 && (
                          <div className={`w-full max-w-[46px] bg-emerald-600 ${extraPct === 0 ? 'rounded-t' : ''}`} style={{ height: `${renewalPct}%` }} title={`${tr('Gia hạn', 'Renewal')}: ${formatVnd(m.renewal)}`} />
                        )}
                        {rentalPct > 0 && (
                          <div className={`w-full max-w-[46px] bg-slate-900 rounded-b ${extraPct === 0 && renewalPct === 0 ? 'rounded-t' : ''}`} style={{ height: `${rentalPct}%` }} title={`${tr('Tiền thuê', 'Rental')}: ${formatVnd(m.rental)}`} />
                        )}
                      </div>
                      <span className="text-[11px] text-slate-700 font-bold">{m.label}</span>
                      <span className="font-mono text-[11px] text-slate-900 font-extrabold">
                        {m.netMonthRevenue >= 1_000_000 ? `${(m.netMonthRevenue / 1_000_000).toFixed(1)}M` : `${(m.netMonthRevenue / 1_000).toFixed(0)}k`}
                      </span>
                    </div>
                  )
                })
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                  {isReportsLoading ? tr('Đang tải dữ liệu biểu đồ...', 'Loading chart data...') : tr('Không có giao dịch doanh thu thuần trong kỳ đã chọn.', 'No net revenue data for this period.')}
                </div>
              )}
            </div>

            <div className="mt-4 p-3 bg-slate-50 rounded-xl flex flex-wrap items-center justify-between gap-2 border border-slate-200">
              <span className="text-xs text-slate-600 font-medium">
                {tr('Phân bổ doanh thu thuần theo ngày ghi nhận hóa đơn/thanh toán thực tế.', 'Breakdown of net revenue by actual invoice/payment dates.')}
              </span>
              <span className="text-xs font-mono font-bold text-slate-900">
                {tr('Tổng doanh thu thuần kỳ này:', 'Period Net Revenue:')} {formatVnd(netRevenue)}
              </span>
            </div>
          </div>

          {/* Biểu đồ 2: Cơ cấu tiền thực thu (Donut) (4 cols) */}
          <div className="lg:col-span-4 bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900">{tr('Biểu đồ 2: Cơ cấu tiền thực thu', 'Chart 2: Cash-In Structure')}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{tr('Phân loại các luồng tiền thực tế đã thu', 'Actual cash inflow categories')}</p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200">
                  DÒNG TIỀN VÀO
                </span>
              </div>

              {/* Donut Chart Display */}
              <div className="relative flex items-center justify-center my-6">
                <svg className="w-44 h-44 -rotate-90" viewBox="0 0 160 160">
                  <circle className="text-slate-100" cx="80" cy="80" fill="transparent" r="62" stroke="currentColor" strokeWidth="16"></circle>
                  {(() => {
                    let cumulativePct = 0
                    const circumference = 389.5 // 2 * PI * 62
                    return cashInBreakdown.map((item) => {
                      const strokeDash = (circumference * item.pct) / 100
                      const strokeOffset = -((circumference * cumulativePct) / 100)
                      cumulativePct += item.pct
                      return (
                        <circle
                          key={item.id}
                          cx="80"
                          cy="80"
                          fill="transparent"
                          r="62"
                          stroke={item.color}
                          strokeDasharray={`${strokeDash} ${circumference}`}
                          strokeDashoffset={strokeOffset}
                          strokeWidth="16"
                        />
                      )
                    })
                  })()}
                </svg>
                <div className="absolute flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{tr('Tổng thực thu', 'Total Cash-In')}</span>
                  <span className="text-lg font-black font-mono text-slate-900 mt-0.5">
                    {totalCashIn >= 1_000_000 ? `${(totalCashIn / 1_000_000).toFixed(1)}M ₫` : formatVnd(totalCashIn)}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500">{paymentCount} {tr('giao dịch', 'payments')}</span>
                </div>
              </div>
            </div>

            {/* List breakdown */}
            <div className="space-y-1.5 text-xs">
              {cashInBreakdown.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="flex items-center gap-2 font-medium text-slate-700">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }}></span>
                    {item.label}
                  </span>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="font-bold text-slate-900">{formatVnd(item.amount)}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 font-bold">{item.pct}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 4. CHARTS ROW 2: HOÀN TIỀN & CÔNG NỢ THEO TRẠNG THÁI */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Biểu đồ 3: Hoàn tiền và quyết toán trả kho (6 cols) */}
          <div className="lg:col-span-6 bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-purple-600 text-[22px]">assignment_return</span>
                    <h2 className="text-base font-bold text-slate-900">{tr('Biểu đồ 3: Hoàn tiền và quyết toán trả kho', 'Chart 3: Refunds & Settlements')}</h2>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {tr('Tách bạch số tiền đã hoàn thành công khỏi các khoản đang xử lý hoặc chờ duyệt.', 'Separating completed refunds from requests currently in progress or review.')}
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 text-[10px] font-bold border border-purple-200">
                  QUYẾT TOÁN
                </span>
              </div>

              {/* Progress bars for refund status */}
              <div className="space-y-4 my-4">
                {/* 1. Đã hoàn thành công */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-bold text-emerald-700 flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-600"></span>
                      {tr('Đã hoàn tiền thành công (Khách đã nhận)', 'Successfully refunded to customer')}
                    </span>
                    <span className="font-mono font-extrabold text-slate-900">{formatVnd(refundBreakdown.completedRefundAmount)}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${Math.min(100, refundBreakdown.totalRequestedAmount > 0 ? (refundBreakdown.completedRefundAmount / refundBreakdown.totalRequestedAmount) * 100 : 100)}%` }}></div>
                  </div>
                </div>

                {/* 2. Đang xử lý chuyển khoản */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-bold text-blue-700 flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-blue-600"></span>
                      {tr('Đang xử lý chuyển khoản ngân hàng', 'Processing bank transfer')}
                    </span>
                    <span className="font-mono font-extrabold text-slate-900">{formatVnd(refundBreakdown.processingTransferAmount)}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div className="bg-blue-600 h-full rounded-full" style={{ width: `${Math.min(100, refundBreakdown.totalRequestedAmount > 0 ? (refundBreakdown.processingTransferAmount / refundBreakdown.totalRequestedAmount) * 100 : 0)}%` }}></div>
                  </div>
                </div>

                {/* 3. Chờ xét duyệt */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-bold text-amber-700 flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-500"></span>
                      {tr('Đang chờ xét duyệt / đối soát', 'Pending manager review')}
                    </span>
                    <span className="font-mono font-extrabold text-slate-900">{formatVnd(refundBreakdown.pendingReviewAmount)}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div className="bg-amber-500 h-full rounded-full" style={{ width: `${Math.min(100, refundBreakdown.totalRequestedAmount > 0 ? (refundBreakdown.pendingReviewAmount / refundBreakdown.totalRequestedAmount) * 100 : 0)}%` }}></div>
                  </div>
                </div>

                {/* 4. Yêu cầu bị từ chối */}
                {refundBreakdown.rejectedRefundAmount > 0 && (
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-bold text-rose-700 flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-rose-500"></span>
                        {tr('Yêu cầu hoàn bị từ chối', 'Rejected refund requests')}
                      </span>
                      <span className="font-mono font-extrabold text-slate-900">{formatVnd(refundBreakdown.rejectedRefundAmount)}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                      <div className="bg-rose-500 h-full rounded-full" style={{ width: `${Math.min(100, refundBreakdown.totalRequestedAmount > 0 ? (refundBreakdown.rejectedRefundAmount / refundBreakdown.totalRequestedAmount) * 100 : 0)}%` }}></div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex items-center justify-between text-slate-700">
              <span>{tr('Số giao dịch đối soát cần duyệt:', 'Pending reconciliation items:')} <strong className="font-mono text-purple-700 font-bold">{pendingReconCount}</strong></span>
              <span className="font-mono font-bold">{tr('Tổng yêu cầu:', 'Total requested:')} {formatVnd(refundBreakdown.totalRequestedAmount)}</span>
            </div>
          </div>

          {/* Biểu đồ 4: Công nợ theo trạng thái (6 cols) */}
          <div className="lg:col-span-6 bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-rose-600 text-[22px]">gavel</span>
                    <h2 className="text-base font-bold text-slate-900">{tr('Biểu đồ 4: Công nợ theo trạng thái', 'Chart 4: Debt Aging by Stage')}</h2>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {tr('Phân loại công nợ theo 4 giai đoạn xử lý nợ cước thực tế của Boxora.', 'Debt distribution across Boxora 4 operational stages.')}
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 text-[10px] font-bold border border-rose-200">
                  RỦI RO THU HỒI
                </span>
              </div>

              {/* Horizontal Bars for 4 debt stages */}
              <div className="space-y-3.5 my-4">
                {[
                  {
                    stage: tr('1. Thời gian ân hạn (0 - 3 ngày)', '1. Grace Period (0 - 3 days)'),
                    amount: debtBreakdown.gracePeriodAmount,
                    count: debtBreakdown.gracePeriodCount,
                    color: 'bg-blue-500',
                    badge: 'bg-blue-50 text-blue-800 border-blue-200',
                  },
                  {
                    stage: tr('2. Cảnh báo nợ cước (3 - 7 ngày)', '2. Debt Warning (3 - 7 days)'),
                    amount: debtBreakdown.warningAmount,
                    count: debtBreakdown.warningCount,
                    color: 'bg-amber-500',
                    badge: 'bg-amber-50 text-amber-800 border-amber-200',
                  },
                  {
                    stage: tr('3. Tạm khóa mã PIN / SmartLock (7 - 30 ngày)', '3. PIN Suspended / Access Blocked (7 - 30 days)'),
                    amount: debtBreakdown.accessBlockedAmount,
                    count: debtBreakdown.accessBlockedCount,
                    color: 'bg-orange-600',
                    badge: 'bg-orange-50 text-orange-800 border-orange-200',
                  },
                  {
                    stage: tr('4. Đủ điều kiện niêm phong tài sản (> 30 ngày)', '4. Eligible for Unit Sealing (> 30 days)'),
                    amount: debtBreakdown.eligibleForSealingAmount,
                    count: debtBreakdown.eligibleForSealingCount,
                    color: 'bg-rose-600',
                    badge: 'bg-rose-50 text-rose-800 border-rose-200',
                  },
                ].map((item, idx) => {
                  const pct = totalOverdueDebt > 0 ? Math.min(100, Math.round((item.amount / totalOverdueDebt) * 100)) : 0
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                          <span className={`h-2.5 w-2.5 rounded-full ${item.color}`}></span>
                          {item.stage}
                        </span>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="font-bold text-slate-900">{formatVnd(item.amount)}</span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded border font-bold ${item.badge}`}>
                            {item.count} HĐ
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${item.color}`} style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex items-center justify-between text-slate-700">
              <span>{tr('Tổng số hợp đồng đang nợ:', 'Total overdue contracts:')} <strong className="font-mono text-rose-600 font-bold">{debtBreakdown.totalCount} HĐ</strong></span>
              <span className="font-mono font-bold text-rose-600">{tr('Tổng nợ:', 'Total Debt:')} {formatVnd(totalOverdueDebt)}</span>
            </div>
          </div>
        </div>

        {/* 5. CHARTS ROW 3: DOANH THU THEO CƠ SỞ & KÊNH THANH TOÁN */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Biểu đồ 5: Doanh thu theo cơ sở (8 cols) */}
          <div className="lg:col-span-8 bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-cyan-600 text-[22px]">apartment</span>
                  <h2 className="text-base font-bold text-slate-900">{tr('Biểu đồ 5: Doanh thu theo cơ sở', 'Chart 5: Revenue by Facility')}</h2>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {tr('So sánh doanh thu thuần, tiền thực thu, công nợ và tỷ lệ lấp đầy tại từng cơ sở', 'Compare net revenue, cash-in, debt, and occupancy across facilities')}
                </p>
              </div>

              {/* Sorting buttons */}
              <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200 text-xs">
                <span className="text-[10px] text-slate-400 font-bold uppercase px-2">{tr('Sắp xếp:', 'Sort:')}</span>
                <button
                  type="button"
                  onClick={() => setFacilitySort('revenue')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${facilitySort === 'revenue' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  {tr('Doanh thu thuần', 'Net Revenue')}
                </button>
                <button
                  type="button"
                  onClick={() => setFacilitySort('cashIn')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${facilitySort === 'cashIn' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  {tr('Tiền thực thu', 'Cash-in')}
                </button>
                <button
                  type="button"
                  onClick={() => setFacilitySort('occupancy')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${facilitySort === 'occupancy' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  {tr('Lấp đầy (%)', 'Occupancy')}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-mono uppercase border-y border-slate-200">
                    <th className="py-3 px-4 font-bold">{tr('Cơ sở', 'Facility')}</th>
                    <th className="py-3 px-3 text-right font-bold">{tr('Doanh thu thuần', 'Net Revenue')}</th>
                    <th className="py-3 px-3 text-right font-bold">{tr('Tiền thực thu', 'Total Cash-In')}</th>
                    <th className="py-3 px-3 text-right font-bold">{tr('Cọc đang giữ', 'Deposits Held')}</th>
                    <th className="py-3 px-3 text-right font-bold">{tr('Nợ quá hạn', 'Overdue Debt')}</th>
                    <th className="py-3 px-4 text-center font-bold">{tr('Tỷ lệ lấp đầy', 'Occupancy Rate')}</th>
                    <th className="py-3 px-3 text-center font-bold">{tr('Thao tác', 'Action')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {facilityRows.length > 0 ? (
                    facilityRows.map((f) => (
                      <tr key={f.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900">{f.name}</span>
                            <span className="text-[11px] text-slate-500 font-mono">{f.code} · {f.occupiedUnits}/{f.totalUnits} {tr('kho đang thuê', 'occupied')}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono font-extrabold text-slate-900">
                          {formatVnd(f.netRevenue)}
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono font-bold text-blue-700">
                          {formatVnd(f.totalCashIn)}
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono font-bold text-cyan-700">
                          {formatVnd(f.depositsHeld)}
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono font-bold text-rose-600">
                          {formatVnd(f.totalOverdueDebt)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className="font-mono font-bold text-slate-900">{f.occupancyRate.toFixed(1)}%</span>
                            <div className="w-20 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${f.occupancyRate >= 70 ? 'bg-emerald-600' : f.occupancyRate >= 30 ? 'bg-blue-600' : 'bg-amber-500'}`}
                                style={{ width: `${Math.min(100, f.occupancyRate)}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedFacilityId(f.id)
                              if (setSelectedFacility) setSelectedFacility(f.id)
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition-colors cursor-pointer"
                          >
                            {tr('Lọc cơ sở', 'Filter')}
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-slate-400">
                        {isReportsLoading ? tr('Đang tải danh sách cơ sở...', 'Loading facilities...') : tr('Không có dữ liệu cơ sở.', 'No facility data.')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Biểu đồ 6: Kênh thanh toán (4 cols) */}
          <div className="lg:col-span-4 bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h2 className="text-base font-bold text-slate-900">{tr('Biểu đồ 6: Kênh thanh toán', 'Chart 6: Payment Methods')}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{tr('So sánh các kênh thu tiền Boxora', 'Compare incoming payment channels')}</p>
                </div>
              </div>

              {/* 3-Mode Metric Toggle */}
              <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl mb-4 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setChannelMetric('COUNT')}
                  className={`py-1.5 rounded-lg transition-all cursor-pointer ${channelMetric === 'COUNT' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  {tr('Số GD', 'Count')}
                </button>
                <button
                  type="button"
                  onClick={() => setChannelMetric('AMOUNT')}
                  className={`py-1.5 rounded-lg transition-all cursor-pointer ${channelMetric === 'AMOUNT' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  {tr('Tổng giá trị', 'Value')}
                </button>
                <button
                  type="button"
                  onClick={() => setChannelMetric('RECONCILED')}
                  className={`py-1.5 rounded-lg transition-all cursor-pointer ${channelMetric === 'RECONCILED' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  {tr('Đã đối soát', 'Reconciled')}
                </button>
              </div>

              {/* Donut representation */}
              {(() => {
                const total = channelMetric === 'COUNT'
                  ? paymentMethodStats.totalCount
                  : channelMetric === 'AMOUNT'
                    ? paymentMethodStats.totalAmount
                    : paymentMethodStats.totalReconciled

                const vnpayVal = channelMetric === 'COUNT' ? paymentMethodStats.vnpay.count : channelMetric === 'AMOUNT' ? paymentMethodStats.vnpay.amount : paymentMethodStats.vnpay.reconciled
                const bankVal = channelMetric === 'COUNT' ? paymentMethodStats.bank.count : channelMetric === 'AMOUNT' ? paymentMethodStats.bank.amount : paymentMethodStats.bank.reconciled
                const otherVal = channelMetric === 'COUNT' ? paymentMethodStats.other.count : channelMetric === 'AMOUNT' ? paymentMethodStats.other.amount : paymentMethodStats.other.reconciled

                const vnpayPct = total > 0 ? Math.round((vnpayVal / total) * 1000) / 10 : 0
                const bankPct = total > 0 ? Math.round((bankVal / total) * 1000) / 10 : 0
                const circumference = 389.5

                return (
                  <div>
                    <div className="relative flex items-center justify-center my-4">
                      <svg className="w-40 h-40 -rotate-90" viewBox="0 0 160 160">
                        <circle className="text-slate-100" cx="80" cy="80" fill="transparent" r="62" stroke="currentColor" strokeWidth="15"></circle>
                        <circle
                          cx="80"
                          cy="80"
                          fill="transparent"
                          r="62"
                          stroke="#2563eb"
                          strokeDasharray={`${(circumference * vnpayPct) / 100} ${circumference}`}
                          strokeDashoffset={0}
                          strokeWidth="15"
                        />
                        <circle
                          cx="80"
                          cy="80"
                          fill="transparent"
                          r="62"
                          stroke="#0f172a"
                          strokeDasharray={`${(circumference * bankPct) / 100} ${circumference}`}
                          strokeDashoffset={-((circumference * vnpayPct) / 100)}
                          strokeWidth="15"
                        />
                      </svg>
                      <div className="absolute flex flex-col items-center justify-center text-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          {channelMetric === 'COUNT' ? tr('Tổng giao dịch', 'Total count') : tr('Tổng giá trị', 'Total value')}
                        </span>
                        <span className="text-base font-black font-mono text-slate-900 mt-0.5">
                          {channelMetric === 'COUNT' ? `${total} GD` : formatVnd(total)}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="flex items-center gap-2 font-semibold text-slate-800">
                          <span className="h-2.5 w-2.5 rounded-full bg-blue-600"></span>
                          {tr('Cổng VNPay (Trực tuyến)', 'VNPay Gateway (Online)')}
                        </span>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="font-bold text-slate-900">
                            {channelMetric === 'COUNT' ? `${vnpayVal} GD` : formatVnd(vnpayVal)}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 font-bold">{vnpayPct}%</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="flex items-center gap-2 font-semibold text-slate-800">
                          <span className="h-2.5 w-2.5 rounded-full bg-slate-900"></span>
                          {tr('Chuyển khoản (Tại quầy)', 'Bank Transfer (Counter)')}
                        </span>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="font-bold text-slate-900">
                            {channelMetric === 'COUNT' ? `${bankVal} GD` : formatVnd(bankVal)}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 text-slate-800 font-bold">{bankPct}%</span>
                        </div>
                      </div>

                      {otherVal > 0 && (
                        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200">
                          <span className="flex items-center gap-2 font-medium text-slate-500">
                            <span className="h-2.5 w-2.5 rounded-full bg-slate-400"></span>
                            {tr('Tiền mặt / Khác', 'Cash / Other')}
                          </span>
                          <span className="font-mono font-bold text-slate-700">
                            {channelMetric === 'COUNT' ? `${otherVal} GD` : formatVnd(otherVal)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>

        {/* 6. FINANCIAL TRANSACTIONS DETAILS TABLE (13 COLUMNS) */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-orange-600 text-[24px]">receipt_long</span>
                <h2 className="text-base font-bold text-slate-900">{tr('Chi tiết giao dịch tài chính', 'Financial Transaction Details')}</h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {tr('Bảng kê chi tiết chứng từ thanh toán, phân loại nhóm tài chính, trạng thái thanh toán và đối soát.', 'Itemized ledger of financial payments with financial classification and reconciliation status.')}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleExportTableCsv}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition-all border border-slate-200 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">file_download</span>
                {tr('Xuất bảng này ra CSV', 'Export Table CSV')}
              </button>
            </div>
          </div>

          {/* Table Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
            {/* Search */}
            <div className="lg:col-span-2 relative">
              <input
                type="text"
                placeholder={tr('Tìm mã GD, khách hàng, mã HĐ...', 'Search txn ID, customer, contract...')}
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
              <span className="material-symbols-outlined text-[18px] text-slate-400 absolute left-2.5 top-2">search</span>
            </div>

            {/* Financial Group Filter */}
            <div>
              <select
                value={tableFinancialCategory}
                onChange={(e) => setTableFinancialCategory(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-semibold cursor-pointer focus:outline-none"
              >
                <option value="ALL">{tr('Tất cả nhóm tài chính', 'All Financial Groups')}</option>
                <option value="OPERATING_REVENUE">{tr('Doanh thu hoạt động', 'Operating Revenue')}</option>
                <option value="HELD_DEPOSIT">{tr('Tiền cọc giữ hộ', 'Held Deposit')}</option>
                <option value="RESERVATION_HOLD">{tr('Đặt chỗ kho', 'Reservation Hold')}</option>
              </select>
            </div>

            {/* Payment Type Filter */}
            <div>
              <select
                value={tablePaymentType}
                onChange={(e) => setTablePaymentType(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-semibold cursor-pointer focus:outline-none"
              >
                <option value="ALL">{tr('Tất cả loại nghiệp vụ', 'All Business Types')}</option>
                <option value="RENTAL_FEE">{tr('Tiền thuê kho', 'Rental Fee')}</option>
                <option value="DEPOSIT">{tr('Tiền cọc', 'Deposit')}</option>
                <option value="RENEWAL_FEE">{tr('Tái ký / Gia hạn', 'Renewal')}</option>
                <option value="EXTRA_CHARGE">{tr('Phụ phí & Dịch vụ', 'Extra Charge')}</option>
                <option value="BOOKING_PAYMENT">{tr('Đặt chỗ', 'Booking')}</option>
              </select>
            </div>

            {/* Payment Method Filter */}
            <div>
              <select
                value={tablePaymentMethod}
                onChange={(e) => setTablePaymentMethod(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-semibold cursor-pointer focus:outline-none"
              >
                <option value="ALL">{tr('Tất cả kênh TT', 'All Methods')}</option>
                <option value="VNPAY">VNPay</option>
                <option value="BANK_TRANSFER">{tr('Chuyển khoản NH', 'Bank Transfer')}</option>
                <option value="CASH">{tr('Tiền mặt', 'Cash')}</option>
              </select>
            </div>

            {/* Reconciliation Status Filter */}
            <div>
              <select
                value={tableReconStatus}
                onChange={(e) => setTableReconStatus(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-semibold cursor-pointer focus:outline-none"
              >
                <option value="ALL">{tr('Tất cả trạng thái đối soát', 'All Recon Status')}</option>
                <option value="RECONCILED">{tr('Đã đối soát', 'Reconciled')}</option>
                <option value="PENDING">{tr('Chờ đối soát', 'Pending Recon')}</option>
                <option value="UNRECONCILED">{tr('Chưa đối soát', 'Unreconciled')}</option>
              </select>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-mono uppercase border-b border-slate-200">
                  <th className="py-3 px-3 font-bold"># {tr('Mã GD', 'Txn Code')}</th>
                  <th className="py-3 px-3 font-bold">{tr('Ngày giờ', 'Date & Time')}</th>
                  <th className="py-3 px-3 font-bold">{tr('Khách hàng', 'Customer')}</th>
                  <th className="py-3 px-3 font-bold">{tr('HĐ / Booking', 'Contract / Book')}</th>
                  <th className="py-3 px-3 font-bold">{tr('Cơ sở', 'Facility')}</th>
                  <th className="py-3 px-3 font-bold">{tr('Loại nghiệp vụ', 'Business Type')}</th>
                  <th className="py-3 px-3 font-bold">{tr('Nhóm tài chính', 'Financial Group')}</th>
                  <th className="py-3 px-3 text-right font-bold">{tr('Số tiền', 'Amount')}</th>
                  <th className="py-3 px-3 text-center font-bold">{tr('Kênh TT', 'Method')}</th>
                  <th className="py-3 px-3 text-center font-bold">{tr('Trạng thái TT', 'Pay Status')}</th>
                  <th className="py-3 px-3 text-center font-bold">{tr('Đối soát', 'Reconciliation')}</th>
                  <th className="py-3 px-3 font-bold">{tr('Người xử lý', 'Handler')}</th>
                  <th className="py-3 px-3 text-center font-bold">{tr('Thao tác', 'Action')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {isPaymentsLoading ? (
                  <tr>
                    <td colSpan={13} className="py-10 text-center text-slate-400">
                      <span className="inline-flex items-center gap-2">
                        <span className="material-symbols-outlined text-[20px] animate-spin text-blue-600">progress_activity</span>
                        {tr('Đang tải danh sách giao dịch...', 'Loading transaction records...')}
                      </span>
                    </td>
                  </tr>
                ) : filteredPayments.length > 0 ? (
                  filteredPayments.map((p) => {
                    const finCat = getFinancialCategory(p.paymentType)
                    const typeBadge = getPaymentTypeBadge(p.paymentType)
                    const reconStatus = p.reconciliationStatus || 'UNRECONCILED'
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* 1. Mã GD */}
                        <td className="py-3 px-3 font-mono text-[11px] font-bold text-slate-900">
                          {p.receiptVoucherCode || (p.transactionId ? p.transactionId.slice(-10) : p.id.slice(0, 8))}
                        </td>
                        {/* 2. Ngày giờ */}
                        <td className="py-3 px-3 font-mono text-[11px] text-slate-600">
                          {p.paymentTime ? new Date(p.paymentTime).toLocaleString(currencyLocale) : p.createdAt ? new Date(p.createdAt).toLocaleString(currencyLocale) : '—'}
                        </td>
                        {/* 3. Khách hàng */}
                        <td className="py-3 px-3 font-bold text-slate-900">
                          {p.customerName || 'N/A'}
                        </td>
                        {/* 4. Mã hợp đồng / Booking */}
                        <td className="py-3 px-3 font-mono text-xs text-blue-700 font-semibold">
                          {p.contractCode || p.bookingCode || '—'}
                        </td>
                        {/* 5. Cơ sở */}
                        <td className="py-3 px-3 text-slate-700">
                          {p.facilityName || '—'}
                        </td>
                        {/* 6. Loại nghiệp vụ */}
                        <td className="py-3 px-3">
                          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold border ${typeBadge.bg}`}>
                            {language === 'vi' ? typeBadge.labelVi : typeBadge.labelEn}
                          </span>
                        </td>
                        {/* 7. Nhóm tài chính */}
                        <td className="py-3 px-3">
                          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                            finCat.color === 'emerald' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                            finCat.color === 'cyan' ? 'bg-cyan-50 text-cyan-800 border border-cyan-200' :
                            finCat.color === 'purple' ? 'bg-purple-50 text-purple-800 border border-purple-200' :
                            'bg-slate-100 text-slate-800 border border-slate-200'
                          }`}>
                            {language === 'vi' ? finCat.labelVi : finCat.labelEn}
                          </span>
                        </td>
                        {/* 8. Số tiền */}
                        <td className="py-3 px-3 text-right font-mono font-extrabold text-slate-900">
                          {formatVnd(p.amount || 0)}
                        </td>
                        {/* 9. Kênh thanh toán */}
                        <td className="py-3 px-3 text-center">
                          <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 font-mono">
                            {p.paymentMethod || '—'}
                          </span>
                        </td>
                        {/* 10. Trạng thái thanh toán */}
                        <td className="py-3 px-3 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            p.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' :
                            p.status === 'PENDING' ? 'bg-amber-100 text-amber-800' :
                            p.status === 'REFUNDED' ? 'bg-purple-100 text-purple-800' :
                            'bg-rose-100 text-rose-800'
                          }`}>
                            {p.status}
                          </span>
                        </td>
                        {/* 11. Trạng thái đối soát */}
                        <td className="py-3 px-3 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            ['RECONCILED', 'AUTO_RECONCILED'].includes(reconStatus)
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : reconStatus === 'PENDING_RECONCILIATION'
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}>
                            {reconStatus === 'RECONCILED' || reconStatus === 'AUTO_RECONCILED' ? tr('Đã đối soát', 'Reconciled') :
                             reconStatus === 'PENDING_RECONCILIATION' ? tr('Chờ đối soát', 'Pending') : tr('Chưa đối soát', 'Unreconciled')}
                          </span>
                        </td>
                        {/* 12. Người xử lý */}
                        <td className="py-3 px-3 text-slate-600 text-[11px]">
                          {p.confirmedByName || p.collectedByName || tr('Tự động', 'Automated')}
                        </td>
                        {/* 13. Thao tác */}
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedPaymentDetail(p)}
                            className="p-1 rounded hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                            title={tr('Xem chi tiết chứng từ', 'View detail')}
                          >
                            <span className="material-symbols-outlined text-[18px]">visibility</span>
                          </button>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={13} className="py-8 text-center text-slate-400">
                      {tr('Không tìm thấy giao dịch nào phù hợp với bộ lọc.', 'No transactions matching filters.')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span>{tr('Hiển thị', 'Showing')} {payments.length} / {paymentsTotalElements} {tr('giao dịch', 'transactions')}</span>
              <span className="text-slate-300">|</span>
              <span>{tr('Số dòng mỗi trang:', 'Rows per page:')}</span>
              <select
                value={paymentsPageSize}
                onChange={(e) => {
                  setPaymentsPageSize(Number(e.target.value))
                  setPaymentsPage(0)
                }}
                className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs font-semibold cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <button
                type="button"
                disabled={paymentsPage <= 0}
                onClick={() => setPaymentsPage((prev) => Math.max(0, prev - 1))}
                className="px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-slate-700 cursor-pointer"
              >
                {tr('Trước', 'Prev')}
              </button>
              <span className="font-mono font-bold px-2 text-slate-900">
                {paymentsPage + 1} / {Math.max(1, paymentsTotalPages)}
              </span>
              <button
                type="button"
                disabled={paymentsPage + 1 >= paymentsTotalPages}
                onClick={() => setPaymentsPage((prev) => prev + 1)}
                className="px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-slate-700 cursor-pointer"
              >
                {tr('Sau', 'Next')}
              </button>
            </div>
          </div>
        </div>

        {/* 7. CHAIN-WIDE RENEWAL OVERSIGHT PANEL */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center">
                <span className="material-symbols-outlined text-[22px]">autorenew</span>
              </div>
              <div>
                <h2 className="text-base font-bold font-headline text-slate-900">
                  {tr('Giám sát & Thẩm định gia hạn toàn chuỗi', 'Chain-wide Renewal Monitoring & Review')}
                </h2>
                <p className="text-xs text-slate-500">
                  {tr('Theo dõi tiến độ gia hạn, tỷ lệ hoàn tất, duyệt ngoại lệ và đối soát doanh thu thực thu tại các cơ sở', 'Monitor renewal progress, completion rates, approve exceptions, and reconcile collected revenue')}
                </p>
              </div>
            </div>
          </div>

          <ContractRenewalsManagementPanel
            currentFacilityId={selectedFacilityId === 'all' ? undefined : selectedFacilityId}
            facilities={facilities}
            userRole="BUSINESS_MANAGER"
            showChainWideFilter={true}
          />
        </div>

        {/* TRANSACTION DETAIL MODAL */}
        {selectedPaymentDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600 text-[22px]">receipt</span>
                  <h3 className="text-sm font-bold text-slate-900">{tr('Chi tiết chứng từ thanh toán', 'Payment Voucher Detail')}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPaymentDetail(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              <div className="p-6 space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-100">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">{tr('Mã giao dịch / Biên nhận', 'Txn / Voucher Code')}</span>
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      {selectedPaymentDetail.receiptVoucherCode || selectedPaymentDetail.transactionId || selectedPaymentDetail.id}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">{tr('Số tiền thanh toán', 'Paid Amount')}</span>
                    <span className="font-mono font-black text-slate-900 text-base text-blue-700">
                      {formatVnd(selectedPaymentDetail.amount || 0)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-slate-700">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">{tr('Khách hàng', 'Customer')}</span>
                    <span className="font-bold text-slate-900">{selectedPaymentDetail.customerName || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">{tr('Cơ sở', 'Facility')}</span>
                    <span className="font-semibold">{selectedPaymentDetail.facilityName || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">{tr('Hợp đồng / Booking', 'Contract / Booking')}</span>
                    <span className="font-mono font-semibold text-blue-700">{selectedPaymentDetail.contractCode || selectedPaymentDetail.bookingCode || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">{tr('Kênh thanh toán', 'Method')}</span>
                    <span className="font-mono font-semibold">{selectedPaymentDetail.paymentMethod || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">{tr('Trạng thái TT', 'Payment Status')}</span>
                    <span className="font-bold text-emerald-700">{selectedPaymentDetail.status}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">{tr('Trạng thái đối soát', 'Recon Status')}</span>
                    <span className="font-bold text-slate-900">{selectedPaymentDetail.reconciliationStatus || 'UNRECONCILED'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">{tr('Thời gian thanh toán', 'Payment Time')}</span>
                    <span className="font-mono text-slate-800">
                      {selectedPaymentDetail.paymentTime ? new Date(selectedPaymentDetail.paymentTime).toLocaleString(currencyLocale) : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">{tr('Người xác nhận / Duyệt', 'Confirmed By')}</span>
                    <span className="font-semibold text-slate-800">{selectedPaymentDetail.confirmedByName || selectedPaymentDetail.collectedByName || 'Hệ thống'}</span>
                  </div>
                </div>

                {selectedPaymentDetail.paymentNotes && (
                  <div className="pt-3 border-t border-slate-100">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">{tr('Ghi chú thanh toán', 'Payment Notes')}</span>
                    <p className="p-2.5 rounded-lg bg-slate-50 text-slate-700 font-mono text-[11px] border border-slate-200">
                      {selectedPaymentDetail.paymentNotes}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end px-6 py-3 bg-slate-50 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setSelectedPaymentDetail(null)}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition-all cursor-pointer"
                >
                  {tr('Đóng', 'Close')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
