import React, { useState } from 'react'

interface ShiftAssignmentModalProps {
  isOpen: boolean
  onClose: () => void
  onSaveShift: (summary: string) => void
}

const STAFF_MEMBERS = [
  { id: 'staff_1', name: 'Lê Hoàng Nam', role: 'Kỹ thuật Trưởng & SmartLock', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80' },
  { id: 'staff_2', name: 'Trần Thùy Linh', role: 'Điều phối Bàn giao & Ký gửi', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80' },
  { id: 'staff_3', name: 'Nguyễn Văn Đạt', role: 'An ninh Tuần tra & Camera Bay B', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80' },
  { id: 'staff_4', name: 'Phạm Quốc Tuấn', role: 'Kỹ thuật viên Trạm Vi Khí Hậu Zone C', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80' }
]

export const ShiftAssignmentModal: React.FC<ShiftAssignmentModalProps> = ({
  isOpen,
  onClose,
  onSaveShift
}) => {
  const [selectedStaffId, setSelectedStaffId] = useState(STAFF_MEMBERS[0].id)
  const [shiftType, setShiftType] = useState<'MORNING' | 'AFTERNOON' | 'NIGHT'>('AFTERNOON')
  const [targetZone, setTargetZone] = useState('Phân khu A (Hành lang Aisle North)')
  const [assignmentDate, setAssignmentDate] = useState(() => new Date().toISOString().split('T')[0])
  const [taskNotes, setTaskNotes] = useState('Tuần tra định kỳ 2 giờ/lần, kiểm tra pin SmartLock các kho nợ quá hạn và hỗ trợ khách bàn giao.')

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const staff = STAFF_MEMBERS.find(s => s.id === selectedStaffId) || STAFF_MEMBERS[0]
    const shiftLabel = shiftType === 'MORNING' ? 'Ca Sáng (07:00 - 15:30)' : shiftType === 'AFTERNOON' ? 'Ca Chiều (14:30 - 22:00)' : 'Ca Đêm (21:30 - 07:30)'
    onSaveShift(`Đã phân công ${staff.name} trực ${shiftLabel} tại ${targetZone}!`)
    onClose()
  }

  const selectedStaff = STAFF_MEMBERS.find(s => s.id === selectedStaffId) || STAFF_MEMBERS[0]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-slate-100 text-slate-800">
              <span className="material-symbols-outlined text-[26px]">person_add</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Phân Công Ca Trực Nhân Sự</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Điều phối nhân viên an ninh, kỹ thuật và bàn giao kho
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

        {/* Assignment Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-xs">
          {/* Select Staff */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1.5">
              Chọn nhân viên trực ca
            </label>
            <div className="grid grid-cols-2 gap-2">
              {STAFF_MEMBERS.map(staff => (
                <div
                  key={staff.id}
                  onClick={() => setSelectedStaffId(staff.id)}
                  className={`p-2.5 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${
                    selectedStaffId === staff.id
                      ? 'border-slate-900 bg-slate-50 ring-2 ring-slate-900/10 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <img
                    src={staff.avatar}
                    alt={staff.name}
                    className="w-8 h-8 rounded-full object-cover border border-slate-200"
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-slate-900 truncate">{staff.name}</span>
                    <span className="text-[10px] text-slate-500 truncate">{staff.role}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Shift Type Selection */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1.5">
              Ca làm việc
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { type: 'MORNING' as const, label: 'Ca Sáng', time: '07:00 - 15:30' },
                { type: 'AFTERNOON' as const, label: 'Ca Chiều', time: '14:30 - 22:00' },
                { type: 'NIGHT' as const, label: 'Ca Đêm', time: '21:30 - 07:30' }
              ].map(s => (
                <button
                  key={s.type}
                  type="button"
                  onClick={() => setShiftType(s.type)}
                  className={`p-2 rounded-lg border text-center transition-all cursor-pointer ${
                    shiftType === s.type
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span className="font-bold block">{s.label}</span>
                  <span className={`text-[10px] block mt-0.5 ${shiftType === s.type ? 'text-slate-300' : 'text-slate-500'}`}>
                    {s.time}
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
              className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-neutral-800 transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">how_to_reg</span>
              Lưu &amp; Phát Lệnh Phân Công
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
