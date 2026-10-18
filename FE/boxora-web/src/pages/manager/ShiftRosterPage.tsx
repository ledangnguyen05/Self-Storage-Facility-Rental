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
import { User, Facility } from '../../types'
import { ShiftAssignmentModal } from './modals/ShiftAssignmentModal'
import { ShiftSwapModal } from './modals/ShiftSwapModal'
import { ShiftHandoverModal } from './modals/ShiftHandoverModal'

export const ShiftRosterPage: React.FC = () => {
  const { user } = useAuth()
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>('')
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0])
  const [activeTab, setActiveTab] = useState<'ROSTER' | 'SWAPS' | 'HANDOVERS' | 'STAFF'>('ROSTER')

  // Real Data States
  const [assignments, setAssignments] = useState<StaffAssignmentResponse[]>([])
  const [swapRequests, setSwapRequests] = useState<ShiftSwapRequest[]>([])
  const [handovers, setHandovers] = useState<ShiftHandover[]>([])
  const [staffList, setStaffList] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('')
  const [filterShift, setFilterShift] = useState<string>('ALL')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 8

  // Modals & Action States
  const [showShiftModal, setShowShiftModal] = useState(false)
  const [selectedAssignmentForSwap, setSelectedAssignmentForSwap] = useState<StaffAssignmentResponse | null>(null)
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
        if (userFacId && facs.some(f => f.id === userFacId)) {
          setSelectedFacilityId(userFacId)
        } else if (facs.length > 0) {
          setSelectedFacilityId(facs[0].id)
        }
      } catch (err) {
        console.warn('Failed to load facilities:', err)
      }
    }
    loadFacilities()
  }, [user])

  // Fetch all operational data for selected facility & date
  const fetchData = async () => {
    if (!selectedFacilityId) return
    setIsLoading(true)
    try {
      // 1. Daily board assignments
      const assignRes = await staffAssignmentService.getDailyBoard(selectedFacilityId, selectedDate)
      setAssignments(assignRes || [])

      // 2. Facility staff list
      const staffRes = await userService.getAllUsers({
        role: 'STAFF',
        facilityId: selectedFacilityId,
        size: 100
      })
      setStaffList(staffRes.data || [])

      // 3. Shift swap requests
      const swapRes = await staffAssignmentService.getSwapRequests({
        facilityId: selectedFacilityId,
        size: 50
      })
      setSwapRequests(swapRes?.content || swapRes || [])

      // 4. Recent shift handovers
      const handoverRes = await staffAssignmentService.getRecentFacilityHandovers(selectedFacilityId)
      setHandovers(handoverRes || [])
    } catch (err) {
      console.warn('Failed to load shift roster data:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [selectedFacilityId, selectedDate])

  const currentFacility = useMemo(() => {
    return facilities.find(f => f.id === selectedFacilityId)
  }, [facilities, selectedFacilityId])

  const currentFacilityName = currentFacility?.name || 'Cơ sở Boxora'

  // Real KPI calculations from DB data
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
        a.assignedZone?.toLowerCase().includes(searchTerm.toLowerCase())

      if (!matchSearch) return false
      if (filterShift !== 'ALL' && a.shift !== filterShift) return false
      return true
    })
  }, [assignments, searchTerm, filterShift])

  // Pagination for Roster
  const totalRosterPages = Math.ceil(filteredAssignments.length / itemsPerPage) || 1
  const paginatedAssignments = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredAssignments.slice(start, start + itemsPerPage)
  }, [filteredAssignments, currentPage, itemsPerPage])

  return (
    <div className="flex flex-col gap-6 w-full text-left">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl border border-slate-700 flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <span className="material-symbols-outlined text-emerald-400">check_circle</span>
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[28px]">schedule</span>
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Xử Lý Trực Ca &amp; Điều Phối Nhân Sự
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                {currentFacilityName}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Điều phối ca trực quầy tiếp đón, kiểm tra buồng kho, chấm công vào/ra ca, đổi ca và biên bản bàn giao
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Facility Picker */}
          {facilities.length > 1 && (
            <select
              value={selectedFacilityId}
              onChange={e => {
                setSelectedFacilityId(e.target.value)
                setCurrentPage(1)
              }}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-slate-400"
            >
              {facilities.map(f => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          )}

          {/* Date Picker */}
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-slate-400"
          />

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

          <button
            type="button"
            onClick={() => setShowShiftModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            <span>Phân công ca mới</span>
          </button>
        </div>
      </div>

      {/* 4 KPI Cards - Strictly Real DB Data */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Tổng nhân sự cơ sở</span>
            <div className="p-1.5 rounded-lg bg-slate-100 text-slate-700">
              <span className="material-symbols-outlined text-[18px]">group</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {totalStaffCount}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Nhân viên thuộc biên chế chi nhánh này
            </div>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Đang trực ca (Checked-in)</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <span className="material-symbols-outlined text-[18px]">how_to_reg</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-emerald-700 tracking-tight flex items-center gap-2">
              <span>{checkedInCount}</span>
              {checkedInCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Đã điểm danh vào ca và đang có mặt tại quầy
            </div>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Chưa vào ca / Chờ trực</span>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <span className="material-symbols-outlined text-[18px]">pending_actions</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-amber-700 tracking-tight">
              {assignedCount}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Được phân công hôm nay, chưa tới giờ check-in
            </div>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Khung ca trực hôm nay</span>
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <span className="material-symbols-outlined text-[18px]">calendar_view_day</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-blue-700 tracking-tight">
              {distinctShiftsCount} khung ca
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {completedCount} ca đã hoàn thành • {pendingSwapCount} yêu cầu đổi ca
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
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
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2 flex-wrap">
              {(['ALL', 'MORNING', 'AFTERNOON', 'NIGHT'] as const).map(sh => {
                const label =
                  sh === 'ALL'
                    ? 'Tất cả ca'
                    : sh === 'MORNING'
                    ? 'Ca Sáng'
                    : sh === 'AFTERNOON'
                    ? 'Ca Chiều'
                    : 'Ca Đêm'
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

            <div className="relative w-full sm:w-64">
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
                placeholder="Tìm nhân sự, email, khu vực..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-500 focus:bg-white"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-3 px-4">Nhân sự trực ca</th>
                  <th className="py-3 px-4">Ca &amp; Khung giờ làm</th>
                  <th className="py-3 px-4">Phân khu &amp; Vai trò</th>
                  <th className="py-3 px-4 text-center">Trạng thái chấm công</th>
                  <th className="py-3 px-4 text-right">Tác vụ điều phối</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      <span className="material-symbols-outlined text-3xl animate-spin mb-1">progress_activity</span>
                      <p>Đang tải lịch phân công ca trực...</p>
                    </td>
                  </tr>
                ) : filteredAssignments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      Chưa có ca trực nào được phân công tại cơ sở này trong ngày {selectedDate}.
                    </td>
                  </tr>
                ) : (
                  paginatedAssignments.map(assignment => {
                    const isCheckedIn = assignment.status === 'CHECKED_IN'
                    const isCompleted = assignment.status === 'COMPLETED'
                    const isAssigned = assignment.status === 'ASSIGNED'
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
                              <div className="text-[10px] text-slate-400 font-mono">
                                NV-{assignment.staffUsername || assignment.staffId?.slice(-6).toUpperCase()}
                              </div>
                              <div className="text-[10px] text-slate-500">{assignment.staffEmail}</div>
                            </div>
                          </div>
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
                            <div className="flex flex-col items-center">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-bold text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Đang trực ca
                              </span>
                              {assignment.checkedInAt && (
                                <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                                  Vào: {new Date(assignment.checkedInAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                            </div>
                          ) : isCompleted ? (
                            <div className="flex flex-col items-center">
                              <span className="inline-block px-2.5 py-0.5 rounded-full font-semibold text-[11px] bg-slate-100 text-slate-700 border border-slate-200">
                                Đã hoàn thành
                              </span>
                              {assignment.checkedOutAt && (
                                <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                                  Ra: {new Date(assignment.checkedOutAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="inline-block px-2.5 py-0.5 rounded-full font-semibold text-[11px] bg-amber-50 text-amber-700 border border-amber-200">
                              Chưa vào ca
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Check-in action if not checked in */}
                            {isAssigned && (
                              <button
                                type="button"
                                disabled={isLoadingAction}
                                onClick={() => handleCheckIn(assignment)}
                                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                                title="Điểm danh vào ca trực"
                              >
                                <span className="material-symbols-outlined text-[14px]">how_to_reg</span>
                                <span>Check-in</span>
                              </button>
                            )}

                            {/* Check-out action if currently checked in */}
                            {isCheckedIn && (
                              <button
                                type="button"
                                disabled={isLoadingAction}
                                onClick={() => handleCheckOut(assignment)}
                                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                                title="Kết thúc ca làm việc"
                              >
                                <span className="material-symbols-outlined text-[14px]">logout</span>
                                <span>Check-out</span>
                              </button>
                            )}

                            {/* Request Shift Swap */}
                            {!isCompleted && (
                              <button
                                type="button"
                                onClick={() => setSelectedAssignmentForSwap(assignment)}
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-semibold text-[11px] transition-colors cursor-pointer"
                                title="Đổi ca làm việc"
                              >
                                Đổi ca
                              </button>
                            )}

                            {/* Cancel / Delete assignment */}
                            {isAssigned && (
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

          {/* Pagination */}
          {filteredAssignments.length > itemsPerPage && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
              <div>
                Hiển thị <span className="font-semibold text-slate-800 font-mono">{paginatedAssignments.length}</span> trên{' '}
                <span className="font-semibold text-slate-800 font-mono">{filteredAssignments.length}</span> ca trực
              </div>
              <div className="flex items-center gap-2 sm:ml-auto">
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-semibold transition-colors"
                >
                  Trang trước
                </button>
                <span className="font-mono font-bold text-slate-900 px-1">
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
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SWAPS (Yêu cầu đổi ca chờ duyệt) */}
      {activeTab === 'SWAPS' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Danh Sách Yêu Cầu Đổi Ca Trực</h2>
              <p className="text-xs text-slate-500">Quản lý cơ sở xem xét và phê duyệt hoặc từ chối các yêu cầu đổi ca</p>
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
                    const isApproved = swap.status === 'APPROVED'
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
                            <div className="text-[10px] text-emerald-700 italic">Ý kiến: {swap.managerNotes}</div>
                          )}
                        </td>

                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-[11px] border ${
                              isApproved
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : isPending
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}
                          >
                            {isApproved ? 'Đã duyệt' : isPending ? 'Chờ duyệt' : 'Từ chối'}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right">
                          {isPending && (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                disabled={isLoadingAction}
                                onClick={() => handleReviewSwap(swap.id, 'APPROVED')}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs transition-colors cursor-pointer"
                              >
                                Duyệt
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
                    <td className="py-3 px-4 font-mono font-bold text-blue-700">
                      NV-{s.username || s.id?.slice(-6).toUpperCase()}
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
          facilityId={selectedFacilityId}
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
    </div>
  )
}
