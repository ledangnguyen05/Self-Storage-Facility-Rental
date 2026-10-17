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
import { HandoverCheckInWorkbench } from './components/HandoverCheckInWorkbench'
import { QrCameraCheckInModal } from './components/QrCameraCheckInModal'
import { StaffPolicyGuideModal } from './components/StaffPolicyGuideModal'

export const StaffDashboard: React.FC = () => {
  const { user } = useAuth()
  const { selectedFacility, facilities: contextFacilities } = useOutletContext<{
    selectedFacility?: string
    facilities?: Facility[]
  }>() || {}

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
  const [checkInSuccessMsg, setCheckInSuccessMsg] = useState<string | null>(null)

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFloor, setSelectedFloor] = useState<string>('all')
  const [selectedShiftFilter, setSelectedShiftFilter] = useState<'current' | 'today' | 'all'>('current')

  // Return Inspection Checklist state (Interactive)
  const [inspectionRollDoor, setInspectionRollDoor] = useState<'GOOD' | 'MINOR_DAMAGE' | 'BLOCKED'>('GOOD')
  const [inspectionCleanliness, setInspectionCleanliness] = useState<'CLEAN' | 'NEEDS_CLEANING' | 'DIRTY'>('CLEAN')
  const [inspectionLock, setInspectionLock] = useState<'NORMAL' | 'LATCH_DAMAGED' | 'FAULTY'>('NORMAL')
  const [inspectionCondition, setInspectionCondition] = useState<'GOOD' | 'NEEDS_MAINTENANCE' | 'ALERT'>('GOOD')
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
  const [settlementSuccessMsg, setSettlementSuccessMsg] = useState<string | null>(null)

  // Tickets state
  const [tickets, setTickets] = useState<Array<{
    id: string
    backendId?: string
    title: string
    priority: string
    status: string
  }>>([])

  // Assigned facility identification
  const assignedFacilityName = useMemo(() => {
    if (user?.facilityName) return user.facilityName
    if (user?.facilityId) {
      const f = facilities.find(fac => fac.id === user.facilityId)
      if (f) return f.name
    }
    if (selectedFacility && selectedFacility !== 'ALL') {
      const f = facilities.find(fac => fac.id === selectedFacility)
      if (f) return f.name
    }
    if (facilities.length > 0) {
      return facilities[0].name
    }
    return 'Cơ sở được phân công'
  }, [user, facilities, selectedFacility])

  // Current shift identification
  const currentShiftText = useMemo(() => {
    const hour = new Date().getHours()
    if (hour >= 6 && hour < 14) return 'Ca sáng: 06:00 - 14:00'
    if (hour >= 14 && hour < 22) return 'Ca chiều: 14:00 - 22:00'
    return 'Ca đêm: 22:00 - 06:00'
  }, [])

  // Initial data loading
  useEffect(() => {
    const targetFacility = (!selectedFacility || selectedFacility === 'ALL') ? user?.facilityId : selectedFacility
    fetchArrivals(targetFacility)
    loadFacilities()
    loadTicketQueue()
    loadActiveRentals(targetFacility)
    loadRadarUnits(targetFacility)
    loadFacilityPolicy(targetFacility)
  }, [selectedFacility, user?.facilityId])

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
        const all = await facilityPolicyService.getAll({ size: 1 })
        if (all?.content?.[0]) {
          setStaffFacilityPolicy(all.content[0])
        }
      }
    } catch {
      setStaffFacilityPolicy(null)
    }
  }

  const fetchArrivals = async (facilityId?: string) => {
    try {
      const data = await bookingService.getUpcomingArrivals()
      if (Array.isArray(data)) {
        let filtered = data
        if (facilityId) {
          filtered = filtered.filter(b => b.facilityId === facilityId || !b.facilityId)
        }
        setArrivals(filtered)
        if (filtered.length > 0 && !activeBookingId) {
          setActiveBookingId(filtered[0].id)
        }
      } else {
        setArrivals([])
      }
    } catch {
      setArrivals([])
    }
  }

  const loadActiveRentals = async (facilityId?: string) => {
    try {
      const res = await bookingService.getAll({ status: 'ACTIVE', size: 50 })
      if (res?.content && res.content.length > 0) {
        let filtered = res.content
        if (facilityId) {
          filtered = filtered.filter(b => b.facilityId === facilityId || !b.facilityId)
        }
        setActiveRentals(filtered)
        if (!selectedReturnBookingId && filtered.length > 0) {
          setSelectedReturnBookingId(filtered[0].id)
        }
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

  const loadTicketQueue = async () => {
    try {
      const res = await supportTicketService.getQueue()
      if (Array.isArray(res)) {
        setTickets(res.map(t => ({
          id: `#TK-${t.ticketCode || t.id.slice(0, 6)}`,
          backendId: t.id,
          title: t.title || 'Sự cố tại chỗ',
          priority: t.priority || 'MEDIUM',
          status: t.status || 'OPEN',
        })))
      }
    } catch {
      // fallback
    }
  }

  // Filtered arrivals based on Search, Floor, Shift
  const filteredArrivals = useMemo(() => {
    return arrivals.filter((b) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchName = (b.customerName || '').toLowerCase().includes(q)
        const matchPhone = (b.customerPhone || '').toLowerCase().includes(q)
        const matchBookingCode = (b.bookingCode || '').toLowerCase().includes(q)
        const matchUnitCode = (b.unitCode || '').toLowerCase().includes(q)
        if (!matchName && !matchPhone && !matchBookingCode && !matchUnitCode) return false
      }

      // Floor filter
      if (selectedFloor !== 'all') {
        const uCode = (b.unitCode || '').toUpperCase()
        if (selectedFloor === '1' && !uCode.startsWith('1') && !uCode.startsWith('A') && !uCode.includes('T1')) return false
        if (selectedFloor === '2' && !uCode.startsWith('2') && !uCode.startsWith('B') && !uCode.includes('T2')) return false
        if (selectedFloor === '3' && !uCode.startsWith('3') && !uCode.startsWith('C') && !uCode.includes('T3')) return false
      }

      return true
    })
  }, [arrivals, searchQuery, selectedFloor])

  // Current return target
  const currentReturnBooking = useMemo(() => {
    return activeRentals.find(r => r.id === (selectedReturnBookingId || activeRentals[0]?.id)) || activeRentals[0]
  }, [activeRentals, selectedReturnBookingId])

  const returnDepositAmt = useMemo(() => {
    if (!currentReturnBooking) return 0
    return currentReturnBooking.depositPaid || currentReturnBooking.depositAmount || 0
  }, [currentReturnBooking])

  const expectedRefundAmt = useMemo(() => {
    return Math.max(0, returnDepositAmt - (deductionAmount || 0))
  }, [returnDepositAmt, deductionAmount])

  // Handle file photo selection
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'panoramic' | 'lock') => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          if (type === 'panoramic') setPhotoPanoramic(reader.result)
          else setPhotoLock(reader.result)
        }
      }
      reader.readAsDataURL(file)
    }
  }

  // Handle return settlement
  const handleProcessReturnSettlement = async () => {
    if (!currentReturnBooking) {
      setSettlementSuccessMsg('Vui lòng chọn một hợp đồng đang hiệu lực để nghiệm thu trả kho.')
      return
    }
    setIsSettlingReturn(true)
    try {
      await handoverService.processReturnSettlement({
        bookingId: currentReturnBooking.id,
        recordType: 'RETURN',
        doorConditionPassed: inspectionRollDoor === 'GOOD',
        cleanlinessPassed: inspectionCleanliness === 'CLEAN',
        smartLockPassed: inspectionLock === 'NORMAL',
        sensorPassed: inspectionCondition === 'GOOD',
        wallStructurePassed: true,
        depositSettled: returnDepositAmt,
        deductionAmount: deductionAmount || 0,
        refundMethod: 'VNPAY_REFUND',
        notes: `Nghiệm thu thực địa trả kho: Cửa cuốn: ${inspectionRollDoor}, Vệ sinh: ${inspectionCleanliness}, Khóa: ${inspectionLock}, Tình trạng: ${inspectionCondition}. Khấu trừ đề xuất: ${deductionAmount.toLocaleString('vi-VN')}đ (Lý do: ${deductionReason || 'Không có'}). Dự kiến hoàn: ${expectedRefundAmt.toLocaleString('vi-VN')}đ. Ghi chú thêm: ${inspectionNotes || 'Không có'}.`
      })
      setReturnConfirmed(true)
      setSettlementSuccessMsg(`Đã lập biên bản nghiệm thu trả kho #${currentReturnBooking.unitCode}. Đề xuất hoàn cọc ${expectedRefundAmt.toLocaleString('vi-VN')}đ đã được chuyển sang Quản lý cơ sở / Kế toán phê duyệt.`)
      fetchArrivals()
      loadActiveRentals()
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Có lỗi xảy ra khi nghiệm thu trả kho'
      setSettlementSuccessMsg(`Lỗi nghiệm thu: ${msg}`)
    } finally {
      setIsSettlingReturn(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 text-left max-w-7xl mx-auto w-full">

      {/* 1. HEADER: BÀN VẬN HÀNH QUẦY & TIẾP ĐÓN */}
      <header className="w-full bg-white border border-slate-200/90 shadow-2xs rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center text-white shrink-0 shadow-xs">
              <span className="material-symbols-outlined text-[26px] text-cyan-400">desktop_windows</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-headline text-xl font-bold text-slate-900">
                  Bàn Vận Hành Quầy &amp; Tiếp Đón
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-mono font-bold uppercase tracking-wider">
                  {currentShiftText}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Đang trực ca
                </span>
              </div>
              <span className="text-xs text-slate-500 mt-1">
                Nhân viên trực: <strong className="text-slate-900">{user?.fullName || user?.username || 'Nhân viên trực ca'}</strong> • Cơ sở được phân công: <strong className="text-cyan-800">{assignedFacilityName}</strong>
              </span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => setIsQrScannerOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">qr_code_scanner</span>
              <span>Quét QR Check-in</span>
            </button>
            <button
              type="button"
              onClick={() => setIsPolicyGuideOpen(true)}
              className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Tra cứu nhanh hướng dẫn nghiệp vụ & quy định cơ sở"
            >
              <span className="material-symbols-outlined text-[18px] text-cyan-700">menu_book</span>
              <span>Hướng dẫn nghiệp vụ</span>
            </button>
          </div>
        </div>
      </header>

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
            <span>{arrivals.filter(a => a.status === 'CONFIRMED' || (a.depositPaid || 0) > 0).length} khách đã cọc giữ chỗ</span>
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
            <span className="text-xs text-slate-500">đơn sẵn sàng</span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
            <span>Sẵn sàng đối soát hồ sơ &amp; cấp mã PIN</span>
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
            <Link to="/portal/troubleshoot" className="text-rose-600 hover:text-rose-700 font-bold underline">
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
              <option value="1">Tầng 1</option>
              <option value="2">Tầng 2</option>
              <option value="3">Tầng 3</option>
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

      {/* Main Dual Workspace: Check-in & Handover Workbench + Return Inspection */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* Left Side: Check-in Queue + Handover Workbench (Col 8) */}
        <div className="xl:col-span-8 flex flex-col gap-6">
          
          {/* Handover & Check-in Operator Workbench */}
          <HandoverCheckInWorkbench
            arrivals={arrivals}
            onOpenQrScanner={() => setIsQrScannerOpen(true)}
            activeBookingId={activeBookingId}
            onSelectBooking={setActiveBookingId}
            onHandoverComplete={(bookingId) => {
              setCheckInSuccessMsg(`Hoàn tất quy trình check-in bàn giao buồng kho cho đơn #${bookingId}`)
              fetchArrivals()
              loadActiveRentals()
            }}
          />

          {/* LỊCH HẸN NHẬN KHO TRONG CA */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-900 font-mono">
                Lịch Hẹn Nhận Kho Trong Ca
              </span>
              <span className="text-xs text-slate-500 font-mono">
                {filteredArrivals.length} lượt khách đang chờ
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-mono uppercase tracking-wider text-[11px]">
                    <th className="py-2.5 px-3 rounded-l-lg font-semibold">Khách hàng</th>
                    <th className="py-2.5 px-3 font-semibold">Mã Đặt Chỗ</th>
                    <th className="py-2.5 px-3 font-semibold">Kho Đăng Ký</th>
                    <th className="py-2.5 px-3 font-semibold">Ngày Bắt Đầu</th>
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
                          <span className="font-semibold text-slate-600">Không có khách chờ trong ca trực này</span>
                          <span className="text-[11px] text-slate-400">Tất cả lịch hẹn tiếp đón đã được phục vụ hoặc chưa có lịch hẹn mới.</span>
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
                            <span className="font-mono font-bold text-cyan-700">Kho #{b.unitCode}</span>
                            <span className="text-slate-500 block text-[10px]">{b.facilityName || assignedFacilityName}</span>
                          </td>
                          <td className="py-3.5 px-3 font-mono tabular-nums text-slate-700">{b.startDate}</td>
                          <td className="py-3.5 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              b.status === 'CONFIRMED'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}>
                              {b.status === 'CONFIRMED' ? 'Đã xác nhận' : 'Chờ cọc'}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 font-mono font-bold text-slate-900 tabular-nums">
                            {(b.depositPaid || b.depositAmount || 0).toLocaleString('vi-VN')}đ
                          </td>
                          <td className="py-3.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveBookingId(b.id)
                                document.getElementById('handover-workbench')?.scrollIntoView({ behavior: 'smooth' })
                              }}
                              className={`px-3 py-1.5 rounded-lg font-bold text-[11px] transition-colors cursor-pointer flex items-center gap-1 ml-auto ${
                                isCurrentActive
                                  ? 'bg-cyan-600 text-white shadow-xs'
                                  : 'bg-blue-50 hover:bg-blue-100 text-blue-700'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[14px]">
                                {isCurrentActive ? 'task_alt' : 'touch_app'}
                              </span>
                              <span>{isCurrentActive ? 'Đang Xử Lý' : 'Tiếp đón & Đối soát'}</span>
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* SƠ ĐỒ KHO BÀN GIAO THỰC TẾ TẠI CƠ SỞ */}
            <div className="mt-8 pt-5 border-t border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-slate-700">map</span>
                  <span className="font-headline text-xs font-bold text-slate-900">
                    Sơ Đồ Kho Bàn Giao Thực Tế ({radarUnits.length} lô kho)
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="flex items-center gap-1 text-slate-600">
                    <span className="w-2.5 h-2.5 rounded bg-white border border-slate-300"></span> Trống
                  </span>
                  <span className="flex items-center gap-1 text-blue-700 font-semibold">
                    <span className="w-2.5 h-2.5 rounded bg-blue-600"></span> Chờ bàn giao
                  </span>
                  <span className="flex items-center gap-1 text-slate-600">
                    <span className="w-2.5 h-2.5 rounded bg-slate-300"></span> Đang thuê
                  </span>
                  <span className="flex items-center gap-1 text-purple-700">
                    <span className="w-2.5 h-2.5 rounded bg-purple-200 border border-purple-300"></span> Bảo trì
                  </span>
                </div>
              </div>

              {radarUnits.length === 0 ? (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-400 text-xs">
                  Không có dữ liệu lô kho tại cơ sở {assignedFacilityName}.
                </div>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-center">
                  {radarUnits.slice(0, 16).map((u) => {
                    const isTargetHandover = arrivals.some(a => a.unitCode === u.unitCode)
                    if (isTargetHandover) {
                      return (
                        <div key={u.id} className="p-2 rounded bg-blue-600 text-white font-bold text-xs shadow-xs" title="Kho đang có lịch hẹn chờ bàn giao">
                          #{u.unitCode}<br/><span className="text-[9px] uppercase tracking-tight">BÀN GIAO</span>
                        </div>
                      )
                    }
                    if (u.status === 'AVAILABLE') {
                      return (
                        <div key={u.id} className="p-2 rounded bg-white border border-slate-200 text-slate-800 text-xs" title="Kho sẵn sàng cho thuê">
                          #{u.unitCode}<br/><span className="text-[9px] text-emerald-600 font-bold">TRỐNG</span>
                        </div>
                      )
                    }
                    if (u.status === 'MAINTENANCE' || u.status === 'UNDER_MAINTENANCE') {
                      return (
                        <div key={u.id} className="p-2 rounded bg-purple-50 border border-purple-200 text-purple-800 text-xs" title="Kho đang bảo trì kỹ thuật">
                          #{u.unitCode}<br/><span className="text-[9px] text-purple-700 font-bold">BẢO TRÌ</span>
                        </div>
                      )
                    }
                    return (
                      <div key={u.id} className="p-2 rounded bg-slate-200 text-slate-600 text-xs" title="Kho đang trong hợp đồng thuê hiệu lực">
                        #{u.unitCode}<br/><span className="text-[9px] text-slate-500">ĐANG THUÊ</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Right Side: Nghiệm Thu Trả Kho & Biên Bản Hiện Trường (Col 4) */}
        <div className="xl:col-span-4 flex flex-col gap-6">
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
                      value={selectedReturnBookingId || activeRentals[0]?.id}
                      onChange={(e) => {
                        setSelectedReturnBookingId(e.target.value)
                        setReturnConfirmed(false)
                        setSettlementSuccessMsg(null)
                      }}
                      className="px-2.5 py-1 rounded bg-white border border-slate-200 text-slate-800 font-mono text-[11px] font-bold focus:outline-none cursor-pointer"
                    >
                      {activeRentals.map(r => (
                        <option key={r.id} value={r.id}>
                          {r.bookingCode} - Kho #{r.unitCode}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 text-sm block">{currentReturnBooking?.customerName || 'Khách thuê'}</span>
                    <span className="text-xs text-slate-500">SĐT: {currentReturnBooking?.customerPhone || 'N/A'}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
                    <span className="text-slate-800">Kho: <strong className="font-mono text-cyan-800">#{currentReturnBooking?.unitCode}</strong></span>
                    <span className="text-amber-700 font-mono font-bold text-[11px]">Hạn trả: {currentReturnBooking?.endDate || 'Đến hạn'}</span>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl mb-4 text-xs text-slate-500 text-center">
                  Hiện không có hợp đồng nào đến hạn nghiệm thu trả kho.
                </div>
              )}

              {/* Biểu Mẫu Thẩm Định Hiện Trường (Tương tác thực tế) */}
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
                  <input
                    type="text"
                    value={inspectionNotes}
                    onChange={(e) => setInspectionNotes(e.target.value)}
                    placeholder="Ghi chú thẩm định hiện trường khác..."
                    className="mt-1 px-2.5 py-1 bg-white border border-slate-200 rounded text-[11px] text-slate-800 focus:outline-none"
                  />
                </div>

                {/* Ảnh Hiện Trường Thực Tế (Không dùng Unsplash) */}
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
            </div>

            {settlementSuccessMsg && (
              <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-emerald-600">check_circle</span>
                <span>{settlementSuccessMsg}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleProcessReturnSettlement}
              disabled={returnConfirmed || isSettlingReturn || !currentReturnBooking}
              className={`mt-4 w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
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
          </div>
        </div>

      </div>

      {/* MODAL QUÉT QR CHECK-IN QUA CAMERA */}
      <QrCameraCheckInModal
        isOpen={isQrScannerOpen}
        onClose={() => setIsQrScannerOpen(false)}
        onCheckInSuccess={(bookingId, result) => {
          setActiveBookingId(bookingId)
          setCheckInSuccessMsg(`Check-in qua QR Camera thành công! PIN cấp: ${result.accessPin} (Thẻ: ${result.rfidCard})`)
        }}
        onSelectBookingForWorkbench={(bookingId) => {
          setActiveBookingId(bookingId)
        }}
      />

      {/* MODAL HƯỚNG DẪN NGHIỆP VỤ DÀNH CHO NHÂN VIÊN (CHẾ ĐỘ XEM TẬP TRUNG) */}
      <StaffPolicyGuideModal
        isOpen={isPolicyGuideOpen}
        onClose={() => setIsPolicyGuideOpen(false)}
        facilityId={user?.facilityId || selectedFacility}
        facilityName={staffFacilityPolicy?.facilityName || assignedFacilityName}
      />

    </div>
  )
}
