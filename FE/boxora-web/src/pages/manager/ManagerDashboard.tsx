import React, { useState, useEffect, useMemo } from 'react'
import { useOutletContext } from 'react-router-dom'
import { storageUnitService } from '../../services/storageUnitService'
import { facilityService } from '../../services/facilityService'
import { facilityPolicyService } from '../../services/facilityPolicyService'
import { reportService } from '../../services/reportService'
import { paymentService, PaymentItem } from '../../services/paymentService'
import { userService } from '../../services/userService'
import { useLanguage } from '../../context/LanguageContext'
import { useAuth } from '../../context/AuthContext'
import { Facility, FacilityPolicy, StorageUnit, OverdueDebtItem, User, RevenueReport } from '../../types'
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
import { FacilityPolicyViewModal } from './modals/FacilityPolicyViewModal'

interface InspectedUnit {
  id: string
  backendId?: string
  size: string
  type: string
  status: 'Available' | 'Rented' | 'Pending' | 'Overdue' | 'Maintenance'
  rawStatus?: string
  color: 'emerald' | 'blue' | 'amber' | 'rose' | 'red' | 'purple'
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
  const { user, role } = useAuth()
  const { selectedFacility, setSelectedFacility, facilities: contextFacilities } = useOutletContext<{
    selectedFacility?: string
    setSelectedFacility?: (facId: string) => void
    facilities?: Facility[]
  }>() || {}

  const isFacilityScoped = role === 'FACILITY_MANAGER' || role === 'STAFF'
  const assignedFacilityId = user?.facilityId

  const [facilities, setFacilities] = useState<Facility[]>(contextFacilities || [])
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>(
    isFacilityScoped && assignedFacilityId
      ? assignedFacilityId
      : (selectedFacility && selectedFacility !== 'ALL' ? selectedFacility : (contextFacilities?.[0]?.id || ''))
  )
  const [units, setUnits] = useState<InspectedUnit[]>([])
  const [facilityPolicy, setFacilityPolicy] = useState<FacilityPolicy | null>(null)
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false)
  const [hasPolicyException, setHasPolicyException] = useState(false)
  const [overdueItems, setOverdueItems] = useState<OverdueDebtItem[]>([])
  const [staffList, setStaffList] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [selectedFloor, setSelectedFloor] = useState<'floor1' | 'floor2'>('floor1')
  const [sizeFilter, setSizeFilter] = useState<'all' | 's' | 'm' | 'l'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'Available' | 'Rented' | 'Pending' | 'Overdue' | 'Maintenance'>('all')
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
    unitId?: string
    tenantName: string
    contractCode: string
    contractId?: string
    overdueDays: number
    totalDebt: string
  } | null>(null)

  // Facility Revenue Report & Cashflow State from real DB
  const [revenueData, setRevenueData] = useState<RevenueReport | null>(null)
  const [facilityPayments, setFacilityPayments] = useState<PaymentItem[]>([])
  const [isRevenueLoading, setIsRevenueLoading] = useState<boolean>(true)
  const [revFromDate, setRevFromDate] = useState<string>('')
  const [revToDate, setRevToDate] = useState<string>('')
  const [isRevDatePickerOpen, setIsRevDatePickerOpen] = useState<boolean>(false)
  const [tempRevFrom, setTempRevFrom] = useState<string>('')
  const [tempRevTo, setTempRevTo] = useState<string>('')

  useEffect(() => {
    if (contextFacilities && contextFacilities.length > 0) {
      setFacilities(contextFacilities)
    } else {
      facilityService.getFacilities()
        .then(res => {
          let list = res?.content || []
          if (isFacilityScoped && assignedFacilityId) {
            list = list.filter(f => f.id === assignedFacilityId)
          }
          if (list.length > 0) setFacilities(list)
        })
        .catch(() => {})
    }
  }, [contextFacilities, isFacilityScoped, assignedFacilityId])

  useEffect(() => {
    let targetFacility = isFacilityScoped && assignedFacilityId ? assignedFacilityId : selectedFacility
    if (!targetFacility || targetFacility === 'ALL') {
      if (isFacilityScoped && assignedFacilityId) {
        targetFacility = assignedFacilityId
      } else if (facilities.length > 0) {
        targetFacility = facilities[0].id
        if (setSelectedFacility) {
          setSelectedFacility(facilities[0].id)
        }
      }
    }
    if (targetFacility && targetFacility !== 'ALL') {
      setSelectedFacilityId(targetFacility)
      void fetchUnits(targetFacility, revFromDate, revToDate)
    }
  }, [selectedFacility, facilities, isFacilityScoped, assignedFacilityId])

  const fetchUnits = async (facId?: string, fDate = revFromDate, tDate = revToDate) => {
    setIsLoading(true)
    setIsRevenueLoading(true)
    try {
      const targetId = (facId && facId !== 'ALL')
        ? facId
        : (selectedFacilityId && selectedFacilityId !== 'ALL' ? selectedFacilityId : facilities[0]?.id)

      const [unitsRes, debtRes, staffRes, revRes, payRes, polRes] = await Promise.allSettled([
        storageUnitService.getUnits(targetId ? { facilityId: targetId } : undefined),
        reportService.getOverdueDebtReport(targetId ? { facilityId: targetId } : undefined),
        userService.getAllUsers({ role: 'STAFF', facilityId: targetId, size: 50 }),
        reportService.getRevenueReport(fDate || undefined, tDate || undefined, targetId),
        paymentService.getPayments({ size: 15, facilityId: targetId }),
        targetId ? facilityPolicyService.getByFacilityId(targetId) : Promise.resolve(null),
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
            color = 'purple'
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
            tenant: su.tenantName || (isAvail ? 'Kho trống' : isRes ? 'Đang cập nhật hồ sơ' : 'Đang cập nhật'),
            contract: su.contractCode || (isAvail ? 'Chưa có hợp đồng' : isRes ? 'Chờ ký HĐ bàn giao' : 'Chưa có mã HĐ'),
            due: (su.startDate && su.dueDate)
              ? `${new Date(su.startDate).toLocaleDateString('vi-VN')} - ${new Date(su.dueDate).toLocaleDateString('vi-VN')}`
              : su.dueDate
              ? new Date(su.dueDate).toLocaleDateString('vi-VN')
              : (isAvail ? '—' : 'Chưa xác định'),
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

      if (revRes.status === 'fulfilled' && revRes.value) {
        setRevenueData(revRes.value)
      } else {
        setRevenueData(null)
      }

      if (payRes.status === 'fulfilled' && payRes.value) {
        setFacilityPayments(payRes.value)
      } else {
        setFacilityPayments([])
      }

      if (polRes.status === 'fulfilled' && polRes.value) {
        const loadedPol = polRes.value
        setFacilityPolicy(loadedPol)
        if (loadedPol?.id && user?.id) {
          try {
            const grants = await facilityService.getPolicyExceptionGrants(loadedPol.id)
            setHasPolicyException(Array.isArray(grants) && grants.includes(user.id))
          } catch {
            setHasPolicyException(false)
          }
        } else {
          setHasPolicyException(false)
        }
      } else {
        setFacilityPolicy(null)
        setHasPolicyException(false)
      }
    } catch {
      setUnits([])
      setOverdueItems([])
      setStaffList([])
      setSelectedUnit(null)
      setRevenueData(null)
      setFacilityPayments([])
      setFacilityPolicy(null)
      setHasPolicyException(false)
    } finally {
      setIsLoading(false)
      setIsRevenueLoading(false)
    }
  }

  const handleInspect = (unit: InspectedUnit) => {
    setSelectedUnit(unit)
  }

  const currentFacility = useMemo(() => {
    if (isFacilityScoped && assignedFacilityId) {
      return facilities.find(f => f.id === assignedFacilityId) || ({
        id: assignedFacilityId,
        name: user?.facilityName ? user.facilityName.replace(/StoreHub\s*/gi, 'Boxora ') : 'Cơ sở trực thuộc',
        code: user?.facilityCode || 'FAC',
      } as Facility)
    }
    return facilities.find(f => f.id === selectedFacilityId) || facilities[0]
  }, [facilities, selectedFacilityId, isFacilityScoped, assignedFacilityId, user?.facilityName, user?.facilityCode])

  const currentFacilityName = currentFacility?.name
    ? currentFacility.name.replace(/StoreHub\s*/gi, 'Boxora ')
    : (user?.facilityName ? user.facilityName.replace(/StoreHub\s*/gi, 'Boxora ') : 'Cơ sở Boxora')

  const facilityRevenue = useMemo(() => {
    return revenueData?.totalRevenue ?? facilityPayments.reduce((acc, p) => acc + (p.amount || 0), 0)
  }, [revenueData, facilityPayments])

  const rentalFeeRevenue = useMemo(() => {
    return facilityPayments
      .filter(p => !p.paymentType || p.paymentType === 'RENTAL' || p.paymentType === 'CONTRACT' || p.paymentType === 'RENTAL_FEE' || p.paymentType === 'EXTEND')
      .reduce((sum, p) => sum + (p.amount || 0), 0)
  }, [facilityPayments])

  const depositRevenue = useMemo(() => {
    return facilityPayments
      .filter(p => p.paymentType === 'DEPOSIT')
      .reduce((sum, p) => sum + (p.amount || 0), 0)
  }, [facilityPayments])

  const totalOverdueDebt = useMemo(() => {
    return overdueItems.reduce((acc, item) => acc + (item.debtAmount || 0), 0)
  }, [overdueItems])

  const handleApplyRevDateFilter = () => {
    setRevFromDate(tempRevFrom)
    setRevToDate(tempRevTo)
    setIsRevDatePickerOpen(false)
    void fetchUnits(selectedFacilityId, tempRevFrom, tempRevTo)
  }

  const handleResetRevDateFilter = () => {
    setTempRevFrom('')
    setTempRevTo('')
    setRevFromDate('')
    setRevToDate('')
    setIsRevDatePickerOpen(false)
    void fetchUnits(selectedFacilityId, '', '')
  }

  const handleExportFacilityRevenueCsv = () => {
    if (!facilityPayments || facilityPayments.length === 0) {
      alert('Không có dữ liệu giao dịch để xuất báo cáo.')
      return
    }
    const headers = ['Mã GD', 'Mã Kho', 'Cơ Sở', 'Khách Hàng', 'Số Tiền (VNĐ)', 'Phương Thức', 'Loại Thanh Toán', 'Thời Gian', 'Trạng Thái']
    const rows = facilityPayments.map(p => [
      p.id,
      p.unitCode || 'N/A',
      p.facilityName || currentFacilityName,
      p.customerName || 'N/A',
      p.amount,
      p.paymentMethod || 'VNPay',
      p.paymentType || 'RENTAL',
      p.paymentTime ? new Date(p.paymentTime).toLocaleString('vi-VN') : '',
      p.status
    ])
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `Bao_Cao_Doanh_Thu_${currentFacility?.code || 'CO_SO'}_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const triggerAction = (msg: string) => {
    setActionSuccessMessage(msg)
    setTimeout(() => setActionSuccessMessage(null), 3000)
  }

  const handleStorageUnitCreated = (unit: StorageUnit) => {
    const targetFacilityId = unit.facilityId || selectedFacilityId || user?.facilityId
    if (targetFacilityId) {
      setSelectedFacilityId(targetFacilityId)
      void fetchUnits(targetFacilityId)
    }
    triggerAction(`${t('Đã thêm kho', 'Added storage unit')} ${unit.unitCode}.`)
  }

  const handleToggleMaintenance = async () => {
    if (!selectedUnit) return

    // Quy định: trước mắt chỉ duy nhất có thể chuyển từ trạng thái available sang maintenance (và ngược lại)
    if (selectedUnit.status !== 'Available' && selectedUnit.status !== 'Maintenance') {
      triggerAction(`Chỉ có thể chuyển bảo trì khi kho đang ở trạng thái Trống sẵn sàng (Available).`)
      return
    }

    try {
      if (selectedUnit.backendId) {
        const updated = await storageUnitService.toggleMaintenance(selectedUnit.backendId)
        const isNowMaint = updated.status === 'UNDER_MAINTENANCE' || updated.status === 'MAINTENANCE'
        const nextStatus: InspectedUnit['status'] = isNowMaint ? 'Maintenance' : 'Available'
        const nextColor: InspectedUnit['color'] = isNowMaint ? 'purple' : 'emerald'

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

        const targetFac = selectedFacilityId || user?.facilityId
        if (targetFac) {
          void fetchUnits(targetFac)
        }

        triggerAction(`Đã cập nhật trạng thái kho #${selectedUnit.id} thành ${isNowMaint ? 'Bảo trì kỹ thuật' : 'Sẵn sàng'} qua StorageUnit API!`)
      } else {
        const nextStatus = selectedUnit.status === 'Maintenance' ? 'Available' : 'Maintenance'
        setUnits(prev => prev.map(u => u.id === selectedUnit.id ? { ...u, status: nextStatus, color: nextStatus === 'Maintenance' ? 'purple' : 'emerald' } : u))
        setSelectedUnit(prev => {
          if (!prev) return null
          return {
            ...prev,
            status: nextStatus,
            color: nextStatus === 'Maintenance' ? 'purple' : 'emerald'
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
  const pendingPercent = totalUnitsCount > 0 ? ((pendingUnitsCount / totalUnitsCount) * 100).toFixed(1) : '0.0'
  const maintenancePercent = totalUnitsCount > 0 ? ((maintenanceUnitsCount / totalUnitsCount) * 100).toFixed(1) : '0.0'
  const overduePercent = totalUnitsCount > 0 ? ((overdueUnitsCount / totalUnitsCount) * 100).toFixed(1) : '0.0'


  // Display the floor plan configured by an admin, with generic defaults for unconfigured branches.
  const facilityProfile = useMemo(() => parseFacilityLayoutConfig(currentFacility?.layoutConfig), [currentFacility])

  const getStatusBadgeStyle = (status: InspectedUnit['status']) => {
    switch (status) {
      case 'Available': return 'bg-emerald-50 text-emerald-700 border-emerald-200'
      case 'Rented': return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'Pending': return 'bg-amber-50 text-amber-800 border-amber-200'
      case 'Overdue': return 'bg-rose-50 text-rose-700 border-rose-200'
      case 'Maintenance': return 'bg-purple-50 text-purple-700 border-purple-200'
    }
  }

  const getUnitCardBorder = (unit: InspectedUnit) => {
    const isSelected = selectedUnit?.id === unit.id
    switch (unit.color) {
      case 'emerald': return `border-t-2 border-t-emerald-500 hover:bg-slate-50/80 ${isSelected ? 'ring-2 ring-emerald-600 shadow-md z-10' : 'hover:-translate-y-0.5 hover:shadow-xs'}`
      case 'blue': return `border-t-2 border-t-blue-600 hover:bg-slate-50/80 ${isSelected ? 'ring-2 ring-blue-600 shadow-md z-10' : 'hover:-translate-y-0.5 hover:shadow-xs'}`
      case 'amber': return `border-t-2 border-t-amber-500 hover:bg-slate-50/80 ${isSelected ? 'ring-2 ring-amber-500 shadow-md z-10' : 'hover:-translate-y-0.5 hover:shadow-xs'}`
      case 'purple': return `border-t-2 border-t-purple-500 hover:bg-purple-50/30 ${isSelected ? 'ring-2 ring-purple-600 shadow-md z-10' : 'hover:-translate-y-0.5 hover:shadow-xs'}`
      case 'rose':
      case 'red': return `border-t-2 border-t-rose-500 hover:bg-rose-50/30 ${isSelected ? 'ring-2 ring-rose-600 shadow-md z-10' : 'hover:-translate-y-0.5 hover:shadow-xs'}`
      default: return `border-t-2 border-t-slate-400 hover:bg-slate-50/80 ${isSelected ? 'ring-2 ring-slate-900 shadow-md z-10' : 'hover:-translate-y-0.5 hover:shadow-xs'}`
    }
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
               unit.status === 'Maintenance' ? 'Bảo trì' :
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
            unit.status === 'Maintenance' ? 'text-purple-700' :
            unit.status === 'Overdue' ? 'text-rose-700' : 'text-slate-600'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              unit.color === 'emerald' ? 'bg-emerald-500' :
              unit.color === 'blue' ? 'bg-blue-600' :
              unit.color === 'amber' ? 'bg-amber-500' :
              unit.color === 'purple' ? 'bg-purple-600' :
              unit.color === 'rose' || unit.color === 'red' ? 'bg-rose-500' : 'bg-slate-400'
            }`}></span>
            {unit.status === 'Available' ? 'Trống' :
             unit.status === 'Rented' ? 'Thuê' :
             unit.status === 'Pending' ? 'Chờ giao' :
             unit.status === 'Maintenance' ? 'Bảo trì' :
             unit.status === 'Overdue' ? 'Quá hạn' : 'Bảo trì'}
          </span>
        </div>
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

      {/* 6 CRITICAL DYNAMIC KPI TILES (GỘP CHỜ BÀN GIAO & PHÂN BIỆT RÕ MÀU BẢO TRÌ/QUÁ HẠN) */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
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

        {/* Tile 4: Pending / Chờ bàn giao */}
        <div 
          onClick={() => setStatusFilter(prev => prev === 'Pending' ? 'all' : 'Pending')}
          className={`p-4 bg-white rounded-xl border flex flex-col justify-between hover:shadow-md transition-all duration-150 cursor-pointer ${
            statusFilter === 'Pending' 
              ? 'border-amber-500 ring-2 ring-amber-500/20 shadow-xs bg-amber-50/20' 
              : 'border-slate-200 shadow-2xs hover:border-slate-300'
          }`}
          title="Bấm để lọc các kho chờ khách nhận bàn giao"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-semibold text-slate-500">Chờ bàn giao</span>
            <span className="material-symbols-outlined text-amber-500 text-[18px]">pending_actions</span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-extrabold font-mono tabular-nums text-amber-600 leading-none">
              {pendingUnitsCount < 10 ? `0${pendingUnitsCount}` : pendingUnitsCount}
            </span>
            <span className="text-xs text-slate-500 font-medium">chờ nhận phòng</span>
          </div>
          <div className="mt-3 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-amber-500 h-full rounded-full" style={{ width: `${pendingPercent}%` }}></div>
          </div>
        </div>

        {/* Tile 5: Maintenance (MÀU TÍM - ĐẶC TRƯNG BẢO TRÌ SỬA CHỮA, TRÁNH TRÙNG VỚI MÀU ĐỎ CỦA QUÁ HẠN) */}
        <div 
          onClick={() => setStatusFilter(prev => prev === 'Maintenance' ? 'all' : 'Maintenance')}
          className={`p-4 bg-white rounded-xl border flex flex-col justify-between hover:shadow-md transition-all duration-150 cursor-pointer ${
            statusFilter === 'Maintenance' 
              ? 'border-purple-500 ring-2 ring-purple-500/20 shadow-xs bg-purple-50/20' 
              : 'border-slate-200 shadow-2xs hover:border-slate-300'
          }`}
          title="Bấm để lọc các kho đang bảo trì kỹ thuật"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-semibold text-slate-500">Đang bảo trì kỹ thuật</span>
            <span className="material-symbols-outlined text-purple-600 text-[18px]">build_circle</span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-extrabold font-mono tabular-nums text-purple-600 leading-none">
              {maintenanceUnitsCount < 10 ? `0${maintenanceUnitsCount}` : maintenanceUnitsCount}
            </span>
            <span className="text-xs text-slate-500 font-medium">kho ngưng dùng</span>
          </div>
          <div className="mt-3 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-purple-600 h-full rounded-full" style={{ width: `${maintenancePercent}%` }}></div>
          </div>
        </div>

        {/* Tile 6: Overdue (MÀU ĐỎ / ROSE CẢNH BÁO NỢ CƯỚC & KHÓA SMARTLOCK) */}
        <div 
          onClick={() => setStatusFilter(prev => prev === 'Overdue' ? 'all' : 'Overdue')}
          className={`p-4 bg-white rounded-xl border flex flex-col justify-between hover:shadow-md transition-all duration-150 cursor-pointer ${
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

      {/* FACILITY OPERATING POLICY CARD (READ-ONLY FOR FACILITY MANAGER) */}
      <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">verified_user</span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-bold text-slate-900">
                  Chính Sách Vận Hành Chi Nhánh: {currentFacilityName}
                </h2>
                {facilityPolicy ? (
                  facilityPolicy.isActive === false ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 text-[10px] font-bold border border-rose-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                      Ngừng áp dụng
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      Đang áp dụng
                    </span>
                  )
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold border border-amber-200">
                    Chính sách tiêu chuẩn mặc định
                  </span>
                )}
                {hasPolicyException ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold border border-indigo-200">
                    <span className="material-symbols-outlined text-[13px]">tune</span>
                    Được cấp quyền sửa ngoại lệ
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold border border-slate-200">
                    <span className="material-symbols-outlined text-[13px]">visibility</span>
                    Chế độ xem nghiệp vụ
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {hasPolicyException
                  ? 'Bạn đã được Business Operations Manager cấp quyền chỉnh sửa ngoại lệ cho cơ sở này.'
                  : 'Chế độ chỉ đọc • Thực hiện nghiệp vụ theo chính sách chung của Business Operations Manager.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPolicyModalOpen(true)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-xs cursor-pointer ${
                hasPolicyException
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">
                {hasPolicyException ? 'tune' : 'description'}
              </span>
              <span>{hasPolicyException ? 'Chỉnh sửa ngoại lệ cơ sở' : 'Xem chi tiết chính sách'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 text-xs">
          {/* Nhóm 1: Tiền cọc & Thuê */}
          <div className="p-3.5 rounded-lg bg-slate-50/70 border border-slate-200/80 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-1.5 font-bold text-slate-800 mb-1.5">
                <span className="material-symbols-outlined text-[16px] text-cyan-700">payments</span>
                <span>Tiền cọc &amp; Thuê kho</span>
              </div>
              <ul className="space-y-1.5 text-slate-600">
                <li className="flex justify-between">
                  <span>Tỷ lệ tiền cọc:</span>
                  <strong className="text-slate-900">{facilityPolicy?.depositPercentage ?? facilityPolicy?.depositPercent ?? 100}%</strong>
                </li>
                <li className="flex justify-between">
                  <span>Thời hạn thuê min:</span>
                  <strong className="text-slate-900">{facilityPolicy?.minimumRentalMonths ?? 1} tháng</strong>
                </li>
                <li className="flex justify-between">
                  <span>Mở gia hạn trước:</span>
                  <strong className="text-slate-900">{facilityPolicy?.renewalWindowDays ?? 7} ngày</strong>
                </li>
              </ul>
            </div>
          </div>

          {/* Nhóm 2: Hủy đặt kho */}
          <div className="p-3.5 rounded-lg bg-slate-50/70 border border-slate-200/80 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-1.5 font-bold text-slate-800 mb-1.5">
                <span className="material-symbols-outlined text-[16px] text-amber-600">cancel</span>
                <span>Hủy phòng &amp; Hoàn cọc</span>
              </div>
              <ul className="space-y-1.5 text-slate-600">
                <li className="flex justify-between">
                  <span>Hoàn 100% trước:</span>
                  <strong className="text-emerald-700">{facilityPolicy?.cancellationFullRefundHours ?? 48} giờ</strong>
                </li>
                <li className="flex justify-between">
                  <span>Hoàn một phần trước:</span>
                  <strong className="text-amber-700">{facilityPolicy?.cancellationPartialRefundHours ?? 24} giờ</strong>
                </li>
                <li className="flex justify-between">
                  <span>Tỷ lệ hoàn 1 phần:</span>
                  <strong className="text-slate-900">{facilityPolicy?.cancellationPartialRefundPercent ?? 50}%</strong>
                </li>
              </ul>
            </div>
          </div>

          {/* Nhóm 3: Trả kho & SLA */}
          <div className="p-3.5 rounded-lg bg-slate-50/70 border border-slate-200/80 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-1.5 font-bold text-slate-800 mb-1.5">
                <span className="material-symbols-outlined text-[16px] text-emerald-600">assignment_turned_in</span>
                <span>Nghiệm thu Trả kho &amp; SLA</span>
              </div>
              <ul className="space-y-1.5 text-slate-600">
                <li className="flex justify-between">
                  <span>Báo trước trả kho:</span>
                  <strong className="text-slate-900">{facilityPolicy?.returnNoticeDays ?? 3} ngày</strong>
                </li>
                <li className="flex justify-between">
                  <span>SLA xử lý hoàn cọc:</span>
                  <strong className="text-blue-700 font-bold">{facilityPolicy?.depositRefundSlaDays ?? 3} ngày làm việc</strong>
                </li>
                <li className="flex justify-between">
                  <span>Hình thức hoàn:</span>
                  <strong className="text-slate-900">Chuyển khoản</strong>
                </li>
              </ul>
            </div>
          </div>

          {/* Nhóm 4: Nợ quá hạn & Niêm phong */}
          <div className="p-3.5 rounded-lg bg-slate-50/70 border border-slate-200/80 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-1.5 font-bold text-slate-800 mb-1.5">
                <span className="material-symbols-outlined text-[16px] text-rose-600">lock_clock</span>
                <span>Quá hạn &amp; Niêm phong</span>
              </div>
              <ul className="space-y-1.5 text-slate-600">
                <li className="flex justify-between">
                  <span>Phí trễ hạn:</span>
                  <strong className="text-rose-600 font-mono">{Number(facilityPolicy?.dailyLateFee ?? facilityPolicy?.lateFeePerDay ?? 50000).toLocaleString('vi-VN')} đ/ngày</strong>
                </li>
                <li className="flex justify-between">
                  <span>Ân hạn nợ:</span>
                  <strong className="text-slate-900">{facilityPolicy?.overdueGraceDays ?? facilityPolicy?.gracePeriodDays ?? 3} ngày</strong>
                </li>
                <li className="flex justify-between">
                  <span>Khóa thẻ / Niêm phong:</span>
                  <strong className="text-rose-700">Ngày {facilityPolicy?.overdueAccessDisableDays ?? 5} / {facilityPolicy?.overdueSealingDays ?? 7}</strong>
                </li>
              </ul>
            </div>
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
              {statusFilter !== 'all' && (
                <button 
                  type="button" 
                  onClick={() => setStatusFilter('all')}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-neutral-800 transition-all cursor-pointer shadow-2xs"
                  title="Nhấp để xóa lọc trạng thái và hiển thị lại tất cả các kho"
                >
                  <span className={`w-2 h-2 rounded-full animate-pulse ${
                    statusFilter === 'Available' ? 'bg-emerald-400' :
                    statusFilter === 'Rented' ? 'bg-blue-400' :
                    statusFilter === 'Pending' ? 'bg-amber-400' :
                    statusFilter === 'Maintenance' ? 'bg-purple-400' : 'bg-rose-400'
                  }`}></span>
                  <span>Đang lọc: {
                    statusFilter === 'Available' ? 'Kho trống' :
                    statusFilter === 'Rented' ? 'Đang thuê' :
                    statusFilter === 'Pending' ? 'Chờ bàn giao' :
                    statusFilter === 'Maintenance' ? 'Bảo trì kỹ thuật' : 'Quá hạn nợ'
                  }</span>
                  <span className="material-symbols-outlined text-[14px] hover:text-rose-300">close</span>
                </button>
              )}
            </div>
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
                  setSealingModalData({
                    unitCode: selectedUnit.id,
                    unitId: selectedUnit.backendId,
                    tenantName: selectedUnit.tenant,
                    contractCode: selectedUnit.contract,
                    overdueDays: 15,
                    totalDebt: '3.650.000 ₫'
                  })
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
                disabled={selectedUnit.status !== 'Available' && selectedUnit.status !== 'Maintenance'}
                className={`py-2 px-3 rounded-lg font-medium text-xs flex items-center justify-center gap-1 transition-all border ${
                  selectedUnit.status === 'Maintenance'
                    ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200 cursor-pointer'
                    : selectedUnit.status === 'Available'
                    ? 'bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200 cursor-pointer'
                    : 'bg-slate-100 text-slate-400 border-slate-200 opacity-60 cursor-not-allowed'
                }`}
                title={
                  selectedUnit.status === 'Available'
                    ? 'Chuyển kho này sang chế độ bảo trì kỹ thuật'
                    : selectedUnit.status === 'Maintenance'
                    ? 'Hoàn tất bảo trì và mở lại kho sẵn sàng cho thuê'
                    : 'Chỉ có thể chuyển bảo trì khi kho đang ở trạng thái Trống sẵn sàng (Available)'
                }
              >
                <span className="material-symbols-outlined text-[16px]">
                  {selectedUnit.status === 'Maintenance' ? 'check_circle' : 'build'}
                </span>
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
          onCompleteActivation={(msg) => {
            triggerAction(msg)
            void fetchUnits(selectedFacilityId)
          }}
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
        facilityId={selectedFacilityId}
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
          unitId={sealingModalData.unitId}
          tenantName={sealingModalData.tenantName}
          contractCode={sealingModalData.contractCode}
          contractId={sealingModalData.contractId}
          facilityId={selectedFacilityId}
          overdueDays={sealingModalData.overdueDays}
          totalDebt={sealingModalData.totalDebt}
          onCompleteSealing={(msg) => {
            triggerAction(msg)
            setSealingModalData(null)
            void fetchUnits(selectedFacilityId)
          }}
        />
      )}

      {/* Facility Policy View & Exception Modal */}
      {currentFacility && (
        <FacilityPolicyViewModal
          isOpen={isPolicyModalOpen}
          onClose={() => {
            setIsPolicyModalOpen(false)
            if (currentFacility.id) void fetchUnits(currentFacility.id)
          }}
          facilityId={currentFacility.id}
          facilityName={currentFacility.name}
          canEdit={hasPolicyException}
        />
      )}
    </div>
  )
}
