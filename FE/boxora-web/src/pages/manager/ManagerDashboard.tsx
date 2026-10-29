import React, { useState, useEffect, useMemo } from 'react'
import { useOutletContext, Link, useSearchParams } from 'react-router-dom'
import { storageUnitService } from '../../services/storageUnitService'
import { facilityService } from '../../services/facilityService'
import { facilityPolicyService } from '../../services/facilityPolicyService'
import { reportService } from '../../services/reportService'
import { bookingService } from '../../services/bookingService'
import { contractService } from '../../services/contractService'
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
import { EarlyCheckInConfirmModal, isBookingBeforeCheckInTime, EarlyCheckInActionType } from '../../components/modals/EarlyCheckInConfirmModal'
import { CancelOverdueBookingModal } from '../../components/modals/CancelOverdueBookingModal'
import { ContractRenewalsManagementPanel } from '../../components/renewal/ContractRenewalsManagementPanel'
import { HandoverCheckInWorkbench } from '../staff/components/HandoverCheckInWorkbench'
import { HandoverReturnWorkbench } from '../staff/components/HandoverReturnWorkbench'
import { PendingReservationsWorkbench } from '../staff/components/PendingReservationsWorkbench'
import { reservationEmailService } from '../../services/reservationEmailService'
import { toast } from '../../utils/toast'
import { RefundManagementWorkbench } from './components/RefundManagementWorkbench'
import { refundService } from '../../services/refundService'

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
  imageUrl?: string
  maintenanceReason?: string
  maintenanceBy?: string
  maintenanceAt?: string
}

type ManagerDashboardTab = 'overview' | 'pending_orders' | 'reception' | 'handovers-returns' | 'returns' | 'renewals' | 'tickets' | 'refunds' | 'policy'

const mergeGuestArrivals = (apiArrivals: Booking[], targetId?: string): Booking[] => {
  let list = [...apiArrivals]
  try {
    const rawLocal = localStorage.getItem('boxora_guest_reservations')
    if (rawLocal) {
      const parsed = JSON.parse(rawLocal)
      if (Array.isArray(parsed)) {
        const localArrivals: Booking[] = parsed
          .filter((r: any) => !targetId || r.facility?.id === targetId || r.facilityId === targetId)
          .map((r: any) => ({
            id: r.id || `LOCAL-RES-${r.bookingCode}`,
            bookingCode: r.bookingCode,
            customerName: r.customer?.fullName || r.customerName || 'Khách đặt giữ chỗ',
            customerPhone: r.customer?.phone || r.customerPhone || 'N/A',
            identityCardNumber: r.customer?.idCard || r.customerIdCard || r.identityCardNumber,
            customerEmail: r.customer?.email || r.customerEmail,
            facilityId: r.facility?.id || r.facilityId || targetId || '',
            facilityName: r.facility?.name || r.facilityName || 'Cơ sở Boxora',
            unitTypeId: r.unitTypeId,
            unitTypeName: r.unitTypeName || r.sizeName || r.size?.volumeText,
            unitCode: r.unitCode || r.sizeName || r.size?.volumeText || 'Kho tự quản',
            storageUnitId: r.storageUnitId || '',
            startDate: r.startDate || new Date().toISOString().slice(0, 10),
            endDate: r.rentalEndDate || '',
            expectedCheckInAt: r.expectedCheckInAt || (r.checkInDate ? `${r.checkInDate}T${r.checkInTime ? r.checkInTime.split(' - ')[0] || '09:00' : '09:00'}:00` : undefined),
            checkInTime: r.checkInTime,
            status: (r.status || 'PENDING_CONTACT') as any,
            customerId: r.customerId || 'guest',
            accessCode: r.accessCode || r.bookingCode || '',
            rentalMonths: r.rentalMonths || 1,
            totalRentalFee: r.totalRentalFee || r.totalRent || 0,
            depositAmount: r.depositAmount || 0,
            depositPaid: r.depositPaid ?? (r.paymentStatus === 'PAID' ? (r.depositAmount || 0) : 0),
            paymentStatus: r.paymentStatus === 'PAID' ? 'PAID' : 'UNPAID',
            signingMethod: r.signingMethod || (r.paymentMethod === 'AT_FACILITY' || r.paymentMethod === 'IN_PERSON' ? 'IN_PERSON' : 'ONLINE'),
            assignedStaffName: r.assignedStaffName,
            contractCode: r.contractCode,
            contractSigned: r.contractSigned,
            paperContractUrl: r.paperContractUrl,
            paymentProofUrl: r.paymentProofUrl,
            checkinOverdueReminderSentAt: r.checkinOverdueReminderSentAt,
            createdAt: r.createdAt,
          }))

        const existingCodes = new Set(list.map(b => b.bookingCode))
        const newLocal = localArrivals.filter(b => !existingCodes.has(b.bookingCode))
        list = [...list, ...newLocal]
      }
    }
  } catch (err) {
    console.warn('Lỗi đọc đơn giữ chỗ từ localStorage:', err)
  }
  return list
}

export const ManagerDashboard: React.FC = () => {
  const { t } = useLanguage()
  const { user, role, hasPermission } = useAuth()
  const { selectedFacility, setSelectedFacility, facilities: contextFacilities } = useOutletContext<{
    selectedFacility?: string
    setSelectedFacility?: (facId: string) => void
    facilities?: Facility[]
  }>() || {}

  const isAdmin = role === 'ADMIN'
  const rawRole = (typeof user?.role === 'string' ? user?.role : user?.role?.name || user?.roleName || role || '').toUpperCase()
  const isManagementRole = rawRole === 'ADMIN' || rawRole === 'BUSINESS_MANAGER' || role === 'ADMIN' || role === 'BUSINESS_MANAGER'
  const isFacilityScoped = role === 'FACILITY_MANAGER' || role === 'STAFF'
  const assignedFacilityId = user?.facilityId

  // Tab State
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab') as ManagerDashboardTab | null

  const isTabAllowed = (tab: ManagerDashboardTab | null): boolean => {
    if (!tab) return false
    if (role === 'STAFF') {
      return tab === 'overview' || tab === 'pending_orders' || tab === 'reception' || tab === 'handovers-returns' || tab === 'returns' || tab === 'renewals' || tab === 'tickets'
    }
    return tab === 'overview' || tab === 'pending_orders' || tab === 'reception' || tab === 'handovers-returns' || tab === 'returns' || tab === 'renewals' || tab === 'tickets' || tab === 'refunds' || tab === 'policy'
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
    } else if (role === 'STAFF' && currentTab === 'policy') {
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
  type UnitStatusFilter = 'all' | 'Rented' | 'Available' | 'Pending' | 'Maintenance' | 'Overdue'
  const validStatuses: UnitStatusFilter[] = ['all', 'Rented', 'Available', 'Pending', 'Maintenance', 'Overdue']
  const initialStatusParam = searchParams.get('status') as UnitStatusFilter | null
  const initialStatus: UnitStatusFilter = (initialStatusParam && validStatuses.includes(initialStatusParam)) ? initialStatusParam : 'all'
  const [statusFilter, setStatusFilter] = useState<UnitStatusFilter>(initialStatus)
  const [selectedFloor, setSelectedFloor] = useState<'floor1' | 'floor2'>('floor1')
  const [sizeFilter, setSizeFilter] = useState<'all' | 's' | 'm' | 'l'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUnit, setSelectedUnit] = useState<InspectedUnit | null>(null)
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null)

  // Management Summaries Data
  const [upcomingHandovers, setUpcomingHandovers] = useState<Booking[]>([])
  const [activeRentals, setActiveRentals] = useState<Booking[]>([])
  const [showAllRentals, setShowAllRentals] = useState(false)
  const [tickets, setTickets] = useState<SupportTicketRecord[]>([])
  const [renewalsCount, setRenewalsCount] = useState<number>(0)

  // Đếm đơn đặt giữ chỗ chờ liên hệ / chờ xử lý
  const pendingOrdersCount = useMemo(() => {
    return upcomingHandovers.filter(b => {
      const s = String(b.status || '').toUpperCase()
      if (s === 'CANCELLED' || s === 'REJECTED' || s === 'ACTIVE' || s === 'COMPLETED' || s === 'CONFIRMED' || (s as string) === 'CHECKIN_STEP1_COMPLETED') return false
      return s === 'PENDING_CONTACT' || s === 'PENDING_PAYMENT' || s === 'PENDING_APPROVAL' || (s as string) === 'PENDING_SIGNATURE' || s === 'PENDING' || !s
    }).length
  }, [upcomingHandovers])

  // Check-in Filter & Claim States
  const [checkinTimeframe, setCheckinTimeframe] = useState<'current' | 'today' | 'past' | 'future' | 'all'>('all')
  const [checkinFromDate, setCheckinFromDate] = useState<string>('')
  const [checkinToDate, setCheckinToDate] = useState<string>('')
  const [claimingBookingId, setClaimingBookingId] = useState<string | null>(null)
  const [activeBookingId, setActiveBookingId] = useState<string>(
    searchParams.get('bookingId') || searchParams.get('checkinBookingId') || ''
  )
  const [earlyConfirmState, setEarlyConfirmState] = useState<{
    booking: Booking
    actionType: EarlyCheckInActionType
    onConfirm: () => void
  } | null>(null)

  useEffect(() => {
    const bId = searchParams.get('bookingId') || searchParams.get('checkinBookingId')
    if (bId) {
      setActiveBookingId(bId)
    }
  }, [searchParams])

  // Handover / Reception pagination
  const [handoverPage, setHandoverPage] = useState<number>(1)
  const [handoverPageSize, setHandoverPageSize] = useState<number>(10)

  // Expiring rentals / Return inspection pagination
  const [rentalPage, setRentalPage] = useState<number>(1)
  const [rentalPageSize] = useState<number>(5)

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
  const [maintenanceModalUnit, setMaintenanceModalUnit] = useState<InspectedUnit | null>(null)
  const [maintenanceReasonInput, setMaintenanceReasonInput] = useState<string>('')
  const [maintenanceByInput, setMaintenanceByInput] = useState<string>('')
  const [maintenanceError, setMaintenanceError] = useState<string>('')
  const [isSubmittingMaintenance, setIsSubmittingMaintenance] = useState<boolean>(false)
  const [showReadOnlyBookingModal, setShowReadOnlyBookingModal] = useState(false)
  const [receptionAlertData, setReceptionAlertData] = useState<{
    isOpen: boolean
    message: string
    booking?: Booking | null
  } | null>(null)
  const [readOnlyTargetBookingId, setReadOnlyTargetBookingId] = useState<string | undefined>(undefined)
  const [readOnlyTargetUnitCode, setReadOnlyTargetUnitCode] = useState<string | undefined>(undefined)
  const [readOnlyTargetUnitBackendId, setReadOnlyTargetUnitBackendId] = useState<string | undefined>(undefined)
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

  // Quét tự động gửi email nhắc nhở quá hạn 24h đối với đơn ký + thanh toán tại quầy
  useEffect(() => {
    try {
      if (typeof (reservationEmailService as any)?.checkAndSendOverdueReminders === 'function') {
        reservationEmailService.checkAndSendOverdueReminders()
      } else if (typeof (reservationEmailService as any)?.['checkAndSendQuá hạnReminders'] === 'function') {
        (reservationEmailService as any)['checkAndSendQuá hạnReminders']()
      }
    } catch (e) {
      console.warn('Error running initial overdue reminder check:', e)
    }

    const interval = setInterval(() => {
      try {
        if (typeof (reservationEmailService as any)?.checkAndSendOverdueReminders === 'function') {
          reservationEmailService.checkAndSendOverdueReminders()
        } else if (typeof (reservationEmailService as any)?.['checkAndSendQuá hạnReminders'] === 'function') {
          (reservationEmailService as any)['checkAndSendQuá hạnReminders']()
        }
      } catch (e) {
        console.warn('Error running interval overdue reminder check:', e)
      }
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  // Tự động làm mới danh sách khi có thay đổi đơn đặt hoặc kho
  useEffect(() => {
    const handleSync = () => {
      const targetId = selectedFacilityId && selectedFacilityId !== 'ALL' ? selectedFacilityId : undefined
      void fetchUpcomingHandovers(targetId)
      void fetchUnits(targetId)
    }
    window.addEventListener('boxora:storage-units-refresh', handleSync)
    window.addEventListener('boxora_reservation_updated', handleSync)
    return () => {
      window.removeEventListener('boxora:storage-units-refresh', handleSync)
      window.removeEventListener('boxora_reservation_updated', handleSync)
    }
  }, [selectedFacilityId])

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
      if (targetFacility !== selectedFacilityId) {
        setStatusFilter('all')
      }
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

      const [unitsRes, debtRes, polRes, arrivalsRes, rentalsRes, ticketsRes, renewalsRes] = await Promise.allSettled([
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
        contractService.getRenewals({ facilityId: targetId, size: 100 }),
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
            tenant: isMaint ? (su.maintenanceBy || 'Kỹ thuật viên cơ sở') : (su.tenantName || (isAvail ? 'Kho trống' : isRes ? 'Đang cập nhật hồ sơ' : 'Chưa có thông tin')),
            contract: isMaint ? (su.maintenanceReason || 'Bảo trì kỹ thuật định kỳ') : (su.contractCode || (isAvail ? 'Chưa có hợp đồng' : isRes ? 'Chờ ký HĐ bàn giao' : 'Chưa có mã HĐ')),
            due: isMaint
              ? (su.maintenanceAt ? new Date(su.maintenanceAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Đang bảo trì')
              : (su.startDate && su.dueDate)
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
            facilityName: su.facilityName,
            imageUrl: su.imageUrl,
            maintenanceReason: su.maintenanceReason,
            maintenanceBy: su.maintenanceBy,
            maintenanceAt: su.maintenanceAt
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
        filteredArrivals = mergeGuestArrivals(filteredArrivals, targetId)
        setUpcomingHandovers(filteredArrivals)
        setHandoverPage(1)
      } else {
        const localArrivals = mergeGuestArrivals([], targetId)
        setUpcomingHandovers(localArrivals)
        setHandoverPage(1)
      }

      // 5. Active Rentals / Returns
      if (rentalsRes.status === 'fulfilled' && rentalsRes.value?.content) {
        let filteredRentals = rentalsRes.value.content
        if (targetId) {
          filteredRentals = filteredRentals.filter(b => b.facilityId === targetId)
        }
        setActiveRentals(filteredRentals)
        setRentalPage(1)
      } else {
        setActiveRentals([])
      }

      // 6. Tickets
      if (ticketsRes.status === 'fulfilled' && Array.isArray(ticketsRes.value)) {
        setTickets(ticketsRes.value)
      } else {
        setTickets([])
      }

      // 7. Renewals Count
      if (renewalsRes.status === 'fulfilled' && renewalsRes.value) {
        const count = renewalsRes.value.totalElements ?? (renewalsRes.value.content ? renewalsRes.value.content.length : 0)
        setRenewalsCount(count)
      } else {
        setRenewalsCount(0)
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
      setRenewalsCount(0)
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
        filteredArrivals = mergeGuestArrivals(filteredArrivals, targetId)
        setUpcomingHandovers(filteredArrivals)
        setHandoverPage(1)
      } else {
        const localArrivals = mergeGuestArrivals([], targetId)
        setUpcomingHandovers(localArrivals)
        setHandoverPage(1)
      }
    } catch {
      setUpcomingHandovers([])
      setHandoverPage(1)
    }
  }

  const handleCheckinTimeframeChange = (tf: 'current' | 'today' | 'past' | 'future' | 'all') => {
    setCheckinTimeframe(tf)
    setHandoverPage(1)
    fetchUpcomingHandovers(selectedFacilityId, tf, checkinFromDate, checkinToDate)
  }

  const handleCheckinDateFilterApply = (from: string, to: string) => {
    setCheckinFromDate(from)
    setCheckinToDate(to)
    setHandoverPage(1)
    fetchUpcomingHandovers(selectedFacilityId, checkinTimeframe, from, to)
  }

  const handleResetCheckinDateFilter = () => {
    setCheckinFromDate('')
    setCheckinToDate('')
    setHandoverPage(1)
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
      setActiveBookingId(booking.id)
      setActionSuccessMessage(`Đã tiếp nhận lượt đón khách của đơn ${booking.bookingCode} thành công! Bàn vận hành quầy đã sẵn sàng để đối soát & bàn giao.`)
      setTimeout(() => setActionSuccessMessage(null), 4000)
      setTimeout(() => {
        const el = document.getElementById('handover-workbench-section')
        if (el) el.scrollIntoView({ behavior: 'smooth' })
      }, 100)
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

  const [cancellingOverdueBooking, setCancellingOverdueBooking] = useState<Booking | null>(null)
  const [pendingRefundCount, setPendingRefundCount] = useState<number>(0)

  useEffect(() => {
    const fetchPendingRefundCount = async () => {
      try {
        const targetFacId = selectedFacilityId && selectedFacilityId !== 'ALL' ? selectedFacilityId : user?.facilityId
        const data = await refundService.getAll({
          facilityId: targetFacId,
          status: 'PENDING_REVIEW'
        })
        if (data && typeof data.totalElements === 'number') {
          setPendingRefundCount(data.totalElements)
        } else if (data && Array.isArray(data.content)) {
          setPendingRefundCount(data.content.length)
        } else if (Array.isArray(data)) {
          setPendingRefundCount(data.length)
        }
      } catch {
        // silent fail
      }
    }
    fetchPendingRefundCount()
  }, [selectedFacilityId, user?.facilityId])

  const openManagerCancelOverdueModal = (booking: Booking) => {
    setCancellingOverdueBooking(booking)
  }

  // Quản lý cơ sở hủy đơn quá hạn 48h cho đơn đặt ký + thanh toán tại quầy
  const executeManagerCancelOverdueBooking = async (booking: Booking, customReason?: string) => {
    const unitText = booking.unitCode ? `Kho #${booking.unitCode}` : (booking.unitTypeName || 'buồng kho')
    const reason = customReason?.trim() || 'Quản lý cơ sở hủy đơn do quá hạn 48 giờ sau lịch hẹn check-in nhưng khách hàng chưa đến làm thủ tục tiếp nhận tại quầy'
    try {
      const isBackendId = Boolean(booking.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(booking.id.trim()))
      const targetIdOrCode = isBackendId ? booking.id : booking.bookingCode
      try {
        await bookingService.cancelBooking(targetIdOrCode, reason)
      } catch (err: any) {
        console.warn('Backend cancel booking error (fallback to local):', err)
      }

      reservationEmailService.cancelOverdueReservation(booking.bookingCode, reason, {
        id: user?.id,
        fullName: user?.fullName || 'Quản lý cơ sở Boxora',
      })

      // Giải phóng ô kho local nếu có
      if (booking.storageUnitId) {
        try {
          const rawUnits = localStorage.getItem('boxora_storage_units')
          if (rawUnits) {
            const parsedUnits = JSON.parse(rawUnits)
            if (Array.isArray(parsedUnits)) {
              const uIdx = parsedUnits.findIndex((u: any) => u.id === booking.storageUnitId)
              if (uIdx !== -1) {
                parsedUnits[uIdx].status = 'AVAILABLE'
                localStorage.setItem('boxora_storage_units', JSON.stringify(parsedUnits))
              }
            }
          }
        } catch {}
      }

      window.dispatchEvent(new CustomEvent('boxora:storage-units-refresh'))
      window.dispatchEvent(new CustomEvent('boxora_reservation_updated', {
        detail: { bookingCode: booking.bookingCode, status: 'CANCELLED' }
      }))
      window.dispatchEvent(new Event('boxora:notifications-refresh'))

      setUpcomingHandovers(prev => prev.map(b =>
        (b.id === booking.id || b.bookingCode === booking.bookingCode)
          ? { ...b, status: 'CANCELLED' as any, cancellationReason: reason }
          : b
      ))

      triggerAction(`Đã hủy đơn ${booking.bookingCode} quá hạn 48h thành công. Buồng ${unitText} đã được mở lại cho khách khác đặt chỗ!`)
      toast.success(`Đã hủy đơn ${booking.bookingCode} và giải phóng buồng ${unitText} thành công!`)
      setCancellingOverdueBooking(null)
      if (selectedFacilityId) {
        void fetchUnits(selectedFacilityId)
      }
    } catch (err: any) {
      toast.error('Không thể hủy đơn: ' + (err.message || 'Lỗi không xác định'))
      throw err
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

    // Nếu kho đang Trống -> Mở modal yêu cầu nhập Lý do bảo trì & Người bảo trì
    if (selectedUnit.status === 'Available') {
      const roleLabel = role === 'STAFF' ? 'Nhân viên cơ sở' : role === 'FACILITY_MANAGER' ? 'Quản lý cơ sở' : 'Quản trị viên'
      const defaultMaintainer = `${user?.fullName || user?.username || 'Nhân sự cơ sở'} (${roleLabel})`
      setMaintenanceByInput(defaultMaintainer)
      setMaintenanceReasonInput('')
      setMaintenanceError('')
      setMaintenanceModalUnit(selectedUnit)
      return
    }

    // Nếu kho đang Bảo trì -> Hoàn tất bảo trì (Mở lại kho)
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
              tenant: 'Kho trống',
              contract: 'Chưa có hợp đồng',
              due: '—',
              maintenanceReason: undefined,
              maintenanceBy: undefined,
              maintenanceAt: undefined,
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
            tenant: 'Kho trống',
            contract: 'Chưa có hợp đồng',
            due: '—',
            maintenanceReason: undefined,
            maintenanceBy: undefined,
            maintenanceAt: undefined,
          }
        })

        const targetFac = selectedFacilityId || user?.facilityId
        if (targetFac) {
          void fetchUnits(targetFac)
        }

        triggerAction(`Đã hoàn tất bảo trì và mở lại kho #${selectedUnit.id} về trạng thái Sẵn sàng!`)
      }
    } catch (err: any) {
      triggerAction(`Không thể đổi trạng thái: ${err?.response?.data?.message || 'Kho đang có người thuê hoặc lỗi hệ thống'}`)
    }
  }

  const handleConfirmEnterMaintenance = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!maintenanceModalUnit || !maintenanceModalUnit.backendId) return

    const trimmedBy = maintenanceByInput.trim()
    const trimmedReason = maintenanceReasonInput.trim()

    if (!trimmedBy) {
      setMaintenanceError('Vui lòng nhập họ tên / vai trò người thực hiện hoặc phụ trách bảo trì.')
      return
    }
    if (!trimmedReason) {
      setMaintenanceError('Vui lòng ghi rõ lý do bảo trì kỹ thuật cho ngăn kho này.')
      return
    }

    try {
      setIsSubmittingMaintenance(true)
      setMaintenanceError('')
      const updated = await storageUnitService.toggleMaintenance(maintenanceModalUnit.backendId, {
        reason: trimmedReason,
        maintenanceBy: trimmedBy,
      })
      const maintReason = updated.maintenanceReason || trimmedReason
      const maintBy = updated.maintenanceBy || trimmedBy
      const maintAt = updated.maintenanceAt || new Date().toISOString()
      const formattedMaintAt = new Date(maintAt).toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })

      setUnits(prev => prev.map(u => {
        if (u.id === maintenanceModalUnit.id) {
          return {
            ...u,
            status: 'Maintenance',
            rawStatus: updated.status || 'UNDER_MAINTENANCE',
            color: 'purple',
            tenant: maintBy,
            contract: maintReason,
            due: formattedMaintAt,
            maintenanceReason: maintReason,
            maintenanceBy: maintBy,
            maintenanceAt: maintAt,
          }
        }
        return u
      }))

      setSelectedUnit(prev => {
        if (!prev || prev.id !== maintenanceModalUnit.id) return prev
        return {
          ...prev,
          status: 'Maintenance',
          rawStatus: updated.status || 'UNDER_MAINTENANCE',
          color: 'purple',
          tenant: maintBy,
          contract: maintReason,
          due: formattedMaintAt,
          maintenanceReason: maintReason,
          maintenanceBy: maintBy,
          maintenanceAt: maintAt,
        }
      })

      setMaintenanceModalUnit(null)
      const targetFac = selectedFacilityId || user?.facilityId
      if (targetFac) {
        void fetchUnits(targetFac)
      }
      triggerAction(`Đã chuyển kho #${maintenanceModalUnit.id} sang Bảo trì kỹ thuật (Phụ trách: ${maintBy})!`)
    } catch (err: any) {
      setMaintenanceError(err?.response?.data?.message || 'Không thể chuyển trạng thái bảo trì. Vui lòng thử lại.')
    } finally {
      setIsSubmittingMaintenance(false)
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
    if (statusFilter !== 'all' && u.status !== statusFilter) {
      return false
    }

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

    return true
  }

  const floor1MatchingCount = permanentFloor1.filter(isUnitMatchingFilter).length
  const floor2MatchingCount = permanentFloor2.filter(isUnitMatchingFilter).length
  const isAnyFilterActive = statusFilter !== 'all' || sizeFilter !== 'all' || searchQuery.trim().length > 0

  const handleStatusFilterClick = (targetStatus: UnitStatusFilter) => {
    if (activeTab !== 'overview') {
      setActiveTab('overview')
    }

    const nextStatus: UnitStatusFilter = 
      targetStatus === 'all' 
        ? 'all' 
        : statusFilter === targetStatus 
          ? 'all' 
          : targetStatus

    setStatusFilter(nextStatus)

    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (nextStatus === 'all') {
        next.delete('status')
      } else {
        next.set('status', nextStatus)
      }
      return next
    }, { replace: true })

    if (nextStatus !== 'all') {
      const floor1Matches = permanentFloor1.some(u => u.status === nextStatus)
      const floor2Matches = permanentFloor2.some(u => u.status === nextStatus)

      let targetFloor: 'floor1' | 'floor2' = selectedFloor
      if (selectedFloor === 'floor1' && !floor1Matches && floor2Matches) {
        targetFloor = 'floor2'
        setSelectedFloor('floor2')
      } else if (selectedFloor === 'floor2' && !floor2Matches && floor1Matches) {
        targetFloor = 'floor1'
        setSelectedFloor('floor1')
      }

      const targetFloorUnits = (targetFloor === 'floor2' ? permanentFloor2 : permanentFloor1)
      const firstMatch = targetFloorUnits.find(u => u.status === nextStatus) || units.find(u => u.status === nextStatus)
      if (firstMatch) {
        setSelectedUnit(firstMatch)
      }
    }

    requestAnimationFrame(() => {
      const el = document.getElementById('floor-matrix-section')
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    })
  }

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


  const sortedUpcomingHandovers = useMemo(() => {
    const list = [...upcomingHandovers]
    if (isManagementRole) {
      return list.sort((a, b) => {
        // Sort by newest created booking first
        const timeA = a.createdAt
          ? new Date(a.createdAt).getTime()
          : (a.startDate ? new Date(a.startDate).getTime() : 0)
        const timeB = b.createdAt
          ? new Date(b.createdAt).getTime()
          : (b.startDate ? new Date(b.startDate).getTime() : 0)
        if (timeB !== timeA) return timeB - timeA
        return (b.bookingCode || '').localeCompare(a.bookingCode || '')
      })
    }
    return list
  }, [upcomingHandovers, isManagementRole])

  // Handover & Return paginated datasets
  const totalHandoverPages = Math.max(1, Math.ceil(sortedUpcomingHandovers.length / handoverPageSize))
  const paginatedUpcomingHandovers = useMemo(() => {
    const start = (handoverPage - 1) * handoverPageSize
    return sortedUpcomingHandovers.slice(start, start + handoverPageSize)
  }, [sortedUpcomingHandovers, handoverPage, handoverPageSize])

  const totalRentalPages = Math.max(1, Math.ceil(activeRentals.length / rentalPageSize))
  const paginatedRentals = useMemo(() => {
    const start = (rentalPage - 1) * rentalPageSize
    return activeRentals.slice(start, start + rentalPageSize)
  }, [activeRentals, rentalPage, rentalPageSize])

  useEffect(() => {
    if (handoverPage > totalHandoverPages) {
      setHandoverPage(totalHandoverPages)
    }
  }, [totalHandoverPages, handoverPage])

  useEffect(() => {
    if (rentalPage > totalRentalPages) {
      setRentalPage(totalRentalPages)
    }
  }, [totalRentalPages, rentalPage])

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
        <button 
          type="button"
          onClick={() => handleStatusFilterClick('all')}
          title={`Xem tất cả ${totalUnitsCount} kho (Xóa lọc trạng thái)`}
          className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
            statusFilter === 'all'
              ? 'bg-slate-50/80 border-2 border-slate-900 ring-2 ring-slate-900/20 shadow-xs'
              : 'bg-white border-slate-200 shadow-2xs hover:border-slate-300 hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-bold text-slate-500 font-mono">Tổng số kho</span>
            <div className="flex items-center gap-1.5">
              {statusFilter === 'all' && (
                <span className="px-1.5 py-0.5 rounded bg-slate-900 text-white text-[9px] font-bold font-mono tracking-tight">Tất cả</span>
              )}
              <span className="material-symbols-outlined text-slate-400 text-[20px]">warehouse</span>
            </div>
          </div>
          <div className="flex items-baseline gap-1.5 mt-2">
            <span className="text-3xl font-extrabold font-mono tabular-nums text-slate-900 leading-none">{totalUnitsCount}</span>
            <span className="text-[11px] text-slate-500 font-medium">kho</span>
          </div>
          <div className="mt-3 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-slate-900 h-full rounded-full" style={{ width: '100%' }}></div>
          </div>
        </button>

        {/* Rented */}
        <button 
          type="button"
          onClick={() => handleStatusFilterClick('Rented')}
          title={`Lọc ${rentedUnitsCount} kho đang thuê (${rentedPercent}%) - Click lại để bỏ lọc`}
          className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
            statusFilter === 'Rented'
              ? 'bg-blue-50/60 border-2 border-blue-600 ring-2 ring-blue-500/25 shadow-md'
              : 'bg-white border-slate-200 shadow-2xs hover:border-slate-300 hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-bold text-slate-500 font-mono">Đang thuê</span>
            <div className="flex items-center gap-1.5">
              {statusFilter === 'Rented' && (
                <span className="px-1.5 py-0.5 rounded bg-blue-600 text-white text-[9px] font-bold tracking-tight">Đang lọc</span>
              )}
              <span className="px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 font-mono text-[10px] font-bold">{rentedPercent}%</span>
            </div>
          </div>
          <div className="flex items-baseline gap-1.5 mt-2">
            <span className="text-3xl font-extrabold font-mono tabular-nums text-slate-900 leading-none">{rentedUnitsCount}</span>
            <span className="text-[11px] text-slate-500">kho</span>
          </div>
          <div className="mt-3 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-blue-600 h-full rounded-full" style={{ width: `${rentedPercent}%` }}></div>
          </div>
        </button>

        {/* Available */}
        <button 
          type="button"
          onClick={() => handleStatusFilterClick('Available')}
          title={`Lọc ${availableUnitsCount} kho trống sẵn sàng - Click lại để bỏ lọc`}
          className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
            statusFilter === 'Available'
              ? 'bg-emerald-50/60 border-2 border-emerald-600 ring-2 ring-emerald-500/25 shadow-md'
              : 'bg-white border-slate-200 shadow-2xs hover:border-slate-300 hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-bold text-slate-500 font-mono">Kho trống</span>
            <div className="flex items-center gap-1.5">
              {statusFilter === 'Available' && (
                <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[9px] font-bold tracking-tight">Đang lọc</span>
              )}
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            </div>
          </div>
          <div className="flex items-baseline gap-1.5 mt-2">
            <span className="text-3xl font-extrabold font-mono tabular-nums text-emerald-600 leading-none">{availableUnitsCount}</span>
            <span className="text-[11px] text-slate-500">sẵn sàng</span>
          </div>
          <div className="mt-3 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${availablePercent}%` }}></div>
          </div>
        </button>

        {/* Pending */}
        <button 
          type="button"
          onClick={() => handleStatusFilterClick('Pending')}
          title={`Lọc ${pendingUnitsCount} kho chờ bàn giao - Click lại để bỏ lọc`}
          className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
            statusFilter === 'Pending'
              ? 'bg-amber-50/60 border-2 border-amber-600 ring-2 ring-amber-500/25 shadow-md'
              : 'bg-white border-slate-200 shadow-2xs hover:border-slate-300 hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-bold text-slate-500 font-mono">Chờ bàn giao</span>
            <div className="flex items-center gap-1.5">
              {statusFilter === 'Pending' && (
                <span className="px-1.5 py-0.5 rounded bg-amber-600 text-white text-[9px] font-bold tracking-tight">Đang lọc</span>
              )}
              <span className="material-symbols-outlined text-amber-500 text-[18px]">pending_actions</span>
            </div>
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
        </button>

        {/* Maintenance */}
        <button 
          type="button"
          onClick={() => handleStatusFilterClick('Maintenance')}
          title={`Lọc ${maintenanceUnitsCount} kho bảo trì kỹ thuật - Click lại để bỏ lọc`}
          className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
            statusFilter === 'Maintenance'
              ? 'bg-purple-50/60 border-2 border-purple-600 ring-2 ring-purple-500/25 shadow-md'
              : 'bg-white border-slate-200 shadow-2xs hover:border-slate-300 hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-bold text-slate-500 font-mono">Bảo trì kỹ thuật</span>
            <div className="flex items-center gap-1.5">
              {statusFilter === 'Maintenance' && (
                <span className="px-1.5 py-0.5 rounded bg-purple-600 text-white text-[9px] font-bold tracking-tight">Đang lọc</span>
              )}
              <span className="material-symbols-outlined text-purple-600 text-[18px]">build_circle</span>
            </div>
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
        </button>

        {/* Overdue */}
        <button 
          type="button"
          onClick={() => handleStatusFilterClick('Overdue')}
          title={`Lọc ${overdueUnitsCount} kho nợ quá hạn - Click lại để bỏ lọc`}
          className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
            statusFilter === 'Overdue'
              ? 'bg-rose-50/60 border-2 border-rose-600 ring-2 ring-rose-500/25 shadow-md'
              : 'bg-white border-slate-200 shadow-2xs hover:border-slate-300 hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-bold text-slate-500 font-mono">Nợ quá hạn</span>
            <div className="flex items-center gap-1.5">
              {statusFilter === 'Overdue' && (
                <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[9px] font-bold tracking-tight">Đang lọc</span>
              )}
              <span className="material-symbols-outlined text-rose-600 text-[18px]">lock_clock</span>
            </div>
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
        </button>

      </section>

      {/* 7 MANAGEMENT-LEVEL SUMMARIES: TABS NAVIGATION */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-1">
        {(hasPermission('STORAGE_UNIT_VIEW') || hasPermission('FACILITY_VIEW')) && (
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
          <span>Sơ Đồ Cơ Sở</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            activeTab === 'overview'
              ? 'bg-white text-slate-900'
              : 'bg-slate-200 text-slate-800'
          }`}>
            {totalUnitsCount} kho
          </span>
        </button>
        )}

        {hasPermission('BOOKING_VIEW') && (
        <button
          type="button"
          onClick={() => setActiveTab('pending_orders')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer whitespace-nowrap ${
            activeTab === 'pending_orders'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
          title="Quản lý đơn đặt giữ chỗ chờ liên hệ / chờ xử lý"
        >
          <span className="material-symbols-outlined text-[18px]">pending_actions</span>
          <span>1. Đơn Chờ Xử Lý</span>
          {pendingOrdersCount > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              activeTab === 'pending_orders'
                ? 'bg-white text-amber-700'
                : 'bg-amber-100 text-amber-800 animate-pulse'
            }`}>
              {pendingOrdersCount} đơn
            </span>
          )}
        </button>
        )}

        {(hasPermission('HANDOVER_VIEW') || hasPermission('HANDOVER_EXECUTE')) && (
        <button
          type="button"
          onClick={() => setActiveTab('reception')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer whitespace-nowrap ${
            activeTab === 'reception' || activeTab === 'handovers-returns'
              ? 'bg-cyan-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">how_to_reg</span>
          <span>2. Bàn Tiếp Đón Nhận Kho</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            activeTab === 'reception' || activeTab === 'handovers-returns'
              ? 'bg-white text-cyan-800'
              : 'bg-cyan-100 text-cyan-800'
          }`}>
            {upcomingHandovers.length} đơn
          </span>
        </button>
        )}

        {(hasPermission('CHECKOUT_REQUEST') || hasPermission('HANDOVER_VIEW')) && (
        <button
          type="button"
          onClick={() => {
            setActiveTab('returns')
            setTimeout(() => {
              const el = document.getElementById('pending-return-kpi-card') || document.getElementById('return-kpi-metrics-bar')
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }, 60)
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer whitespace-nowrap ${
            activeTab === 'returns'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">assignment_return</span>
          <span>3. Trả Kho</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            activeTab === 'returns'
              ? 'bg-white text-amber-800'
              : 'bg-amber-100 text-amber-800'
          }`}>
            {activeRentals.length} hợp đồng
          </span>
        </button>
        )}

        {(hasPermission('RENEWAL_APPROVE') || hasPermission('CONTRACT_VIEW')) && (
        <button
          type="button"
          onClick={() => setActiveTab('renewals')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer whitespace-nowrap ${
            activeTab === 'renewals'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">autorenew</span>
          <span>4. Hỗ Trợ Gia Hạn</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            activeTab === 'renewals'
              ? 'bg-white text-blue-900'
              : 'bg-emerald-100 text-emerald-800'
          }`}>
            {renewalsCount} đơn
          </span>
        </button>
        )}

        {(hasPermission('REFUND_APPROVE') || hasPermission('REFUND_REVIEW')) && (
        <button
          type="button"
          onClick={() => setActiveTab('refunds')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer whitespace-nowrap ${
            activeTab === 'refunds'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">account_balance</span>
          <span>5. Hoàn Tiền Hủy Đơn</span>
          {pendingRefundCount > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              activeTab === 'refunds'
                ? 'bg-white text-amber-900'
                : 'bg-amber-100 text-amber-800 animate-pulse'
            }`}>
              {pendingRefundCount} chờ chuyển
            </span>
          )}
        </button>
        )}

        {hasPermission('SUPPORT_TICKET_VIEW') && (
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
          <span>6. Sự Cố &amp; SLA</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            activeTab === 'tickets'
              ? 'bg-white text-slate-900'
              : 'bg-rose-100 text-rose-800'
          }`}>
            {tickets.filter(t => t.status !== 'RESOLVED').length} ca
          </span>
        </button>
        )}

        {role !== 'STAFF' && (
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
            <span>7. Chính Sách Vận Hành Cơ Sở</span>
          </button>
        )}
      </div>

      {/* ============================================================== */}
      {/* TAB 1: SƠ ĐỒ KHO & GIÁM SÁT THIẾT BỊ (SUMMARY 1) */}
      {/* ============================================================== */}
      {activeTab === 'overview' && (
        <section className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          
          {/* FLOOR MATRIX CANVAS (xl:col-span-8) */}
          <div id="floor-matrix-section" className="xl:col-span-8 flex flex-col gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 scroll-mt-6">
            {/* Controls Toolbar */}
            <div className="flex flex-col gap-3 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200">
              {/* Floor Selector + Size Dropdown + Search Box + Reset Filter Button */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                {/* Floor Selector Tabs */}
                <div className="inline-flex p-1 bg-white rounded-lg border border-slate-200 shadow-2xs shrink-0 self-start">
                  <button 
                    type="button" 
                    onClick={() => setSelectedFloor('floor1')}
                    className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md font-semibold text-xs transition cursor-pointer whitespace-nowrap ${
                      selectedFloor === 'floor1' 
                        ? 'bg-slate-900 text-white shadow-xs' 
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <span className="whitespace-nowrap">{facilityProfile.floor1Name}</span>
                    <span className={`px-1.5 py-0.2 rounded font-mono tabular-nums text-[11px] font-bold ${
                      selectedFloor === 'floor1' ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {isAnyFilterActive ? `${floor1MatchingCount}/${permanentFloor1.length}` : permanentFloor1.length}
                    </span>
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setSelectedFloor('floor2')}
                    className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md font-semibold text-xs transition cursor-pointer whitespace-nowrap ${
                      selectedFloor === 'floor2' 
                        ? 'bg-slate-900 text-white shadow-xs' 
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <span className="whitespace-nowrap">{facilityProfile.floor2Name}</span>
                    <span className={`px-1.5 py-0.2 rounded font-mono tabular-nums text-[11px] font-bold ${
                      selectedFloor === 'floor2' ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {isAnyFilterActive ? `${floor2MatchingCount}/${permanentFloor2.length}` : permanentFloor2.length}
                    </span>
                  </button>
                </div>

                {/* Size Filter Dropdown, Search Input & Clear Filters Button */}
                <div className="flex items-center gap-2 flex-wrap flex-1 lg:justify-end">
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

                  <div className="relative flex-1 sm:flex-initial min-w-[210px] sm:w-60">
                    <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px] text-slate-400">search</span>
                    <input 
                      type="text" 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Tìm mã kho (#A-101), khách..." 
                      className="w-full pl-8 pr-3 py-1.5 bg-white text-slate-800 text-xs rounded-lg placeholder:text-slate-400 focus:outline-none border border-slate-200 shadow-2xs font-mono"
                    />
                  </div>

                  {isAnyFilterActive && (
                    <button 
                      type="button" 
                      onClick={() => {
                        setStatusFilter('all')
                        setSizeFilter('all')
                        setSearchQuery('')
                        setSearchParams(prev => {
                          const next = new URLSearchParams(prev)
                          next.delete('status')
                          return next
                        }, { replace: true })
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer whitespace-nowrap transition shadow-2xs"
                      title="Đặt lại toàn bộ bộ lọc"
                    >
                      <span className="material-symbols-outlined text-[15px]">restart_alt</span>
                      <span>Xóa bộ lọc</span>
                    </button>
                  )}
                </div>
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
                <div className="flex items-center justify-between gap-2 py-1 border-b border-slate-200/50">
                  <span className="text-slate-500 shrink-0">
                    {selectedUnit.status === 'Maintenance' ? 'Người bảo trì:' : 'Khách thuê:'}
                  </span>
                  <span className={`font-semibold text-right ${selectedUnit.status === 'Maintenance' ? 'text-purple-700' : 'text-slate-900'}`}>
                    {selectedUnit.status === 'Maintenance'
                      ? (selectedUnit.maintenanceBy || selectedUnit.tenant || 'Kỹ thuật viên cơ sở')
                      : selectedUnit.tenant}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 py-1 border-b border-slate-200/50">
                  <span className="text-slate-500 shrink-0">
                    {selectedUnit.status === 'Maintenance' ? 'Lý do bảo trì:' : 'Mã hợp đồng:'}
                  </span>
                  <span className={`font-bold text-right ${selectedUnit.status === 'Maintenance' ? 'text-purple-900' : 'font-mono text-blue-600'}`}>
                    {selectedUnit.status === 'Maintenance'
                      ? (selectedUnit.maintenanceReason || selectedUnit.contract || 'Bảo trì kỹ thuật định kỳ')
                      : selectedUnit.contract}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 py-1">
                  <span className="text-slate-500 shrink-0">
                    {selectedUnit.status === 'Maintenance' ? 'Bắt đầu bảo trì:' : 'Thời hạn:'}
                  </span>
                  <span className="font-mono text-slate-800 text-right">
                    {selectedUnit.status === 'Maintenance' && selectedUnit.maintenanceAt
                      ? new Date(selectedUnit.maintenanceAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })
                      : selectedUnit.due}
                  </span>
                </div>
              </div>

              {/* Dedicated Maintenance Info Card when Unit is in Maintenance */}
              {selectedUnit.status === 'Maintenance' && (
                <div className="p-3.5 bg-purple-50/90 rounded-xl border border-purple-200 flex flex-col gap-2 text-xs shadow-2xs">
                  <div className="flex items-center gap-1.5 text-purple-800 font-bold uppercase tracking-wide text-[11px] pb-1.5 border-b border-purple-200/70">
                    <span className="material-symbols-outlined text-[16px] text-purple-600">engineering</span>
                    <span>Hồ Sơ Bảo Trì Kỹ Thuật</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-purple-700/80 font-medium shrink-0">Người bảo trì:</span>
                      <span className="font-bold text-purple-950 text-right">
                        {selectedUnit.maintenanceBy || selectedUnit.tenant || 'Kỹ thuật viên cơ sở'}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-purple-700/80 font-medium shrink-0">Lý do bảo trì:</span>
                      <span className="font-semibold text-purple-900 text-right">
                        {selectedUnit.maintenanceReason || selectedUnit.contract || 'Bảo trì kỹ thuật định kỳ'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-purple-200/50 text-[11px]">
                      <span className="text-purple-700/80">Thời điểm chuyển:</span>
                      <span className="font-mono font-semibold text-purple-900">
                        {selectedUnit.maintenanceAt
                          ? new Date(selectedUnit.maintenanceAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })
                          : selectedUnit.due}
                      </span>
                    </div>
                  </div>
                </div>
              )}

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
                    <span>Xem Hồ Sơ &amp; 3 Điều Kiện Bàn Giao</span>
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
      {/* TAB 1: ĐƠN CHỜ XỬ LÝ (PENDING RESERVATIONS & BOOKINGS) */}
      {/* ============================================================== */}
      {activeTab === 'pending_orders' && (
        <PendingReservationsWorkbench
          facilityId={selectedFacilityId || user?.facilityId}
          arrivals={sortedUpcomingHandovers}
          highlightedBookingCode={searchParams.get('bookingCode')}
          onRefresh={() => {
            fetchUpcomingHandovers(selectedFacilityId, checkinTimeframe, checkinFromDate, checkinToDate)
            const targetFac = selectedFacilityId || user?.facilityId
            if (targetFac) void fetchUnits(targetFac)
          }}
          onProceedToReception={(bookingId) => {
            setActiveBookingId(bookingId)
            setActiveTab('reception')
            setTimeout(() => {
              const el = document.getElementById('handover-workbench-section')
              if (el) el.scrollIntoView({ behavior: 'smooth' })
            }, 60)
          }}
        />
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
                Xem xét, phê duyệt yêu cầu gia hạn kho, khách hàng ký hợp đồng và thanh toán trực tuyến.
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
      {/* TAB 2: BÀN TIẾP ĐÓN NHẬN KHO & BÀN GIAO */}
      {/* ============================================================== */}
      {(activeTab === 'handovers-returns' || activeTab === 'reception') && (
        <section className="flex flex-col gap-6">
          
          {/* Header Bàn Vận Hành Quầy & Tiếp Đón */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-400/30 shrink-0">
                <span className="material-symbols-outlined text-[26px]">badge</span>
              </div>
              <div>
                <h3 className="font-headline text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  Bàn Vận Hành Quầy &amp; Tiếp Đón Bàn Giao
                  <span className="px-2 py-0.5 rounded-full bg-cyan-400/20 text-cyan-300 text-[10px] font-mono font-bold border border-cyan-400/30">
                    Facility Manager Desk
                  </span>
                </h3>
                <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                  Quản lý cơ sở trực tiếp tiếp nhận khách hàng theo quy trình 4 bước: (1) Xác thực CCCD, (2) Gán kho vật lý, (3) Hợp đồng &amp; Thanh toán, (4) Cấp mã PIN SmartLock bàn giao kho.
                </p>
              </div>
            </div>
            {activeBookingId && !isManagementRole && (
              <button
                type="button"
                onClick={() => setActiveBookingId('')}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px]">close</span>
                <span>Thu gọn bàn thao tác</span>
              </button>
            )}
          </div>

          {/* BÀN THAO TÁC CHECK-IN & BÀN GIAO KHO: Chỉ dành cho Quản lý cơ sở & Nhân viên quầy thực địa; Admin & Business Manager chỉ ở chế độ giám sát */}
          {isManagementRole ? (
            <div className="p-4 rounded-2xl bg-blue-50/80 border border-blue-200 text-blue-900 flex items-start gap-3.5 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[24px]">visibility</span>
              </div>
              <div className="text-xs leading-relaxed">
                <div className="flex items-center gap-2 font-bold text-sm text-blue-950 mb-0.5">
                  <span>Chế độ giám sát quy trình tiếp nhận &amp; bàn giao kho</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-200 text-blue-800">CHỈ ĐỌC</span>
                </div>
                <p className="text-blue-800">
                  Tài khoản <strong>{role === 'ADMIN' ? 'Quản Trị Viên (Admin)' : 'Quản Lý Kinh Doanh (Business Manager)'}</strong> đang theo dõi danh sách lịch hẹn và đối soát điều kiện check-in ở chế độ giám sát chỉ đọc. Quy trình 4 bước tiếp nhận khách hàng (Xác thực CCCD, Gán kho vật lý, Hợp đồng &amp; Thanh toán, Cấp PIN SmartLock) được thực hiện trực tiếp bởi <strong>Nhân viên quầy (Facility Staff)</strong> và <strong>Quản lý cơ sở (Facility Manager)</strong> tại quầy tiếp đón. Bấm <em>"Xem chi tiết"</em> tại từng đơn trong bảng bên dưới để đối soát 3 điều kiện bàn giao.
                </p>
              </div>
            </div>
          ) : (
            <div id="handover-workbench-section" className="scroll-mt-6">
              <HandoverCheckInWorkbench
                facilityId={selectedFacilityId || user?.facilityId}
                arrivals={sortedUpcomingHandovers}
                activeBookingId={activeBookingId}
                onSelectBooking={setActiveBookingId}
                onHandoverComplete={(bookingId) => {
                  fetchUpcomingHandovers(selectedFacilityId, checkinTimeframe, checkinFromDate, checkinToDate)
                  const targetFac = selectedFacilityId || user?.facilityId
                  if (targetFac) void fetchUnits(targetFac)
                  triggerAction('Đã hoàn tất bàn giao kho và cấp phát mã PIN cho khách hàng thành công!')
                }}
              />
            </div>
          )}

          {/* Upcoming Handovers Table */}
          <div
            id="checkin-queue-table"
            data-checkin-queue="true"
            className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm scroll-mt-6 transition-all duration-300"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="material-symbols-outlined text-cyan-600 text-[20px]">how_to_reg</span>
                <h3 className="font-headline text-sm font-bold text-slate-900">
                  Lịch Hẹn Nhận Kho &amp; Chờ Bàn Giao ({sortedUpcomingHandovers.length} đơn)
                </h3>
                {isManagementRole && (
                  <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200">
                    Đơn tạo gần nhất
                  </span>
                )}
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

            {sortedUpcomingHandovers.length === 0 ? (
              <p className="text-xs text-slate-400 py-12 text-center">Hiện không có lịch hẹn bàn giao kho nào trong danh sách lọc.</p>
            ) : (
              <div className="overflow-x-auto min-h-[460px] flex flex-col justify-between">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-mono uppercase text-[11px]">
                      <th className="py-2.5 px-3 rounded-l-lg">Khách Hàng</th>
                      <th className="py-2.5 px-3">Mã Đặt Chỗ</th>
                      <th className="py-2.5 px-3">Kho Đăng Ký</th>
                      <th className="py-2.5 px-3">Ngày Check-in</th>
                      <th className="py-2.5 px-3">Trạng Thái Đơn</th>
                      <th className="py-2.5 px-3">Cọc Giữ Chỗ</th>
                      <th className="py-2.5 px-3 rounded-r-lg text-right">Hành Động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedUpcomingHandovers.map(b => {
                      const isInPerson = b.signingMethod === 'IN_PERSON' || (b as any).paymentMethod === 'AT_FACILITY' || (b as any).paymentMethod === 'IN_PERSON'
                      const checkInTimeMs = b.expectedCheckInAt
                        ? new Date(b.expectedCheckInAt).getTime()
                        : (b.startDate ? new Date(b.startDate + 'T09:00:00').getTime() : 0)
                      const nowMs = Date.now()
                      const hoursOverdue = checkInTimeMs > 0 && nowMs > checkInTimeMs
                        ? (nowMs - checkInTimeMs) / (1000 * 60 * 60)
                        : 0
                      const isNotFinished = b.status !== 'ACTIVE' && b.status !== 'COMPLETED' && b.status !== 'CANCELLED' && b.status !== 'REJECTED'
                      const isOverdue48h = isInPerson && !b.assignedStaffName && isNotFinished && hoursOverdue >= 48
                      const isOverdue24h = isInPerson && !b.assignedStaffName && isNotFinished && hoursOverdue >= 24

                      return (
                      <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-3">
                          <span className="font-bold text-slate-900 block">{b.customerName || 'N/A'}</span>
                          <span className="text-[11px] text-slate-500 font-mono">{b.customerPhone || 'N/A'}</span>
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-900">
                          <div>{b.bookingCode}</div>
                          {b.createdAt && (
                            <div className="text-[10px] font-sans font-normal text-slate-500 mt-0.5" title="Thời gian tạo đơn">
                              Tạo: {new Date(b.createdAt).toLocaleDateString('vi-VN')} {new Date(b.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          )}
                        </td>
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
                          <div className="flex flex-col gap-1 items-start">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              b.status === 'CONFIRMED'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : b.status === 'CANCELLED'
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}>
                              {b.status === 'CONFIRMED' ? 'Đã xác nhận' : b.status === 'CANCELLED' ? 'Đã hủy' : 'Chờ hoàn tất cọc'}
                            </span>
                            {isOverdue48h ? (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-0.5 animate-pulse">
                                <span className="material-symbols-outlined text-[11px]">warning</span>
                                Quá hạn &gt; 48h
                              </span>
                            ) : isOverdue24h ? (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-0.5">
                                <span className="material-symbols-outlined text-[11px]">schedule</span>
                                {b.checkinOverdueReminderSentAt ? 'Đã gửi mail nhắc 24h' : 'Quá hạn > 24h'}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-900">
                          {(b.depositPaid || b.depositAmount || 0).toLocaleString('vi-VN')} đ
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-2 flex-wrap">
                            {b.status === 'CANCELLED' ? (
                              <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500 text-[11px] font-semibold">
                                Đơn đã hủy
                              </span>
                            ) : b.assignedStaffName ? (
                              <div
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-semibold"
                                title={b.staffAssignmentNotes || undefined}
                              >
                                <span className="material-symbols-outlined text-[14px] text-emerald-600">person_check</span>
                                <span>{b.assignedStaffName}</span>
                              </div>
                            ) : (role === 'FACILITY_MANAGER' || role === 'STAFF') && !isManagementRole ? (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={claimingBookingId === b.id}
                                  onClick={() => {
                                    const { isPremature } = isBookingBeforeCheckInTime(b)
                                    if (isPremature) {
                                      setEarlyConfirmState({
                                        booking: b,
                                        actionType: 'CLAIM_RECEPTION',
                                        onConfirm: () => handleManagerClaimReception(b),
                                      })
                                    } else {
                                      handleManagerClaimReception(b)
                                    }
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg font-bold text-[11px] bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer flex items-center gap-1 shadow-xs disabled:opacity-50"
                                >
                                  <span className="material-symbols-outlined text-[14px]">how_to_reg</span>
                                  <span>{claimingBookingId === b.id ? 'Đang nhận...' : 'Tiếp nhận & Mở bàn'}</span>
                                </button>
                                {isOverdue48h && (
                                  <button
                                    type="button"
                                    onClick={() => openManagerCancelOverdueModal(b)}
                                    className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold flex items-center gap-1 transition cursor-pointer shadow-xs"
                                    title="Đơn quá 48h sau lịch hẹn check-in chưa tiếp nhận: Hủy đơn và trả ô kho về trạng thái trống"
                                  >
                                    <span className="material-symbols-outlined text-[14px]">event_busy</span>
                                    <span>Hủy đơn</span>
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-semibold">
                                  <span className="material-symbols-outlined text-[14px] text-amber-600">hourglass_empty</span>
                                  <span>Chờ tiếp nhận</span>
                                </span>
                                {isOverdue48h && (
                                  <button
                                    type="button"
                                    onClick={() => openManagerCancelOverdueModal(b)}
                                    className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold flex items-center gap-1 transition cursor-pointer shadow-xs"
                                    title="Đơn quá 48h sau lịch hẹn check-in chưa tiếp nhận: Hủy đơn và trả ô kho về trạng thái trống"
                                  >
                                    <span className="material-symbols-outlined text-[14px]">event_busy</span>
                                    <span>Hủy đơn</span>
                                  </button>
                                )}
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                setReadOnlyTargetBookingId(b.id)
                                setReadOnlyTargetUnitCode(b.unitCode || undefined)
                                setReadOnlyTargetUnitBackendId(b.storageUnitId || undefined)
                                setShowReadOnlyBookingModal(true)
                              }}
                              className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-[11px] transition cursor-pointer"
                            >
                              Xem chi tiết
                            </button>
                          </div>
                        </td>
                      </tr>
                      )
                    })}
                  </tbody>
                </table>

                {/* Table 1 Pagination - Centered & Expanded */}
                {sortedUpcomingHandovers.length > 0 && (
                  <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-4 mt-3 border-t border-slate-100 text-xs text-slate-500">
                    <div className="text-center md:text-left text-xs">
                      Hiển thị{' '}
                      <span className="font-semibold text-slate-800 font-mono">
                        {sortedUpcomingHandovers.length === 0 ? 0 : (handoverPage - 1) * handoverPageSize + 1}
                      </span>
                      -
                      <span className="font-semibold text-slate-800 font-mono">
                        {Math.min(handoverPage * handoverPageSize, sortedUpcomingHandovers.length)}
                      </span>{' '}
                      trên tổng số <span className="font-semibold text-slate-800 font-mono">{sortedUpcomingHandovers.length}</span> đơn hẹn
                    </div>

                    {/* Center: Pagination Controls */}
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setHandoverPage(p => Math.max(1, p - 1))}
                        disabled={handoverPage === 1}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer text-xs font-semibold text-slate-700 transition flex items-center gap-1 shadow-2xs"
                        title="Trang trước"
                      >
                        <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                        <span className="hidden sm:inline">Trước</span>
                      </button>

                      <div className="flex items-center gap-1">
                        {Array.from({ length: totalHandoverPages }, (_, i) => i + 1).map(pageNum => {
                          if (
                            totalHandoverPages > 6 &&
                            pageNum !== 1 &&
                            pageNum !== totalHandoverPages &&
                            Math.abs(pageNum - handoverPage) > 1
                          ) {
                            if (pageNum === 2 || pageNum === totalHandoverPages - 1) {
                              return (
                                <span key={pageNum} className="px-1 text-slate-400 font-mono">
                                  ...
                                </span>
                              )
                            }
                            return null
                          }
                          const isActive = handoverPage === pageNum
                          return (
                            <button
                              key={pageNum}
                              type="button"
                              onClick={() => setHandoverPage(pageNum)}
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
                        onClick={() => setHandoverPage(p => Math.min(totalHandoverPages, p + 1))}
                        disabled={handoverPage === totalHandoverPages}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer text-xs font-semibold text-slate-700 transition flex items-center gap-1 shadow-2xs"
                        title="Trang sau"
                      >
                        <span className="hidden sm:inline">Sau</span>
                        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                      </button>
                    </div>

                    {/* Right: Page Size Selector */}
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-500 hidden sm:inline">Số đơn / trang:</span>
                      <select
                        value={handoverPageSize}
                        onChange={(e) => {
                          setHandoverPageSize(Number(e.target.value))
                          setHandoverPage(1)
                        }}
                        className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-2xs focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
                        title="Số lượng đơn hiển thị trên một trang"
                      >
                        <option value={5}>5 đơn / trang</option>
                        <option value={10}>10 đơn / trang</option>
                        <option value={15}>15 đơn / trang</option>
                        <option value={20}>20 đơn / trang</option>
                        <option value={50}>50 đơn / trang</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

        </section>
      )}

      {/* ============================================================== */}
      {/* TAB 3: TRẢ KHO & NGHIỆM THU HIỆN TRƯỜNG */}
      {/* ============================================================== */}
      {activeTab === 'returns' && (
        <section className="flex flex-col gap-6 animate-in fade-in">
          <HandoverReturnWorkbench
            initialStatusTabFilter="PENDING"
            currentFacilityId={selectedFacilityId || user?.facilityId}
            facilityName={facilities.find(f => f.id === selectedFacilityId)?.name || 'Cơ sở Boxora'}
            userRole={role || 'FACILITY_MANAGER'}
            userName={user?.fullName || 'Quản lý cơ sở'}
            activeRentals={activeRentals}
            onReturnCompleted={() => {
              const targetFac = selectedFacilityId || user?.facilityId
              if (targetFac) {
                void fetchUnits(targetFac)
                void fetchUpcomingHandovers(targetFac, checkinTimeframe, checkinFromDate, checkinToDate)
              }
            }}
          />
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
      {/* TAB 7: CHÍNH SÁCH VẬN HÀNH CƠ SỞ */}
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
                    {facilityPolicy?.cancellationFullRefundHours ?? 24}h
                  </span>
                  <span className="text-xs text-slate-500">hoàn 100% kể từ khi đặt</span>
                </div>
                <p className="text-xs text-slate-600 mt-2">
                  Hoàn {facilityPolicy?.cancellationPartialRefundPercent ?? 70}% nếu hủy từ {facilityPolicy?.cancellationFullRefundHours ?? 24}h - <strong className="text-slate-900">{facilityPolicy?.cancellationPartialRefundHours ?? 48}h</strong> (Quá 48h hoàn 50%)
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
      {/* TAB: YÊU CẦU HOÀN TIỀN HỦY ĐƠN ĐẶT CHỖ */}
      {/* ============================================================== */}
      {activeTab === 'refunds' && (
        <RefundManagementWorkbench
          facilityId={selectedFacilityId && selectedFacilityId !== 'ALL' ? selectedFacilityId : user?.facilityId}
          facilityName={currentFacilityName}
        />
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

      {/* 4. Read-Only Booking & Prerequisites Detail Modal (FOR FACILITY MANAGER / ADMIN / BUSINESS MANAGER) */}
      <BookingDetailReadOnlyModal
        isOpen={showReadOnlyBookingModal}
        onClose={() => {
          setShowReadOnlyBookingModal(false)
          setReadOnlyTargetBookingId(undefined)
          setReadOnlyTargetUnitCode(undefined)
          setReadOnlyTargetUnitBackendId(undefined)
        }}
        bookingId={readOnlyTargetBookingId}
        unitCode={readOnlyTargetUnitCode || selectedUnit?.id}
        unitBackendId={readOnlyTargetUnitBackendId || selectedUnit?.backendId}
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

      {/* 12. Early Check-In Confirmation Modal */}
      <EarlyCheckInConfirmModal
        isOpen={Boolean(earlyConfirmState)}
        booking={earlyConfirmState?.booking || null}
        actionType={earlyConfirmState?.actionType || 'CLAIM_RECEPTION'}
        onConfirm={() => {
          const action = earlyConfirmState?.onConfirm
          setEarlyConfirmState(null)
          if (action) action()
        }}
        onClose={() => setEarlyConfirmState(null)}
      />

      {/* 13. Technical Maintenance Reason & Maintainer Modal */}
      {maintenanceModalUnit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-purple-100 bg-purple-50/70 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
                  <span className="material-symbols-outlined text-[22px]">build</span>
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-purple-700 block">
                    Lập phiếu bảo trì ngăn kho
                  </span>
                  <h3 className="text-base font-bold text-slate-900">
                    Chuyển Bảo Trì Kỹ Thuật — Kho #{maintenanceModalUnit.id}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMaintenanceModalUnit(null)}
                className="w-8 h-8 rounded-lg hover:bg-purple-100 text-slate-500 flex items-center justify-center transition cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleConfirmEnterMaintenance} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">Mã ngăn kho</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">#{maintenanceModalUnit.id}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">Vị trí</span>
                  <span className="font-semibold text-slate-800">{maintenanceModalUnit.floorLevel} · Khu {getUnitZone(maintenanceModalUnit)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">Diện tích</span>
                  <span className="font-mono font-bold text-slate-800">{maintenanceModalUnit.size}</span>
                </div>
              </div>

              {maintenanceError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-medium flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] shrink-0">error</span>
                  <span>{maintenanceError}</span>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-800 mb-1.5">
                  Người thực hiện / Phụ trách bảo trì <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                    engineering
                  </span>
                  <input
                    type="text"
                    value={maintenanceByInput}
                    onChange={(e) => setMaintenanceByInput(e.target.value)}
                    placeholder="Nhập tên kỹ thuật viên hoặc nhân sự phụ trách..."
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-purple-600 focus:ring-2 focus:ring-purple-500/20 outline-none font-medium text-slate-900"
                    required
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Mặc định ghi nhận tài khoản đang thao tác, có thể sửa thành tên kỹ thuật viên trực tiếp xử lý.
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1.5">
                  Lý do bảo trì kỹ thuật <span className="text-rose-500">*</span>
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {[
                    'Thay pin / sửa chữa khóa điện tử SmartLock',
                    'Vệ sinh khử khuẩn & bảo dưỡng định kỳ',
                    'Sửa chữa bản lề / ray trượt cửa cuốn',
                    'Kiểm tra cảm biến nhiệt ẩm / PCCC',
                    'Sơn dặm & chống thấm vách ngăn kho',
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setMaintenanceReasonInput(preset)}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition cursor-pointer ${
                        maintenanceReasonInput === preset
                          ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                          : 'bg-slate-50 hover:bg-purple-50 text-slate-600 hover:text-purple-700 border-slate-200'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <textarea
                  rows={3}
                  value={maintenanceReasonInput}
                  onChange={(e) => setMaintenanceReasonInput(e.target.value)}
                  placeholder="Mô tả cụ thể tình trạng kỹ thuật hoặc hạng mục cần bảo trì, sửa chữa..."
                  className="w-full p-3 rounded-xl border border-slate-300 focus:border-purple-600 focus:ring-2 focus:ring-purple-500/20 outline-none font-medium text-slate-900 resize-none"
                  required
                />
              </div>

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] flex items-start gap-2">
                <span className="material-symbols-outlined text-[16px] text-amber-600 shrink-0 mt-0.5">info</span>
                <span>
                  Khi chuyển sang trạng thái <strong>Đang bảo trì</strong>, ngăn kho này sẽ tạm khóa đặt chỗ mới cho đến khi hoàn tất bảo trì.
                </span>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setMaintenanceModalUnit(null)}
                  disabled={isSubmittingMaintenance}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingMaintenance}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">build_circle</span>
                  <span>{isSubmittingMaintenance ? 'Đang lưu...' : 'Xác nhận chuyển bảo trì'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <CancelOverdueBookingModal
        isOpen={Boolean(cancellingOverdueBooking)}
        booking={cancellingOverdueBooking}
        userRoleTitle={user?.fullName ? `${user.fullName} (Quản lý cơ sở)` : 'Quản lý cơ sở Boxora'}
        onConfirm={(b, r) => executeManagerCancelOverdueBooking(b, r)}
        onClose={() => setCancellingOverdueBooking(null)}
      />

    </div>
  )
}
