import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useOutletContext, useNavigate } from 'react-router-dom'
import { overdueService, OverdueSummary, OverdueContractItem } from '../../services/overdueService'
import { facilityService } from '../../services/facilityService'
import { useAuth } from '../../context/AuthContext'
import { Facility } from '../../types'
import { OverdueContractDetailModal } from './modals/OverdueContractDetailModal'
import { toast } from '../../utils/toast'

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
  const [filterStage, setFilterStage] = useState<'ALL' | 'GRACE_PERIOD' | 'WARNING' | 'PIN_REVOCATION' | 'SEALING_ELIGIBLE' | 'POLICY_UNCONFIGURED'>('ALL')
  const [pinStatusFilter, setPinStatusFilter] = useState<string>('ALL')
  const [sealingStatusFilter, setSealingStatusFilter] = useState<string>('ALL')
  const [isDemoFilter, setIsDemoFilter] = useState<boolean | undefined>(undefined)

  // Detail Modal
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null)

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
  const fetchContracts = useCallback(async () => {
    setIsLoading(true)
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
      setContracts(res?.content || [])
      setTotalElements(res?.totalElements || 0)
      setTotalPages(res?.totalPages || 1)
    } catch (err) {
      console.warn('Failed to load overdue contracts:', err)
      setContracts([])
      setTotalElements(0)
    } finally {
      setIsLoading(false)
    }
  }, [activeFacilityId, filterStage, pinStatusFilter, sealingStatusFilter, searchTerm, isDemoFilter, currentPage, pageSize])

  useEffect(() => {
    fetchSummary()
  }, [fetchSummary])

  useEffect(() => {
    fetchContracts()
  }, [fetchContracts])

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
    return `${num.toLocaleString('vi-VN')} ₫`
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
                <th className="p-3.5 font-bold">Ngày Đến Hạn &amp; Quá Hạn</th>
                <th className="p-3.5 font-bold">Chi Tiết Công Nợ</th>
                <th className="p-3.5 font-bold">SmartLock PIN/QR</th>
                <th className="p-3.5 font-bold">Hồ Sơ Niêm Phong</th>
                <th className="p-3.5 font-bold text-right">Thao Tác</th>
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
              ) : contracts.length > 0 ? (
                contracts.map(item => (
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
                          <span className="text-[11px] text-slate-400">Gốc:</span>
                          <span className="text-slate-700 font-medium">{formatVND(item.principalDebt)}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-rose-600">
                          <span>Phạt:</span>
                          <span className="font-bold">+{formatVND(item.lateFee)}</span>
                        </div>
                        <div className="font-mono font-black text-rose-700 text-sm mt-0.5">
                          {formatVND(item.totalDebt)}
                        </div>
                      </div>
                    </td>

                    {/* SmartLock Status */}
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
                        <div className="flex items-center gap-1 text-[10px] text-slate-500">
                          <span className={`w-1.5 h-1.5 rounded-full ${item.smartLockOnlineStatus === 'ONLINE' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                          {item.smartLockOnlineStatus}
                          {item.smartLockIsMock && (
                            <span className="text-purple-600 font-bold">[MOCK]</span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Sealing Status */}
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        item.sealingStatus === 'SEALING_COMPLETED' ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                        item.sealingStatus === 'SEALING_APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                        item.sealingStatus === 'SEALING_REQUESTED' ? 'bg-amber-100 text-amber-800' :
                        item.sealingStatus === 'SEALING_ELIGIBLE' ? 'bg-rose-100 text-rose-800' :
                        'bg-slate-100 text-slate-500'
                      }`}>
                        {item.sealingStatus === 'SEALING_COMPLETED' ? 'Đã niêm phong' :
                         item.sealingStatus === 'SEALING_APPROVED' ? 'Đã duyệt NP' :
                         item.sealingStatus === 'SEALING_REQUESTED' ? 'Chờ duyệt NP' :
                         item.sealingStatus === 'SEALING_ELIGIBLE' ? 'Đủ ĐK niêm phong' :
                         'Chưa niêm phong'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedContractId(item.contractId)}
                          className="px-3 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 shadow-xs flex items-center gap-1 cursor-pointer transition-all"
                        >
                          <span className="material-symbols-outlined text-[15px]">visibility</span>
                          Chi tiết
                        </button>
                      </div>
                    </td>

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
            Hiển thị <span className="font-bold text-slate-800 dark:text-slate-200">{contracts.length}</span> trên tổng số <span className="font-bold text-slate-800 dark:text-slate-200">{totalElements}</span> hợp đồng
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

      {/* Contract Detail Modal */}
      {selectedContractId && (
        <OverdueContractDetailModal
          isOpen={Boolean(selectedContractId)}
          contractId={selectedContractId}
          onClose={() => setSelectedContractId(null)}
          onRefreshParent={handleRefreshAll}
        />
      )}

    </div>
  )
}
