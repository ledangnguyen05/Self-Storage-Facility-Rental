import React, { useState, useEffect, useMemo } from 'react'
import { useOutletContext } from 'react-router-dom'
import { storageUnitService } from '../../services/storageUnitService'
import { facilityService } from '../../services/facilityService'
import { reportService } from '../../services/reportService'
import { userService } from '../../services/userService'
import { useLanguage } from '../../context/LanguageContext'
import { Facility, StorageUnit, OverdueDebtItem, User } from '../../types'
import { parseFacilityLayoutConfig } from '../../utils/facilityLayout'
import { IoTTelemetryModal } from './modals/IoTTelemetryModal'
import { FacilitySurveyModal } from './modals/FacilitySurveyModal'
import { AppActivationModal } from './modals/AppActivationModal'
import { DoorAccessHistoryModal } from './modals/DoorAccessHistoryModal'
import { ShiftAssignmentModal } from './modals/ShiftAssignmentModal'
import { NoticeDispatcherModal } from './modals/NoticeDispatcherModal'
import { AssetSealingModal } from './modals/AssetSealingModal'
import { BookingApprovalModal } from './modals/BookingApprovalModal'
import { CreateStorageUnitModal } from './modals/CreateStorageUnitModal'

interface InspectedUnit {
  id: string
  backendId?: string
  size: string
  type: string
  status: 'Available' | 'Rented' | 'Pending' | 'Overdue' | 'Maintenance'
  rawStatus?: string
  color: 'emerald' | 'blue' | 'amber' | 'rose' | 'red'
  tenant: string
  contract: string
  due: string
  battery: string
  smartlock: string
  lastAccess: string
  floorLevel: string
  pricePerMonth?: number
  facilityId?: string
  facilityName?: string
}

export const ManagerDashboard: React.FC = () => {
  const { t } = useLanguage()
  const { selectedFacility, setSelectedFacility, facilities: contextFacilities } = useOutletContext<{
    selectedFacility?: string
    setSelectedFacility?: (facId: string) => void
    facilities?: Facility[]
  }>() || {}

  const [facilities, setFacilities] = useState<Facility[]>(contextFacilities || [])
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>(
    selectedFacility && selectedFacility !== 'ALL' ? selectedFacility : (contextFacilities?.[0]?.id || '')
  )
  const [units, setUnits] = useState<InspectedUnit[]>([])
  const [overdueItems, setOverdueItems] = useState<OverdueDebtItem[]>([])
  const [staffList, setStaffList] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [selectedFloor, setSelectedFloor] = useState<'floor1' | 'floor2'>('floor1')
  const [sizeFilter, setSizeFilter] = useState<'all' | 's' | 'm' | 'l'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'Available' | 'Rented' | 'Pending' | 'Overdue' | 'Maintenance'>('all')
  const [showHeatmap, setShowHeatmap] = useState<boolean>(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUnit, setSelectedUnit] = useState<InspectedUnit | null>(null)
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null)
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean
    title: string
    description: string
    unitCode: string
    confirmText: string
    isDestructive?: boolean
    onConfirm: () => void
  } | null>(null)

  const [showIoTModal, setShowIoTModal] = useState(false)
  const [showSurveyModal, setShowSurveyModal] = useState(false)
  const [showBookingApprovalModal, setShowBookingApprovalModal] = useState(false)
  const [showCreateUnitModal, setShowCreateUnitModal] = useState(false)
  const [showAppActivationModal, setShowAppActivationModal] = useState(false)
  const [showDoorAccessModal, setShowDoorAccessModal] = useState(false)
  const [showShiftModal, setShowShiftModal] = useState(false)
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
    tenantName: string
    contractCode: string
    overdueDays: number
    totalDebt: string
  } | null>(null)

  useEffect(() => {
    if (contextFacilities && contextFacilities.length > 0) {
      setFacilities(contextFacilities)
    } else {
      facilityService.getFacilities()
        .then(res => {
          if (res?.content) setFacilities(res.content)
        })
        .catch(() => {})
    }
  }, [contextFacilities])

  useEffect(() => {
    let targetFacility = selectedFacility
    if (!targetFacility || targetFacility === 'ALL') {
      if (facilities.length > 0) {
        targetFacility = facilities[0].id
        if (setSelectedFacility) {
          setSelectedFacility(facilities[0].id)
        }
      }
    }
    if (targetFacility && targetFacility !== 'ALL') {
      setSelectedFacilityId(targetFacility)
      void fetchUnits(targetFacility)
    }
  }, [selectedFacility, facilities])

  const fetchUnits = async (facId?: string) => {
    setIsLoading(true)
    try {
      const targetId = (facId && facId !== 'ALL')
        ? facId
        : (selectedFacilityId && selectedFacilityId !== 'ALL' ? selectedFacilityId : facilities[0]?.id)

      const [unitsRes, debtRes, staffRes] = await Promise.allSettled([
        storageUnitService.getUnits(targetId ? { facilityId: targetId } : undefined),
        reportService.getOverdueDebtReport(targetId ? { facilityId: targetId } : undefined),
        userService.getAllUsers({ role: 'STAFF', facilityId: targetId, size: 50 })
      ])

      if (unitsRes.status === 'fulfilled' && Array.isArray(unitsRes.value) && unitsRes.value.length > 0) {
        const mapped: InspectedUnit[] = unitsRes.value.map((su: StorageUnit) => {
          const isAvail = su.status === 'AVAILABLE'
          const isOcc = su.status === 'OCCUPIED'
          const isMaint = su.status === 'UNDER_MAINTENANCE' || su.status === 'MAINTENANCE'
          const isRes = su.status === 'RESERVED'

          let status: InspectedUnit['status'] = 'Available'
          let color: InspectedUnit['color'] = 'emerald'
          if (isOcc) {
            status = 'Rented'
            color = 'blue'
          } else if (isMaint) {
            status = 'Maintenance'
            color = 'red'
          } else if (isRes) {
            status = 'Pending'
            color = 'amber'
          }

          return {
            id: su.unitCode,
            backendId: su.id,
            size: su.areaSqMeters ? `${su.areaSqMeters.toFixed(1)} m²` : '8.0 m²',
            type: su.unitTypeName || 'Standard Roll-up',
            status,
            rawStatus: su.status,
            color,
            tenant: su.tenantName || (isAvail ? 'Kho trống' : 'Đang cập nhật'),
            contract: su.contractCode || (isAvail ? 'Chưa có hợp đồng' : 'Chưa có mã HĐ'),
            due: su.dueDate ? new Date(su.dueDate).toLocaleDateString('vi-VN') : (isAvail ? '—' : 'Chưa xác định'),
            battery: su.batteryLevel || '98%',
            smartlock: su.smartLockSerial || `SL-${su.unitCode.replace('-', '')}`,
            lastAccess: su.lastAccessTime || (isAvail ? 'Chưa ghi nhận' : 'Chưa có lượt ra vào'),
            floorLevel: su.floorLevel || 'Floor 1',
            pricePerMonth: su.pricePerMonth,
            facilityId: su.facilityId,
            facilityName: su.facilityName
          }
        })
        mapped.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' }))
        setUnits(mapped)
        setSelectedUnit(prev => (prev?.id ? mapped.find(u => u.id === prev.id) : undefined) || mapped[0] || null)
      } else {
        setUnits([])
        setSelectedUnit(null)
      }

      if (debtRes.status === 'fulfilled' && debtRes.value?.items) {
        setOverdueItems(debtRes.value.items)
      } else {
        setOverdueItems([])
      }

      if (staffRes.status === 'fulfilled' && staffRes.value?.data) {
        setStaffList(staffRes.value.data)
      } else {
        setStaffList([])
      }
    } catch {
      setUnits([])
      setOverdueItems([])
      setStaffList([])
      setSelectedUnit(null)
    } finally {
      setIsLoading(false)
    }
  }

  const handleInspect = (unit: InspectedUnit) => {
    setSelectedUnit(unit)
  }

  const triggerAction = (msg: string) => {
    setActionSuccessMessage(msg)
    setTimeout(() => setActionSuccessMessage(null), 3000)
  }

  const handleStorageUnitCreated = (unit: StorageUnit) => {
    const targetFacilityId = unit.facilityId || selectedFacilityId
    if (targetFacilityId) {
      setSelectedFacilityId(targetFacilityId)
      if (setSelectedFacility && selectedFacility !== targetFacilityId) {
        setSelectedFacility(targetFacilityId)
      } else {
        void fetchUnits(targetFacilityId)
      }
    }
    triggerAction(`${t('Đã thêm kho', 'Added storage unit')} ${unit.unitCode}.`)
  }

  const handleToggleMaintenance = async () => {
    if (!selectedUnit) return
    try {
      if (selectedUnit.backendId) {
        const updated = await storageUnitService.toggleMaintenance(selectedUnit.backendId)
        const isNowMaint = updated.status === 'UNDER_MAINTENANCE' || updated.status === 'MAINTENANCE'
        const nextStatus: InspectedUnit['status'] = isNowMaint ? 'Maintenance' : 'Available'
        const nextColor: InspectedUnit['color'] = isNowMaint ? 'red' : 'emerald'

        setUnits(prev => prev.map(u => {
          if (u.id === selectedUnit.id) {
            return {
              ...u,
              status: nextStatus,
              rawStatus: updated.status,
              color: nextColor,
              tenant: isNowMaint ? 'ĐANG BẢO TRÌ SỬA CHỮA' : 'Chưa có khách',
              contract: isNowMaint ? 'TICKET-MAINTENANCE' : 'Trống',
              due: isNowMaint ? 'Dự kiến hôm nay' : '--'
            }
          }
          return u
        }))
        setSelectedUnit(prev => {
          if (!prev) return null
          return {
            ...prev,
            status: nextStatus,
            rawStatus: updated.status,
            color: nextColor,
            tenant: isNowMaint ? 'ĐANG BẢO TRÌ SỬA CHỮA' : 'Chưa có khách',
            contract: isNowMaint ? 'TICKET-MAINTENANCE' : 'Trống',
            due: isNowMaint ? 'Dự kiến hôm nay' : '--'
          }
        })

        triggerAction(`Đã cập nhật trạng thái kho #${selectedUnit.id} thành ${isNowMaint ? 'Bảo trì' : 'Sẵn sàng'} qua StorageUnit API!`)
      } else {
        const nextStatus = selectedUnit.status === 'Maintenance' ? 'Available' : 'Maintenance'
        setUnits(prev => prev.map(u => u.id === selectedUnit.id ? { ...u, status: nextStatus, color: nextStatus === 'Maintenance' ? 'red' : 'emerald' } : u))
        setSelectedUnit(prev => {
          if (!prev) return null
          return {
            ...prev,
            status: nextStatus,
            color: nextStatus === 'Maintenance' ? 'red' : 'emerald'
          }
        })
        triggerAction(`Đã chuyển đổi trạng thái bảo trì cho kho #${selectedUnit.id}`)
      }
    } catch (err: any) {
      triggerAction(`Không thể đổi trạng thái: ${err?.response?.data?.message || 'Kho đang có người thuê hoặc lỗi hệ thống'}`)
    }
  }

  // Deterministic physical zone segregation based on permanent unit codes
  const getUnitZone = (u: InspectedUnit): 'A' | 'B' | 'C' => {
    const code = u.id.toUpperCase()
    if (code.includes('-C') || /-[2-9]\d\d/.test(code) || (u.floorLevel || '').includes('2')) {
      return 'C'
    }
    if (code.includes('-B')) {
      return 'B'
    }
    if (code.includes('-A')) {
      return 'A'
    }
    const numMatch = code.match(/\d+/)
    if (numMatch) {
      const num = parseInt(numMatch[0], 10)
      if (num >= 200) return 'C'
      if (num > 106) return 'B'
      return 'A'
    }
    return 'A'
  }

  // Stable permanent inventory: order NEVER changes regardless of status changes or filtering
  const permanentAllUnits = useMemo(() => {
    return [...units].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' }))
  }, [units])

  const permanentZoneA = useMemo(() => permanentAllUnits.filter(u => getUnitZone(u) === 'A'), [permanentAllUnits])
  const permanentZoneB = useMemo(() => permanentAllUnits.filter(u => getUnitZone(u) === 'B'), [permanentAllUnits])
  const permanentZoneC = useMemo(() => permanentAllUnits.filter(u => getUnitZone(u) === 'C'), [permanentAllUnits])
  const permanentFloor1 = useMemo(() => [...permanentZoneA, ...permanentZoneB], [permanentZoneA, permanentZoneB])
  const permanentFloor2 = permanentZoneC

  // Filter evaluation predicate: does unit match current filters?
  const isUnitMatchingFilter = (u: InspectedUnit) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      const matchesSearch = u.id.toLowerCase().includes(q) || 
                            u.tenant.toLowerCase().includes(q) ||
                            u.contract.toLowerCase().includes(q) ||
                            u.type.toLowerCase().includes(q)
      if (!matchesSearch) return false
    }
    
    if (sizeFilter !== 'all') {
      const sizeNum = parseFloat(u.size)
      if (!isNaN(sizeNum)) {
        if (sizeFilter === 's' && !(sizeNum <= 6.5)) return false
        if (sizeFilter === 'm' && !(sizeNum > 6.5 && sizeNum <= 12)) return false
        if (sizeFilter === 'l' && !(sizeNum > 12)) return false
      }
    }

    if (statusFilter !== 'all' && u.status !== statusFilter) {
      return false
    }

    return true
  }

  const floor1MatchingCount = permanentFloor1.filter(isUnitMatchingFilter).length
  const floor2MatchingCount = permanentFloor2.filter(isUnitMatchingFilter).length
  const isAnyFilterActive = statusFilter !== 'all' || sizeFilter !== 'all' || searchQuery.trim().length > 0

  // Dynamic KPI counts
  const totalUnitsCount = units.length
  const rentedUnitsCount = units.filter(u => u.status === 'Rented').length
  const availableUnitsCount = units.filter(u => u.status === 'Available').length
  const maintenanceUnitsCount = units.filter(u => u.status === 'Maintenance').length
  const overdueUnitsCount = units.filter(u => u.status === 'Overdue').length
  const pendingUnitsCount = units.filter(u => u.status === 'Pending').length

  const rentedPercent = totalUnitsCount > 0 ? ((rentedUnitsCount / totalUnitsCount) * 100).toFixed(1) : '0.0'
  const availablePercent = totalUnitsCount > 0 ? ((availableUnitsCount / totalUnitsCount) * 100).toFixed(1) : '0.0'
  const maintenancePercent = totalUnitsCount > 0 ? ((maintenanceUnitsCount / totalUnitsCount) * 100).toFixed(1) : '0.0'
  const overduePercent = totalUnitsCount > 0 ? ((overdueUnitsCount / totalUnitsCount) * 100).toFixed(1) : '0.0'

  const currentFacility = useMemo(() => {
    return facilities.find(f => f.id === selectedFacilityId) || facilities[0] || null
  }, [facilities, selectedFacilityId])

  const currentFacilityName = currentFacility?.name || 'Cơ sở Boxora'

  // Display the floor plan configured by an admin, with generic defaults for unconfigured branches.
  const facilityProfile = useMemo(() => parseFacilityLayoutConfig(currentFacility?.layoutConfig), [currentFacility])

  const getStatusBadgeStyle = (status: InspectedUnit['status']) => {
    switch (status) {
      case 'Available': return 'bg-emerald-50 text-emerald-700 border-emerald-200'
      case 'Rented': return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'Pending': return 'bg-amber-50 text-amber-800 border-amber-200'
      case 'Overdue': return 'bg-rose-50 text-rose-700 border-rose-200'
      case 'Maintenance': return 'bg-rose-50 text-rose-700 border-rose-200'
    }
  }

  const getUnitCardBorder = (unit: InspectedUnit) => {
    const isSelected = selectedUnit?.id === unit.id ? 'ring-2 ring-slate-900 shadow-md z-10' : 'hover:-translate-y-0.5 hover:shadow-xs'
    switch (unit.color) {
      case 'emerald': return `border-t-2 border-t-emerald-500 hover:bg-slate-50/80 ${isSelected}`
      case 'blue': return `border-t-2 border-t-blue-600 hover:bg-slate-50/80 ${isSelected}`
      case 'amber': return `border-t-2 border-t-amber-500 hover:bg-slate-50/80 ${isSelected}`
      case 'rose':
      case 'red': return `border-t-2 border-t-rose-500 hover:bg-slate-50/80 ${isSelected}`
      default: return `border-t-2 border-t-slate-400 hover:bg-slate-50/80 ${isSelected}`
    }
  }

  const getUnitHeatmapInfo = (unit: InspectedUnit) => {
    if (unit.status === 'Available') {
      return { visits: 0, level: 'none', label: '0 lượt/tuần', badgeClass: 'bg-slate-100 text-slate-600 border border-slate-200' }
    }
    const charCode = unit.id.charCodeAt(unit.id.length - 1) + (unit.id.charCodeAt(unit.id.length - 2) || 0)
    const visits = (charCode % 18) + 3
    if (visits >= 14) {
      return { visits, level: 'high', label: `${visits} lượt/tuần`, badgeClass: 'bg-slate-100 text-slate-800 border border-slate-300 font-semibold' }
    }
    if (visits >= 8) {
      return { visits, level: 'med', label: `${visits} lượt/tuần`, badgeClass: 'bg-slate-100 text-slate-700 border border-slate-200' }
    }
    return { visits, level: 'low', label: `${visits} lượt/tuần`, badgeClass: 'bg-slate-100 text-slate-600 border border-slate-200' }
  }

  // Render each physical unit slot: permanently positioned in place
  const renderUnitCard = (unit: InspectedUnit) => {
    const isMatching = isUnitMatchingFilter(unit)
    const isSelected = selectedUnit?.id === unit.id
    const zone = getUnitZone(unit)
    const isClimate = zone === 'C'

    if (!isMatching) {
      return (
        <button
          key={unit.id}
          type="button"
          onClick={() => handleInspect(unit)}
          className={`flex flex-col p-2.5 rounded-lg text-left bg-slate-50/70 opacity-35 hover:opacity-90 grayscale border border-dashed border-slate-300 transition-all cursor-pointer relative ${
            isSelected ? 'ring-2 ring-slate-800 shadow-md !opacity-95 !grayscale-0' : ''
          }`}
          title={`Kho #${unit.id} (${unit.status}) - Không khớp bộ lọc hiện tại (bấm để xem)`}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-semibold text-slate-400">#{unit.id}</span>
            <span className="text-[9px] text-slate-400 font-mono uppercase">Slot</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5">{unit.size}</span>
          <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
            <span className="flex items-center gap-1 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
              {unit.status === 'Available' ? 'Trống' :
               unit.status === 'Rented' ? 'Thuê' :
               unit.status === 'Pending' ? 'Chờ giao' :
               unit.status === 'Overdue' ? 'Quá hạn' : 'Bảo trì'}
            </span>
          </div>
        </button>
      )
    }

    return (
      <button 
        key={unit.id}
        type="button" 
        onClick={() => handleInspect(unit)}
        className={`flex flex-col p-2.5 rounded-lg text-left bg-white transition-all group relative border border-slate-200 cursor-pointer shadow-2xs ${getUnitCardBorder(unit)}`}
        title={`Kho #${unit.id} - ${unit.status} (${unit.size})`}
      >
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs font-bold text-slate-900">#{unit.id}</span>
          {isClimate ? (
            <span className="material-symbols-outlined text-cyan-500 text-[14px]" title="Vi khí hậu 18-22°C">device_thermostat</span>
          ) : (
            <span className="text-[10px] font-mono text-slate-400 font-medium">
              {unit.smartlock.startsWith('SL-') ? unit.smartlock.slice(-4) : 'IoT'}
            </span>
          )}
        </div>
        <div className="flex items-baseline justify-between mt-0.5">
          <span className="text-[11px] text-slate-600 font-medium">{unit.size}</span>
          <span className="text-[10px] text-slate-400 truncate max-w-[65px]" title={unit.type}>
            {unit.type.replace('Storage', '').trim()}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span className={`text-[10px] font-bold flex items-center gap-1 ${
            unit.status === 'Available' ? 'text-emerald-700' :
            unit.status === 'Rented' ? 'text-blue-700' :
            unit.status === 'Pending' ? 'text-amber-700' :
            unit.status === 'Overdue' ? 'text-rose-700' : 'text-rose-700'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              unit.color === 'emerald' ? 'bg-emerald-500' :
              unit.color === 'blue' ? 'bg-blue-600' :
              unit.color === 'amber' ? 'bg-amber-500' : 'bg-rose-500'
            }`}></span>
            {unit.status === 'Available' ? 'Trống' :
             unit.status === 'Rented' ? 'Thuê' :
             unit.status === 'Pending' ? 'Chờ giao' :
             unit.status === 'Overdue' ? 'Quá hạn' : 'Bảo trì'}
          </span>
        </div>
        {showHeatmap && (
          <span className={`mt-1 text-[9px] px-1 py-0.5 rounded font-mono flex items-center gap-0.5 ${getUnitHeatmapInfo(unit).badgeClass}`}>
            <span className="material-symbols-outlined icon-xs text-slate-500">trending_up</span>
            {getUnitHeatmapInfo(unit).label}
          </span>
        )}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Action Notification Toast */}
      {actionSuccessMessage && (
        <div className="fixed top-24 right-8 z-50 flex items-center gap-2 px-4 py-3 bg-neutral-900 text-white rounded-lg shadow-xl border border-neutral-700 animate-in fade-in duration-200">
          <span className="material-symbols-outlined text-emerald-400 text-[20px]">check_circle</span>
          <span className="text-xs font-semibold">{actionSuccessMessage}</span>
        </div>
      )}

      {/* TOP CONTEXT & OCCUPANCY METRIC STRIP */}
      <section className="flex flex-col lg:flex-row items-stretch justify-between gap-4 p-6 bg-white rounded-xl shadow-sm relative overflow-hidden border border-slate-200">
        <div className="flex flex-col gap-2 max-w-2xl z-10">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-slate-100 font-mono text-xs text-slate-800 uppercase tracking-wider font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Trực quan thời gian thực
            </span>
            <span className="text-xs text-slate-500 font-medium">Bản cập nhật: {new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} (Hôm nay)</span>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {currentFacilityName} ({totalUnitsCount} Kho tự quản)
            </h1>
          </div>

          <p className="text-sm text-slate-600">
            {facilityProfile.title}: <strong className="text-slate-900 font-semibold">{facilityProfile.floor1Name}</strong> và <strong className="text-slate-900 font-semibold">{facilityProfile.floor2Name}</strong>.
          </p>
        </div>

        {/* Quick action & Facility Switcher */}
        <div className="flex items-center gap-3 self-start lg:self-center shrink-0 z-10 flex-wrap">
          <button
            type="button"
            onClick={() => setShowCreateUnitModal(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-blue-700 bg-blue-600 px-3.5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700 dark:border-blue-500 dark:bg-blue-600 dark:hover:bg-blue-500"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>{t('Thêm kho mới', 'Add storage unit')}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowBookingApprovalModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-amber-50 text-amber-900 font-semibold text-xs hover:bg-amber-100 transition-all border border-amber-200 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">fact_check</span>
            <span>Yêu cầu thuê</span>
          </button>
          <button 
            type="button" 
            onClick={() => fetchUnits(selectedFacilityId)}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-slate-100 text-slate-800 font-semibold text-xs hover:bg-slate-200 transition-all border border-slate-200 cursor-pointer shadow-2xs"
            title="Tải lại danh sách phòng kho mới nhất từ hệ thống"
          >
            <span className={`material-symbols-outlined text-[18px] text-blue-600 ${isLoading ? 'animate-spin' : ''}`}>sync</span>
            <span>{isLoading ? 'Đang tải...' : 'Làm mới'}</span>
          </button>
          <button 
            type="button" 
            onClick={() => setShowIoTModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-slate-100 text-slate-800 font-medium text-xs hover:bg-slate-200 transition-all border border-slate-200 cursor-pointer shadow-2xs"
            title="Mở bảng điều khiển giám sát mạng lưới IoT, độ trễ Ping và vi khí hậu"
          >
            <span>Kiểm tra trạm IoT</span>
          </button>
          <button 
            type="button" 
            onClick={() => setShowSurveyModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-blue-600 text-white font-medium text-xs shadow-xs hover:bg-blue-700 transition-all cursor-pointer"
            title="Tạo phiếu kiểm định an toàn PCCC, cửa cuốn và hạ tầng"
          >
            <span>Lập phiếu khảo sát</span>
          </button>
        </div>

        {/* Decorative background blueprint grid */}
        <div className="absolute right-0 top-0 bottom-0 w-96 opacity-5 pointer-events-none hidden md:block">
          <svg height="100%" width="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern height="24" id="facility-blueprint" patternUnits="userSpaceOnUse" width="24">
                <path d="M 24 0 L 0 0 0 24" fill="none" stroke="currentColor" strokeWidth="1"></path>
              </pattern>
            </defs>
            <rect fill="url(#facility-blueprint)" height="100%" width="100%"></rect>
          </svg>
        </div>
      </section>

      {/* 5 CRITICAL DYNAMIC KPI TILES */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Tile 1: Total Units */}
        <div 
          onClick={() => setStatusFilter('all')}
          className={`p-4 bg-white rounded-xl border flex flex-col justify-between hover:shadow-md transition-all duration-150 cursor-pointer ${
            statusFilter === 'all' 
              ? 'border-slate-800 ring-2 ring-slate-900/10 shadow-xs' 
              : 'border-slate-200 shadow-2xs hover:border-slate-300'
          }`}
          title="Bấm để hiển thị toàn bộ phòng kho"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-semibold text-slate-500">Tổng số kho</span>
            <span className="material-symbols-outlined text-slate-400 text-[20px]">warehouse</span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-extrabold font-mono tabular-nums text-slate-900 leading-none">{totalUnitsCount}</span>
            <span className="text-xs text-slate-500 font-medium">kho đơn vị</span>
          </div>
          <div className="mt-3 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-slate-900 h-full rounded-full" style={{ width: '100%' }}></div>
          </div>
        </div>

        {/* Tile 2: Rented */}
        <div 
          onClick={() => setStatusFilter(prev => prev === 'Rented' ? 'all' : 'Rented')}
          className={`p-4 bg-white rounded-xl border flex flex-col justify-between hover:shadow-md transition-all duration-150 cursor-pointer ${
            statusFilter === 'Rented' 
              ? 'border-blue-600 ring-2 ring-blue-500/20 shadow-xs bg-blue-50/20' 
              : 'border-slate-200 shadow-2xs hover:border-slate-300'
          }`}
          title="Bấm để lọc chỉ các kho đang cho thuê"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-semibold text-slate-500">Đang thuê hoạt động</span>
            <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-mono tabular-nums text-xs font-bold">{rentedPercent}%</span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-extrabold font-mono tabular-nums text-slate-900 leading-none">{rentedUnitsCount}</span>
            <span className="text-xs text-slate-500 font-medium">/ {totalUnitsCount} kho</span>
          </div>
          <div className="mt-3 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-blue-600 h-full rounded-full" style={{ width: `${rentedPercent}%` }}></div>
          </div>
        </div>

        {/* Tile 3: Available */}
        <div 
          onClick={() => setStatusFilter(prev => prev === 'Available' ? 'all' : 'Available')}
          className={`p-4 bg-white rounded-xl border flex flex-col justify-between hover:shadow-md transition-all duration-150 cursor-pointer ${
            statusFilter === 'Available' 
              ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs bg-emerald-50/20' 
              : 'border-slate-200 shadow-2xs hover:border-slate-300'
          }`}
          title="Bấm để lọc chỉ các kho trống sẵn sàng"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-semibold text-slate-500">Kho trống sẵn sàng</span>
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-extrabold font-mono tabular-nums text-emerald-600 leading-none">{availableUnitsCount}</span>
            <span className="text-xs text-slate-500 font-medium">kho nhận ngay</span>
          </div>
          <div className="mt-3 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${availablePercent}%` }}></div>
          </div>
        </div>

        {/* Tile 4: Maintenance */}
        <div 
          onClick={() => setStatusFilter(prev => prev === 'Maintenance' ? 'all' : 'Maintenance')}
          className={`p-4 bg-white rounded-xl border flex flex-col justify-between hover:shadow-md transition-all duration-150 cursor-pointer ${
            statusFilter === 'Maintenance' 
              ? 'border-rose-500 ring-2 ring-rose-500/20 shadow-xs bg-rose-50/20' 
              : 'border-slate-200 shadow-2xs hover:border-slate-300'
          }`}
          title="Bấm để lọc các kho đang bảo trì"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-semibold text-slate-500">Đang bảo trì kỹ thuật</span>
            <span className="material-symbols-outlined text-rose-500 text-[18px]">build_circle</span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-extrabold font-mono tabular-nums text-rose-600 leading-none">
              {maintenanceUnitsCount < 10 ? `0${maintenanceUnitsCount}` : maintenanceUnitsCount}
            </span>
            <span className="text-xs text-slate-500 font-medium">kho ngưng dùng</span>
          </div>
          <div className="mt-3 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-rose-500 h-full rounded-full" style={{ width: `${maintenancePercent}%` }}></div>
          </div>
        </div>

        {/* Tile 5: Overdue */}
        <div 
          onClick={() => setStatusFilter(prev => prev === 'Overdue' ? 'all' : 'Overdue')}
          className={`p-4 bg-white rounded-xl border flex flex-col justify-between col-span-2 md:col-span-1 hover:shadow-md transition-all duration-150 cursor-pointer ${
            statusFilter === 'Overdue' 
              ? 'border-rose-500 ring-2 ring-rose-500/20 shadow-xs bg-rose-50/20' 
              : 'border-slate-200 shadow-2xs hover:border-slate-300'
          }`}
          title="Bấm để lọc các kho nợ cước quá hạn"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-semibold text-slate-500">Quá hạn thanh toán</span>
            <span className="material-symbols-outlined text-rose-600 text-[18px]">lock_clock</span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-extrabold font-mono tabular-nums text-rose-700 leading-none">
              {overdueUnitsCount < 10 ? `0${overdueUnitsCount}` : overdueUnitsCount}
            </span>
            <span className="text-xs text-slate-500 font-medium">khóa điện tử tạm</span>
          </div>
          <div className="mt-3 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-rose-600 h-full rounded-full" style={{ width: `${overduePercent}%` }}></div>
          </div>
        </div>
      </section>

      {/* INTERACTIVE FLOOR GRID MAP & CONTEXTUAL SLIDE DRAWER CONTAINER */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* LEFT & CENTER: FLOOR MATRIX CANVAS (xl:col-span-8) */}
        <div className="xl:col-span-8 flex flex-col gap-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          {/* Controls Toolbar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200">
            {/* Floor Selector Tabs */}
            <div className="inline-flex p-1 bg-white rounded-lg border border-slate-200 shadow-2xs">
              <button 
                type="button" 
                onClick={() => setSelectedFloor('floor1')}
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md font-semibold text-xs transition-all cursor-pointer ${
                  selectedFloor === 'floor1' 
                    ? 'bg-slate-900 text-white shadow-xs' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <span>{facilityProfile.floor1Name}</span>
                <span className={`px-1.5 py-0.2 rounded font-mono tabular-nums text-[11px] font-bold ${
                  selectedFloor === 'floor1' ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-600'
                }`}>
                  {isAnyFilterActive ? `${floor1MatchingCount}/${permanentFloor1.length}` : permanentFloor1.length}
                </span>
              </button>
              <button 
                type="button" 
                onClick={() => setSelectedFloor('floor2')}
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md font-semibold text-xs transition-all cursor-pointer ${
                  selectedFloor === 'floor2' 
                    ? 'bg-slate-900 text-white shadow-xs' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <span>{facilityProfile.floor2Name}</span>
                <span className={`px-1.5 py-0.2 rounded font-mono tabular-nums text-[11px] font-bold ${
                  selectedFloor === 'floor2' ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-600'
                }`}>
                  {isAnyFilterActive ? `${floor2MatchingCount}/${permanentFloor2.length}` : permanentFloor2.length}
                </span>
              </button>
            </div>

            {/* Filter and Search Matrix */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Heatmap Mode Toggle */}
              <button
                type="button"
                onClick={() => setShowHeatmap(prev => !prev)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  showHeatmap 
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs' 
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 shadow-2xs'
                }`}
                title="Bật/Tắt hiển thị bản đồ nhiệt mật độ tần suất ra vào kho"
              >
                <span className="material-symbols-outlined icon-sm">{showHeatmap ? 'analytics' : 'insights'}</span>
                <span>Bản đồ nhiệt ({showHeatmap ? 'Bật' : 'Tắt'})</span>
              </button>

              <select 
                value={sizeFilter}
                onChange={(e) => setSizeFilter(e.target.value as any)}
                className="px-3 py-1.5 bg-white rounded-lg text-slate-800 text-xs border border-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-400 shadow-2xs font-medium cursor-pointer"
              >
                <option value="all">Tất cả kích thước</option>
                <option value="s">Kho nhỏ S (≤ 6.5m²)</option>
                <option value="m">Kho vừa M (8m² - 12m²)</option>
                <option value="l">Kho lớn L (15m² - 20m²)</option>
              </select>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px] text-slate-400">filter_alt</span>
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm mã kho (#A-101), khách thuê, HĐ..." 
                  className="pl-8 pr-3 py-1.5 bg-white text-slate-800 text-xs rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 border border-slate-200 shadow-2xs w-48 sm:w-60 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Dynamic Color Legend Bar */}
          <div className="flex items-center flex-wrap gap-2 px-3 py-2 bg-slate-50/80 rounded-xl border border-slate-200 text-xs font-medium">
            <button 
              type="button" 
              onClick={() => setStatusFilter(prev => prev === 'Available' ? 'all' : 'Available')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium cursor-pointer transition-all ${
                statusFilter === 'Available' 
                  ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-500/30 text-emerald-950 font-bold shadow-xs' 
                  : 'bg-white border-slate-200/80 hover:bg-slate-50 text-slate-700 shadow-2xs'
              }`}
              title="Nhấp để lọc chỉ hiển thị các kho trống"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span>Kho trống</span>
              <span className="font-mono tabular-nums font-bold text-slate-900 ml-0.5">({availableUnitsCount})</span>
            </button>
            <button 
              type="button" 
              onClick={() => setStatusFilter(prev => prev === 'Rented' ? 'all' : 'Rented')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium cursor-pointer transition-all ${
                statusFilter === 'Rented' 
                  ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-500/30 text-blue-950 font-bold shadow-xs' 
                  : 'bg-white border-slate-200/80 hover:bg-slate-50 text-slate-700 shadow-2xs'
              }`}
              title="Nhấp để lọc chỉ hiển thị các kho đang cho thuê"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
              <span>Đang thuê</span>
              <span className="font-mono tabular-nums font-bold text-slate-900 ml-0.5">({rentedUnitsCount})</span>
            </button>
            <button 
              type="button" 
              onClick={() => setStatusFilter(prev => prev === 'Pending' ? 'all' : 'Pending')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium cursor-pointer transition-all ${
                statusFilter === 'Pending' 
                  ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-500/30 text-amber-950 font-bold shadow-xs' 
                  : 'bg-white border-slate-200/80 hover:bg-slate-50 text-slate-700 shadow-2xs'
              }`}
              title="Nhấp để lọc chỉ hiển thị các kho chờ bàn giao"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              <span>Chờ bàn giao</span>
              <span className="font-mono tabular-nums font-bold text-slate-900 ml-0.5">({pendingUnitsCount})</span>
            </button>
            <button 
              type="button" 
              onClick={() => setStatusFilter(prev => prev === 'Overdue' ? 'all' : 'Overdue')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium cursor-pointer transition-all ${
                statusFilter === 'Overdue' 
                  ? 'bg-rose-50 border-rose-400 ring-2 ring-rose-500/30 text-rose-950 font-bold shadow-xs' 
                  : 'bg-white border-slate-200/80 hover:bg-slate-50 text-slate-700 shadow-2xs'
              }`}
              title="Nhấp để lọc chỉ hiển thị các kho nợ cước quá hạn"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600"></span>
              <span>Quá hạn nợ</span>
              <span className="font-mono tabular-nums font-bold text-slate-900 ml-0.5">({overdueUnitsCount})</span>
            </button>
            <button 
              type="button" 
              onClick={() => setStatusFilter(prev => prev === 'Maintenance' ? 'all' : 'Maintenance')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium cursor-pointer transition-all ${
                statusFilter === 'Maintenance' 
                  ? 'bg-rose-50 border-rose-400 ring-2 ring-rose-500/30 text-rose-950 font-bold shadow-xs' 
                  : 'bg-white border-slate-200/80 hover:bg-slate-50 text-slate-700 shadow-2xs'
              }`}
              title="Nhấp để lọc các kho đang bảo trì kỹ thuật"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
              <span>Bảo trì kỹ thuật</span>
              <span className="font-mono tabular-nums font-bold text-slate-900 ml-0.5">({maintenanceUnitsCount})</span>
            </button>

            {statusFilter !== 'all' && (
              <button 
                type="button" 
                onClick={() => setStatusFilter('all')}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-900 text-white text-[11px] font-semibold hover:bg-neutral-800 transition-all cursor-pointer shadow-xs ml-auto"
                title="Bỏ lọc trạng thái và hiển thị lại toàn bộ kho"
              >
                <span className="material-symbols-outlined text-[14px]">filter_alt_off</span>
                <span>Bỏ lọc trạng thái</span>
              </button>
            )}
          </div>

          {/* VISUAL MATRIX: WAREHOUSE CORRIDOR LAYOUT */}
          <div className="relative bg-slate-100 p-4 rounded-xl border border-slate-200 overflow-x-auto">
            {/* Physical Corridor Blueprint Overlay */}
            <div className="flex items-center justify-between px-3.5 py-2 mb-3 bg-white rounded-lg font-mono text-[11px] text-slate-600 uppercase tracking-wider border border-slate-200 shadow-2xs">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px] text-slate-500">meeting_room</span> 
                {selectedFloor === 'floor1' ? facilityProfile.loadingBayFloor1 : facilityProfile.loadingBayFloor2}
              </span>
              <span className="font-semibold text-slate-800 flex items-center gap-2">
                <span>{selectedFloor === 'floor1' ? facilityProfile.corridorNorth : facilityProfile.corridorClimate}</span>
                {showHeatmap && (
                  <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-bold border border-amber-300">
                    Bản đồ nhiệt: Mật độ truy cập 30 ngày
                  </span>
                )}
              </span>
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px] text-rose-500">emergency</span> 
                {selectedFloor === 'floor1' ? facilityProfile.exitFloor1 : facilityProfile.exitFloor2}
              </span>
            </div>

            {selectedFloor === 'floor2' ? (
              /* ZONE C GRID (FLOOR 2) */
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-cyan-900 uppercase flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-cyan-600 text-[18px]">warehouse</span>
                      {facilityProfile.zoneCName}
                    </span>
                    {showHeatmap && (
                      <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-900 text-[10px] font-mono font-semibold border border-blue-200 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">footprint</span>
                        Lưu lượng: 38 lượt/ngày
                      </span>
                    )}
                  </div>
                  {facilityProfile.zoneCDesc && <span className="text-[11px] text-slate-500">{facilityProfile.zoneCDesc}</span>}
                </div>
                {permanentZoneC.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs bg-white rounded-lg border border-slate-200">
                    Chưa có thiết kế kho trên Tầng 2 cho cơ sở này
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-6 gap-2">
                    {permanentZoneC.map(unit => renderUnitCard(unit))}
                  </div>
                )}
              </div>
            ) : (
              /* FLOOR 1: ZONE A & ZONE B */
              <>
                {/* ZONE A GRID */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900 uppercase flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-slate-600 text-[18px]">inventory_2</span>
                        {facilityProfile.zoneAName}
                      </span>
                      {showHeatmap && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 text-[10px] font-mono font-semibold border border-slate-300 flex items-center gap-1">
                          <span className="material-symbols-outlined icon-xs text-slate-600">trending_up</span>
                          Mật độ cao: 94 lượt/ngày
                        </span>
                      )}
                    </div>
                    {facilityProfile.zoneADesc && <span className="text-[11px] text-slate-500">{facilityProfile.zoneADesc}</span>}
                  </div>
                  {permanentZoneA.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 text-xs bg-white rounded-lg border border-slate-200">
                      Chưa có thiết kế kho tại Phân khu A cho cơ sở này
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-6 gap-2">
                      {permanentZoneA.map(unit => renderUnitCard(unit))}
                    </div>
                  )}
                </div>

                {/* ZONE B GRID */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900 uppercase flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-slate-600 text-[18px]">inventory</span>
                        {facilityProfile.zoneBName}
                      </span>
                      {showHeatmap && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 text-[10px] font-mono font-semibold border border-slate-300 flex items-center gap-1">
                          <span className="material-symbols-outlined icon-xs text-slate-600">trending_up</span>
                          Mật độ vừa: 62 lượt/ngày
                        </span>
                      )}
                    </div>
                    {facilityProfile.zoneBDesc && <span className="text-[11px] text-slate-500">{facilityProfile.zoneBDesc}</span>}
                  </div>
                  {permanentZoneB.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 text-xs bg-white rounded-lg border border-slate-200">
                      Chưa có thiết kế kho tại Phân khu B cho cơ sở này
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-6 gap-2">
                      {permanentZoneB.map(unit => renderUnitCard(unit))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Elevator & Loading Bay Corridor Footer */}
            <div className="mt-4 pt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-200">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1 font-medium">
                  <span className="material-symbols-outlined text-[16px] text-slate-600">elevator</span> 
                  {selectedFloor === 'floor1' ? facilityProfile.loadingBayFloor1 : facilityProfile.loadingBayFloor2}
                </span>
                <span className="flex items-center gap-1 font-medium text-emerald-700">
                  <span className="material-symbols-outlined text-[16px]">wifi</span> 
                  Mạng lưới IoT LoRaWAN Mesh: Ổn định (Ping 14ms)
                </span>
              </div>
              {(selectedFloor === 'floor1' ? facilityProfile.totalAreaFloor1 : facilityProfile.totalAreaFloor2) && (
                <span className="font-mono font-semibold text-slate-700">
                  {selectedFloor === 'floor1' ? facilityProfile.totalAreaFloor1 : facilityProfile.totalAreaFloor2}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: CONTEXTUAL INSPECTION SLIDE-DRAWER PANEL (xl:col-span-4) */}
        {selectedUnit ? (
        <div className="xl:col-span-4 flex flex-col gap-4 bg-white p-6 rounded-xl shadow-xs border border-slate-200 sticky top-20 max-h-[calc(100vh-5.5rem)] overflow-y-auto">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-100 text-slate-800">
                <span className="material-symbols-outlined text-[24px]">door_sliding</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">Chi tiết kho giám sát</span>
                <h2 className="text-xl font-bold text-slate-900 font-mono">#{selectedUnit.id}</h2>
              </div>
            </div>
            <span className={`px-2.5 py-1 rounded-full font-mono text-xs font-bold border ${getStatusBadgeStyle(selectedUnit.status)}`}>
              {selectedUnit.status === 'Available' ? 'Kho trống' :
               selectedUnit.status === 'Rented' ? 'Đang thuê' :
               selectedUnit.status === 'Pending' ? 'Chờ bàn giao' :
               selectedUnit.status === 'Overdue' ? 'Quá hạn nợ' : 'Đang bảo trì'}
            </span>
          </div>

          {/* Live Photo of Storage Bay */}
          <div className="relative w-full h-44 rounded-lg overflow-hidden bg-slate-900 border border-slate-200 shadow-inner">
            <img 
              className="w-full h-full object-cover" 
              src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800&auto=format&fit=crop&q=80" 
              alt={`Storage Bay ${selectedUnit.id}`}
            />
            <div className="absolute bottom-2 left-2 px-2.5 py-1 bg-slate-900/85 backdrop-blur-sm rounded text-white font-mono text-[11px] flex items-center gap-1.5 shadow-sm">
              <span className="material-symbols-outlined text-[14px] text-emerald-400">photo_camera</span> 
              Cam An Ninh Phân Khu {getUnitZone(selectedUnit)} · Slot #{selectedUnit.id}
            </div>
          </div>

          {/* Unit Spec Table */}
          <div className="flex flex-col gap-1.5 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
            <div className="flex items-center justify-between py-1 text-xs border-b border-slate-200/50">
              <span className="text-slate-500">Cơ sở trực thuộc:</span>
              <span className="font-semibold text-slate-800">{selectedUnit.facilityName || currentFacilityName}</span>
            </div>
            <div className="flex items-center justify-between py-1 text-xs border-b border-slate-200/50">
              <span className="text-slate-500">Vị trí &amp; Phân khu:</span>
              <span className="font-mono font-semibold text-slate-900">{selectedUnit.floorLevel} · Phân khu {getUnitZone(selectedUnit)}</span>
            </div>
            <div className="flex items-center justify-between py-1 text-xs border-b border-slate-200/50">
              <span className="text-slate-500">Diện tích kho:</span>
              <span className="font-mono font-bold text-slate-900">{selectedUnit.size}</span>
            </div>
            <div className="flex items-center justify-between py-1 text-xs border-b border-slate-200/50">
              <span className="text-slate-500">Quy chuẩn kho:</span>
              <span className="font-medium text-slate-800">{selectedUnit.type}</span>
            </div>
            <div className="flex items-center justify-between py-1 text-xs border-b border-slate-200/50">
              <span className="text-slate-500">Đơn giá tham chiếu:</span>
              <span className="font-mono font-bold text-emerald-600">
                {selectedUnit.pricePerMonth ? `${Number(selectedUnit.pricePerMonth).toLocaleString('vi-VN')} đ/tháng` : 'Liên hệ tư vấn'}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 text-xs border-b border-slate-200/50">
              <span className="text-slate-500">Khách thuê hiện tại:</span>
              <span className="font-semibold text-slate-900 text-right">{selectedUnit.tenant}</span>
            </div>
            <div className="flex items-center justify-between py-1 text-xs border-b border-slate-200/50">
              <span className="text-slate-500">Mã hợp đồng:</span>
              <span className="font-mono font-bold text-blue-600">{selectedUnit.contract}</span>
            </div>
            <div className="flex items-center justify-between py-1 text-xs">
              <span className="text-slate-500">Thời hạn thuê:</span>
              <span className="font-mono font-semibold text-slate-800">{selectedUnit.due}</span>
            </div>
          </div>

          {/* Smart Lock & IoT Telemetry */}
          <div className="flex flex-col gap-2 bg-slate-100 p-3.5 rounded-lg border border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-800">Smart Lock Seri</span>
              </div>
              <span className="font-mono text-xs font-bold text-slate-900">{selectedUnit.smartlock}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <div className="flex flex-col p-2 bg-white rounded border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Pin SmartLock</span>
                <span className="font-mono text-xs font-bold text-slate-900 flex items-center gap-1 mt-0.5">
                  <span className="material-symbols-outlined text-[16px] text-emerald-600">battery_full</span> 
                  {selectedUnit.battery} (Tốt)
                </span>
              </div>
              <div className="flex flex-col p-2 bg-white rounded border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Truy cập gần nhất</span>
                <span className="font-mono text-[11px] font-bold text-slate-800 mt-0.5">{selectedUnit.lastAccess}</span>
              </div>
            </div>
          </div>

          {/* Operational Action Buttons */}
          <div className="flex flex-col gap-2 pt-1">
            <button 
              type="button" 
              onClick={() => {
                if (selectedUnit.status === 'Available') {
                  triggerAction(`Chuyển tới quy trình ký hợp đồng thuê cho kho #${selectedUnit.id}`)
                } else if (selectedUnit.status === 'Pending') {
                  setShowAppActivationModal(true)
                } else if (selectedUnit.status === 'Rented') {
                  setShowAppActivationModal(true)
                } else if (selectedUnit.status === 'Overdue') {
                  triggerAction(`Chuyển tới giao diện xử lý nợ cước kho #${selectedUnit.id}`)
                } else if (selectedUnit.status === 'Maintenance') {
                  handleToggleMaintenance()
                }
              }}
              className="w-full py-2.5 px-4 rounded-lg bg-slate-900 text-white font-semibold text-xs flex items-center justify-center gap-2 hover:bg-neutral-800 transition-all shadow-xs cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">
                {selectedUnit.status === 'Available' ? 'add_shopping_cart' :
                 selectedUnit.status === 'Pending' ? 'key' :
                 selectedUnit.status === 'Rented' ? 'lock_reset' :
                 selectedUnit.status === 'Overdue' ? 'lock_person' : 'build_circle'}
              </span>
              <span>
                {selectedUnit.status === 'Available' ? 'Tạo Hợp Đồng Thuê Kho Này' :
                 selectedUnit.status === 'Pending' ? 'Bàn Giao Mã Khóa & Kích Hoạt App' :
                 selectedUnit.status === 'Rented' ? 'Cấp Lại Mã PIN / Reset SmartLock' :
                 selectedUnit.status === 'Overdue' ? 'Xử Lý Nợ / Khóa Cưỡng Chế' : 'Hoàn Tất Bảo Trì (Mở Lại Kho)'}
              </span>
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button 
                type="button" 
                onClick={() => setShowDoorAccessModal(true)}
                className="py-2 px-3 rounded-lg bg-slate-100 text-slate-800 font-medium text-xs flex items-center justify-center gap-1 hover:bg-slate-200 transition-all border border-slate-200 cursor-pointer"
                title="Xem toàn bộ nhật ký mở cửa và lịch sử truy cập SmartLock"
              >
                <span className="material-symbols-outlined text-[16px]">history</span>
                <span>Lịch sử mở cửa</span>
              </button>
              <button 
                type="button" 
                onClick={handleToggleMaintenance}
                className={`py-2 px-3 rounded-lg font-medium text-xs flex items-center justify-center gap-1 transition-all border cursor-pointer ${
                  selectedUnit.status === 'Maintenance'
                    ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200'
                    : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border-amber-200'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">build</span>
                <span>{selectedUnit.status === 'Maintenance' ? 'Mở lại kho (Khả dụng)' : 'Chuyển bảo trì'}</span>
              </button>
            </div>
          </div>
        </div>
        ) : (
          <div className="xl:col-span-4 flex flex-col items-center justify-center p-10 bg-white rounded-xl shadow-xs border border-slate-200 sticky top-20 text-center min-h-[360px]">
            <span className="material-symbols-outlined text-slate-300 text-[48px] mb-2">grid_view</span>
            <h3 className="text-sm font-bold text-slate-700">Chọn một kho từ sơ đồ</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
              Bấm vào bất kỳ ô kho nào trong sơ đồ để xem thông số kỹ thuật, tình trạng pin SmartLock và trạng thái hợp đồng.
            </p>
          </div>
        )}
      </section>

      {/* BOTTOM SECTION: OVERDUE HANDLING & STAFF WORKFORCE ALLOCATION */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT (col-span-7): OVERDUE DELINQUENCY & AUTOMATED LOCKOUT CONSOLE */}
        <div className="lg:col-span-7 flex flex-col gap-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-rose-50 text-rose-700 border border-rose-200">
                <span className="material-symbols-outlined icon-md">warning</span>
              </div>
              <div className="flex flex-col">
                <h3 className="text-base font-bold text-slate-900">Xử lý Nợ cước Quá hạn (Overdue Handling)</h3>
                <span className="text-xs text-slate-500">
                  {overdueItems.length > 0
                    ? `Phát hiện ${overdueItems.length < 10 ? `0${overdueItems.length}` : overdueItems.length} hợp đồng vi phạm điều khoản thanh toán kỳ hạn`
                    : 'Không phát hiện vi phạm kỳ hạn thanh toán tại cơ sở'}
                </span>
              </div>
            </div>
            <span className={`px-3 py-1 rounded-full font-mono text-xs font-bold border ${overdueItems.length > 0 ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
              {overdueItems.length > 0 ? `${overdueItems.length} Cần xử lý` : 'Ổn định'}
            </span>
          </div>

          {/* Delinquent Cases Stack */}
          <div className="flex flex-col gap-3">
            {overdueItems.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs bg-slate-50 rounded-xl border border-slate-200">
                <span className="material-symbols-outlined text-[32px] text-emerald-500 mb-1">verified</span>
                <p className="font-bold text-slate-800 text-sm">Không có nợ cước quá hạn</p>
                <p className="text-slate-500 text-xs mt-0.5">Tất cả hợp đồng tại cơ sở đang được thanh toán đúng kỳ hạn.</p>
              </div>
            ) : (
              overdueItems.map((item) => (
                <div key={item.contractId} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-slate-50 rounded-xl gap-4 border border-slate-200">
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-mono text-xs font-bold">Kho #{item.unitCode}</span>
                      <span className="text-xs font-bold text-slate-900 truncate">{item.customerName || 'Khách hàng'} (HĐ #{item.contractCode})</span>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap text-slate-600 text-xs mt-1">
                      <span className="text-rose-600 font-semibold flex items-center gap-1">
                        <span className="material-symbols-outlined icon-xs">schedule</span> Quá hạn {item.daysOverdue} ngày
                      </span>
                      <span>Cước nợ: <strong className="text-slate-900 font-mono">{Number(item.unpaidRent || 0).toLocaleString('vi-VN')}đ</strong></span>
                      <span>Phí phạt: <strong className="text-rose-600 font-mono">{Number(item.totalLateFee || 0).toLocaleString('vi-VN')}đ</strong></span>
                      <span>Tổng nợ: <strong className="text-rose-700 font-mono font-bold">{Number(item.totalDebt || 0).toLocaleString('vi-VN')}đ</strong></span>
                    </div>
                    <span className="text-[11px] text-slate-500 mt-1">
                      Trạng thái: {item.overdueStage === 'ACCESS_BLOCKED' ? 'Đã khóa tạm SmartLock' : item.overdueStage === 'ELIGIBLE_FOR_SEALING' ? 'Đủ điều kiện niêm phong tài sản' : 'Đang trong thời gian ân hạn / nhắc cước'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    <button 
                      type="button" 
                      onClick={() => setNoticeModalData({
                        unitCode: item.unitCode,
                        tenantName: item.customerName || 'Khách hàng',
                        contractCode: item.contractCode,
                        daysOverdue: Number(item.daysOverdue) || 0,
                        baseDebt: `${Number(item.unpaidRent || 0).toLocaleString('vi-VN')}đ`,
                        penaltyFee: `${Number(item.totalLateFee || 0).toLocaleString('vi-VN')}đ`,
                        totalDebt: `${Number(item.totalDebt || 0).toLocaleString('vi-VN')}đ`
                      })}
                      className="px-3 py-2 rounded-lg bg-white text-slate-800 text-xs font-medium border border-slate-200 hover:bg-slate-100 transition-all flex items-center gap-1 shadow-xs cursor-pointer"
                    >
                      <span className="material-symbols-outlined icon-xs">forward_to_inbox</span>
                      <span>Gửi thông báo</span>
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setConfirmModal({
                        isOpen: true,
                        title: 'Xác nhận Khóa tạm (Lockout) SmartLock',
                        description: `Hành động này sẽ ngắt mã PIN và thu hồi quyền mở khóa qua ứng dụng di động của khách hàng ${item.customerName || 'khách'} đối với kho #${item.unitCode} (Quá hạn ${item.daysOverdue} ngày). Thao tác này sẽ ghi nhận vào nhật ký an ninh hệ thống.`,
                        unitCode: `Kho #${item.unitCode}`,
                        confirmText: 'Xác nhận Khóa SmartLock',
                        isDestructive: true,
                        onConfirm: () => {
                          triggerAction(`Đã kích hoạt khóa cưỡng chế SmartLock kho #${item.unitCode} thành công!`)
                          setConfirmModal(null)
                        }
                      })}
                      className="px-3 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold shadow-xs hover:bg-rose-700 transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined icon-xs">lock_person</span>
                      <span>Khóa tạm (Lockout)</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT (col-span-5): WORKFORCE & ON-DUTY SHIFT ROSTER */}
        <div className="lg:col-span-5 flex flex-col gap-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-100 text-slate-800">
                <span className="material-symbols-outlined text-[22px]">badge</span>
              </div>
              <div className="flex flex-col">
                <h3 className="text-base font-bold text-slate-900">
                  Nhân sự Trực ca ({staffList.length} Nhân viên)
                </h3>
                <span className="text-xs text-slate-500">Ca trực thực tế tại {currentFacilityName}</span>
              </div>
            </div>
            <button 
              type="button" 
              onClick={() => setShowShiftModal(true)}
              className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-800 text-xs font-semibold hover:bg-slate-200 transition-all flex items-center gap-1 border border-slate-200 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">person_add</span> Phân công mới
            </button>
          </div>

          {/* Staff List */}
          <div className="flex flex-col gap-2 divide-y divide-slate-100 max-h-96 overflow-y-auto pr-1">
            {staffList.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-xs">
                Chưa có nhân sự nào được phân công tại cơ sở này.
              </div>
            ) : (
              staffList.slice(0, 6).map((staff, idx) => (
                <div key={staff.id || idx} className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-slate-50 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-sm border border-slate-300">
                        {(staff.fullName || staff.username || 'NV').slice(0, 2).toUpperCase()}
                      </div>
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white"></span>
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-xs font-bold text-slate-900">{staff.fullName || staff.username}</span>
                      <span className="text-[11px] text-slate-500">{staff.email || staff.phone || staff.facilityName || 'Nhân viên Boxora'}</span>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-mono text-[11px] font-bold border border-emerald-200">
                    {staff.isActive ? 'Đang trực' : 'Ngoại tuyến'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* SAFETY CONFIRMATION MODAL */}
      {confirmModal?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-4">
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-xl shrink-0 ${confirmModal.isDestructive ? 'bg-rose-100 text-rose-700' : 'bg-orange-100 text-orange-700'}`}>
                <span className="material-symbols-outlined text-[28px]">
                  {confirmModal.isDestructive ? 'security_update_warning' : 'rule'}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="text-base font-bold text-slate-900 leading-snug">
                  {confirmModal.title}
                </h3>
                <span className="inline-block px-2 py-0.5 rounded bg-slate-100 font-mono text-xs font-semibold text-slate-700 w-fit">
                  Mục tiêu: {confirmModal.unitCode}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-lg border border-slate-200">
              {confirmModal.description}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-all border border-slate-200 cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => confirmModal.onConfirm()}
                className={`px-4 py-2 rounded-lg text-xs font-bold text-white transition-all shadow-sm cursor-pointer ${
                  confirmModal.isDestructive 
                    ? 'bg-rose-700 hover:bg-rose-800' 
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1. IOT TELEMETRY DASHBOARD MODAL */}
      <IoTTelemetryModal
        isOpen={showIoTModal}
        onClose={() => setShowIoTModal(false)}
        facilityName={currentFacilityName}
        totalUnits={totalUnitsCount}
      />

      {/* 2. FACILITY SURVEY & SAFETY INSPECTION MODAL */}
      <FacilitySurveyModal
        isOpen={showSurveyModal}
        onClose={() => setShowSurveyModal(false)}
        facilityName={currentFacilityName}
        onSubmitSurvey={(code) => triggerAction(`Đã tạo và ký phiếu khảo sát kiểm định ${code} thành công!`)}
      />

      <BookingApprovalModal
        isOpen={showBookingApprovalModal}
        onClose={() => setShowBookingApprovalModal(false)}
      />

      <CreateStorageUnitModal
        isOpen={showCreateUnitModal}
        facilities={facilities}
        selectedFacilityId={selectedFacilityId}
        onClose={() => setShowCreateUnitModal(false)}
        onCreated={handleStorageUnitCreated}
      />

      {/* 3. APP ACTIVATION & KEY HANDOVER MODAL */}
      {showAppActivationModal && selectedUnit && (
        <AppActivationModal
          isOpen={showAppActivationModal}
          onClose={() => setShowAppActivationModal(false)}
          mode={selectedUnit.status === 'Rented' ? 'REISSUE' : 'HANDOVER'}
          unit={selectedUnit}
          onCompleteActivation={(msg) => triggerAction(msg)}
        />
      )}

      {/* 4. DOOR ACCESS HISTORY & AUDIT LOG MODAL */}
      {showDoorAccessModal && selectedUnit && (
        <DoorAccessHistoryModal
          isOpen={showDoorAccessModal}
          onClose={() => setShowDoorAccessModal(false)}
          unit={selectedUnit}
        />
      )}

      {/* 5. WORKFORCE SHIFT ASSIGNMENT MODAL */}
      <ShiftAssignmentModal
        isOpen={showShiftModal}
        onClose={() => setShowShiftModal(false)}
        onSaveShift={(summary) => triggerAction(summary)}
      />

      {/* 6. OVERDUE DELINQUENCY NOTICE DISPATCHER MODAL */}
      {noticeModalData && (
        <NoticeDispatcherModal
          isOpen={true}
          onClose={() => setNoticeModalData(null)}
          noticeData={noticeModalData}
          onSendNotice={(msg) => triggerAction(msg)}
        />
      )}

      {/* 7. ASSET SEALING LEGAL RECORD MODAL */}
      {sealingModalData && (
        <AssetSealingModal
          isOpen={true}
          onClose={() => setSealingModalData(null)}
          unitCode={sealingModalData.unitCode}
          tenantName={sealingModalData.tenantName}
          contractCode={sealingModalData.contractCode}
          overdueDays={sealingModalData.overdueDays}
          totalDebt={sealingModalData.totalDebt}
          onCompleteSealing={(msg) => triggerAction(msg)}
        />
      )}
    </div>
  )
}
