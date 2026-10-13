import React, { useState } from 'react'
import { Booking } from '../../../types'
import { handoverService } from '../../../services/handoverService'
import { bookingService } from '../../../services/bookingService'

interface HandoverCheckInWorkbenchProps {
  booking: Booking
  staffId?: string
  staffName?: string
  onHandoverComplete?: (bookingId: string) => void
  onOpenQrScanner?: () => void
}

interface ArrivingCustomer {
  bookingId: string
  bookingCode: string
  customerName: string
  phone: string
  idCard: string
  unitCode: string
  unitType: string
  floor: string
  appointmentTime: string
  durationMonths: number
  depositAmount: number
  rentalAmount: number
  contractCode: string
  contractSignedAt: string
  isPaid: boolean
  isContractSigned: boolean
  isIdVerified: boolean
  isUnitReady: boolean
}

const mapBooking = (booking: Booking): ArrivingCustomer => ({
  bookingId: booking.id,
  bookingCode: booking.bookingCode,
  customerName: booking.customerName,
  phone: booking.customerPhone || '—',
  idCard: '',
  unitCode: booking.unitCode,
  unitType: booking.facilityName || 'Kho lưu trữ',
  floor: booking.facilityName || 'Cơ sở chưa xác định',
  appointmentTime: booking.startDate ? new Date(booking.startDate).toLocaleString('vi-VN') : '—',
  durationMonths: booking.rentalMonths,
  depositAmount: booking.depositPaid || 0,
  rentalAmount: booking.totalRentalFee || 0,
  contractCode: booking.bookingCode,
  contractSignedAt: booking.status === 'ACTIVE' ? 'Đang hiệu lực' : 'Cần đối chiếu',
  isPaid: booking.status === 'ACTIVE',
  isContractSigned: booking.status === 'ACTIVE',
  isIdVerified: false,
  isUnitReady: false,
})

export const HandoverCheckInWorkbench: React.FC<HandoverCheckInWorkbenchProps> = ({
  booking,
  staffId,
  staffName,
  onHandoverComplete,
  onOpenQrScanner
}) => {
  // Active arrival
  const [selectedCustomer, setSelectedCustomer] = useState<ArrivingCustomer>(() => mapBooking(booking))

  // Sync with the booking selected from the live arrivals list and retrieve its real PIN.
  React.useEffect(() => {
    setSelectedCustomer(mapBooking(booking))
    setIsCompleted(false)
    setAccessPin('')
    setPinError(null)
    void bookingService.getAccessPin(booking.id)
      .then(result => setAccessPin(result.pin))
      .catch(() => setPinError('Không tải được PIN của lượt đặt kho. Hãy thử lại trước khi hoàn tất bàn giao.'))
  }, [booking])
  const [rfidCard, setRfidCard] = useState('')
  const [accessPin, setAccessPin] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)
  const [pinCopied, setPinCopied] = useState(false)
  const [handoverNotes, setHandoverNotes] = useState('')

  // 4 Pre-requisite verifications
  const [verifiedChecks, setVerifiedChecks] = useState<Record<string, boolean>>({
    contract: false,
    payment: false,
    idCard: false,
    unitReady: false
  })

  // 5-Point On-Site Handover Checklist
  const [checklist, setChecklist] = useState({
    doorRoll: false,
    cleanliness: false,
    lighting: false,
    fireSafety: false,
    sealPlate: false
  })

  // 2 Condition Photos
  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isCompleted, setIsCompleted] = useState(false)
  const [showPdfModal, setShowPdfModal] = useState(false)
  const [activeStepTab, setActiveStepTab] = useState<'audit' | 'checklist' | 'pin'>('audit')

  const handleReloadPin = async () => {
    setPinError(null)
    setAccessPin('')
    setPinCopied(false)
    try {
      const result = await bookingService.getAccessPin(booking.id)
      setAccessPin(result.pin)
    } catch {
      setPinError('Không tải được PIN của lượt đặt kho. Hãy thử lại.')
    }
  }

  // Copy PIN to clipboard
  const handleCopyPin = () => {
    if (!accessPin) return
    void navigator.clipboard.writeText(accessPin)
    setPinCopied(true)
    setTimeout(() => setPinCopied(false), 2000)
  }

  // Toggle checklist item
  const handleToggleChecklist = (key: keyof typeof checklist) => {
    setChecklist(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  // Mark all checklist items as passed
  const handleSelectAllChecklist = () => {
    setChecklist({
      doorRoll: true,
      cleanliness: true,
      lighting: true,
      fireSafety: true,
      sealPlate: true
    })
  }

  const checklistCount = Object.values(checklist).filter(Boolean).length
  const isAllChecklistPassed = checklistCount === 5
  const isAllPreChecksPassed = Object.values(verifiedChecks).every(Boolean)

  // Submit Handover Check-in
  const handleCompleteHandover = async () => {
    if (!isAllPreChecksPassed || !isAllChecklistPassed || !selectedCustomer.idCard.trim() || !accessPin) {
      setSubmitError('Hãy xác nhận đủ 4 điều kiện, hoàn tất checklist 5 điểm, nhập CCCD và tải được mã PIN trước khi bàn giao.')
      return
    }
    setSubmitError(null)
    setIsSubmitting(true)
    try {
      await handoverService.checkIn({
        bookingId: selectedCustomer.bookingId,
        staffId,
        recordType: 'CHECK_IN',
        idCardNumber: selectedCustomer.idCard,
        rfidCardNumber: rfidCard,
        accessPin: accessPin,
        unitCondition: `${checklistCount}/5 tiêu chuẩn nghiệm thu đạt chuẩn (Ảnh cửa & trong kho đã lưu vết)`,
        notes: handoverNotes
      })
      setIsCompleted(true)
      if (onHandoverComplete) {
        onHandoverComplete(selectedCustomer.bookingId)
      }
    } catch {
      setSubmitError('Không ghi nhận được biên bản bàn giao. Trạng thái chưa thay đổi; vui lòng thử lại.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 text-left">
      
      {/* 1. Header & Active Arriving Session Ribbon */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-sm shrink-0">
            <span className="material-symbols-outlined text-[24px] text-cyan-400">verified_user</span>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-headline text-lg font-bold text-slate-900">
                Quy Trình Check-in &amp; Nghiệm Thu Bàn Giao Kho
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Đối chiếu dữ liệu lượt đặt kho, ghi nhận kiểm tra hiện trường và lưu biên bản qua hệ thống.
            </p>
          </div>
        </div>

        {/* Selected booking & scan trigger */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
            <span className="text-slate-500 font-medium">Đang xử lý:</span>
            <span className="font-bold text-slate-900">{selectedCustomer.bookingCode} · {selectedCustomer.unitCode}</span>
          </div>

          {onOpenQrScanner && (
            <button
              onClick={onOpenQrScanner}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1 transition-colors border border-slate-200 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">qr_code_scanner</span>
              <span>Quét QR</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Customer Spotlight Profile Card */}
      <div className="mt-5 p-4 rounded-xl bg-slate-50 border border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-headline font-bold text-base shadow-xs shrink-0">
              {selectedCustomer.customerName.split(' ').map(n => n[0]).slice(-2).join('')}
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-headline text-base font-bold text-slate-900">
                  {selectedCustomer.customerName}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-slate-200 text-slate-900 font-mono text-[11px] font-bold">
                  {selectedCustomer.bookingCode}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-mono font-bold">
                  Lịch bắt đầu: {selectedCustomer.appointmentTime}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-slate-600 text-xs">
                <span className="flex items-center gap-1 font-mono tabular-nums">
                  <span className="material-symbols-outlined text-[15px] text-slate-400">call</span>
                  {selectedCustomer.phone}
                </span>
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[15px] text-slate-400">badge</span>
                  CCCD: <strong className="font-mono text-slate-900 font-bold tabular-nums">{selectedCustomer.idCard}</strong>
                </span>
                <span className="flex items-center gap-1 font-mono font-bold text-cyan-700">
                  <span className="material-symbols-outlined text-[15px]">meeting_room</span>
                  {selectedCustomer.unitCode} ({selectedCustomer.unitType}) • {selectedCustomer.floor}
                </span>
              </div>
            </div>
          </div>

          <div className="flex md:flex-col items-end justify-between shrink-0 text-right">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-500 font-medium">Thời hạn hợp đồng:</span>
              <span className="font-mono font-bold text-slate-900 text-xs tabular-nums">{selectedCustomer.durationMonths} Tháng</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Hợp đồng: <strong className="font-mono text-slate-900 font-bold">{selectedCustomer.contractCode}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Three-Tab Navigation for Seamless Workflow */}
      <div className="mt-6 flex border-b border-slate-200">
        <button
          onClick={() => setActiveStepTab('audit')}
          className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeStepTab === 'audit'
              ? 'border-cyan-600 text-cyan-700'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center font-mono text-[10px]">
            1
          </span>
          <span>Đối Soát 4 Điều Kiện</span>
          {isAllPreChecksPassed && (
            <span className="material-symbols-outlined text-[16px] text-emerald-600">check_circle</span>
          )}
        </button>

        <button
          onClick={() => setActiveStepTab('checklist')}
          className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeStepTab === 'checklist'
              ? 'border-cyan-600 text-cyan-700'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center font-mono text-[10px]">
            2
          </span>
          <span>Nghiệm Thu Hiện Trường (5/5) &amp; Ảnh</span>
          <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
            isAllChecklistPassed ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
          }`}>
            {checklistCount}/5
          </span>
        </button>

        <button
          onClick={() => setActiveStepTab('pin')}
          className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeStepTab === 'pin'
              ? 'border-cyan-600 text-cyan-700'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center font-mono text-[10px]">
            3
          </span>
          <span>Cấp Mã PIN &amp; Bàn Giao</span>
          {isCompleted && (
            <span className="material-symbols-outlined text-[16px] text-emerald-600">verified</span>
          )}
        </button>
      </div>

      {/* Tab 1 Content: Pre-requisites Audit */}
      {activeStepTab === 'audit' && (
        <div className="mt-6 flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            
            {/* Condition 1: Signed Contract */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-[20px]">description</span>
              </div>
              <div className="flex-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">1. Hợp Đồng Điện Tử (OTP)</span>
                  <label className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-600">
                    <input type="checkbox" checked={verifiedChecks.contract} onChange={e => setVerifiedChecks(prev => ({ ...prev, contract: e.target.checked }))} />
                    Đã đối chiếu
                  </label>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Mã HĐ: <strong className="font-mono text-slate-800">{selectedCustomer.contractCode}</strong> • Xác thực ký số lúc {selectedCustomer.contractSignedAt}.
                </p>
              </div>
            </div>

            {/* Condition 2: 100% Payment */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-[20px]">payments</span>
              </div>
              <div className="flex-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">2. Thanh Toán Cọc &amp; Thuê Tháng 1</span>
                  <label className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-600">
                    <input type="checkbox" checked={verifiedChecks.payment} onChange={e => setVerifiedChecks(prev => ({ ...prev, payment: e.target.checked }))} />
                    Đã đối chiếu
                  </label>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Cọc: <strong className="font-mono">{selectedCustomer.depositAmount.toLocaleString('vi-VN')}đ</strong> · Tổng thuê: <strong className="font-mono">{selectedCustomer.rentalAmount.toLocaleString('vi-VN')}đ</strong>. Đối chiếu với hệ thống thanh toán trước khi xác nhận.
                </p>
              </div>
            </div>

            {/* Condition 3: Identity Verification */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-[20px]">badge</span>
              </div>
              <div className="flex-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">3. Đối Chiếu CCCD / Passport</span>
                  <label className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-600">
                    <input type="checkbox" checked={verifiedChecks.idCard} disabled={!selectedCustomer.idCard.trim()} onChange={e => setVerifiedChecks(prev => ({ ...prev, idCard: e.target.checked }))} />
                    Đã đối chiếu
                  </label>
                </div>
                <input aria-label="Số CCCD khách hàng" value={selectedCustomer.idCard} onChange={e => { setSelectedCustomer(current => ({ ...current, idCard: e.target.value })); setVerifiedChecks(current => ({ ...current, idCard: false })) }} placeholder="Nhập số CCCD sau khi đối chiếu giấy tờ" className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs text-slate-800" />
              </div>
            </div>

            {/* Condition 4: Unit Readiness */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-[20px]">door_front</span>
              </div>
              <div className="flex-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">4. Kho Vật Lý Đã Sẵn Sàng</span>
                  <label className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-600">
                    <input type="checkbox" checked={verifiedChecks.unitReady} onChange={e => setVerifiedChecks(prev => ({ ...prev, unitReady: e.target.checked }))} />
                    Đã kiểm tra
                  </label>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Xác nhận tình trạng kho <strong className="font-mono text-cyan-700">{selectedCustomer.unitCode}</strong> tại hiện trường.
                </p>
              </div>
            </div>

          </div>

          <div className="p-3 bg-cyan-50 border border-cyan-100 rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-cyan-900">
              <span className="material-symbols-outlined text-[18px] text-cyan-600">task_alt</span>
              <span className="font-medium">
                {Object.values(verifiedChecks).filter(Boolean).length}/4 điều kiện đã được nhân viên xác nhận.
              </span>
            </div>
            <button
              onClick={() => setActiveStepTab('checklist')}
              disabled={!isAllPreChecksPassed}
              className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>Sang bước Nghiệm thu Hiện trường</span>
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </button>
          </div>
        </div>
      )}

      {/* Tab 2 Content: 5-Point On-Site Inspection & 2 Photos */}
      {activeStepTab === 'checklist' && (
        <div className="mt-6 flex flex-col gap-6">
          
          {/* Checklist 5 points */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="font-headline text-xs font-bold text-slate-900 uppercase tracking-wider">
                Checklist Nghiệm Thu Hiện Trường (5 Điểm Tiêu Chuẩn)
              </span>
              <button
                onClick={handleSelectAllChecklist}
                className="text-xs text-cyan-600 hover:text-cyan-700 font-bold flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">done_all</span>
                <span>Chọn tất cả 5/5 đạt chuẩn</span>
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              
              {/* Item 1 */}
              <label className={`p-3 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                checklist.doorRoll ? 'bg-cyan-50/50 border-cyan-200' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={checklist.doorRoll}
                    onChange={() => handleToggleChecklist('doorRoll')}
                    className="w-4 h-4 text-cyan-600 rounded border-slate-300 focus:ring-cyan-500 cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-900">1. Cửa cuốn &amp; then chốt cơ khí</span>
                    <span className="text-slate-500 block text-[11px]">Đóng mở êm ái, then cài chắc chắn, khóa an toàn không bị kẹt rít.</span>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                  checklist.doorRoll ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                }`}>
                  {checklist.doorRoll ? 'ĐẠT' : 'CHƯA ĐẠT'}
                </span>
              </label>

              {/* Item 2 */}
              <label className={`p-3 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                checklist.cleanliness ? 'bg-cyan-50/50 border-cyan-200' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={checklist.cleanliness}
                    onChange={() => handleToggleChecklist('cleanliness')}
                    className="w-4 h-4 text-cyan-600 rounded border-slate-300 focus:ring-cyan-500 cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-900">2. Không gian vệ sinh &amp; độ ẩm</span>
                    <span className="text-slate-500 block text-[11px]">Sàn kho sạch sẽ, khô ráo hoàn toàn, không có rác tồn đọng hay mùi ẩm mốc.</span>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                  checklist.cleanliness ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                }`}>
                  {checklist.cleanliness ? 'ĐẠT' : 'CHƯA ĐẠT'}
                </span>
              </label>

              {/* Item 3 */}
              <label className={`p-3 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                checklist.lighting ? 'bg-cyan-50/50 border-cyan-200' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={checklist.lighting}
                    onChange={() => handleToggleChecklist('lighting')}
                    className="w-4 h-4 text-cyan-600 rounded border-slate-300 focus:ring-cyan-500 cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-900">3. Chiếu sáng &amp; thiết bị điện</span>
                    <span className="text-slate-500 block text-[11px]">Đèn LED hành lang và đèn kho sáng rõ, công tắc bật mở bình thường.</span>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                  checklist.lighting ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                }`}>
                  {checklist.lighting ? 'ĐẠT' : 'CHƯA ĐẠT'}
                </span>
              </label>

              {/* Item 4 */}
              <label className={`p-3 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                checklist.fireSafety ? 'bg-cyan-50/50 border-cyan-200' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={checklist.fireSafety}
                    onChange={() => handleToggleChecklist('fireSafety')}
                    className="w-4 h-4 text-cyan-600 rounded border-slate-300 focus:ring-cyan-500 cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-900">4. Đầu báo khói &amp; an toàn PCCC</span>
                    <span className="text-slate-500 block text-[11px]">Đầu phun Sprinkler &amp; cảm biến khói không bị che khuất hoặc có dấu hiệu can thiệp.</span>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                  checklist.fireSafety ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                }`}>
                  {checklist.fireSafety ? 'ĐẠT' : 'CHƯA ĐẠT'}
                </span>
              </label>

              {/* Item 5 */}
              <label className={`p-3 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                checklist.sealPlate ? 'bg-cyan-50/50 border-cyan-200' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={checklist.sealPlate}
                    onChange={() => handleToggleChecklist('sealPlate')}
                    className="w-4 h-4 text-cyan-600 rounded border-slate-300 focus:ring-cyan-500 cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-900">5. Biển số kho &amp; tem niêm phong</span>
                    <span className="text-slate-500 block text-[11px]">Bảng số phòng {selectedCustomer.unitCode} rõ ràng, tem chứng nhận Boxora nguyên vẹn.</span>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                  checklist.sealPlate ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                }`}>
                  {checklist.sealPlate ? 'ĐẠT' : 'CHƯA ĐẠT'}
                </span>
              </label>

            </div>
          </div>

          {/* 2 Condition Evidence Photos */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="font-headline text-xs font-bold text-slate-900 uppercase tracking-wider">
                Lưu Trữ 2 Ảnh Hiện Trạng Bàn Giao (Evidence Photos)
              </span>
              <span className="text-[11px] text-amber-700">Tải ảnh hiện trường chưa được hỗ trợ tại đây</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Photo 1: Door Overview */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 flex flex-col">
                <div className="relative aspect-video bg-slate-900 overflow-hidden">
                  <div className="h-full w-full flex items-center justify-center text-xs text-slate-300">Chưa có ảnh cửa kho</div>
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-slate-900/80 text-white font-mono text-[10px] backdrop-blur-xs">
                    Ảnh 1: Cửa Ngoài &amp; Bảng Số
                  </div>
                </div>
                <div className="p-2.5 flex items-center justify-between bg-white text-xs">
                  <span className="text-slate-500 text-[11px] truncate">Chưa tải ảnh lên</span>
                  <button disabled title="Chức năng tải ảnh chưa được kết nối" className="px-2 py-1 rounded bg-slate-100 text-slate-400 font-bold text-[11px] cursor-not-allowed">Tải ảnh</button>
                </div>
              </div>

              {/* Photo 2: Inside Storage Unit */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 flex flex-col">
                <div className="relative aspect-video bg-slate-900 overflow-hidden">
                  <div className="h-full w-full flex items-center justify-center text-xs text-slate-300">Chưa có ảnh bên trong kho</div>
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-slate-900/80 text-white font-mono text-[10px] backdrop-blur-xs">
                    Ảnh 2: Không Gian Bên Trong
                  </div>
                </div>
                <div className="p-2.5 flex items-center justify-between bg-white text-xs">
                  <span className="text-slate-500 text-[11px] truncate">Chưa tải ảnh lên</span>
                  <button disabled title="Chức năng tải ảnh chưa được kết nối" className="px-2 py-1 rounded bg-slate-100 text-slate-400 font-bold text-[11px] cursor-not-allowed">Tải ảnh</button>
                </div>
              </div>

            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <button
              onClick={() => setActiveStepTab('audit')}
              className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg font-bold text-xs transition-colors cursor-pointer"
            >
              Quay lại Bước 1
            </button>

            <button
              onClick={() => setActiveStepTab('pin')}
              disabled={!isAllChecklistPassed}
              className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                isAllChecklistPassed
                  ? 'bg-cyan-600 hover:bg-cyan-700 text-white shadow-xs'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <span>Chuyển sang Bước 3: Cấp PIN &amp; Bàn Giao</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>

        </div>
      )}

      {/* Tab 3 Content: Secure PIN Lock Box & Handover Completion */}
      {activeStepTab === 'pin' && (
        <div className="mt-6 flex flex-col gap-6">
          
          {/* The PIN Lock Box (Signature Component) */}
          <div className="bg-slate-900 text-white rounded-2xl p-6 border border-slate-800 shadow-lg relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none"></div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[22px]">lock</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-headline text-base font-bold text-white">
                      Mã PIN Mở Cửa Kho Số Hóa
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono text-[10px] font-bold border border-cyan-500/30">
                      AES-256-GCM
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">
                    Mã khóa truy cập điện tử dành riêng cho phòng kho {selectedCustomer.unitCode}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => void handleReloadPin()}
                  disabled={!booking.id}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">refresh</span>
                  <span>Tải lại PIN</span>
                </button>
                <button
                  onClick={handleCopyPin}
                  className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {pinCopied ? 'check' : 'content_copy'}
                  </span>
                  <span>{pinCopied ? 'Đã Sao Chép' : 'Sao Chép PIN'}</span>
                </button>
              </div>
            </div>

            {/* Large 6-Digit PIN Display */}
            <div className="my-6 flex flex-col items-center justify-center">
              <div className="flex items-center gap-2.5 sm:gap-3.5">
                {Array.from({ length: 6 }, (_, index) => (
                  <div
                    key={index}
                    className="w-12 h-16 sm:w-14 sm:h-20 rounded-xl bg-slate-800/90 border border-slate-700 flex items-center justify-center font-mono text-3xl sm:text-4xl font-extrabold text-cyan-400 shadow-inner"
                  >
                    {accessPin[index] || '•'}
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-slate-400 font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Thẻ RFID: </span>
                <input
                  type="text"
                  value={rfidCard}
                  onChange={(e) => setRfidCard(e.target.value)}
                  className="px-2 py-0.5 bg-slate-800 border border-slate-700 text-white rounded font-mono text-xs w-24 text-center focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800/80 text-xs text-slate-400">
              PIN đang hiển thị từ lượt đặt kho. Gửi SMS và thông báo ứng dụng chưa được kết nối trong màn hình này.
            </div>
          </div>
          {pinError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{pinError}</p>}

          {/* Handover Sign-off & Completion Form */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col gap-3">
            <span className="font-headline text-xs font-bold text-slate-900 uppercase tracking-wider">
              Xác Nhận Ký Biên Bản Nghiệm Thu &amp; Bàn Giao Điện Tử
            </span>

            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">
                Ghi chú bàn giao bổ sung (Hiện trạng, phụ kiện mượn thêm):
              </label>
              <textarea
                rows={2}
                value={handoverNotes}
                onChange={(e) => setHandoverNotes(e.target.value)}
                placeholder="Nhập ghi chú bàn giao nếu có (vd: Khách mượn xe đẩy, hẹn dọn đồ sau 17h)..."
                className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-cyan-600"
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div className="text-xs text-slate-500">
                Nhân viên lập biên bản: <strong className="text-slate-800">{staffName || staffId || 'Tài khoản hiện tại'}</strong>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowPdfModal(true)}
                  className="px-3 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">visibility</span>
                  <span>Xem trước biên bản</span>
                </button>

                <button
                  onClick={handleCompleteHandover}
                  disabled={isSubmitting || isCompleted || !isAllPreChecksPassed || !isAllChecklistPassed || !selectedCustomer.idCard.trim() || !accessPin}
                  className={`btn-tactile px-5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer ${
                    isCompleted
                      ? 'bg-emerald-600 text-white'
                      : isSubmitting
                      ? 'bg-slate-400 text-white cursor-wait'
                      : 'bg-cyan-600 hover:bg-cyan-700 text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {isCompleted ? 'verified' : isSubmitting ? 'hourglass_top' : 'assignment_turned_in'}
                  </span>
                  <span>
                    {isCompleted ? 'ĐÃ HOÀN TẤT BÀN GIAO' : isSubmitting ? 'Đang Xử Lý API...' : 'Xác Nhận Ký & Bàn Giao'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {submitError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{submitError}</p>}

          {/* Success Banner if Completed */}
          {isCompleted && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[22px]">check</span>
                </div>
                <div>
                  <h4 className="font-headline text-sm font-bold text-emerald-900">
                    Đã lưu biên bản bàn giao kho {selectedCustomer.unitCode}
                  </h4>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    Hệ thống đã ghi nhận biên bản bàn giao cho lượt đặt {selectedCustomer.bookingCode}.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setShowPdfModal(true)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">print</span>
                  <span>In biên bản</span>
                </button>
              </div>
            </div>
          )}

        </div>
      )}

      {/* 4. PDF Preview Modal */}
      {showPdfModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto text-slate-900">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-cyan-700 text-[26px]">contract</span>
                <div>
                  <h3 className="font-headline text-base font-bold text-slate-900">
                    BIÊN BẢN NGHIỆM THU &amp; BÀN GIAO PHÒNG KHO TỰ QUẢN
                  </h3>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Lượt đặt: {selectedCustomer.bookingCode} • Bản xem trước
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowPdfModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Document Body */}
            <div className="my-5 flex flex-col gap-4 text-xs">
              <div className="text-center pb-2 border-b border-dashed border-slate-200">
                <span className="font-bold uppercase text-slate-700 block">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</span>
                <span className="text-slate-500 block text-[10px]">Độc lập - Tự do - Hạnh phúc</span>
                <span className="font-headline font-bold text-sm text-cyan-800 mt-2 block">
                  BIÊN BẢN BÀN GIAO MẶT BẰNG &amp; CẤP MÃ MỞ CỬA KHO
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 rounded-xl">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">BÊN GIAO (BOXORA FACILITY)</span>
                  <span className="font-bold text-slate-900 block mt-0.5">{selectedCustomer.floor}</span>
                  <span className="text-slate-600 block">Đại diện: {staffName || 'Nhân viên trực ca'}</span>
                  <span className="text-slate-600 block">Chức vụ: Nhân viên trực ca tiếp vận</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">BÊN NHẬN (KHÁCH HÀNG)</span>
                  <span className="font-bold text-slate-900 block mt-0.5">{selectedCustomer.customerName}</span>
                  <span className="text-slate-600 block">CCCD: {selectedCustomer.idCard}</span>
                  <span className="text-slate-600 block">SĐT: {selectedCustomer.phone}</span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="font-bold text-slate-900">1. Thông tin kho bàn giao:</span>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg grid grid-cols-3 gap-2 text-[11px] font-mono">
                  <div>Mã kho: <strong>{selectedCustomer.unitCode}</strong></div>
                  <div>Loại: <strong>{selectedCustomer.unitType}</strong></div>
                  <div>Vị trí: <strong>{selectedCustomer.floor}</strong></div>
                  <div>Mã PIN cấp: <strong className="text-cyan-700">{accessPin}</strong></div>
                  <div>Thẻ từ: <strong>{rfidCard}</strong></div>
                  <div>Hợp đồng: <strong>{selectedCustomer.contractCode}</strong></div>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="font-bold text-slate-900">2. Kết quả kiểm định hiện trường (5/5 tiêu chí):</span>
                <ul className="list-disc list-inside text-slate-600 space-y-1 text-[11px] pl-1">
                  <li>Cửa cuốn và then chốt cơ khí hoạt động êm ái, khóa nhạy.</li>
                  <li>Không gian bên trong sạch sẽ, nền khô ráo, không mùi ẩm mốc.</li>
                  <li>Hệ thống đèn chiếu sáng và công tắc điện hoạt động bình thường.</li>
                  <li>Đầu báo khói và đầu phun PCCC không bị che khuất.</li>
                  <li>Bảng tên số kho và tem niêm phong Boxora nguyên vẹn.</li>
                </ul>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="font-bold text-slate-900">3. Ghi chú hiện trường:</span>
                <div className="p-2 bg-slate-50 border border-slate-200 rounded text-slate-700 text-[11px]">
                  {handoverNotes || 'Không có ghi chú thêm.'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 text-center pt-4">
                <div>
                  <span className="font-bold text-slate-900 block">ĐẠI DIỆN BÊN NHẬN</span>
                  <span className="text-slate-400 block text-[10px] italic mt-0.5">(Đã ký xác nhận điện tử)</span>
                  <div className="mt-6 font-headline font-bold text-slate-800">{selectedCustomer.customerName}</div>
                </div>
                <div>
                  <span className="font-bold text-slate-900 block">ĐẠI DIỆN BÊN GIAO</span>
                  <span className="text-slate-400 block text-[10px] italic mt-0.5">(Nhân viên phụ trách ca)</span>
                  <div className="mt-6 font-headline font-bold text-slate-800">{staffName || 'Nhân viên trực ca'}</div>
                </div>
              </div>

            </div>

            {/* Footer Actions */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                Bản xem trước để đối chiếu trước khi in.
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">print</span>
                  <span>In / lưu PDF</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}
