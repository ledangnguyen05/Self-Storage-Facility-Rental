import React, { useState } from 'react'

export interface FacilityScopingData {
  userId: string
  userName: string
  userEmail: string
  currentRole: string
  facilityId: string
  facilityName: string
  scope: 'FULL_MANAGEMENT' | 'DUTY_STAFF' | 'MAINTENANCE_TECH' | 'AUDITOR'
  shiftType: 'ALL_DAY' | 'MORNING_SHIFT' | 'AFTERNOON_SHIFT' | 'NIGHT_SHIFT'
  startDate: string
  endDate: string
  notes: string
}

interface FacilityScopingModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: FacilityScopingData) => Promise<void> | void
  initialUser?: {
    id: string
    fullName: string
    email: string
    roleName: string
    facilityId?: string
  } | null
}

const FACILITIES_LIST = [
  { id: 'tb', name: 'Cơ sở Tân Bình - Mega Central (TP.HCM)', address: '124 Hoàng Hoa Thám, P.12, Q. Tân Bình' },
  { id: 'q7', name: 'Cơ sở Quận 7 - Nam Sài Gòn (TP.HCM)', address: '88 Nguyễn Hữu Thọ, P. Tân Hưng, Q. 7' },
  { id: 'bt', name: 'Cơ sở Bình Thạnh - Landmark Hub (TP.HCM)', address: '208 Nguyễn Hữu Cảnh, P.22, Q. Bình Thạnh' },
  { id: 'cg', name: 'Cơ sở Cầu Giấy - Hà Nội Hub (Hà Nội)', address: '72 Trần Thái Tông, Dịch Vọng Hậu, Cầu Giấy' },
  { id: 'hp', name: 'Cơ sở Hải Phòng - Hồng Bàng Port', address: '15 Bến Bính, Minh Khai, Hồng Bàng' }
]

export const FacilityScopingModal: React.FC<FacilityScopingModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialUser
}) => {
  const [selectedFacility, setSelectedFacility] = useState(initialUser?.facilityId || 'tb')
  const [scope, setScope] = useState<'FULL_MANAGEMENT' | 'DUTY_STAFF' | 'MAINTENANCE_TECH' | 'AUDITOR'>('DUTY_STAFF')
  const [shiftType, setShiftType] = useState<'ALL_DAY' | 'MORNING_SHIFT' | 'AFTERNOON_SHIFT' | 'NIGHT_SHIFT'>('ALL_DAY')
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [endDate, setEndDate] = useState('2026-12-31')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const facilityObj = FACILITIES_LIST.find(f => f.id === selectedFacility) || FACILITIES_LIST[0]
      await onSave({
        userId: initialUser?.id || 'u-default',
        userName: initialUser?.fullName || 'Người dùng',
        userEmail: initialUser?.email || '',
        currentRole: initialUser?.roleName || 'STAFF',
        facilityId: selectedFacility,
        facilityName: facilityObj.name,
        scope,
        shiftType,
        startDate,
        endDate,
        notes
      })
      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        onClose()
      }, 1200)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">domain_verification</span>
            </div>
            <div>
              <h2 className="text-base font-bold font-headline flex items-center gap-2">
                Phân Công Cơ Sở &amp; Phạm Vi Quản Lý
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-400/20 text-cyan-300 border border-cyan-400/30">
                  Facility Scoping
                </span>
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Thiết lập quyền quản lý kho vật lý và ca làm việc cho nhân sự trực thuộc
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 text-left text-slate-800 text-sm">
          {/* Target Personnel Card */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-cyan-700 text-white font-bold text-sm flex items-center justify-center shadow-xs">
                {initialUser?.fullName ? initialUser.fullName.slice(0, 2).toUpperCase() : 'NS'}
              </div>
              <div>
                <div className="font-bold text-slate-900 flex items-center gap-2">
                  {initialUser?.fullName || 'Nguyễn Văn An'}
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-semibold">
                    {initialUser?.roleName || 'STAFF'}
                  </span>
                </div>
                <div className="text-xs text-slate-500 font-mono">
                  {initialUser?.email || 'nhanvien.boxora@boxora.com'}
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-mono text-cyan-700 bg-cyan-50 px-2.5 py-1 rounded-md border border-cyan-200 font-semibold">
                ID: {initialUser?.id || 'NV-2026-081'}
              </span>
            </div>
          </div>

          {/* Facility Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-cyan-600">location_on</span>
              Chọn Cơ sở Phụ trách (Target Facility)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {FACILITIES_LIST.map((fac) => (
                <div
                  key={fac.id}
                  onClick={() => setSelectedFacility(fac.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedFacility === fac.id
                      ? 'border-cyan-600 bg-cyan-50/50 shadow-xs ring-1 ring-cyan-600'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-slate-900 truncate">
                      {fac.name}
                    </span>
                    {selectedFacility === fac.id && (
                      <span className="material-symbols-outlined text-cyan-600 text-[18px]">
                        check_circle
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 truncate">{fac.address}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Scoping Authority / Role in Facility */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-cyan-600">admin_panel_settings</span>
              Phạm Vi Quyền Hạn Tại Cơ Sở (Facility Scoping Scope)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <label
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  scope === 'FULL_MANAGEMENT'
                    ? 'border-cyan-600 bg-cyan-50/50'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="facility_scope"
                  checked={scope === 'FULL_MANAGEMENT'}
                  onChange={() => setScope('FULL_MANAGEMENT')}
                  className="mt-0.5 text-cyan-600 focus:ring-cyan-500"
                />
                <div>
                  <div className="font-bold text-xs text-slate-900">Toàn Quyền Quản Lý Cơ Sở</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Điều phối mặt bằng, duyệt hoàn cọc, cấu hình giá &amp; bật/tắt bảo trì.
                  </div>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  scope === 'DUTY_STAFF'
                    ? 'border-cyan-600 bg-cyan-50/50'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="facility_scope"
                  checked={scope === 'DUTY_STAFF'}
                  onChange={() => setScope('DUTY_STAFF')}
                  className="mt-0.5 text-cyan-600 focus:ring-cyan-500"
                />
                <div>
                  <div className="font-bold text-xs text-slate-900">Trực Ca Tiếp Đón &amp; Bàn Giao</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Quét mã QR check-in, đối chiếu CCCD, cấp mã PIN và nhận bàn giao trả kho.
                  </div>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  scope === 'MAINTENANCE_TECH'
                    ? 'border-cyan-600 bg-cyan-50/50'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="facility_scope"
                  checked={scope === 'MAINTENANCE_TECH'}
                  onChange={() => setScope('MAINTENANCE_TECH')}
                  className="mt-0.5 text-cyan-600 focus:ring-cyan-500"
                />
                <div>
                  <div className="font-bold text-xs text-slate-900">Kỹ Thuật Viên &amp; IoT Smart Lock</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Xử lý kẹt khóa điện tử, sửa chữa hạ tầng, đọc telemetry cảm biến nhiệt ẩm.
                  </div>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  scope === 'AUDITOR'
                    ? 'border-cyan-600 bg-cyan-50/50'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="facility_scope"
                  checked={scope === 'AUDITOR'}
                  onChange={() => setScope('AUDITOR')}
                  className="mt-0.5 text-cyan-600 focus:ring-cyan-500"
                />
                <div>
                  <div className="font-bold text-xs text-slate-900">Giám Sát &amp; Kiểm Toán Độc Lập</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Chỉ đọc nhật ký audit log, truy vết biên bản bàn giao và dòng tiền thực thu.
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Shift Schedule & Date Range */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">Ca Làm Việc</label>
              <select
                value={shiftType}
                onChange={(e: any) => setShiftType(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-cyan-600"
              >
                <option value="ALL_DAY">Toàn thời gian (Cố định)</option>
                <option value="MORNING_SHIFT">Ca Sáng (06:00 - 14:00)</option>
                <option value="AFTERNOON_SHIFT">Ca Chiều (14:00 - 22:00)</option>
                <option value="NIGHT_SHIFT">Ca Đêm (22:00 - 06:00)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">Ngày Bắt Đầu Hiệu Lực</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:border-cyan-600"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">Ngày Hết Hạn Phân Công</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:border-cyan-600"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">Ghi Chú Phân Công</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Nhập quyết định điều động nhân sự, chỉ đạo bàn giao hoặc lưu ý kiểm soát..."
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs placeholder-slate-400 focus:outline-none focus:border-cyan-600"
            />
          </div>

          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              <span>Đã lưu thành công phân công cơ sở và cập nhật vào hệ thống!</span>
            </div>
          )}

          {/* Modal Footer */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Hủy Bỏ
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="stitch-btn-primary text-xs"
            >
              {isSubmitting ? (
                <>
                  <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                  <span>Đang Lưu...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">save</span>
                  <span>Lưu Phân Công Cơ Sở</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
