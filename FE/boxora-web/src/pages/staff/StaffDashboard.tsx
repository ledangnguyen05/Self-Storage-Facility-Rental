import React, { useState, useEffect, useMemo } from 'react'
import { useOutletContext, Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { bookingService } from '../../services/bookingService'
import { handoverService } from '../../services/handoverService'
import { reportService } from '../../services/reportService'
import { masterKeyService } from '../../services/masterKeyService'
import { supportTicketService } from '../../services/supportTicketService'
import { facilityService } from '../../services/facilityService'
import { storageUnitService } from '../../services/storageUnitService'
import { paymentService, PaymentItem } from '../../services/paymentService'
import { Booking, OccupancyReport, StorageUnit, Facility } from '../../types'
import { HandoverCheckInWorkbench } from './components/HandoverCheckInWorkbench'
import { QrCameraCheckInModal } from './components/QrCameraCheckInModal'

export const StaffDashboard: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const { selectedFacility, facilities: contextFacilities } = useOutletContext<{
    selectedFacility?: string
    facilities?: Facility[]
  }>() || {}

  // Stepper state for Spotlight Handover (Trần Minh Tuấn - #A-112)
  const [handoverStep, setHandoverStep] = useState(4)
  const [handoverCompleted, setHandoverCompleted] = useState(false)
  const [isCheckInApiCalling, setIsCheckInApiCalling] = useState(false)
  const [checkInSuccessMsg, setCheckInSuccessMsg] = useState<string | null>(null)

  // QR Code Scanner State
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false)

  // Dynamic arrivals & active rentals from BE
  const [arrivals, setArrivals] = useState<Booking[]>([])
  const [activeRentals, setActiveRentals] = useState<Booking[]>([])
  const [radarUnits, setRadarUnits] = useState<StorageUnit[]>([])
  const [selectedReturnBookingId, setSelectedReturnBookingId] = useState<string>('')
  const [activeBookingId, setActiveBookingId] = useState<string>('')
  const [occupancyData, setOccupancyData] = useState<OccupancyReport | null>(null)
  const [focusedBookingNotice, setFocusedBookingNotice] = useState<string | null>(null)
  const [bookingDetail, setBookingDetail] = useState<Booking | null>(null)
  const [bookingDetailLoading, setBookingDetailLoading] = useState(false)
  const [bookingDetailError, setBookingDetailError] = useState('')
  const bookingDetailId = searchParams.get('bookingId')

  // Master Key Emergency Override Modal (BR-RULE-009)
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false)
  const [emergencyFacilityId, setEmergencyFacilityId] = useState('')
  const [emergencyReason, setEmergencyReason] = useState('Sự cố kẹt khóa điện tử khẩn cấp tại cửa phân khu')
  const [emergencyCategory, setEmergencyCategory] = useState<'MAINTENANCE_EMERGENCY' | 'FIRE_HAZARD' | 'POLICE_WARRANT' | 'ABANDONED_AUCTION' | 'INTERNAL_AUDIT'>('MAINTENANCE_EMERGENCY')
  const [emergencySeverity, setEmergencySeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('CRITICAL')
  const [witnessStaffId, setWitnessStaffId] = useState('')
  const [witnessPassword, setWitnessPassword] = useState('')
  const [isEmergencyCalling, setIsEmergencyCalling] = useState(false)
  const [emergencyResult, setEmergencyResult] = useState<string | null>(null)
  const [emergencyError, setEmergencyError] = useState<string | null>(null)
  const [facilities, setFacilities] = useState<any[]>([])

  // Inspection Return state
  const [returnConfirmed, setReturnConfirmed] = useState(false)
  const [isSettlingReturn, setIsSettlingReturn] = useState(false)
  const [settlementSuccessMsg, setSettlementSuccessMsg] = useState<string | null>(null)

  // Ticket status state
  const [tickets, setTickets] = useState<Array<{
    id: string
    backendId?: string
    title: string
    detail: string
    location: string
    priority: string
    staff: string
    time: string
    status: string
  }>>([])

  // Live Shift Revenue & Cashier Payments from DB
  const [shiftPayments, setShiftPayments] = useState<PaymentItem[]>([])
  const [isShiftPaymentsLoading, setIsShiftPaymentsLoading] = useState(false)

  useEffect(() => {
    const targetFacility = (!selectedFacility || selectedFacility === 'ALL') ? undefined : selectedFacility
    fetchArrivals(targetFacility)
    fetchOccupancy(targetFacility)
    loadFacilities()
    loadTicketQueue()
    loadActiveRentals(targetFacility)
    loadRadarUnits(targetFacility)
    loadShiftPayments(targetFacility)
  }, [selectedFacility])

  useEffect(() => {
    if (!bookingDetailId) {
      setBookingDetail(null)
      setBookingDetailError('')
      setBookingDetailLoading(false)
      return
    }

    let isCurrent = true
    setBookingDetail(null)
    setBookingDetailError('')
    setBookingDetailLoading(true)
    bookingService.getById(bookingDetailId)
      .then(booking => {
        if (isCurrent) setBookingDetail(booking)
      })
      .catch(() => {
        if (isCurrent) setBookingDetailError('Không tải được yêu cầu đặt kho tại cơ sở của bạn.')
      })
      .finally(() => {
        if (isCurrent) setBookingDetailLoading(false)
      })

    return () => { isCurrent = false }
  }, [bookingDetailId])

  const closeBookingDetail = () => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('bookingId')
    setSearchParams(nextParams, { replace: true })
  }

  const loadShiftPayments = async (facilityId?: string) => {
    setIsShiftPaymentsLoading(true)
    try {
      const res = await paymentService.getPayments({ size: 20, facilityId: facilityId || undefined })
      if (Array.isArray(res)) {
        setShiftPayments(res)
      } else {
        setShiftPayments([])
      }
    } catch {
      setShiftPayments([])
    } finally {
      setIsShiftPaymentsLoading(false)
    }
  }

  const loadRadarUnits = async (facilityId?: string) => {
    try {
      const units = await storageUnitService.getUnits(facilityId ? { facilityId } : undefined)
      if (Array.isArray(units)) {
        setRadarUnits(units)
      } else {
        setRadarUnits([])
      }
    } catch {
      setRadarUnits([])
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
        if (!filtered.some(booking => booking.id === selectedReturnBookingId)) setSelectedReturnBookingId('')
      } else {
        setActiveRentals([])
        setSelectedReturnBookingId('')
      }
    } catch {
      setActiveRentals([])
    }
  }

  const loadFacilities = async () => {
    try {
      if (contextFacilities && contextFacilities.length > 0) {
        setFacilities(contextFacilities)
        setEmergencyFacilityId(contextFacilities[0].id)
        return
      }
      const res = await facilityService.getFacilities()
      if (res?.content && res.content.length > 0) {
        setFacilities(res.content)
        setEmergencyFacilityId(res.content[0].id)
      }
    } catch {
      // Fallback
    }
  }

  const loadTicketQueue = async () => {
    try {
      const res = await supportTicketService.getQueue()
      if (res && Array.isArray(res)) {
        setTickets(res.map((t: any) => ({
          id: t.ticketCode || (t.id ? `#TK-${t.id.slice(0, 4)}` : '#TK-0000'),
          backendId: t.id,
          title: t.title || 'Sự cố thiết bị',
          detail: t.customerName ? `${t.customerName} - ${t.description || 'Chi tiết hiện trường'}` : (t.description || 'Chi tiết hiện trường'),
          location: t.unitCode ? `Kho #${t.unitCode}` : (t.category || 'Kho Boxora'),
          priority: t.priority || 'MEDIUM',
          staff: t.assignedStaffName || 'Nhân viên trực ca',
          time: t.createdAt ? new Date(t.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'Hôm nay',
          status: t.status || 'IN_PROGRESS'
        })))
      }
    } catch {
      // Empty on error
    }
  }

  const fetchOccupancy = async (facilityId?: string) => {
    try {
      const scopedFacilityId = facilityId ?? ((!selectedFacility || selectedFacility === 'ALL') ? undefined : selectedFacility)
      const res = await reportService.getOccupancyReport(scopedFacilityId)
      if (res) {
        setOccupancyData(res)
      }
    } catch {
      // Keep static defaults on network error
    }
  }

  const fetchArrivals = async (facilityId?: string) => {
    try {
      const res = await bookingService.getUpcomingArrivals()
      if (res && Array.isArray(res)) {
        let filtered = res
        if (facilityId) {
          filtered = filtered.filter(b => b.facilityId === facilityId || !b.facilityId)
        }
        setArrivals(filtered)
      } else {
        setArrivals([])
      }
    } catch {
      setArrivals([])
    }
  }

  const handleExecuteEmergencyOverride = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsEmergencyCalling(true)
    setEmergencyResult(null)
    setEmergencyError(null)
    try {
      await masterKeyService.executeOverride({
        facilityId: emergencyFacilityId,
        category: emergencyCategory,
        severity: emergencySeverity,
        witnessUserId: witnessStaffId,
        witnessPassword,
        reason: emergencyReason
      })
      setEmergencyResult('Lệnh khẩn cấp đã được kích hoạt thành công qua Master Key Service. Cửa sảnh và rào chắn kiểm soát mở cưỡng chế trong 60 giây.')
    } catch (err: any) {
      console.warn('MasterKey override failed:', err)
      setEmergencyError(err?.response?.data?.message || 'Không thể xác thực lệnh Master Key. Chưa có thao tác mở cửa nào được xác nhận.')
    } finally {
      setIsEmergencyCalling(false)
    }
  }

  const handleProcessReturnSettlement = async () => {
    const returnTargetId = selectedReturnBookingId || (activeRentals.length > 0 ? activeRentals[0].id : null)
    if (!returnTargetId) {
      setSettlementSuccessMsg('Vui lòng chọn một lượt thuê đang hiệu lực để nghiệm thu trả kho.')
      return
    }
    const targetBooking = activeRentals.find(r => r.id === returnTargetId) || activeRentals[0]
    setIsSettlingReturn(true)
    try {
      await handoverService.processReturnSettlement({
        bookingId: returnTargetId,
        recordType: 'RETURN',
        doorConditionPassed: true,
        cleanlinessPassed: true,
        smartLockPassed: true,
        sensorPassed: true,
        wallStructurePassed: true,
        depositSettled: targetBooking?.depositPaid || targetBooking?.depositAmount || 0,
        deductionAmount: 0,
        refundMethod: 'VNPAY_REFUND',
        notes: 'Kho nguyên vẹn, sàn sạch, khóa SmartLock và cảm biến hoạt động tốt.'
      })
      setReturnConfirmed(true)
      setSettlementSuccessMsg(`Đã hoàn tất nghiệm thu trả kho #${targetBooking?.unitCode || ''}. Lệnh hoàn cọc đã được chuyển sang cổng thanh toán tự động.`)
      fetchArrivals()
      fetchOccupancy()
      loadActiveRentals()
    } catch (err: any) {
      console.warn('Return settlement failed:', err)
      const msg = err?.response?.data?.message || err?.message || 'Có lỗi xảy ra khi nghiệm thu trả kho'
      setSettlementSuccessMsg(`Lỗi nghiệm thu: ${msg}`)
    } finally {
      setIsSettlingReturn(false)
    }
  }

  const handleResolveTicket = async (ticketId: string, backendId?: string) => {
    try {
      const targetId = backendId || ticketId.replace('#', '')
      if (targetId) {
        await supportTicketService.resolveTicket(targetId, 'Đã kiểm tra hiện trường và xử lý xong tại chỗ')
      }
    } catch (err) {
      console.warn('Ticket resolve fallback:', err)
    }
    setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: 'RESOLVED' } : t))
  }

  // Quick Walkin Modal
  const [isWalkinOpen, setIsWalkinOpen] = useState(false)
  const [walkinName, setWalkinName] = useState('')
  const [walkinPhone, setWalkinPhone] = useState('')
  const [walkinSuccess, setWalkinSuccess] = useState(false)
  const [activeEvidenceModal, setActiveEvidenceModal] = useState<{
    ticketId: string
    title: string
    images: string[]
  } | null>(null)

  const handleWalkinSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setWalkinSuccess(true)
    setTimeout(() => {
      setWalkinSuccess(false)
      setIsWalkinOpen(false)
      setWalkinName('')
      setWalkinPhone('')
    }, 1500)
  }

  const currentReturnBooking = activeRentals.find(r => r.id === selectedReturnBookingId)
  const returnDepositAmt = currentReturnBooking ? (currentReturnBooking.depositPaid || currentReturnBooking.depositAmount || 0) : 0
  const facilityTotalUnits = facilities.find(facility => facility.id === selectedFacility)?.totalUnits
  const facilityOccupancy = occupancyData?.byFacility?.find(facility => facility.facilityId === selectedFacility)
  const fallbackReportTotal = selectedFacility && selectedFacility !== 'ALL'
    ? facilityOccupancy?.totalUnits || 0
    : occupancyData?.byFacility?.reduce((sum, facility) => sum + facility.totalUnits, 0) || 0
  const fallbackReportOccupied = selectedFacility && selectedFacility !== 'ALL'
    ? facilityOccupancy?.occupiedUnits || 0
    : occupancyData?.byFacility?.reduce((sum, facility) => sum + facility.occupiedUnits, 0) || 0
  const reportedTotalUnits = occupancyData?.systemSummary?.totalUnits || fallbackReportTotal
  const totalFacilityUnits = reportedTotalUnits || radarUnits.length || facilityTotalUnits || 0
  const occupiedFacilityUnits = reportedTotalUnits
    ? (occupancyData?.systemSummary?.totalUnits
      ? occupancyData.systemSummary.occupiedUnits
      : fallbackReportOccupied)
    : radarUnits.length
      ? radarUnits.filter(unit => unit.status === 'OCCUPIED').length
      : activeRentals.length
  const occupancyRate = totalFacilityUnits > 0
    ? (occupiedFacilityUnits / totalFacilityUnits) * 100
    : 0

  // Live shift revenue calculations from DB
  const shiftTotalCollected = useMemo(() => {
    return shiftPayments.filter(p => p.status === 'SUCCESS').reduce((sum, p) => sum + (p.amount || 0), 0)
  }, [shiftPayments])

  const shiftRentalRevenue = useMemo(() => {
    return shiftPayments
      .filter(p => p.status === 'SUCCESS' && (!p.paymentType || p.paymentType === 'RENTAL' || p.paymentType === 'CONTRACT' || p.paymentType === 'EXTEND'))
      .reduce((sum, p) => sum + (p.amount || 0), 0)
  }, [shiftPayments])

  const shiftDepositRevenue = useMemo(() => {
    return shiftPayments
      .filter(p => p.status === 'SUCCESS' && p.paymentType === 'DEPOSIT')
      .reduce((sum, p) => sum + (p.amount || 0), 0)
  }, [shiftPayments])

  const handleExportShiftLedgerCsv = () => {
    if (!shiftPayments || shiftPayments.length === 0) {
      alert('Không có dữ liệu giao dịch để xuất sổ thu ngân.')
      return
    }
    const headers = ['Mã GD', 'Khách hàng', 'Mã Kho', 'Cơ sở', 'Số tiền (VNĐ)', 'Phương thức', 'Loại thanh toán', 'Thời gian', 'Trạng thái']
    const rows = shiftPayments.map(p => [
      p.id,
      p.customerName || 'N/A',
      p.unitCode || 'N/A',
      p.facilityName || 'Boxora',
      p.amount,
      p.paymentMethod || 'VNPay',
      p.paymentType || 'RENTAL',
      p.paymentTime ? new Date(p.paymentTime).toLocaleString('vi-VN') : '',
      p.status
    ])
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `So_Thu_Ngan_Ca_Truc_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="staff-dashboard-page flex flex-col gap-6 text-left max-w-7xl mx-auto">
      
      {/* 1. TOP OPERATIONAL SHIFT HEADER */}
      <div className="w-full bg-white border border-slate-200/90 shadow-2xs rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center text-white shrink-0 shadow-xs">
              <span className="material-symbols-outlined text-[26px] text-cyan-400">desktop_windows</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-headline text-xl font-bold text-slate-900">
                  Bàn Vận Hành Quầy &amp; Tiếp Đón Thực Địa
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-mono font-bold uppercase tracking-wider">
                  Ca sáng: 08:00 - 16:30
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Đang trực ca
                </span>
              </div>
              <span className="text-xs text-slate-500 mt-1">
                Phụ trách tiếp đón, kiểm toán hiện trường và xử lý sự cố phát sinh.
              </span>
            </div>
          </div>

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
              onClick={() => setIsWalkinOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5 transition-colors border border-slate-200 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">person_add</span>
              <span>Khách Walk-in Vãng Lai</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. AUTONOMOUS 4-METRIC KPI DASHBOARD ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Metric 1 */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500 font-mono">
              Lịch Check-in Ca Trực
            </span>
            <span className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <span className="material-symbols-outlined text-[18px]">how_to_reg</span>
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-1.5">
            <span className="font-headline text-3xl font-extrabold text-slate-900 tabular-nums">{arrivals.length}</span>
            <span className="text-xs text-slate-500">lịch hẹn</span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-700 font-semibold">
            <span className="h-2 w-2 rounded-full bg-blue-600"></span>
            <span>{arrivals.filter(a => a.status === 'CONFIRMED').length} khách đã cọc giữ chỗ</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500 font-mono">
              Kho Đang Thuê Hoạt Động
            </span>
            <span className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-700">
              <span className="material-symbols-outlined text-[18px]">assignment_return</span>
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-1.5">
            <span className="font-headline text-3xl font-extrabold text-amber-700 tabular-nums">
              {occupancyData?.systemSummary?.occupiedUnits ?? activeRentals.length}
            </span>
            <span className="text-xs text-slate-500">hợp đồng hiệu lực</span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
            <span>{activeRentals.length} hợp đồng quản lý trực ca</span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider font-bold text-rose-700 font-mono">
              Sự Cố Tại Chỗ (On-site)
            </span>
            <span className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
              <span className="material-symbols-outlined text-[18px]">warning</span>
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-1.5">
            <span className="font-headline text-3xl font-extrabold text-rose-600 tabular-nums">
              {tickets.filter(t => t.status !== 'RESOLVED').length}
            </span>
            <span className="text-xs text-slate-500">ticket đang mở</span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-rose-700 font-bold">
            <span>{tickets.filter(t => t.priority === 'HIGH' && t.status !== 'RESOLVED').length} ca mức độ Cao</span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500 font-mono">
              Tỷ Lệ Lấp Đầy Hiện Hữu
            </span>
            <span className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
              <span className="material-symbols-outlined text-[18px]">pie_chart</span>
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="font-headline text-3xl font-extrabold text-slate-900 tabular-nums">
              {occupancyRate.toFixed(1)}%
            </span>
            <span className="font-mono text-xs text-slate-500">
              {occupiedFacilityUnits}/{totalFacilityUnits} KHO
            </span>
          </div>
          <div className="mt-3 w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-blue-600 h-full rounded-full transition-all" 
              style={{ width: `${occupancyRate}%` }}
            ></div>
          </div>
        </div>

      </div>

      {/* 3. TACTICAL SEARCH & LOCATION FILTER RIBBON */}
      <div className="w-full bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex-1 relative">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
            search
          </span>
          <input
            type="text"
            placeholder="Tìm kiếm nhanh tên khách hàng, SĐT, mã đặt chỗ #RES-XXXX, hoặc mã số kho..."
            className="w-full pl-10 pr-3 py-2 bg-slate-50 text-slate-900 text-xs rounded-xl border border-slate-200 focus:outline-none focus:bg-white focus:border-blue-600 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs">
            <span className="text-slate-500 font-medium">Khu vực:</span>
            <select className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer">
              <option value="all">Tất cả tầng</option>
              <option value="Tầng 1">Tầng 1</option>
              <option value="Tầng 2">Tầng 2</option>
              <option value="Tầng 3">Tầng 3</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs">
            <span className="text-slate-500 font-medium">Khung giờ:</span>
            <select className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer">
              <option value="current">Ca Hiện Tại (08:00 - 16:30)</option>
              <option value="today">Trọn Vẹn Hôm Nay</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Dual Workspace: Check-in Queue + Return Inspections */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* Left Side: Live Check-in & Handover Stepper Card (Col 8) */}
        <div className="xl:col-span-8 flex flex-col gap-6">
          {/* Handover & Check-in Operator Workbench */}
          <HandoverCheckInWorkbench
            arrivals={arrivals}
            activeBookingId={activeBookingId}
            onHandoverComplete={(bookingId) => {
              setCheckInSuccessMsg(`Hoàn tất quy trình check-in bàn giao buồng kho cho đơn #${bookingId}`)
              fetchArrivals()
              fetchOccupancy()
              loadActiveRentals()
            }}
          />

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">

            {/* Upcoming Appointments Table */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-900 font-mono">
                Danh sách hẹn tiếp theo trong ca trực
              </span>
              <span className="text-xs text-slate-500 font-mono">
                {arrivals.length} lượt khách
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
                  {arrivals.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                        Không có lịch hẹn nhận kho nào đang chờ trong ca trực hiện tại.
                      </td>
                    </tr>
                  ) : (
                    arrivals.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-3">
                          <div className="font-bold text-slate-900 text-xs">{b.customerName || 'Khách vãng lai'}</div>
                          <div className="text-slate-500 font-mono text-[11px] tabular-nums mt-0.5">{b.customerPhone || 'N/A'}</div>
                        </td>
                        <td className="py-3.5 px-3 font-mono font-bold text-slate-900">{b.bookingCode}</td>
                        <td className="py-3.5 px-3">
                          <span className="font-mono font-bold text-cyan-700">Kho #{b.unitCode}</span>
                          <span className="text-slate-500 block text-[10px]">{b.facilityName || 'Boxora'}</span>
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
                            onClick={() => {
                              setActiveBookingId(b.id)
                              setFocusedBookingNotice(`Đã chọn tiếp đón khách hàng ${b.customerName} (${b.bookingCode})`)
                              document.getElementById('handover-workbench')?.scrollIntoView({ behavior: 'smooth' })
                            }}
                            className="px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-semibold text-[11px] transition-colors cursor-pointer"
                          >
                            Tiếp đón
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>


            {/* Radar Floor Units Indicator */}
            <div className="mt-6 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-slate-700">map</span>
                  <span className="font-headline text-xs font-bold text-slate-900">
                    Sơ Đồ Lô Kho Bàn Giao Thực Tế {radarUnits.length > 0 ? `(${radarUnits.length} lô kho)` : ''}
                  </span>
                </div>
                <span className="font-mono text-[11px] text-slate-400">
                  {selectedFacility && selectedFacility !== 'ALL'
                    ? facilities.find(f => f.id === selectedFacility)?.name || 'Cơ sở đã chọn'
                    : 'Toàn hệ thống'}
                </span>
              </div>

              {radarUnits.length === 0 ? (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-400 text-xs">
                  Không có dữ liệu lô kho tại cơ sở này.
                </div>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl font-unit-code text-center">
                  {radarUnits.slice(0, 8).map((u) => {
                    const isTargetHandover = arrivals.some(a => a.unitCode === u.unitCode)
                    if (isTargetHandover) {
                      return (
                        <div key={u.id} className="p-2 rounded bg-blue-600 text-white font-bold text-xs shadow-xs">
                          #{u.unitCode}<br/><span className="text-[10px] uppercase font-semibold">BÀN GIAO</span>
                        </div>
                      )
                    }
                    if (u.status === 'AVAILABLE') {
                      return (
                        <div key={u.id} className="p-2 rounded bg-white border border-slate-200 text-slate-800 text-xs">
                          #{u.unitCode}<br/><span className="text-[10px] text-emerald-600 font-bold">TRỐNG</span>
                        </div>
                      )
                    }
                    if (u.status === 'MAINTENANCE' || u.status === 'UNDER_MAINTENANCE') {
                      return (
                        <div key={u.id} className="p-2 rounded bg-purple-50 border border-purple-200 text-purple-800 text-xs">
                          #{u.unitCode}<br/><span className="text-[10px] text-purple-700 font-bold">BẢO TRÌ</span>
                        </div>
                      )
                    }
                    return (
                      <div key={u.id} className="p-2 rounded bg-slate-200 text-slate-600 text-xs">
                        #{u.unitCode}<br/><span className="text-[10px] text-slate-400 font-normal">Đang thuê</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Right Side: Return & Condition Inspection Flow (Col 4) */}
        <div className="xl:col-span-4 flex flex-col gap-6">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col">
            <div>
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600 text-[22px]">fact_check</span>
                  <h2 className="font-headline text-base font-bold text-slate-900">Nghiệm Thu Trả Kho</h2>
                </div>
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px] font-bold">
                  #FLOW-RET-07
                </span>
              </div>

              {/* Target Contract Profile */}
              {activeRentals.length > 0 ? (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl mb-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Hồ Sơ Cần Nghiệm Thu</span>
                    <select
                      value={selectedReturnBookingId}
                      onChange={(e) => {
                        setSelectedReturnBookingId(e.target.value)
                        setReturnConfirmed(false)
                        setSettlementSuccessMsg(null)
                      }}
                      className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-800 font-mono text-[10px] font-bold focus:outline-none"
                    >
                      <option value="">Chọn đơn trả kho</option>
                      {activeRentals.map(r => (
                        <option key={r.id} value={r.id}>
                          {r.bookingCode} - Kho #{r.unitCode}
                        </option>
                      ))}
                    </select>
                  </div>
                  {currentReturnBooking ? (
                    <>
                      <div className="mt-1">
                        <span className="font-bold text-slate-900 text-sm block">{currentReturnBooking.customerName || 'Khách thuê'}</span>
                        <span className="text-xs text-slate-500">SĐT: {currentReturnBooking.customerPhone || 'N/A'}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
                        <span className="text-slate-800">Vị trí: <strong className="font-mono text-slate-900">Kho #{currentReturnBooking.unitCode}</strong></span>
                        <span className="text-amber-700 font-mono font-bold text-[11px]">Hạn: {currentReturnBooking.endDate}</span>
                      </div>
                    </>
                  ) : (
                    <p className="mt-3 text-xs text-slate-500">Chọn hồ sơ trả kho để bắt đầu nghiệm thu.</p>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl mb-4 text-xs text-slate-500 text-center">
                  Chưa có hợp đồng nào đến hạn nghiệm thu trả kho
                </div>
              )}

              {/* 4 Inspection Checklist Items */}
              {currentReturnBooking && <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-900 font-mono">
                    Biên bản thẩm định hiện trường
                  </span>
                  <span className="text-xs text-slate-500 font-mono">4/4 tiêu chuẩn</span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-slate-500 text-[18px]">garage</span>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-slate-900">Tình trạng cửa cuốn</span>
                      <span className="text-[10px] text-slate-500">Mở êm, không móp méo, ray dẫn tốt</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 text-[10px] font-bold">
                    Tốt
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-slate-500 text-[18px]">cleaning_services</span>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-slate-900">Vệ sinh kho &amp; sàn</span>
                      <span className="text-[10px] text-slate-500">Đã dọn sạch rác, không ẩm ướt</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 text-[10px] font-bold">
                    Sạch sẽ
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-slate-500 text-[18px]">lock</span>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-slate-900">Ổ khóa Smart Lock</span>
                      <span className="text-[10px] text-slate-500">Cảm biến nhạy, pin 92%</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 text-[10px] font-bold">
                    Bình thường
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-slate-500 text-[18px]">thermostat</span>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-slate-900">Cảm biến nhiệt / ẩm</span>
                      <span className="text-[10px] text-slate-500 font-mono">22°C • 48% RH (Chuẩn)</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 text-[10px] font-bold">
                    Chuẩn
                  </span>
                </div>

                {/* Proof Photos */}
                <div className="mt-2 p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-slate-900 uppercase font-mono">
                      Ảnh chụp hiện trường (Bắt buộc)
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">2/2 ảnh</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative rounded-lg overflow-hidden h-20 shadow-sm bg-slate-200">
                      <img 
                        className="w-full h-full object-cover" 
                        src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=400&q=80" 
                        alt="Toàn cảnh kho"
                      />
                      <span className="absolute bottom-1 left-1 px-1 bg-slate-900/80 text-white text-[9px] rounded font-mono">
                        Toàn cảnh kho
                      </span>
                    </div>
                    <div className="relative rounded-lg overflow-hidden h-20 shadow-sm bg-slate-200">
                      <img 
                        className="w-full h-full object-cover" 
                        src="https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&w=400&q=80" 
                        alt="Ổ khóa số"
                      />
                      <span className="absolute bottom-1 left-1 px-1 bg-slate-900/80 text-white text-[9px] rounded font-mono">
                        Ổ khóa số
                      </span>
                    </div>
                  </div>
                </div>

                {/* Settlement Summary */}
                <div className="mt-2 p-3.5 rounded-xl bg-slate-100 border border-slate-200 flex flex-col gap-1.5 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Tiền cọc giữ ban đầu:</span>
                    <span className="font-mono tabular-nums font-bold text-slate-800">
                      {returnDepositAmt.toLocaleString('vi-VN')}đ
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Khấu trừ vệ sinh/hư hại:</span>
                    <span className="font-mono tabular-nums text-slate-500">0đ</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-900 pt-2 border-t border-slate-200">
                    <span className="font-bold">Số tiền hoàn trả khách:</span>
                    <span className="font-mono tabular-nums text-base text-emerald-600 font-extrabold">
                      {returnDepositAmt.toLocaleString('vi-VN')}đ
                    </span>
                  </div>
                </div>
              </div>}
            </div>

            {currentReturnBooking && settlementSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-emerald-600">check_circle</span>
                <span>{settlementSuccessMsg}</span>
              </div>
            )}

            {currentReturnBooking && <button
              onClick={handleProcessReturnSettlement}
              disabled={returnConfirmed || isSettlingReturn}
              className={`mt-4 w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer ${
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
                {returnConfirmed ? 'ĐÃ HOÀN CỌC & TRẢ KHO' : isSettlingReturn ? 'Đang Xử Lý Quyết Toán Cọc...' : 'Xác Nhận Trả Kho & Hoàn Trả Cọc'}
              </span>
            </button>}
          </div>
        </div>

      </div>

      {/* QUICK WORKSPACE ACCESS: BÁO CÁO THU NGÂN & XỬ LÝ SỰ CỐ (ĐÃ CHUYỂN THÀNH 2 PHẦN RIÊNG CÓ PHÂN TRANG) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Báo Cáo Thu Ngân */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col justify-between hover:border-emerald-300 transition-all group">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <span className="material-symbols-outlined text-[22px]">point_of_sale</span>
                </div>
                <div>
                  <h3 className="font-headline text-base font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                    Báo Cáo Thu Ngân & Dòng Tiền Ca Trực
                  </h3>
                  <p className="text-xs text-slate-500">
                    Đối soát giao dịch, tiền mặt, VNPay và phân trang chuyên sâu
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                {shiftPayments.length} giao dịch
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-500 font-medium block">Tổng thực thu</span>
                <span className="text-lg font-bold text-slate-900 font-mono">
                  {shiftTotalCollected.toLocaleString('vi-VN')} ₫
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-500 font-medium block">Tiền cọc giữ chỗ</span>
                <span className="text-lg font-bold text-emerald-700 font-mono">
                  {shiftDepositRevenue.toLocaleString('vi-VN')} ₫
                </span>
              </div>
            </div>
          </div>

          <Link
            to="/portal/cashier"
            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer"
          >
            <span>Mở Trang Báo Cáo Thu Ngân (Có Phân Trang)</span>
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </Link>
        </div>

        {/* Card 2: Danh Sách Ticket */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col justify-between hover:border-rose-300 transition-all group">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <span className="material-symbols-outlined text-[22px]">build_circle</span>
                </div>
                <div>
                  <h3 className="font-headline text-base font-bold text-slate-900 group-hover:text-rose-700 transition-colors">
                    Xử Lý Sự Cố Tại Chỗ & Ticket
                  </h3>
                  <p className="text-xs text-slate-500">
                    Theo dõi phiếu kỹ thuật, xử lý cửa cuốn, khóa điện tử và phân trang
                  </p>
                </div>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                tickets.filter(t => t.status !== 'RESOLVED').length > 0
                  ? 'bg-rose-50 text-rose-700 border border-rose-200 animate-pulse'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}
              >
                {tickets.filter(t => t.status !== 'RESOLVED').length} đang mở
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-500 font-medium block">Tổng phiếu ca trực</span>
                <span className="text-lg font-bold text-slate-900 font-mono">
                  {tickets.length} ticket
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-500 font-medium block">Ưu tiên khẩn cấp</span>
                <span className="text-lg font-bold text-rose-600 font-mono">
                  {tickets.filter(t => t.priority === 'HIGH' && t.status !== 'RESOLVED').length} phiếu
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setEmergencyResult(null)
              setEmergencyError(null)
              setWitnessStaffId('')
              setWitnessPassword('')
              setIsEmergencyModalOpen(true)
            }}
            className="mb-2 w-full py-2.5 px-4 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[17px]">lock_open</span>
            <span>Mở công cụ Master Key khẩn cấp</span>
          </button>

          <Link
            to="/portal/tickets"
            className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer"
          >
            <span>Mở Trang Xử Lý Sự Cố (Có Phân Trang)</span>
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </Link>
        </div>
      </div>

      {/* Walkin Modal */}
      {isWalkinOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            {walkinSuccess ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <span className="material-symbols-outlined text-[28px]">check_circle</span>
                </div>
                <h3 className="font-headline text-lg font-bold text-slate-900">
                  Đã Đăng Ký Khách Vãng Lai!
                </h3>
                <p className="text-xs text-slate-600">
                  Mã thẻ tạm #WALK-{Math.floor(100 + Math.random() * 900)} đã được kích hoạt cho khách tham quan.
                </p>
              </div>
            ) : (
              <form onSubmit={handleWalkinSubmit} className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="font-headline text-base font-bold text-slate-900">
                    Tiếp Đón Khách Vãng Lai (Walk-in)
                  </h3>
                  <button type="button" onClick={() => setIsWalkinOpen(false)} className="text-slate-400 hover:text-slate-600">
                    <span className="material-symbols-outlined text-[20px]">close</span>
                  </button>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Họ và tên khách</label>
                  <input
                    type="text"
                    required
                    value={walkinName}
                    onChange={(e) => setWalkinName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Số điện thoại liên hệ</label>
                  <input
                    type="tel"
                    required
                    value={walkinPhone}
                    onChange={(e) => setWalkinPhone(e.target.value)}
                    placeholder="0901234567"
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Nhu cầu kho dự kiến</label>
                  <select className="w-full h-10 px-3 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none">
                    <option value="mini">Kho Mini (2-5 m²)</option>
                    <option value="home">Kho Gia Đình (6-12 m²)</option>
                    <option value="biz">Kho Doanh Nghiệp (15-30 m²)</option>
                  </select>
                </div>

                <div className="pt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsWalkinOpen(false)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                  >
                    Cấp Thẻ Tham Quan
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Evidence Image Preview Modal */}
      {activeEvidenceModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">image</span>
                </span>
                <div>
                  <h3 className="font-headline text-base font-bold text-slate-900">
                    Bằng Chứng Hiện Trường Sự Cố {activeEvidenceModal.ticketId}
                  </h3>
                  <p className="text-xs text-slate-500 line-clamp-1">
                    {activeEvidenceModal.title}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveEvidenceModal(null)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto p-1">
                {activeEvidenceModal.images.map((imgUrl, idx) => (
                  <div key={idx} className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50 group shadow-sm">
                    <img
                      src={imgUrl}
                      alt={`Bằng chứng ${idx + 1}`}
                      className="w-full h-56 object-cover"
                    />
                    <div className="absolute bottom-2 right-2 flex gap-1">
                      <a
                        href={imgUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2 py-1 rounded-md bg-slate-900/80 hover:bg-slate-900 text-white text-[11px] font-bold flex items-center gap-1 backdrop-blur-sm transition-colors"
                      >
                        <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                        Xem ảnh gốc
                      </a>
                    </div>
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/60 text-white font-mono text-[10px]">
                      Ảnh #{idx + 1}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-xs text-slate-500">
                  Tổng cộng: <strong className="text-slate-800">{activeEvidenceModal.images.length}</strong> hình ảnh bằng chứng
                </span>
                <button
                  type="button"
                  onClick={() => setActiveEvidenceModal(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors"
                >
                  Đóng cửa sổ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Master Key Emergency Override Modal (BR-RULE-009) */}
      {isEmergencyModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5 text-rose-600 font-headline font-bold text-base">
                <span className="material-symbols-outlined text-[24px]">crisis_alert</span>
                <h3>Lệnh Khẩn Cấp Mở Cửa</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsEmergencyModalOpen(false)
                  setEmergencyResult(null)
                  setEmergencyError(null)
                  setWitnessStaffId('')
                  setWitnessPassword('')
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-amber-950">
                <span className="material-symbols-outlined text-[16px]">security</span>
                <span>Nguyên tắc xác thực 2 người (Two-Person Rule)</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Mọi thao tác mở cưỡng chế barrier và cửa sảnh cần người làm chứng được phân quyền xác nhận mật khẩu; hệ thống lưu vết audit để kiểm soát thao tác.
              </p>
            </div>

            {emergencyResult ? (
              <div className="py-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <span className="material-symbols-outlined text-[28px]">check_circle</span>
                </div>
                <h4 className="font-bold text-slate-900 text-sm">Lệnh Cưỡng Chế Đã Kích Hoạt</h4>
                <p className="text-xs text-slate-600">{emergencyResult}</p>
                <button
                  type="button"
                  onClick={() => {
                    setIsEmergencyModalOpen(false)
                    setEmergencyResult(null)
                    setWitnessStaffId('')
                    setWitnessPassword('')
                  }}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  Đóng cửa sổ
                </button>
              </div>
            ) : (
              <form onSubmit={handleExecuteEmergencyOverride} className="space-y-3 text-xs">
                {emergencyError && (
                  <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-800">
                    {emergencyError}
                  </p>
                )}
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">Cơ sở áp dụng</label>
                  <select
                    value={emergencyFacilityId}
                    onChange={(e) => setEmergencyFacilityId(e.target.value)}
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-slate-800 font-semibold focus:outline-none focus:border-rose-500"
                  >
                    {facilities.length > 0 ? (
                      facilities.map(f => (
                        <option key={f.id} value={f.id}>{f.facilityName || f.name} ({f.facilityCode || f.code})</option>
                      ))
                    ) : (
                      <option value="a1111111-2222-3333-4444-555555555555">Boxora Tan Binh Mega Hub (HCM-TB)</option>
                    )}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">Loại tình huống</label>
                    <select
                      value={emergencyCategory}
                      onChange={(e) => setEmergencyCategory(e.target.value as any)}
                      className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-slate-800 font-semibold focus:outline-none focus:border-rose-500"
                    >
                      <option value="MAINTENANCE_EMERGENCY">Sự Cố Kẹt Khóa / Kỹ Thuật</option>
                      <option value="FIRE_HAZARD">Báo Cháy PCCC / Cứu Hộ</option>
                      <option value="POLICE_WARRANT">Yêu Cầu Cơ Quan Chức Năng</option>
                      <option value="INTERNAL_AUDIT">Kiểm Tra An Ninh Định Kỳ</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">Mức độ khẩn cấp</label>
                    <select
                      value={emergencySeverity}
                      onChange={(e) => setEmergencySeverity(e.target.value as any)}
                      className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-slate-800 font-semibold focus:outline-none focus:border-rose-500"
                    >
                      <option value="CRITICAL">Cực Kỳ Khẩn Cấp (CRITICAL)</option>
                      <option value="HIGH">Ưu Tiên Cao (HIGH)</option>
                      <option value="MEDIUM">Trung Bình (MEDIUM)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">Lý do chi tiết</label>
                  <textarea
                    rows={2}
                    required
                    value={emergencyReason}
                    onChange={(e) => setEmergencyReason(e.target.value)}
                    placeholder="Ghi rõ lý do can thiệp mở khóa khẩn cấp..."
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-100">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">Quản lý / nhân viên làm chứng (UUID)</label>
                    <input
                      type="text"
                      required
                      value={witnessStaffId}
                      onChange={(e) => setWitnessStaffId(e.target.value)}
                      placeholder="UUID nhân viên hoặc quản lý"
                      className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-rose-500 font-mono text-[11px]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">Mật khẩu người làm chứng</label>
                    <input
                      type="password"
                      required
                      value={witnessPassword}
                      onChange={(e) => setWitnessPassword(e.target.value)}
                      placeholder="Mật khẩu xác nhận"
                      className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-rose-500"
                    />
                  </div>
                </div>

                <div className="pt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEmergencyModalOpen(false)
                      setEmergencyError(null)
                      setWitnessStaffId('')
                      setWitnessPassword('')
                    }}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={isEmergencyCalling}
                    className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer"
                  >
                    {isEmergencyCalling ? 'Đang Ghi Nhận Lệnh...' : 'Kích Hoạt Cưỡng Chế (60 Giây)'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Real-time HTML5-QRCode Camera Scanner Modal & Check-in API */}
      {bookingDetailId && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <section role="dialog" aria-modal="true" aria-labelledby="booking-preparation-title" className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <header className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 id="booking-preparation-title" className="text-base font-bold text-slate-900">Thông tin kho cần chuẩn bị</h2>
                <p className="mt-1 text-xs text-slate-500">Chỉ xem và chuẩn bị vận hành; nhân viên không duyệt yêu cầu.</p>
              </div>
              <button type="button" onClick={closeBookingDetail} aria-label="Đóng" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                <span className="material-symbols-outlined">close</span>
              </button>
            </header>

            <div className="space-y-4 p-5">
              {bookingDetailLoading ? (
                <p className="py-8 text-center text-sm text-slate-500">Đang tải thông tin đặt kho…</p>
              ) : bookingDetailError ? (
                <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{bookingDetailError}</p>
              ) : bookingDetail ? (
                <>
                  <div className="rounded-xl border border-cyan-100 bg-cyan-50 p-4">
                    <p className="font-mono text-xs font-bold text-cyan-800">#{bookingDetail.bookingCode}</p>
                    <h3 className="mt-1 text-sm font-bold text-slate-900">Kho {bookingDetail.unitCode} · {bookingDetail.facilityName}</h3>
                    <p className="mt-2 text-xs text-slate-600">
                      Khách dự kiến đến: <strong className="text-slate-900">
                        {bookingDetail.expectedArrivalAt
                          ? new Date(bookingDetail.expectedArrivalAt).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' })
                          : `${bookingDetail.startDate} (chưa có giờ cụ thể)`}
                      </strong>
                    </p>
                  </div>
                  <div className="grid gap-2 rounded-xl bg-slate-50 p-4 text-xs sm:grid-cols-2">
                    <span>Khách hàng: <strong className="text-slate-900">{bookingDetail.customerName}</strong></span>
                    <span>Điện thoại: <strong className="text-slate-900">{bookingDetail.customerPhone}</strong></span>
                    <span>Mã đơn: <strong className="font-mono text-slate-900">{bookingDetail.bookingCode}</strong></span>
                    <span>Trạng thái: <strong className="text-slate-900">{bookingDetail.status}</strong></span>
                  </div>
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-xs font-bold text-amber-900">Danh sách chuẩn bị</p>
                    <ul className="mt-2 space-y-1.5 text-xs text-amber-900">
                      <li>• Kiểm tra vệ sinh và tình trạng thực tế của kho.</li>
                      <li>• Kiểm tra ổ khóa, thiết bị IoT và cảm biến.</li>
                      <li>• Giữ kho sẵn sàng, không xếp đồ hoặc đưa kho đi bảo trì đột xuất.</li>
                    </ul>
                  </div>
                </>
              ) : null}
            </div>
          </section>
        </div>
      )}

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

    </div>
  )
}

