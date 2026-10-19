import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useOutletContext, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { bookingService } from '../../services/bookingService'
import { handoverService } from '../../services/handoverService'
import { supportTicketService } from '../../services/supportTicketService'
import { facilityService } from '../../services/facilityService'
import { facilityPolicyService } from '../../services/facilityPolicyService'
import { storageUnitService } from '../../services/storageUnitService'
import { Booking, StorageUnit, Facility, FacilityPolicy } from '../../types'
import { extractFloor, resolveBookingFloor, filterArrivals, AppointmentStatusFilter } from '../../utils/floorUtils'
import { HandoverCheckInWorkbench } from './components/HandoverCheckInWorkbench'
import { QrCameraCheckInModal } from './components/QrCameraCheckInModal'
import { StaffPolicyGuideModal } from './components/StaffPolicyGuideModal'
import { staffAssignmentService, StaffAssignmentResponse } from '../../services/staffAssignmentService'
import { ShiftSwapModal } from '../manager/modals/ShiftSwapModal'
import { ShiftHandoverModal } from '../manager/modals/ShiftHandoverModal'
import { ReceptionShiftAlertModal } from '../../components/modals/ReceptionShiftAlertModal'

const localDateString = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const assignmentWindow = (assignment: StaffAssignmentResponse) => {
  if (!assignment.startTime || !assignment.endTime) return null
  const start = new Date(`${assignment.assignedDate}T${assignment.startTime}`)
  const end = new Date(`${assignment.assignedDate}T${assignment.endTime}`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
  if (end <= start) end.setDate(end.getDate() + 1)
  return { start, end }
}

const isWithinAssignmentWindow = (assignment: StaffAssignmentResponse, now = new Date()) => {
  const window = assignmentWindow(assignment)
  return Boolean(window && now >= window.start && now < window.end)
}

const isAssignmentOnDuty = (assignment: StaffAssignmentResponse | null, now = new Date()) => {
  if (!assignment || assignment.status !== 'CHECKED_IN' || !assignment.checkedInAt || assignment.checkedOutAt) return false
  return isWithinAssignmentWindow(assignment, now)
}

export const StaffDashboard: React.FC = () => {
  const { user } = useAuth()
  const resolvedRole = (typeof user?.role === 'string' ? user?.role : user?.role?.name || user?.roleName || '').toUpperCase()
  const isAdmin = resolvedRole === 'ADMIN' || resolvedRole === 'SYSTEM_ADMIN'
  const { selectedFacility, facilities: contextFacilities } = useOutletContext<{
    selectedFacility?: string
    facilities?: Facility[]
  }>() || {}

  // Work Shift & Attendance State
  const [myTodayAssignment, setMyTodayAssignment] = useState<StaffAssignmentResponse | null>(null)
  const [isAttendanceLoading, setIsAttendanceLoading] = useState(false)
  const [showStaffSwapModal, setShowStaffSwapModal] = useState(false)
  const [showStaffHandoverModal, setShowStaffHandoverModal] = useState(false)
  const [pendingIncomingSwapsCount, setPendingIncomingSwapsCount] = useState<number>(0)
  const [attendanceSuccessMsg, setAttendanceSuccessMsg] = useState<string | null>(null)
  const isActuallyOnDuty = useMemo(() => isAssignmentOnDuty(myTodayAssignment), [myTodayAssignment])

  // Facility policy & guide
  const [staffFacilityPolicy, setStaffFacilityPolicy] = useState<FacilityPolicy | null>(null)
  const [isPolicyGuideOpen, setIsPolicyGuideOpen] = useState(false)

  // QR Code Scanner State
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false)

  // Booking & Unit Data
  const [arrivals, setArrivals] = useState<Booking[]>([])
  const [activeRentals, setActiveRentals] = useState<Booking[]>([])
  const [radarUnits, setRadarUnits] = useState<StorageUnit[]>([])
  const [facilities, setFacilities] = useState<Facility[]>([])

  // Selection states
  const [activeBookingId, setActiveBookingId] = useState<string>('')
  const [selectedReturnBookingId, setSelectedReturnBookingId] = useState<string>('')

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFloor, setSelectedFloor] = useState<string>('all')
  const [selectedShiftFilter, setSelectedShiftFilter] = useState<'current' | 'today' | 'past' | 'future' | 'all'>('current')
  const [filterFromDate, setFilterFromDate] = useState<string>('')
  const [filterToDate, setFilterToDate] = useState<string>('')
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<AppointmentStatusFilter>('ALL')
  const [claimingBookingId, setClaimingBookingId] = useState<string | null>(null)
  const [receptionAlertData, setReceptionAlertData] = useState<{
    isOpen: boolean
    message: string
    booking?: Booking | null
    canCheckInToday?: boolean
  } | null>(null)

  // Return Inspection Checklist state (Interactive)
  const [inspectionRollDoor, setInspectionRollDoor] = useState<'GOOD' | 'MINOR_DAMAGE' | 'BLOCKED'>('GOOD')
  const [inspectionCleanliness, setInspectionCleanliness] = useState<'CLEAN' | 'NEEDS_CLEANING' | 'DIRTY'>('CLEAN')
  const [inspectionLock, setInspectionLock] = useState<'NORMAL' | 'LATCH_DAMAGED' | 'FAULTY'>('NORMAL')
  const [inspectionCondition, setInspectionCondition] = useState<'GOOD' | 'NEEDS_MAINTENANCE' | 'ALERT'>('GOOD')
  const [inspectionWallStructure, setInspectionWallStructure] = useState<'GOOD' | 'DAMAGED'>('GOOD')
  const [inspectionNotes, setInspectionNotes] = useState('')

  // Real photos uploaded by staff (NO Unsplash)
  const [photoPanoramic, setPhotoPanoramic] = useState<string | null>(null)
  const [photoLock, setPhotoLock] = useState<string | null>(null)
  const panoramicInputRef = useRef<HTMLInputElement | null>(null)
  const lockInputRef = useRef<HTMLInputElement | null>(null)

  // Deposit & deduction settlement state
  const [deductionAmount, setDeductionAmount] = useState<number>(0)
  const [deductionReason, setDeductionReason] = useState<string>('')
  const [isSettlingReturn, setIsSettlingReturn] = useState(false)
  const [returnConfirmed, setReturnConfirmed] = useState(false)
  const [returnInspectionSaved, setReturnInspectionSaved] = useState(false)
  const [settlementSuccessMsg, setSettlementSuccessMsg] = useState<string | null>(null)
  const [settlementErrorMsg, setSettlementErrorMsg] = useState<string | null>(null)

  // Tickets state
  const [tickets, setTickets] = useState<Array<{
    id: string
    backendId?: string
    title: string
    priority: string
    status: string
    unitCode?: string
  }>>([])

  // Resolved current facility ID
  const currentTargetFacility = useMemo(() => {
    return (!selectedFacility || selectedFacility === 'ALL') ? user?.facilityId : selectedFacility
  }, [selectedFacility, user?.facilityId])

  // Assigned facility identification
  const assignedFacilityName = useMemo(() => {
    if (myTodayAssignment?.facilityName) return myTodayAssignment.facilityName
    if (user?.facilityName) return user.facilityName
    if (user?.facilityId) {
      const f = facilities.find(fac => fac.id === user.facilityId)
      if (f) return f.name
    }
    if (selectedFacility && selectedFacility !== 'ALL') {
      const f = facilities.find(fac => fac.id === selectedFacility)
      if (f) return f.name
    }
    return 'Cơ sở chưa được xác nhận'
  }, [user, facilities, selectedFacility, myTodayAssignment?.facilityName])

  // Load today's work shift assignment from database
  const loadMyAssignment = async () => {
    if (!user?.id) return
    setMyTodayAssignment(null)
    try {
      const now = new Date()
      const today = localDateString(now)
      const yesterdayDate = new Date(now)
      yesterdayDate.setDate(yesterdayDate.getDate() - 1)
      const res = await staffAssignmentService.getAllAssignments({
        staffId: user.id,
        fromDate: localDateString(yesterdayDate),
        toDate: today,
        size: 100
      })
      const list: StaffAssignmentResponse[] = res?.content || res || []
      const candidates = list.filter(a => a.status !== 'CANCELLED')
      const onDuty = candidates.find(a => isAssignmentOnDuty(a, now))
      const checkedInForCheckout = candidates
        .filter(a => a.status === 'CHECKED_IN')
        .sort((a, b) => `${b.assignedDate}T${b.startTime || ''}`.localeCompare(`${a.assignedDate}T${a.startTime || ''}`))[0]
      const currentAssignedShift = candidates.find(a => a.status === 'ASSIGNED' && isWithinAssignmentWindow(a, now))
      const upcomingToday = candidates
        .filter(a => a.assignedDate === today && a.status === 'ASSIGNED')
        .filter(a => {
          const window = assignmentWindow(a)
          return window && window.start > now
        })
        .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''))[0]
      const latestToday = candidates
        .filter(a => a.assignedDate === today)
        .sort((a, b) => (b.startTime || '').localeCompare(a.startTime || ''))[0]
      setMyTodayAssignment(onDuty || checkedInForCheckout || currentAssignedShift || upcomingToday || latestToday || null)
    } catch {
      setMyTodayAssignment(null)
    }

    // Fetch incoming swap requests that need current staff confirmation
    try {
      const mySwaps = await staffAssignmentService.getMySwapRequests()
      const incomingPending = (mySwaps || []).filter(
        s => s.targetStaffId === user?.id && s.status === 'MANAGER_APPROVED'
      ).length
      setPendingIncomingSwapsCount(incomingPending)
    } catch {
      setPendingIncomingSwapsCount(0)
    }
  }

  // Attendance Handlers
  const handleStaffCheckIn = async () => {
    if (!myTodayAssignment) return
    setIsAttendanceLoading(true)
    try {
      const updated = await staffAssignmentService.checkIn(myTodayAssignment.id, 'Nhân viên tự xác nhận vào ca trực tại quầy')
      setMyTodayAssignment(updated)
      setAttendanceSuccessMsg('Bạn đã điểm danh vào ca trực thành công!')
      setTimeout(() => setAttendanceSuccessMsg(null), 4000)
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Không thể điểm danh vào ca.')
    } finally {
      setIsAttendanceLoading(false)
    }
  }

  const handleStaffCheckOut = async () => {
    if (!myTodayAssignment) return
    if (!window.confirm('Bạn có chắc chắn muốn hoàn tất và kết thúc ca trực?')) return
    setIsAttendanceLoading(true)
    try {
      const updated = await staffAssignmentService.checkOut(myTodayAssignment.id, 'Hoàn thành ca trực')
      setMyTodayAssignment(updated)
      setAttendanceSuccessMsg('Bạn đã hoàn tất ca làm việc!')
      setTimeout(() => setAttendanceSuccessMsg(null), 4000)
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Không thể kết thúc ca trực.')
    } finally {
      setIsAttendanceLoading(false)
    }
  }

  // Initial and reactive data loading
  useEffect(() => {
    const targetFacility = currentTargetFacility
    setArrivals([])
    setActiveBookingId('')
    setActiveRentals([])
    setSelectedReturnBookingId('')
    fetchArrivals(targetFacility)
    loadFacilities()
    loadTicketQueue(targetFacility)
    loadActiveRentals(targetFacility)
    loadRadarUnits(targetFacility)
    loadFacilityPolicy(targetFacility)
    loadMyAssignment()
  }, [currentTargetFacility, user?.id])

  const loadFacilities = async () => {
    try {
      if (contextFacilities && contextFacilities.length > 0) {
        setFacilities(contextFacilities)
        return
      }
      const res = await facilityService.getFacilities()
      if (res?.content) {
        setFacilities(res.content)
      }
    } catch {
      // fallback
    }
  }

  const loadFacilityPolicy = async (facilityId?: string) => {
    try {
      const facId = facilityId || user?.facilityId
      if (facId) {
        const pol = await facilityPolicyService.getByFacilityId(facId)
        setStaffFacilityPolicy(pol)
      } else {
        setStaffFacilityPolicy(null)
      }
    } catch {
      setStaffFacilityPolicy(null)
    }
  }

  const fetchArrivals = async (
    facilityId?: string,
    timeframe?: 'current' | 'today' | 'past' | 'future' | 'all',
    fromDate?: string,
    toDate?: string
  ) => {
    try {
      const targetId = facilityId || currentTargetFacility
      const tf = timeframe !== undefined ? timeframe : selectedShiftFilter
      const from = fromDate !== undefined ? fromDate : filterFromDate
      const to = toDate !== undefined ? toDate : filterToDate

      const data = await bookingService.getUpcomingArrivals(targetId, {
        timeframe: tf?.toUpperCase(),
        fromDate: from || undefined,
        toDate: to || undefined,
      })
      if (Array.isArray(data)) {
        let filtered = data
        if (targetId) {
          filtered = filtered.filter(b => {
            if (b.facilityId) return b.facilityId === targetId
            if (b.storageUnitId) {
              const matchedUnit = radarUnits.find(u => u.id === b.storageUnitId)
              if (matchedUnit?.facilityId) {
                return matchedUnit.facilityId === targetId
              }
            }
            return false // Deny by default: Không hiển thị booking thiếu cơ sở xác minh
          })
        }
        setArrivals(filtered)
      } else {
        setArrivals([])
      }
    } catch {
      setArrivals([])
    }
  }

  const loadActiveRentals = async (facilityId?: string) => {
    try {
      const targetId = facilityId || currentTargetFacility
      const res = await bookingService.getAll({ status: 'ACTIVE', facilityId: targetId, size: 50 })
      if (res?.content && res.content.length > 0) {
        let filtered = res.content
        if (targetId) {
          filtered = filtered.filter(b => {
            if (b.facilityId) return b.facilityId === targetId
            if (b.storageUnitId) {
              const matchedUnit = radarUnits.find(u => u.id === b.storageUnitId)
              if (matchedUnit?.facilityId) {
                return matchedUnit.facilityId === targetId
              }
            }
            return false // Deny by default
          })
        }
        setActiveRentals(filtered)
      } else {
        setActiveRentals([])
      }
    } catch {
      setActiveRentals([])
    }
  }

  const loadRadarUnits = async (facilityId?: string) => {
    try {
      const targetId = facilityId || user?.facilityId || (selectedFacility !== 'ALL' ? selectedFacility : undefined)
      const units = await storageUnitService.getUnits(targetId ? { facilityId: targetId } : undefined)
      if (Array.isArray(units)) {
        setRadarUnits(units)
      } else {
        setRadarUnits([])
      }
    } catch {
      setRadarUnits([])
    }
  }

  const loadTicketQueue = async (facilityId?: string) => {
    try {
      const targetId = facilityId || currentTargetFacility
      const res = await supportTicketService.getQueue(targetId ? { facilityId: targetId } : undefined)
      if (Array.isArray(res)) {
        setTickets(res.map(t => ({
          id: `#TK-${t.ticketCode || t.id.slice(0, 6)}`,
          backendId: t.id,
          title: t.title || 'Sự cố tại chỗ',
          priority: t.priority || 'MEDIUM',
          status: t.status || 'OPEN',
          unitCode: (t as any).unitCode || (t as any).storageUnitCode || (t as any).unit?.unitCode,
        })))
      }
    } catch {
      // fallback
    }
  }

  // Lookup maps for Storage Units (by ID and by Facility+UnitCode)
  const unitMapById = useMemo(() => {
    const map = new Map<string, StorageUnit>()
    radarUnits.forEach((u) => {
      if (u.id) map.set(u.id, u)
    })
    return map
  }, [radarUnits])

  const unitMapByCodeAndFacility = useMemo(() => {
    const map = new Map<string, StorageUnit>()
    radarUnits.forEach((u) => {
      if (u.unitCode) {
        const key = `${u.facilityId || ''}::${u.unitCode.trim().toUpperCase()}`
        map.set(key, u)
      }
    })
    return map
  }, [radarUnits])

  // Discover all distinct floors available in current facility
  const availableFloors = useMemo(() => {
    const floorSet = new Set<string>()
    arrivals.forEach((b) => {
      const f = resolveBookingFloor(b, unitMapById, unitMapByCodeAndFacility)
      if (f) floorSet.add(f)
    })
    radarUnits.forEach((u) => {
      const f = extractFloor(u.floorLevel)
      if (f) floorSet.add(f)
    })
    return Array.from(floorSet).sort((a, b) => {
      const numA = parseInt(a, 10)
      const numB = parseInt(b, 10)
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB
      return a.localeCompare(b)
    })
  }, [arrivals, radarUnits, unitMapById, unitMapByCodeAndFacility])

  // Summary counts for arrival status pills
  const arrivalStatusCounts = useMemo(() => {
    let pending = 0
    let active = 0
    let completed = 0
    let cancelled = 0
    arrivals.forEach((b) => {
      if (b.status === 'ACTIVE') active++
      else if (b.status === 'COMPLETED') completed++
      else if (b.status === 'CANCELLED') cancelled++
      else pending++
    })
    return { total: arrivals.length, pending, active, completed, cancelled }
  }, [arrivals])

  // Filtered arrivals based on Search, Floor, Shift / Timeframe, Date range, Status
  const filteredArrivals = useMemo(() => {
    return filterArrivals(
      arrivals,
      searchQuery,
      selectedFloor,
      selectedShiftFilter,
      unitMapById,
      unitMapByCodeAndFacility,
      new Date(),
      filterFromDate || undefined,
      filterToDate || undefined,
      selectedStatusFilter
    )
  }, [arrivals, searchQuery, selectedFloor, selectedShiftFilter, unitMapById, unitMapByCodeAndFacility, filterFromDate, filterToDate, selectedStatusFilter])

  const handleTimeframeChange = (tf: 'current' | 'today' | 'past' | 'future' | 'all') => {
    setSelectedShiftFilter(tf)
    fetchArrivals(currentTargetFacility, tf, filterFromDate, filterToDate)
  }

  const handleDateFilterApply = (from: string, to: string) => {
    setFilterFromDate(from)
    setFilterToDate(to)
    fetchArrivals(currentTargetFacility, selectedShiftFilter, from, to)
  }

  const handleResetDateFilter = () => {
    setFilterFromDate('')
    setFilterToDate('')
    fetchArrivals(currentTargetFacility, selectedShiftFilter, '', '')
  }

  const handleClaimReception = async (booking: Booking) => {
    // Proactive check on shift attendance if user is staff/manager
    if (user?.roleName !== 'ADMIN') {
      const isShiftCheckedIn = myTodayAssignment?.status === 'CHECKED_IN' || (myTodayAssignment?.checkedInAt && !myTodayAssignment?.checkedOutAt)
      const bookingCheckinDate = booking.expectedCheckInAt ? booking.expectedCheckInAt.slice(0, 10) : booking.startDate
      const todayStr = localDateString(new Date())

      if (bookingCheckinDate === todayStr && !isShiftCheckedIn) {
        setReceptionAlertData({
          isOpen: true,
          message: 'Bạn chưa điểm danh vào ca làm việc hôm nay! Vui lòng điểm danh vào ca trực trước khi tiếp nhận lượt khách.',
          booking,
          canCheckInToday: !!myTodayAssignment,
        })
        return
      }
    }

    setClaimingBookingId(booking.id)
    try {
      const updated = await bookingService.claimCheckInReception(booking.id)
      setArrivals(prev => prev.map(b => b.id === booking.id ? {
        ...b,
        assignedStaffId: updated.assignedStaffId || user?.id,
        assignedStaffName: updated.assignedStaffName || user?.fullName || 'Nhân viên quầy'
      } : b))
      setActiveBookingId(booking.id)
      setAttendanceSuccessMsg(`Đã tiếp nhận lượt đón khách của đơn ${booking.bookingCode} thành công!`)
      setTimeout(() => setAttendanceSuccessMsg(null), 4000)
      setTimeout(() => {
        document.getElementById('handover-workbench')?.scrollIntoView({ behavior: 'smooth' })
      }, 50)
    } catch (err: any) {
      const isShiftCheckedIn = myTodayAssignment?.status === 'CHECKED_IN' || (myTodayAssignment?.checkedInAt && !myTodayAssignment?.checkedOutAt)
      const bookingCheckinDate = booking.expectedCheckInAt ? booking.expectedCheckInAt.slice(0, 10) : booking.startDate
      const todayStr = localDateString(new Date())
      const isBookingToday = bookingCheckinDate === todayStr

      setReceptionAlertData({
        isOpen: true,
        message: err?.response?.data?.message || 'Không thể tiếp nhận khách: Bạn chỉ có thể tiếp nhận khi có ca làm việc vào ngày hẹn check-in tại cơ sở và đã điểm danh vào ca trực.',
        booking,
        canCheckInToday: isBookingToday && !isShiftCheckedIn && !!myTodayAssignment,
      })
    } finally {
      setClaimingBookingId(null)
    }
  }

  // Current return target
  const currentReturnBooking = useMemo(() => {
    if (!selectedReturnBookingId) return null
    return activeRentals.find(r => r.id === selectedReturnBookingId) || null
  }, [activeRentals, selectedReturnBookingId])

  useEffect(() => {
    setReturnInspectionSaved(false)
    setReturnConfirmed(false)
    setSettlementSuccessMsg(null)
    setSettlementErrorMsg(null)
    setPhotoPanoramic(null)
    setPhotoLock(null)
  }, [currentReturnBooking?.id])

  const returnDepositAmt = useMemo(() => {
    if (!currentReturnBooking) return 0
    return currentReturnBooking.depositPaid || currentReturnBooking.depositAmount || 0
  }, [currentReturnBooking])

  const expectedRefundAmt = useMemo(() => {
    return Math.max(0, returnDepositAmt - (deductionAmount || 0))
  }, [returnDepositAmt, deductionAmount])

  // Upload return inspection evidence before saving the inspection.
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'panoramic' | 'lock') => {
    const file = e.target.files?.[0]
    if (!file || !currentReturnBooking) return
    const input = e.target
    setSettlementErrorMsg(null)
    try {
      const stored = await handoverService.uploadHandoverDocument(currentReturnBooking.id, file, 'CHECKIN_EVIDENCE')
      if (!stored?.fileUrl) throw new Error('Upload completed without a stored file URL.')
      if (type === 'panoramic') setPhotoPanoramic(stored.fileUrl)
      else setPhotoLock(stored.fileUrl)
    } catch (err: any) {
      setSettlementErrorMsg(err?.response?.data?.message || err?.message || 'Could not upload return evidence photo.')
    } finally {
      input.value = ''
    }
  }

  const handleSaveReturnInspection = async () => {
    if (!currentReturnBooking) return
    if (!photoPanoramic || !photoLock) {
      setSettlementErrorMsg('Upload both return inspection photos before saving the inspection.')
      return
    }
    setIsSettlingReturn(true)
    setSettlementErrorMsg(null)
    setSettlementSuccessMsg(null)
    try {
      await handoverService.performInspection({
        bookingId: currentReturnBooking.id,
        recordType: 'RETURN',
        doorConditionPassed: inspectionRollDoor === 'GOOD',
        cleanlinessPassed: inspectionCleanliness === 'CLEAN',
        smartLockPassed: inspectionLock === 'NORMAL',
        sensorPassed: inspectionCondition === 'GOOD',
        wallStructurePassed: inspectionWallStructure === 'GOOD',
        evidencePhotos: [photoPanoramic, photoLock],
        unitCondition: `Door: ${inspectionRollDoor}; cleanliness: ${inspectionCleanliness}; lock: ${inspectionLock}; environment: ${inspectionCondition}; wall: ${inspectionWallStructure}`,
        notes: inspectionNotes
      })
      setReturnInspectionSaved(true)
      setSettlementSuccessMsg('Return inspection and evidence saved. Review the proposed deductions in the next step.')
    } catch (err: any) {
      setSettlementErrorMsg(err?.response?.data?.message || err?.message || 'Could not save the return inspection.')
    } finally {
      setIsSettlingReturn(false)
    }
  }

  const handleProcessReturnSettlement = async () => {
    if (!currentReturnBooking) {
      setSettlementErrorMsg('Select an active booking before preparing a return proposal.')
      return
    }
    if (!returnInspectionSaved) {
      setSettlementErrorMsg('Save the return inspection before preparing its settlement proposal.')
      return
    }
    setIsSettlingReturn(true)
    setSettlementSuccessMsg(null)
    setSettlementErrorMsg(null)
    try {
      const result = await handoverService.processReturnSettlement({
        bookingId: currentReturnBooking.id,
        recordType: 'RETURN',
        deductionAmount: deductionAmount || 0,
        damageNotes: deductionReason || undefined,
        refundMethod: 'BANK_TRANSFER',
        notes: `Return settlement proposal. Additional notes: ${inspectionNotes || 'None'}.`
      })
      setReturnConfirmed(true)
      setSettlementSuccessMsg(`Proposal recorded. Proposed refund: ${(result.netRefundAmount || 0).toLocaleString('vi-VN')} VND; review status: ${result.reviewStatus || 'pending review'}. No refund transfer was made.`)
      fetchArrivals()
      loadActiveRentals()
    } catch (err: any) {
      setSettlementErrorMsg(err?.response?.data?.message || err?.message || 'Could not prepare the return settlement proposal.')
    } finally {
      setIsSettlingReturn(false)
    }
  }
  return (
    <div className="flex flex-col gap-6 text-left max-w-7xl mx-auto w-full">

      {/* Toast Alert for Attendance */}
      {attendanceSuccessMsg && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl border border-slate-700 flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <span className="material-symbols-outlined text-emerald-400">check_circle</span>
          <span className="text-xs font-semibold">{attendanceSuccessMsg}</span>
        </div>
      )}

      {/* 1. HEADER: BÀN VẬN HÀNH QUẦY & TIẾP ĐÓN */}
      <header className="w-full bg-white border border-slate-200/90 shadow-2xs rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center text-white shrink-0 shadow-xs">
              <span className="material-symbols-outlined text-[26px] text-cyan-400">desktop_windows</span>
            </div>
            <div>
              <h1 className="font-headline text-xl font-bold text-slate-900">
                Bàn Vận Hành Quầy &amp; Tiếp Đón
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsPolicyGuideOpen(true)}
              className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer shadow-xs hover:border-slate-300"
              title="Tra cứu nhanh hướng dẫn nghiệp vụ & SLA cơ sở"
            >
              <span className="material-symbols-outlined text-[18px] text-cyan-700">menu_book</span>
              <span>Hướng dẫn nghiệp vụ</span>
            </button>
          </div>
        </div>
      </header>

      {/* ALERT: Incoming Shift Swap waiting for confirmation */}
      {pendingIncomingSwapsCount > 0 && (
        <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/90 rounded-2xl flex items-center justify-between gap-4 shadow-xs flex-wrap">
          <div className="flex items-center gap-3 text-amber-950 font-medium text-xs">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs animate-pulse">
              <span className="material-symbols-outlined text-[20px]">swap_horiz</span>
            </div>
            <div>
              <p className="font-bold text-amber-950 text-sm">
                Yêu cầu đổi ca trực cần xác nhận!
              </p>
              <p className="text-amber-800 text-xs">
                Bạn có <strong>{pendingIncomingSwapsCount}</strong> ca trực được đồng nghiệp đề xuất đổi sang cho bạn và đã được Quản lý cơ sở phê duyệt.
              </p>
            </div>
          </div>
          <Link
            to="/staff/my-shifts"
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs inline-flex items-center gap-1.5 transition-colors shadow-xs shrink-0 cursor-pointer"
          >
            <span>Xem và phản hồi ngay</span>
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </Link>
        </div>
      )}

      {/* 2. 4 THẺ THỐNG KÊ / KPI QUẦY */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: Lịch hẹn nhận kho */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500 font-mono">
              Lịch Hẹn Nhận Kho
            </span>
            <span className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <span className="material-symbols-outlined text-[18px]">how_to_reg</span>
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-1.5">
            <span className="font-headline text-3xl font-extrabold text-slate-900 tabular-nums">{arrivals.length}</span>
            <span className="text-xs text-slate-500">lịch hẹn trong ca</span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-700 font-semibold">
            <span className="h-2 w-2 rounded-full bg-blue-600"></span>
            <span>{arrivals.filter(a => (a.depositPaid || 0) > 0).length} khách đã thanh toán tiền cọc</span>
          </div>
        </div>

        {/* KPI 2: Chờ bàn giao */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500 font-mono">
              Chờ Bàn Giao
            </span>
            <span className="w-8 h-8 rounded-lg bg-cyan-50 border border-cyan-100 flex items-center justify-center text-cyan-700">
              <span className="material-symbols-outlined text-[18px]">key</span>
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-1.5">
            <span className="font-headline text-3xl font-extrabold text-cyan-700 tabular-nums">
              {arrivals.filter(a => a.status === 'CONFIRMED' || a.status === 'PENDING_PAYMENT').length}
            </span>
            <span className="text-xs text-slate-500">đơn cần kiểm tra điều kiện</span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
            <span>Đối soát hợp đồng, thanh toán và giấy tờ trước bàn giao</span>
          </div>
        </div>

        {/* KPI 3: Chờ nghiệm thu trả kho */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500 font-mono">
              Chờ Nghiệm Thu Trả Kho
            </span>
            <span className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-700">
              <span className="material-symbols-outlined text-[18px]">assignment_return</span>
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-1.5">
            <span className="font-headline text-3xl font-extrabold text-amber-700 tabular-nums">
              {activeRentals.length}
            </span>
            <span className="text-xs text-slate-500">hợp đồng đến hạn</span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
            <span>Hồ sơ thuê cần thẩm định thực địa &amp; hoàn cọc</span>
          </div>
        </div>

        {/* KPI 4: Sự cố ưu tiên cao */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider font-bold text-rose-700 font-mono">
              Sự Cố Ưu Tiên Cao
            </span>
            <span className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
              <span className="material-symbols-outlined text-[18px]">warning</span>
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-1.5">
            <span className="font-headline text-3xl font-extrabold text-rose-600 tabular-nums">
              {tickets.filter(t => t.priority === 'HIGH' && t.status !== 'RESOLVED').length}
            </span>
            <span className="text-xs text-slate-500">ca mức độ Cao</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="text-slate-600">{tickets.filter(t => t.status !== 'RESOLVED').length} ticket đang mở</span>
            <Link to="/portal/tickets" className="text-rose-600 hover:text-rose-700 font-bold underline">
              Chi tiết
            </Link>
          </div>
        </div>

      </section>

      {/* 3. TÌM KIẾM & BỘ LỌC TẦNG / KHUNG GIỜ */}
      <section className="w-full bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex-1 relative">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm nhanh tên khách hàng, SĐT, mã đặt chỗ #RES-XXXX, hoặc mã số kho..."
            className="w-full pl-10 pr-3 py-2 bg-slate-50 text-slate-900 text-xs rounded-xl border border-slate-200 focus:outline-none focus:bg-white focus:border-blue-600 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs">
            <span className="text-slate-500 font-medium">Tầng:</span>
            <select
              value={selectedFloor}
              onChange={(e) => setSelectedFloor(e.target.value)}
              className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer"
            >
              <option value="all">Tất cả tầng</option>
              {availableFloors.map((fl) => (
                <option key={fl} value={fl}>
                  Tầng {fl}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs">
            <span className="text-slate-500 font-medium">Khung giờ:</span>
            <select
              value={selectedShiftFilter}
              onChange={(e) => setSelectedShiftFilter(e.target.value as any)}
              className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer"
            >
              <option value="current">Ca Hiện Tại</option>
              <option value="today">Trọn Vẹn Hôm Nay</option>
              <option value="all">Tất Cả Lịch Hẹn</option>
            </select>
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* PHẦN 2 & PHẦN 3: BỐ CỤC HAI BÊN (BÀN TIẾP ĐÓN & TRẢ KHO) */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* BÊN TRÁI: QUY TRÌNH CHECK-IN & BÀN GIAO KHO (Col 7) */}
        <div className="xl:col-span-7 flex flex-col gap-6">
          <HandoverCheckInWorkbench
            facilityId={currentTargetFacility}
            arrivals={arrivals}
            onOpenQrScanner={() => setIsQrScannerOpen(true)}
            activeBookingId={activeBookingId}
            onSelectBooking={setActiveBookingId}
            onHandoverComplete={(bookingId) => {
              setActiveBookingId('')
              fetchArrivals(currentTargetFacility)
              loadActiveRentals(currentTargetFacility)
              loadRadarUnits(currentTargetFacility)
            }}
          />
        </div>

        {/* BÊN PHẢI: BÀN VẬN HÀNH QUẦY & NGHIỆM THU TRẢ KHO (Col 5) */}
        <div className="xl:col-span-5 flex flex-col gap-6">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600 text-[22px]">fact_check</span>
                  <h2 className="font-headline text-base font-bold text-slate-900">Nghiệm Thu Trả Kho</h2>
                </div>
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px] font-bold">
                  Thực địa
                </span>
              </div>

              {/* Chọn hợp đồng đến hạn */}
              {activeRentals.length > 0 ? (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl mb-4">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="text-[10px] uppercase font-bold text-slate-500">Hợp Đồng Nghiệm Thu</span>
                    <select
                      value={selectedReturnBookingId}
                      onChange={(e) => {
                        setSelectedReturnBookingId(e.target.value)
                        setReturnConfirmed(false)
                        setSettlementSuccessMsg(null)
                      }}
                      className="px-2.5 py-1 rounded bg-white border border-slate-200 text-slate-800 font-mono text-[11px] font-bold focus:outline-none cursor-pointer max-w-[220px] truncate"
                    >
                      <option value="">-- Chọn hợp đồng ({activeRentals.length}) --</option>
                      {activeRentals.map(r => (
                        <option key={r.id} value={r.id}>
                          {r.bookingCode} - Kho #{r.unitCode} ({r.customerName})
                        </option>
                      ))}
                    </select>
                  </div>
                  {currentReturnBooking && (
                    <div className="pt-2 border-t border-slate-200/80">
                      <div>
                        <span className="font-bold text-slate-900 text-sm block">{currentReturnBooking.customerName || 'Khách thuê'}</span>
                        <span className="text-xs text-slate-500">SĐT: {currentReturnBooking.customerPhone || 'N/A'}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
                        <span className="text-slate-800">Kho: <strong className="font-mono text-cyan-800">#{currentReturnBooking.unitCode}</strong></span>
                        <span className="text-amber-700 font-mono font-bold text-[11px]">Hạn trả: {currentReturnBooking.endDate || 'Đến hạn'}</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl mb-4 text-xs text-slate-500 text-center">
                  Hiện không có hợp đồng nào đến hạn nghiệm thu trả kho.
                </div>
              )}

              {/* Biểu Mẫu Thẩm Định Hiện Trường (Chỉ hiển thị khi đã chọn hợp đồng) */}
              {currentReturnBooking ? (
                <>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-900 font-mono">
                        Hạng mục kiểm tra hiện trường
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">Đánh giá thực tế</span>
                    </div>

                    {/* Hạng mục 1: Cửa cuốn */}
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex flex-col gap-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[16px] text-slate-500">garage</span>
                          1. Cửa cuốn &amp; Ray trượt
                        </span>
                        <select
                          value={inspectionRollDoor}
                          onChange={(e) => setInspectionRollDoor(e.target.value as any)}
                          className="px-2 py-0.5 rounded bg-white border border-slate-200 font-bold text-[11px] focus:outline-none cursor-pointer"
                        >
                          <option value="GOOD">Tốt / Bình thường</option>
                          <option value="MINOR_DAMAGE">Móp nhẹ / Trầy xước</option>
                          <option value="BLOCKED">Kẹt ray / Hỏng nặng</option>
                        </select>
                      </div>
                    </div>

                    {/* Hạng mục 2: Vệ sinh */}
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex flex-col gap-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[16px] text-slate-500">cleaning_services</span>
                          2. Vệ sinh kho &amp; Sàn
                        </span>
                        <select
                          value={inspectionCleanliness}
                          onChange={(e) => setInspectionCleanliness(e.target.value as any)}
                          className="px-2 py-0.5 rounded bg-white border border-slate-200 font-bold text-[11px] focus:outline-none cursor-pointer"
                        >
                          <option value="CLEAN">Sạch sẽ / Đã dọn rác</option>
                          <option value="NEEDS_CLEANING">Còn rác / Cần vệ sinh</option>
                          <option value="DIRTY">Bẩn nhiều / Ẩm mốc</option>
                        </select>
                      </div>
                    </div>

                    {/* Hạng mục 3: Ổ khóa SmartLock */}
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex flex-col gap-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[16px] text-slate-500">lock</span>
                          3. Khóa SmartLock &amp; Phụ kiện
                        </span>
                        <select
                          value={inspectionLock}
                          onChange={(e) => setInspectionLock(e.target.value as any)}
                          className="px-2 py-0.5 rounded bg-white border border-slate-200 font-bold text-[11px] focus:outline-none cursor-pointer"
                        >
                          <option value="NORMAL">Bình thường / Đủ phụ kiện</option>
                          <option value="LATCH_DAMAGED">Hỏng chốt an toàn</option>
                          <option value="FAULTY">Mất khóa / Lỗi điện tử</option>
                        </select>
                      </div>
                    </div>

                    {/* Hạng mục 4: Đánh giá môi trường kho (thủ công) */}
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex flex-col gap-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[16px] text-slate-500">thermostat</span>
                          4. Môi trường kho thực tế
                        </span>
                        <select
                          value={inspectionCondition}
                          onChange={(e) => setInspectionCondition(e.target.value as any)}
                          className="px-2 py-0.5 rounded bg-white border border-slate-200 font-bold text-[11px] focus:outline-none cursor-pointer"
                        >
                          <option value="GOOD">Khô ráo, thông thoáng</option>
                          <option value="NEEDS_MAINTENANCE">Cần bảo dưỡng quạt</option>
                          <option value="ALERT">Có dấu hiệu ẩm ướt</option>
                        </select>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-900">5. Tường &amp; kết cấu buồng kho</span>
                        <select
                          value={inspectionWallStructure}
                          onChange={(e) => setInspectionWallStructure(e.target.value as 'GOOD' | 'DAMAGED')}
                          className="px-2 py-0.5 rounded bg-white border border-slate-200 font-bold text-[11px] focus:outline-none cursor-pointer"
                        >
                          <option value="GOOD">Không biến dạng / Tốt</option>
                          <option value="DAMAGED">Móp méo / Hư hại</option>
                        </select>
                      </div>
                      <input
                        type="text"
                        value={inspectionNotes}
                        onChange={(e) => setInspectionNotes(e.target.value)}
                        placeholder="Ghi chú thẩm định hiện trường khác..."
                        className="mt-1 px-2.5 py-1 bg-white border border-slate-200 rounded text-[11px] text-slate-800 focus:outline-none"
                      />
                    </div>

                    {/* Ảnh Hiện Trường Thực Tế */}
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-slate-900 uppercase font-mono">
                          Ảnh Chụp Hiện Trường (Tải từ thiết bị)
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {[photoPanoramic, photoLock].filter(Boolean).length}/2 ảnh
                        </span>
                      </div>

                      <input
                        type="file"
                        accept="image/*"
                        ref={panoramicInputRef}
                        className="hidden"
                        onChange={(e) => handlePhotoUpload(e, 'panoramic')}
                      />
                      <input
                        type="file"
                        accept="image/*"
                        ref={lockInputRef}
                        className="hidden"
                        onChange={(e) => handlePhotoUpload(e, 'lock')}
                      />

                      <div className="grid grid-cols-2 gap-2">
                        {/* Ảnh 1 */}
                        <div className="relative rounded-lg overflow-hidden h-24 border border-dashed border-slate-300 bg-white flex flex-col items-center justify-center p-2 text-center">
                          {photoPanoramic ? (
                            <>
                              <img src={photoPanoramic} alt="Toàn cảnh kho" className="w-full h-full object-cover" />
                              <button
                                type="button"
                                onClick={() => setPhotoPanoramic(null)}
                                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-slate-900/80 text-white flex items-center justify-center text-[11px]"
                              >
                                ✕
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => panoramicInputRef.current?.click()}
                              className="flex flex-col items-center justify-center text-slate-500 hover:text-cyan-700 cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[20px]">add_a_photo</span>
                              <span className="text-[10px] font-semibold mt-1">Toàn cảnh kho</span>
                            </button>
                          )}
                        </div>

                        {/* Ảnh 2 */}
                        <div className="relative rounded-lg overflow-hidden h-24 border border-dashed border-slate-300 bg-white flex flex-col items-center justify-center p-2 text-center">
                          {photoLock ? (
                            <>
                              <img src={photoLock} alt="Ổ khóa & cửa" className="w-full h-full object-cover" />
                              <button
                                type="button"
                                onClick={() => setPhotoLock(null)}
                                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-slate-900/80 text-white flex items-center justify-center text-[11px]"
                              >
                                ✕
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => lockInputRef.current?.click()}
                              className="flex flex-col items-center justify-center text-slate-500 hover:text-cyan-700 cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[20px]">add_a_photo</span>
                              <span className="text-[10px] font-semibold mt-1">Khóa &amp; Cửa kho</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Phân Biệt Tiền Cọc, Đề Xuất Khấu Trừ & Hoàn Trả */}
                    <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200 flex flex-col gap-2 text-xs">
                      <div className="flex items-center justify-between text-slate-600">
                        <span>Tiền cọc ban đầu đã thanh toán:</span>
                        <strong className="font-mono tabular-nums text-slate-900">
                          {returnDepositAmt.toLocaleString('vi-VN')}đ
                        </strong>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-600">Đề xuất khấu trừ (VND):</span>
                        <input
                          type="number"
                          min={0}
                          max={returnDepositAmt}
                          value={deductionAmount}
                          onChange={(e) => setDeductionAmount(Math.max(0, Number(e.target.value) || 0))}
                          className="w-32 px-2 py-1 bg-white border border-slate-300 rounded font-mono font-bold text-right text-slate-900 focus:outline-none"
                        />
                      </div>

                      {deductionAmount > 0 && (
                        <input
                          type="text"
                          value={deductionReason}
                          onChange={(e) => setDeductionReason(e.target.value)}
                          placeholder="Lý do khấu trừ (vd: Phí vệ sinh sàn kho)..."
                          className="px-2.5 py-1 bg-white border border-slate-200 rounded text-[11px] text-slate-800 focus:outline-none"
                        />
                      )}

                      <div className="flex items-center justify-between text-slate-900 pt-2 border-t border-slate-200">
                        <span className="font-bold">Số tiền cọc dự kiến hoàn trả:</span>
                        <span className="font-mono tabular-nums text-base text-emerald-600 font-extrabold">
                          {expectedRefundAmt.toLocaleString('vi-VN')}đ
                        </span>
                      </div>

                      <p className="text-[10px] text-slate-500 italic mt-1">
                        * Nhân viên quầy lập biên bản nghiệm thu hiện trường và đề xuất hoàn cọc. Giao dịch hoàn tiền sẽ do Quản lý cơ sở / Kế toán phê duyệt.
                      </p>
                    </div>
                  </div>

                  {settlementSuccessMsg && (
                    <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-emerald-600">check_circle</span>
                      <span>{settlementSuccessMsg}</span>
                    </div>
                  )}

                  {settlementErrorMsg && (
                    <div role="alert" className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold">
                      {settlementErrorMsg}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleSaveReturnInspection}
                    disabled={returnInspectionSaved || isSettlingReturn || !currentReturnBooking || !photoPanoramic || !photoLock}
                    className="mt-4 w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-blue-700 hover:bg-blue-800 text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {returnInspectionSaved ? 'Đã lưu biên bản nghiệm thu' : isSettlingReturn ? 'Đang lưu biên bản…' : 'Lưu biên bản nghiệm thu trả kho'}
                  </button>

                  <button
                    type="button"
                    onClick={handleProcessReturnSettlement}
                    disabled={returnConfirmed || isSettlingReturn || !currentReturnBooking || !returnInspectionSaved}
                    className={`mt-3 w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                      returnConfirmed
                        ? 'bg-emerald-600 text-white'
                        : isSettlingReturn
                        ? 'bg-slate-500 text-white cursor-wait'
                        : 'bg-slate-900 hover:bg-slate-800 text-white'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {returnConfirmed ? 'check_circle' : isSettlingReturn ? 'hourglass_top' : 'assignment_turned_in'}
                    </span>
                    <span>
                      {returnConfirmed ? 'ĐÃ LẬP BIÊN BẢN & ĐỀ XUẤT' : isSettlingReturn ? 'Đang Lưu Biên Bản...' : 'Lập Biên Bản Nghiệm Thu & Đề Xuất Hoàn Cọc'}
                    </span>
                  </button>
                </>
              ) : (
                <div className="py-12 px-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 flex flex-col items-center justify-center text-center my-2">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                    <span className="material-symbols-outlined text-[26px]">fact_check</span>
                  </div>
                  <p className="font-bold text-slate-800 text-sm">Chưa Chọn Hợp Đồng Nghiệm Thu</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
                    Vui lòng chọn một hợp đồng từ danh sách phía trên để tiến hành thẩm định hiện trường và đề xuất hoàn cọc.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* ============================================================== */}
      {/* PHẦN 4: LỊCH HẸN NHẬN KHO TRONG CA (FULL WIDTH) */}
      {/* ============================================================== */}
      <section className="w-full bg-white border border-slate-200/90 rounded-2xl shadow-sm p-6">
        <div className="pb-4 mb-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-600 text-[22px]">calendar_today</span>
              <h2 className="font-headline text-base font-bold text-slate-900">
                Lịch Hẹn Nhận Kho Trong Ca
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-mono text-[11px] font-bold">
                {filteredArrivals.length} lịch hẹn ({arrivalStatusCounts.pending} chờ nhận, {arrivalStatusCounts.active} đã bàn giao)
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Danh sách tiếp đón khách hàng đến nhận kho trực tiếp tại cơ sở trong ca làm việc.
            </p>
          </div>

          {/* Quick Stats or Current Shift Indicator */}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>
                Ca trực:{' '}
                {myTodayAssignment?.shift
                  ? myTodayAssignment.shift === 'MORNING'
                    ? 'Ca Sáng'
                    : myTodayAssignment.shift === 'AFTERNOON'
                    ? 'Ca Chiều'
                    : myTodayAssignment.shift === 'NIGHT'
                    ? 'Ca Tối'
                    : 'Cả Ngày'
                  : 'Chưa vào ca'}
              </span>
            </span>
          </div>
        </div>

        {/* Filter Bar: Khung thời gian & Khoảng ngày */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 mb-3 p-3 bg-slate-50/70 border border-slate-200/80 rounded-xl">
          {/* Timeframe Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-white border border-slate-200/80 rounded-xl shadow-2xs overflow-x-auto">
            {[
              { id: 'current', label: 'Hiện tại / Trong ca', icon: 'schedule' },
              { id: 'past', label: 'Quá khứ', icon: 'history' },
              { id: 'future', label: 'Tương lai', icon: 'upcoming' },
              { id: 'all', label: 'Tất cả thời gian', icon: 'clear_all' },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTimeframeChange(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  selectedShiftFilter === tab.id
                    ? 'bg-blue-600 text-white shadow-xs font-bold'
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
                value={filterFromDate}
                onChange={(e) => handleDateFilterApply(e.target.value, filterToDate)}
                className="bg-transparent border-none text-slate-800 text-xs font-mono focus:outline-none cursor-pointer"
              />
            </div>
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs shadow-2xs">
              <span className="material-symbols-outlined text-[15px] text-slate-400">event</span>
              <span className="text-slate-500 font-medium text-[11px]">Đến ngày:</span>
              <input
                type="date"
                value={filterToDate}
                onChange={(e) => handleDateFilterApply(filterFromDate, e.target.value)}
                className="bg-transparent border-none text-slate-800 text-xs font-mono focus:outline-none cursor-pointer"
              />
            </div>
            {(filterFromDate || filterToDate) && (
              <button
                type="button"
                onClick={handleResetDateFilter}
                className="px-2.5 py-1.5 text-[11px] font-bold text-slate-600 hover:text-rose-600 bg-white hover:bg-rose-50 border border-slate-200 rounded-xl transition cursor-pointer flex items-center gap-1 shadow-2xs"
                title="Xóa bộ lọc ngày"
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
                <span>Xóa lọc</span>
              </button>
            )}
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 mb-5 p-2 bg-slate-50/80 border border-slate-200/80 rounded-xl overflow-x-auto">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0 px-2 flex items-center gap-1">
            <span className="material-symbols-outlined text-[15px] text-blue-600">filter_alt</span>
            <span>Lọc trạng thái:</span>
          </span>
          {[
            { id: 'ALL', label: `Tất cả (${arrivalStatusCounts.total})`, icon: 'list' },
            { id: 'PENDING', label: `Chờ nhận kho (${arrivalStatusCounts.pending})`, icon: 'hourglass_empty', activeClass: 'bg-amber-600 text-white font-bold' },
            { id: 'ACTIVE', label: `Đã bàn giao (${arrivalStatusCounts.active})`, icon: 'verified', activeClass: 'bg-emerald-600 text-white font-bold' },
            { id: 'COMPLETED', label: `Đã hoàn tất (${arrivalStatusCounts.completed})`, icon: 'task_alt', activeClass: 'bg-blue-600 text-white font-bold' },
            { id: 'CANCELLED', label: `Đã hủy (${arrivalStatusCounts.cancelled})`, icon: 'cancel', activeClass: 'bg-rose-600 text-white font-bold' },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedStatusFilter(tab.id as AppointmentStatusFilter)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shadow-2xs ${
                selectedStatusFilter === tab.id
                  ? (tab.activeClass || 'bg-slate-900 text-white font-bold')
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-mono uppercase tracking-wider text-[11px]">
                  <th className="py-2.5 px-3 rounded-l-lg font-semibold">Khách hàng</th>
                  <th className="py-2.5 px-3 font-semibold">Mã Đặt Chỗ</th>
                  <th className="py-2.5 px-3 font-semibold">Kho Đăng Ký</th>
                  <th className="py-2.5 px-3 font-semibold">Ngày Check-in</th>
                  <th className="py-2.5 px-3 font-semibold">Trạng Thái</th>
                  <th className="py-2.5 px-3 font-semibold">Cọc Giữ Chỗ</th>
                  <th className="py-2.5 px-3 rounded-r-lg text-right font-semibold">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredArrivals.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400 text-xs">
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <span className="material-symbols-outlined text-3xl text-slate-300">event_available</span>
                        <span className="font-semibold text-slate-600">Không có lượt hẹn nào phù hợp bộ lọc</span>
                        <span className="text-[11px] text-slate-400">Thử chuyển bộ lọc trạng thái sang "Tất cả" hoặc mở rộng khung thời gian.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredArrivals.map((b) => {
                    const isCurrentActive = b.id === activeBookingId || b.bookingCode === activeBookingId
                    return (
                      <tr
                        key={b.id}
                        className={`transition-colors ${
                          isCurrentActive
                            ? 'bg-cyan-50/80 ring-1 ring-cyan-200'
                            : 'hover:bg-slate-50/70'
                        }`}
                      >
                        <td className="py-3.5 px-3">
                          <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                            {isCurrentActive && (
                              <span className="w-2 h-2 rounded-full bg-cyan-600 animate-pulse"></span>
                            )}
                            <span>{b.customerName || 'Khách vãng lai'}</span>
                          </div>
                          <div className="text-slate-500 font-mono text-[11px] tabular-nums mt-0.5">{b.customerPhone || 'N/A'}</div>
                        </td>
                        <td className="py-3.5 px-3 font-mono font-bold text-slate-900">{b.bookingCode}</td>
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-bold text-cyan-700">Kho #{b.unitCode}</span>
                            {(() => {
                              const fl = resolveBookingFloor(b, unitMapById, unitMapByCodeAndFacility)
                              return fl ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-200">
                                  Tầng {fl}
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500">
                                  Chưa rõ tầng
                                </span>
                              )
                            })()}
                          </div>
                          <span className="text-slate-500 block text-[10px]">{b.facilityName || assignedFacilityName}</span>
                        </td>
                        <td className="py-3.5 px-3">
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
                        <td className="py-3.5 px-3">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 shadow-2xs ${
                            b.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                              : b.status === 'COMPLETED'
                              ? 'bg-blue-50 text-blue-800 border border-blue-300'
                              : b.status === 'CANCELLED'
                              ? 'bg-rose-50 text-rose-800 border border-rose-300'
                              : b.status === 'CONFIRMED'
                              ? 'bg-cyan-50 text-cyan-800 border border-cyan-300'
                              : 'bg-amber-50 text-amber-800 border border-amber-300'
                          }`}>
                            <span className="material-symbols-outlined text-[12px]">
                              {b.status === 'ACTIVE' || b.status === 'COMPLETED'
                                ? 'check_circle'
                                : b.status === 'CANCELLED'
                                ? 'cancel'
                                : 'schedule'}
                            </span>
                            <span>
                              {b.status === 'ACTIVE'
                                ? 'ĐÃ BÀN GIAO'
                                : b.status === 'COMPLETED'
                                ? 'ĐÃ HOÀN TẤT'
                                : b.status === 'CANCELLED'
                                ? 'ĐÃ HỦY'
                                : b.status === 'CONFIRMED'
                                ? 'CHỜ CHECK-IN'
                                : 'CHỜ CỌC'}
                            </span>
                          </span>
                        </td>
                        <td className="py-3.5 px-3 font-mono font-bold text-slate-900 tabular-nums">
                          {(b.depositPaid || b.depositAmount || 0).toLocaleString('vi-VN')}đ
                        </td>
                        <td className="py-3.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-2 flex-wrap">
                            {b.status === 'ACTIVE' || b.status === 'COMPLETED' ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveBookingId(b.id)
                                  document.getElementById('handover-workbench')?.scrollIntoView({ behavior: 'smooth' })
                                }}
                                className="px-3 py-1.5 rounded-lg font-bold text-[11px] bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                                title="Xem lại hồ sơ nghiệm thu, ảnh hiện trường và mã PIN"
                              >
                                <span className="material-symbols-outlined text-[15px] text-emerald-600">fact_check</span>
                                <span>Xem Hồ Sơ &amp; PIN</span>
                              </button>
                            ) : b.assignedStaffId && b.assignedStaffId !== user?.id && !isAdmin ? (
                              <>
                                <div
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-semibold"
                                  title={`Đang do nhân viên ${b.assignedStaffName || 'khác'} phụ trách`}
                                >
                                  <span className="material-symbols-outlined text-[14px] text-slate-500">person</span>
                                  <span>{b.assignedStaffName}</span>
                                </div>
                                <span
                                  className="px-2.5 py-1.5 rounded-lg text-[10px] text-slate-400 font-medium bg-slate-50 border border-slate-100 cursor-not-allowed inline-flex items-center gap-1"
                                  title={`Lượt tiếp đón này do nhân viên ${b.assignedStaffName || 'khác'} tiếp nhận`}
                                >
                                  <span className="material-symbols-outlined text-[12px]">lock</span>
                                  Nhân sự khác trực
                                </span>
                              </>
                            ) : b.assignedStaffId === user?.id ? (
                              <>
                                <div
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-semibold"
                                  title="Bạn đang phụ trách lượt tiếp đón này"
                                >
                                  <span className="material-symbols-outlined text-[14px] text-emerald-600">verified_user</span>
                                  <span>Bạn phụ trách</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveBookingId(b.id)
                                    document.getElementById('handover-workbench')?.scrollIntoView({ behavior: 'smooth' })
                                  }}
                                  className={`px-3 py-1.5 rounded-lg font-bold text-[11px] transition-colors cursor-pointer flex items-center gap-1 ${
                                    isCurrentActive
                                      ? 'bg-cyan-600 text-white shadow-xs'
                                      : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                                  }`}
                                >
                                  <span className="material-symbols-outlined text-[14px]">
                                    {isCurrentActive ? 'task_alt' : 'touch_app'}
                                  </span>
                                  <span>{isCurrentActive ? 'Đang Xử Lý' : 'Tiếp đón & Đối soát'}</span>
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  disabled={claimingBookingId === b.id}
                                  onClick={() => handleClaimReception(b)}
                                  className="px-2.5 py-1.5 rounded-lg font-bold text-[11px] bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer flex items-center gap-1 shadow-xs disabled:opacity-50"
                                >
                                  <span className="material-symbols-outlined text-[14px]">how_to_reg</span>
                                  <span>{claimingBookingId === b.id ? 'Đang nhận...' : 'Tiếp nhận'}</span>
                                </button>
                                {isAdmin && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveBookingId(b.id)
                                      document.getElementById('handover-workbench')?.scrollIntoView({ behavior: 'smooth' })
                                    }}
                                    className="px-2.5 py-1.5 rounded-lg font-bold text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer flex items-center gap-1"
                                  >
                                    <span>Giám sát</span>
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
        </div>
      </section>

      {/* MODAL QUÉT QR CHECK-IN QUA CAMERA */}
      <QrCameraCheckInModal
        isOpen={isQrScannerOpen}
        onClose={() => setIsQrScannerOpen(false)}
        facilityId={user?.facilityId}
        onSelectBookingForWorkbench={(bookingId) => {
          setActiveBookingId(bookingId)
          window.setTimeout(() => document.getElementById('handover-workbench')?.scrollIntoView({ behavior: 'smooth' }), 0)
        }}
      />
      {/* MODAL HƯỚNG DẪN NGHIỆP VỤ DÀNH CHO NHÂN VIÊN (CHẾ ĐỘ XEM TẬP TRUNG) */}
      <StaffPolicyGuideModal
        isOpen={isPolicyGuideOpen}
        onClose={() => setIsPolicyGuideOpen(false)}
        facilityId={user?.facilityId || selectedFacility}
        facilityName={staffFacilityPolicy?.facilityName || assignedFacilityName}
      />

      {/* MODAL XIN ĐỔI CA TRỰC DÀNH CHO NHÂN VIÊN */}
      {showStaffSwapModal && myTodayAssignment && (
        <ShiftSwapModal
          isOpen={showStaffSwapModal}
          onClose={() => setShowStaffSwapModal(false)}
          assignment={myTodayAssignment}
          facilityId={myTodayAssignment.facilityId}
          onSuccess={(msg) => {
            setAttendanceSuccessMsg(msg)
            setShowStaffSwapModal(false)
            loadMyAssignment()
            setTimeout(() => setAttendanceSuccessMsg(null), 5000)
          }}
        />
      )}

      {/* MODAL LẬP BIÊN BÀN BÀN GIAO CA DÀNH CHO NHÂN VIÊN */}
      {showStaffHandoverModal && myTodayAssignment && (
        <ShiftHandoverModal
          isOpen={showStaffHandoverModal}
          onClose={() => setShowStaffHandoverModal(false)}
          facilityId={myTodayAssignment.facilityId}
          facilityName={assignedFacilityName}
          currentShift={myTodayAssignment.shift}
          outgoingAssignmentId={myTodayAssignment.id}
          onSuccess={(msg) => {
            setAttendanceSuccessMsg(msg)
            setShowStaffHandoverModal(false)
            loadMyAssignment()
            setTimeout(() => setAttendanceSuccessMsg(null), 5000)
          }}
        />
      )}

      {/* MODAL THÔNG BÁO YÊU CẦU CA TRỰC & ĐIỂM DANH KHI TIẾP NHẬN */}
      {receptionAlertData && (
        <ReceptionShiftAlertModal
          isOpen={receptionAlertData.isOpen}
          onClose={() => setReceptionAlertData(null)}
          message={receptionAlertData.message}
          booking={receptionAlertData.booking}
          role="STAFF"
          canCheckInToday={receptionAlertData.canCheckInToday}
          onCheckInNow={handleStaffCheckIn}
          isCheckingIn={isAttendanceLoading}
        />
      )}

    </div>
  )
}
