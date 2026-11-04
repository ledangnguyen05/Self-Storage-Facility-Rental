import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useOutletContext, useNavigate } from 'react-router-dom'
import { overdueService, OverdueSummary, OverdueContractItem, OverdueSettlementPayload } from '../../services/overdueService'
import { facilityService } from '../../services/facilityService'
import { useAuth } from '../../context/AuthContext'
import { useRealtimeSync } from '../../hooks/useRealtimeSync'
import { Facility } from '../../types'
import { OverdueContractDetailModal } from './modals/OverdueContractDetailModal'
import { toast } from '../../utils/toast'

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
    const errors: Record<string, string> = {}

    if (remainingDebt > 0) {
      if (!settlementReceiptCode.trim()) {
        errors.receiptCode = 'Vui lòng nhập mã phiếu thu / số biên lai quầy giao dịch'
      }
      if (settlementAmount < remainingDebt) {
        errors.amount = `Số tiền thu (${formatVND(settlementAmount)}) không đủ để thanh toán toàn bộ nợ (${formatVND(remainingDebt)})`
      }
    }

    if (Object.keys(errors).length > 0) {
      setSettlementFormErrors(errors)
      toast.error('Vui lòng kiểm tra lại thông tin phiếu thu và số tiền thanh toán')
      return
    }

    setIsSettling(true)
    try {
      const payload: OverdueSettlementPayload | undefined = remainingDebt > 0 ? {
        paymentMethod: settlementPaymentMethod,
        receiptVoucherCode: settlementReceiptCode.trim(),
        referenceCode: settlementRefCode.trim() || undefined,
        proofDocumentUrl: settlementProofUrl.trim() || undefined,
        amount: Number(settlementAmount),
        notes: settlementNotes.trim() || undefined
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

      toast.success(`Đã hoàn tất đơn nợ cước buồng #${contractToSettle.unitCode}! Khách hàng ${contractToSettle.customerName} đã thanh toán & trả kho thành công.`)
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
                Xử Lý Nợ Cước Quá Hạn &amp; Thu Hồi PIN/QR
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Theo dõi chu kỳ quá hạn (+1 ngày ân hạn, +3 ngày thu hồi PIN SmartLock, +7 ngày xem xét niêm phong kho &amp; kiểm kê)
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
            Xuất Báo Cáo CSV
          </button>
          <button
            type="button"
            onClick={handleRefreshAll}
            className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">sync</span>
            Làm Mới
          </button>
        </div>
      </div>

      {/* KPI Dashboard Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Overdue Debt */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tổng Công Nợ Quá Hạn</span>
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
              <span>Nợ gốc tiền thuê:</span>
              <span className="font-bold text-slate-800">{formatVND(summary?.totalPrincipalDebt)}</span>
            </div>
            <div className="flex justify-between">
              <span>Phí phạt tích lũy:</span>
              <span className="font-bold text-rose-700">+{formatVND(summary?.totalLateFees)}</span>
            </div>
            {summary && summary.unverifiedPaymentsAmount > 0 && (
              <div className="flex justify-between text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                <span>Chờ đối soát ({summary.unverifiedPaymentsCount} đơn):</span>
                <span className="font-bold">{formatVND(summary.unverifiedPaymentsAmount)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Total Overdue Contracts */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tổng Hợp Đồng Quá Hạn</span>
              <span className="p-1.5 rounded-lg bg-slate-50 text-slate-600 border border-slate-200 material-symbols-outlined text-[20px]">
                description
              </span>
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2">
              {summary?.totalOverdueContracts ?? 0} <span className="text-xs font-medium text-slate-500">hợp đồng</span>
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col gap-1 text-[11px] text-slate-500">
            <div className="flex justify-between">
              <span>Ân hạn miễn phạt (Nhóm 1):</span>
              <span className="font-bold text-emerald-700">{summary?.graceCount ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Cảnh báo quá hạn (Nhóm 2):</span>
              <span className="font-bold text-amber-700">{summary?.warningCount ?? 0}</span>
            </div>
          </div>
        </div>

        {/* Card 3: PIN Revocation Threshold */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ngưỡng Thu Hồi PIN (3-6N)</span>
              <span className="p-1.5 rounded-lg bg-rose-50 text-rose-600 border border-rose-100 material-symbols-outlined text-[20px]">
                pin
              </span>
            </div>
            <p className="text-2xl font-black text-rose-700 mt-2">
              {summary?.pinThresholdCount ?? 0} <span className="text-xs font-medium text-slate-500">buồng kho</span>
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Chờ Quản lý thu hồi:</span>
            {summary && summary.pendingPinRevocationsCount > 0 ? (
              <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold animate-pulse">
                {summary.pendingPinRevocationsCount} chờ xử lý
              </span>
            ) : (
              <span className="font-bold text-slate-700">0 chờ xử lý</span>
            )}
          </div>
        </div>

        {/* Card 4: Sealing Threshold */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Đủ ĐK Niêm Phong (&gt;= 7N)</span>
              <span className="p-1.5 rounded-lg bg-purple-50 text-purple-600 border border-purple-100 material-symbols-outlined text-[20px]">
                door_sensor
              </span>
            </div>
            <p className="text-2xl font-black text-purple-800 mt-2">
              {summary?.sealingThresholdCount ?? 0} <span className="text-xs font-medium text-slate-500">buồng kho</span>
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Chờ duyệt niêm phong:</span>
            {summary && summary.pendingSealingApprovalsCount > 0 ? (
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold animate-pulse">
                {summary.pendingSealingApprovalsCount} chờ duyệt
              </span>
            ) : (
              <span className="font-bold text-slate-700">0 chờ duyệt</span>
            )}
          </div>
        </div>
      </div>

      {/* Advanced Filter Toolbar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col gap-4">
        
        {/* Top Filter Row: 5 Group Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => { setFilterStage('ALL'); setCurrentPage(0) }}
            className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              filterStage === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Tất cả ({summary?.totalOverdueContracts ?? 0})
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
            Ân hạn (1 ngày) ({summary?.graceCount ?? 0})
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
            Cảnh báo (2 ngày) ({summary?.warningCount ?? 0})
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
            Thu hồi PIN (3-6 ngày) ({summary?.pinThresholdCount ?? 0})
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
            Đủ ĐK Niêm phong (&gt;= 7 ngày) ({summary?.sealingThresholdCount ?? 0})
          </button>

          {/* Filter Đã thanh toán & trả kho (nằm giữa Đủ ĐK Niêm phong và button Khách đã tới hoàn tất) */}
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
            Đã thanh toán &amp; trả kho ({summary?.settledCount ?? settledContracts.length})
          </button>

          {/* Button: Khách đã tới hoàn tất (nằm ở phía bên phải) */}
          <button
            type="button"
            onClick={() => setIsCustomerArrivalMode(prev => !prev)}
            className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 text-xs font-bold shadow-xs ${
              isCustomerArrivalMode
                ? 'bg-emerald-600 text-white ring-2 ring-emerald-400 shadow-sm'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
            title={isCustomerArrivalMode ? 'Nhấn để tắt chế độ Khách đã tới hoàn tất' : 'Nhấn để bật chế độ Khách đã tới hoàn tất'}
          >
            <span className="material-symbols-outlined text-[17px]">
              {isCustomerArrivalMode ? 'check_circle' : 'how_to_reg'}
            </span>
            <span>Khách đã tới hoàn tất</span>
            {isCustomerArrivalMode && (
              <span className="text-[10px] bg-emerald-800/80 text-emerald-100 px-1.5 py-0.2 rounded-full font-normal">
                Đang bật
              </span>
            )}
          </button>
        </div>

        {/* Bottom Filter Controls */}
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-3 text-xs">
          
          {/* Facility Select (if not strictly scoped) */}
          {!isFacilityScoped && (
            <div>
              <label className="text-slate-500 font-medium block mb-1">Cơ sở lưu trữ:</label>
              <select
                value={selectedFacilityFilter}
                onChange={e => { setSelectedFacilityFilter(e.target.value); setCurrentPage(0) }}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:bg-white transition-all"
              >
                <option value="ALL">Toàn hệ thống (Tất cả cơ sở)</option>
                {facilities.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* SmartLock Filter */}
          <div>
            <label className="text-slate-500 font-medium block mb-1">Trạng thái SmartLock:</label>
            <select
              value={pinStatusFilter}
              onChange={e => { setPinStatusFilter(e.target.value); setCurrentPage(0) }}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:bg-white transition-all"
            >
              <option value="ALL">Tất cả trạng thái PIN</option>
              <option value="PIN_ACTIVE">PIN Active (Mở bình thường)</option>
              <option value="PIN_REVOCATION_PENDING">Chờ thu hồi PIN</option>
              <option value="PIN_REVOKED">Đã thu hồi PIN (Locked)</option>
              <option value="PIN_REVOCATION_FAILED">Thu hồi PIN thất bại</option>
            </select>
          </div>

          {/* Sealing Status Filter */}
          <div>
            <label className="text-slate-500 font-medium block mb-1">Trạng thái Niêm phong:</label>
            <select
              value={sealingStatusFilter}
              onChange={e => { setSealingStatusFilter(e.target.value); setCurrentPage(0) }}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:bg-white transition-all"
            >
              <option value="ALL">Tất cả niêm phong</option>
              <option value="NONE">Chưa niêm phong</option>
              <option value="SEALING_ELIGIBLE">Đủ ĐK niêm phong (&gt;= 7 ngày)</option>
              <option value="SEALING_REQUESTED">Chờ duyệt niêm phong</option>
              <option value="SEALING_APPROVED">Đã duyệt (Chờ niêm phong)</option>
              <option value="SEALING_COMPLETED">Đã niêm phong hoàn tất</option>
              <option value="SEALING_REJECTED">Đề xuất bị từ chối</option>
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
                placeholder="Tìm mã HĐ, số kho, tên khách, SĐT..."
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
                <th className="p-3.5 font-bold">Hợp Đồng &amp; Buồng Kho</th>
                <th className="p-3.5 font-bold">Khách Hàng</th>
                <th className="p-3.5 font-bold">Cơ Sở Lưu Trữ</th>
                <th className="p-3.5 font-bold">
                  {filterStage === 'SETTLED' ? 'Ngày Đến Hạn' : 'Ngày Đến Hạn & Quá Hạn'}
                </th>
                <th className="p-3.5 font-bold">
                  {filterStage === 'SETTLED' ? 'Tình Trạng Nợ' : 'Chi Tiết Công Nợ'}
                </th>

                {/* Khi không ở chế độ Khách đã tới hoàn tất và không ở filter SETTLED: hiển thị SmartLock PIN/QR */}
                {!isCustomerArrivalMode && filterStage !== 'SETTLED' && (
                  <th className="p-3.5 font-bold">SmartLock PIN/QR</th>
                )}

                {filterStage === 'SETTLED' ? (
                  <>
                    <th className="p-3.5 font-bold">Trạng Thái Đơn</th>
                    <th className="p-3.5 font-bold">Thời Gian Hoàn Tất</th>
                    <th className="p-3.5 font-bold text-right">Thao Tác</th>
                  </>
                ) : (
                  <>
                    <th className="p-3.5 font-bold">Hồ Sơ Niêm Phong</th>
                    <th className="p-3.5 font-bold">Thao Tác</th>
                    {isCustomerArrivalMode && (
                      <th className="p-3.5 font-bold text-right text-emerald-800 bg-emerald-50/80 border-l border-emerald-200">
                        Hoàn tất đơn
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
                      <span className="text-xs font-semibold">Đang truy vấn danh sách công nợ quá hạn...</span>
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
                            Buồng #{item.unitCode}
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
                      <td className="p-3.5">
                        <div className="flex flex-col">
                          <span className="font-mono font-bold text-emerald-700 text-xs">0 ₫</span>
                          <span className="text-[11px] text-emerald-600 font-medium">Đã thanh toán đủ</span>
                        </div>
                      </td>

                      {/* Order Status */}
                      <td className="p-3.5">
                        <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 w-fit">
                          <span className="material-symbols-outlined text-[13px]">check_circle</span>
                          Đã xong (Khách trả kho)
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
                          Chi tiết
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="p-12 text-center text-slate-400">
                      <span className="material-symbols-outlined text-[36px] text-slate-300 mb-1">done_all</span>
                      <p className="text-xs font-semibold">Chưa có đơn nợ cước nào được xác nhận khách đã tới thanh toán và hoàn tất trả kho.</p>
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
                          Buồng #{item.unitCode} {item.unitTypeName ? `• ${item.unitTypeName}` : ''}
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
                          +{item.daysOverdue} ngày ({item.daysOverdue <= 1 ? 'Ân hạn' : item.daysOverdue < 7 ? 'Ngưỡng PIN' : 'Ngưỡng Niêm phong'})
                        </span>
                      </div>
                    </td>

                    {/* Debt Breakdown */}
                    <td className="p-3.5">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] text-slate-400">Cọc giữ:</span>
                          <span className="text-emerald-700 font-medium">{formatVND(item.depositHeld)}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-rose-600">
                          <span>Phạt ({item.lateFeePercentage ?? 100}%/d):</span>
                          <span className="font-bold">+{formatVND(item.lateFee)}</span>
                        </div>
                        {item.totalDebt > 0 ? (
                          <div className="font-mono font-black text-rose-700 text-sm mt-0.5" title="Công nợ khách phải thanh toán thêm">
                            Nợ: {formatVND(item.totalDebt)}
                          </div>
                        ) : (
                          <div className="font-mono font-bold text-emerald-700 text-xs mt-0.5 flex items-center gap-1" title="Số tiền cọc còn lại hoàn khách khi trả kho">
                            <span className="material-symbols-outlined text-[13px]">replay</span>
                            Hoàn: {formatVND(item.customerRefundAmount ?? Math.max(0, (item.depositHeld || 0) - (item.lateFee || 0)))}
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
                             item.pinStatus === 'PIN_REVOCATION_PENDING' ? 'Chờ thu hồi' :
                             item.pinStatus === 'PIN_REVOKED' ? 'Đã thu hồi (Lock)' :
                             'Thu hồi lỗi'}
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
                        {item.sealingStatus === 'SEALING_COMPLETED' ? 'Đã niêm phong' :
                         item.sealingStatus === 'SEALING_APPROVED' ? 'Đã duyệt NP' :
                         item.sealingStatus === 'SEALING_REQUESTED' ? 'Chờ duyệt NP' :
                         item.sealingStatus === 'SEALING_REJECTED' ? 'Từ chối NP' :
                         item.sealingStatus === 'SEALING_ELIGIBLE' ? 'Đủ ĐK niêm phong' :
                         'Chưa niêm phong'}
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
                          Chi tiết
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
                          Đã xong
                        </button>
                      </td>
                    )}

                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-400">
                    <span className="material-symbols-outlined text-[36px] text-slate-300 mb-1">inbox</span>
                    <p className="text-xs font-semibold">Không tìm thấy hợp đồng nợ cước nào khớp với bộ lọc.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500 relative">
          <div className="text-center md:text-left">
            Hiển thị <span className="font-bold text-slate-800 dark:text-slate-200">{displayedContracts.length}</span> trên tổng số <span className="font-bold text-slate-800 dark:text-slate-200">{filterStage === 'SETTLED' ? settledContracts.length : totalElements}</span> hợp đồng
          </div>
          <div className="flex items-center justify-center gap-1.5 md:absolute md:left-1/2 md:-translate-x-1/2">
            <button
              type="button"
              disabled={currentPage === 0}
              onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs"
              title="Trang trước"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            <span className="px-3 font-semibold text-slate-700 dark:text-slate-300 select-none">
              Trang {currentPage + 1} / {Math.max(1, totalPages)}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages - 1}
              onClick={() => setCurrentPage(p => p + 1)}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs"
              title="Trang sau"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>
          {/* Empty right spacer to keep right edge clear of floating AI chat button */}
          <div className="hidden md:block w-28 pointer-events-none" aria-hidden="true" />
        </div>

      </div>

      {/* Modal Confirm Khách đã tới hoàn tất đơn */}
      {contractToSettle && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-slate-200 flex flex-col gap-4 animate-scaleUp max-h-[90vh] overflow-y-auto">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-200">
                <span className="material-symbols-outlined text-2xl">how_to_reg</span>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-slate-900">Xác nhận hoàn tất đơn nợ cước</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ghi nhận thu tiền tại quầy, cập nhật thanh toán và hoàn tất tất toán hợp đồng trả kho.
                </p>
              </div>
            </div>

            {/* Contract Info Summary Card */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Mã hợp đồng:</span>
                <span className="font-mono font-bold text-slate-900">{contractToSettle.contractCode}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Buồng kho:</span>
                <span className="font-bold text-rose-600">Buồng #{contractToSettle.unitCode}</span>
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
              <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                <span className="text-slate-600 font-bold">Tổng nợ cần thu:</span>
                <span className="font-mono font-black text-emerald-700 text-sm">
                  {formatVND(contractToSettle.totalDebt)}
                </span>
              </div>
            </div>

            {/* Form ghi nhận phiếu thu quầy khi còn nợ */}
            {contractToSettle.totalDebt > 0 ? (
              <div className="space-y-3 p-3.5 bg-blue-50/50 border border-blue-200/80 rounded-xl text-xs">
                <div className="flex items-center gap-1.5 text-blue-900 font-bold text-xs pb-1 border-b border-blue-200/60">
                  <span className="material-symbols-outlined text-[17px] text-blue-600">receipt_long</span>
                  Thông tin phiếu thu & thanh toán tại quầy
                </div>

                {/* Phương thức thanh toán */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Phương thức thanh toán <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSettlementPaymentMethod('CASH')}
                      className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg border text-xs font-semibold transition cursor-pointer ${
                        settlementPaymentMethod === 'CASH'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">payments</span>
                      Tiền mặt
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettlementPaymentMethod('BANK_TRANSFER')}
                      className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg border text-xs font-semibold transition cursor-pointer ${
                        settlementPaymentMethod === 'BANK_TRANSFER'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">account_balance</span>
                      Chuyển khoản quầy
                    </button>
                  </div>
                </div>

                {/* Mã phiếu thu / Số biên lai */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Mã phiếu thu / Số biên lai <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={settlementReceiptCode}
                    onChange={(e) => {
                      setSettlementReceiptCode(e.target.value)
                      if (settlementFormErrors.receiptCode) {
                        setSettlementFormErrors(prev => ({ ...prev, receiptCode: '' }))
                      }
                    }}
                    placeholder="VD: PT-20261102-001"
                    className={`w-full px-3 py-1.5 bg-white border rounded-lg text-xs font-mono font-medium focus:outline-hidden focus:ring-2 ${
                      settlementFormErrors.receiptCode
                        ? 'border-rose-400 focus:ring-rose-200'
                        : 'border-slate-300 focus:ring-blue-200'
                    }`}
                  />
                  {settlementFormErrors.receiptCode && (
                    <p className="text-[11px] text-rose-600 mt-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">error</span>
                      {settlementFormErrors.receiptCode}
                    </p>
                  )}
                </div>

                {/* Số tiền thực thu */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[11px] font-semibold text-slate-700">
                      Số tiền thực thu (VND) <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[11px] font-mono text-emerald-700 font-bold">
                      {formatVND(settlementAmount)}
                    </span>
                  </div>
                  <input
                    type="number"
                    min={contractToSettle.totalDebt}
                    value={settlementAmount || ''}
                    onChange={(e) => {
                      setSettlementAmount(Number(e.target.value) || 0)
                      if (settlementFormErrors.amount) {
                        setSettlementFormErrors(prev => ({ ...prev, amount: '' }))
                      }
                    }}
                    className={`w-full px-3 py-1.5 bg-white border rounded-lg text-xs font-mono font-bold focus:outline-hidden focus:ring-2 ${
                      settlementFormErrors.amount
                        ? 'border-rose-400 focus:ring-rose-200'
                        : 'border-slate-300 focus:ring-blue-200'
                    }`}
                  />
                  {settlementFormErrors.amount && (
                    <p className="text-[11px] text-rose-600 mt-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">error</span>
                      {settlementFormErrors.amount}
                    </p>
                  )}
                </div>

                {/* Mã tham chiếu chuyển khoản */}
                {settlementPaymentMethod === 'BANK_TRANSFER' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Mã tham chiếu ngân hàng / App Banking
                    </label>
                    <input
                      type="text"
                      value={settlementRefCode}
                      onChange={(e) => setSettlementRefCode(e.target.value)}
                      placeholder="VD: FT263078491820..."
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-blue-200"
                    />
                  </div>
                )}

                {/* Link / Ghi chú chứng từ */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Link ảnh biên lai / Ghi chú chứng từ (tùy chọn)
                  </label>
                  <input
                    type="text"
                    value={settlementProofUrl}
                    onChange={(e) => setSettlementProofUrl(e.target.value)}
                    placeholder="VD: Biên lai thu tiền ký tay số 1234"
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                {/* Ghi chú thu ngân */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Ghi chú tất toán (tùy chọn)
                  </label>
                  <input
                    type="text"
                    value={settlementNotes}
                    onChange={(e) => setSettlementNotes(e.target.value)}
                    placeholder="VD: Khách nộp tiền mặt tại quầy bàn giao cơ sở"
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-200"
                  />
                </div>
              </div>
            ) : (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start gap-2">
                <span className="material-symbols-outlined text-[18px] text-emerald-600 shrink-0">check_circle</span>
                <span>
                  Hợp đồng này <strong>không còn nợ cước</strong> (khách hàng đã thanh toán trực tuyến hoặc đã hoàn tất công nợ). Không cần tạo thêm phiếu thu.
                </span>
              </div>
            )}

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-700 leading-relaxed">
              ✓ Sau khi bấm <strong>"Xác nhận đã xong"</strong>, hệ thống sẽ xác thực phiếu thu, gọi SmartLock thu hồi PIN truy cập và kiểm tra biên bản nghiệm thu trả kho trước khi chuyển trạng thái buồng kho <strong>#{contractToSettle.unitCode}</strong>.
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
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                {isSettling ? (
                  <>
                    <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                    Đang xử lý...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    Xác nhận đã xong
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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
        />
      )}

    </div>
  )
}
