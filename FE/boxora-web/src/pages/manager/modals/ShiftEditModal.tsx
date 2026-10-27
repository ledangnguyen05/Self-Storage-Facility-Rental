import React, { useState, useEffect } from 'react'
import { staffAssignmentService, StaffAssignmentResponse } from '../../../services/staffAssignmentService'
import { STANDARD_SHIFTS_LIST, isShiftInPast, getFirstAvailableShiftForDate } from '../../../constants/shiftConstants'

interface ShiftEditModalProps {
  isOpen: boolean
  onClose: () => void
  assignment: StaffAssignmentResponse | null
  onSave: (summary: string) => void
}

export const ShiftEditModal: React.FC<ShiftEditModalProps> = ({
  isOpen,
  onClose,
  assignment,
  onSave
}) => {
  const [shiftType, setShiftType] = useState<'MORNING' | 'AFTERNOON' | 'NIGHT'>('AFTERNOON')
  const [targetZone, setTargetZone] = useState('Phân khu A (Hành lang Aisle North)')
  const [roleInShift, setRoleInShift] = useState('PRIMARY_STAFF')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (assignment) {
      const initialShift = assignment.shift === 'FULL_DAY' ? 'MORNING' : (assignment.shift || 'AFTERNOON')
      const validShift = isShiftInPast(assignment.assignedDate, initialShift) ? (getFirstAvailableShiftForDate(assignment.assignedDate) || initialShift) : initialShift
      setShiftType(validShift as 'MORNING' | 'AFTERNOON' | 'NIGHT')
      setTargetZone(assignment.assignedZone || 'Phân khu A (Hành lang Aisle North)')
      setRoleInShift(assignment.roleInShift || 'PRIMARY_STAFF')
      setNotes(assignment.notes || '')
      setErrorMessage(null)
    }
  }, [assignment, isOpen])

  if (!isOpen || !assignment) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isShiftInPast(assignment.assignedDate, shiftType)) {
      setErrorMessage('Khung giờ ca trực đã chọn đã trôi qua. Chỉ được phân ca cho thời gian hiện tại đến tương lai.')
      return
    }
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      await staffAssignmentService.updateAssignment(assignment.id, {
        shift: shiftType,
        assignedZone: targetZone,
        roleInShift: roleInShift,
        notes: notes
      })

      onSave(`Đã cập nhật ca trực của ${assignment.staffFullName || assignment.staffUsername}!`)
      onClose()
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || 'Lỗi khi cập nhật ca trực vào cơ sở dữ liệu.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-700">
              <span className="material-symbols-outlined text-[26px]">edit_calendar</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Hiệu Chỉnh Ca Trực</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Nhân sự: <span className="font-semibold text-slate-800">{assignment.staffFullName || assignment.staffUsername}</span> • Ngày {assignment.assignedDate}
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

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-xs">
          {/* Shift Type Selection */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1.5">
              Ca làm việc
            </label>
            <div className="grid grid-cols-3 gap-2">
              {STANDARD_SHIFTS_LIST.map(s => {
                const isPastShift = isShiftInPast(assignment.assignedDate, s.type)
                return (
                <button
                  key={s.type}
                  type="button"
                  disabled={isPastShift}
                  onClick={() => {
                    if (!isPastShift) {
                      setShiftType(s.type as 'MORNING' | 'AFTERNOON' | 'NIGHT')
                    }
                  }}
                  title={isPastShift ? 'Khung giờ ca này đã trôi qua, không thể phân công' : s.label}
                  className={`p-2 rounded-lg border text-center transition-all ${
                    isPastShift
                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                      : shiftType === s.type
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs cursor-pointer'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 cursor-pointer'
                  }`}
                >
                  <span className="font-bold block">{s.shortLabel}</span>
                  <span className={`text-[10px] block mt-0.5 ${isPastShift ? 'text-rose-500 font-semibold' : shiftType === s.type ? 'text-slate-300' : 'text-slate-500'}`}>
                    {isPastShift ? `${s.timeRange} (Đã qua)` : s.timeRange}
                  </span>
                </button>
                )
              })}
              {false && STANDARD_SHIFTS_LIST.map(s => (
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

          {/* Area & Role in Shift */}
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
                Vai trò trong ca
              </label>
              <input
                type="text"
                value={roleInShift}
                onChange={(e) => setRoleInShift(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400"
                placeholder="PRIMARY_STAFF / FACILITY_LEAD"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Ghi chú &amp; chỉ thị nhiệm vụ
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-2 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400"
              placeholder="Nhập nội dung cập nhật..."
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
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-all shadow-sm cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-[16px] ${isSubmitting ? 'animate-spin' : ''}`}>
                {isSubmitting ? 'sync' : 'save'}
              </span>
              <span>{isSubmitting ? 'Đang lưu...' : 'Lưu Thay Đổi'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
