import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useOutletContext, useNavigate } from 'react-router-dom'
import { overdueService, OverdueSummary, OverdueContractItem, OverdueSettlementPayload } from '../../services/overdueService'
import { facilityService } from '../../services/facilityService'
import { useAuth } from '../../context/AuthContext'
import { useRealtimeSync } from '../../hooks/useRealtimeSync'
import { Facility } from '../../types'
import { OverdueContractDetailModal } from './modals/OverdueContractDetailModal'
import { toast } from '../../utils/toast'
import { useLanguage } from '../../context/LanguageContext'

const formatSettledTime = (timeVal?: string | null, fallbackDate?: string | null): string => {
  if (timeVal && typeof timeVal === 'string' && timeVal.trim() && timeVal.trim() !== 'Vừa xong') {
    return timeVal.trim()
  }
  if (fallbackDate) {
    try {
      const d = new Date(fallbackDate)
      if (!isNaN(d.getTime())) {
        const hh = String(d.getHours()).padStart(2, '0')
        const mm = String(d.getMinutes()).padStart(2, '0')
        const dd = String(d.getDate()).padStart(2, '0')
        const MM = String(d.getMonth() + 1).padStart(2, '0')
        const yyyy = d.getFullYear()
        return `${hh}:${mm} ${dd}/${MM}/${yyyy}`
      }
    } catch {}
  }
  const now = new Date()
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const MM = String(now.getMonth() + 1).padStart(2, '0')
  const yyyy = now.getFullYear()
  return `${hh}:${mm} ${dd}/${MM}/${yyyy}`
}

export const OverdueManagementPage: React.FC = () => {
  const { user } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const { selectedFacility: contextFacilityId, facilities: contextFacilities } = useOutletContext<{
    selectedFacility?: string
    facilities?: Facility[]
  }>() || {}

  const [facilities, setFacilities] = useState<Facility[]>([])
  const [selectedFacilityFilter, setSelectedFacilityFilter] = useState<string>('ALL')
  const [summary, setSummary] = useState<OverdueSummary | null>(null)
  const [contracts, setContracts] = useState<OverdueContractItem[]>([])
  const [totalElements, setTotalElements] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [currentPage, setCurrentPage] = useState(0)
  const pageSize = 8

  const [isLoading, setIsLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStage, setFilterStage] = useState<'ALL' | 'GRACE_PERIOD' | 'WARNING' | 'PIN_REVOCATION' | 'SEALING_ELIGIBLE' | 'SETTLED' | 'POLICY_UNCONFIGURED'>('ALL')
  const [pinStatusFilter, setPinStatusFilter] = useState<string>('ALL')
  const [sealingStatusFilter, setSealingStatusFilter] = useState<string>('ALL')
  const [isDemoFilter, setIsDemoFilter] = useState<boolean | undefined>(undefined)

  // Khách đã tới hoàn tất - State & Local Persistence
  const [isCustomerArrivalMode, setIsCustomerArrivalMode] = useState<boolean>(false)
  const [contractToSettle, setContractToSettle] = useState<OverdueContractItem | null>(null)
  const [isSettling, setIsSettling] = useState<boolean>(false)
  // Form state cho modal Tất toán nợ cước
  const [settlementPaymentMethod, setSettlementPaymentMethod] = useState<'CASH' | 'BANK_TRANSFER'>('CASH')
  const [settlementReceiptCode, setSettlementReceiptCode] = useState<string>('')
  const [settlementAmount, setSettlementAmount] = useState<number>(0)
  const [settlementRefCode, setSettlementRefCode] = useState<string>('')
  const [settlementProofUrl, setSettlementProofUrl] = useState<string>('')
  const [settlementNotes, setSettlementNotes] = useState<string>('')
  const [settlementFormErrors, setSettlementFormErrors] = useState<Record<string, string>>({})

  // Reset form khi chọn hợp đồng tất toán mới
  useEffect(() => {
    if (contractToSettle) {
      setSettlementPaymentMethod('CASH')
      const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      const codeSuffix = (contractToSettle.contractCode || 'HD').replace(/[^a-zA-Z0-9]/g, '').slice(-4)
      setSettlementReceiptCode(`PT-${todayStr}-${codeSuffix}`)
      setSettlementAmount(contractToSettle.totalDebt || 0)
      setSettlementRefCode('')
      setSettlementProofUrl('')
      setSettlementNotes('')
      setSettlementFormErrors({})
    }
  }, [contractToSettle])
  const [settledContracts, setSettledContracts] = useState<Array<OverdueContractItem & { settledAt: string; settledByName?: string }>>(() => {
    try {
      const raw = localStorage.getItem('boxora_settled_overdue_contracts')
      if (!raw) return []
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed.map((item: any) => ({
          ...item,
          settledAt: formatSettledTime(item.settledAt, item.dueDate || item.startDate)
        }))
      }
      return []
    } catch {
      return []
    }
  })

  // User role
  const rawRole = (user?.role as any)?.name || (user?.role as any) || ''
  const userRole = String(rawRole).replace(/^ROLE_/, '')
  const isBusinessManager = userRole === 'BUSINESS_MANAGER'

  // Detail Modal
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null)
  const [modalInitialTab, setModalInitialTab] = useState<'debt' | 'smartlock' | 'sealing' | 'notices' | 'payments' | 'audit'>('debt')
  const [modalDirectInventory, setModalDirectInventory] = useState(false)

  // Facilities loading
  useEffect(() => {
    if (contextFacilities && contextFacilities.length > 0) {
      setFacilities(contextFacilities)
      return
    }
    const loadFacilities = async () => {
      try {
        const res = await facilityService.getFacilities()
        const facs = res?.content || []
        setFacilities(facs)
      } catch (err) {
        console.warn('Failed to load facilities:', err)
      }
    }
    loadFacilities()
  }, [contextFacilities])

  const isFacilityScoped = user?.role?.name === 'FACILITY_MANAGER' || user?.role?.name === 'STAFF'
  const activeFacilityId = useMemo(() => {
    if (isFacilityScoped && user?.facilityId) {
      return user.facilityId
    }
    if (selectedFacilityFilter && selectedFacilityFilter !== 'ALL') {
      return selectedFacilityFilter
    }
    return contextFacilityId && contextFacilityId !== 'ALL' ? contextFacilityId : undefined
  }, [isFacilityScoped, user?.facilityId, selectedFacilityFilter, contextFacilityId])

  // Fetch KPI Summary
  const fetchSummary = useCallback(async () => {
    try {
      const data = await overdueService.getSummary(activeFacilityId)
      setSummary(data)
    } catch (err) {
      console.warn('Failed to load overdue summary:', err)
      setSummary(null)
    }
  }, [activeFacilityId])

  // Fetch Paginated Contracts
  const fetchContracts = useCallback(async (silent?: unknown) => {
    if (silent !== true) setIsLoading(true)
    try {
      const res = await overdueService.getContracts({
        facilityId: activeFacilityId,
        stage: filterStage !== 'ALL' ? filterStage : undefined,
        pinStatus: pinStatusFilter !== 'ALL' ? pinStatusFilter : undefined,
        sealingStatus: sealingStatusFilter !== 'ALL' ? sealingStatusFilter : undefined,
        searchTerm: searchTerm.trim() || undefined,
        isDemo: isDemoFilter,
        page: currentPage,
        size: pageSize
      })
      if (filterStage === 'SETTLED') {
        const backendItems = res?.content || []
        setContracts(backendItems)
        setSettledContracts(prev => {
          let changed = false
          const map = new Map(prev.map(p => [p.contractId, p]))
          backendItems.forEach((b: any) => {
            if (!map.has(b.contractId)) {
              map.set(b.contractId, b)
              changed = true
            }
          })
          if (!changed) return prev
          const merged = Array.from(map.values())
          try {
            localStorage.setItem('boxora_settled_overdue_contracts', JSON.stringify(merged))
          } catch {}
          return merged
        })
        setTotalElements(res?.totalElements || backendItems.length)
        setTotalPages(res?.totalPages || 1)
      } else {
        setContracts(res?.content || [])
        setTotalElements(res?.totalElements || 0)
        setTotalPages(res?.totalPages || 1)
      }
    } catch (err) {
      console.warn('Failed to load overdue contracts:', err)
      if (filterStage !== 'SETTLED') {
        setContracts([])
        setTotalElements(0)
      }
    } finally {
      setIsLoading(false)
    }
  }, [activeFacilityId, filterStage, pinStatusFilter, sealingStatusFilter, searchTerm, isDemoFilter, currentPage, pageSize])

  const settledIds = useMemo(() => new Set(settledContracts.map(s => s.contractId)), [settledContracts])

  // Lọc danh sách hợp đồng hiển thị trên table
  const displayedContracts = useMemo(() => {
    if (filterStage === 'SETTLED') {
      const map = new Map<string, any>()
      contracts.forEach(c => map.set(c.contractId, c))
      settledContracts.forEach(s => {
        if (!map.has(s.contractId)) {
          map.set(s.contractId, s)
        }
      })
      const list = Array.from(map.values())
      return list.filter(item => {
        if (activeFacilityId && item.facilityId && item.facilityId !== activeFacilityId) {
          return false
        }
        if (searchTerm.trim()) {
          const term = searchTerm.trim().toLowerCase()
          return (
            (item.contractCode && item.contractCode.toLowerCase().includes(term)) ||
            (item.unitCode && item.unitCode.toLowerCase().includes(term)) ||
            (item.customerName && item.customerName.toLowerCase().includes(term)) ||
            (item.customerPhone && item.customerPhone.includes(term))
          )
        }
        return true
      })
    }
    return contracts.filter(c => !settledIds.has(c.contractId))
  }, [filterStage, contracts, settledContracts, settledIds, activeFacilityId, searchTerm])

  const handleConfirmSettlement = async () => {
    if (!contractToSettle) return

    const remainingDebt = contractToSettle.totalDebt || 0
    const depositHeldVal = contractToSettle.depositHeld || 0
    const lateFeeVal = contractToSettle.lateFee || 0
    const principalVal = contractToSettle.principalDebt || 0
    const refundVal = contractToSettle.customerRefundAmount !== undefined && contractToSettle.customerRefundAmount !== null
      ? contractToSettle.customerRefundAmount
      : Math.max(0, depositHeldVal - (principalVal + lateFeeVal))

    setIsSettling(true)
    try {
      const cleanVoucher = `PT-${contractToSettle.contractCode.replace(/[^A-Za-z0-9]/g, '')}-${Date.now().toString().slice(-4)}`
      const payload: OverdueSettlementPayload | undefined = remainingDebt > 0 ? {
        paymentMethod: 'CASH',
        receiptVoucherCode: cleanVoucher,
        amount: Number(remainingDebt),
        notes: `Khách hàng thanh toán phần nợ cước còn thiếu tại quầy (${formatVND(remainingDebt)})`
      } : undefined

      await overdueService.completeSettlement(contractToSettle.contractId, payload)

      const now = new Date()
      const hh = String(now.getHours()).padStart(2, '0')
      const mm = String(now.getMinutes()).padStart(2, '0')
      const dd = String(now.getDate()).padStart(2, '0')
      const MM = String(now.getMonth() + 1).padStart(2, '0')
      const yyyy = now.getFullYear()
      const nowStr = `${hh}:${mm} ${dd}/${MM}/${yyyy}`

      const newSettledItem = {
        ...contractToSettle,
        settledAt: nowStr,
        settledByName: user?.fullName || 'Quản lý cơ sở'
      }

      const updated = [newSettledItem, ...settledContracts.filter(s => s.contractId !== contractToSettle.contractId)].map(s => ({
        ...s,
        settledAt: formatSettledTime(s.settledAt, (s as any).dueDate || (s as any).startDate)
      }))
      setSettledContracts(updated)
      try {
        localStorage.setItem('boxora_settled_overdue_contracts', JSON.stringify(updated))
        window.dispatchEvent(new Event('storage'))
      } catch (lsErr) {
        console.warn('Failed to save settled contracts to localStorage:', lsErr)
      }

      if (refundVal > 0) {
        toast.success(`Đã hoàn tất trả kho buồng #${contractToSettle.unitCode}! Boxora đã hoàn trả ${formatVND(refundVal)} tiền cọc cho khách hàng ${contractToSettle.customerName}.`)
      } else if (remainingDebt > 0) {
        toast.success(`Đã hoàn tất trả kho buồng #${contractToSettle.unitCode}! Đã thu ${formatVND(remainingDebt)} và tất toán hợp đồng thành công.`)
      } else {
        toast.success(`Đã hoàn tất đơn nợ cước buồng #${contractToSettle.unitCode}! Hợp đồng đã tất toán & trả kho thành công.`)
      }
      setContractToSettle(null)
      fetchSummary()
      fetchContracts()
    } catch (err: any) {
      const backendMessage = err?.response?.data?.message || err?.message || 'Lỗi khi hoàn tất đơn nợ cước'
      toast.error(backendMessage)
    } finally {
      setIsSettling(false)
    }
  }

  useEffect(() => {
    void fetchSummary()
  }, [fetchSummary])

  useEffect(() => {
    void fetchContracts(false)
  }, [fetchContracts])

  useRealtimeSync(() => {
    void fetchSummary()
    void fetchContracts(true)
  }, { intervalMs: 5000 })

  const handleRefreshAll = () => {
    fetchSummary()
    fetchContracts()
  }

  const handleExportCsv = async () => {
    try {
      await overdueService.exportCsv(activeFacilityId, filterStage !== 'ALL' ? filterStage : undefined, searchTerm)
      toast.success('Đã xuất file báo cáo công nợ CSV thành công!')
    } catch (err: any) {
      toast.error('Lỗi khi xuất file báo cáo CSV')
    }
  }

  const formatVND = (num?: number | null) => {
    if (num == null) return '0 ₫'
    const safe = Math.max(0, Math.round(Number(num) || 0))
    return `${safe.toLocaleString('vi-VN')} ₫`
  }

  const formatNumber = (num?: number | null) => {
    if (num == null) return '0'
    const safe = Math.max(0, Math.round(Number(num) || 0))
    return safe.toLocaleString('vi-VN')
  }

  return (
    <div className="flex flex-col gap-6 w-full text-left pb-12">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[28px]">gavel</span>
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-slate-900">
                {t('Xử Lý Nợ Cước Quá Hạn & Thu Hồi PIN/QR', 'Overdue Delinquency & Access Revocation')}
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {t('Theo dõi chu kỳ quá hạn (+1 ngày ân hạn, +3 ngày thu hồi PIN SmartLock, +7 ngày xem xét niêm phong kho & kiểm kê)', 'Track overdue cycle (+1 grace day, +3 PIN revocation days, +7 sealing & inventory review days)')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-end md:self-auto">
          <button
            type="button"
            onClick={handleExportCsv}
            className="px-4 py-2 bg-white text-slate-700 text-xs font-bold rounded-xl border border-slate-300 hover:bg-slate-50 shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px] text-slate-500">download</span>
            {t('Xuất Báo Cáo CSV', 'Export CSV Report')}
          </button>
          <button
            type="button"
            onClick={handleRefreshAll}
            className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">sync</span>
            {t('Làm Mới', 'Refresh')}
          </button>
        </div>
      </div>

      {/* KPI Dashboard Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {/* Card 1: Total Overdue Debt */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('Tổng Công Nợ Quá Hạn', 'Total Overdue Delinquency')}</span>
              <span className="p-1.5 rounded-lg bg-rose-50 text-rose-600 border border-rose-100 material-symbols-outlined text-[20px]">
                attach_money
              </span>
            </div>
            <p className="text-2xl font-black text-rose-600 mt-2">
              {formatVND(summary?.totalOverdueDebt)}
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col gap-1 text-[11px] text-slate-500">
            <div className="flex justify-between">
              <span>{t('Phí phạt tích lũy:', 'Accrued late fees:')}</span>
              <span className="font-bold text-rose-700">{formatVND(summary?.totalLateFees)}</span>
            </div>
            {summary && summary.unverifiedPaymentsAmount > 0 && (
              <div className="flex justify-between text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                <span>{t('Chờ đối soát', 'Pending reconciliation')} ({summary.unverifiedPaymentsCount} {t('đơn', 'orders')}):</span>
                <span className="font-bold">{formatVND(summary.unverifiedPaymentsAmount)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Total Deposit Refund */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('Tổng Tiền Cọc Cần Hoàn', 'Total Deposit to Refund')}</span>
              <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 material-symbols-outlined text-[20px]">
                account_balance_wallet
              </span>
            </div>
            <p className="text-2xl font-black text-emerald-600 mt-2">
              {formatVND(summary?.totalCustomerRefundAmount)}
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col gap-1 text-[11px] text-slate-500">
            <div className="flex justify-between">
              <span>{t('Tổng tiền cọc giữ:', 'Total deposit held:')}</span>
              <span className="font-bold text-slate-800">{formatVND(summary?.totalDepositHeld)}</span>
            </div>
            <div className="flex justify-between">
              <span>{t('Đã cấn trừ phí phạt:', 'Late fees deducted:')}</span>
              <span className="font-bold text-rose-600">
                -{formatVND(Math.max(0, (summary?.totalDepositHeld ?? 0) - (summary?.totalCustomerRefundAmount ?? 0)))}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Total Overdue Contracts */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('Tổng Hợp Đồng Quá Hạn', 'Total Overdue Contracts')}</span>
              <span className="p-1.5 rounded-lg bg-slate-50 text-slate-600 border border-slate-200 material-symbols-outlined text-[20px]">
                description
              </span>
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2">
              {summary?.totalOverdueContracts ?? 0} <span className="text-xs font-medium text-slate-500">{t('hợp đồng', 'contracts')}</span>
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col gap-1 text-[11px] text-slate-500">
            <div className="flex justify-between">
              <span>{t('Ân hạn miễn phạt:', 'Grace period (no fine):')}</span>
              <span className="font-bold text-emerald-700">{summary?.graceCount ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span>{t('Cảnh báo quá hạn:', 'Overdue warning:')}</span>
              <span className="font-bold text-amber-700">{summary?.warningCount ?? 0}</span>
            </div>
          </div>
        </div>

        {/* Card 4: PIN Revocation Threshold */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('Ngưỡng Thu Hồi PIN (3-6N)', 'PIN Revocation Threshold (3-6D)')}</span>
              <span className="p-1.5 rounded-lg bg-rose-50 text-rose-600 border border-rose-100 material-symbols-outlined text-[20px]">
                pin
              </span>
            </div>
            <p className="text-2xl font-black text-rose-700 mt-2">
              {summary?.pinThresholdCount ?? 0} <span className="text-xs font-medium text-slate-500">{t('buồng kho', 'units')}</span>
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">{t('Có thể thực hiện thu hồi', 'Eligible for PIN revocation')}</span>
          </div>
        </div>

        {/* Card 5: Sealing Threshold */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('Đủ ĐK Niêm Phong (>= 7N)', 'Sealing Eligible (>= 7D)')}</span>
              <span className="p-1.5 rounded-lg bg-purple-50 text-purple-600 border border-purple-100 material-symbols-outlined text-[20px]">
                door_sensor
              </span>
            </div>
            <p className="text-2xl font-black text-purple-800 mt-2">
              {summary?.sealingThresholdCount ?? 0} <span className="text-xs font-medium text-slate-500">{t('buồng kho', 'units')}</span>
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col gap-1.5 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">{t('Chờ duyệt niêm phong:', 'Pending sealing approval:')}</span>
              {summary && summary.pendingSealingApprovalsCount > 0 ? (
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold animate-pulse">
                  {summary.pendingSealingApprovalsCount} {t('chờ duyệt', 'pending')}
                </span>
              ) : (
                <span className="font-bold text-slate-700">0 {t('chờ duyệt', 'pending')}</span>
              )}
            </div>

            {/* Thông báo nhỏ khi có trường hợp có thể giải phóng kho */}
            {summary && (summary.eligibleLiquidationReleaseCount ?? 0) > 0 && (
              <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                <span className="text-rose-600 font-semibold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px] text-rose-500">meeting_room</span>
                  {t('Có thể giải phóng kho:', 'Eligible to release unit:')}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold animate-pulse">
                  {summary.eligibleLiquidationReleaseCount} {t('sẵn sàng', 'ready')}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Advanced Filter Toolbar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col gap-4">
        
        {/* Top Filter Row: Tabs on Left + Action Button on Far Right */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2 overflow-x-auto py-1 text-xs font-semibold min-w-0 flex-1 pr-4 sm:pr-6">
            <button
              type="button"
              onClick={() => { setFilterStage('ALL'); setCurrentPage(0) }}
              className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                filterStage === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t('Tất cả', 'All')} ({summary?.totalOverdueContracts ?? 0})
            </button>

            <button
              type="button"
              onClick={() => { setFilterStage('GRACE_PERIOD'); setCurrentPage(0) }}
              className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                filterStage === 'GRACE_PERIOD'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              {t('Ân hạn (1 ngày)', 'Grace Period (1 Day)')}
            </button>

            <button
              type="button"
              onClick={() => { setFilterStage('WARNING'); setCurrentPage(0) }}
              className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                filterStage === 'WARNING'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              {t('Cảnh báo (2 ngày)', 'Warning Stage (2 Days)')}
            </button>

            <button
              type="button"
              onClick={() => { setFilterStage('PIN_REVOCATION'); setCurrentPage(0) }}
              className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                filterStage === 'PIN_REVOCATION'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-400"></span>
              {t('Thu hồi PIN (3-6 ngày)', 'PIN Revoked (3-6 Days)')}
            </button>

            <button
              type="button"
              onClick={() => { setFilterStage('SEALING_ELIGIBLE'); setCurrentPage(0) }}
              className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                filterStage === 'SEALING_ELIGIBLE'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-purple-400"></span>
              {t('Đủ ĐK Niêm phong (>= 7 ngày)', 'Sealing Eligible (>= 7 Days)')}
            </button>

            {/* Filter Đã thanh toán & trả kho */}
            <button
              type="button"
              onClick={() => { setFilterStage('SETTLED'); setCurrentPage(0) }}
              className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                filterStage === 'SETTLED'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-teal-400"></span>
              {t('Đã thanh toán & trả kho', 'Settled & Checked Out')} ({summary?.settledCount ?? settledContracts.length})
            </button>
          </div>

          {/* Action Button: Khách đã tới hoàn tất (nằm tách biệt hẳn ở góc bên phải, cách xa các tab filter) */}
          <div className="shrink-0 flex items-center justify-end sm:ml-auto pl-4 sm:pl-8 sm:border-l-2 border-slate-200">
            <button
              type="button"
              onClick={() => setIsCustomerArrivalMode(prev => !prev)}
              className={`px-4 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 text-xs font-bold shadow-sm ${
                isCustomerArrivalMode
                  ? 'bg-emerald-600 text-white ring-2 ring-emerald-400 shadow-md'
                  : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow'
              }`}
              title={isCustomerArrivalMode ? t('Nhấn để tắt chế độ Khách đã tới hoàn tất', 'Click to disable customer checkout mode') : t('Nhấn để bật chế độ Khách đã tới hoàn tất', 'Click to enable customer checkout mode')}
            >
              <span className="material-symbols-outlined text-[18px]">
                {isCustomerArrivalMode ? 'check_circle' : 'how_to_reg'}
              </span>
              <span>{t('Chuyển sang hoàn tất', 'Customer Checked Out')}</span>
              {isCustomerArrivalMode && (
                <span className="text-[10px] bg-emerald-800/80 text-emerald-100 px-1.5 py-0.5 rounded-full font-normal">
                  {t('Đang bật', 'Active')}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Bottom Filter Controls */}
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-3 text-xs">
          
          {/* Facility Select (if not strictly scoped) */}
          {!isFacilityScoped && (
            <div>
              <label className="text-slate-500 font-medium block mb-1">{t('Cơ sở lưu trữ:', 'Storage Facility:')}</label>
              <select
                value={selectedFacilityFilter}
                onChange={e => { setSelectedFacilityFilter(e.target.value); setCurrentPage(0) }}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:bg-white transition-all"
              >
                <option value="ALL">{t('Toàn hệ thống (Tất cả cơ sở)', 'All Facilities System')}</option>
                {facilities.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* SmartLock Filter */}
          <div>
            <label className="text-slate-500 font-medium block mb-1">{t('Trạng thái SmartLock:', 'SmartLock Status:')}</label>
            <select
              value={pinStatusFilter}
              onChange={e => { setPinStatusFilter(e.target.value); setCurrentPage(0) }}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:bg-white transition-all"
            >
              <option value="ALL">{t('Tất cả trạng thái PIN', 'All PIN Statuses')}</option>
              <option value="PIN_ACTIVE">{t('PIN Active (Mở bình thường)', 'PIN Active (Normal Access)')}</option>
              <option value="PIN_REVOCATION_PENDING">{t('Chờ thu hồi PIN', 'Pending PIN Revocation')}</option>
              <option value="PIN_REVOKED">{t('Đã thu hồi PIN (Locked)', 'PIN Revoked (Locked)')}</option>
              <option value="PIN_REVOCATION_FAILED">{t('Thu hồi PIN thất bại', 'PIN Revocation Failed')}</option>
            </select>
          </div>

          {/* Sealing Status Filter */}
          <div>
            <label className="text-slate-500 font-medium block mb-1">{t('Trạng thái Niêm phong:', 'Sealing Status:')}</label>
            <select
              value={sealingStatusFilter}
              onChange={e => { setSealingStatusFilter(e.target.value); setCurrentPage(0) }}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:bg-white transition-all"
            >
              <option value="ALL">{t('Tất cả trạng thái niêm phong', 'All Sealing Statuses')}</option>
              <option value="NONE">{t('Chưa niêm phong', 'Not Sealed')}</option>
              <option value="SEALING_ELIGIBLE">{t('Đủ ĐK niêm phong (>= 7 ngày)', 'Sealing Eligible (>= 7 Days)')}</option>
              <option value="SEALING_REQUESTED">{t('Chờ duyệt niêm phong', 'Pending Sealing Approval')}</option>
              <option value="SEALING_APPROVED">{t('Đã duyệt (Chờ niêm phong)', 'Approved (Pending Seal)')}</option>
              <option value="SEALING_COMPLETED">{t('Đã niêm phong hoàn tất', 'Sealed Completed')}</option>
              <option value="SEALING_REJECTED">{t('Đề xuất bị từ chối', 'Proposal Rejected')}</option>
            </select>
          </div>

          {/* Search Input */}
          <div className="md:col-span-2 flex items-end gap-2">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-[18px]">
                search
              </span>
              <input
                type="text"
                placeholder={t('Tìm mã HĐ, số kho, tên khách, SĐT...', 'Search contract, unit code, customer, phone...')}
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(0) }}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white transition-all"
              />
            </div>
          </div>

        </div>
      </div>

      {/* Main Overdue Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 text-slate-700 border-b border-slate-200">
              <tr>
                <th className="p-3.5 font-bold">{t('Hợp Đồng & Buồng Kho', 'Contract & Unit')}</th>
                <th className="p-3.5 font-bold">{t('Khách Hàng', 'Customer')}</th>
                <th className="p-3.5 font-bold">{t('Cơ Sở Lưu Trữ', 'Storage Facility')}</th>
                <th className="p-3.5 font-bold">
                  {filterStage === 'SETTLED' ? t('Ngày Đến Hạn', 'Due Date') : t('Ngày Đến Hạn & Quá Hạn', 'Due & Overdue Date')}
                </th>
                <th className="p-3.5 font-bold">
                  {filterStage === 'SETTLED' ? t('Tình Trạng Nợ', 'Debt Status') : t('Chi Tiết Công Nợ', 'Delinquency Breakdown')}
                </th>

                {/* Khi không ở chế độ Khách đã tới hoàn tất và không ở filter SETTLED: hiển thị SmartLock PIN/QR */}
                {!isCustomerArrivalMode && filterStage !== 'SETTLED' && (
                  <th className="p-3.5 font-bold">{t('SmartLock PIN/QR', 'SmartLock PIN/QR')}</th>
                )}

                {filterStage === 'SETTLED' ? (
                  <>
                    <th className="p-3.5 font-bold">{t('Trạng Thái Đơn', 'Order Status')}</th>
                    <th className="p-3.5 font-bold">{t('Thời Gian Hoàn Tất', 'Completion Time')}</th>
                    <th className="p-3.5 font-bold text-right">{t('Thao Tác', 'Actions')}</th>
                  </>
                ) : (
                  <>
                    <th className="p-3.5 font-bold">{t('Hồ Sơ Niêm Phong', 'Sealing Record')}</th>
                    <th className="p-3.5 font-bold">{t('Thao Tác', 'Actions')}</th>
                    {isCustomerArrivalMode && (
                      <th className="p-3.5 font-bold text-right text-emerald-800 bg-emerald-50/80 border-l border-emerald-200">
                        {t('Hoàn tất đơn', 'Complete Checkout')}
                      </th>
                    )}
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <span className="material-symbols-outlined animate-spin text-[32px]">sync</span>
                      <span className="text-xs font-semibold">{t('Đang truy vấn danh sách công nợ quá hạn...', 'Fetching overdue delinquency records...')}</span>
                    </div>
                  </td>
                </tr>
              ) : filterStage === 'SETTLED' ? (
                displayedContracts.length > 0 ? (
                  displayedContracts.map(item => (
                    <tr key={item.contractId} className="hover:bg-teal-50/40 transition-colors bg-teal-50/15">
                      {/* Contract & Unit */}
                      <td className="p-3.5">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-slate-900 text-[13px]">{item.contractCode}</span>
                            {item.isDemo && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-purple-100 text-purple-700">
                                DEMO
                              </span>
                            )}
                          </div>
                          <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">grid_view</span>
                            {t('Buồng', 'Unit')} #{item.unitCode}
                          </span>
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="p-3.5">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800">{item.customerName}</span>
                          <span className="text-slate-500 font-mono text-[11px]">{item.customerPhone}</span>
                        </div>
                      </td>

                      {/* Facility */}
                      <td className="p-3.5 text-slate-600 font-medium">
                        {item.facilityName}
                      </td>

                      {/* Due date */}
                      <td className="p-3.5 text-slate-600">
                        {item.dueDate}
                      </td>

                      {/* Debt Status */}
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="flex flex-col">
                          {item.stageLabel?.includes('thanh lý') ? (
                            <>
                              <span className="font-mono font-bold text-indigo-700 text-xs">
                                {item.totalDebt > 0 ? formatNumber(item.totalDebt) : '0'}
                              </span>
                              <span className="text-[11px] text-purple-700 font-medium">{t('Đã thanh lý tài sản', 'Assets Liquidated')}</span>
                            </>
                          ) : (
                            <>
                              <span className="font-mono font-bold text-emerald-700 text-xs">0</span>
                              <span className="text-[11px] text-emerald-600 font-medium">{t('Đã thanh toán đủ', 'Fully Settled')}</span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Order Status */}
                      <td className="p-3.5">
                        <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border flex items-center gap-1 w-fit ${
                          item.stageLabel?.includes('thanh lý')
                            ? 'bg-purple-100 text-purple-800 border-purple-300'
                            : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        }`}>
                          <span className="material-symbols-outlined text-[13px]">
                            {item.stageLabel?.includes('thanh lý') ? 'gavel' : 'check_circle'}
                          </span>
                          {t(item.stageLabel || 'Đã xong (Khách trả kho)', item.stageLabel?.includes('thanh lý') ? 'Assets Liquidated' : 'Completed (Unit Returned)')}
                        </span>
                      </td>

                      {/* Settled Time */}
                      <td className="p-3.5 text-slate-500 text-xs font-medium">
                        {formatSettledTime((item as any).settledAt, (item as any).dueDate || (item as any).startDate)}
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedContractId(item.contractId)
                            setModalInitialTab('debt')
                            setModalDirectInventory(false)
                          }}
                          className="px-3 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 shadow-xs flex items-center gap-1 cursor-pointer transition-all ml-auto"
                        >
                          <span className="material-symbols-outlined text-[15px]">visibility</span>
                          {t('Chi tiết', 'Details')}
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="p-12 text-center text-slate-400">
                      <span className="material-symbols-outlined text-[36px] text-slate-300 mb-1">done_all</span>
                      <p className="text-xs font-semibold">{t('Chưa có đơn nợ cước nào được xác nhận khách đã tới thanh toán và hoàn tất trả kho.', 'No settled overdue contracts found.')}</p>
                    </td>
                  </tr>
                )
              ) : displayedContracts.length > 0 ? (
                displayedContracts.map(item => (
                  <tr key={item.contractId} className="hover:bg-slate-50/80 transition-colors">
                    
                    {/* Contract & Unit */}
                    <td className="p-3.5">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-slate-900 text-[13px]">{item.contractCode}</span>
                          {item.isDemo && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-purple-100 text-purple-700">
                              DEMO
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-semibold text-rose-600 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">grid_view</span>
                          {t('Buồng', 'Unit')} #{item.unitCode} {item.unitTypeName ? `• ${t(item.unitTypeName)}` : ''}
                        </span>
                      </div>
                    </td>

                    {/* Customer */}
                    <td className="p-3.5">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800">{item.customerName}</span>
                        <span className="text-slate-500 font-mono text-[11px]">{item.customerPhone}</span>
                      </div>
                    </td>

                    {/* Facility */}
                    <td className="p-3.5 text-slate-600 font-medium">
                      {item.facilityName}
                    </td>

                    {/* Due Date & Overdue Days */}
                    <td className="p-3.5">
                      <div className="flex flex-col">
                        <span className="text-slate-500">{item.dueDate}</span>
                        <span className={`font-bold flex items-center gap-1 mt-0.5 ${
                          item.daysOverdue <= 1 ? 'text-emerald-700' :
                          item.daysOverdue === 2 ? 'text-amber-700' :
                          item.daysOverdue < 7 ? 'text-rose-700' : 'text-purple-700'
                        }`}>
                          <span className="material-symbols-outlined text-[14px]">schedule</span>
                          +{item.daysOverdue} {t('ngày', 'days')} ({item.daysOverdue <= 1 ? t('Ân hạn', 'Grace') : item.daysOverdue < 7 ? t('Ngưỡng PIN', 'PIN Threshold') : t('Ngưỡng Niêm phong', 'Sealing Threshold')})
                        </span>
                      </div>
                    </td>

                    {/* Debt Breakdown */}
                    <td className="p-3.5 whitespace-nowrap">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1 whitespace-nowrap">
                          <span className="text-[11px] text-slate-400">{t('Cọc giữ:', 'Deposit held:')}</span>
                          <span className="text-emerald-700 font-medium">{formatNumber(item.depositHeld)}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-rose-600 whitespace-nowrap">
                          <span>{t('Phạt', 'Penalty')} ({item.lateFeePercentage ?? 100}%):</span>
                          <span className="font-bold">+{formatNumber(item.lateFee)}</span>
                        </div>
                        {item.totalDebt > 0 ? (
                          <div className="font-mono font-black text-rose-700 text-sm mt-0.5 whitespace-nowrap" title={t('Công nợ khách phải thanh toán thêm', 'Additional debt customer must pay')}>
                            {t('Nợ:', 'Debt:')} {formatNumber(item.totalDebt)}
                          </div>
                        ) : (
                          <div className="font-mono font-bold text-emerald-700 text-xs mt-0.5 flex items-center gap-1 whitespace-nowrap" title={t('Số tiền cọc còn lại hoàn khách khi trả kho', 'Remaining deposit to refund to customer')}>
                            <span className="material-symbols-outlined text-[13px]">replay</span>
                            {t('Hoàn:', 'Refund:')} {formatNumber(item.customerRefundAmount ?? Math.max(0, (item.depositHeld || 0) - (item.lateFee || 0)))}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* SmartLock Status: Mất đi khi ở chế độ isCustomerArrivalMode */}
                    {!isCustomerArrivalMode && (
                      <td className="p-3.5">
                        <div className="flex flex-col gap-1 items-start">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            item.pinStatus === 'PIN_ACTIVE' ? 'bg-emerald-100 text-emerald-800' :
                            item.pinStatus === 'PIN_REVOCATION_PENDING' ? 'bg-amber-100 text-amber-800' :
                            item.pinStatus === 'PIN_REVOKED' ? 'bg-rose-100 text-rose-800' :
                            'bg-slate-200 text-slate-700'
                          }`}>
                            {item.pinStatus === 'PIN_ACTIVE' ? 'PIN Active' :
                             item.pinStatus === 'PIN_REVOCATION_PENDING' ? t('Chờ thu hồi', 'Revocation Pending') :
                             item.pinStatus === 'PIN_REVOKED' ? t('Đã thu hồi (Lock)', 'Revoked (Lock)') :
                             t('Thu hồi lỗi', 'Revocation Failed')}
                          </span>
                        </div>
                      </td>
                    )}

                    {/* Sealing Status: Đẩy sang trái */}
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        item.sealingStatus === 'SEALING_COMPLETED' ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                        item.sealingStatus === 'SEALING_APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                        item.sealingStatus === 'SEALING_REQUESTED' ? 'bg-amber-100 text-amber-800' :
                        item.sealingStatus === 'SEALING_REJECTED' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                        item.sealingStatus === 'SEALING_ELIGIBLE' ? 'bg-rose-100 text-rose-800' :
                        'bg-slate-100 text-slate-500'
                      }`}>
                        {item.sealingStatus === 'SEALING_COMPLETED' ? t('Đã niêm phong', 'Sealed') :
                         item.sealingStatus === 'SEALING_APPROVED' ? t('Đã duyệt NP', 'Sealing Approved') :
                         item.sealingStatus === 'SEALING_REQUESTED' ? t('Chờ duyệt NP', 'Pending Sealing') :
                         item.sealingStatus === 'SEALING_REJECTED' ? t('Từ chối NP', 'Sealing Rejected') :
                         item.sealingStatus === 'SEALING_ELIGIBLE' ? t('Đủ ĐK niêm phong', 'Sealing Eligible') :
                         t('Chưa niêm phong', 'Not Sealed')}
                      </span>
                    </td>

                    {/* Actions: Đẩy sang trái */}
                    <td className="p-3.5 text-left">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedContractId(item.contractId)
                            setModalInitialTab('debt')
                            setModalDirectInventory(false)
                          }}
                          className="px-3 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 shadow-xs flex items-center gap-1 cursor-pointer transition-all"
                        >
                          <span className="material-symbols-outlined text-[15px]">visibility</span>
                          {t('Chi tiết', 'Details')}
                        </button>
                      </div>
                    </td>

                    {/* Hoàn tất đơn: Cột mới với button Đã xong khi isCustomerArrivalMode */}
                    {isCustomerArrivalMode && (
                      <td className="p-3.5 text-right bg-emerald-50/40 border-l border-emerald-100">
                        <button
                          type="button"
                          onClick={() => setContractToSettle(item)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer transition-all ml-auto"
                        >
                          <span className="material-symbols-outlined text-[16px]">task_alt</span>
                          {t('Đã xong', 'Done')}
                        </button>
                      </td>
                    )}

                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-400">
                    <span className="material-symbols-outlined text-[36px] text-slate-300 mb-1">inbox</span>
                    <p className="text-xs font-semibold">{t('Không tìm thấy hợp đồng nợ cước nào khớp với bộ lọc.', 'No overdue contracts found matching the filters.')}</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500 relative">
          <div className="text-center md:text-left">
            {t('Hiển thị', 'Showing')} <span className="font-bold text-slate-800 dark:text-slate-200">{displayedContracts.length}</span> {t('trên tổng số', 'of total')} <span className="font-bold text-slate-800 dark:text-slate-200">{filterStage === 'SETTLED' ? settledContracts.length : totalElements}</span> {t('hợp đồng', 'contracts')}
          </div>
          <div className="flex items-center justify-center gap-1.5 md:absolute md:left-1/2 md:-translate-x-1/2">
            <button
              type="button"
              disabled={currentPage === 0}
              onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs"
              title={t('Trang trước', 'Previous page')}
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            <span className="px-3 font-semibold text-slate-700 dark:text-slate-300 select-none">
              {t('Trang', 'Page')} {currentPage + 1} / {Math.max(1, totalPages)}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages - 1}
              onClick={() => setCurrentPage(p => p + 1)}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs"
              title={t('Trang sau', 'Next page')}
            >
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
            </button>
          </div>
          {/* Empty right spacer to keep right edge clear of floating AI chat button */}
          <div className="hidden md:block w-28 pointer-events-none" aria-hidden="true" />
        </div>

      </div>

      {/* Modal Confirm Khách đã tới hoàn tất đơn */}
      {contractToSettle && (() => {
        const depositHeld = contractToSettle.depositHeld || 0
        const lateFee = contractToSettle.lateFee || 0
        const principalDebt = contractToSettle.principalDebt || 0
        const totalDeductions = principalDebt + lateFee
        const refundAmount = contractToSettle.customerRefundAmount !== undefined && contractToSettle.customerRefundAmount !== null
          ? contractToSettle.customerRefundAmount
          : Math.max(0, depositHeld - totalDeductions)
        const remainingDebt = contractToSettle.totalDebt || 0
        const isRefundMode = refundAmount > 0
        const isDebtorMode = remainingDebt > 0

        return (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-slate-200 flex flex-col gap-4 animate-scaleUp max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                  isRefundMode
                    ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                    : isDebtorMode
                    ? 'bg-amber-100 text-amber-700 border-amber-200'
                    : 'bg-blue-100 text-blue-700 border-blue-200'
                }`}>
                  <span className="material-symbols-outlined text-2xl">
                    {isRefundMode ? 'currency_exchange' : isDebtorMode ? 'receipt_long' : 'verified'}
                  </span>
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-slate-900">
                    {isRefundMode
                      ? 'Xác nhận hoàn trả tiền cọc cho khách hàng'
                      : isDebtorMode
                      ? 'Xác nhận thu nợ cước & Hoàn tất trả kho'
                      : 'Xác nhận tất toán & Hoàn tất trả kho'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {isRefundMode
                      ? 'Khách hàng hoàn tất trả kho — Boxora hoàn cọc sau khi đã cấn trừ chi phí quá hạn.'
                      : isDebtorMode
                      ? 'Khách hàng thanh toán phần nợ còn thiếu sau cấn trừ cọc để hoàn tất trả kho.'
                      : 'Hợp đồng đã hoàn tất cân bằng công nợ, sẵn sàng thu hồi PIN và trả kho.'}
                  </p>
                </div>
              </div>

              {/* Contract & Customer Info Card */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Mã hợp đồng:</span>
                  <span className="font-mono font-bold text-slate-900">{contractToSettle.contractCode}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Buồng kho:</span>
                  <span className="font-bold text-slate-900">
                    Buồng #{contractToSettle.unitCode} {contractToSettle.unitTypeName ? `• ${contractToSettle.unitTypeName}` : ''}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Khách hàng:</span>
                  <span className="font-semibold text-slate-900">
                    {contractToSettle.customerName} ({contractToSettle.customerPhone})
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Cơ sở:</span>
                  <span className="font-medium text-slate-800">{contractToSettle.facilityName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Hạn trả kho ban đầu:</span>
                  <span className="font-medium text-slate-700">
                    {contractToSettle.dueDate} <span className="text-rose-600 font-bold">(+{contractToSettle.daysOverdue} ngày • {contractToSettle.stageLabel || 'Quá hạn'})</span>
                  </span>
                </div>
              </div>

              {/* BẢNG KÊ QUYẾT TOÁN TÀI CHÍNH CHI TIẾT ĐẦY ĐỦ CÁC KHOẢN */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2.5">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider pb-1 border-b border-slate-200 flex items-center justify-between">
                  <span>Bảng phân rã quyết toán tài chính</span>
                  <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Cấn trừ trực tiếp tiền cọc
                  </span>
                </div>

                {/* 1. Tiền cọc */}
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[15px] text-blue-600">savings</span>
                    Tiền đặt cọc bảo đảm kho (đang giữ):
                  </span>
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    +{formatVND(depositHeld)}
                  </span>
                </div>

                {/* 2. Tiền phạt */}
                <div className="flex justify-between items-center text-rose-600">
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="material-symbols-outlined text-[15px] text-rose-500">warning</span>
                    Phí phạt trễ hạn (+{contractToSettle.daysOverdue} ngày • {contractToSettle.lateFeePercentage ?? 100}%/ngày):
                  </span>
                  <span className="font-mono font-bold text-sm">
                    -{formatVND(lateFee)}
                  </span>
                </div>

                {/* 3. Nợ gốc nếu có */}
                {principalDebt > 0 && (
                  <div className="flex justify-between items-center text-rose-600">
                    <span className="flex items-center gap-1.5 font-medium">
                      <span className="material-symbols-outlined text-[15px] text-rose-500">receipt</span>
                      Cước thuê gốc còn nợ:
                    </span>
                    <span className="font-mono font-bold text-sm">
                      -{formatVND(principalDebt)}
                    </span>
                  </div>
                )}

                {/* 4. Tổng kết */}
                <div className="pt-2 border-t-2 border-dashed border-slate-200">
                  {isRefundMode ? (
                    <div className="p-3 bg-emerald-50/90 border border-emerald-300 rounded-xl flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-emerald-900 uppercase tracking-wide flex items-center gap-1">
                          <span className="material-symbols-outlined text-[17px] text-emerald-600">check_circle</span>
                          Boxora hoàn trả cọc cho khách:
                        </span>
                      </div>
                      <span className="font-mono font-black text-emerald-700 text-lg">
                        {formatVND(refundAmount)}
                      </span>
                    </div>
                  ) : isDebtorMode ? (
                    <div className="p-3 bg-amber-50/90 border border-amber-300 rounded-xl flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-amber-900 uppercase tracking-wide flex items-center gap-1">
                          <span className="material-symbols-outlined text-[17px] text-amber-600">payments</span>
                          Khách cần thanh toán:
                        </span>
                      </div>
                      <span className="font-mono font-black text-amber-900 text-lg">
                        {formatVND(remainingDebt)}
                      </span>
                    </div>
                  ) : (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-blue-900 uppercase tracking-wide">
                          Công nợ tất toán cân bằng:
                        </span>
                        <span className="text-[10px] text-blue-600 mt-0.5">
                          Không còn nợ và không có tiền cọc dư hoàn lại
                        </span>
                      </div>
                      <span className="font-mono font-bold text-blue-800 text-base">
                        0 ₫
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Hướng dẫn quy trình hệ thống */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-700 leading-relaxed">
                ✓ Sau khi bấm <strong>"Xác nhận đã xong"</strong>, hệ thống sẽ tự động: (1) Ghi nhận tất toán hợp đồng; (2) Thu hồi SmartLock PIN mở kho và dỡ niêm phong; (3) Kiểm tra biên bản nghiệm thu trả kho và giải phóng buồng kho <strong>#{contractToSettle.unitCode}</strong> về trạng thái Sẵn sàng sử dụng.
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setContractToSettle(null)}
                  disabled={isSettling}
                  className="px-4 py-2 text-xs text-slate-600 font-semibold hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSettlement}
                  disabled={isSettling}
                  className={`px-4 py-2 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50 ${
                    isDebtorMode ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {isSettling ? (
                    <>
                      <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                      <span>Đang xử lý...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">check_circle</span>
                      <span>
                        {isRefundMode
                          ? `Xác nhận hoàn ${formatVND(refundAmount)} & Đã xong`
                          : isDebtorMode
                          ? `Xác nhận đã thu ${formatVND(remainingDebt)} & Hoàn tất`
                          : 'Xác nhận tất toán & Đã xong'}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Contract Detail Modal */}
      {selectedContractId && (
        <OverdueContractDetailModal
          isOpen={Boolean(selectedContractId)}
          contractId={selectedContractId}
          onClose={() => {
            setSelectedContractId(null)
            setModalDirectInventory(false)
          }}
          onRefreshParent={handleRefreshAll}
          initialTab={modalInitialTab}
          openInventoryDirectly={modalDirectInventory}
          onSettled={handleRefreshAll}
        />
      )}

    </div>
  )
}
