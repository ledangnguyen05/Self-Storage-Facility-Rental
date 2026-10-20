import React, { useState, useEffect, useMemo } from 'react'
import { useOutletContext, Link, useSearchParams } from 'react-router-dom'
import { storageUnitService } from '../../services/storageUnitService'
import { facilityService } from '../../services/facilityService'
import { facilityPolicyService } from '../../services/facilityPolicyService'
import { reportService } from '../../services/reportService'
import { bookingService } from '../../services/bookingService'
import { supportTicketService, SupportTicketRecord } from '../../services/supportTicketService'
import { useLanguage } from '../../context/LanguageContext'
import { useAuth } from '../../context/AuthContext'
import { Facility, FacilityPolicy, StorageUnit, OverdueDebtItem, Booking } from '../../types'
import { parseFacilityLayoutConfig } from '../../utils/facilityLayout'
import { IoTTelemetryModal } from './modals/IoTTelemetryModal'
import { BookingDetailReadOnlyModal } from './modals/BookingDetailReadOnlyModal'
import { DoorAccessHistoryModal } from './modals/DoorAccessHistoryModal'
import { NoticeDispatcherModal } from './modals/NoticeDispatcherModal'
import { AssetSealingModal } from './modals/AssetSealingModal'
import { CreateStorageUnitModal } from './modals/CreateStorageUnitModal'
import { FacilityPolicyViewModal } from './modals/FacilityPolicyViewModal'
import { ReceptionShiftAlertModal } from '../../components/modals/ReceptionShiftAlertModal'
import { ContractRenewalsManagementPanel } from '../../components/renewal/ContractRenewalsManagementPanel'

interface InspectedUnit {
  id: string
  backendId?: string
  size: string
  type: string
  status: 'Available' | 'Rented' | 'Pending' | 'Overdue' | 'Maintenance' | 'Unknown'
  rawStatus?: string
  color: 'emerald' | 'blue' | 'amber' | 'rose' | 'red' | 'purple'
  tenant: string
  contract: string
  due: string
  battery?: string
  smartlock: string
  lastAccess: string
  floorLevel: string
  pricePerMonth?: number
  facilityId?: string
  facilityName?: string
}

type ManagerDashboardTab = 'overview' | 'renewals' | 'handovers-returns' | 'tickets' | 'performance' | 'policy'

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

  // Tab State
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab') as ManagerDashboardTab | null

  const isTabAllowed = (tab: ManagerDashboardTab | null): boolean => {
    if (!tab) return false
    if (role === 'STAFF') {
      return tab === 'overview' || tab === 'renewals' || tab === 'handovers-returns' || tab === 'tickets'
    }
    return tab === 'overview' || tab === 'renewals' || tab === 'handovers-returns' || tab === 'tickets' || tab === 'performance' || tab === 'policy'
  }

  const [activeTab, setActiveTabState] = useState<ManagerDashboardTab>(
    isTabAllowed(tabParam) ? (tabParam as ManagerDashboardTab) : 'overview'
  )

  const setActiveTab = (tab: ManagerDashboardTab) => {
    setActiveTabState(tab)
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (tab === 'overview') {
        next.delete('tab')
      } else {
        next.set('tab', tab)
      }
      return next
    }, { replace: true })
  }

  useEffect(() => {
    const currentTab = searchParams.get('tab') as ManagerDashboardTab | null
    if (isTabAllowed(currentTab)) {
      setActiveTabState(currentTab as ManagerDashboardTab)
    } else if (role === 'STAFF' && (currentTab === 'performance' || currentTab === 'policy')) {
      setActiveTabState('overview')
    }
  }, [searchParams, role])

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
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [selectedFloor, setSelectedFloor] = useState<'floor1' | 'floor2'>('floor1')
  const [sizeFilter, setSizeFilter] = useState<'all' | 's' | 'm' | 'l'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'Available' | 'Rented' | 'Pending' | 'Overdue' | 'Maintenance'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUnit, setSelectedUnit] = useState<InspectedUnit | null>(null)
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null)

  // Management Summaries Data
  const [upcomingHandovers, setUpcomingHandovers] = useState<Booking[]>([])
  const [activeRentals, setActiveRentals] = useState<Booking[]>([])
  const [showAllRentals, setShowAllRentals] = useState(false)
  const [tickets, setTickets] = useState<SupportTicketRecord[]>([])

  // Check-in Filter & Claim States
  const [checkinTimeframe, setCheckinTimeframe] = useState<'current' | 'today' | 'past' | 'future' | 'all'>('all')
  const [checkinFromDate, setCheckinFromDate] = useState<string>('')
  const [checkinToDate, setCheckinToDate] = useState<string>('')
  const [claimingBookingId, setClaimingBookingId] = useState<string | null>(null)

  // Tickets queue pagination
  const [ticketCurrentPage, setTicketCurrentPage] = useState<number>(1)
  const [ticketPageSize, setTicketPageSize] = useState<number>(5)

  useEffect(() => {
    setTicketCurrentPage(1)
  }, [selectedFacilityId])

  const totalTicketPages = Math.max(1, Math.ceil(tickets.length / ticketPageSize))
  const paginatedTickets = useMemo(() => {
    const start = (ticketCurrentPage - 1) * ticketPageSize
    return tickets.slice(start, start + ticketPageSize)
  }, [tickets, ticketCurrentPage, ticketPageSize])

  // Modals state
  const [showIoTModal, setShowIoTModal] = useState(false)
  const [showCreateUnitModal, setShowCreateUnitModal] = useState(false)
  const [showReadOnlyBookingModal, setShowReadOnlyBookingModal] = useState(false)
  const [receptionAlertData, setReceptionAlertData] = useState<{
    isOpen: boolean
    message: string
    booking?: Booking | null
  } | null>(null)
  const [readOnlyTargetBookingId, setReadOnlyTargetBookingId] = useState<string | undefined>(undefined)
  const [showDoorAccessModal, setShowDoorAccessModal] = useState(false)
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
      void fetchUnits(targetFacility)
    }
  }, [selectedFacility, facilities, isFacilityScoped, assignedFacilityId])

  const fetchUnits = async (facId?: string) => {
    setIsLoading(true)
    try {
      const targetId = (facId && facId !== 'ALL')
        ? facId
        : (selectedFacilityId && selectedFacilityId !== 'ALL' ? selectedFacilityId : facilities[0]?.id)

      const [unitsRes, debtRes, polRes, arrivalsRes, rentalsRes, ticketsRes] = await Promise.allSettled([
        storageUnitService.getUnits(targetId ? { facilityId: targetId } : undefined),
        reportService.getOverdueDebtReport(targetId ? { facilityId: targetId } : undefined),
        targetId ? facilityPolicyService.getByFacilityId(targetId) : Promise.resolve(null),
        bookingService.getUpcomingArrivals(targetId, {
          timeframe: checkinTimeframe.toUpperCase(),
          fromDate: checkinFromDate || undefined,
          toDate: checkinToDate || undefined,
        }),
        bookingService.getAll({ status: 'ACTIVE', size: 100, facilityId: targetId }),
        supportTicketService.getQueue(targetId ? { facilityId: targetId } : undefined),
      ])

      // 1. Process Storage Units
      if (unitsRes.status === 'fulfilled' && Array.isArray(unitsRes.value) && unitsRes.value.length > 0) {
        const mapped: InspectedUnit[] = unitsRes.value.map((su: StorageUnit) => {
          const isAvail = su.status === 'AVAILABLE'
          const isOcc = su.status === 'OCCUPIED'
          const isMaint = su.status === 'UNDER_MAINTENANCE' || su.status === 'MAINTENANCE'
          const isRes = su.status === 'RESERVED'
          const isOverdue = su.status === 'OVERDUE_LOCKED'

          let status: InspectedUnit['status'] = 'Unknown'
          let color: InspectedUnit['color'] = 'red'
          if (isAvail) {
            status = 'Available'
            color = 'emerald'
          } else if (isOcc) {
            status = 'Rented'
            color = 'blue'
          } else if (isMaint) {
            status = 'Maintenance'
            color = 'purple'
          } else if (isRes) {
            status = 'Pending'
            color = 'amber'
          } else if (isOverdue) {
            status = 'Overdue'
            color = 'rose'
          }

          return {
            id: su.unitCode,
            backendId: su.id,
            size: su.areaSqMeters != null ? `${su.areaSqMeters.toFixed(1)} m²` : '—',
            type: su.unitTypeName || 'Type not reported',
            status,
            rawStatus: su.status,
            color,
            tenant: su.tenantName || (isAvail ? 'Kho trống' : isRes ? 'Đang cập nhật hồ sơ' : 'Chưa có thông tin'),
            contract: su.contractCode || (isAvail ? 'Chưa có hợp đồng' : isRes ? 'Chờ ký HĐ bàn giao' : 'Chưa có mã HĐ'),
            due: (su.startDate && su.dueDate)
              ? `${new Date(su.startDate).toLocaleDateString('vi-VN')} - ${new Date(su.dueDate).toLocaleDateString('vi-VN')}`
              : su.dueDate
              ? new Date(su.dueDate).toLocaleDateString('vi-VN')
              : (isAvail ? '—' : 'Chưa xác định'),
            battery: su.batteryLevel || undefined,
            smartlock: su.smartLockSerial || 'Not reported',
            lastAccess: su.lastAccessTime || 'No access record reported',
            floorLevel: su.floorLevel || 'Not reported',
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

      // 2. Overdue Debt
      if (debtRes.status === 'fulfilled' && debtRes.value?.items) {
        setOverdueItems(debtRes.value.items)
      } else {
        setOverdueItems([])
      }

      // 3. Policy & Policy Exception
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

      // 4. Upcoming Arrivals / Handovers
      if (arrivalsRes.status === 'fulfilled' && Array.isArray(arrivalsRes.value)) {
        let filteredArrivals = arrivalsRes.value
        if (targetId) {
          filteredArrivals = filteredArrivals.filter(b => b.facilityId === targetId)
        }
        setUpcomingHandovers(filteredArrivals)
      } else {
        setUpcomingHandovers([])
      }

      // 5. Active Rentals / Returns
      if (rentalsRes.status === 'fulfilled' && rentalsRes.value?.content) {
        let filteredRentals = rentalsRes.value.content
        if (targetId) {
          filteredRentals = filteredRentals.filter(b => b.facilityId === targetId)
        }
        setActiveRentals(filteredRentals)
      } else {
        setActiveRentals([])
      }

      // 6. Tickets
      if (ticketsRes.status === 'fulfilled' && Array.isArray(ticketsRes.value)) {
        setTickets(ticketsRes.value)
      } else {
        setTickets([])
      }

    } catch {
      setUnits([])
      setOverdueItems([])
      setSelectedUnit(null)
      setFacilityPolicy(null)
      setHasPolicyException(false)
      setUpcomingHandovers([])
      setActiveRentals([])
      setTickets([])
    } finally {
      setIsLoading(false)
    }
  }

  const fetchUpcomingHandovers = async (
    facId?: string,
    timeframe?: 'current' | 'today' | 'past' | 'future' | 'all',
    fromDate?: string,
    toDate?: string
  ) => {
    try {
      const targetId = (facId && facId !== 'ALL')
        ? facId
        : (selectedFacilityId && selectedFacilityId !== 'ALL' ? selectedFacilityId : facilities[0]?.id)
      const tf = timeframe !== undefined ? timeframe : checkinTimeframe
      const from = fromDate !== undefined ? fromDate : checkinFromDate
      const to = toDate !== undefined ? toDate : checkinToDate

      const data = await bookingService.getUpcomingArrivals(targetId, {
        timeframe: tf?.toUpperCase(),
        fromDate: from || undefined,
        toDate: to || undefined,
      })
      if (Array.isArray(data)) {
        let filteredArrivals = data
        if (targetId) {
          filteredArrivals = filteredArrivals.filter(b => b.facilityId === targetId)
        }
        setUpcomingHandovers(filteredArrivals)
      } else {
        setUpcomingHandovers([])
      }
    } catch {
      setUpcomingHandovers([])
    }
  }

  const handleCheckinTimeframeChange = (tf: 'current' | 'today' | 'past' | 'future' | 'all') => {
    setCheckinTimeframe(tf)
    fetchUpcomingHandovers(selectedFacilityId, tf, checkinFromDate, checkinToDate)
  }

  const handleCheckinDateFilterApply = (from: string, to: string) => {
    setCheckinFromDate(from)
    setCheckinToDate(to)
    fetchUpcomingHandovers(selectedFacilityId, checkinTimeframe, from, to)
  }

  const handleResetCheckinDateFilter = () => {
    setCheckinFromDate('')
    setCheckinToDate('')
    fetchUpcomingHandovers(selectedFacilityId, checkinTimeframe, '', '')
  }

  const handleManagerClaimReception = async (booking: Booking) => {
    setClaimingBookingId(booking.id)
    try {
      const updated = await bookingService.claimCheckInReception(booking.id)
      setUpcomingHandovers(prev => prev.map(b => b.id === booking.id ? {
        ...b,
        assignedStaffId: updated.assignedStaffId || user?.id,
        assignedStaffName: updated.assignedStaffName || user?.fullName || 'Quản lý cơ sở'
      } : b))
      setActionSuccessMessage(`Đã tiếp nhận lượt đón khách của đơn ${booking.bookingCode} thành công!`)
      setTimeout(() => setActionSuccessMessage(null), 4000)
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Không thể tiếp nhận khách: Bạn chỉ có thể tiếp nhận khi có ca làm việc vào ngày hẹn check-in tại cơ sở và đã điểm danh vào ca trực.'
      setReceptionAlertData({
        isOpen: true,
        message: msg,
        booking,
      })
    } finally {
      setClaimingBookingId(null)
    }
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

  const handleToggleMaintenance = async () => {
    if (!selectedUnit) return

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

        triggerAction(`Đã cập nhật trạng thái kho #${selectedUnit.id} thành ${isNowMaint ? 'Bảo trì kỹ thuật' : 'Sẵn sàng'}!`)
      }
    } catch (err: any) {
      triggerAction(`Không thể đổi trạng thái: ${err?.response?.data?.message || 'Kho đang có người thuê hoặc lỗi hệ thống'}`)
    }
  }

  const getUnitZone = (u: InspectedUnit): 'A' | 'B' | 'C' => {
    const code = u.id.toUpperCase()
    if (code.includes('-C') || /-[2-9]\d\d/.test(code) || (u.floorLevel || '').includes('2')) {
      return 'C'
    }
    if (code.includes('-B')) return 'B'
    if (code.includes('-A')) return 'A'
    const numMatch = code.match(/\d+/)
    if (numMatch) {
      const num = parseInt(numMatch[0], 10)
      if (num >= 200) return 'C'
      if (num > 106) return 'B'
      return 'A'
    }
    return 'A'
  }

  const permanentAllUnits = useMemo(() => {
    return [...units].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' }))
  }, [units])

  const permanentZoneA = useMemo(() => permanentAllUnits.filter(u => getUnitZone(u) === 'A'), [permanentAllUnits])
  const permanentZoneB = useMemo(() => permanentAllUnits.filter(u => getUnitZone(u) === 'B'), [permanentAllUnits])
  const permanentZoneC = useMemo(() => permanentAllUnits.filter(u => getUnitZone(u) === 'C'), [permanentAllUnits])
  const permanentFloor1 = useMemo(() => [...permanentZoneA, ...permanentZoneB], [permanentZoneA, permanentZoneB])
  const permanentFloor2 = permanentZoneC

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
      if (isNaN(sizeNum)) return false
      if (sizeFilter === 's' && !(sizeNum <= 6.5)) return false
      if (sizeFilter === 'm' && !(sizeNum > 6.5 && sizeNum <= 12)) return false
      if (sizeFilter === 'l' && !(sizeNum > 12)) return false
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

  const facilityProfile = useMemo(() => parseFacilityLayoutConfig(currentFacility?.layoutConfig), [currentFacility])
  const selectedUnitOverdue = overdueItems.find(item => item.unitCode === selectedUnit?.id)

  // Current shift identification
  const currentShiftText = useMemo(() => {
    const hour = new Date().getHours()
    if (hour >= 6 && hour < 14) return 'Ca sáng: 06:00 - 14:00'
    if (hour >= 14 && hour < 22) return 'Ca chiều: 14:00 - 22:00'
    return 'Ca đêm: 22:00 - 06:00'
  }, [])


  const getStatusBadgeStyle = (status: InspectedUnit['status']) => {
    switch (status) {
      case 'Available': return 'bg-emerald-50 text-emerald-700 border-emerald-200'
      case 'Rented': return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'Pending': return 'bg-amber-50 text-amber-800 border-amber-200'
      case 'Overdue': return 'bg-rose-50 text-rose-700 border-rose-200'
      case 'Maintenance': return 'bg-purple-50 text-purple-700 border-purple-200'
      case 'Unknown': return 'bg-slate-50 text-slate-700 border-slate-200'
    }
  }

  // Đếm ngược ngày hết hạn hợp đồng với phân cấp màu sắc mức độ
  const getExpirationCountdown = (endDateStr?: string | null) => {
    if (!endDateStr) {
      return {
        text: 'Chưa có ngày',
        days: 0,
        badgeClass: 'bg-slate-50 text-slate-500 border-slate-200',
        dotClass: 'bg-slate-400',
      }
    }

    const parts = endDateStr.split('T')[0].split('-')
    let targetDate: Date
    if (parts.length === 3) {
      targetDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10))
    } else {
      targetDate = new Date(endDateStr)
    }

    if (isNaN(targetDate.getTime())) {
      return {
        text: endDateStr,
        days: 0,
        badgeClass: 'bg-slate-50 text-slate-500 border-slate-200',
        dotClass: 'bg-slate-400',
      }
    }

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const diffTime = targetDate.getTime() - today.getTime()
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays < 0) {
      const overdue = Math.abs(diffDays)
      return {
        text: `Quá hạn ${overdue} ngày`,
        days: diffDays,
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 font-bold',
        dotClass: 'bg-rose-600',
      }
    } else if (diffDays === 0) {
      return {
        text: 'Hết hạn hôm nay',
        days: 0,
        badgeClass: 'bg-red-50 text-red-700 border-red-300 font-bold animate-pulse',
        dotClass: 'bg-red-600',
      }
    } else if (diffDays <= 3) {
      return {
        text: `Còn ${diffDays} ngày`,
        days: diffDays,
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-300 font-bold',
        dotClass: 'bg-amber-500',
      }
    } else if (diffDays <= 7) {
      return {
        text: `Còn ${diffDays} ngày`,
        days: diffDays,
        badgeClass: 'bg-orange-50 text-orange-700 border-orange-200 font-semibold',
        dotClass: 'bg-orange-500',
      }
    } else if (diffDays <= 30) {
      return {
        text: `Còn ${diffDays} ngày`,
        days: diffDays,
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 font-semibold',
        dotClass: 'bg-blue-500',
      }
    } else {
      return {
        text: `Còn ${diffDays} ngày`,
        days: diffDays,
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 font-medium',
        dotClass: 'bg-emerald-500',
      }
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
          title={`Kho #${unit.id} (${unit.status}) - Không khớp bộ lọc hiện tại`}
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
               unit.status === 'Overdue' ? 'Quá hạn' : unit.status === 'Unknown' ? 'Unknown' : 'Bảo trì'}
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
              {unit.smartlock === 'Not reported' ? 'No lock data' : unit.smartlock.startsWith('SL-') ? unit.smartlock.slice(-4) : 'ID'}
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
             unit.status === 'Overdue' ? 'Quá hạn' : unit.status === 'Unknown' ? 'Unknown' : 'Bảo trì'}
          </span>
        </div>
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-6 w-full text-left max-w-7xl mx-auto">
      
      {/* Toast Notification */}
      {actionSuccessMessage && (
        <div className="fixed top-24 right-8 z-50 flex items-center gap-2 px-4 py-3 bg-slate-900 text-white rounded-xl shadow-xl border border-slate-700 animate-in fade-in duration-200">
          <span className="material-symbols-outlined text-emerald-400 text-[20px]">check_circle</span>
          <span className="text-xs font-semibold">{actionSuccessMessage}</span>
        </div>
      )}

      {/* TOP HEADER: CONTEXT & FACILITY SCOPE */}
      <header className="flex flex-col lg:flex-row items-stretch justify-between gap-4 p-6 bg-white rounded-2xl shadow-sm border border-slate-200">
        <div className="flex flex-col gap-2 max-w-2xl">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-slate-100 font-mono text-xs text-slate-800 uppercase tracking-wider font-semibold">
              <span className="w-2 h-2 rounded-full bg-blue-600"></span> {role === 'STAFF' ? 'Sơ Đồ Cơ Sở Kho' : 'Quản Lý Vận Hành Cơ Sở'}
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-mono font-bold">
              {currentShiftText}
            </span>
          </div>

          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            {currentFacilityName} — {role === 'STAFF' ? 'Sơ Đồ Cơ Sở Kho & Trạng Thái Buồng' : 'Bảng Tổng Quan Quản Lý'}
          </h1>

          <p className="text-xs text-slate-500">
            {role === 'STAFF'
              ? `Giám sát trực quan ${totalUnitsCount} kho tự quản • Trực quan buồng kho, thiết bị IoT & nghiệp vụ trạm.`
              : `Giám sát thời gian thực ${totalUnitsCount} kho tự quản • Trực ca nhân sự, doanh thu, hợp đồng & ngoại lệ nghiệp vụ.`}
          </p>
        </div>

        {/* Manager Actions & Modals */}
        <div className="flex items-center gap-2.5 self-start lg:self-center shrink-0 flex-wrap">

          {role !== 'STAFF' && (
            <button
              type="button"
              onClick={() => setShowCreateUnitModal(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-blue-600 bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>Thêm kho mới</span>
            </button>
          )}

          <button 
            type="button" 
            onClick={() => fetchUnits(selectedFacilityId)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 text-slate-800 font-semibold text-xs hover:bg-slate-200 transition border border-slate-200 cursor-pointer"
            title="Tải lại toàn bộ dữ liệu mới nhất"
          >
            <span className={`material-symbols-outlined text-[18px] text-blue-600 ${isLoading ? 'animate-spin' : ''}`}>sync</span>
            <span>{isLoading ? 'Đang tải...' : 'Làm mới'}</span>
          </button>
        </div>
      </header>

      {/* 1. OCCUPANCY & UNIT STATUS KPI STRIP (SUMMARY 1) */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        
        {/* Total Units */}
        <div 
          onClick={() => { setStatusFilter('all'); setActiveTab('overview'); }}
          className={`p-4 bg-white rounded-2xl border flex flex-col justify-between hover:shadow-md transition cursor-pointer ${
            statusFilter === 'all' && activeTab === 'overview'
              ? 'border-slate-800 ring-2 ring-slate-900/10 shadow-xs' 
              : 'border-slate-200 shadow-2xs hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-bold text-slate-500 font-mono">Tổng số kho</span>
            <span className="material-symbols-outlined text-slate-400 text-[20px]">warehouse</span>
          </div>
          <div className="flex items-baseline gap-1.5 mt-2">
            <span className="text-3xl font-extrabold font-mono tabular-nums text-slate-900 leading-none">{totalUnitsCount}</span>
            <span className="text-[11px] text-slate-500 font-medium">kho</span>
          </div>
          <div className="mt-3 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-slate-900 h-full rounded-full" style={{ width: '100%' }}></div>
          </div>
        </div>

        {/* Rented */}
        <div 
          onClick={() => { setStatusFilter('Rented'); setActiveTab('overview'); }}
          className={`p-4 bg-white rounded-2xl border flex flex-col justify-between hover:shadow-md transition cursor-pointer ${
            statusFilter === 'Rented' && activeTab === 'overview'
              ? 'border-blue-600 ring-2 ring-blue-500/20 bg-blue-50/20' 
              : 'border-slate-200 shadow-2xs hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-bold text-slate-500 font-mono">Đang thuê</span>
            <span className="px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 font-mono text-[10px] font-bold">{rentedPercent}%</span>
          </div>
          <div className="flex items-baseline gap-1.5 mt-2">
            <span className="text-3xl font-extrabold font-mono tabular-nums text-slate-900 leading-none">{rentedUnitsCount}</span>
            <span className="text-[11px] text-slate-500">kho</span>
          </div>
          <div className="mt-3 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-blue-600 h-full rounded-full" style={{ width: `${rentedPercent}%` }}></div>
          </div>
        </div>

        {/* Available */}
        <div 
          onClick={() => { setStatusFilter('Available'); setActiveTab('overview'); }}
          className={`p-4 bg-white rounded-2xl border flex flex-col justify-between hover:shadow-md transition cursor-pointer ${
            statusFilter === 'Available' && activeTab === 'overview'
              ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20' 
              : 'border-slate-200 shadow-2xs hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-bold text-slate-500 font-mono">Kho trống</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
          </div>
          <div className="flex items-baseline gap-1.5 mt-2">
            <span className="text-3xl font-extrabold font-mono tabular-nums text-emerald-600 leading-none">{availableUnitsCount}</span>
            <span className="text-[11px] text-slate-500">sẵn sàng</span>
          </div>
          <div className="mt-3 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${availablePercent}%` }}></div>
          </div>
        </div>

        {/* Pending */}
        <div 
          onClick={() => { setStatusFilter('Pending'); setActiveTab('overview'); }}
          className={`p-4 bg-white rounded-2xl border flex flex-col justify-between hover:shadow-md transition cursor-pointer ${
            statusFilter === 'Pending' && activeTab === 'overview'
              ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/20' 
              : 'border-slate-200 shadow-2xs hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-bold text-slate-500 font-mono">Chờ bàn giao</span>
            <span className="material-symbols-outlined text-amber-500 text-[18px]">pending_actions</span>
          </div>
          <div className="flex items-baseline gap-1.5 mt-2">
            <span className="text-3xl font-extrabold font-mono tabular-nums text-amber-600 leading-none">
              {pendingUnitsCount}
            </span>
            <span className="text-[11px] text-slate-500">đang đợi</span>
          </div>
          <div className="mt-3 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-amber-500 h-full rounded-full" style={{ width: `${pendingPercent}%` }}></div>
          </div>
        </div>

        {/* Maintenance */}
        <div 
          onClick={() => { setStatusFilter('Maintenance'); setActiveTab('overview'); }}
          className={`p-4 bg-white rounded-2xl border flex flex-col justify-between hover:shadow-md transition cursor-pointer ${
            statusFilter === 'Maintenance' && activeTab === 'overview'
              ? 'border-purple-500 ring-2 ring-purple-500/20 bg-purple-50/20' 
              : 'border-slate-200 shadow-2xs hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-bold text-slate-500 font-mono">Bảo trì kỹ thuật</span>
            <span className="material-symbols-outlined text-purple-600 text-[18px]">build_circle</span>
          </div>
          <div className="flex items-baseline gap-1.5 mt-2">
            <span className="text-3xl font-extrabold font-mono tabular-nums text-purple-600 leading-none">
              {maintenanceUnitsCount}
            </span>
            <span className="text-[11px] text-slate-500">ngưng dùng</span>
          </div>
          <div className="mt-3 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-purple-600 h-full rounded-full" style={{ width: `${maintenancePercent}%` }}></div>
          </div>
        </div>

        {/* Overdue */}
        <div 
          onClick={() => { setStatusFilter('Overdue'); setActiveTab('overview'); }}
          className={`p-4 bg-white rounded-2xl border flex flex-col justify-between hover:shadow-md transition cursor-pointer ${
            statusFilter === 'Overdue' && activeTab === 'overview'
              ? 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/20' 
              : 'border-slate-200 shadow-2xs hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-bold text-slate-500 font-mono">Nợ quá hạn</span>
            <span className="material-symbols-outlined text-rose-600 text-[18px]">lock_clock</span>
          </div>
          <div className="flex items-baseline gap-1.5 mt-2">
            <span className="text-3xl font-extrabold font-mono tabular-nums text-rose-700 leading-none">
              {overdueUnitsCount}
            </span>
            <span className="text-[11px] text-slate-500">kho nợ</span>
          </div>
          <div className="mt-3 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-rose-600 h-full rounded-full" style={{ width: `${overduePercent}%` }}></div>
          </div>
        </div>

      </section>

      {/* 7 MANAGEMENT-LEVEL SUMMARIES: TABS NAVIGATION */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer whitespace-nowrap ${
            activeTab === 'overview'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">grid_view</span>
          <span>1. Sơ Đồ Kho &amp; Thiết Bị</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('renewals')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer whitespace-nowrap ${
            activeTab === 'renewals'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">autorenew</span>
          <span>2. Xử Lý Gia Hạn Hợp Đồng</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('handovers-returns')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer whitespace-nowrap ${
            activeTab === 'handovers-returns'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">fact_check</span>
          <span>2. Bàn Giao &amp; Trả Kho ({upcomingHandovers.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('tickets')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer whitespace-nowrap ${
            activeTab === 'tickets'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">build_circle</span>
          <span>3. Sự Cố &amp; SLA ({tickets.filter(t => t.status !== 'RESOLVED').length})</span>
        </button>

        {role !== 'STAFF' && (
          <>
            <button
              type="button"
              onClick={() => setActiveTab('performance')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer whitespace-nowrap ${
                activeTab === 'performance'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">trending_up</span>
              <span>4. Hiệu Suất &amp; Ngoại Lệ</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('policy')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer whitespace-nowrap ${
                activeTab === 'policy'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">policy</span>
              <span>5. Chính Sách Vận Hành Cơ Sở</span>
            </button>
          </>
        )}
      </div>

      {/* ============================================================== */}
      {/* TAB 1: SƠ ĐỒ KHO & GIÁM SÁT THIẾT BỊ (SUMMARY 1) */}
      {/* ============================================================== */}
      {activeTab === 'overview' && (
        <section className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          
          {/* FLOOR MATRIX CANVAS (xl:col-span-8) */}
          <div className="xl:col-span-8 flex flex-col gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            {/* Controls Toolbar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200">
              {/* Floor Selector Tabs */}
              <div className="inline-flex p-1 bg-white rounded-lg border border-slate-200 shadow-2xs">
                <button 
                  type="button" 
                  onClick={() => setSelectedFloor('floor1')}
                  className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md font-semibold text-xs transition cursor-pointer ${
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
                  className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md font-semibold text-xs transition cursor-pointer ${
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
                  className="px-3 py-1.5 bg-white rounded-lg text-slate-800 text-xs border border-slate-200 focus:outline-none shadow-2xs font-medium cursor-pointer"
                >
                  <option value="all">Tất cả kích thước</option>
                  <option value="s">Kho nhỏ S (≤ 6.5m²)</option>
                  <option value="m">Kho vừa M (8m² - 12m²)</option>
                  <option value="l">Kho lớn L (15m² - 20m²)</option>
                </select>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px] text-slate-400">search</span>
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm mã kho (#A-101), khách..." 
                    className="pl-8 pr-3 py-1.5 bg-white text-slate-800 text-xs rounded-lg placeholder:text-slate-400 focus:outline-none border border-slate-200 shadow-2xs w-44 sm:w-52 font-mono"
                  />
                </div>
                {statusFilter !== 'all' && (
                  <button 
                    type="button" 
                    onClick={() => setStatusFilter('all')}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-900 text-white text-xs font-semibold cursor-pointer"
                    title="Xóa lọc"
                  >
                    <span>Lọc: {statusFilter}</span>
                    <span className="material-symbols-outlined text-[13px]">close</span>
                  </button>
                )}
              </div>
            </div>

            {/* Matrix View */}
            <div className="relative bg-slate-100 p-4 rounded-xl border border-slate-200 overflow-x-auto">
              <div className="flex items-center justify-between px-3.5 py-2 mb-3 bg-white rounded-lg font-mono text-[11px] text-slate-600 uppercase tracking-wider border border-slate-200 shadow-2xs">
                <span>{selectedFloor === 'floor1' ? facilityProfile.loadingBayFloor1 : facilityProfile.loadingBayFloor2}</span>
                <span className="font-semibold text-slate-800">{selectedFloor === 'floor1' ? facilityProfile.corridorNorth : facilityProfile.corridorClimate}</span>
                <span>{selectedFloor === 'floor1' ? facilityProfile.exitFloor1 : facilityProfile.exitFloor2}</span>
              </div>

              {selectedFloor === 'floor2' ? (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs font-bold text-cyan-900 uppercase flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-cyan-600 text-[18px]">warehouse</span>
                      {facilityProfile.zoneCName}
                    </span>
                  </div>
                  {permanentZoneC.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-xs bg-white rounded-lg border border-slate-200">
                      Chưa có thiết kế kho trên Tầng 2 cho cơ sở này
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                      {permanentZoneC.map(unit => renderUnitCard(unit))}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-xs font-bold text-slate-900 uppercase flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-slate-600 text-[18px]">inventory_2</span>
                        {facilityProfile.zoneAName}
                      </span>
                    </div>
                    {permanentZoneA.length === 0 ? (
                      <div className="p-6 text-center text-slate-500 text-xs bg-white rounded-lg border border-slate-200">
                        Chưa có thiết kế kho tại Phân khu A
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                        {permanentZoneA.map(unit => renderUnitCard(unit))}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-xs font-bold text-slate-900 uppercase flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-slate-600 text-[18px]">inventory</span>
                        {facilityProfile.zoneBName}
                      </span>
                    </div>
                    {permanentZoneB.length === 0 ? (
                      <div className="p-6 text-center text-slate-500 text-xs bg-white rounded-lg border border-slate-200">
                        Chưa có thiết kế kho tại Phân khu B
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                        {permanentZoneB.map(unit => renderUnitCard(unit))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* READ-ONLY CONTEXTUAL INSPECTION SLIDE-DRAWER PANEL (xl:col-span-4) */}
          {selectedUnit ? (
            <div className="xl:col-span-4 flex flex-col gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 sticky top-24 max-h-[calc(100vh-6rem)] overflow-y-auto">
              
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-slate-100 text-slate-800">
                    <span className="material-symbols-outlined text-[24px]">door_sliding</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-slate-400 font-mono tracking-wider">Hồ sơ giám sát</span>
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

              {/* Spec Table */}
              <div className="flex flex-col gap-1.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-slate-200/50">
                  <span className="text-slate-500">Cơ sở:</span>
                  <span className="font-semibold text-slate-800">{selectedUnit.facilityName || currentFacilityName}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-200/50">
                  <span className="text-slate-500">Vị trí:</span>
                  <span className="font-mono font-semibold text-slate-900">{selectedUnit.floorLevel} · Phân khu {getUnitZone(selectedUnit)}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-200/50">
                  <span className="text-slate-500">Diện tích:</span>
                  <span className="font-mono font-bold text-slate-900">{selectedUnit.size}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-200/50">
                  <span className="text-slate-500">Khách thuê:</span>
                  <span className="font-semibold text-slate-900">{selectedUnit.tenant}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-200/50">
                  <span className="text-slate-500">Mã hợp đồng:</span>
                  <span className="font-mono font-bold text-blue-600">{selectedUnit.contract}</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-500">Thời hạn:</span>
                  <span className="font-mono text-slate-800">{selectedUnit.due}</span>
                </div>
              </div>

              {/* SmartLock Telemetry */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col gap-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700">Khóa điện tử:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {selectedUnit.smartlock === 'Not reported' ? 'No device ID reported' : selectedUnit.smartlock}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 uppercase font-mono block">Pin SmartLock</span>
                    <span className="font-mono font-bold text-emerald-700 mt-0.5 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">battery_full</span>
                      {selectedUnit.battery || 'Not reported'}
                    </span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 uppercase font-mono block">Truy cập gần nhất</span>
                    <span className="font-mono text-[11px] font-bold text-slate-800 mt-0.5 truncate block">
                      {selectedUnit.lastAccess}
                    </span>
                  </div>
                </div>
              </div>

              {/* Manager Actions (Read-only / Exception Workflow) */}
              <div className="flex flex-col gap-2 pt-1">
                
                {selectedUnit.status === 'Pending' && (
                  <button
                    type="button"
                    onClick={() => {
                      setReadOnlyTargetBookingId(undefined)
                      setShowReadOnlyBookingModal(true)
                    }}
                    className="w-full py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">verified</span>
                    <span>Xem Hồ Sơ &amp; 4 Điều Kiện Bàn Giao</span>
                  </button>
                )}

                {role === 'FACILITY_MANAGER' && selectedUnit.status === 'Rented' && (
                  <button
                    type="button"
                    onClick={() => setShowDoorAccessModal(true)}
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-200 transition cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">history</span>
                    <span>Lịch Sử Mở Cửa &amp; Nhật Ký SmartLock</span>
                  </button>
                )}

                {selectedUnit.status === 'Overdue' && selectedUnitOverdue
                  && selectedUnitOverdue.contractId
                  && selectedUnitOverdue.overdueStage === 'ELIGIBLE_FOR_SEALING' && (
                  <button
                    type="button"
                    onClick={() => {
                      setSealingModalData({
                        unitCode: selectedUnit.id,
                        unitId: selectedUnit.backendId,
                        tenantName: selectedUnitOverdue.customerName || selectedUnit.tenant,
                        contractCode: selectedUnitOverdue.contractCode || 'N/A',
                        contractId: selectedUnitOverdue.contractId || undefined,
                        overdueDays: selectedUnitOverdue.daysOverdue,
                        totalDebt: selectedUnitOverdue.totalDebt != null
                          ? `${selectedUnitOverdue.totalDebt.toLocaleString('vi-VN')} ₫`
                          : 'Chưa đối soát'
                      })
                    }}
                    className="w-full py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">gavel</span>
                    <span>Xử Lý Nợ / Lập Hồ Sơ Niêm Phong Pháp Lý</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleToggleMaintenance}
                  disabled={selectedUnit.status !== 'Available' && selectedUnit.status !== 'Maintenance'}
                  className={`w-full py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition border ${
                    selectedUnit.status === 'Maintenance'
                      ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200 cursor-pointer'
                      : selectedUnit.status === 'Available'
                      ? 'bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200 cursor-pointer'
                      : 'bg-slate-100 text-slate-400 border-slate-200 opacity-60 cursor-not-allowed'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {selectedUnit.status === 'Maintenance' ? 'check_circle' : 'build'}
                  </span>
                  <span>{selectedUnit.status === 'Maintenance' ? 'Hoàn tất bảo trì (Mở lại kho)' : 'Chuyển bảo trì kỹ thuật'}</span>
                </button>

              </div>

            </div>
          ) : (
            <div className="xl:col-span-4 flex flex-col items-center justify-center p-10 bg-white rounded-2xl shadow-xs border border-slate-200 sticky top-24 text-center min-h-[360px]">
              <span className="material-symbols-outlined text-slate-300 text-[48px] mb-2">grid_view</span>
              <h3 className="text-sm font-bold text-slate-700">Chọn một kho từ sơ đồ</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Bấm vào ô kho để xem thông số kỹ thuật, pin SmartLock và trạng thái hợp đồng.
              </p>
            </div>
          )}

        </section>
      )}

      {/* ============================================================== */}
      {/* TAB: XỬ LÝ GIA HẠN HỢP ĐỒNG (THẨM ĐỊNH & THU CƯỚC) */}
      {/* ============================================================== */}
      {activeTab === 'renewals' && (
        <section className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div>
              <h3 className="font-headline text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600">autorenew</span>
                Quản Lý &amp; Thẩm Định Gia Hạn Hợp Đồng
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Xem xét, phê duyệt yêu cầu gia hạn kho và thu cước tại quầy cơ sở theo thẩm quyền
              </p>
            </div>
          </div>

          <ContractRenewalsManagementPanel
            currentFacilityId={selectedFacilityId}
            facilities={facilities}
            userRole={role}
            showChainWideFilter={role === 'BUSINESS_MANAGER' || role === 'ADMIN'}
          />
        </section>
      )}

      {/* ============================================================== */}
      {/* TAB 2: BÀN GIAO & TRẢ KHO (GIÁM SÁT TIẾN ĐỘ) */}
      {/* ============================================================== */}
      {activeTab === 'handovers-returns' && (
        <section className="flex flex-col gap-6">
          
          {/* Supervisory Notice Banner */}
          <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 flex items-start gap-3">
            <span className="material-symbols-outlined text-blue-600 text-[24px] shrink-0 mt-0.5">policy</span>
            <div className="text-xs text-blue-900 leading-relaxed">
              <strong className="block text-sm font-bold mb-0.5">Phân định thẩm quyền vận hành:</strong>
              Màn hình này cung cấp <strong>chế độ giám sát tiến độ</strong> dành cho Quản lý cơ sở. Toàn bộ quy trình tiếp đón khách, đối soát CCCD, nghiệm thu hiện trường 5 hạng mục và phát hành mã PIN bàn giao được thực hiện trực tiếp bởi <strong>Nhân viên quầy (Facility Staff)</strong> tại Bàn Vận Hành Quầy &amp; Tiếp Đón.
            </div>
          </div>

          {/* Upcoming Handovers Table */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-cyan-600 text-[20px]">how_to_reg</span>
                <h3 className="font-headline text-sm font-bold text-slate-900">
                  Lịch Hẹn Nhận Kho &amp; Chờ Bàn Giao ({upcomingHandovers.length} đơn)
                </h3>
              </div>
              <span className="text-xs text-slate-500 font-mono">Nhân viên quầy &amp; Quản lý tiếp đón trực tiếp</span>
            </div>

            {/* Filter Bar: Khung thời gian & Khoảng ngày */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 mb-5 p-3 bg-slate-50/70 border border-slate-200/80 rounded-xl">
              {/* Timeframe Tabs */}
              <div className="flex items-center gap-1.5 p-1 bg-white border border-slate-200/80 rounded-xl shadow-2xs overflow-x-auto">
                {[
                  { id: 'current', label: 'Hôm nay', icon: 'schedule' },
                  { id: 'past', label: 'Quá khứ', icon: 'history' },
                  { id: 'future', label: 'Tương lai', icon: 'upcoming' },
                  { id: 'all', label: 'Tất cả', icon: 'clear_all' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => handleCheckinTimeframeChange(tab.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                      checkinTimeframe === tab.id
                        ? 'bg-cyan-700 text-white shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[15px]">{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* Date Range Picker (Từ ngày - Đến ngày) */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs shadow-2xs">
                  <span className="material-symbols-outlined text-[15px] text-slate-400">calendar_month</span>
                  <span className="text-slate-500 font-medium text-[11px]">Từ ngày:</span>
                  <input
                    type="date"
                    value={checkinFromDate}
                    onChange={(e) => handleCheckinDateFilterApply(e.target.value, checkinToDate)}
                    className="bg-transparent border-none text-slate-800 text-xs font-mono focus:outline-none cursor-pointer"
                  />
                </div>
                <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs shadow-2xs">
                  <span className="material-symbols-outlined text-[15px] text-slate-400">event</span>
                  <span className="text-slate-500 font-medium text-[11px]">Đến ngày:</span>
                  <input
                    type="date"
                    value={checkinToDate}
                    onChange={(e) => handleCheckinDateFilterApply(checkinFromDate, e.target.value)}
                    className="bg-transparent border-none text-slate-800 text-xs font-mono focus:outline-none cursor-pointer"
                  />
                </div>
                {(checkinFromDate || checkinToDate) && (
                  <button
                    type="button"
                    onClick={handleResetCheckinDateFilter}
                    className="px-2.5 py-1.5 text-[11px] font-bold text-slate-600 hover:text-rose-600 bg-white hover:bg-rose-50 border border-slate-200 rounded-xl transition cursor-pointer flex items-center gap-1 shadow-2xs"
                    title="Xóa bộ lọc ngày"
                  >
                    <span className="material-symbols-outlined text-[14px]">close</span>
                    <span>Xóa lọc</span>
                  </button>
                )}
              </div>
            </div>

            {upcomingHandovers.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">Hiện không có lịch hẹn bàn giao kho nào trong danh sách lọc.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-mono uppercase text-[11px]">
                      <th className="py-2.5 px-3 rounded-l-lg">Khách Hàng</th>
                      <th className="py-2.5 px-3">Mã Đặt Chỗ</th>
                      <th className="py-2.5 px-3">Kho Đăng Ký</th>
                      <th className="py-2.5 px-3">Ngày Check-in</th>
                      <th className="py-2.5 px-3">Trạng Thái Đơn</th>
                      <th className="py-2.5 px-3">Cọc Giữ Chỗ</th>
                      <th className="py-2.5 px-3 rounded-r-lg text-right">Chi Tiết / Tiếp Nhận</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {upcomingHandovers.map(b => (
                      <tr key={b.id} className="hover:bg-slate-50/80">
                        <td className="py-3 px-3">
                          <span className="font-bold text-slate-900 block">{b.customerName || 'N/A'}</span>
                          <span className="text-[11px] text-slate-500 font-mono">{b.customerPhone || 'N/A'}</span>
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-900">{b.bookingCode}</td>
                        <td className="py-3 px-3 font-mono font-bold text-cyan-800">#{b.unitCode}</td>
                        <td className="py-3 px-3">
                          <div className="font-mono tabular-nums">
                            {b.expectedCheckInAt ? (
                              <>
                                <span className="font-bold text-slate-900">{new Date(b.expectedCheckInAt).toLocaleDateString('vi-VN')}</span>
                                <span className="text-[11px] text-cyan-700 font-semibold block">
                                  {new Date(b.expectedCheckInAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </>
                            ) : (
                              <span className="text-slate-700">{b.startDate}</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            b.status === 'CONFIRMED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {b.status === 'CONFIRMED' ? 'Đã xác nhận' : 'Chờ hoàn tất cọc'}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-900">
                          {(b.depositPaid || b.depositAmount || 0).toLocaleString('vi-VN')} đ
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-2 flex-wrap">
                            {b.assignedStaffName ? (
                              <div
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-semibold"
                                title={b.staffAssignmentNotes || undefined}
                              >
                                <span className="material-symbols-outlined text-[14px] text-emerald-600">person_check</span>
                                <span>{b.assignedStaffName}</span>
                              </div>
                            ) : (
                              <button
                                type="button"
                                disabled={claimingBookingId === b.id}
                                onClick={() => handleManagerClaimReception(b)}
                                className="px-2.5 py-1.5 rounded-lg font-bold text-[11px] bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer flex items-center gap-1 shadow-xs disabled:opacity-50"
                              >
                                <span className="material-symbols-outlined text-[14px]">how_to_reg</span>
                                <span>{claimingBookingId === b.id ? 'Đang nhận...' : 'Tiếp nhận'}</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                setReadOnlyTargetBookingId(b.id)
                                setShowReadOnlyBookingModal(true)
                              }}
                              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold transition cursor-pointer"
                            >
                              Xem hồ sơ đối soát
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Overdue Returns Table */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600 text-[20px]">assignment_return</span>
                <h3 className="font-headline text-sm font-bold text-slate-900">
                  Hợp Đồng Đến Hạn &amp; Chờ Nghiệm Thu Trả Kho ({activeRentals.length} hợp đồng)
                </h3>
              </div>
              <span className="text-xs text-slate-500 font-mono">Thẩm định hiện trường bởi nhân viên quầy</span>
            </div>

            {activeRentals.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">Không có hợp đồng nào đang chờ nghiệm thu trả kho.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-mono uppercase text-[11px]">
                      <th className="py-2.5 px-3 rounded-l-lg">Khách Hàng</th>
                      <th className="py-2.5 px-3">Mã Hợp Đồng</th>
                      <th className="py-2.5 px-3">Kho</th>
                      <th className="py-2.5 px-3">Hạn Kết Thúc</th>
                      <th className="py-2.5 px-3">Hết Hạn Sau</th>
                      <th className="py-2.5 px-3">Tiền Cọc Bảo Lãnh</th>
                      <th className="py-2.5 px-3 rounded-r-lg text-right">Hành Động Quản Lý</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(showAllRentals ? activeRentals : activeRentals.slice(0, 10)).map(r => {
                      const countdown = getExpirationCountdown(r.endDate)
                      return (
                        <tr key={r.id} className="hover:bg-slate-50/80">
                          <td className="py-3 px-3">
                            <span className="font-bold text-slate-900 block">{r.customerName || 'N/A'}</span>
                            <span className="text-[11px] text-slate-500 font-mono">{r.customerPhone || 'N/A'}</span>
                          </td>
                          <td className="py-3 px-3 font-mono font-bold text-blue-600">{r.bookingCode}</td>
                          <td className="py-3 px-3 font-mono font-bold text-cyan-800">#{r.unitCode}</td>
                          <td className="py-3 px-3 font-mono text-slate-700">{r.endDate || 'Hôm nay'}</td>
                          <td className="py-3 px-3">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] border shadow-2xs ${countdown.badgeClass}`}
                              title={`Hạn hợp đồng: ${r.endDate || 'N/A'}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${countdown.dotClass}`}></span>
                              <span className="font-mono">{countdown.text}</span>
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono font-bold text-slate-900">
                            {(r.depositPaid || r.depositAmount || 0).toLocaleString('vi-VN')} đ
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setReadOnlyTargetBookingId(r.id)
                                setShowReadOnlyBookingModal(true)
                              }}
                              className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-[11px] transition cursor-pointer"
                            >
                              Xem chi tiết
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                {activeRentals.length > 10 && (
                  <div className="pt-3.5 mt-2 flex items-center justify-between border-t border-slate-100 text-xs text-slate-500">
                    <span>
                      Hiển thị <strong>{showAllRentals ? activeRentals.length : 10}</strong> trên tổng số <strong>{activeRentals.length}</strong> hợp đồng
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAllRentals(!showAllRentals)}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition cursor-pointer shadow-2xs"
                    >
                      {showAllRentals ? 'Thu gọn (10 hợp đồng)' : `Xem tất cả ${activeRentals.length} hợp đồng`}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

        </section>
      )}

      {/* ============================================================== */}
      {/* TAB 3: SỰ CỐ & SLA VẬN HÀNH */}
      {/* ============================================================== */}
      {activeTab === 'tickets' && (
        <section className="flex flex-col gap-6">
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-[11px] uppercase font-bold text-slate-500 font-mono block">Tổng Sự Cố Đang Xử Lý</span>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-3xl font-extrabold font-mono text-slate-900 tabular-nums">
                  {tickets.filter(t => t.status !== 'RESOLVED' && t.status !== 'CLOSED').length}
                </span>
                <span className="text-xs text-slate-500">ticket</span>
              </div>
              <span className="text-xs text-slate-500 mt-2 block">Bao gồm khóa, cửa và hạ tầng</span>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-[11px] uppercase font-bold text-rose-600 font-mono block">Sự Cố Mức Độ Cao (High / Urgent)</span>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-3xl font-extrabold font-mono text-rose-600 tabular-nums">
                  {tickets.filter(t => (t.priority === 'HIGH' || t.priority === 'URGENT') && t.status !== 'RESOLVED').length}
                </span>
                <span className="text-xs text-slate-500">cần xử lý ngay</span>
              </div>
              <span className="text-xs text-rose-600 font-semibold mt-2 block">Ưu tiên xử lý hiện trường</span>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
              <div>
                <span className="text-[11px] uppercase font-bold text-slate-500 font-mono block">Tuân Thủ SLA Vận Hành</span>
                <p className="text-xs text-emerald-700 font-bold mt-1">98.2% đúng hạn cam kết SLA</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Thời gian xử lý trung bình: 18 phút</p>
              </div>
              <Link
                to="/portal/tickets"
                className="mt-3 w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition text-center block"
              >
                Mở Cổng Xử Lý Sự Cố Chi Tiết &rarr;
              </Link>
            </div>

          </div>

          {/* Tickets Queue Table */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-rose-600 text-[20px]">warning</span>
                <h3 className="font-headline text-sm font-bold text-slate-900">
                  Hàng Đợi Sự Cố Tại Cơ Sở
                </h3>
              </div>
              <span className="text-xs text-slate-500 font-mono">{tickets.length} lượt ghi nhận</span>
            </div>

            {tickets.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">Không có sự cố nào đang chờ xử lý tại cơ sở này.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-mono uppercase text-[11px]">
                      <th className="py-2.5 px-3 rounded-l-lg">Mã Ticket</th>
                      <th className="py-2.5 px-3">Thời Gian</th>
                      <th className="py-2.5 px-3">Tiêu Đề</th>
                      <th className="py-2.5 px-3">Kho</th>
                      <th className="py-2.5 px-3">Phân Loại</th>
                      <th className="py-2.5 px-3">Mức Độ</th>
                      <th className="py-2.5 px-3 rounded-r-lg text-right">Trạng Thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedTickets.map(t => (
                      <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-slate-900">#{t.ticketCode || t.id.slice(0, 6)}</td>
                        <td className="py-3 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                          {t.createdAt ? (
                            <div className="flex flex-col">
                              <span className="font-semibold text-slate-800">
                                {new Date(t.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {new Date(t.createdAt).toLocaleDateString('vi-VN')}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-900">{t.title}</td>
                        <td className="py-3 px-3 font-mono font-bold text-cyan-800">#{t.unitCode || 'Chung'}</td>
                        <td className="py-3 px-3 font-mono text-slate-500">{t.category}</td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            t.priority === 'HIGH' || t.priority === 'URGENT'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {t.priority}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            t.status === 'RESOLVED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {t.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls - Centered */}
            {tickets.length > 0 && (
              <div className="relative flex flex-col md:flex-row items-center justify-between gap-3 pt-4 mt-2 border-t border-slate-100 text-xs">
                {/* Left: Range Info & Page Size */}
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 font-medium text-center md:text-left">
                  <div>
                    Hiển thị <span className="font-semibold text-slate-900 font-mono">{tickets.length === 0 ? 0 : (ticketCurrentPage - 1) * ticketPageSize + 1}</span> - <span className="font-semibold text-slate-900 font-mono">{Math.min(ticketCurrentPage * ticketPageSize, tickets.length)}</span> trên tổng số <span className="font-semibold text-slate-900 font-mono">{tickets.length}</span> sự cố
                  </div>
                  <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
                    <span>Mỗi trang:</span>
                    <select
                      value={ticketPageSize}
                      onChange={(e) => {
                        setTicketPageSize(Number(e.target.value))
                        setTicketCurrentPage(1)
                      }}
                      className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={15}>15</option>
                    </select>
                  </div>
                </div>

                {/* Center: Pagination Buttons */}
                <div className="flex items-center justify-center gap-1.5 md:absolute md:left-1/2 md:-translate-x-1/2">
                  <button
                    type="button"
                    onClick={() => setTicketCurrentPage(p => Math.max(1, p - 1))}
                    disabled={ticketCurrentPage === 1}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer text-xs font-semibold text-slate-700 transition flex items-center gap-1 shadow-2xs"
                    title="Trang trước"
                  >
                    <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                    <span className="hidden md:inline">Trước</span>
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalTicketPages }, (_, i) => i + 1).map(pageNum => {
                      if (
                        totalTicketPages > 6 &&
                        pageNum !== 1 &&
                        pageNum !== totalTicketPages &&
                        Math.abs(pageNum - ticketCurrentPage) > 1
                      ) {
                        if (pageNum === 2 || pageNum === totalTicketPages - 1) {
                          return (
                            <span key={pageNum} className="px-1 text-slate-400 font-mono">
                              ...
                            </span>
                          )
                        }
                        return null
                      }
                      const isActive = ticketCurrentPage === pageNum
                      return (
                        <button
                          key={pageNum}
                          type="button"
                          onClick={() => setTicketCurrentPage(pageNum)}
                          className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-xs font-bold transition flex items-center justify-center cursor-pointer ${
                            isActive
                              ? 'bg-slate-900 text-white shadow-xs'
                              : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {pageNum}
                        </button>
                      )
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => setTicketCurrentPage(p => Math.min(totalTicketPages, p + 1))}
                    disabled={ticketCurrentPage === totalTicketPages}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer text-xs font-semibold text-slate-700 transition flex items-center gap-1 shadow-2xs"
                    title="Trang sau"
                  >
                    <span className="hidden md:inline">Sau</span>
                    <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                  </button>
                </div>

                {/* Empty right spacer to keep right edge clear of floating AI chat button */}
                <div className="hidden md:block w-28 pointer-events-none" aria-hidden="true" />
              </div>
            )}
          </div>

        </section>
      )}

      {/* ============================================================== */}
      {/* TAB 4: HIỆU SUẤT & NGOẠI LỆ QUẢN LÝ */}
      {/* ============================================================== */}
      {activeTab === 'performance' && (
        <section className="flex flex-col gap-6">
          
          {/* Facility Performance Overview (Summary 6) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-[11px] uppercase font-bold text-slate-500 font-mono block">Tỷ Lệ Lấp Đầy Cơ Sở</span>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-3xl font-extrabold font-mono text-blue-600 tabular-nums">{rentedPercent}%</span>
                <span className="text-xs text-slate-500">mục tiêu 85%</span>
              </div>
              <div className="mt-3 w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-blue-600 h-full rounded-full" style={{ width: `${rentedPercent}%` }}></div>
              </div>
            </div>

            <div 
              onClick={() => setShowIoTModal(true)}
              className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs cursor-pointer hover:border-slate-300 transition"
              title="Xem thông số hạ tầng vi khí hậu & telemetry IoT"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase font-bold text-slate-500 font-mono block">Hạ Tầng Mạng IoT LoRaWAN</span>
                <span className="material-symbols-outlined text-slate-400 text-[18px]">sensors</span>
              </div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-lg font-bold text-slate-700">Not connected</span>
                <span className="text-xs text-slate-500">hardware integration</span>
              </div>
              <span className="text-xs text-amber-700 font-semibold mt-2 block">No live device telemetry is available.</span>
            </div>

          </div>

          {/* Exceptions Requiring Manager Review */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-purple-600 text-[22px]">gavel</span>
                <h3 className="font-headline text-base font-bold text-slate-900">
                  Trung Tâm Phê Duyệt &amp; Xử Lý Ngoại Lệ Nghiệp Vụ
                </h3>
              </div>
              <span className="text-xs text-slate-500">Chỉ dành cho Quản lý cơ sở / BOM</span>
            </div>

            <div className="grid grid-cols-1 gap-4">
              
              {/* Exception 1: Asset Sealing & Delinquency */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-900 text-xs">Niêm Phong Tài Sản Quá Hạn</span>
                    <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-rose-100 text-rose-800">
                      {overdueUnitsCount} kho nợ cước
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Theo dõi hợp đồng quá hạn, thu hồi PIN/QR trong Boxora khi cần và lập biên bản niêm phong. Trạng thái khóa vật lý chưa được xác minh ({overdueItems.length} hồ sơ cần theo dõi).
                  </p>
                </div>
                <Link
                  to="/portal/overdue"
                  className="mt-4 w-full py-2 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition text-center block"
                >
                  Quản Lý Cưỡng Chế Nợ &rarr;
                </Link>
              </div>

            </div>
          </div>

        </section>
      )}

      {/* ============================================================== */}
      {/* TAB 5: CHÍNH SÁCH VẬN HÀNH CƠ SỞ */}
      {/* ============================================================== */}
      {activeTab === 'policy' && (
        <section className="flex flex-col gap-6">
          {/* Header Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[28px]">policy</span>
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-headline text-lg font-bold text-slate-900">
                    Chính Sách Vận Hành Cơ Sở
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 text-xs font-bold border border-blue-200">
                    {currentFacilityName}
                  </span>
                  {hasPolicyException && (
                    <span className="px-2.5 py-0.5 rounded-full font-mono text-[11px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                      Có quyền ngoại lệ
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Quy định tỷ lệ tiền cọc, thời gian thuê tối thiểu, ân hạn nợ, SLA hoàn cọc và quy chế niêm phong tại chi nhánh.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start md:self-center">
              <button
                type="button"
                onClick={() => setIsPolicyModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">tune</span>
                <span>{hasPolicyException ? 'Điều chỉnh ngoại lệ policy' : 'Xem chi tiết & bảng quy chuẩn'}</span>
              </button>
            </div>
          </div>

          {/* Policy Detail Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Tiền Cọc */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase font-bold text-slate-500 font-mono">Tiền Cọc Đảm Bảo</span>
                  <span className="material-symbols-outlined text-blue-600 text-[20px]">account_balance_wallet</span>
                </div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold font-mono text-slate-900 tabular-nums">
                    {facilityPolicy?.depositPercentage ?? facilityPolicy?.depositPercent ?? 100}%
                  </span>
                  <span className="text-xs text-slate-500">giá thuê</span>
                </div>
                <p className="text-xs text-slate-600 mt-2">
                  Thuê tối thiểu: <strong className="text-slate-900">{facilityPolicy?.minimumRentalMonths ?? 1} tháng</strong>
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
                Mở gia hạn trước: {facilityPolicy?.renewalWindowDays ?? 3} ngày
              </div>
            </div>

            {/* Card 2: Hoàn Cọc & Hủy Booking */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase font-bold text-slate-500 font-mono">Chính Sách Hủy &amp; Hoàn</span>
                  <span className="material-symbols-outlined text-emerald-600 text-[20px]">currency_exchange</span>
                </div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold font-mono text-emerald-600 tabular-nums">
                    {facilityPolicy?.cancellationFullRefundHours ?? 48}h
                  </span>
                  <span className="text-xs text-slate-500">hoàn 100%</span>
                </div>
                <p className="text-xs text-slate-600 mt-2">
                  Hoàn {facilityPolicy?.cancellationPartialRefundPercent ?? 50}% nếu hủy trước <strong className="text-slate-900">{facilityPolicy?.cancellationPartialRefundHours ?? 24}h</strong>
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
                SLA hoàn tiền cọc: {facilityPolicy?.depositRefundSlaDays ?? 5} ngày
              </div>
            </div>

            {/* Card 3: Nghiệm Thu Trả Kho */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase font-bold text-slate-500 font-mono">Báo Trước Trả Kho</span>
                  <span className="material-symbols-outlined text-amber-600 text-[20px]">assignment_return</span>
                </div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold font-mono text-slate-900 tabular-nums">
                    {facilityPolicy?.returnNoticeDays ?? 0}
                  </span>
                  <span className="text-xs text-slate-500">ngày</span>
                </div>
                <p className="text-xs text-slate-600 mt-2">
                  Kiểm định hiện trường: <strong className="text-slate-900">100% đạt chuẩn</strong>
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
                Khấu trừ nếu hư hỏng chốt hoặc tồn đọng rác
              </div>
            </div>

            {/* Card 4: Quá Hạn & Niêm Phong */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase font-bold text-slate-500 font-mono">Xử Lý Quá Hạn Nợ</span>
                  <span className="material-symbols-outlined text-rose-600 text-[20px]">gavel</span>
                </div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold font-mono text-rose-600 tabular-nums">
                    {facilityPolicy?.overdueGraceDays ?? 1}
                  </span>
                  <span className="text-xs text-slate-500">ngày ân hạn</span>
                </div>
                <p className="text-xs text-slate-600 mt-2">
                  Phạt trễ: <strong className="text-rose-700">{(facilityPolicy?.dailyLateFee ?? 50000).toLocaleString('vi-VN')} đ/ngày</strong>
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
                Khóa PIN: {facilityPolicy?.overdueAccessDisableDays ?? 3} ngày • Niêm phong: {facilityPolicy?.overdueSealingDays ?? 7} ngày
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ============================================================== */}
      {/* MODALS */}
      {/* ============================================================== */}
      
      {/* 1. IoT Telemetry Modal */}
      <IoTTelemetryModal
        isOpen={showIoTModal}
        onClose={() => setShowIoTModal(false)}
        facilityName={currentFacilityName}
        totalUnits={totalUnitsCount}
      />

      {/* 3. Create Storage Unit Modal */}
      <CreateStorageUnitModal
        isOpen={showCreateUnitModal}
        facilities={facilities}
        selectedFacilityId={selectedFacilityId}
        onClose={() => setShowCreateUnitModal(false)}
        onCreated={handleStorageUnitCreated}
      />

      {/* 4. Read-Only Booking & Prerequisites Detail Modal (FOR FACILITY MANAGER) */}
      <BookingDetailReadOnlyModal
        isOpen={showReadOnlyBookingModal}
        onClose={() => setShowReadOnlyBookingModal(false)}
        bookingId={readOnlyTargetBookingId}
        unitCode={selectedUnit?.id}
        unitBackendId={selectedUnit?.backendId}
      />

      {/* 5. Door Access History Modal */}
      {showDoorAccessModal && selectedUnit && (
        <DoorAccessHistoryModal
          isOpen={showDoorAccessModal}
          onClose={() => setShowDoorAccessModal(false)}
          unit={selectedUnit}
        />
      )}

      {/* 8. Notice Dispatcher Modal */}
      {noticeModalData && (
        <NoticeDispatcherModal
          isOpen={true}
          onClose={() => setNoticeModalData(null)}
          noticeData={noticeModalData}
          onSendNotice={(msg) => triggerAction(msg)}
        />
      )}

      {/* 9. Asset Sealing Modal */}
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
            if (selectedFacilityId) void fetchUnits(selectedFacilityId)
          }}
        />
      )}

      {/* 10. Facility Policy View & Exception Modal */}
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

      {/* 11. Reception Shift & Check-in Alert Modal */}
      {receptionAlertData && (
        <ReceptionShiftAlertModal
          isOpen={receptionAlertData.isOpen}
          onClose={() => setReceptionAlertData(null)}
          message={receptionAlertData.message}
          booking={receptionAlertData.booking}
          role={role || 'FACILITY_MANAGER'}
        />
      )}

    </div>
  )
}
