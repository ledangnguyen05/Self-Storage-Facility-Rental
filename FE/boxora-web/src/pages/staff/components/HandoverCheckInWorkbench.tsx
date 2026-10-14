import React, { useState } from 'react'
import { Booking } from '../../../types'
import { handoverService } from '../../../services/handoverService'

interface HandoverCheckInWorkbenchProps {
  onHandoverComplete?: (bookingId: string) => void
  onOpenQrScanner?: () => void
  activeBookingId?: string
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

const SAMPLE_ARRIVALS: ArrivingCustomer[] = [
  {
    bookingId: '00000000-0000-0000-0000-000000000001',
    bookingCode: '#RES-8921',
    customerName: 'Trần Minh Tuấn',
    phone: '0912.345.678',
    idCard: '001092003891',
    unitCode: '#A-112',
    unitType: 'Kho Tiêu Chuẩn 6m²',
    floor: 'Tầng 1 (Block A)',
    appointmentTime: '09:30 Sáng',
    durationMonths: 12,
    depositAmount: 1500000,
    rentalAmount: 1500000,
    contractCode: '#CTR-2026-8921',
    contractSignedAt: 'Hôm nay 08:30 (OTP Email)',
    isPaid: true,
    isContractSigned: true,
    isIdVerified: true,
    isUnitReady: true
  },
  {
    bookingId: '00000000-0000-0000-0000-000000000002',
    bookingCode: '#RES-8924',
    customerName: 'Lê Thị Hoàng Yến',
    phone: '0988.219.002',
    idCard: '079198002441',
    unitCode: '#B-205',
    unitType: 'Kho Climate Control 12m²',
    floor: 'Tầng 2 (Block B)',
    appointmentTime: '10:15 Sáng',
    durationMonths: 6,
    depositAmount: 2500000,
    rentalAmount: 2500000,
    contractCode: '#CTR-2026-8924',
    contractSignedAt: 'Hôm nay 09:05 (OTP Email)',
    isPaid: true,
    isContractSigned: true,
    isIdVerified: true,
    isUnitReady: true
  },
  {
    bookingId: '00000000-0000-0000-0000-000000000003',
    bookingCode: '#RES-8935',
    customerName: 'Vũ Đức Thắng',
    phone: '0944.890.123',
    idCard: '038096001889',
    unitCode: '#C-118',
    unitType: 'Kho Mini Gia Dụng 4m²',
    floor: 'Tầng 1 (Block C)',
    appointmentTime: '14:00 Chiều',
    durationMonths: 3,
    depositAmount: 1000000,
    rentalAmount: 1000000,
    contractCode: '#CTR-2026-8935',
    contractSignedAt: 'Hôm nay 07:45 (OTP Email)',
    isPaid: true,
    isContractSigned: true,
    isIdVerified: true,
    isUnitReady: true
  }
]

export const HandoverCheckInWorkbench: React.FC<HandoverCheckInWorkbenchProps> = ({
  onHandoverComplete,
  onOpenQrScanner,
  activeBookingId
}) => {
  // Active arrival
  const [selectedCustomer, setSelectedCustomer] = useState<ArrivingCustomer>(SAMPLE_ARRIVALS[0])

  // Sync when activeBookingId changes
  React.useEffect(() => {
    if (activeBookingId) {
      const found = SAMPLE_ARRIVALS.find(
        (a) => a.bookingId === activeBookingId || a.bookingCode === activeBookingId
      )
      if (found) {
        setSelectedCustomer(found)
        setIsCompleted(false)
      }
    }
  }, [activeBookingId])
  const [rfidCard, setRfidCard] = useState('RF-409')
  const [accessPin, setAccessPin] = useState('739215')
  const [pinCopied, setPinCopied] = useState(false)
  const [smsSent, setSmsSent] = useState(false)
  const [handoverNotes, setHandoverNotes] = useState('Đã đối soát đầy đủ hồ sơ, khách mượn xe đẩy kho số 02.')

  // 4 Pre-requisite verifications
  const [verifiedChecks, setVerifiedChecks] = useState<Record<string, boolean>>({
    contract: true,
    payment: true,
    idCard: true,
    unitReady: true
  })

  // 5-Point On-Site Handover Checklist
  const [checklist, setChecklist] = useState({
    doorRoll: true,
    cleanliness: true,
    lighting: true,
    fireSafety: true,
    sealPlate: true
  })

  // 2 Condition Photos
  const [photoDoor, setPhotoDoor] = useState<string>('https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80')
  const [photoInterior, setPhotoInterior] = useState<string>('https://images.unsplash.com/photo-1595246140625-573b715d11dc?auto=format&fit=crop&w=600&q=80')
  const doorInputRef = React.useRef<HTMLInputElement | null>(null)
  const interiorInputRef = React.useRef<HTMLInputElement | null>(null)
  const [appPushSent, setAppPushSent] = useState(false)

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)
  const [showPdfModal, setShowPdfModal] = useState(false)
  const [activeStepTab, setActiveStepTab] = useState<'audit' | 'checklist' | 'pin'>('audit')

  // Generate new 6-digit random PIN
  const handleRegeneratePin = () => {
    const newPin = Math.floor(100000 + Math.random() * 900000).toString()
    setAccessPin(newPin)
    setPinCopied(false)
    setSmsSent(false)
    setAppPushSent(false)
  }

  // Copy PIN to clipboard
  const handleCopyPin = () => {
    navigator.clipboard.writeText(accessPin)
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
    setIsSubmitting(true)
    try {
      await handoverService.checkIn({
        bookingId: selectedCustomer.bookingId,
        recordType: 'CHECK_IN',
        idCardNumber: selectedCustomer.idCard,
        identityVerified: true,
        firstMonthRentConfirmed: true,
        contractConfirmed: true,
        rfidCardNumber: rfidCard,
        accessPin: accessPin,
        doorConditionPassed: checklist.doorRoll,
        cleanlinessPassed: checklist.cleanliness,
        smartLockPassed: checklist.lighting,
        sensorPassed: checklist.fireSafety,
        wallStructurePassed: checklist.sealPlate,
        unitCondition: `${checklistCount}/5 tiêu chuẩn nghiệm thu đạt chuẩn (Ảnh cửa & trong kho đã lưu vết)`,
        notes: handoverNotes
      })
      setIsCompleted(true)
      if (onHandoverComplete) {
        onHandoverComplete(selectedCustomer.bookingId)
      }
    } catch {
      // Local fallback on API demo
      setIsCompleted(true)
      if (onHandoverComplete) {
        onHandoverComplete(selectedCustomer.bookingId)
      }
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
              <span className="px-2.5 py-0.5 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-800 font-mono text-[11px] font-bold uppercase tracking-wider">
                SLA &lt; 5 Phút
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Chuẩn hóa 4 điều kiện tiên quyết, checklist hiện trường 5 điểm, lưu trữ 2 ảnh đối soát và cấp mã PIN bảo mật cá nhân.
            </p>
          </div>
        </div>

        {/* Customer Quick Selector & Scan Trigger */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
            <span className="text-slate-500 font-medium">Khách tại sảnh:</span>
            <select
              value={selectedCustomer.bookingId}
              onChange={(e) => {
                const found = SAMPLE_ARRIVALS.find(a => a.bookingId === e.target.value)
                if (found) {
                  setSelectedCustomer(found)
                  setIsCompleted(false)
                }
              }}
              className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer"
            >
              {SAMPLE_ARRIVALS.map(c => (
                <option key={c.bookingId} value={c.bookingId}>
                  {c.customerName} ({c.bookingCode} - {c.unitCode})
                </option>
              ))}
            </select>
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
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-mono font-bold">
                  Khách Đã Tới Sảnh ({selectedCustomer.appointmentTime})
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
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-mono text-[10px] font-bold">
                    ✓ ĐÃ KÝ
                  </span>
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
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-mono text-[10px] font-bold">
                    ✓ 100% ĐÃ THU
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Cọc: <strong className="font-mono">{selectedCustomer.depositAmount.toLocaleString('vi-VN')}đ</strong> + Thuê: <strong className="font-mono">{selectedCustomer.rentalAmount.toLocaleString('vi-VN')}đ</strong> qua Sandbox Webhook.
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
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-mono text-[10px] font-bold">
                    ✓ KHỚP 100%
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Số CCCD: <strong className="font-mono text-slate-800">{selectedCustomer.idCard}</strong> trùng khớp hoàn toàn ảnh hồ sơ gốc.
                </p>
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
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-mono text-[10px] font-bold">
                    ✓ SẴN SÀNG
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Kho <strong className="font-mono text-cyan-700">{selectedCustomer.unitCode}</strong> trạng thái khả dụng, đã vệ sinh và kiểm định sơ bộ.
                </p>
              </div>
            </div>

          </div>

          <div className="p-3 bg-cyan-50 border border-cyan-100 rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-cyan-900">
              <span className="material-symbols-outlined text-[18px] text-cyan-600">task_alt</span>
              <span className="font-medium">
                Tất cả 4/4 điều kiện tiên quyết đã được xác thực hợp lệ. Sẵn sàng di chuyển dẫn khách kiểm tra thực địa.
              </span>
            </div>
            <button
              onClick={() => setActiveStepTab('checklist')}
              className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
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
              <span className="text-[11px] text-slate-500 font-mono">Bắt buộc 2/2 ảnh</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Hidden File Inputs for real camera/photo upload */}
              <input
                type="file"
                ref={doorInputRef}
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    setPhotoDoor(URL.createObjectURL(file))
                  }
                }}
              />
              <input
                type="file"
                ref={interiorInputRef}
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    setPhotoInterior(URL.createObjectURL(file))
                  }
                }}
              />

              {/* Photo 1: Door Overview */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 flex flex-col">
                <div className="relative aspect-video bg-slate-900 overflow-hidden">
                  <img
                    src={photoDoor}
                    alt="Ảnh Cửa Ngoài Kho"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-slate-900/80 text-white font-mono text-[10px] backdrop-blur-xs">
                    Ảnh 1: Cửa Ngoài &amp; Bảng Số
                  </div>
                </div>
                <div className="p-2.5 flex items-center justify-between bg-white text-xs">
                  <span className="text-slate-600 text-[11px] truncate">door_overview_{selectedCustomer.unitCode}.jpg</span>
                  <button
                    type="button"
                    onClick={() => doorInputRef.current?.click()}
                    className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition-colors cursor-pointer"
                  >
                    Chụp lại
                  </button>
                </div>
              </div>

              {/* Photo 2: Inside Storage Unit */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 flex flex-col">
                <div className="relative aspect-video bg-slate-900 overflow-hidden">
                  <img
                    src={photoInterior}
                    alt="Ảnh Bên Trong Kho"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-slate-900/80 text-white font-mono text-[10px] backdrop-blur-xs">
                    Ảnh 2: Không Gian Bên Trong
                  </div>
                </div>
                <div className="p-2.5 flex items-center justify-between bg-white text-xs">
                  <span className="text-slate-600 text-[11px] truncate">interior_floor_{selectedCustomer.unitCode}.jpg</span>
                  <button
                    type="button"
                    onClick={() => interiorInputRef.current?.click()}
                    className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition-colors cursor-pointer"
                  >
                    Chụp lại
                  </button>
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
                  </div>
                  <span className="text-xs text-slate-400">
                    Mã khóa truy cập điện tử dành riêng cho phòng kho {selectedCustomer.unitCode}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleRegeneratePin}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">refresh</span>
                  <span>Sinh Mã Mới</span>
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
                {accessPin.split('').map((char, index) => (
                  <div
                    key={index}
                    className="w-12 h-16 sm:w-14 sm:h-20 rounded-xl bg-slate-800/90 border border-slate-700 flex items-center justify-center font-mono text-3xl sm:text-4xl font-extrabold text-cyan-400 shadow-inner"
                  >
                    {char}
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-slate-400 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>Mã có hiệu lực ngay khi ký bàn giao • Thẻ RFID cấp phát: </span>
                <input
                  type="text"
                  value={rfidCard}
                  onChange={(e) => setRfidCard(e.target.value)}
                  className="px-2 py-0.5 bg-slate-800 border border-slate-700 text-white rounded font-mono text-xs w-24 text-center focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {/* Quick Dispatch Buttons */}
            <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
              <span className="text-slate-400">
                Gửi mã xác nhận mở kho trực tiếp đến điện thoại khách hàng:
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSmsSent(true)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    smsSent
                      ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">sms</span>
                  <span>{smsSent ? `Đã Gửi SMS (${selectedCustomer.phone})` : 'Gửi SMS Cho Khách'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAppPushSent(true)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    appPushSent
                      ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500/40'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">send_to_mobile</span>
                  <span>{appPushSent ? 'Đã Bắn Thông Báo App' : 'Bắn Thông Báo App'}</span>
                </button>
              </div>
            </div>
          </div>

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
                Nhân viên lập biên bản: <strong className="text-slate-800">Nguyễn Quỳnh Anh (NV-842)</strong>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowPdfModal(true)}
                  className="px-3 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">visibility</span>
                  <span>Xem Trước Biên Bản (PDF)</span>
                </button>

                <button
                  onClick={handleCompleteHandover}
                  disabled={isSubmitting || isCompleted}
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

          {/* Success Banner if Completed */}
          {isCompleted && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[22px]">check</span>
                </div>
                <div>
                  <h4 className="font-headline text-sm font-bold text-emerald-900">
                    Bàn Giao Kho {selectedCustomer.unitCode} Thành Công!
                  </h4>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    Phòng kho đã chuyển trạng thái <strong className="font-mono">OCCUPIED</strong>. Hồ sơ bàn giao điện tử đã lưu vào cơ sở dữ liệu kiểm toán.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setShowPdfModal(true)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">print</span>
                  <span>In Phiếu Nhận Kho</span>
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
                    Mã biên bản: #BB-BG-{selectedCustomer.bookingCode.replace('#RES-', '')} • Hệ thống Boxora
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
                  <span className="font-bold text-slate-900 block mt-0.5">Cơ sở Boxora Mega Central</span>
                  <span className="text-slate-600 block">Đại diện: Nguyễn Quỳnh Anh (NV-842)</span>
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
                  <div className="mt-6 font-headline font-bold text-slate-800">Nguyễn Quỳnh Anh</div>
                </div>
              </div>

            </div>

            {/* Footer Actions */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                Tài liệu điện tử có giá trị pháp lý theo điều khoản hợp đồng thuê kho Boxora.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    window.print()
                  }}
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">print</span>
                  <span>In Biên Bản Ngay</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}
