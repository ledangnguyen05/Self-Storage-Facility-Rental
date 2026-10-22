import React, { useState, useEffect, useMemo } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import { storageUnitService } from '../../services/storageUnitService'
import { facilityService } from '../../services/facilityService'
import { reportService } from '../../services/reportService'
import { paymentService, PaymentItem } from '../../services/paymentService'
import { bookingService } from '../../services/bookingService'
import { userService } from '../../services/userService'
import { useLanguage } from '../../context/LanguageContext'
import { useAuth } from '../../context/AuthContext'
import { Facility, StorageUnit, OverdueDebtItem, User, RevenueReport } from '../../types'
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
<<<<<<< Updated upstream
=======
import { FacilityPolicyViewModal } from './modals/FacilityPolicyViewModal'
import { ReceptionShiftAlertModal } from '../../components/modals/ReceptionShiftAlertModal'
import { ContractRenewalsManagementPanel } from '../../components/renewal/ContractRenewalsManagementPanel'
import { HandoverCheckInWorkbench } from '../staff/components/HandoverCheckInWorkbench'
<<<<<<< HEAD
>>>>>>> Stashed changes
=======
>>>>>>> dc54f515e9b5c06f6639b5efd5c5ed3a26213a2c

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
  imageUrl?: string
}

const UnitMapSkeleton: React.FC<{ count?: number }> = ({ count = 12 }) => (
  <div aria-hidden="true" className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-6 gap-2">
    {Array.from({ length: count }, (_, index) => (
      <div
        key={index}
        aria-hidden="true"
        className="min-h-[76px] flex flex-col gap-1.5 p-2.5 rounded-lg bg-white border border-slate-200 border-t-2 border-t-slate-300 animate-pulse motion-reduce:animate-none"
      >
        <div className="flex items-center justify-between">
          <span className="h-3 w-12 rounded bg-slate-200" />
          <span className="h-2.5 w-6 rounded bg-slate-100" />
        </div>
        <span className="h-3 w-8 rounded bg-slate-100" />
        <span className="mt-1 h-2.5 w-14 rounded bg-slate-100" />
      </div>
    ))}
  </div>
)

export const ManagerDashboard: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
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
  const [overdueItems, setOverdueItems] = useState<OverdueDebtItem[]>([])
  const [staffList, setStaffList] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [selectedFloor, setSelectedFloor] = useState<'floor1' | 'floor2'>('floor1')
  const [sizeFilter, setSizeFilter] = useState<'all' | 's' | 'm' | 'l'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'Available' | 'Rented' | 'Pending' | 'Overdue' | 'Maintenance'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUnit, setSelectedUnit] = useState<InspectedUnit | null>(null)
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null)
<<<<<<< Updated upstream
  const [confirmModal, setConfirmModal] = useState<{
=======

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
<<<<<<< HEAD
  const [activeHandoverBookingId, setActiveHandoverBookingId] = useState<string>('')
=======
  const [activeBookingId, setActiveBookingId] = useState<string>(
    searchParams.get('bookingId') || searchParams.get('checkinBookingId') || ''
  )

  useEffect(() => {
    const bId = searchParams.get('bookingId') || searchParams.get('checkinBookingId')
    if (bId) {
      setActiveBookingId(bId)
    }
  }, [searchParams])
>>>>>>> dc54f515e9b5c06f6639b5efd5c5ed3a26213a2c

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
>>>>>>> Stashed changes
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
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0)
  const bookingApprovalId = searchParams.get('bookingApprovalId') || undefined
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
    if (bookingApprovalId) setShowBookingApprovalModal(true)
  }, [bookingApprovalId])

  useEffect(() => {
    let isCurrent = true
    const refreshPendingApprovals = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const requests = await bookingService.getPendingApprovals()
        if (isCurrent) setPendingApprovalCount(requests.length)
      } catch {
        // Keep the latest known count while the API is temporarily unavailable.
      }
    }
    const intervalId = window.setInterval(() => void refreshPendingApprovals(), 30_000)
    window.addEventListener('focus', refreshPendingApprovals)
    document.addEventListener('visibilitychange', refreshPendingApprovals)
    window.addEventListener('boxora:notifications-refresh', refreshPendingApprovals)
    void refreshPendingApprovals()

    return () => {
      isCurrent = false
      window.clearInterval(intervalId)
      window.removeEventListener('focus', refreshPendingApprovals)
      document.removeEventListener('visibilitychange', refreshPendingApprovals)
      window.removeEventListener('boxora:notifications-refresh', refreshPendingApprovals)
    }
  }, [])

  const closeBookingApprovalModal = () => {
    setShowBookingApprovalModal(false)
    if (searchParams.has('bookingApprovalId')) {
      const nextParams = new URLSearchParams(searchParams)
      nextParams.delete('bookingApprovalId')
      setSearchParams(nextParams, { replace: true })
    }
  }

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

      const [unitsRes, debtRes, staffRes, revRes, payRes] = await Promise.allSettled([
        storageUnitService.getUnits(targetId ? { facilityId: targetId } : undefined),
        reportService.getOverdueDebtReport(targetId ? { facilityId: targetId } : undefined),
        userService.getAllUsers({ role: 'STAFF', facilityId: targetId, size: 50 }),
        reportService.getRevenueReport(fDate || undefined, tDate || undefined, targetId),
        paymentService.getPayments({ size: 15, facilityId: targetId })
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
            facilityName: su.facilityName,
            imageUrl: su.imageUrl
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
    } catch {
      setUnits([])
      setOverdueItems([])
      setStaffList([])
      setSelectedUnit(null)
      setRevenueData(null)
      setFacilityPayments([])
    } finally {
      setIsLoading(false)
      setIsRevenueLoading(false)
    }
  }

<<<<<<< Updated upstream
=======
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
      let filteredArrivals: Booking[] = []
      if (Array.isArray(data)) {
        filteredArrivals = data
        if (targetId) {
          filteredArrivals = filteredArrivals.filter(b => b.facilityId === targetId)
        }
      }

      // Merge các đơn giữ chỗ khách hàng gửi cho Staff từ localStorage
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
                identityCardNumber: r.customer?.idCard || r.identityCardNumber,
                customerEmail: r.customer?.email || r.customerEmail,
                facilityId: r.facility?.id || r.facilityId || targetId || '',
                facilityName: r.facility?.name || r.facilityName || 'Cơ sở Boxora',
                unitCode: r.unitCode || r.size?.volumeText || 'Kho tự quản',
                storageUnitId: r.storageUnitId || '',
                startDate: r.startDate || new Date().toISOString().slice(0, 10),
                endDate: r.rentalEndDate || '',
                expectedCheckInAt: r.expectedCheckInAt || (r.checkInDate ? `${r.checkInDate}T${r.checkInTime ? r.checkInTime.split(' - ')[0] || '09:00' : '09:00'}:00` : undefined),
                checkInTime: r.checkInTime,
                status: (r.status || 'PENDING_CONTACT') as any,
                customerId: r.customerId || 'guest',
                accessCode: r.accessCode || r.bookingCode || '',
                rentalMonths: r.rentalMonths || 1,
                totalRentalFee: r.totalRentalFee || 0,
                depositAmount: r.depositAmount || 0,
                depositPaid: 0,
                paymentStatus: 'UNPAID',
                createdAt: r.createdAt,
              }))

            const existingCodes = new Set(filteredArrivals.map(b => b.bookingCode))
            const newLocal = localArrivals.filter(b => !existingCodes.has(b.bookingCode))
            filteredArrivals = [...filteredArrivals, ...newLocal]
          }
        }
      } catch (localErr) {
        console.warn('Lỗi đọc đơn giữ chỗ cho Manager:', localErr)
      }

      setUpcomingHandovers(filteredArrivals)
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

  const handleManagerConfirmBooking = (booking: Booking) => {
    try {
      const raw = localStorage.getItem('boxora_guest_reservations')
      if (raw) {
        const list = JSON.parse(raw)
        const updatedList = list.map((r: any) =>
          (r.bookingCode === booking.bookingCode || r.id === booking.id)
            ? {
                ...r,
                status: 'CONFIRMED',
                confirmedByStaffId: user?.id,
                confirmedByStaffName: user?.fullName || 'Quản lý cơ sở',
                confirmedAt: new Date().toISOString(),
              }
            : r
        )
        localStorage.setItem('boxora_guest_reservations', JSON.stringify(updatedList))
      }
    } catch (e) {
      console.warn('Error updating reservation in storage:', e)
    }

    setUpcomingHandovers(prev => prev.map(b =>
      (b.id === booking.id || b.bookingCode === booking.bookingCode)
        ? {
            ...b,
            status: 'CONFIRMED' as any,
            assignedStaffId: user?.id,
            assignedStaffName: user?.fullName || 'Quản lý cơ sở',
          }
        : b
    ))

    try {
      const customerNotif = {
        id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        channel: 'IN_APP',
        notificationType: 'BOOKING_CONFIRMED',
        referenceType: 'BOOKING',
        referenceId: booking.bookingCode,
        title: `Đơn giữ chỗ ${booking.bookingCode} đã được xác nhận`,
        content: `Quản lý Boxora tại cơ sở ${booking.facilityName || 'kho'} đã xác nhận đơn giữ chỗ của quý khách. Trạng thái hiện tại: "Chờ check in". Hẹn gặp quý khách đúng lịch hẹn!`,
        status: 'UNREAD',
        createdAt: new Date().toISOString(),
      }
      const existingNotifs = JSON.parse(localStorage.getItem('boxora_in_app_notifications') || '[]')
      existingNotifs.unshift(customerNotif)
      localStorage.setItem('boxora_in_app_notifications', JSON.stringify(existingNotifs))
      window.dispatchEvent(new CustomEvent('boxora_notification_pushed', { detail: customerNotif }))
    } catch (e) {}

    window.dispatchEvent(new CustomEvent('boxora_reservation_status_changed', {
      detail: { bookingCode: booking.bookingCode, status: 'CONFIRMED' }
    }))

    setActionSuccessMessage(`Đã xác nhận đơn ${booking.bookingCode} thành công! Đơn đã chuyển sang trạng thái "Chờ check in".`)
    setTimeout(() => setActionSuccessMessage(null), 4000)
  }

  const handleManagerClaimReception = async (booking: Booking) => {
    if (role !== 'FACILITY_MANAGER' && role !== 'STAFF') return
    setClaimingBookingId(booking.id)
    try {
      const updated = await bookingService.claimCheckInReception(booking.id)
      setActiveHandoverBookingId(booking.id)
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

>>>>>>> Stashed changes
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
          <span className="text-[11px] text-slate-400 mt-0.5 font-data-tabular tabular-nums">{unit.size}</span>
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
          <span className="text-[11px] text-slate-600 font-medium font-data-tabular tabular-nums">{unit.size}</span>
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
      <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-7 gap-3.5">
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

        {/* Tile 5: Booking requests waiting for manager approval */}
        <button
          type="button"
          onClick={() => setShowBookingApprovalModal(true)}
          aria-live="polite"
          aria-label={`Yêu cầu chờ duyệt: ${pendingApprovalCount} đơn. Nhấn để xem và xử lý.`}
          className={`p-4 rounded-xl border flex flex-col justify-between text-left transition-all duration-300 cursor-pointer ${
            pendingApprovalCount > 0
              ? 'border-orange-400 bg-orange-50/70 ring-2 ring-orange-300/70 shadow-md shadow-orange-100 hover:bg-orange-50'
              : 'bg-white border-orange-200 shadow-2xs hover:border-orange-300 hover:shadow-md'
          } ${showBookingApprovalModal ? 'ring-2 ring-orange-500/40' : ''}`}
          title="Bấm để xem và xử lý các yêu cầu đặt giữ chỗ đang chờ duyệt"
        >
          <div className="flex items-start justify-between gap-1">
            <span className={`text-xs uppercase font-semibold leading-4 ${pendingApprovalCount > 0 ? 'text-orange-900' : 'text-orange-800'}`}>YÊU CẦU CHỜ DUYỆT</span>
            <span className="relative flex h-5 w-5 items-center justify-center">
              {pendingApprovalCount > 0 && (
                <span className="absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-60 motion-safe:animate-ping"></span>
              )}
              <span className={`material-symbols-outlined relative text-[18px] ${pendingApprovalCount > 0 ? 'text-orange-700' : 'text-orange-600'}`}>fact_check</span>
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className={`text-3xl font-extrabold font-mono tabular-nums leading-none ${pendingApprovalCount > 0 ? 'text-orange-700 motion-safe:animate-pulse' : 'text-orange-600'}`}>
              {String(pendingApprovalCount).padStart(2, '0')}
            </span>
            <span className="text-xs text-orange-800 font-medium">đơn</span>
          </div>
          <div className={`mt-3 flex items-center gap-1.5 text-[11px] font-semibold ${pendingApprovalCount > 0 ? 'text-orange-800' : 'text-orange-700'}`}>
            <span className="relative flex h-2 w-2">
              {pendingApprovalCount > 0 && (
                <span className="absolute inline-flex h-full w-full rounded-full bg-orange-500 opacity-75 motion-safe:animate-ping"></span>
              )}
              <span className={`relative inline-flex h-2 w-2 rounded-full ${pendingApprovalCount > 0 ? 'bg-orange-600' : 'bg-orange-500'}`}></span>
            </span>
            <span>{pendingApprovalCount > 0 ? 'Cần xử lý · nhấn để xem & duyệt' : 'Không có đơn chờ duyệt'}</span>
          </div>
        </button>

        {/* Tile 6: Maintenance */}
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

<<<<<<< HEAD
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
                <span className={`px-1.5 py-0.2 rounded font-data-tabular tabular-nums text-[11px] font-bold ${
                  selectedFloor === 'floor1' ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-600'
                }`}>
                  {isLoading ? <span aria-hidden="true" className="inline-block h-3 w-5 rounded bg-slate-400/50 animate-pulse motion-reduce:animate-none" /> : (isAnyFilterActive ? `${floor1MatchingCount}/${permanentFloor1.length}` : permanentFloor1.length)}
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
                <span className={`px-1.5 py-0.2 rounded font-data-tabular tabular-nums text-[11px] font-bold ${
                  selectedFloor === 'floor2' ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-600'
                }`}>
                  {isLoading ? <span aria-hidden="true" className="inline-block h-3 w-5 rounded bg-slate-400/50 animate-pulse motion-reduce:animate-none" /> : (isAnyFilterActive ? `${floor2MatchingCount}/${permanentFloor2.length}` : permanentFloor2.length)}
                </span>
              </button>
=======
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
          <span className="material-symbols-outlined text-[18px]">badge</span>
          <span>3. Bàn Vận Hành Quầy &amp; Tiếp Đón ({upcomingHandovers.length})</span>
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
          <span>4. Sự Cố &amp; SLA ({tickets.filter(t => t.status !== 'RESOLVED').length})</span>
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
>>>>>>> dc54f515e9b5c06f6639b5efd5c5ed3a26213a2c
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
          <div className="relative bg-slate-100 p-4 rounded-xl border border-slate-200 overflow-x-auto" aria-busy={isLoading}>
            {isLoading && <span role="status" aria-live="polite" className="sr-only">Đang tải sơ đồ kho</span>}
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
                {isLoading ? (
                  <UnitMapSkeleton />
                ) : permanentZoneC.length === 0 ? (
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
                  {isLoading ? (
                    <UnitMapSkeleton />
                  ) : permanentZoneA.length === 0 ? (
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
                  {isLoading ? (
                    <UnitMapSkeleton />
                  ) : permanentZoneB.length === 0 ? (
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
                <span className="font-data-tabular tabular-nums font-semibold text-slate-700">
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
<<<<<<< HEAD
=======

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

>>>>>>> dc54f515e9b5c06f6639b5efd5c5ed3a26213a2c
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

<<<<<<< Updated upstream
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
=======
          <ContractRenewalsManagementPanel
            currentFacilityId={selectedFacilityId}
            facilities={facilities}
            userRole={role}
            showChainWideFilter={role === 'BUSINESS_MANAGER' || role === 'ADMIN'}
          />
        </section>
      )}

      {/* ============================================================== */}
      {/* TAB 3: BÀN VẬN HÀNH QUẦY & TIẾP ĐÓN BÀN GIAO */}
      {/* ============================================================== */}
      {activeTab === 'handovers-returns' && (
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
                  Quản lý cơ sở trực tiếp tiếp nhận khách hàng, đối soát CCCD / giấy tờ tùy thân, nghiệm thu hiện trường 5 hạng mục và cấp phát mã PIN bảo mật bàn giao kho.
                </p>
              </div>
            </div>
            {activeBookingId && (
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

          {/* BÀN THAO TÁC CHECK-IN & BÀN GIAO KHO */}
          <div id="handover-workbench-section" className="scroll-mt-6">
            <HandoverCheckInWorkbench
              facilityId={selectedFacilityId || user?.facilityId}
              arrivals={upcomingHandovers}
              activeBookingId={activeBookingId}
              onSelectBooking={setActiveBookingId}
              onHandoverComplete={(bookingId) => {
                setActiveBookingId('')
                fetchUpcomingHandovers(selectedFacilityId, checkinTimeframe, checkinFromDate, checkinToDate)
                const targetFac = selectedFacilityId || user?.facilityId
                if (targetFac) void fetchUnits(targetFac)
                triggerAction('Đã hoàn tất bàn giao kho và cấp phát mã PIN cho khách hàng thành công!')
              }}
            />
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
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                            b.status === 'CONFIRMED'
                              ? 'bg-cyan-50 text-cyan-800 border border-cyan-300'
                              : (b.status as string) === 'PENDING_CONTACT' || (b.status as string) === 'PENDING_CONFIRMATION'
                              ? 'bg-amber-50 text-amber-800 border border-amber-300'
                              : 'bg-slate-50 text-slate-700 border border-slate-200'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              b.status === 'CONFIRMED'
                                ? 'bg-cyan-600 animate-pulse'
                                : (b.status as string) === 'PENDING_CONTACT' || (b.status as string) === 'PENDING_CONFIRMATION'
                                ? 'bg-amber-500 animate-pulse'
                                : 'bg-slate-400'
                            }`} />
                            {b.status === 'CONFIRMED'
                              ? 'CHỜ CHECK IN'
                              : (b.status as string) === 'PENDING_CONTACT' || (b.status as string) === 'PENDING_CONFIRMATION'
                              ? 'CHỜ XÁC NHẬN'
                              : 'CHỜ CỌC'}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-900">
                          {(b.depositPaid || b.depositAmount || 0).toLocaleString('vi-VN')} đ
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-2 flex-wrap">
<<<<<<< HEAD
                            {(b.status as string) === 'PENDING_CONTACT' || (b.status as string) === 'PENDING_CONFIRMATION' ? (
                              <button
                                type="button"
                                onClick={() => handleManagerConfirmBooking(b)}
                                className="px-3 py-1.5 rounded-lg font-bold text-[11px] bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white transition-all cursor-pointer flex items-center gap-1 shadow-xs"
                                title="Xác nhận đơn và chuyển sang trạng thái Chờ check in"
                              >
                                <span className="material-symbols-outlined text-[15px]">verified</span>
                                <span>Xác nhận đơn (Chờ check in)</span>
                              </button>
                            ) : b.assignedStaffName ? (
                              <div
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-semibold"
                                title={b.staffAssignmentNotes || undefined}
                              >
                                <span className="material-symbols-outlined text-[14px] text-emerald-600">person_check</span>
                                <span>{b.assignedStaffName}</span>
=======
                            {b.assignedStaffName ? (
                              <div className="flex items-center gap-1.5">
                                <div
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-semibold"
                                  title={b.staffAssignmentNotes || undefined}
                                >
                                  <span className="material-symbols-outlined text-[14px] text-emerald-600">person_check</span>
                                  <span>{b.assignedStaffName}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveBookingId(b.id)
                                    const el = document.getElementById('handover-workbench-section')
                                    if (el) el.scrollIntoView({ behavior: 'smooth' })
                                  }}
                                  className={`px-2.5 py-1.5 rounded-lg font-bold text-[11px] transition-colors cursor-pointer flex items-center gap-1 shadow-xs ${
                                    activeBookingId === b.id
                                      ? 'bg-cyan-700 text-white ring-2 ring-cyan-300'
                                      : 'bg-cyan-600 hover:bg-cyan-700 text-white'
                                  }`}
                                  title="Mở bàn vận hành tiếp đón & bàn giao cho đơn này"
                                >
                                  <span className="material-symbols-outlined text-[14px]">desktop_windows</span>
                                  <span>{activeBookingId === b.id ? 'Đang mở bàn' : 'Vận hành bàn giao'}</span>
                                </button>
>>>>>>> dc54f515e9b5c06f6639b5efd5c5ed3a26213a2c
                              </div>
                            ) : role === 'FACILITY_MANAGER' || role === 'STAFF' ? (
                              <button
                                type="button"
                                disabled={claimingBookingId === b.id}
                                onClick={() => handleManagerClaimReception(b)}
                                className="px-2.5 py-1.5 rounded-lg font-bold text-[11px] bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer flex items-center gap-1 shadow-xs disabled:opacity-50"
                              >
                                <span className="material-symbols-outlined text-[14px]">how_to_reg</span>
                                <span>{claimingBookingId === b.id ? 'Đang nhận...' : 'Tiếp nhận & Mở bàn'}</span>
                              </button>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500">
                                Chờ nhân viên hoặc quản lý cơ sở tiếp nhận
                              </span>
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

          {role === 'FACILITY_MANAGER' && activeHandoverBookingId && (
            <HandoverCheckInWorkbench
              facilityId={selectedFacilityId}
              arrivals={upcomingHandovers}
              activeBookingId={activeHandoverBookingId}
              onRefreshArrivals={() => fetchUpcomingHandovers(selectedFacilityId)}
              onHandoverComplete={() => {
                setActiveHandoverBookingId('')
                void fetchUpcomingHandovers(selectedFacilityId)
              }}
            />
          )}

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
>>>>>>> Stashed changes
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
        onClose={closeBookingApprovalModal}
        focusBookingId={bookingApprovalId}
        onPendingCountChange={setPendingApprovalCount}
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
