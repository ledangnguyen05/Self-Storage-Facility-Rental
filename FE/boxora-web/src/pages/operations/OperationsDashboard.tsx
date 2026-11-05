import { useRealtimeSync } from '../../hooks/useRealtimeSync'
import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useLanguage } from '../../context/LanguageContext'
import { reportService } from '../../services/reportService'
import { downloadExcel, downloadCsv, ExcelColumn, ExcelCell } from '../../utils/exportUtils'
import { facilityService } from '../../services/facilityService'
import { contractService } from '../../services/contractService'
import { paymentService, PaymentItem } from '../../services/paymentService'
import { Facility, RevenueReport, OccupancyReport, OverdueDebtReport } from '../../types'

// Helper for active contracts count
const loadActiveContractsCount = async (facilityId?: string): Promise<number> => {
  try {
    const result = await contractService.getMyContracts({ facilityId, status: 'ACTIVE', page: 0, size: 1 })
    return result.totalElements ?? 0
  } catch {
    return 0
  }
}

// Financial categorisation helpers
const getFinancialCategory = (paymentType: string) => {
  switch (paymentType) {
    case 'RENTAL_FEE':
    case 'RENEWAL_FEE':
    case 'EXTRA_CHARGE':
    case 'RETURN_COMPENSATION':
      return { id: 'OPERATING_REVENUE', labelVi: 'Doanh thu hoạt động', labelEn: 'Operating revenue', color: 'emerald' }
    case 'DEPOSIT':
      return { id: 'HELD_DEPOSIT', labelVi: 'Tiền cọc giữ hộ', labelEn: 'Held deposit', color: 'cyan' }
    case 'BOOKING_PAYMENT':
      return { id: 'RESERVATION_HOLD', labelVi: 'Đặt chỗ giữ kho', labelEn: 'Reservation hold', color: 'purple' }
    default:
      return { id: 'OTHER', labelVi: 'Khoản thu khác', labelEn: 'Other collection', color: 'slate' }
  }
}

const getPaymentTypeBadge = (paymentType: string) => {
  switch (paymentType) {
    case 'RENTAL_FEE':
      return { labelVi: 'Tiền thuê kho', labelEn: 'Rental fee', bg: 'bg-slate-900 text-white border-slate-900' }
    case 'DEPOSIT':
      return { labelVi: 'Tiền đặt cọc', labelEn: 'Deposit', bg: 'bg-cyan-50 text-cyan-800 border-cyan-300' }
    case 'RENEWAL_FEE':
      return { labelVi: 'Gia hạn / Tái ký', labelEn: 'Renewal fee', bg: 'bg-emerald-50 text-emerald-800 border-emerald-300' }
    case 'EXTRA_CHARGE':
      return { labelVi: 'Phụ phí & Dịch vụ', labelEn: 'Extra charge', bg: 'bg-amber-50 text-amber-800 border-amber-300' }
    case 'RETURN_COMPENSATION':
      return { labelVi: 'Bồi thường trả kho', labelEn: 'Return compensation', bg: 'bg-rose-50 text-rose-800 border-rose-300' }
    case 'BOOKING_PAYMENT':
      return { labelVi: 'Thanh toán giữ chỗ', labelEn: 'Booking hold', bg: 'bg-purple-50 text-purple-800 border-purple-300' }
    default:
      return { labelVi: paymentType || 'Khác', labelEn: paymentType || 'Other', bg: 'bg-slate-100 text-slate-700 border-slate-300' }
  }
}

const getPaymentMethodBadge = (method?: string | null) => {
  const m = (method || '').toUpperCase()
  switch (m) {
    case 'VNPAY':
      return {
        labelVi: 'Cổng VNPay',
        labelEn: 'VNPay Gateway',
        bg: 'bg-blue-50 text-blue-700 border-blue-200',
      }
    case 'BANK_TRANSFER':
      return {
        labelVi: 'Chuyển khoản NH',
        labelEn: 'Bank Transfer',
        bg: 'bg-cyan-50 text-cyan-800 border-cyan-200',
      }
    case 'CASH':
      return {
        labelVi: 'Tiền mặt',
        labelEn: 'Cash',
        bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      }
    case 'DEPOSIT_DEDUCTION':
      return {
        labelVi: 'Khấu trừ tiền cọc',
        labelEn: 'Deposit Deduction',
        bg: 'bg-purple-50 text-purple-800 border-purple-200',
      }
    case 'COUNTER':
      return {
        labelVi: 'Tại quầy',
        labelEn: 'At Counter',
        bg: 'bg-amber-50 text-amber-800 border-amber-200',
      }
    default:
      return {
        labelVi: method || '—',
        labelEn: method || '—',
        bg: 'bg-slate-100 text-slate-800 border-slate-200',
      }
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
  const [activeContractsCount, setActiveContractsCount] = useState<number | null>(null)
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

  const [activePreset, setActivePreset] = useState<'TODAY' | 'LAST_7_DAYS' | 'THIS_MONTH' | 'LAST_MONTH' | 'THIS_YEAR' | 'CUSTOM'>('THIS_MONTH')
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
  const [isPaymentsLoading, setIsPaymentsLoading] = useState(true)
  const [paymentsPage, setPaymentsPage] = useState(0)
  const [paymentsPageSize, setPaymentsPageSize] = useState(10)
  const [paymentsTotalElements, setPaymentsTotalElements] = useState(0)
  const [paymentsTotalPages, setPaymentsTotalPages] = useState(0)

  // Table Filters
  const [tableSearch, setTableSearch] = useState('')
  const [selectedChartMonth, setSelectedChartMonth] = useState<string>('ALL')
  const [isChart1Expanded, setIsChart1Expanded] = useState<boolean>(false)
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
  const loadDashboardData = async (fDate = fromDate, tDate = toDate, targetScope?: string, silent: boolean = false) => {
    const requestSequence = ++dashboardRequestSequence.current
    if (!silent) setIsReportsLoading(true)
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
        loadActiveContractsCount(targetFacilityId)
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
        setActiveContractsCount(ctRes.value)
      } else {
        setActiveContractsCount(null)
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
  const loadPaymentsTable = async (fDate = fromDate, tDate = toDate, targetScope = selectedFacilityId, page = paymentsPage, size = paymentsPageSize, silent: boolean = false) => {
    if (!silent) setIsPaymentsLoading(true)
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
    void loadPaymentsTable(fromDate, toDate, selectedFacilityId, paymentsPage, paymentsPageSize, false)
  }, [selectedFacilityId, fromDate, toDate, paymentsPage, paymentsPageSize, tablePaymentStatus, tablePaymentType])

  useRealtimeSync(() => {
    void loadDashboardData(fromDate, toDate, selectedFacilityId, true)
    void loadPaymentsTable(fromDate, toDate, selectedFacilityId, paymentsPage, paymentsPageSize, true)
  }, { intervalMs: 30000 })

  // Preset Handlers
  const applyPreset = (presetKey: 'TODAY' | 'LAST_7_DAYS' | 'THIS_MONTH' | 'LAST_MONTH' | 'THIS_YEAR') => {
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

  // Chart 1: Monthly Recognized Net Revenue & Full Inflow/Outflow Series
  const monthlyRevenueData = useMemo(() => {
    return (revenueData?.monthlyRevenue ?? []).map((item) => {
      const rental = item.rentalFeeRevenue || 0
      const renewal = item.renewalFeeRevenue || 0
      const extra = item.extraChargeRevenue || 0
      const deposit = item.depositRevenue || 0
      const booking = item.bookingPaymentRevenue || 0
      const refund = item.refundAmount || 0
      const rentalRefund = item.rentalRefundAmount || 0

      const totalIn = item.totalRevenue || (rental + renewal + extra + deposit + booking)
      const totalOut = refund
      const netCashFlow = item.netCashFlow != null ? item.netCashFlow : (totalIn - totalOut)
      const netRevenue = item.netRevenue != null ? item.netRevenue : Math.max(0, rental + renewal + extra - rentalRefund)

      const y = item.month ? item.month.slice(0, 4) : ''
      const m = item.month ? item.month.slice(5, 7) : ''

      return {
        monthKey: item.month ?? 'unknown',
        label: item.month ? `T${m}/${y.slice(2)}` : tr('Chưa rõ', 'N/A'),
        fullLabel: item.month ? `Tháng ${m}/${y}` : tr('Chưa rõ', 'N/A'),
        year: y,
        monthNum: m,
        // Nguồn vào
        rental,
        renewal,
        extra,
        deposit,
        booking,
        totalIn,
        // Nguồn ra
        refund,
        rentalRefund,
        totalOut,
        // Cân đối ròng
        netCashFlow,
        netRevenue,
        paymentCount: item.paymentCount || 0,
      }
    })
  }, [revenueData, language])

  const displayedChartMonths = useMemo(() => {
    if (selectedChartMonth === 'ALL' || !monthlyRevenueData.some(m => m.monthKey === selectedChartMonth)) {
      return monthlyRevenueData
    }
    return monthlyRevenueData.filter(m => m.monthKey === selectedChartMonth)
  }, [monthlyRevenueData, selectedChartMonth])

  // Chart 2: Cash-in Breakdown (Cơ cấu tiền thực thu)
  const cashInBreakdown = useMemo(() => {
    const rentalFee = summary?.rentalFeeRevenue ?? 0
    const deposit = summary?.depositRevenue ?? 0
    const renewalFee = summary?.renewalFeeRevenue ?? 0
    const extraCharge = summary?.extraChargeRevenue ?? 0
    const bookingPayment = summary?.bookingPaymentRevenue ?? 0
    const returnCompensation = summary?.returnCompensationRevenue ?? 0
    const classifiedSum = rentalFee + deposit + renewalFee + extraCharge + bookingPayment + returnCompensation
    const otherCash = Math.max(0, (totalCashIn || 0) - classifiedSum)
    const sum = totalCashIn || classifiedSum || 1

    const items = [
      { id: 'RENTAL', label: tr('Tiền thuê kho đã thu', 'Collected rental fees'), amount: rentalFee, color: '#d97706', bgClass: 'bg-amber-500', textClass: 'text-amber-700', pct: Math.round((rentalFee / sum) * 1000) / 10 },
      { id: 'DEPOSIT', label: tr('Tiền cọc nhận vào', 'Incoming deposits'), amount: deposit, color: '#0891b2', bgClass: 'bg-cyan-600', textClass: 'text-cyan-700', pct: Math.round((deposit / sum) * 1000) / 10 },
      { id: 'BOOKING', label: tr('Tiền đặt kho giữ chỗ', 'Booking reserve fees'), amount: bookingPayment, color: '#2563eb', bgClass: 'bg-blue-600', textClass: 'text-blue-700', pct: Math.round((bookingPayment / sum) * 1000) / 10 },
      { id: 'RENEWAL', label: tr('Phí gia hạn / Tái ký', 'Renewal fees'), amount: renewalFee, color: '#059669', bgClass: 'bg-emerald-600', textClass: 'text-emerald-700', pct: Math.round((renewalFee / sum) * 1000) / 10 },
      { id: 'EXTRA', label: tr('Phụ phí & Dịch vụ', 'Extra charges & services'), amount: extraCharge, color: '#64748b', bgClass: 'bg-slate-500', textClass: 'text-slate-700', pct: Math.round((extraCharge / sum) * 1000) / 10 },
      { id: 'RETURN_COMPENSATION', label: tr('Bồi thường trả kho / thiệt hại', 'Return compensation'), amount: returnCompensation, color: '#e11d48', bgClass: 'bg-rose-600', textClass: 'text-rose-600', pct: Math.round((returnCompensation / sum) * 1000) / 10 },
      { id: 'OTHER', label: tr('Khoản thu khác', 'Other receipts'), amount: otherCash, color: '#94a3b8', bgClass: 'bg-slate-400', textClass: 'text-slate-600', pct: Math.round((otherCash / sum) * 1000) / 10 },
    ]

    return items.filter((item) => item.amount > 0 || totalCashIn === 0)
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
    const cash = list.find((m) => m.paymentMethod?.toUpperCase() === 'CASH')
    const other = list.filter((m) => !['VNPAY', 'BANK_TRANSFER', 'CASH'].includes(m.paymentMethod?.toUpperCase() ?? ''))

    const vnpayCount = vnpay?.paymentCount ?? 0
    const vnpayAmount = vnpay?.totalAmount ?? 0
    const vnpayReconciled = vnpay?.reconciledAmount ?? vnpayAmount

    const bankCount = bank?.paymentCount ?? 0
    const bankAmount = bank?.totalAmount ?? 0
    const bankReconciled = bank?.reconciledAmount ?? bankAmount

    const cashCount = cash?.paymentCount ?? 0
    const cashAmount = cash?.totalAmount ?? 0
    const cashReconciled = cash?.reconciledAmount ?? cashAmount

    const otherCount = other.reduce((acc, curr) => acc + curr.paymentCount, 0)
    const otherAmount = other.reduce((acc, curr) => acc + (curr.totalAmount ?? 0), 0)
    const otherReconciled = other.reduce((acc, curr) => acc + (curr.reconciledAmount ?? 0), 0)

    const totalCount = vnpayCount + bankCount + cashCount + otherCount || 1
    const totalAmount = vnpayAmount + bankAmount + cashAmount + otherAmount || 1
    const totalReconciled = vnpayReconciled + bankReconciled + cashReconciled + otherReconciled || 1

    return {
      vnpay: { count: vnpayCount, amount: vnpayAmount, reconciled: vnpayReconciled },
      bank: { count: bankCount, amount: bankAmount, reconciled: bankReconciled },
      cash: { count: cashCount, amount: cashAmount, reconciled: cashReconciled },
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

  // Excel & CSV Export Handlers
  const handleExportSystemExcel = async () => {
    try {
      let data = revenueData
      if (!data) {
        data = await reportService.getRevenueReport(fromDate, toDate, selectedFacilityId)
      }
      if (!data) {
        showToast(tr('Không có dữ liệu báo cáo để xuất.', 'No report data to export.'), true)
        return
      }

      const summary = data.systemSummary
      const facilitiesList = data.byFacility || []
      const dateRangeStr = `${fromDate || tr('Toàn bộ', 'All')} - ${toDate || tr('Hiện tại', 'Present')}`
      const exportDateStr = new Date().toLocaleDateString('vi-VN')

      const columns: ExcelColumn[] = [
        { width: 220 }, // Cơ sở
        { width: 140 }, // Doanh thu thuần
        { width: 140 }, // Tiền thực thu
        { width: 140 }, // Doanh thu thuê
        { width: 140 }, // Tiền cọc giữ
        { width: 140 }, // Công nợ quá hạn
        { width: 130 }, // Tiền hoàn trả
        { width: 90 },  // Số giao dịch
      ]

      const rows: ExcelCell[][] = [
        [{ val: 'BÁO CÁO DOANH THU & TÀI CHÍNH BOXORA', style: 'Title' }],
        [{ val: `Kỳ báo cáo: ${dateRangeStr} • Ngày xuất: ${exportDateStr}`, style: 'Subtitle' }],
        [],
        [
          { val: 'TỔNG QUAN CHỈ SỐ KPI (VND)', style: 'Section' },
          { val: 'GIÁ TRỊ (VND)', style: 'Section', align: 'Right' }
        ],
        [
          { val: 'Tổng doanh thu thuần' },
          { val: summary?.netRevenue || 0, type: 'Number', style: 'BoldNumber' }
        ],
        [
          { val: 'Tổng tiền thực thu (Cash In)' },
          { val: summary?.totalCashIn || 0, type: 'Number', style: 'BoldNumber' }
        ],
        [
          { val: 'Doanh thu tiền thuê kho' },
          { val: summary?.rentalRevenue || 0, type: 'Number', style: 'Number' }
        ],
        [
          { val: 'Công nợ quá hạn phải thu' },
          { val: summary?.totalOverdueDebt || 0, type: 'Number', style: 'Number' }
        ],
        [
          { val: 'Tiền ký quỹ cọc đang giữ' },
          { val: summary?.depositsHeld || 0, type: 'Number', style: 'Number' }
        ],
        [
          { val: 'Tiền hoàn trả khách đã giải ngân' },
          { val: summary?.refundedAmount || 0, type: 'Number', style: 'Number' }
        ],
        [
          { val: 'Tiền hoàn trả đang chờ xử lý' },
          { val: summary?.pendingRefundAmount || 0, type: 'Number', style: 'Number' }
        ],
        [],
        [
          { val: 'Cơ sở Boxora', style: 'Header' },
          { val: 'Doanh thu thuần', style: 'Header' },
          { val: 'Tiền thực thu', style: 'Header' },
          { val: 'Doanh thu thuê', style: 'Header' },
          { val: 'Tiền cọc giữ', style: 'Header' },
          { val: 'Công nợ quá hạn', style: 'Header' },
          { val: 'Tiền hoàn trả', style: 'Header' },
          { val: 'Số GD', style: 'Header' }
        ]
      ]

      facilitiesList.forEach((f) => {
        rows.push([
          { val: f.facilityName || 'N/A' },
          { val: f.netRevenue || 0, type: 'Number', style: 'Number' },
          { val: f.totalCashIn || 0, type: 'Number', style: 'Number' },
          { val: f.rentalRevenue || 0, type: 'Number', style: 'Number' },
          { val: f.depositsHeld || 0, type: 'Number', style: 'Number' },
          { val: f.totalOverdueDebt || 0, type: 'Number', style: 'Number' },
          { val: f.refundedAmount || 0, type: 'Number', style: 'Number' },
          { val: f.paymentCount || 0, type: 'Number', style: 'Number' }
        ])
      })

      rows.push([
        { val: 'TỔNG CỘNG HỆ THỐNG', style: 'Total' },
        { val: summary?.netRevenue || 0, type: 'Number', style: 'Total' },
        { val: summary?.totalCashIn || 0, type: 'Number', style: 'Total' },
        { val: summary?.rentalRevenue || 0, type: 'Number', style: 'Total' },
        { val: summary?.depositsHeld || 0, type: 'Number', style: 'Total' },
        { val: summary?.totalOverdueDebt || 0, type: 'Number', style: 'Total' },
        { val: summary?.refundedAmount || 0, type: 'Number', style: 'Total' },
        { val: facilitiesList.reduce((sum, item) => sum + (item.paymentCount || 0), 0), type: 'Number', style: 'Total' }
      ])

      downloadExcel(`boxora-bao-cao-doanh-thu-${new Date().toISOString().slice(0, 10)}.xls`, 'DoanhThuBoxora', columns, rows)
      showToast(tr('Đã tải xuống file Excel báo cáo doanh thu chuẩn tiếng Việt.', 'Revenue report Excel downloaded successfully.'))
    } catch (err) {
      console.error('Failed to export system excel:', err)
      showToast(tr('Lỗi xuất file Excel báo cáo.', 'Failed to export Excel report.'), true)
    }
  }

  const handleExportSystemCsv = async () => {
    try {
      const blob = await reportService.exportRevenueCsv(fromDate, toDate, selectedFacilityId)
      const text = await blob.text()
      let finalCsv = text.replace(/^\uFEFF/, '')
      if (!finalCsv.startsWith('sep=')) {
        finalCsv = 'sep=,\r\n' + finalCsv
      }
      const withBom = '\uFEFF' + finalCsv
      const utf8Blob = new Blob([withBom], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(utf8Blob); const a = document.createElement("a"); a.href = url; a.download = `boxora-bao-cao-doanh-thu-${new Date().toISOString().slice(0, 10)}.csv`; document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url)
      showToast(tr('Đã tải xuống file CSV báo cáo tài chính Boxora (UTF-8 BOM).', 'Boxora financial report CSV downloaded.'))
    } catch (err) {
      console.warn('Server CSV export failed, falling back to local dataset export:', err)
      let fallbackData = revenueData
      if (!fallbackData) {
        try {
          fallbackData = await reportService.getRevenueReport(fromDate, toDate, selectedFacilityId)
        } catch {}
      }
      if (fallbackData) {
        const summary = fallbackData.systemSummary
        const facilitiesList = fallbackData.byFacility || []
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

        downloadCsv(`boxora-bao-cao-doanh-thu-${new Date().toISOString().slice(0, 10)}.csv`, lines.join('\r\n'))
        showToast(tr('Đã tải xuống file CSV báo cáo tài chính Boxora.', 'Boxora financial report CSV downloaded.'))
        return
      }

      showToast(tr('Lỗi xuất file CSV từ máy chủ.', 'Failed to export CSV from server.'), true)
    }
  }

  const handleExportTableExcel = () => {
    if (filteredPayments.length === 0) {
      showToast(tr('Không có dữ liệu giao dịch để xuất.', 'No transaction records to export.'), true)
      return
    }

    const columns: ExcelColumn[] = [
      { width: 140 }, // Mã GD
      { width: 130 }, // Thời gian
      { width: 160 }, // Khách hàng
      { width: 130 }, // Mã HĐ / Booking
      { width: 180 }, // Cơ sở
      { width: 130 }, // Nghiệp vụ
      { width: 130 }, // Phân nhóm
      { width: 120 }, // Số tiền (VND)
      { width: 100 }, // Kênh TT
      { width: 110 }, // Trạng thái TT
      { width: 110 }, // Đối soát
      { width: 140 }, // Người xử lý
      { width: 110 }, // Mã phiếu thu
    ]

    const headers: ExcelCell[] = [
      { val: 'Mã giao dịch', style: 'Header' },
      { val: 'Thời gian', style: 'Header' },
      { val: 'Khách hàng', style: 'Header' },
      { val: 'Hợp đồng / Booking', style: 'Header' },
      { val: 'Cơ sở', style: 'Header' },
      { val: 'Loại nghiệp vụ', style: 'Header' },
      { val: 'Nhóm tài chính', style: 'Header' },
      { val: 'Số tiền (VND)', style: 'Header' },
      { val: 'Kênh thanh toán', style: 'Header' },
      { val: 'Trạng thái TT', style: 'Header' },
      { val: 'Trạng thái đối soát', style: 'Header' },
      { val: 'Người xử lý', style: 'Header' },
      { val: 'Mã phiếu thu', style: 'Header' }
    ]

    const rows: ExcelCell[][] = [
      [{ val: 'BẢNG KÊ CHI TIẾT GIAO DỊCH THANH TOÁN BOXORA', style: 'Title' }],
      [{ val: `Kỳ báo cáo: ${fromDate || 'Toàn bộ'} - ${toDate || 'Hiện tại'} • Tổng số giao dịch: ${filteredPayments.length}`, style: 'Subtitle' }],
      [],
      headers
    ]

    filteredPayments.forEach((p) => {
      const finCat = getFinancialCategory(p.paymentType)
      const typeBadge = getPaymentTypeBadge(p.paymentType)
      rows.push([
        { val: p.transactionId || p.receiptVoucherCode || p.id },
        { val: p.paymentTime ? new Date(p.paymentTime).toLocaleString('vi-VN') : (p.createdAt ? new Date(p.createdAt).toLocaleString('vi-VN') : '') },
        { val: p.customerName || 'N/A' },
        { val: p.contractCode || p.bookingCode || '—' },
        { val: p.facilityName || '—' },
        { val: language === 'vi' ? typeBadge.labelVi : typeBadge.labelEn },
        { val: language === 'vi' ? finCat.labelVi : finCat.labelEn },
        { val: p.amount || 0, type: 'Number', style: 'Number' },
        { val: language === 'vi' ? getPaymentMethodBadge(p.paymentMethod).labelVi : getPaymentMethodBadge(p.paymentMethod).labelEn },
        { val: p.status || '—' },
        { val: p.reconciliationStatus || 'UNRECONCILED' },
        { val: p.confirmedByName || p.collectedByName || 'Hệ thống' },
        { val: p.receiptVoucherCode || '—' }
      ])
    })

    downloadExcel(`boxora-chi-tiet-giao-dich-${new Date().toISOString().slice(0, 10)}.xls`, 'GiaoDichBoxora', columns, rows)
    showToast(tr('Đã tải xuống bảng chi tiết giao dịch Excel.', 'Transaction details Excel downloaded.'))
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
        language === 'vi' ? getPaymentMethodBadge(p.paymentMethod).labelVi : getPaymentMethodBadge(p.paymentMethod).labelEn,
        p.status || '—',
        p.reconciliationStatus || 'UNRECONCILED',
        p.confirmedByName || p.collectedByName || 'Hệ thống',
        p.receiptVoucherCode || '—'
      ]
    })

    const csvContent = [headers, ...rows].map((row) =>
      row.map((val) => {
        const cell = String(val ?? '')
        const safe = /^[=+@-]/.test(cell) ? `'${cell}` : cell
        return `"${safe.replaceAll('"', '""')}"`
      }).join(',')
    ).join('\r\n')

    downloadCsv(`boxora-chi-tiet-giao-dich-${new Date().toISOString().slice(0, 10)}.csv`, csvContent)
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
        <div className="relative w-full rounded-2xl bg-white p-6 shadow-md border border-slate-200/90 z-20">
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
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleExportSystemExcel}
                    title={tr('Tải file Excel báo cáo doanh thu (Khuyên dùng cho Excel, tiếng Việt chuẩn 100%, tự động chia cột)', 'Download revenue Excel report (Recommended)')}
                    className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer hover:shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[17px]">table_view</span>
                    {tr('Xuất Excel', 'Export Excel')}
                  </button>
                  <button
                    type="button"
                    onClick={handleExportSystemCsv}
                    title={tr('Tải file CSV báo cáo tài chính Boxora (UTF-8 BOM)', 'Download financial overview CSV')}
                    className="flex items-center gap-1 px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all border border-slate-200 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px] text-slate-500">csv</span>
                    {tr('CSV', 'CSV')}
                  </button>
                </div>
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
          <div className="relative rounded-2xl bg-white p-5 shadow-sm hover:shadow-md border border-slate-200 hover:border-slate-300 transition-all">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{tr('1. Doanh thu thuần', '1. Net Revenue')}</span>
              <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100" title={tr('Doanh thu tiền thuê + gia hạn + phụ phí đã trừ hoàn tiền hợp lệ trong kỳ. Không bao gồm tiền cọc & giữ chỗ.', 'Net recognized revenue: Rental + Renewal + Extra minus completed refunds. Excludes deposits & holds.')}>
                <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
              </div>
            </div>
            <div className="my-3">
              <div className="text-xl xl:text-2xl font-black font-mono text-emerald-700 tracking-tight whitespace-nowrap">
                {formatVnd(netRevenue)}
              </div>
              <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                {tr('Đã trừ hoàn tiền hợp lệ; không tính cọc & giữ chỗ', 'Deducted valid refunds; excludes deposits')}
              </p>
            </div>
            <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-emerald-700 font-semibold">
              <span>{tr('Ghi nhận kỳ:', 'Period status:')}</span>
              <span className="font-mono bg-emerald-50 px-2 py-0.5 rounded text-emerald-800 border border-emerald-200">
                {summary?.rentalRevenue ? `${Math.round(((summary.rentalRevenue) / Math.max(netRevenue, 1)) * 100)}% ${tr('thuê kho', 'unit rental')}` : '100%'}
              </span>
            </div>
          </div>

          {/* KPI 2: Tổng tiền thực thu */}
          <div className="relative rounded-2xl bg-white p-5 shadow-sm hover:shadow-md border border-slate-200 hover:border-slate-300 transition-all">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{tr('2. Tiền thực thu', '2. Total Cash-In')}</span>
              <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100" title={tr('Tổng tiền thực nhận từ các giao dịch PAID đã xác minh trong kỳ.', 'Total cash received across verified PAID payments.')}>
                <span className="material-symbols-outlined text-[20px]">payments</span>
              </div>
            </div>
            <div className="my-3">
              <div className="text-xl xl:text-2xl font-black font-mono text-blue-700 tracking-tight whitespace-nowrap">
                {formatVnd(totalCashIn)}
              </div>
            </div>
            <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600 font-medium">
              <span>{tr('Số giao dịch:', 'Payments:')}</span>
              <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                {paymentCount.toLocaleString(currencyLocale)} {tr('GD', 'txns')}
              </span>
            </div>
          </div>

          {/* KPI 3: Doanh thu tiền thuê kho */}
          <div className="relative rounded-2xl bg-white p-5 shadow-sm hover:shadow-md border border-slate-200 hover:border-slate-300 transition-all">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{tr('3. Tiền thuê kho', '3. Rental Revenue')}</span>
              <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100" title={tr('Doanh thu từ hoạt động cốt lõi: tiền thuê kho và phí gia hạn trong kỳ.', 'Core revenue from unit rentals and contract renewals.')}>
                <span className="material-symbols-outlined text-[20px]">warehouse</span>
              </div>
            </div>
            <div className="my-3">
              <div className="text-xl xl:text-2xl font-black font-mono text-amber-600 tracking-tight whitespace-nowrap">
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
          <div className="relative rounded-2xl bg-white p-5 shadow-sm hover:shadow-md border border-slate-200 hover:border-slate-300 transition-all">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{tr('4. Công nợ phải thu', '4. Overdue Debt')}</span>
              <div className="h-8 w-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100" title={tr('Khoản tiền thuê quá hạn khách còn phải thanh toán, chia theo 4 cấp độ.', 'Customer overdue debts tracked across 4 stages.')}>
                <span className="material-symbols-outlined text-[20px]">gavel</span>
              </div>
            </div>
            <div className="my-3">
              <div className="text-xl xl:text-2xl font-black font-mono text-rose-600 tracking-tight whitespace-nowrap">
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
          <div className="relative rounded-2xl bg-white p-5 shadow-sm hover:shadow-md border border-slate-200 hover:border-slate-300 transition-all">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{tr('5. Tiền cọc đang giữ', '5. Deposits Held')}</span>
              <div className="h-8 w-8 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center border border-cyan-100" title={tr('Số dư tiền cọc quản lý an toàn theo hợp đồng đang thuê, chờ quyết toán khi trả kho.', 'Active deposit balance held safely for ongoing contracts.')}>
                <span className="material-symbols-outlined text-[20px]">lock</span>
              </div>
            </div>
            <div className="my-3">
              <div className="text-xl xl:text-2xl font-black font-mono text-cyan-700 tracking-tight whitespace-nowrap">
                {formatVnd(depositsHeld)}
              </div>
              <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                {tr('Nghĩa vụ hoàn trả / quyết toán khi trả kho', 'Payable obligation awaiting checkout settlement')}
              </p>
            </div>
            <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-cyan-800 font-semibold">
              <span>{tr('Hợp đồng ACTIVE:', 'Active contracts:')}</span>
              <span className="font-mono bg-cyan-50 px-2 py-0.5 rounded text-cyan-800 border border-cyan-200">
                {activeContractsCount !== null ? `${activeContractsCount} ${tr('HĐ', 'contracts')}` : '—'}
              </span>
            </div>
          </div>

          {/* KPI 6: Hoàn tiền và giao dịch chờ xử lý */}
          <div className="relative rounded-2xl bg-white p-5 shadow-sm hover:shadow-md border border-slate-200 hover:border-slate-300 transition-all">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{tr('6. Hoàn tiền & Chờ XL', '6. Refunds & Pending')}</span>
              <div className="h-8 w-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100" title={tr('Số tiền đã hoàn thành công vs tiền hoàn đang chờ xử lý & giao dịch chờ đối soát.', 'Separation of completed refunds from pending review & unreconciled items.')}>
                <span className="material-symbols-outlined text-[20px]">assignment_return</span>
              </div>
            </div>
            <div className="my-3">
              <div className="text-xl xl:text-2xl font-black font-mono text-purple-700 tracking-tight whitespace-nowrap">
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Biểu đồ 1: Xu hướng doanh thu & Dòng tiền theo từng tháng (8 cols hoặc 12 cols khi mở rộng) */}
          <div className={`${isChart1Expanded ? 'lg:col-span-12' : 'lg:col-span-8'} bg-white rounded-2xl p-6 shadow-md border border-slate-200/90 flex flex-col justify-between transition-all duration-300`}>
            <div>
              {/* Header: Title, Description & Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="material-symbols-outlined text-emerald-600 text-[22px]">stacked_bar_chart</span>
                    <h2 className="text-base font-bold text-slate-900">
                      {tr('Biểu đồ 1: Xu hướng doanh thu & Dòng tiền theo kỳ', 'Chart 1: Revenue & Cash Flow Trend by Period')}
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      {monthlyRevenueData.length} {tr('tháng trong kỳ', 'months in period')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {tr(
                      'Tạo biểu đồ riêng cho từng tháng theo bộ lọc kỳ báo cáo: Mô tả đầy đủ tất cả nguồn vào (thuê kho, gia hạn, phụ phí dịch vụ, cọc, giữ chỗ) và nguồn ra (hoàn tiền).',
                      'Monthly dedicated charts based on report period filter: Full breakdown of inflows (rental, renewal, extra services, deposit, booking) and outflows (refunds).'
                    )}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Fullscreen / Expand Toggle */}
                  <button
                    type="button"
                    onClick={() => setIsChart1Expanded(!isChart1Expanded)}
                    title={isChart1Expanded ? tr('Thu gọn lại', 'Collapse chart') : tr('Mở rộng toàn màn hình', 'Expand full width')}
                    className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition flex items-center justify-center cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {isChart1Expanded ? 'close_fullscreen' : 'open_in_full'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Month Selector Tabs (Khi kỳ báo cáo có nhiều hơn 1 tháng) */}
              {monthlyRevenueData.length > 1 && (
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2 p-2 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-[11px] font-bold text-slate-500 uppercase mr-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[15px]">filter_alt</span>
                      {tr('Chọn tháng:', 'Select Month:')}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedChartMonth('ALL')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                        selectedChartMonth === 'ALL'
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[14px]">grid_view</span>
                      <span>{tr('Tất cả các tháng (Lưới biểu đồ)', 'All Months (Grid)')}</span>
                    </button>
                    {monthlyRevenueData.map((m) => (
                      <button
                        key={m.monthKey}
                        type="button"
                        onClick={() => setSelectedChartMonth(m.monthKey)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                          selectedChartMonth === m.monthKey
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-white text-slate-700 hover:bg-slate-200/70 border border-slate-200'
                        }`}
                      >
                        <span>{m.label}</span>
                      </button>
                    ))}
                  </div>

                  {selectedChartMonth !== 'ALL' && (
                    <button
                      type="button"
                      onClick={() => setSelectedChartMonth('ALL')}
                      className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-0.5 cursor-pointer"
                    >
                      <span>{tr('Xem toàn bộ các tháng', 'View all months')}</span>
                      <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </button>
                  )}
                </div>
              )}

              {/* Legends Bar: Hiển thị trên 1 hàng duy nhất theo thứ tự 1 -> 6 */}
              <div className="mb-4 py-2 px-3 bg-slate-50/90 rounded-xl border border-slate-200/80 flex flex-nowrap items-center justify-between gap-1.5 sm:gap-2.5 text-[10.5px] sm:text-[11px] text-slate-600 whitespace-nowrap overflow-x-auto scrollbar-none">
                <span className="flex items-center gap-1 shrink-0"><span className="h-2 w-2 rounded-full bg-emerald-600 shrink-0"></span>{tr('1. Doanh thu thuần', '1. Net Revenue')}</span>
                <span className="flex items-center gap-1 shrink-0"><span className="h-2 w-2 rounded-full bg-blue-600 shrink-0"></span>{tr('2. Tiền thực thu', '2. Cash-In')}</span>
                <span className="flex items-center gap-1 shrink-0"><span className="h-2 w-2 rounded-full bg-amber-500 shrink-0"></span>{tr('3. Tiền thuê kho', '3. Rental')}</span>
                <span className="flex items-center gap-1 shrink-0"><span className="h-2 w-2 rounded-full bg-rose-600 shrink-0"></span>{tr('4. Công nợ', '4. Debt')}</span>
                <span className="flex items-center gap-1 shrink-0"><span className="h-2 w-2 rounded-full bg-cyan-600 shrink-0"></span>{tr('5. Tiền cọc đang giữ', '5. Deposits')}</span>
                <span className="flex items-center gap-1 shrink-0"><span className="h-2 w-2 rounded-full bg-purple-600 shrink-0"></span>{tr('6. Hoàn tiền', '6. Refunds')}</span>
                <div className="h-3.5 w-px bg-slate-300 shrink-0"></div>
                <span className="flex items-center gap-1 shrink-0">
                  <span className="h-2 w-2 rounded-full bg-indigo-600 shrink-0"></span>
                  <span className="font-semibold text-indigo-700">{tr('Dòng tiền ròng', 'Net Flow')}</span>
                </span>
              </div>

              {/* Monthly Charts Container: MỖI THÁNG 1 BIỂU ĐỒ HOÀN CHỈNH */}
              {displayedChartMonths.length > 0 ? (
                <div className={`grid ${displayedChartMonths.length === 1 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'} gap-4`}>
                  {displayedChartMonths.map((m) => {
                    const sources = [
                      {
                        id: 'netRevenue',
                        label: tr('1. Doanh thu thuần', '1. Net Revenue'),
                        shortLabel: tr('DT thuần', 'Net Rev'),
                        amount: m.netRevenue,
                        icon: 'account_balance_wallet',
                        color: '#059669',
                        bgClass: 'bg-emerald-600',
                        textClass: 'text-emerald-700',
                        type: 'IN',
                      },
                      {
                        id: 'cashIn',
                        label: tr('2. Tiền thực thu', '2. Total Cash-In'),
                        shortLabel: tr('Thực thu', 'Cash-In'),
                        amount: m.totalIn,
                        icon: 'payments',
                        color: '#2563eb',
                        bgClass: 'bg-blue-600',
                        textClass: 'text-blue-700',
                        type: 'IN',
                      },
                      {
                        id: 'rental',
                        label: tr('3. Tiền thuê kho', '3. Rental Revenue'),
                        shortLabel: tr('Thuê kho', 'Rental'),
                        amount: m.rental + m.renewal,
                        icon: 'warehouse',
                        color: '#d97706',
                        bgClass: 'bg-amber-500',
                        textClass: 'text-amber-700',
                        type: 'IN',
                      },
                      {
                        id: 'overdueDebt',
                        label: tr('4. Công nợ phải thu', '4. Overdue Debt'),
                        shortLabel: tr('Công nợ', 'Debt'),
                        amount: totalOverdueDebt,
                        icon: 'gavel',
                        color: '#e11d48',
                        bgClass: 'bg-rose-600',
                        textClass: 'text-rose-600',
                        type: 'IN',
                      },
                      {
                        id: 'depositHeld',
                        label: tr('5. Tiền cọc đang giữ', '5. Deposits Held'),
                        shortLabel: tr('Cọc giữ', 'Deposit'),
                        amount: depositsHeld,
                        icon: 'lock',
                        color: '#0891b2',
                        bgClass: 'bg-cyan-600',
                        textClass: 'text-cyan-700',
                        type: 'IN',
                      },
                      {
                        id: 'refund',
                        label: tr('6. Hoàn tiền & Chờ XL', '6. Refunds & Pending'),
                        shortLabel: tr('Hoàn tiền', 'Refund'),
                        amount: m.refund > 0 ? m.refund : refundedAmount,
                        icon: 'assignment_return',
                        color: '#7e22ce',
                        bgClass: 'bg-purple-600',
                        textClass: 'text-purple-700',
                        type: 'OUT',
                      },
                    ]

                    const maxVal = Math.max(...sources.map(s => s.amount), Math.abs(m.netCashFlow), 1)

                    return (
                      <div
                        key={m.monthKey}
                        className="bg-slate-50/70 rounded-2xl p-4 sm:p-5 border border-slate-200/90 flex flex-col justify-between gap-4 shadow-2xs hover:shadow-sm transition-all"
                      >
                        {/* Month Card Header */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                              {m.monthNum ? `T${m.monthNum}` : 'M'}
                            </div>
                            <div>
                              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                                <span>{m.fullLabel}</span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-200 text-slate-700">
                                  {m.paymentCount} {tr('giao dịch', 'txns')}
                                </span>
                              </h3>
                              <span className="text-[11px] text-slate-500 font-mono">
                                {tr('Doanh thu thuần:', 'Net Revenue:')} <strong className="text-emerald-700">{formatVnd(m.netRevenue)}</strong>
                              </span>
                            </div>
                          </div>

                        </div>

                        {/* Visual Multi-Column Chart */}
                        <div className="mt-2.5">

                          <div className="w-full h-44 flex items-end justify-between gap-1.5 sm:gap-2 pt-6 pb-2 px-1 border-b border-slate-200 bg-white rounded-xl p-3 border">
                            {sources.map((s) => {
                              const heightPct = s.amount > 0 ? Math.max(14, Math.min(100, Math.round(Math.pow(s.amount / maxVal, 0.45) * 100))) : 4
                              const pctOfIn = m.totalIn > 0 ? Math.round((s.amount / m.totalIn) * 100) : 0

                              return (
                                <div key={s.id} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                                  {/* Amount label on top */}
                                  <span className={`text-[9px] sm:text-[10px] font-mono font-bold text-center leading-none ${s.amount > 0 ? s.textClass : 'text-slate-400'}`}>
                                    {s.amount >= 1_000_000
                                      ? `${(s.amount / 1_000_000).toFixed(1)}M`
                                      : s.amount >= 1_000
                                      ? `${(s.amount / 1_000).toFixed(0)}k`
                                      : s.amount > 0
                                      ? `${s.amount}`
                                      : '0'}
                                  </span>

                                  {/* Vertical Bar */}
                                  <div
                                    className={`w-full max-w-[28px] sm:max-w-[36px] rounded-t-md transition-all duration-300 group-hover:scale-105 cursor-pointer ${s.bgClass} ${
                                      s.type === 'OUT' ? 'ring-1 ring-purple-400' : ''
                                    }`}
                                    style={{ height: `${heightPct}%` }}
                                    title={`${s.label}: ${formatVnd(s.amount)} (${pctOfIn}% ${tr('tổng vào', 'of inflow')})`}
                                  />

                                  {/* Icon & Label below */}
                                  <div className="flex flex-col items-center">
                                    <span className="material-symbols-outlined text-[13px] text-slate-500">{s.icon}</span>
                                    <span className="text-[9px] sm:text-[10px] text-slate-600 font-semibold truncate max-w-[46px] text-center" title={s.label}>
                                      {s.shortLabel}
                                    </span>
                                  </div>
                                </div>
                              )
                            })}

                            {/* Dòng tiền ròng (Net) Bar */}
                            <div className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group border-l border-slate-200 pl-1">
                              <span className={`text-[9px] sm:text-[10px] font-mono font-extrabold text-center leading-none ${m.netCashFlow >= 0 ? 'text-indigo-700' : 'text-rose-700'}`}>
                                {Math.abs(m.netCashFlow) >= 1_000_000
                                  ? `${(m.netCashFlow / 1_000_000).toFixed(1)}M`
                                  : `${(m.netCashFlow / 1_000).toFixed(0)}k`}
                              </span>
                              <div
                                className={`w-full max-w-[28px] sm:max-w-[36px] rounded-t-md transition-all duration-300 group-hover:scale-105 cursor-pointer ${
                                  m.netCashFlow >= 0 ? 'bg-indigo-600' : 'bg-rose-600'
                                }`}
                                style={{ height: `${Math.max(14, Math.min(100, Math.round(Math.pow(Math.abs(m.netCashFlow) / maxVal, 0.45) * 100)))}%` }}
                                title={`${tr('Dòng tiền ròng thực nhận:', 'Net Cash Flow:')} ${formatVnd(m.netCashFlow)}`}
                              />
                              <div className="flex flex-col items-center">
                                <span className="material-symbols-outlined text-[13px] text-indigo-600">account_balance</span>
                                <span className="text-[9px] sm:text-[10px] text-indigo-700 font-bold truncate max-w-[46px] text-center">
                                  {tr('Ròng', 'Net')}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Breakdown 6-cell Matrix - 6 thẻ theo đúng thứ tự 1 -> 6 */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-2 text-xs">
                          {/* 1. Doanh thu thuần */}
                          <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
                            <div>
                              <div className="flex items-center justify-between gap-1 mb-1">
                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{tr('1. Doanh thu thuần', '1. Net Revenue')}</span>
                                <span className="material-symbols-outlined text-[16px] text-emerald-600">account_balance_wallet</span>
                              </div>
                              <span className="font-mono font-bold text-emerald-700 text-sm block">{formatVnd(m.netRevenue)}</span>
                              <span className="text-[10px] text-slate-400 block mt-0.5 leading-tight">{tr('Đã trừ hoàn tiền hợp lệ; không tính cọc & giữ chỗ', 'Deducted valid refunds; excludes deposits')}</span>
                            </div>
                            <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-emerald-700 font-semibold">
                              <span>{tr('Ghi nhận kỳ:', 'Period status:')}</span>
                              <span className="bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                {m.netRevenue > 0 ? `${Math.round(((m.rental + m.renewal) / m.netRevenue) * 100)}% ${tr('thuê kho', 'unit rental')}` : '100%'}
                              </span>
                            </div>
                          </div>

                          {/* 2. Tiền thực thu */}
                          <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
                            <div>
                              <div className="flex items-center justify-between gap-1 mb-1">
                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{tr('2. Tiền thực thu', '2. Total Cash-In')}</span>
                                <span className="material-symbols-outlined text-[16px] text-blue-600">payments</span>
                              </div>
                              <span className="font-mono font-bold text-blue-700 text-sm block">{formatVnd(m.totalIn)}</span>
                              <span className="text-[10px] text-slate-400 block mt-0.5 leading-tight">{tr('Tổng tiền thực nhận từ các giao dịch PAID', 'Total cash received across verified payments')}</span>
                            </div>
                            <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-600 font-medium">
                              <span>{tr('Số giao dịch:', 'Payments:')}</span>
                              <span className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.2 rounded">
                                {m.paymentCount} {tr('GD', 'txns')}
                              </span>
                            </div>
                          </div>

                          {/* 3. Tiền thuê kho */}
                          <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
                            <div>
                              <div className="flex items-center justify-between gap-1 mb-1">
                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{tr('3. Tiền thuê kho', '3. Rental Revenue')}</span>
                                <span className="material-symbols-outlined text-[16px] text-amber-600">warehouse</span>
                              </div>
                              <span className="font-mono font-bold text-amber-700 text-sm block">{formatVnd(m.rental + m.renewal)}</span>
                              <span className="text-[10px] text-slate-400 block mt-0.5 leading-tight">{tr('Doanh thu cho thuê kho & tái ký trong kỳ', 'Storage rental fees & renewed contract cycles')}</span>
                            </div>
                            <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-600 font-medium">
                              <span>{tr('Tái ký:', 'Renewals:')}</span>
                              <span className="font-mono font-bold text-emerald-600">
                                {formatVnd(m.renewal)}
                              </span>
                            </div>
                          </div>

                          {/* 4. Công nợ phải thu */}
                          <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
                            <div>
                              <div className="flex items-center justify-between gap-1 mb-1">
                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{tr('4. Công nợ phải thu', '4. Overdue Debt')}</span>
                                <span className="material-symbols-outlined text-[16px] text-rose-600">gavel</span>
                              </div>
                              <span className="font-mono font-bold text-rose-600 text-sm block">{formatVnd(totalOverdueDebt)}</span>
                              <span className="text-[10px] text-slate-400 block mt-0.5 leading-tight">{tr('Nợ cước thuê kho quá hạn chưa thu hồi', 'Overdue storage rental fees pending collection')}</span>
                            </div>
                            <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-rose-700 font-semibold">
                              <span>{tr('Khóa kho / Niêm phong:', 'Blocked / Sealing:')}</span>
                              <span className="font-mono bg-rose-50 px-1.5 py-0.2 rounded text-rose-800 border border-rose-200">
                                {debtBreakdown.accessBlockedCount + debtBreakdown.eligibleForSealingCount} {tr('kho', 'units')}
                              </span>
                            </div>
                          </div>

                          {/* 5. Tiền cọc đang giữ */}
                          <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
                            <div>
                              <div className="flex items-center justify-between gap-1 mb-1">
                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{tr('5. Tiền cọc đang giữ', '5. Deposits Held')}</span>
                                <span className="material-symbols-outlined text-[16px] text-cyan-600">lock</span>
                              </div>
                              <span className="font-mono font-bold text-cyan-700 text-sm block">{formatVnd(depositsHeld)}</span>
                              <span className="text-[10px] text-slate-400 block mt-0.5 leading-tight">{tr('Nghĩa vụ hoàn trả / quyết toán khi trả kho', 'Payable obligation awaiting checkout settlement')}</span>
                            </div>
                            <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-cyan-800 font-semibold">
                              <span>{tr('Hợp đồng ACTIVE:', 'Active contracts:')}</span>
                              <span className="font-mono bg-cyan-50 px-1.5 py-0.2 rounded text-cyan-800 border border-cyan-200">
                                {activeContractsCount !== null ? `${activeContractsCount} ${tr('HĐ', 'contracts')}` : '—'}
                              </span>
                            </div>
                          </div>

                          {/* 6. Hoàn tiền & Chờ XL */}
                          <div className="p-2.5 rounded-xl bg-purple-50/50 border border-purple-200/90 shadow-2xs flex flex-col justify-between">
                            <div>
                              <div className="flex items-center justify-between gap-1 mb-1">
                                <span className="text-[10px] text-purple-700 font-bold uppercase tracking-wider">{tr('6. Hoàn tiền & Chờ XL', '6. Refunds & Pending')}</span>
                                <span className="material-symbols-outlined text-[16px] text-purple-600">assignment_return</span>
                              </div>
                              <span className="font-mono font-bold text-purple-700 text-sm block">{formatVnd(m.refund > 0 ? m.refund : refundedAmount)}</span>
                              <span className="text-[10px] text-purple-600/80 block mt-0.5 leading-tight">{tr('Đã hoàn tiền thực tế thành công cho khách', 'Successfully refunded to customers')}</span>
                            </div>
                            <div className="mt-2 pt-1.5 border-t border-purple-200/60 flex items-center justify-between text-[10px] text-purple-800 font-semibold">
                              <span>{tr('Chờ duyệt/chuyển:', 'Pending review:')}</span>
                              <span className="font-mono bg-white px-1.5 py-0.2 rounded text-purple-800 border border-purple-200">
                                {formatVnd(pendingRefundAmount)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="w-full h-48 flex items-center justify-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  {isReportsLoading
                    ? tr('Đang tải dữ liệu biểu đồ doanh thu...', 'Loading revenue chart data...')
                    : tr('Không có giao dịch doanh thu hay dòng tiền nào trong kỳ đã chọn.', 'No revenue or cash flow transactions in selected period.')}
                </div>
              )}
            </div>

            {/* Footer Summary of Period */}
            <div className="mt-4 p-3 bg-slate-50 rounded-xl flex flex-wrap items-center justify-between gap-3 border border-slate-200 text-xs">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-medium text-slate-600">
                <span>{tr('Kỳ báo cáo:', 'Report Period:')} <strong className="text-slate-900">{periodLabel}</strong></span>
                <span>•</span>
                <span>{tr('Tổng thực thu (Vào):', 'Total Inflow:')} <strong className="text-blue-700 font-mono">+{formatVnd(totalCashIn)}</strong></span>
                <span>•</span>
                <span>{tr('Tổng hoàn trả (Ra):', 'Total Outflow:')} <strong className="text-purple-700 font-mono">-{formatVnd(refundedAmount)}</strong></span>
              </div>
              <div className="font-mono font-bold text-slate-900">
                {tr('Tổng doanh thu thuần kỳ:', 'Period Net Revenue:')} <span className="text-sm text-emerald-700 font-extrabold">{formatVnd(netRevenue)}</span>
              </div>
            </div>
          </div>

          {/* Biểu đồ 2: Cơ cấu tiền thực thu (Donut) (4 cols) - Sát cạnh Donut Chart dù Biểu đồ 1 dài */}
          <div className={`${isChart1Expanded ? 'hidden' : 'lg:col-span-4'} bg-white rounded-2xl p-6 shadow-md border border-slate-200/90 flex flex-col self-start lg:sticky lg:top-6 transition-all duration-300`}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">{tr('Biểu đồ 2: Cơ cấu tiền thực thu', 'Chart 2: Cash-In Structure')}</h2>
                <p className="text-xs text-slate-500 mt-0.5">{tr('Phân loại các luồng tiền thực tế đã thu', 'Actual cash inflow categories')}</p>
              </div>
            </div>

            {/* Donut Chart Display */}
            <div className="relative flex items-center justify-center my-4">
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
                <span className="text-lg font-black font-mono text-blue-700 mt-0.5">
                  {totalCashIn >= 1_000_000 ? `${(totalCashIn / 1_000_000).toFixed(1)}M ₫` : formatVnd(totalCashIn)}
                </span>
                <span className="text-[11px] font-semibold text-slate-500">{paymentCount} {tr('giao dịch', 'payments')}</span>
              </div>
            </div>

            {/* List breakdown - Ngay sát bên dưới Donut Chart */}
            <div className="space-y-1.5 text-xs mt-1">
              {cashInBreakdown.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="flex items-center gap-2 font-medium text-slate-700">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }}></span>
                    {item.label}
                  </span>
                  <div className="flex items-center gap-2 font-mono">
                    <span className={`font-bold ${item.textClass || 'text-slate-900'}`}>{formatVnd(item.amount)}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 font-bold">{item.pct}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 4. CHARTS ROW 2: DOANH THU THEO CƠ SỞ & KÊNH THANH TOÁN */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Biểu đồ 3: Doanh thu theo cơ sở (8 cols) */}
          <div className="lg:col-span-8 bg-white rounded-2xl p-6 shadow-md border border-slate-200/90">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-cyan-600 text-[22px]">apartment</span>
                  <h2 className="text-base font-bold text-slate-900">{tr('Biểu đồ 3: Doanh thu theo cơ sở', 'Chart 3: Revenue by Facility')}</h2>
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
                    facilityRows.map((f) => {
                      const isFiltering = selectedFacilityId === f.id
                      return (
                        <tr
                          key={f.id}
                          className={`transition-all ${
                            isFiltering
                              ? 'bg-cyan-50/80 border-l-4 border-l-cyan-600 font-semibold shadow-xs'
                              : 'hover:bg-slate-50/70'
                          }`}
                        >
                          <td className="py-3.5 px-4">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-900">{f.name}</span>
                              <span className="text-[11px] text-slate-500 font-mono">
                                {f.code} · {f.occupiedUnits}/{f.totalUnits} {tr('kho đang thuê', 'occupied')}
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-3 text-right font-mono font-extrabold text-emerald-700">
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
                            {isFiltering ? (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-100/90 border border-cyan-300 text-cyan-800 font-bold text-[11px] shadow-xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-cyan-600 animate-pulse"></span>
                                <span>{tr('Đang lọc', 'Active')}</span>
                                <button
                                  type="button"
                                  title={tr('Bỏ lọc cơ sở này', 'Clear filter')}
                                  onClick={() => {
                                    setSelectedFacilityId('all')
                                    if (setSelectedFacility) setSelectedFacility('all')
                                  }}
                                  className="ml-1 text-cyan-700 hover:text-cyan-950 font-extrabold cursor-pointer"
                                >
                                  ×
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedFacilityId(f.id)
                                  if (setSelectedFacility) setSelectedFacility(f.id)
                                }}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition-colors cursor-pointer shadow-xs"
                              >
                                {tr('Lọc', 'Filter')}
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })
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

          {/* Biểu đồ 4: Kênh thanh toán (4 cols) */}
          <div className="lg:col-span-4 bg-white rounded-2xl p-6 shadow-md border border-slate-200/90 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h2 className="text-base font-bold text-slate-900">{tr('Biểu đồ 4: Kênh thanh toán', 'Chart 4: Payment Methods')}</h2>
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
                const cashVal = channelMetric === 'COUNT' ? paymentMethodStats.cash.count : channelMetric === 'AMOUNT' ? paymentMethodStats.cash.amount : paymentMethodStats.cash.reconciled
                const otherVal = channelMetric === 'COUNT' ? paymentMethodStats.other.count : channelMetric === 'AMOUNT' ? paymentMethodStats.other.amount : paymentMethodStats.other.reconciled

                const vnpayPct = total > 0 ? Math.round((vnpayVal / total) * 1000) / 10 : 0
                const bankPct = total > 0 ? Math.round((bankVal / total) * 1000) / 10 : 0
                const cashPct = total > 0 ? Math.round((cashVal / total) * 1000) / 10 : 0
                const otherPct = total > 0 ? Math.round((otherVal / total) * 1000) / 10 : 0
                const circumference = 389.5

                return (
                  <div>
                    <div className="relative flex items-center justify-center my-4">
                      <svg className="w-40 h-40 -rotate-90" viewBox="0 0 160 160">
                        <circle className="text-slate-100" cx="80" cy="80" fill="transparent" r="62" stroke="currentColor" strokeWidth="15"></circle>
                        {vnpayPct > 0 && (
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
                        )}
                        {bankPct > 0 && (
                          <circle
                            cx="80"
                            cy="80"
                            fill="transparent"
                            r="62"
                            stroke="#0891b2"
                            strokeDasharray={`${(circumference * bankPct) / 100} ${circumference}`}
                            strokeDashoffset={-((circumference * vnpayPct) / 100)}
                            strokeWidth="15"
                          />
                        )}
                        {cashPct > 0 && (
                          <circle
                            cx="80"
                            cy="80"
                            fill="transparent"
                            r="62"
                            stroke="#059669"
                            strokeDasharray={`${(circumference * cashPct) / 100} ${circumference}`}
                            strokeDashoffset={-((circumference * (vnpayPct + bankPct)) / 100)}
                            strokeWidth="15"
                          />
                        )}
                        {otherPct > 0 && (
                          <circle
                            cx="80"
                            cy="80"
                            fill="transparent"
                            r="62"
                            stroke="#94a3b8"
                            strokeDasharray={`${(circumference * otherPct) / 100} ${circumference}`}
                            strokeDashoffset={-((circumference * (vnpayPct + bankPct + cashPct)) / 100)}
                            strokeWidth="15"
                          />
                        )}
                      </svg>
                      <div className="absolute flex flex-col items-center justify-center text-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          {channelMetric === 'COUNT' ? tr('Tổng giao dịch', 'Total count') : tr('Tổng giá trị', 'Total value')}
                        </span>
                        <span className={`text-base font-black font-mono mt-0.5 ${channelMetric === 'COUNT' ? 'text-slate-900' : 'text-blue-700'}`}>
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
                          <span className="font-bold text-blue-700">
                            {channelMetric === 'COUNT' ? `${vnpayVal} ${tr('GD', 'txns')}` : formatVnd(vnpayVal)}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 font-bold">{vnpayPct}%</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="flex items-center gap-2 font-semibold text-slate-800">
                          <span className="h-2.5 w-2.5 rounded-full bg-cyan-600"></span>
                          {tr('Chuyển khoản (Tại quầy)', 'Bank Transfer (Counter)')}
                        </span>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="font-bold text-cyan-700">
                            {channelMetric === 'COUNT' ? `${bankVal} ${tr('GD', 'txns')}` : formatVnd(bankVal)}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-100 text-cyan-800 font-bold">{bankPct}%</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="flex items-center gap-2 font-semibold text-slate-800">
                          <span className="h-2.5 w-2.5 rounded-full bg-emerald-600"></span>
                          {tr('Tiền mặt (Tại quầy)', 'Cash (Counter)')}
                        </span>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="font-bold text-emerald-700">
                            {channelMetric === 'COUNT' ? `${cashVal} ${tr('GD', 'txns')}` : formatVnd(cashVal)}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold">{cashPct}%</span>
                        </div>
                      </div>

                      {otherVal > 0 && (
                        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200">
                          <span className="flex items-center gap-2 font-medium text-slate-500">
                            <span className="h-2.5 w-2.5 rounded-full bg-slate-400"></span>
                            {tr('Kênh khác', 'Other Channels')}
                          </span>
                          <span className="font-mono font-bold text-slate-700">
                            {channelMetric === 'COUNT' ? `${otherVal} ${tr('GD', 'txns')}` : formatVnd(otherVal)}
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
        <div className="bg-white rounded-2xl p-6 shadow-md border border-slate-200/90 space-y-4">
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
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleExportTableExcel}
                  title={tr('Xuất bảng giao dịch này ra Excel chuẩn tiếng Việt', 'Export transaction table to Excel')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">table_view</span>
                  {tr('Xuất Excel', 'Export Excel')}
                </button>
                <button
                  type="button"
                  onClick={handleExportTableCsv}
                  title={tr('Xuất bảng này ra CSV', 'Export Table CSV')}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all border border-slate-200 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px] text-slate-500">csv</span>
                  {tr('CSV', 'CSV')}
                </button>
              </div>
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
                <option value="RETURN_COMPENSATION">{tr('Bồi thường trả kho', 'Return Compensation')}</option>
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
                <option value="ALL">{tr('Tất cả kênh TT', 'All Payment Methods')}</option>
                <option value="VNPAY">VNPay</option>
                <option value="BANK_TRANSFER">{tr('Chuyển khoản NH', 'Bank Transfer')}</option>
                <option value="CASH">{tr('Tiền mặt', 'Cash')}</option>
                <option value="DEPOSIT_DEDUCTION">{tr('Khấu trừ tiền cọc', 'Deposit Deduction')}</option>
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
                          {(() => {
                            const methodBadge = getPaymentMethodBadge(p.paymentMethod)
                            return (
                              <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold border ${methodBadge.bg}`}>
                                {language === 'vi' ? methodBadge.labelVi : methodBadge.labelEn}
                              </span>
                            )
                          })()}
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
                    {(() => {
                      const badge = getPaymentMethodBadge(selectedPaymentDetail.paymentMethod)
                      return (
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold border ${badge.bg}`}>
                          {language === 'vi' ? badge.labelVi : badge.labelEn}
                        </span>
                      )
                    })()}
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
                    <span className="font-semibold text-slate-800">{selectedPaymentDetail.confirmedByName || selectedPaymentDetail.collectedByName || tr('Hệ thống', 'System')}</span>
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
