import React, { useState, useEffect } from 'react'
import { userService } from '../../../services/userService'
import { staffAssignmentService } from '../../../services/staffAssignmentService'
import { useAuth } from '../../../context/AuthContext'
import { User, Facility } from '../../../types'
import { STANDARD_SHIFTS_LIST, BOXORA_SHIFTS } from '../../../constants/shiftConstants'

interface ShiftAssignmentModalProps {
  isOpen: boolean
  onClose: () => void
  facilityId?: string
  facilities?: Facility[]
  targetRole?: 'STAFF' | 'FACILITY_MANAGER'
  onSaveShift: (summary: string) => void
}

const formatDateLocal = (d: Date): string => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const ShiftAssignmentModal: React.FC<ShiftAssignmentModalProps> = ({
  isOpen,
  onClose,
  facilityId,
  facilities = [],
  targetRole,
  onSaveShift
}) => {
  const { user } = useAuth()
  const userRole = (typeof user?.role === 'object' ? user?.role?.name : user?.role) || user?.roleName
  const isBusinessManager = userRole === 'BUSINESS_MANAGER'
  const activeTargetRole: 'STAFF' | 'FACILITY_MANAGER' = targetRole || (isBusinessManager ? 'FACILITY_MANAGER' : 'STAFF')

  const [selectedFacilityId, setSelectedFacilityId] = useState<string>(facilityId || '')
  const [staffList, setStaffList] = useState<User[]>([])
  const [isLoadingStaff, setIsLoadingStaff] = useState(false)
  const [selectedStaffId, setSelectedStaffId] = useState<string>('')
  const [shiftType, setShiftType] = useState<'MORNING' | 'AFTERNOON' | 'NIGHT'>('AFTERNOON')
  const [targetZone, setTargetZone] = useState('Phân khu A (Hành lang Aisle North)')
  const [assignmentDate, setAssignmentDate] = useState(() => formatDateLocal(new Date()))
  const [taskNotes, setTaskNotes] = useState(
    activeTargetRole === 'FACILITY_MANAGER'
      ? 'Trực điều hành cơ sở, giám sát an ninh, phê duyệt đổi ca và kiểm tra vận hành hệ thống.'
      : 'Tuần tra định kỳ 2 giờ/lần, kiểm tra pin SmartLock các kho nợ quá hạn và hỗ trợ khách bàn giao.'
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (facilityId) {
      setSelectedFacilityId(facilityId)
    } else if (facilities.length > 0 && !selectedFacilityId) {
      setSelectedFacilityId(facilities[0].id)
    }
  }, [facilityId, facilities])

  useEffect(() => {
    if (isOpen) {
      loadStaff()
    }
  }, [isOpen, selectedFacilityId, activeTargetRole])

  const loadStaff = async () => {
    setIsLoadingStaff(true)
    setErrorMessage(null)
    try {
      const res = await userService.getAllUsers({
        role: activeTargetRole,
        facilityId: selectedFacilityId || undefined,
        size: 50
      })
      let users = res?.data || []

      // Quản lý cơ sở không được tự phân ca cho chính mình
      if (userRole === 'FACILITY_MANAGER') {
        users = users.filter(u => u.id !== user?.id)
      }

      setStaffList(users)
      if (users.length > 0) {
        setSelectedStaffId(users[0].id)
      } else {
        setSelectedStaffId('')
      }
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || 'Không thể tải danh sách nhân sự từ hệ thống.')
    } finally {
      setIsLoadingStaff(false)
    }
  }

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedStaffId) {
      setErrorMessage(`Vui lòng chọn ${activeTargetRole === 'FACILITY_MANAGER' ? 'Quản lý cơ sở' : 'nhân viên'} trực ca.`)
      return
    }

    const effectiveFacId = selectedFacilityId || facilityId
    if (!effectiveFacId) {
      setErrorMessage('Vui lòng chọn cơ sở áp dụng.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const staff = staffList.find(s => s.id === selectedStaffId)
      const staffDisplayName = staff?.fullName || staff?.username || 'Nhân sự'
      const shiftLabel = BOXORA_SHIFTS[shiftType]?.label || shiftType

      await staffAssignmentService.createAssignment({
        staffId: selectedStaffId,
        facilityId: effectiveFacId,
        assignedDate: assignmentDate,
        shift: shiftType,
        assignedZone: targetZone,
        roleInShift: activeTargetRole === 'FACILITY_MANAGER' ? 'FACILITY_LEAD' : 'PRIMARY_STAFF',
        notes: taskNotes
      })

      onSaveShift(`Đã phân công ${staffDisplayName} (${activeTargetRole}) trực ${shiftLabel} tại ${targetZone}!`)
      onClose()
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Lỗi khi lưu phân công ca trực vào cơ sở dữ liệu.'
      setErrorMessage(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-slate-100 text-slate-800">
              <span className="material-symbols-outlined text-[26px]">
                {activeTargetRole === 'FACILITY_MANAGER' ? 'manage_accounts' : 'person_add'}
              </span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {activeTargetRole === 'FACILITY_MANAGER'
                  ? 'Phân Công Ca Quản Lý Cơ Sở'
                  : 'Phân Công Ca Trực Nhân Viên'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {activeTargetRole === 'FACILITY_MANAGER'
                  ? 'Dành riêng cho Business Manager điều phối Quản lý cơ sở'
                  : 'Điều phối nhân sự trực thuộc cơ sở phụ trách'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Assignment Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-xs">
          {/* Facility Selector for Business Manager */}
          {isBusinessManager && facilities.length > 0 && (
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Cơ sở phân công
              </label>
              <select
                value={selectedFacilityId}
                onChange={(e) => setSelectedFacilityId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer"
              >
                {facilities.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Select Staff / FM */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-slate-700 font-semibold">
                {activeTargetRole === 'FACILITY_MANAGER'
                  ? 'Chọn Quản lý cơ sở (FACILITY_MANAGER)'
                  : 'Chọn nhân viên trực ca (STAFF)'}
              </label>
              {isLoadingStaff && (
                <span className="text-[11px] text-cyan-600 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>
                  Đang tải...
                </span>
              )}
            </div>

            {staffList.length === 0 && !isLoadingStaff ? (
              <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-slate-500">
                {activeTargetRole === 'FACILITY_MANAGER'
                  ? 'Không tìm thấy Quản lý cơ sở nào thuộc cơ sở đã chọn.'
                  : 'Không tìm thấy nhân viên (STAFF) nào thuộc cơ sở này.'}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                {staffList.map(staff => (
                  <div
                    key={staff.id}
                    onClick={() => setSelectedStaffId(staff.id)}
                    className={`p-2.5 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${
                      selectedStaffId === staff.id
                        ? 'border-slate-900 bg-slate-50 ring-2 ring-slate-900/10 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {staff.avatar ? (
                      <img
                        src={staff.avatar}
                        alt={staff.fullName || staff.username}
                        className="w-8 h-8 rounded-full object-cover border border-slate-200"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-700 text-xs shrink-0">
                        {(staff.fullName || staff.username).substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-slate-900 truncate">
                        {staff.fullName || staff.username}
                      </span>
                      <span className="text-[10px] text-slate-500 truncate">
                        {staff.email}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Shift Type Selection */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1.5">
              Ca làm việc
            </label>
            <div className="grid grid-cols-3 gap-2">
              {STANDARD_SHIFTS_LIST.map(s => (
                <button
                  key={s.type}
                  type="button"
                  onClick={() => setShiftType(s.type as 'MORNING' | 'AFTERNOON' | 'NIGHT')}
                  className={`p-2 rounded-lg border text-center transition-all cursor-pointer ${
                    shiftType === s.type
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span className="font-bold block">{s.shortLabel}</span>
                  <span className={`text-[10px] block mt-0.5 ${shiftType === s.type ? 'text-slate-300' : 'text-slate-500'}`}>
                    {s.timeRange}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Area & Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Khu vực phân công
              </label>
              <select
                value={targetZone}
                onChange={(e) => setTargetZone(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer"
              >
                <option value="Phân khu A (Hành lang Aisle North)">Phân khu A (Aisle North)</option>
                <option value="Phân khu B (Hành lang Aisle South)">Phân khu B (Aisle South)</option>
                <option value="Phân khu C (Tầng 2 Kho Lạnh 18-22°C)">Phân khu C (Tầng 2 Climate)</option>
                <option value="Trạm Điều Hành Trung Tâm & Lễ Tân">Trạm Điều Hành &amp; Lễ Tân</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Ngày trực
              </label>
              <input
                type="date"
                value={assignmentDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setAssignmentDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Chỉ thị nhiệm vụ cụ thể
            </label>
            <textarea
              rows={2}
              value={taskNotes}
              onChange={(e) => setTaskNotes(e.target.value)}
              className="w-full p-2 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400"
              placeholder="Nhập nội dung giao việc..."
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-all border border-slate-200 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting || staffList.length === 0}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-neutral-800 transition-all shadow-sm cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-[16px] ${isSubmitting ? 'animate-spin' : ''}`}>
                {isSubmitting ? 'sync' : 'how_to_reg'}
              </span>
              <span>{isSubmitting ? 'Đang lưu vào CSDL...' : 'Lưu & Phát Lệnh Phân Công'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
