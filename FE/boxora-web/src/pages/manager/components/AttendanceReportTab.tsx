import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  staffAssignmentService,
  StaffAssignmentResponse,
  isShiftAbsent,
  isShiftForgottenCheckout,
  calculateShiftWorkHours
} from '../../../services/staffAssignmentService'
import { BOXORA_SHIFTS } from '../../../constants/shiftConstants'
import { User } from '../../../types'

interface AttendanceReportTabProps {
  facilityId?: string
  facilityName?: string
  staffList: User[]
  currentUserName?: string
}

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
    const days = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']
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

const formatTimeOnly = (dtStr?: string | null): string => {
  if (!dtStr) return '—'
  try {
    const d = new Date(dtStr)
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return dtStr.slice(11, 16) || dtStr
  }
}

export const AttendanceReportTab: React.FC<AttendanceReportTabProps> = ({
  facilityId,
  facilityName = 'Cơ sở Boxora',
  staffList,
  currentUserName = 'Quản lý cơ sở'
}) => {
  // Preset time range helpers
  const today = useMemo(() => new Date(), [])
  const todayStr = useMemo(() => formatDateLocal(today), [today])

  const [filterMode, setFilterMode] = useState<'THIS_WEEK' | 'THIS_MONTH' | 'LAST_MONTH' | 'CUSTOM'>('THIS_MONTH')

  // Date range states
  const [fromDate, setFromDate] = useState<string>(() => {
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
    return formatDateLocal(firstDay)
  })
  const [toDate, setToDate] = useState<string>(() => {
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    return formatDateLocal(lastDay)
  })

  const [selectedStaffId, setSelectedStaffId] = useState<string>('ALL')
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL')
  const [assignments, setAssignments] = useState<StaffAssignmentResponse[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [printDate, setPrintDate] = useState<string>('')

  // Quick preset switch
  const handlePresetChange = (mode: 'THIS_WEEK' | 'THIS_MONTH' | 'LAST_MONTH' | 'CUSTOM') => {
    setFilterMode(mode)
    const now = new Date()

    if (mode === 'THIS_WEEK') {
      const day = now.getDay()
      const diffToMon = day === 0 ? -6 : 1 - day
      const mon = new Date(now)
      mon.setDate(now.getDate() + diffToMon)
      const sun = new Date(mon)
      sun.setDate(mon.getDate() + 6)
      setFromDate(formatDateLocal(mon))
      setToDate(formatDateLocal(sun))
    } else if (mode === 'THIS_MONTH') {
      const first = new Date(now.getFullYear(), now.getMonth(), 1)
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      setFromDate(formatDateLocal(first))
      setToDate(formatDateLocal(last))
    } else if (mode === 'LAST_MONTH') {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const last = new Date(now.getFullYear(), now.getMonth(), 0)
      setFromDate(formatDateLocal(first))
      setToDate(formatDateLocal(last))
    }
  }

  // Fetch assignments with range
  const fetchAttendanceData = useCallback(async () => {
    if (!facilityId) return
    setIsLoading(true)
    try {
      const res = await staffAssignmentService.getAllAssignments({
        facilityId,
        fromDate,
        toDate,
        size: 500
      })
      setAssignments(res.content || [])
    } catch (err) {
      console.error('Lỗi tải dữ liệu chấm công:', err)
      setAssignments([])
    } finally {
      setIsLoading(false)
    }
  }, [facilityId, fromDate, toDate])

  useEffect(() => {
    fetchAttendanceData()
  }, [fetchAttendanceData])

  // Filtered list
  const filteredList = useMemo(() => {
    return assignments.filter(a => {
      if (selectedStaffId !== 'ALL' && a.staffId !== selectedStaffId) {
        return false
      }
      if (selectedStatus === 'COMPLETED') {
        return a.status === 'COMPLETED'
      }
      if (selectedStatus === 'FORGOTTEN_CHECKOUT') {
        return isShiftForgottenCheckout(a)
      }
      if (selectedStatus === 'ABSENT') {
        return isShiftAbsent(a) && !isShiftForgottenCheckout(a)
      }
      if (selectedStatus === 'CHECKED_IN') {
        return a.status === 'CHECKED_IN' && !isShiftForgottenCheckout(a)
      }
      return true
    })
  }, [assignments, selectedStaffId, selectedStatus])

  // Summary Metrics
  const metrics = useMemo(() => {
    let totalAssigned = filteredList.length
    let completed = 0
    let forgottenCheckout = 0
    let absentUnchecked = 0
    let onDuty = 0
    let totalWorkHours = 0

    filteredList.forEach(a => {
      const isForgotten = isShiftForgottenCheckout(a)
      const isAbsentShift = isShiftAbsent(a)

      if (a.status === 'COMPLETED') {
        completed++
        totalWorkHours += calculateShiftWorkHours(a)
      } else if (isForgotten) {
        forgottenCheckout++
      } else if (isAbsentShift) {
        absentUnchecked++
      } else if (a.status === 'CHECKED_IN') {
        onDuty++
      }
    })

    const totalAbsent = forgottenCheckout + absentUnchecked
    const attendanceRate = totalAssigned > 0 ? Math.round((completed / totalAssigned) * 100) : 100

    return {
      totalAssigned,
      completed,
      forgottenCheckout,
      absentUnchecked,
      totalAbsent,
      onDuty,
      totalWorkHours: Math.round(totalWorkHours * 10) / 10,
      attendanceRate
    }
  }, [filteredList])

  // Handle Print Action
  const handlePrint = () => {
    setPrintDate(new Date().toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }))
    setTimeout(() => {
      window.print()
    }, 150)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Print CSS Styles injected dynamically */}
      <style>{`
        @media print {
          /* Hide non-printable app shell */
          body * {
            visibility: hidden;
          }
          #printable-attendance-area, #printable-attendance-area * {
            visibility: visible;
          }
          #printable-attendance-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 16px;
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
          @page {
            size: A4 portrait;
            margin: 12mm 10mm 15mm 10mm;
          }
        }
      `}</style>

      {/* Screen View: Controls & Filters (no-print) */}
      <div className="no-print bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[24px] text-blue-600">fact_check</span>
              <h2 className="text-lg font-bold text-slate-900">Bảng Chấm Công &amp; Báo Cáo Nhân Sự</h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Theo dõi chấm công thực tế, tính giờ làm, xử lý ca quên ra ca và xuất báo cáo in ấn chuyên nghiệp.
            </p>
          </div>

          {/* Print Button */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handlePrint}
              disabled={filteredList.length === 0}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">print</span>
              <span>In Báo Cáo Chấm Công</span>
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          {/* Quick Preset Buttons */}
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <label className="font-bold text-slate-700">Kỳ chấm công:</label>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => handlePresetChange('THIS_WEEK')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                  filterMode === 'THIS_WEEK'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Tuần này
              </button>
              <button
                type="button"
                onClick={() => handlePresetChange('THIS_MONTH')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                  filterMode === 'THIS_MONTH'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Tháng này
              </button>
              <button
                type="button"
                onClick={() => handlePresetChange('LAST_MONTH')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                  filterMode === 'LAST_MONTH'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Tháng trước
              </button>
              <button
                type="button"
                onClick={() => handlePresetChange('CUSTOM')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                  filterMode === 'CUSTOM'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Tùy chọn
              </button>
            </div>
          </div>

          {/* Date Picker (Range) */}
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-slate-700">Từ ngày – Đến ngày:</label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={fromDate}
                onChange={e => {
                  setFromDate(e.target.value)
                  setFilterMode('CUSTOM')
                }}
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-slate-800 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-slate-400">–</span>
              <input
                type="date"
                value={toDate}
                onChange={e => {
                  setToDate(e.target.value)
                  setFilterMode('CUSTOM')
                }}
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-slate-800 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Staff Filter Dropdown */}
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-slate-700">Lọc theo nhân viên:</label>
            <select
              value={selectedStaffId}
              onChange={e => setSelectedStaffId(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-slate-800 font-medium text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
            >
              <option value="ALL">Tất cả nhân sự ({staffList.length})</option>
              {staffList.map(s => (
                <option key={s.id} value={s.id}>
                  {s.fullName || s.username} ({s.email})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Status Quick Filter Buttons */}
        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-100 text-xs">
          <span className="font-bold text-slate-500 mr-1">Trạng thái công:</span>
          <button
            type="button"
            onClick={() => setSelectedStatus('ALL')}
            className={`px-3 py-1 rounded-full font-bold transition-colors cursor-pointer ${
              selectedStatus === 'ALL'
                ? 'bg-slate-800 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Tất cả ({assignments.length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedStatus('COMPLETED')}
            className={`px-3 py-1 rounded-full font-bold transition-colors cursor-pointer ${
              selectedStatus === 'COMPLETED'
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            Hợp lệ ({assignments.filter(a => a.status === 'COMPLETED').length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedStatus('FORGOTTEN_CHECKOUT')}
            className={`px-3 py-1 rounded-full font-bold transition-colors cursor-pointer ${
              selectedStatus === 'FORGOTTEN_CHECKOUT'
                ? 'bg-rose-600 text-white'
                : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
            }`}
          >
            Quên ra ca / 0 công ({assignments.filter(a => isShiftForgottenCheckout(a)).length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedStatus('ABSENT')}
            className={`px-3 py-1 rounded-full font-bold transition-colors cursor-pointer ${
              selectedStatus === 'ABSENT'
                ? 'bg-slate-600 text-white'
                : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'
            }`}
          >
            Không vào ca ({assignments.filter(a => isShiftAbsent(a) && !isShiftForgottenCheckout(a)).length})
          </button>
        </div>

        {/* Note Quy định Chấm công */}
        <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-2.5">
          <span className="material-symbols-outlined text-[18px] text-amber-600 shrink-0 mt-0.5">info</span>
          <div>
            <strong>Quy định chấm công tự động:</strong> Nhân viên được phân ca phải bấm <em>"Vào ca"</em> và <em>"Ra ca"</em> đầy đủ.
            Trường hợp đã vào ca nhưng <strong>quên bấm Ra ca trước 23:59:59 của ngày làm việc</strong>, hệ thống sẽ tự động ghi nhận là <strong>Không đi làm (Vắng mặt - 0.0 giờ công)</strong>.
          </div>
        </div>
      </div>

      {/* KPI Cards on Screen (no-print) */}
      <div className="no-print grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tổng số ca</span>
          <span className="text-2xl font-black text-slate-900 mt-1">{metrics.totalAssigned}</span>
          <span className="text-[11px] text-slate-500 mt-1">Kỳ: {formatVN(fromDate)} - {formatVN(toDate)}</span>
        </div>

        <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-200 shadow-xs flex flex-col">
          <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Hoàn thành hợp lệ</span>
          <span className="text-2xl font-black text-emerald-700 mt-1">{metrics.completed}</span>
          <span className="text-[11px] text-emerald-600 mt-1">Đầy đủ vào &amp; ra ca</span>
        </div>

        <div className="p-4 bg-rose-50/70 rounded-2xl border border-rose-200 shadow-xs flex flex-col">
          <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">Quên ra ca (0 công)</span>
          <span className="text-2xl font-black text-rose-700 mt-1">{metrics.forgottenCheckout}</span>
          <span className="text-[11px] text-rose-600 mt-1">Quá 23:59:59 ngày làm</span>
        </div>

        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 shadow-xs flex flex-col">
          <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Không vào ca</span>
          <span className="text-2xl font-black text-slate-700 mt-1">{metrics.absentUnchecked}</span>
          <span className="text-[11px] text-slate-500 mt-1">Vắng mặt không phép</span>
        </div>

        <div className="p-4 bg-blue-50/60 rounded-2xl border border-blue-200 shadow-xs flex flex-col col-span-2 md:col-span-1">
          <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">Tổng giờ công ghi nhận</span>
          <span className="text-2xl font-black text-blue-700 mt-1">{metrics.totalWorkHours} <span className="text-sm font-bold">giờ</span></span>
          <span className="text-[11px] text-blue-600 mt-1">Chuyên cần: {metrics.attendanceRate}%</span>
        </div>
      </div>

      {/* Screen Table (no-print) */}
      <div className="no-print bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <span className="font-bold text-slate-800 text-xs">
            Bảng chi tiết chấm công ({filteredList.length} ca trực)
          </span>
          {isLoading && (
            <span className="text-xs text-blue-600 flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
              Đang làm mới dữ liệu...
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
              <tr>
                <th className="py-3 px-4 w-12 text-center">STT</th>
                <th className="py-3 px-4">Ngày làm</th>
                <th className="py-3 px-4">Nhân sự</th>
                <th className="py-3 px-4">Ca quy định</th>
                <th className="py-3 px-4">Check-in thực tế</th>
                <th className="py-3 px-4">Check-out thực tế</th>
                <th className="py-3 px-4 text-center">Giờ công</th>
                <th className="py-3 px-4 text-center">Kết quả chấm công</th>
                <th className="py-3 px-4">Ghi chú</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 italic">
                    {isLoading ? 'Đang tải dữ liệu ca trực...' : 'Không có dữ liệu ca trực trong khoảng thời gian đã chọn.'}
                  </td>
                </tr>
              ) : (
                filteredList.map((assignment, idx) => {
                  const isForgotten = isShiftForgottenCheckout(assignment)
                  const isAbsentShift = isShiftAbsent(assignment)
                  const workHours = calculateShiftWorkHours(assignment)
                  const shiftInfo = BOXORA_SHIFTS[assignment.shift]

                  return (
                    <tr key={assignment.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 text-center text-slate-400 font-mono text-[11px]">
                        {idx + 1}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 font-mono">
                          {formatVN(assignment.assignedDate)}
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium">
                          {getDayOfWeekVN(assignment.assignedDate)}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">
                          {assignment.staffFullName || assignment.staffUsername || '—'}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {assignment.staffEmail || '—'}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-blue-700">
                          {shiftInfo?.shortLabel || assignment.shift}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {assignment.startTime && assignment.endTime
                            ? `${assignment.startTime.slice(0, 5)} - ${assignment.endTime.slice(0, 5)}`
                            : shiftInfo?.timeRange || '—'}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        {assignment.checkedInAt ? (
                          <div className="font-mono font-semibold text-emerald-700">
                            {formatDateTime(assignment.checkedInAt)}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Chưa vào</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {assignment.checkedOutAt ? (
                          <div className="font-mono font-semibold text-blue-700">
                            {formatDateTime(assignment.checkedOutAt)}
                          </div>
                        ) : isForgotten ? (
                          <span className="text-rose-600 font-semibold font-mono text-[11px]">
                            Quên ra ca (&gt;23:59:59)
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Chưa ra</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className={`font-mono font-black text-xs ${workHours > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                          {workHours.toFixed(1)}h
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        {isForgotten ? (
                          <span className="inline-block px-2.5 py-0.5 rounded-full font-bold text-[10px] bg-rose-50 text-rose-700 border border-rose-200">
                            Không đi làm (Quên ra ca)
                          </span>
                        ) : isAbsentShift ? (
                          <span className="inline-block px-2.5 py-0.5 rounded-full font-bold text-[10px] bg-slate-100 text-slate-700 border border-slate-200">
                            Không đi làm (Chưa vào)
                          </span>
                        ) : assignment.status === 'COMPLETED' ? (
                          <span className="inline-block px-2.5 py-0.5 rounded-full font-bold text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Hợp lệ ({workHours}h)
                          </span>
                        ) : assignment.status === 'CHECKED_IN' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[10px] bg-blue-50 text-blue-700 border border-blue-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                            Đang trực ca
                          </span>
                        ) : (
                          <span className="inline-block px-2.5 py-0.5 rounded-full font-semibold text-[10px] bg-amber-50 text-amber-700 border border-amber-200">
                            Chờ vào ca
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 max-w-xs text-slate-500 text-[11px]">
                        <span className="line-clamp-2" title={assignment.notes || assignment.checkInNote || assignment.checkOutNote || ''}>
                          {assignment.notes || assignment.checkInNote || assignment.checkOutNote || '—'}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ==================== PRINTABLE REPORT SHEET (A4) ==================== */}
      <div id="printable-attendance-area" className="hidden print:block font-sans text-black">
        {/* Header Công ty */}
        <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-4">
          <div>
            <h1 className="text-sm font-bold uppercase tracking-wider">CÔNG TY CỔ PHẦN BOXORA VIỆT NAM</h1>
            <p className="text-[11px] text-gray-600">Hệ thống kho tự quản thông minh hàng đầu</p>
            <p className="text-[11px] text-gray-600 font-semibold mt-0.5">Địa điểm: {facilityName}</p>
          </div>
          <div className="text-right text-[11px]">
            <p className="font-bold">Mẫu: BC-CC/01-BOXORA</p>
            <p className="text-gray-500 mt-0.5">Thời điểm in: {printDate || formatDateTime(new Date().toISOString())}</p>
            <p className="text-gray-500">Người lập: {currentUserName}</p>
          </div>
        </div>

        {/* Title */}
        <div className="text-center my-4">
          <h2 className="text-base font-black uppercase tracking-wide">
            BẢNG TỔNG HỢP CHẤM CÔNG VÀ THEO DÕI CA TRỰC NHÂN VIÊN
          </h2>
          <p className="text-xs font-semibold text-gray-700 mt-1">
            Kỳ đối soát: Từ ngày {formatVN(fromDate)} đến ngày {formatVN(toDate)}
          </p>
        </div>

        {/* Bảng tóm tắt chỉ số */}
        <div className="my-4 border border-black p-3 rounded-sm bg-gray-50">
          <div className="grid grid-cols-4 gap-2 text-xs">
            <div>
              <span className="font-semibold text-gray-600">Tổng số ca phân công:</span>
              <p className="font-bold text-sm">{metrics.totalAssigned} ca</p>
            </div>
            <div>
              <span className="font-semibold text-gray-600">Hoàn thành hợp lệ:</span>
              <p className="font-bold text-sm text-green-800">{metrics.completed} ca</p>
            </div>
            <div>
              <span className="font-semibold text-gray-600">Quên ra ca / Vắng mặt:</span>
              <p className="font-bold text-sm text-red-800">{metrics.totalAbsent} ca ({metrics.forgottenCheckout} quên ra ca)</p>
            </div>
            <div>
              <span className="font-semibold text-gray-600">Tổng giờ công ghi nhận:</span>
              <p className="font-bold text-sm text-blue-900">{metrics.totalWorkHours} giờ ({metrics.attendanceRate}%)</p>
            </div>
          </div>
        </div>

        {/* Bảng chi tiết in ấn */}
        <table className="w-full text-[10.5px] border-collapse border border-black my-4">
          <thead>
            <tr className="bg-gray-200 border-b border-black font-bold uppercase text-[9.5px]">
              <th className="border border-black p-1.5 w-8 text-center">STT</th>
              <th className="border border-black p-1.5 text-center">Ngày làm</th>
              <th className="border border-black p-1.5">Họ tên nhân viên</th>
              <th className="border border-black p-1.5 text-center">Ca trực</th>
              <th className="border border-black p-1.5 text-center">Giờ vào</th>
              <th className="border border-black p-1.5 text-center">Giờ ra</th>
              <th className="border border-black p-1.5 text-center w-14">Giờ công</th>
              <th className="border border-black p-1.5 text-center">Kết quả</th>
              <th className="border border-black p-1.5">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {filteredList.map((item, idx) => {
              const isForgotten = isShiftForgottenCheckout(item)
              const isAbsentShift = isShiftAbsent(item)
              const hours = calculateShiftWorkHours(item)
              const shiftInfo = BOXORA_SHIFTS[item.shift]

              return (
                <tr key={item.id} className="border-b border-black">
                  <td className="border border-black p-1 text-center font-mono">{idx + 1}</td>
                  <td className="border border-black p-1 text-center font-mono">
                    {formatVN(item.assignedDate)} ({getDayOfWeekVN(item.assignedDate)})
                  </td>
                  <td className="border border-black p-1 font-semibold">
                    {item.staffFullName || item.staffUsername}
                    <div className="text-[9px] text-gray-600 font-normal">{item.staffEmail}</div>
                  </td>
                  <td className="border border-black p-1 text-center">
                    {shiftInfo?.shortLabel || item.shift}
                  </td>
                  <td className="border border-black p-1 text-center font-mono">
                    {formatTimeOnly(item.checkedInAt)}
                  </td>
                  <td className="border border-black p-1 text-center font-mono">
                    {isForgotten ? 'Quên ra ca' : formatTimeOnly(item.checkedOutAt)}
                  </td>
                  <td className="border border-black p-1 text-center font-mono font-bold">
                    {hours > 0 ? `${hours.toFixed(1)}h` : '0.0h'}
                  </td>
                  <td className="border border-black p-1 text-center font-semibold text-[9.5px]">
                    {isForgotten
                      ? 'KHÔNG ĐI LÀM (Quên ra ca)'
                      : isAbsentShift
                      ? 'KHÔNG ĐI LÀM (Vắng)'
                      : item.status === 'COMPLETED'
                      ? 'HỢP LỆ'
                      : item.status}
                  </td>
                  <td className="border border-black p-1 text-[9px] max-w-[150px] truncate">
                    {item.notes || item.checkInNote || '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Khung chữ ký 3 bên */}
        <div className="grid grid-cols-3 gap-6 text-center text-xs mt-8 pt-4">
          <div>
            <p className="font-bold uppercase">NGƯỜI LẬP BẢNG</p>
            <p className="text-[10px] text-gray-500 italic mt-0.5">(Ký và ghi rõ họ tên)</p>
            <div className="h-16" />
            <p className="font-bold text-gray-900">{currentUserName}</p>
          </div>

          <div>
            <p className="font-bold uppercase">QUẢN LÝ CƠ SỞ</p>
            <p className="text-[10px] text-gray-500 italic mt-0.5">(Ký duyệt đối soát)</p>
            <div className="h-16" />
            <p className="font-bold text-gray-900">Xác nhận cơ sở</p>
          </div>

          <div>
            <p className="font-bold uppercase">PHÒNG KẾ TOÁN / VẬN HÀNH</p>
            <p className="text-[10px] text-gray-500 italic mt-0.5">(Ký duyệt quyết toán lương)</p>
            <div className="h-16" />
            <p className="font-bold text-gray-900">Ban Giám Đốc</p>
          </div>
        </div>
      </div>
    </div>
  )
}

