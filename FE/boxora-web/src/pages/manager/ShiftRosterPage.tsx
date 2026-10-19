import React, { useState, useEffect, useMemo } from 'react'
import { userService } from '../../services/userService'
import { facilityService } from '../../services/facilityService'
import {
  staffAssignmentService,
  StaffAssignmentResponse,
  ShiftSwapRequest,
  ShiftHandover
} from '../../services/staffAssignmentService'
import { useAuth } from '../../context/AuthContext'
import { Facility, User } from '../../types'
import { ShiftAssignmentModal } from './modals/ShiftAssignmentModal'
import { ShiftSwapModal } from './modals/ShiftSwapModal'
import { ShiftHandoverModal } from './modals/ShiftHandoverModal'
import { ShiftEditModal } from './modals/ShiftEditModal'

const formatDateLocal = (d: Date): string => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const formatVN = (dateStr?: string | null): string => {
  if (!dateStr) return '—'
  const parts = dateStr.split('-')
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }
  return dateStr
}

const getDayOfWeekVN = (dateStr?: string | null): string => {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
    return days[d.getDay()] || ''
  } catch {
    return ''
  }
}

const formatDateTime = (dtStr?: string | null): string => {
  if (!dtStr) return '—'
  try {
    const d = new Date(dtStr)
    return d.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  } catch {
    return dtStr
  }
}

const getWeekRange = (refDate: Date): { from: string; to: string } => {
  const d = new Date(refDate)
  const day = d.getDay()
  const diffToMon = day === 0 ? -6 : 1 - day
  const mon = new Date(d)
  mon.setDate(d.getDate() + diffToMon)
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  return { from: formatDateLocal(mon), to: formatDateLocal(sun) }
}

export const ShiftRosterPage: React.FC = () => {
  const { user } = useAuth()
  const userRole = (typeof user?.role === 'object' ? user?.role?.name : user?.role) || user?.roleName
  const isBusinessManager = userRole === 'BUSINESS_MANAGER'
  const isFacilityManager = userRole === 'FACILITY_MANAGER'

  const todayStr = useMemo(() => formatDateLocal(new Date()), [])
  const initialWeek = useMemo(() => getWeekRange(new Date()), [])
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>('')

  // Date Range States - Defaults to THIS_WEEK (Section 6.1 Requirement)
  const [startDate, setStartDate] = useState<string>(() => initialWeek.from)
  const [endDate, setEndDate] = useState<string>(() => initialWeek.to)
  const [appliedStartDate, setAppliedStartDate] = useState<string>(() => initialWeek.from)
  const [appliedEndDate, setAppliedEndDate] = useState<string>(() => initialWeek.to)
  const [dateShortcut, setDateShortcut] = useState<'LAST_WEEK' | 'THIS_WEEK' | 'NEXT_WEEK' | 'TODAY' | 'THIS_MONTH' | 'CUSTOM'>('THIS_WEEK')
  const [dateRangeError, setDateRangeError] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<'ROSTER' | 'SWAPS' | 'HANDOVERS' | 'STAFF'>('ROSTER')

  // Real Data States
  const [assignments, setAssignments] = useState<StaffAssignmentResponse[]>([])
  const [swapRequests, setSwapRequests] = useState<ShiftSwapRequest[]>([])
  const [handovers, setHandovers] = useState<ShiftHandover[]>([])
  const [staffList, setStaffList] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Filters & Search for Roster Table
  const [searchTerm, setSearchTerm] = useState('')
  const [filterShift, setFilterShift] = useState<string>('ALL')
  const [filterStaff, setFilterStaff] = useState<string>('ALL')
  const [filterZone, setFilterZone] = useState<string>('ALL')
  const [filterStatus, setFilterStatus] = useState<string>('ALL')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 8

  // Modals & Action States
  const [showShiftModal, setShowShiftModal] = useState(false)
  const [showManagerSwapModal, setShowManagerSwapModal] = useState(false)
  const [selectedAssignmentForSwap, setSelectedAssignmentForSwap] = useState<StaffAssignmentResponse | null>(null)
  const [selectedAssignmentForDetail, setSelectedAssignmentForDetail] = useState<StaffAssignmentResponse | null>(null)
  const [selectedAssignmentForEdit, setSelectedAssignmentForEdit] = useState<StaffAssignmentResponse | null>(null)
  const [showHandoverModal, setShowHandoverModal] = useState(false)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 4000)
  }

  // Load facilities
  useEffect(() => {
    const loadFacilities = async () => {
      try {
        const res = await facilityService.getFacilities()
        const facs = res?.content || []
        setFacilities(facs)
        const userFacId = user?.facilityId
        if (isBusinessManager) {
          setSelectedFacilityId('ALL')
        } else if (userFacId && facs.some(f => f.id === userFacId)) {
          setSelectedFacilityId(userFacId)
        } else if (facs.length > 0) {
          setSelectedFacilityId(facs[0].id)
        }
      } catch (err) {
        console.warn('Failed to load facilities:', err)
      }
    }
    loadFacilities()
  }, [user, isBusinessManager])

  // Date shortcuts handler
  const applyShortcut = (shortcut: 'LAST_WEEK' | 'THIS_WEEK' | 'NEXT_WEEK' | 'TODAY' | 'THIS_MONTH') => {
    setDateShortcut(shortcut)
    setDateRangeError(null)
    const now = new Date()
    let s = ''
    let e = ''
    if (shortcut === 'TODAY') {
      s = formatDateLocal(now)
      e = s
    } else if (shortcut === 'THIS_WEEK') {
      const w = getWeekRange(now)
      s = w.from
      e = w.to
    } else if (shortcut === 'LAST_WEEK') {
      const prevWeek = new Date(now)
      prevWeek.setDate(prevWeek.getDate() - 7)
      const w = getWeekRange(prevWeek)
      s = w.from
      e = w.to
    } else if (shortcut === 'NEXT_WEEK') {
      const nextWeek = new Date(now)
      nextWeek.setDate(nextWeek.getDate() + 7)
      const w = getWeekRange(nextWeek)
      s = w.from
      e = w.to
    } else if (shortcut === 'THIS_MONTH') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      s = formatDateLocal(firstDay)
      e = formatDateLocal(lastDay)
    }
    setStartDate(s)
    setEndDate(e)
    setAppliedStartDate(s)
    setAppliedEndDate(e)
    setCurrentPage(1)
  }

  const handleApplyCustomDate = () => {
    if (startDate > endDate) {
      setDateRangeError('Ngày bắt đầu không được lớn hơn ngày kết thúc!')
      showToast('Lỗi: Ngày bắt đầu không được lớn hơn ngày kết thúc!')
      return
    }
    setDateRangeError(null)
    setAppliedStartDate(startDate)
    setAppliedEndDate(endDate)
    setCurrentPage(1)
    showToast(`Đã áp dụng bộ lọc từ ${formatVN(startDate)} đến ${formatVN(endDate)}`)
  }

  const handleResetDate = () => {
    applyShortcut('THIS_WEEK')
  }

  // Fetch all operational data for selected facility & date range
  const fetchData = async () => {
    setIsLoading(true)
    try {
      const targetFacilityId = selectedFacilityId === 'ALL' || !selectedFacilityId ? undefined : selectedFacilityId

      // 1. Shift assignments in range
      const assignRes = await staffAssignmentService.getAllAssignments({
        facilityId: targetFacilityId,
        fromDate: appliedStartDate,
        toDate: appliedEndDate,
        size: 300
      })
      let assignList: StaffAssignmentResponse[] = []
      if (assignRes?.content && Array.isArray(assignRes.content)) {
        assignList = assignRes.content
      } else if (Array.isArray(assignRes)) {
        assignList = assignRes
      }
      setAssignments(assignList)

      // 2. Staff / Manager list
      const staffRes = await userService.getAllUsers({
        role: isBusinessManager ? 'FACILITY_MANAGER' : 'STAFF',
        facilityId: targetFacilityId,
        size: 100
      })
      setStaffList(staffRes.data || [])

      // 3. Shift swap requests in range
      const swapRes = await staffAssignmentService.getSwapRequests({
        facilityId: targetFacilityId,
        fromDate: appliedStartDate,
        toDate: appliedEndDate,
        size: 100
      })
      let swapList: ShiftSwapRequest[] = []
      if (swapRes?.content && Array.isArray(swapRes.content)) {
        swapList = swapRes.content
      } else if (Array.isArray(swapRes)) {
        swapList = swapRes
      }
      setSwapRequests(swapList)

      // 4. Shift handovers in range
      const handoverRes = await staffAssignmentService.getHandovers({
        facilityId: targetFacilityId,
        fromDate: appliedStartDate,
        toDate: appliedEndDate,
        size: 100
      })
      let handoverList: ShiftHandover[] = []
      if (handoverRes?.content && Array.isArray(handoverRes.content)) {
        handoverList = handoverRes.content
      } else if (Array.isArray(handoverRes)) {
        handoverList = handoverRes
      }
      setHandovers(handoverList)
    } catch (err) {
      console.warn('Failed to load shift roster data:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [selectedFacilityId, appliedStartDate, appliedEndDate])

  const currentFacilityName = useMemo(() => {
    if (selectedFacilityId === 'ALL') return 'Toàn chuỗi (Tất cả cơ sở)'
    const f = facilities.find(fac => fac.id === selectedFacilityId)
    return f ? f.name : (user?.facilityName || 'Cơ sở Boxora')
  }, [facilities, selectedFacilityId, user?.facilityName])

  // Dynamic Zones extracted from current assignments + standard zones
  const availableZones = useMemo(() => {
    const defaultZones = ['Quầy tiếp tân', 'Phân khu A', 'Phân khu B', 'Phân khu C']
    const extracted = assignments.map(a => a.assignedZone).filter(Boolean) as string[]
    return Array.from(new Set([...defaultZones, ...extracted]))
  }, [assignments])

  // Real KPI calculations from DB data with clear scopes
  const totalStaffCount = staffList.length
  const checkedInCount = useMemo(() => assignments.filter(a => a.status === 'CHECKED_IN').length, [assignments])
  const assignedCount = useMemo(() => assignments.filter(a => a.status === 'ASSIGNED').length, [assignments])
  const completedCount = useMemo(() => assignments.filter(a => a.status === 'COMPLETED').length, [assignments])
  const pendingSwapCount = useMemo(() => swapRequests.filter(s => s.status === 'PENDING').length, [swapRequests])

  const distinctShiftsCount = useMemo(() => {
    const shifts = new Set(assignments.map(a => a.shift))
    return shifts.size
  }, [assignments])

  // Direct Shift Actions
  const handleCheckIn = async (assignment: StaffAssignmentResponse) => {
    if (assignment.assignedDate !== todayStr) {
      showToast('Chỉ có thể điểm danh vào ca trực của ngày hôm nay.')
      return
    }
    setActionLoadingId(assignment.id)
    try {
      await staffAssignmentService.checkIn(assignment.id, 'Điểm danh vào ca trực tại quầy')
      showToast(`Điểm danh vào ca thành công cho ${assignment.staffFullName || assignment.staffUsername}!`)
      await fetchData()
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Không thể điểm danh vào ca.')
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleCheckOut = async (assignment: StaffAssignmentResponse) => {
    setActionLoadingId(assignment.id)
    try {
      await staffAssignmentService.checkOut(assignment.id, 'Hoàn thành nhiệm vụ ca trực')
      showToast(`Hoàn tất kết thúc ca trực cho ${assignment.staffFullName || assignment.staffUsername}!`)
      await fetchData()
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Không thể kết thúc ca trực.')
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleDeleteAssignment = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn hủy phân công ca trực này?')) return
    setActionLoadingId(id)
    try {
      await staffAssignmentService.deleteAssignment(id)
      showToast('Đã hủy phân công ca trực thành công.')
      await fetchData()
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Không thể hủy ca trực.')
    } finally {
      setActionLoadingId(null)
    }
  }

  // Swap Review Actions
  const handleReviewSwap = async (swapId: string, status: 'APPROVED' | 'REJECTED') => {
    setActionLoadingId(swapId)
    try {
      await staffAssignmentService.reviewSwapRequest(swapId, {
        status,
        managerNotes: status === 'APPROVED' ? 'Quản lý cơ sở đã phê duyệt đổi ca' : 'Từ chối yêu cầu đổi ca'
      })
      showToast(status === 'APPROVED' ? 'Đã duyệt yêu cầu đổi ca trực thành công!' : 'Đã từ chối yêu cầu đổi ca.')
      await fetchData()
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Lỗi khi xử lý đổi ca.')
    } finally {
      setActionLoadingId(null)
    }
  }

  // Handover Acknowledge Action
  const handleAcknowledgeHandover = async (handoverId: string) => {
    setActionLoadingId(handoverId)
    try {
      await staffAssignmentService.acknowledgeHandover(handoverId, {
        status: 'ACKNOWLEDGED',
        notes: 'Tiếp nhận ca đầy đủ theo biên bản bàn giao'
      })
      showToast('Đã xác nhận tiếp nhận bàn giao ca thành công!')
      await fetchData()
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Lỗi khi xác nhận bàn giao.')
    } finally {
      setActionLoadingId(null)
    }
  }

  // Filtered Roster
  const filteredAssignments = useMemo(() => {
    return assignments.filter(a => {
      const staffName = a.staffFullName || a.staffUsername || ''
      const matchSearch =
        staffName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.staffEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.assignedZone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.notes?.toLowerCase().includes(searchTerm.toLowerCase())

      if (!matchSearch) return false
      if (filterShift !== 'ALL' && a.shift !== filterShift) return false
      if (filterStaff !== 'ALL' && a.staffId !== filterStaff) return false
      if (filterZone !== 'ALL' && a.assignedZone !== filterZone) return false
      if (filterStatus !== 'ALL' && a.status !== filterStatus) return false
      return true
    })
  }, [assignments, searchTerm, filterShift, filterStaff, filterZone, filterStatus])

  // Table filter active check
  const isTableFilterActive =
    filterShift !== 'ALL' ||
    filterStaff !== 'ALL' ||
    filterZone !== 'ALL' ||
    filterStatus !== 'ALL' ||
    searchTerm.trim() !== ''

  const handleResetTableFilters = () => {
    setFilterShift('ALL')
    setFilterStaff('ALL')
    setFilterZone('ALL')
    setFilterStatus('ALL')
    setSearchTerm('')
    setCurrentPage(1)
  }

  // Pagination for Roster
  const totalRosterPages = Math.ceil(filteredAssignments.length / itemsPerPage) || 1
  const paginatedAssignments = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredAssignments.slice(start, start + itemsPerPage)
  }, [filteredAssignments, currentPage, itemsPerPage])

  const isSingleDay = appliedStartDate === appliedEndDate
  const dateRangeLabel = isSingleDay
    ? `${getDayOfWeekVN(appliedStartDate)}, ${formatVN(appliedStartDate)}`
    : `${formatVN(appliedStartDate)} – ${formatVN(appliedEndDate)}`

  return (
    <div className="flex flex-col gap-6 w-full text-left">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl border border-slate-700 flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <span className="material-symbols-outlined text-emerald-400">check_circle</span>
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Header Banner with Full Date Range Filter */}
      <div className="flex flex-col gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[28px]">schedule</span>
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  {isBusinessManager
                    ? 'Giám Sát Ca Toàn Chuỗi & Phân Bổ Quản Lý'
                    : 'Xử Lý Trực Ca & Điều Phối Nhân Sự'}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  {currentFacilityName}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 font-mono">
                  {dateRangeLabel}
                </span>
                {isBusinessManager && (
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                    Chế độ giám sát chỉ đọc
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {isBusinessManager
                  ? 'Theo dõi ca làm toàn hệ thống ở chế độ chỉ đọc; điều phối và phân công ca cho Quản lý cơ sở'
                  : 'Điều phối ca trực quầy tiếp đón, kiểm tra buồng kho, chấm công vào/ra ca, đổi ca và biên bản bàn giao'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Facility Picker */}
            {(isBusinessManager || facilities.length > 1) && (
              <select
                value={selectedFacilityId}
                onChange={e => {
                  setSelectedFacilityId(e.target.value)
                  setCurrentPage(1)
                }}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-slate-400 cursor-pointer"
              >
                {isBusinessManager && (
                  <option value="ALL">Toàn chuỗi (Tất cả cơ sở)</option>
                )}
                {facilities.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              onClick={fetchData}
              disabled={isLoading}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
            >
              <span className={`material-symbols-outlined text-[16px] ${isLoading ? 'animate-spin' : ''}`}>
                refresh
              </span>
              <span>Làm mới</span>
            </button>

            {isBusinessManager ? (
              <button
                type="button"
                onClick={() => setShowShiftModal(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                title="Phân công ca trực cho Quản lý cơ sở"
              >
                <span className="material-symbols-outlined text-[18px]">manage_accounts</span>
                <span>Phân công Quản lý cơ sở</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowShiftModal(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">person_add</span>
                <span>Phân ca nhân viên</span>
              </button>
            )}
          </div>
        </div>

        {/* Date Range Toolbar (Section 4.1 Requirement) */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          {/* Shortcuts */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold flex-wrap">
            <button
              type="button"
              onClick={() => applyShortcut('LAST_WEEK')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                dateShortcut === 'LAST_WEEK'
                  ? 'bg-white text-blue-700 font-bold shadow-md shadow-slate-900/10 border border-slate-200/80 ring-1 ring-blue-500/20'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tuần trước
            </button>
            <button
              type="button"
              onClick={() => applyShortcut('THIS_WEEK')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                dateShortcut === 'THIS_WEEK'
                  ? 'bg-white text-blue-700 font-bold shadow-md shadow-slate-900/10 border border-slate-200/80 ring-1 ring-blue-500/20'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tuần này
            </button>
            <button
              type="button"
              onClick={() => applyShortcut('NEXT_WEEK')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                dateShortcut === 'NEXT_WEEK'
                  ? 'bg-white text-blue-700 font-bold shadow-md shadow-slate-900/10 border border-slate-200/80 ring-1 ring-blue-500/20'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tuần sau
            </button>
            <button
              type="button"
              onClick={() => applyShortcut('TODAY')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                dateShortcut === 'TODAY'
                  ? 'bg-white text-blue-700 font-bold shadow-md shadow-slate-900/10 border border-slate-200/80 ring-1 ring-blue-500/20'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Hôm nay
            </button>
            <button
              type="button"
              onClick={() => applyShortcut('THIS_MONTH')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                dateShortcut === 'THIS_MONTH'
                  ? 'bg-white text-blue-700 font-bold shadow-md shadow-slate-900/10 border border-slate-200/80 ring-1 ring-blue-500/20'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tháng này
            </button>
          </div>

          {/* Custom Date Inputs with Apply & Reset */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs">
              <span className="text-slate-400 font-medium">Từ:</span>
              <input
                type="date"
                value={startDate}
                onChange={e => {
                  setStartDate(e.target.value)
                  setDateShortcut('CUSTOM')
                  setDateRangeError(null)
                }}
                className="bg-transparent font-semibold text-slate-800 outline-none text-xs"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs">
              <span className="text-slate-400 font-medium">Đến:</span>
              <input
                type="date"
                value={endDate}
                onChange={e => {
                  setEndDate(e.target.value)
                  setDateShortcut('CUSTOM')
                  setDateRangeError(null)
                }}
                className="bg-transparent font-semibold text-slate-800 outline-none text-xs"
              />
            </div>

            <button
              type="button"
              onClick={handleApplyCustomDate}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">check</span>
              <span>Áp dụng</span>
            </button>

            <button
              type="button"
              onClick={handleResetDate}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-semibold transition-all cursor-pointer"
              title="Đặt lại về ngày hôm nay"
            >
              Đặt lại
            </button>
          </div>
        </div>

        {dateRangeError && (
          <div className="text-xs text-rose-600 font-semibold flex items-center gap-1 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-lg">
            <span className="material-symbols-outlined text-[16px]">error</span>
            <span>{dateRangeError}</span>
          </div>
        )}
      </div>

      {/* 4 KPI Cards - Strictly Real DB Data with Clearly Defined Scopes (Section 4.2) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Tổng nhân sự cơ sở */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <div className="flex items-center gap-1.5">
              <span>Tổng nhân sự cơ sở</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                Toàn cơ sở
              </span>
            </div>
            <div className="p-1.5 rounded-lg bg-slate-100 text-slate-700">
              <span className="material-symbols-outlined text-[18px]">group</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {totalStaffCount}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Nhân viên thuộc biên chế chi nhánh (không đổi theo ngày)
            </div>
          </div>
        </div>

        {/* KPI 2: Đang trực ca */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <div className="flex items-center gap-1.5">
              <span>Đang trực ca</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Thời gian thực
              </span>
            </div>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <span className="material-symbols-outlined text-[18px]">how_to_reg</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-emerald-700 tracking-tight flex items-center gap-2">
              <span>{checkedInCount}</span>
              {checkedInCount > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                  Có mặt tại quầy
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Đã điểm danh vào ca và đang có mặt làm nhiệm vụ
            </div>
          </div>
        </div>

        {/* KPI 3: Chưa vào ca / Chờ trực */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <div className="flex items-center gap-1.5">
              <span>Chờ trực / Chưa vào ca</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                Khoảng ngày
              </span>
            </div>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <span className="material-symbols-outlined text-[18px]">pending_actions</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-amber-700 tracking-tight">
              {assignedCount}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Phân công trong khoảng ngày, chưa tới giờ hoặc chưa check-in
            </div>
          </div>
        </div>

        {/* KPI 4: Ca trực & Hoàn thành */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <div className="flex items-center gap-1.5">
              <span>Ca trực &amp; Hoàn thành</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                Khoảng ngày
              </span>
            </div>
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <span className="material-symbols-outlined text-[18px]">calendar_view_day</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-blue-700 tracking-tight">
              {assignments.length} ca trực
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {completedCount} hoàn thành • {distinctShiftsCount} khung ca • {pendingSwapCount} yêu cầu đổi ca
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 flex-wrap">
        <button
          type="button"
          onClick={() => setActiveTab('ROSTER')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'ROSTER'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">view_timeline</span>
          <span>Bảng Lịch Trực &amp; Chấm Công ({assignments.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('SWAPS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer relative ${
            activeTab === 'SWAPS'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">swap_horiz</span>
          <span>Yêu Cầu Đổi Ca ({swapRequests.length})</span>
          {pendingSwapCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-bold">
              {pendingSwapCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('HANDOVERS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'HANDOVERS'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">assignment_turned_in</span>
          <span>Biên Bản Bàn Giao Ca ({handovers.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('STAFF')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'STAFF'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">badge</span>
          <span>Danh Sách Nhân Sự Cơ Sở ({staffList.length})</span>
        </button>
      </div>

      {/* TAB 1: ROSTER (Bảng phân công ca trực & Chấm công) */}
      {activeTab === 'ROSTER' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col gap-5">
          {/* Controls & Filter Bar (Section 4.3 Requirement) */}
          <div className="flex flex-col gap-3 pb-3 border-b border-slate-100">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              {/* Shift Quick Filter */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {(['ALL', 'MORNING', 'AFTERNOON', 'NIGHT', 'FULL_DAY'] as const).map(sh => {
                  const label =
                    sh === 'ALL'
                      ? 'Tất cả ca'
                      : sh === 'MORNING'
                      ? 'Ca Sáng'
                      : sh === 'AFTERNOON'
                      ? 'Ca Chiều'
                      : sh === 'NIGHT'
                      ? 'Ca Đêm'
                      : 'Cả Ngày'
                  return (
                    <button
                      key={sh}
                      type="button"
                      onClick={() => {
                        setFilterShift(sh)
                        setCurrentPage(1)
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        filterShift === sh
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>

              {/* Search Bar */}
              <div className="relative w-full lg:w-72">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400">
                  search
                </span>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => {
                    setSearchTerm(e.target.value)
                    setCurrentPage(1)
                  }}
                  placeholder="Tìm nhân sự, email, phân khu, ghi chú..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>
            </div>

            {/* Dropdown Filters: Staff, Zone, Status */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Filter Staff */}
              <select
                value={filterStaff}
                onChange={e => {
                  setFilterStaff(e.target.value)
                  setCurrentPage(1)
                }}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-blue-400"
              >
                <option value="ALL">Tất cả nhân sự ({staffList.length})</option>
                {staffList.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.fullName || s.username} ({s.email})
                  </option>
                ))}
              </select>

              {/* Filter Zone */}
              <select
                value={filterZone}
                onChange={e => {
                  setFilterZone(e.target.value)
                  setCurrentPage(1)
                }}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-blue-400"
              >
                <option value="ALL">Tất cả phân khu</option>
                {availableZones.map(z => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>

              {/* Filter Status */}
              <select
                value={filterStatus}
                onChange={e => {
                  setFilterStatus(e.target.value)
                  setCurrentPage(1)
                }}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-blue-400"
              >
                <option value="ALL">Tất cả trạng thái chấm công</option>
                <option value="ASSIGNED">Chưa vào ca (Chờ trực)</option>
                <option value="CHECKED_IN">Đang trực ca (Checked-in)</option>
                <option value="COMPLETED">Đã hoàn thành</option>
                <option value="CANCELLED">Đã hủy ca</option>
              </select>

              {/* Reset Table Filters */}
              {isTableFilterActive && (
                <button
                  type="button"
                  onClick={handleResetTableFilters}
                  className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">filter_alt_off</span>
                  <span>Xóa bộ lọc bảng</span>
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-3 px-4">Nhân sự trực ca</th>
                  <th className="py-3 px-4">Ngày làm việc</th>
                  <th className="py-3 px-4">Ca &amp; Khung giờ làm</th>
                  <th className="py-3 px-4">Phân khu &amp; Vai trò</th>
                  <th className="py-3 px-4 text-center">Trạng thái chấm công</th>
                  <th className="py-3 px-4 text-center">Giờ thực tế</th>
                  <th className="py-3 px-4 text-right">Tác vụ điều phối</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <span className="material-symbols-outlined text-3xl animate-spin mb-1">progress_activity</span>
                      <p>Đang tải lịch phân công ca trực...</p>
                    </td>
                  </tr>
                ) : filteredAssignments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2 max-w-md mx-auto">
                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-1">
                          <span className="material-symbols-outlined text-[26px]">event_busy</span>
                        </div>
                        {assignments.length === 0 ? (
                          <>
                            <p className="font-bold text-slate-800 text-sm">
                              Chưa có ca trực nào được phân công tại cơ sở này trong khoảng thời gian {dateRangeLabel}
                            </p>
                            <p className="text-xs text-slate-500">
                              Cơ sở hiện có {totalStaffCount} nhân viên thuộc biên chế. Quản lý có thể chọn nút bên dưới để lên lịch phân công ca trực hoặc chuyển sang xem tuần này / tháng này.
                            </p>
                            <div className="flex items-center gap-2 mt-2 flex-wrap justify-center">
                              <button
                                type="button"
                                onClick={() => setShowShiftModal(true)}
                                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[18px]">person_add</span>
                                <span>Phân công ca trực ngay</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => applyShortcut('THIS_WEEK')}
                                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                              >
                                Xem toàn bộ tuần này
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <p className="font-bold text-slate-800 text-sm">
                              Không tìm thấy ca trực nào phù hợp với bộ lọc
                            </p>
                            <p className="text-xs text-slate-500">
                              Có {assignments.length} ca trực trong khoảng ngày {dateRangeLabel} nhưng không khớp với tiêu chí tìm kiếm hiện tại.
                            </p>
                            <button
                              type="button"
                              onClick={handleResetTableFilters}
                              className="mt-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-all cursor-pointer"
                            >
                              Xóa bộ lọc để xem tất cả
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedAssignments.map(assignment => {
                    const isCheckedIn = assignment.status === 'CHECKED_IN'
                    const isCompleted = assignment.status === 'COMPLETED'
                    const isAssigned = assignment.status === 'ASSIGNED'
                    const isToday = assignment.assignedDate === todayStr
                    const isLoadingAction = actionLoadingId === assignment.id

                    const shiftTimeStr =
                      assignment.startTime && assignment.endTime
                        ? `${assignment.startTime.slice(0, 5)} - ${assignment.endTime.slice(0, 5)}`
                        : assignment.shift === 'MORNING'
                        ? '06:00 - 14:00'
                        : assignment.shift === 'AFTERNOON'
                        ? '14:00 - 22:00'
                        : assignment.shift === 'NIGHT'
                        ? '22:00 - 06:00'
                        : '08:00 - 17:00'

                    return (
                      <tr key={assignment.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="relative shrink-0">
                              <div className="w-9 h-9 rounded-full bg-slate-800 text-white font-bold flex items-center justify-center text-xs">
                                {(assignment.staffFullName || assignment.staffUsername || 'NV').slice(0, 2).toUpperCase()}
                              </div>
                              <span
                                className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-white ${
                                  isCheckedIn ? 'bg-emerald-500' : isCompleted ? 'bg-slate-400' : 'bg-amber-400'
                                }`}
                              />
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900 text-xs">
                                {assignment.staffFullName || assignment.staffUsername}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono" title={assignment.staffId || assignment.staffUsername}>
                                ID: {assignment.staffId || assignment.staffUsername}
                              </div>
                              <div className="text-[10px] text-slate-500">{assignment.staffEmail}</div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900 font-mono">
                              {formatVN(assignment.assignedDate)}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-500 px-1.5 py-0.5 rounded bg-slate-100">
                              {getDayOfWeekVN(assignment.assignedDate)}
                            </span>
                          </div>
                          {isToday && (
                            <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              Hôm nay
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-800">
                            {assignment.shift === 'MORNING'
                              ? 'Ca Sáng'
                              : assignment.shift === 'AFTERNOON'
                              ? 'Ca Chiều'
                              : assignment.shift === 'NIGHT'
                              ? 'Ca Đêm (Qua đêm)'
                              : 'Cả Ngày'}
                          </div>
                          <div className="text-[11px] text-blue-600 font-mono font-semibold">{shiftTimeStr}</div>
                          {assignment.notes && (
                            <div className="text-[10px] text-slate-500 italic mt-0.5 max-w-xs truncate" title={assignment.notes}>
                              {assignment.notes}
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <div className="text-slate-800 font-medium">{assignment.assignedZone || 'Khu vực quầy tiếp tân'}</div>
                          <span className="inline-block px-2 py-0.5 mt-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-semibold">
                            {assignment.roleInShift || 'PRIMARY_STAFF'}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-center">
                          {isCheckedIn ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-bold text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Đang trực ca
                            </span>
                          ) : isCompleted ? (
                            <span className="inline-block px-2.5 py-0.5 rounded-full font-semibold text-[11px] bg-slate-100 text-slate-700 border border-slate-200">
                              Đã hoàn thành
                            </span>
                          ) : assignment.status === 'CANCELLED' ? (
                            <span className="inline-block px-2.5 py-0.5 rounded-full font-semibold text-[11px] bg-rose-50 text-rose-700 border border-rose-200">
                              Đã hủy ca
                            </span>
                          ) : (
                            <span className="inline-block px-2.5 py-0.5 rounded-full font-semibold text-[11px] bg-amber-50 text-amber-700 border border-amber-200">
                              Chưa vào ca
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-center">
                          {assignment.checkedInAt ? (
                            <div className="text-[11px] font-mono text-emerald-700 font-semibold">
                              Vào: {new Date(assignment.checkedInAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-400 font-mono">Chưa vào</div>
                          )}
                          {assignment.checkedOutAt ? (
                            <div className="text-[11px] font-mono text-slate-600">
                              Ra: {new Date(assignment.checkedOutAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          ) : isCheckedIn ? (
                            <div className="text-[10px] text-emerald-500 font-semibold">Đang trực...</div>
                          ) : null}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Shift Detail Button */}
                            <button
                              type="button"
                              onClick={() => setSelectedAssignmentForDetail(assignment)}
                              className="p-1.5 hover:bg-blue-50 text-slate-500 hover:text-blue-700 rounded-lg transition-colors cursor-pointer"
                              title="Xem chi tiết ca trực"
                            >
                              <span className="material-symbols-outlined text-[16px]">visibility</span>
                            </button>

                            {/* Check-in action ONLY if it is caller's own shift and for TODAY */}
                            {user?.id === assignment.staffId && isAssigned && isToday && (
                              <button
                                type="button"
                                disabled={isLoadingAction}
                                onClick={() => handleCheckIn(assignment)}
                                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                                title="Điểm danh vào ca trực"
                              >
                                <span className="material-symbols-outlined text-[14px]">how_to_reg</span>
                                <span>Vào ca</span>
                              </button>
                            )}

                            {/* Check-out action ONLY if it is caller's own shift */}
                            {user?.id === assignment.staffId && isCheckedIn && (
                              <button
                                type="button"
                                disabled={isLoadingAction}
                                onClick={() => handleCheckOut(assignment)}
                                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                                title="Kết thúc ca làm việc"
                              >
                                <span className="material-symbols-outlined text-[14px]">logout</span>
                                <span>Ra ca</span>
                              </button>
                            )}

                            {/* Request Shift Swap ONLY for own shift */}
                            {user?.id === assignment.staffId && !isCompleted && assignment.status !== 'CANCELLED' && (
                              <button
                                type="button"
                                onClick={() => setSelectedAssignmentForSwap(assignment)}
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-semibold text-[11px] transition-colors cursor-pointer"
                                title="Đổi ca làm việc"
                              >
                                Đổi ca
                              </button>
                            )}

                            {/* Edit assigned shift: FM can edit unstarted shift; BM can edit FM unstarted shift */}
                            {isAssigned && ((isFacilityManager && user?.id !== assignment.staffId) || (isBusinessManager && assignment.roleInShift === 'FACILITY_LEAD')) && (
                              <button
                                type="button"
                                onClick={() => setSelectedAssignmentForEdit(assignment)}
                                className="p-1.5 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-lg transition-colors cursor-pointer"
                                title="Hiệu chỉnh ca trực"
                              >
                                <span className="material-symbols-outlined text-[16px]">edit</span>
                              </button>
                            )}

                            {/* Cancel / Delete assignment */}
                            {isAssigned && ((isFacilityManager && user?.id !== assignment.staffId) || (isBusinessManager && assignment.roleInShift === 'FACILITY_LEAD')) && (
                              <button
                                type="button"
                                disabled={isLoadingAction}
                                onClick={() => handleDeleteAssignment(assignment.id)}
                                className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                                title="Hủy phân công ca này"
                              >
                                <span className="material-symbols-outlined text-[16px]">delete</span>
                              </button>
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

          {/* Pagination - Centered */}
          {filteredAssignments.length > itemsPerPage && (
            <div className="relative flex flex-col md:flex-row items-center justify-between gap-3 pt-3.5 border-t border-slate-100 text-xs text-slate-500">
              <div className="text-center md:text-left">
                Hiển thị <span className="font-semibold text-slate-800 font-mono">{paginatedAssignments.length}</span> trên{' '}
                <span className="font-semibold text-slate-800 font-mono">{filteredAssignments.length}</span> ca trực
              </div>
              <div className="flex items-center justify-center gap-2 md:absolute md:left-1/2 md:-translate-x-1/2">
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-semibold transition-colors"
                >
                  Trang trước
                </button>
                <span className="font-mono font-bold text-slate-900 px-2 py-1 rounded-md bg-slate-100 border border-slate-200">
                  {currentPage} / {totalRosterPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.min(totalRosterPages, p + 1))}
                  disabled={currentPage === totalRosterPages}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-semibold transition-colors"
                >
                  Trang sau
                </button>
              </div>

              <div className="hidden md:block w-28 pointer-events-none" aria-hidden="true" />
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SWAPS (Yêu cầu đổi ca chờ duyệt) */}
      {activeTab === 'SWAPS' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-base font-bold text-slate-900">Quản Lý Đổi Ca Trực</h2>
                <button
                  type="button"
                  id="btn-manager-xin-doi-ca"
                  onClick={() => {
                    const myUpcoming = assignments.find(
                      a => a.staffId === user?.id && a.status !== 'COMPLETED' && a.status !== 'CANCELLED'
                    )
                    setSelectedAssignmentForSwap(myUpcoming || null)
                    setShowManagerSwapModal(true)
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">swap_horiz</span>
                  <span>Xin đổi ca</span>
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Quản lý cơ sở xem xét, phê duyệt hoặc xin đổi ca trực với Quản lý cơ sở khác (Facility Manager chỉ đổi với Facility Manager)
              </p>
            </div>
          </div>

          {swapRequests.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              Hiện tại không có yêu cầu đổi ca nào tại chi nhánh này.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="py-3 px-4">Người yêu cầu</th>
                    <th className="py-3 px-4">Ca xin đổi</th>
                    <th className="py-3 px-4">Người tiếp nhận</th>
                    <th className="py-3 px-4">Lý do</th>
                    <th className="py-3 px-4 text-center">Trạng thái</th>
                    <th className="py-3 px-4 text-right">Phê duyệt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {swapRequests.map(swap => {
                    const isPending = swap.status === 'PENDING'
                    const isManagerApproved = swap.status === 'MANAGER_APPROVED'
                    const isApproved = swap.status === 'APPROVED'
                    const isRejected = swap.status === 'REJECTED'
                    const isCancelled = swap.status === 'CANCELLED'
                    const isLoadingAction = actionLoadingId === swap.id

                    return (
                      <tr key={swap.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{swap.requesterName || swap.requesterUsername}</div>
                          <div className="text-[10px] text-slate-400">{swap.requesterEmail}</div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-semibold text-blue-700">{swap.assignmentShift}</div>
                          <div className="text-[11px] text-slate-500 font-mono">{swap.assignmentDate}</div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{swap.targetStaffName || swap.targetStaffUsername}</div>
                          <div className="text-[10px] text-slate-400">{swap.targetStaffEmail}</div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="text-slate-700 max-w-xs truncate" title={swap.reason}>
                            {swap.reason}
                          </div>
                          {swap.managerNotes && (
                            <div className="text-[10px] text-emerald-700 italic">Ý kiến QL: {swap.managerNotes}</div>
                          )}
                          {swap.targetStaffNotes && (
                            <div className="text-[10px] text-blue-700 italic">Ghi chú nhân sự nhận: {swap.targetStaffNotes}</div>
                          )}
                        </td>

                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-[11px] border ${
                              isApproved
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : isManagerApproved
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : isPending
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : isRejected
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-slate-50 text-slate-600 border-slate-200'
                            }`}
                          >
                            {isApproved
                              ? 'Đã hoàn tất đổi ca'
                              : isManagerApproved
                              ? 'QL đã duyệt • Chờ NV xác nhận'
                              : isPending
                              ? 'Chờ Quản lý duyệt'
                              : isRejected
                              ? 'Đã từ chối'
                              : 'Đã hủy'}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right">
                          {isPending && (
                            swap.requesterId === user?.id || swap.targetStaffId === user?.id ? (
                              <span className="text-[11px] font-semibold text-slate-400 italic">
                                Đơn cá nhân (Chờ cấp trên duyệt)
                              </span>
                            ) : (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  disabled={isLoadingAction}
                                  onClick={() => handleReviewSwap(swap.id, 'APPROVED')}
                                  title="Duyệt đơn và chuyển tiếp tới nhân sự tiếp nhận xác nhận"
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                                >
                                  <span className="material-symbols-outlined text-[15px]">send</span>
                                  <span>Duyệt &amp; Chuyển NV</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={isLoadingAction}
                                  onClick={() => handleReviewSwap(swap.id, 'REJECTED')}
                                  className="px-3 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-600 rounded-lg font-semibold text-xs transition-colors cursor-pointer"
                                >
                                  Từ chối
                                </button>
                              </div>
                            )
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: HANDOVERS (Biên bản bàn giao ca) */}
      {activeTab === 'HANDOVERS' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Biên Bản Bàn Giao Ca Trực</h2>
              <p className="text-xs text-slate-500">Đối soát công việc tồn đọng, sự cố chưa đóng và quỹ tiền mặt quầy</p>
            </div>
            <button
              type="button"
              onClick={() => setShowHandoverModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer self-start sm:self-auto"
            >
              <span className="material-symbols-outlined text-[18px]">add_task</span>
              <span>Lập biên bản bàn giao ca</span>
            </button>
          </div>

          {handovers.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              Chưa có biên bản bàn giao ca nào tại cơ sở này.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="py-3 px-4">Ngày &amp; Ca</th>
                    <th className="py-3 px-4">Người giao &rarr; Người nhận</th>
                    <th className="py-3 px-4">Việc tồn đọng &amp; Sự cố</th>
                    <th className="py-3 px-4 text-right">Tiền két quầy</th>
                    <th className="py-3 px-4 text-center">Trạng thái</th>
                    <th className="py-3 px-4 text-right">Tiếp nhận</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {handovers.map(h => {
                    const isAck = h.status === 'ACKNOWLEDGED'
                    const isLoadingAction = actionLoadingId === h.id

                    return (
                      <tr key={h.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{h.shift}</div>
                          <div className="text-[11px] text-slate-500 font-mono">{h.handoverDate}</div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-800">
                            <strong>{h.outgoingStaffName || h.outgoingStaffUsername}</strong>
                          </div>
                          <div className="text-slate-500 text-[11px] flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                            <span>{h.incomingStaffName || h.incomingStaffUsername || '(Chưa chỉ định)'}</span>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="text-slate-800 max-w-sm truncate" title={h.pendingTasks || 'Không có việc tồn đọng'}>
                            {h.pendingTasks || 'Không có việc tồn đọng'}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            Ticket: <strong className="text-rose-600">{h.pendingTicketsCount}</strong> • Đơn chờ: <strong className="text-blue-600">{h.unresolvedBookingsCount}</strong>
                          </div>
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                          {Number(h.cashInDrawer || 0).toLocaleString('vi-VN')} đ
                        </td>

                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-[11px] border ${
                              isAck
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {isAck ? 'Đã nhận ca' : 'Chờ nhận ca'}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right">
                          {!isAck && (
                            <button
                              type="button"
                              disabled={isLoadingAction}
                              onClick={() => handleAcknowledgeHandover(h.id)}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs transition-colors cursor-pointer"
                            >
                              Xác nhận tiếp nhận
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: STAFF DIRECTORY (Danh bạ nhân sự cơ sở) */}
      {activeTab === 'STAFF' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Danh Sách Nhân Viên Tại {currentFacilityName}</h2>
              <p className="text-xs text-slate-500">Mã nhân sự định danh duy nhất theo tài khoản hệ thống (không bị lặp e0000000)</p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-3 px-4">Mã nhân viên</th>
                  <th className="py-3 px-4">Họ và tên</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Số điện thoại</th>
                  <th className="py-3 px-4 text-center">Trạng thái tài khoản</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staffList.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-blue-700" title={s.id}>
                      {s.id || s.username}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {s.fullName || s.username}
                    </td>
                    <td className="py-3 px-4 text-slate-700">{s.email}</td>
                    <td className="py-3 px-4 text-slate-500 font-mono">{s.phone || 'Chưa cập nhật'}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-block px-2.5 py-0.5 rounded-full font-semibold text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Đang hoạt động
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Shift Assignment */}
      {showShiftModal && (
        <ShiftAssignmentModal
          isOpen={showShiftModal}
          onClose={() => setShowShiftModal(false)}
          facilityId={selectedFacilityId === 'ALL' ? undefined : selectedFacilityId}
          facilities={facilities}
          targetRole={isBusinessManager ? 'FACILITY_MANAGER' : 'STAFF'}
          onSaveShift={summary => {
            showToast(`Phân công ca trực thành công: ${summary}`)
            setShowShiftModal(false)
            fetchData()
          }}
        />
      )}

      {/* Modal: Shift Swap Request */}
      {selectedAssignmentForSwap && (
        <ShiftSwapModal
          isOpen={Boolean(selectedAssignmentForSwap)}
          onClose={() => setSelectedAssignmentForSwap(null)}
          assignment={selectedAssignmentForSwap}
          facilityId={selectedFacilityId}
          onSuccess={msg => {
            showToast(msg)
            setSelectedAssignmentForSwap(null)
            fetchData()
          }}
        />
      )}

      {/* Modal: Shift Handover */}
      {showHandoverModal && (
        <ShiftHandoverModal
          isOpen={showHandoverModal}
          onClose={() => setShowHandoverModal(false)}
          facilityId={selectedFacilityId}
          facilityName={currentFacilityName}
          currentShift="MORNING"
          onSuccess={msg => {
            showToast(msg)
            setShowHandoverModal(false)
            fetchData()
          }}
        />
      )}

      {/* Modal: Shift Detail (Section 4.3 Requirement) */}
      {selectedAssignmentForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-8">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-[22px]">info</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">Chi Tiết Ca Làm Việc</h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        selectedAssignmentForDetail.status === 'CHECKED_IN'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : selectedAssignmentForDetail.status === 'COMPLETED'
                          ? 'bg-slate-100 text-slate-700 border-slate-200'
                          : selectedAssignmentForDetail.status === 'CANCELLED'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      {selectedAssignmentForDetail.status === 'CHECKED_IN'
                        ? 'Đang trực ca'
                        : selectedAssignmentForDetail.status === 'COMPLETED'
                        ? 'Đã hoàn thành'
                        : selectedAssignmentForDetail.status === 'CANCELLED'
                        ? 'Đã hủy ca'
                        : 'Chưa vào ca'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono">
                    Mã ca: {selectedAssignmentForDetail.id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAssignmentForDetail(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 text-xs">
              {/* Staff Info Grid */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Nhân sự phụ trách
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-800 text-white font-bold flex items-center justify-center text-sm">
                    {(selectedAssignmentForDetail.staffFullName || selectedAssignmentForDetail.staffUsername || 'NV').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 text-sm">
                      {selectedAssignmentForDetail.staffFullName || selectedAssignmentForDetail.staffUsername}
                    </div>
                    <div className="text-slate-500">{selectedAssignmentForDetail.staffEmail}</div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      Mã định danh: {selectedAssignmentForDetail.staffId || selectedAssignmentForDetail.staffUsername}
                    </div>
                  </div>
                </div>
              </div>

              {/* Shift & Time Details */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                  <div className="text-slate-400 text-[10px] font-bold uppercase">Ngày làm việc</div>
                  <div className="font-bold text-slate-900 text-xs mt-1 font-mono">
                    {getDayOfWeekVN(selectedAssignmentForDetail.assignedDate)}, {formatVN(selectedAssignmentForDetail.assignedDate)}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                  <div className="text-slate-400 text-[10px] font-bold uppercase">Ca &amp; Khung giờ</div>
                  <div className="font-bold text-blue-700 text-xs mt-1">
                    {selectedAssignmentForDetail.shift === 'MORNING'
                      ? 'Ca Sáng (06:00 - 14:00)'
                      : selectedAssignmentForDetail.shift === 'AFTERNOON'
                      ? 'Ca Chiều (14:00 - 22:00)'
                      : selectedAssignmentForDetail.shift === 'NIGHT'
                      ? 'Ca Đêm (22:00 - 06:00)'
                      : 'Cả Ngày (08:00 - 17:00)'}
                  </div>
                </div>
              </div>

              {/* Facility & Location Details */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                  <div className="text-slate-400 text-[10px] font-bold uppercase">Cơ sở kho</div>
                  <div className="font-semibold text-slate-900 text-xs mt-1">
                    {selectedAssignmentForDetail.facilityName || currentFacilityName}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                  <div className="text-slate-400 text-[10px] font-bold uppercase">Phân khu &amp; Vai trò</div>
                  <div className="font-semibold text-slate-900 text-xs mt-1">
                    {selectedAssignmentForDetail.assignedZone || 'Quầy tiếp tân'} • {selectedAssignmentForDetail.roleInShift || 'PRIMARY_STAFF'}
                  </div>
                </div>
              </div>

              {/* Attendance Actual Log */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Nhật ký chấm công thực tế
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500">Giờ vào thực tế:</span>{' '}
                    <strong className="text-emerald-700 font-mono">
                      {formatDateTime(selectedAssignmentForDetail.checkedInAt)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Giờ ra thực tế:</span>{' '}
                    <strong className="text-blue-700 font-mono">
                      {formatDateTime(selectedAssignmentForDetail.checkedOutAt)}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Notes / Instructions */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Ghi chú &amp; Chỉ dẫn công việc
                </div>
                <p className="text-slate-700 leading-relaxed italic">
                  {selectedAssignmentForDetail.notes || 'Không có chỉ dẫn đặc biệt.'}
                </p>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                {user?.id === selectedAssignmentForDetail.staffId &&
                  selectedAssignmentForDetail.status === 'ASSIGNED' &&
                  selectedAssignmentForDetail.assignedDate === todayStr && (
                  <button
                    type="button"
                    onClick={() => {
                      const a = selectedAssignmentForDetail
                      setSelectedAssignmentForDetail(null)
                      handleCheckIn(a)
                    }}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">how_to_reg</span>
                    <span>Check-in ca của bạn</span>
                  </button>
                )}
                {user?.id === selectedAssignmentForDetail.staffId && selectedAssignmentForDetail.status === 'CHECKED_IN' && (
                  <button
                    type="button"
                    onClick={() => {
                      const a = selectedAssignmentForDetail
                      setSelectedAssignmentForDetail(null)
                      handleCheckOut(a)
                    }}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-bold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">logout</span>
                    <span>Check-out kết thúc ca</span>
                  </button>
                )}
                {user?.id === selectedAssignmentForDetail.staffId && selectedAssignmentForDetail.status !== 'COMPLETED' && selectedAssignmentForDetail.status !== 'CANCELLED' && (
                  <button
                    type="button"
                    onClick={() => {
                      const a = selectedAssignmentForDetail
                      setSelectedAssignmentForDetail(null)
                      setSelectedAssignmentForSwap(a)
                    }}
                    className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-semibold text-xs cursor-pointer"
                  >
                    Đổi ca làm
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setSelectedAssignmentForDetail(null)}
                className="px-4 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg font-bold text-xs cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Shift */}
      {selectedAssignmentForEdit && (
        <ShiftEditModal
          isOpen={Boolean(selectedAssignmentForEdit)}
          assignment={selectedAssignmentForEdit}
          onClose={() => setSelectedAssignmentForEdit(null)}
          onSave={msg => {
            showToast(msg)
            setSelectedAssignmentForEdit(null)
            fetchData()
          }}
        />
      )}

      {/* MODAL: SHIFT SWAP MODAL */}
      {(showManagerSwapModal || selectedAssignmentForSwap) && (
        <ShiftSwapModal
          isOpen={showManagerSwapModal || !!selectedAssignmentForSwap}
          onClose={() => {
            setShowManagerSwapModal(false)
            setSelectedAssignmentForSwap(null)
          }}
          assignment={selectedAssignmentForSwap}
          facilityId={selectedFacilityId || user?.facilityId}
          targetRole={
            showManagerSwapModal || selectedAssignmentForSwap?.staffId === user?.id
              ? 'FACILITY_MANAGER'
              : 'STAFF'
          }
          availableAssignments={
            showManagerSwapModal
              ? assignments.filter(
                  a => a.staffId === user?.id && a.status !== 'COMPLETED' && a.status !== 'CANCELLED'
                )
              : undefined
          }
          onSuccess={msg => {
            showToast(msg)
            void fetchData()
          }}
        />
      )}
    </div>
  )
}
