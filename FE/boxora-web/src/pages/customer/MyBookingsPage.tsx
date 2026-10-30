import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import QRCode from 'qrcode'
import {
  Calendar,
  Clock,
  Building2,
  Box,
  PhoneCall,
  CheckCircle2,
  Copy,
  ChevronRight,
  RefreshCw,
  Search,
  FileText,
  ShieldCheck,
  ArrowRight,
  X,
  Lock,
  Unlock,
  Sparkles,
  Layers,
  MapPin,
  Check,
  AlertCircle,
  AlertTriangle,
  QrCode,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { bookingService } from '../../services/bookingService'
import { paymentService } from '../../services/paymentService'
import { facilityService } from '../../services/facilityService'
import { Booking, Facility } from '../../types'
import { BrandLogo } from '../../components/common/BrandLogo'
import { QuickThemeLanguageToggle } from '../../components/common/QuickThemeLanguageToggle'
import { UserAvatarDropdown } from '../../components/common/UserAvatarDropdown'
import { AccountProfileModal } from '../../components/common/AccountProfileModal'
import { WebSettingsModal } from '../../components/common/WebSettingsModal'
import { LogoutConfirmModal } from '../../components/common/LogoutConfirmModal'
import { BookingCancelModal } from '../../components/modals/BookingCancelModal'
import { BookingRescheduleModal } from '../../components/modals/BookingRescheduleModal'
import { CustomerPolicyModal, PolicyTab } from '../../components/modals/CustomerPolicyModal'
import { useLanguage } from '../../context/LanguageContext'
import { checkCustomerPortalAccess, syncCustomerPortalAccess } from '../../utils/rentalAccess'

export const formatUnitTypeName = (b: Partial<Booking> | any): string => {
  if (!b) return 'Kho Tiêu chuẩn'

  // If specific sizeName exists (e.g. from local reservation: "Kho 3 m³", "Kho 1 m³")
  if (b.sizeName && b.sizeName !== 'Kho Boxora' && b.sizeName !== 'Theo kích thước đăng ký') {
    return b.sizeName
  }

  // If explicit unitTypeName exists
  const rawTypeName = (b.unitTypeName || '').trim()
  if (rawTypeName && rawTypeName !== 'Kho Boxora' && rawTypeName !== 'Theo kích thước đăng ký') {
    if (rawTypeName.startsWith('Kho ')) {
      return rawTypeName
    }
    return `Kho ${rawTypeName}`
  }

  // Check unitTypeId
  const typeId = b.unitTypeId
  if (typeId === '10000000-0000-0000-0000-000000000001') {
    return 'Kho Mini (1 m³ - Tủ cá nhân)'
  }
  if (typeId === '10000000-0000-0000-0000-000000000002') {
    return 'Kho Vừa (3 m³ - Studio)'
  }
  if (typeId === '10000000-0000-0000-0000-000000000003') {
    return 'Kho Tiêu chuẩn (6 m³)'
  }
  if (typeId === '10000000-0000-0000-0000-000000000004') {
    return 'Kho Rất lớn (12 m³ - Thương mại)'
  }
  if (typeId === '10000000-0000-0000-0000-000000000005') {
    return 'Kho Lạnh chuyên dụng (5 m³)'
  }
  if (typeId === 'dd168b92-ebdd-4e84-a6e1-7715b4745a26') {
    return 'Kho Compact Studio (3 m³)'
  }

  if (b.size?.volumeText) {
    return `Kho ${b.size.volumeText}`
  }
  if (b.sizeId) {
    return `Kho ${String(b.sizeId).toUpperCase()}`
  }

  return 'Kho Tiêu chuẩn (Boxora)'
}

const safeFormatDateTime = (dateVal?: string | null, fallback = ''): string => {
  if (!dateVal) return fallback
  try {
    const d = new Date(dateVal)
    if (isNaN(d.getTime())) return fallback || String(dateVal)
    return d.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return fallback || String(dateVal)
  }
}

const safeFormatDate = (dateVal?: string | null, fallback = ''): string => {
  if (!dateVal) return fallback
  try {
    const d = new Date(dateVal)
    if (isNaN(d.getTime())) return fallback || String(dateVal)
    return d.toLocaleDateString('vi-VN')
  } catch {
    return fallback || String(dateVal)
  }
}


export interface CheckInCountdownInfo {
  type: 'TODAY' | 'UPCOMING' | 'OVERDUE'
  diffDays: number
  badgeText: string
  formattedDate: string
  isToday: boolean
  isUpcoming: boolean
  isOverdue: boolean
  overdueDays: number
  autoCancelDeadline: Date
  remainingMs: number
  autoCancelCountdownStr: string
  isAutoCancelExpired: boolean
}

export function getCheckInCountdownInfo(b: Booking, nowMs: number): CheckInCountdownInfo | null {
  if (!b) return null

  const statusUpper = (b.status || '').toUpperCase()
  if (statusUpper === 'ACTIVE' || statusUpper === 'COMPLETED' || statusUpper === 'CANCELLED') {
    return null
  }

  const rawDate = (b as any).checkInDate || b.expectedCheckInAt || b.startDate
  if (!rawDate) return null

  let targetDate: Date
  if (typeof rawDate === 'string') {
    const parsed = new Date(rawDate)
    if (!isNaN(parsed.getTime())) {
      targetDate = parsed
    } else {
      const match = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})/)
      if (match) {
        targetDate = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]))
      } else {
        return null
      }
    }
  } else {
    targetDate = new Date(rawDate)
  }

  if (isNaN(targetDate.getTime())) return null

  const now = new Date(nowMs)
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const targetDayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()).getTime()

  const diffMs = targetDayStart - todayStart
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000))

  const formattedDate = targetDate.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  // Tính hạn hủy tự động theo chính sách bảo lưu giữ chỗ của cơ sở
  let autoCancelDeadline: Date
  if (b.holdExpiresAt) {
    autoCancelDeadline = new Date(b.holdExpiresAt)
  } else {
    // Đơn ký tại quầy: gia hạn 48 giờ sau ngày hẹn. Đơn thông thường: gia hạn holdGraceHours (mặc định 24 giờ).
    const graceHours = b.signingMethod === 'IN_PERSON' ? 48 : (b.holdGraceHours || 24)
    // Tính từ thời điểm kết thúc ngày hẹn tiếp đón (23:59:59 của ngày hẹn)
    const endOfCheckInDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59).getTime()
    autoCancelDeadline = new Date(endOfCheckInDay + graceHours * 3600 * 1000)
  }

  const remainingMs = autoCancelDeadline.getTime() - nowMs
  const isAutoCancelExpired = remainingMs <= 0

  let autoCancelCountdownStr = ''
  if (isAutoCancelExpired) {
    autoCancelCountdownStr = 'Đã hết hạn giữ kho — Hệ thống đang xử lý tự động hủy đơn'
  } else {
    const totalSecs = Math.floor(remainingMs / 1000)
    const hours = Math.floor(totalSecs / 3600)
    const mins = Math.floor((totalSecs % 3600) / 60)
    const secs = totalSecs % 60

    if (hours >= 24) {
      const days = Math.floor(hours / 24)
      const remHours = hours % 24
      autoCancelCountdownStr = `${days} ngày ${remHours.toString().padStart(2, '0')} giờ ${mins.toString().padStart(2, '0')} phút ${secs.toString().padStart(2, '0')} giây`
    } else {
      autoCancelCountdownStr = `${hours.toString().padStart(2, '0')} giờ ${mins.toString().padStart(2, '0')} phút ${secs.toString().padStart(2, '0')} giây`
    }
  }

  if (diffDays === 0) {
    return {
      type: 'TODAY',
      diffDays: 0,
      badgeText: 'Hôm nay',
      formattedDate,
      isToday: true,
      isUpcoming: false,
      isOverdue: false,
      overdueDays: 0,
      autoCancelDeadline,
      remainingMs,
      autoCancelCountdownStr,
      isAutoCancelExpired,
    }
  } else if (diffDays > 0) {
    return {
      type: 'UPCOMING',
      diffDays,
      badgeText: `${diffDays} ngày sắp tới`,
      formattedDate,
      isToday: false,
      isUpcoming: true,
      isOverdue: false,
      overdueDays: 0,
      autoCancelDeadline,
      remainingMs,
      autoCancelCountdownStr,
      isAutoCancelExpired,
    }
  } else {
    const overdueDays = Math.abs(diffDays)
    return {
      type: 'OVERDUE',
      diffDays,
      badgeText: `Quá ${overdueDays} ngày`,
      formattedDate,
      isToday: false,
      isUpcoming: false,
      isOverdue: true,
      overdueDays,
      autoCancelDeadline,
      remainingMs,
      autoCancelCountdownStr,
      isAutoCancelExpired,
    }
  }
}

export type BookingStageType =
  | 'PENDING_ASSIGNMENT' // Đã thanh toán & ký HĐ -> Chờ nhân viên xếp buồng kho
  | 'PENDING_CONTACT'    // Khách chọn trả sau -> Chờ nhân viên CSKH tư vấn
  | 'CONFIRMED'          // Đã xếp ô kho cụ thể -> Sẵn sàng tiếp đón
  | 'ACTIVE'             // Đang thuê hoạt động -> Cấp quyền mở khóa IoT
  | 'CANCELLED'          // Đã hủy

export interface BookingStageInfo {
  stage: BookingStageType
  label: string
  badgeClass: string
  dotClass: string
  description: string
  step: number // 1 to 4
  stepLabel: string
}

export function getBookingStage(b: Booking): BookingStageInfo {
  const status = (b.status || '').toUpperCase()
  const isCancelled = status === 'CANCELLED' || status === 'OVERDUE'
  if (isCancelled) {
    const isRefunded =
      b.paymentStatus === 'REFUNDED' ||
      (b as any).refundStatus === 'PROCESSED' ||
      (b as any).refundStatus === 'AWAITING_CUSTOMER_CONFIRMATION' ||
      (b as any).refundStatus === 'COMPLETED' ||
      (b as any).refundStatus === 'RECONCILED'

    if (isRefunded) {
      return {
        stage: 'CANCELLED',
        label: 'Đã hoàn tiền thành công',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800',
        dotClass: 'bg-emerald-500',
        description: 'Quản lý cơ sở đã hoàn tất chuyển khoản hoàn tiền vào tài khoản ngân hàng của quý khách.',
        step: 0,
        stepLabel: 'Đã hoàn tất',
      }
    }

    const hasRefund = Number(b.depositPaid || 0) > 0 || Boolean((b as any).refundStatus) || Boolean((b as any).refundRequestCode) || b.paymentStatus === 'REFUND_PENDING'
    if (hasRefund) {
      return {
        stage: 'CANCELLED',
        label: 'Hủy đơn hoàn tiền chờ xác nhận',
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-800',
        dotClass: 'bg-amber-500 animate-pulse',
        description: 'Đã gửi yêu cầu hủy đơn & hoàn tiền cọc đến Quản lý cơ sở để xử lý đối soát và giải ngân qua chuyển khoản.',
        step: 0,
        stepLabel: 'Chờ duyệt hoàn tiền',
      }
    }
    return {
      stage: 'CANCELLED',
      label: 'Đã hủy',
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/80 dark:text-rose-300 dark:border-rose-800',
      dotClass: 'bg-rose-500',
      description: 'Đơn đặt giữ chỗ đã được hủy theo yêu cầu hoặc quá thời hạn giữ chỗ.',
      step: 0,
      stepLabel: 'Đã hủy',
    }
  }

  const isActive = status === 'ACTIVE' || status === 'COMPLETED'
  if (isActive) {
    return {
      stage: 'ACTIVE',
      label: 'Đang thuê hoạt động',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800',
      dotClass: 'bg-emerald-500',
      description: 'Hợp đồng đang có hiệu lực 24/7. Quý khách có thể sử dụng Portal điều khiển khóa thông minh IoT.',
      step: 4,
      stepLabel: 'Đã cấp khóa IoT',
    }
  }

  // Unit assigned by staff at counter or confirmed
  const isAssigned =
    (status === 'CONFIRMED' || status === 'READY_FOR_CHECKIN') &&
    Boolean(b.unitCode && b.unitCode !== 'N/A')

  if (isAssigned) {
    return {
      stage: 'CONFIRMED',
      label: 'Đã xếp buồng kho',
      badgeClass: 'bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-950/80 dark:text-cyan-300 dark:border-cyan-800',
      dotClass: 'bg-cyan-500 animate-pulse',
      description: `Nhân viên đã xếp buồng kho #${b.unitCode} tại ${b.facilityName}. Quý khách vui lòng đến theo lịch hẹn mang CCCD để hoàn tất nhận kho.`,
      step: 4,
      stepLabel: 'Đã xếp buồng kho',
    }
  }

  // Pay Now order that signed contract and paid online, awaiting check-in / unit selection
  const isPaidOnline =
    b.paymentStatus === 'PAID' ||
    Number(b.depositPaid || 0) > 0 ||
    status === 'PAID_CONFIRMED' ||
    status === 'PAID_AND_SIGNED' ||
    status === 'PAID_PENDING_ASSIGNMENT'

  if (isPaidOnline || status === 'PAID_AND_SIGNED' || status === 'PAID_PENDING_ASSIGNMENT') {
    return {
      stage: 'PENDING_ASSIGNMENT',
      label: 'Chờ xếp buồng kho',
      badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950/80 dark:text-indigo-300 dark:border-indigo-800',
      dotClass: 'bg-indigo-500 animate-pulse',
      description: 'Hợp đồng điện tử DocuSeal đã ký & thanh toán thành công. Vào ngày check-in, nhân viên sẽ hỗ trợ quý khách chọn buồng kho mong muốn tại quầy.',
      step: 3,
      stepLabel: 'Chờ xếp buồng kho',
    }
  }

  // Pay Later / In person signing & payment at facility on check-in day
  if (status === 'PENDING_CONTACT' || b.signingMethod === 'IN_PERSON') {
    return {
      stage: 'PENDING_CONTACT',
      label: 'Chờ thanh toán',
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-800',
      dotClass: 'bg-amber-500 animate-pulse',
      description: 'Đơn đặt giữ chỗ thành công theo loại kho. Quý khách vui lòng đến cơ sở theo lịch hẹn để chọn vị trí buồng kho mong muốn, ký hợp đồng và thanh toán tại quầy.',
      step: 2,
      stepLabel: 'Chờ thanh toán',
    }
  }

  // Contract signed online but pending deposit payment
  if (status === 'SIGNED_PENDING_PAYMENT' || b.contractSigned) {
    return {
      stage: 'PENDING_CONTACT',
      label: 'Chờ thanh toán',
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-800',
      dotClass: 'bg-amber-500 animate-pulse',
      description: 'Hợp đồng điện tử đã ký thành công. Quý khách vui lòng hoàn tất thanh toán trực tuyến để xác nhận giữ buồng kho.',
      step: 2,
      stepLabel: 'Chờ thanh toán',
    }
  }

  // Default pending payment
  return {
    stage: 'PENDING_CONTACT',
    label: 'Chờ thanh toán',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-800',
    dotClass: 'bg-amber-500 animate-pulse',
    description: 'Vui lòng hoàn tất ký hợp đồng điện tử và thanh toán trực tuyến để xác nhận giữ buồng kho.',
    step: 2,
    stepLabel: 'Chờ thanh toán',
  }
}

export interface MyBookingsPageProps {
  embedded?: boolean
  onGoToMyUnit?: (unitCode?: string) => void
}

export const MyBookingsPage: React.FC<MyBookingsPageProps> = ({ embedded = false, onGoToMyUnit }) => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const targetBookingCodeParam = searchParams.get('bookingCode') || searchParams.get('code')
  const [highlightedBookingCode, setHighlightedBookingCode] = useState<string | null>(null)

  const handleNavigateToUnitPortal = (unitCode?: string | null) => {
    if (onGoToMyUnit) {
      onGoToMyUnit(unitCode || undefined)
      return
    }
    // Dispatch custom event for dashboard if embedded
    window.dispatchEvent(
      new CustomEvent('boxora:navigate-customer-tab', {
        detail: { tab: 'my-units', unitCode: unitCode || '' },
      })
    )
    navigate(`/portal/customer?tab=my-units${unitCode ? `&unit=${encodeURIComponent(unitCode)}` : ''}`)
  }
  const { user, isAuthenticated, logout } = useAuth()
  const { t } = useLanguage()

  // Customer rental access state (whether they have signed contract and paid)
  const isCustomer = user?.role?.name === 'CUSTOMER'
  const [customerAccess, setCustomerAccess] = useState(() => checkCustomerPortalAccess(user))
  const canAccessPortal = !isCustomer || customerAccess.hasAccess

  useEffect(() => {
    const handleRentalChange = () => {
      setCustomerAccess(checkCustomerPortalAccess(user))
    }
    window.addEventListener('boxora_rental_updated', handleRentalChange)
    return () => window.removeEventListener('boxora_rental_updated', handleRentalChange)
  }, [user])

  useEffect(() => {
    setCustomerAccess(checkCustomerPortalAccess(user))
    if (user && isCustomer) {
      void syncCustomerPortalAccess(user).then(() => {
        setCustomerAccess(checkCustomerPortalAccess(user))
      })
    }
  }, [user, isCustomer])

  // Modals state
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false)
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false)
  const [policyModalTab, setPolicyModalTab] = useState<PolicyTab>('cancellation')

  // Booking action modals
  const [selectedBookingForCancel, setSelectedBookingForCancel] = useState<Booking | null>(null)
  const [selectedBookingForReschedule, setSelectedBookingForReschedule] = useState<Booking | null>(null)
  const [selectedBookingForDetail, setSelectedBookingForDetail] = useState<Booking | null>(null)
  const [detailQrCodeUrl, setDetailQrCodeUrl] = useState<string>('')
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState<number>(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Data state
  const [bookings, setBookings] = useState<Booking[]>([])
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [, setError] = useState<string | null>(null)

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [facilityFilter, setFacilityFilter] = useState<string>('ALL')

  // Fetch bookings from backend and merge with local guest reservations
  const fetchBookings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let list: Booking[] = []
      try {
        const res = await bookingService.getMyBookings()
        if (Array.isArray(res)) {
          list = res
        } else {
          const activeRes = await bookingService.getMyActive()
          if (Array.isArray(activeRes)) {
            list = activeRes
          }
        }
      } catch (err) {
        console.warn('API getMyBookings failed, falling back to local bookings:', err)
        try {
          const activeRes = await bookingService.getMyActive()
          if (Array.isArray(activeRes)) {
            list = activeRes
          }
        } catch {
          list = []
        }
      }

      // Merge local reservations saved during booking
      try {
        const rawLocal = localStorage.getItem('boxora_guest_reservations')
        if (rawLocal) {
          const localItems = JSON.parse(rawLocal)
          if (Array.isArray(localItems) && localItems.length > 0) {
            const existingCodes = new Set(list.map((b) => b.bookingCode))
            const localAsBookings: Booking[] = []

            localItems.forEach((r: any, idx: number) => {
              const code = r.bookingCode || `BX-LOCAL-${idx}`

              // Chỉ merge đơn lưu tạm trong máy NẾU đơn này trùng khớp email hoặc số điện thoại của tài khoản đang đăng nhập
              const resEmail = (r.customer?.email || r.customerEmail || '').trim().toLowerCase()
              const resPhone = (r.customer?.phone || r.customerPhone || '').trim()
              const currentUserEmail = (user?.email || '').trim().toLowerCase()
              const currentUserPhone = (user?.phone || '').trim()

              const isMatch = Boolean(
                (currentUserEmail && resEmail && resEmail === currentUserEmail) ||
                (currentUserPhone && resPhone && resPhone === currentUserPhone)
              )

              if (!isMatch) {
                return
              }

              if (!existingCodes.has(code)) {
                localAsBookings.push({
                  id: `LOCAL-RES-${idx}-${code}`,
                  bookingCode: code,
                  customerId: user?.id || 'guest',
                  customerName: r.customer?.fullName || r.customerName || user?.fullName || 'Khách hàng',
                  customerEmail: r.customer?.email || r.customerEmail || user?.email || '',
                  customerPhone: r.customer?.phone || r.customerPhone || user?.phone || '',
                  identityCardNumber: r.identityCardNumber || r.customer?.idCard || '',
                  storageUnitId: null,
                  unitCode: r.unitCode || null,
                  unitTypeName: r.unitTypeName || r.sizeName || (r.size?.volumeText ? `Kho ${r.size.volumeText}` : '') || (r.sizeId ? `Kho ${String(r.sizeId).toUpperCase()}` : 'Kho Tiêu chuẩn'),
                  sizeName: r.sizeName || (r.size?.volumeText ? `Kho ${r.size.volumeText}` : undefined),
                  facilityId: r.facility?.id || r.facilityId || 'FAC-LOCAL-1',
                  facilityName: r.facility?.name || r.facilityName || 'Boxora Smart Storage',
                  startDate: r.startDate || new Date().toISOString().split('T')[0],
                  endDate: r.rentalEndDate || new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
                  rentalMonths: r.duration?.months || r.rentalMonths || 1,
                  totalRentalFee: r.totalRentalFee || 0,
                  depositAmount: r.depositAmount || 0,
                  depositPaid: r.depositPaid ?? (r.paymentStatus === 'PAID' ? (r.depositAmount || 0) : 0),
                  paymentStatus: r.paymentStatus || 'UNPAID',
                  expectedCheckInAt: r.expectedCheckInAt || `${r.checkInDate || ''}T${r.checkInTime || '09:00'}:00`,
                  checkInDate: r.checkInDate,
                  checkInTime: r.checkInTime,
                  status: (r.status as any) || 'PENDING_CONTACT',
                  holdExpiresAt: r.holdExpiresAt || null,
                  holdGraceHours: r.holdGraceHours || 24,
                  createdAt: r.createdAt || new Date().toISOString(),
                } as any)
              }
            })

            list = [...localAsBookings, ...list]
          }
        }
      } catch (e) {
        console.warn('Error merging local reservations:', e)
      }

      // Reconcile payments
      try {
        const myPayments = await paymentService.getMyPayments().catch(() => [])
        if (Array.isArray(myPayments) && myPayments.length > 0) {
          const refundedBookingIds = new Set(
            myPayments.filter((pm: any) => pm.status === 'REFUNDED').map((pm: any) => pm.bookingId).filter(Boolean)
          )
          const refundedBookingCodes = new Set(
            myPayments.filter((pm: any) => pm.status === 'REFUNDED').map((pm: any) => pm.bookingCode).filter(Boolean)
          )

          const paidBookingIds = new Set(
            myPayments.filter((pm: any) => pm.status === 'PAID' || pm.status === 'SUCCESS').map((pm: any) => pm.bookingId).filter(Boolean)
          )
          const paidBookingCodes = new Set(
            myPayments.filter((pm: any) => pm.status === 'PAID' || pm.status === 'SUCCESS').map((pm: any) => pm.bookingCode).filter(Boolean)
          )
          list = list.map((bk) => {
            const currentStatus = (bk.status || '').toUpperCase()
            const isRefunded =
              bk.paymentStatus === 'REFUNDED' ||
              refundedBookingIds.has(bk.id) ||
              (bk.bookingCode && refundedBookingCodes.has(bk.bookingCode))

            if (isRefunded) {
              return {
                ...bk,
                paymentStatus: 'REFUNDED',
                status: 'CANCELLED',
              }
            }

            // Đơn đã hủy hoặc đang chờ hoàn tiền thì không ép về PAID
            if (currentStatus === 'CANCELLED' || bk.paymentStatus === 'REFUND_PENDING') {
              return bk
            }

            if (paidBookingIds.has(bk.id) || (bk.bookingCode && paidBookingCodes.has(bk.bookingCode))) {
              return {
                ...bk,
                paymentStatus: 'PAID',
                status: currentStatus === 'PENDING_PAYMENT' || currentStatus === 'PENDING_CONTACT'
                  ? 'PAID_AND_SIGNED'
                  : bk.status,
              }
            }
            return bk
          })
        }
      } catch (payErr) {
        console.warn('Reconcile payments warning:', payErr)
      }

      // Sort newest bookings first
      list.sort((a, b) => {
        const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0
        return tB - tA
      })

      setBookings(list)
    } catch (err: any) {
      console.error('Failed to load bookings:', err)
      setError('Không thể tải danh sách đơn đặt chỗ. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }, [user])

  // Fetch facilities
  useEffect(() => {
    facilityService
      .getFacilities()
      .then((res) => {
        if (res?.content && Array.isArray(res.content)) {
          setFacilities(res.content)
        }
      })
      .catch((err) => console.warn('Failed to load facilities:', err))
  }, [])

  useEffect(() => {
    fetchBookings()
  }, [fetchBookings])

  // Real-time synchronization event listener
  useEffect(() => {
    const handleStatusChanged = (e: any) => {
      const detail = e.detail
      if (!detail?.bookingCode) return

      setBookings((prev) =>
        prev.map((b) => {
          if (b.bookingCode === detail.bookingCode || b.id === detail.bookingCode) {
            return {
              ...b,
              status: (detail.newStatus as any) || b.status,
            }
          }
          return b
        })
      )
    }

    const handleCreated = () => {
      fetchBookings()
    }

    window.addEventListener('boxora_reservation_status_changed', handleStatusChanged)
    window.addEventListener('boxora_staff_reservation_created', handleCreated)

    return () => {
      window.removeEventListener('boxora_reservation_status_changed', handleStatusChanged)
      window.removeEventListener('boxora_staff_reservation_created', handleCreated)
    }
  }, [fetchBookings])

  // Handle bookingCode from URL searchParams to navigate, highlight card, and view details
  useEffect(() => {
    if (!targetBookingCodeParam || bookings.length === 0) return

    const cleanTarget = targetBookingCodeParam.trim().toLowerCase()
    const match = bookings.find(
      (b) =>
        b.bookingCode?.toLowerCase() === cleanTarget ||
        b.id?.toLowerCase() === cleanTarget
    )

    if (match) {
      setHighlightedBookingCode(match.bookingCode)
      setStatusFilter('ALL') // ensure it's not hidden by status filter tabs
      setSearchTerm('')     // ensure it's not hidden by search text

      // Automatically open detail modal so customer gets instant access to their QR check-in & booking voucher
      setSelectedBookingForDetail(match)

      // Smooth scroll to the booking card
      setTimeout(() => {
        const el = document.getElementById(`booking-card-${match.bookingCode}`)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 400)
    }
  }, [targetBookingCodeParam, bookings])

  // Generate QR code for detail modal
  useEffect(() => {
    if (!selectedBookingForDetail?.bookingCode) {
      setDetailQrCodeUrl('')
      return
    }
    QRCode.toDataURL(selectedBookingForDetail.bookingCode, { width: 180, margin: 1 })
      .then((url) => setDetailQrCodeUrl(url))
      .catch(() => setDetailQrCodeUrl(''))
  }, [selectedBookingForDetail])

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2500)
  }

  // Filtered Bookings
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const stageInfo = getBookingStage(b)

      // Search filter
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim()
        const matchCode = b.bookingCode?.toLowerCase().includes(q)
        const matchUnit = b.unitCode?.toLowerCase().includes(q)
        const matchType = b.unitTypeName?.toLowerCase().includes(q)
        const matchFac = b.facilityName?.toLowerCase().includes(q)
        const matchPhone = b.customerPhone?.toLowerCase().includes(q)
        if (!matchCode && !matchUnit && !matchType && !matchFac && !matchPhone) return false
      }

      // Facility filter
      if (facilityFilter !== 'ALL') {
        const facMatch = b.facilityId === facilityFilter || b.facilityName === facilityFilter
        if (!facMatch) return false
      }

      // Status filter
      if (statusFilter !== 'ALL') {
        if (statusFilter !== stageInfo.stage) {
          return false
        }
      }

      return true
    })
  }, [bookings, searchTerm, facilityFilter, statusFilter])

  // Metric counts
  const totalCount = bookings.length
  const pendingAssignmentCount = useMemo(
    () => bookings.filter((b) => getBookingStage(b).stage === 'PENDING_ASSIGNMENT').length,
    [bookings]
  )
  const pendingContactCount = useMemo(
    () => bookings.filter((b) => getBookingStage(b).stage === 'PENDING_CONTACT').length,
    [bookings]
  )
  const confirmedCount = useMemo(
    () => bookings.filter((b) => getBookingStage(b).stage === 'CONFIRMED').length,
    [bookings]
  )
  const activeCount = useMemo(
    () => bookings.filter((b) => getBookingStage(b).stage === 'ACTIVE').length,
    [bookings]
  )
  const cancelledCount = useMemo(
    () => bookings.filter((b) => getBookingStage(b).stage === 'CANCELLED').length,
    [bookings]
  )

  const stepsList = [
    { num: 1, label: 'Đặt chỗ' },
    { num: 2, label: 'Ký HĐ & Cọc' },
    { num: 3, label: 'Xếp buồng kho' },
    { num: 4, label: 'Mã IoT 24/7' },
  ]

  const reservationsContent = (
    <>
      {/* Page Title & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          {!embedded && (
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
              <Link to="/" className="hover:text-blue-600 transition-colors">
                Trang chủ
              </Link>
              <span>/</span>
              <span className="text-slate-800 dark:text-slate-200 font-semibold">Đơn đặt giữ chỗ của tôi</span>
            </div>
          )}
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Đơn Đặt Giữ Chỗ Của Tôi
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Theo dõi tiến trình xét duyệt đơn, ký hợp đồng điện tử DocuSeal, gán buồng kho và nhận mã khóa IoT 24/7.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchBookings}
            disabled={loading}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>{loading ? 'Đang tải...' : 'Làm mới'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setPolicyModalTab('cancellation')
              setIsPolicyModalOpen(true)
            }}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <FileText size={15} className="text-blue-600" />
            <span>Chính sách cọc &amp; hủy</span>
          </button>

          <Link
            to="/booking"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white shadow-md shadow-blue-600/20 transition-all cursor-pointer"
          >
            <span>+ Đặt thuê thêm kho</span>
          </Link>
        </div>
      </div>

        {/* ============================================================== */}
        {/* 4-STEP PROCESS ROADMAP BANNER                                  */}
        {/* ============================================================== */}
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                <Sparkles size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                  Quy Trình Hoàn Tất Đơn Đặt Kho Thông Minh Boxora
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Tự động hóa toàn trình từ ký hợp đồng điện tử trực tuyến đến bàn giao mã khóa thông minh IoT 24/7.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                1
              </span>
              <div>
                <span className="font-bold text-slate-900 dark:text-white block">1. Đặt chỗ trực tuyến</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 block">
                  Chọn kích thước &amp; chi nhánh phù hợp
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
              <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                2
              </span>
              <div>
                <span className="font-bold text-slate-900 dark:text-white block">2. Ký HĐ &amp; Thanh toán</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 block">
                  Ký điện tử DocuSeal và thanh toán online
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
              <span className="w-6 h-6 rounded-full bg-cyan-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                3
              </span>
              <div>
                <span className="font-bold text-slate-900 dark:text-white block">3. Tới chọn kho mong muốn</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 block">
                  Đến kho để nhân viên xác nhận và gán mã buồng kho
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
              <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                4
              </span>
              <div>
                <span className="font-bold text-slate-900 dark:text-white block">4. Nhận mã PIN IoT 24/7</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 block">
                  Nhận thông tin qua email và thông báo Web
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* 3. SUMMARY STATS METRICS CARDS                                 */}
        {/* ============================================================== */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Tổng đơn đặt</span>
              <Box size={20} className="text-blue-600" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-mono">
                {totalCount}
              </span>
              <span className="text-xs text-slate-400">đơn</span>
            </div>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Chờ xếp buồng kho</span>
              <Clock size={20} className="text-indigo-600" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">
                {pendingAssignmentCount}
              </span>
              <span className="text-xs text-slate-400">đã ký &amp; cọc</span>
            </div>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Chờ tư vấn</span>
              <PhoneCall size={20} className="text-amber-500" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-amber-600 dark:text-amber-400 font-mono">
                {pendingContactCount}
              </span>
              <span className="text-xs text-slate-400">CSKH gọi 15-30p</span>
            </div>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Sẵn sàng / Đang thuê</span>
              <ShieldCheck size={20} className="text-emerald-500" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                {confirmedCount + activeCount}
              </span>
              <span className="text-xs text-slate-400">đã gán ô kho</span>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* 4. SEARCH & FILTER CONTROLS                                    */}
        {/* ============================================================== */}
        <div id="bookings-list" className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm theo mã đơn (BX-...), loại kho, số điện thoại hoặc cơ sở..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-1"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Facility Filter */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
                <Building2 size={15} className="text-slate-400" />
                <span className="text-slate-500 dark:text-slate-400">Cơ sở:</span>
                <select
                  value={facilityFilter}
                  onChange={(e) => setFacilityFilter(e.target.value)}
                  className="bg-transparent font-semibold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer max-w-[180px] truncate"
                >
                  <option value="ALL">Tất cả chi nhánh</option>
                  {facilities.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Refresh button */}
              <button
                type="button"
                onClick={fetchBookings}
                disabled={loading}
                title="Tải lại danh sách đơn"
                className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 text-slate-600 dark:text-slate-300 transition-all cursor-pointer"
              >
                <RefreshCw size={15} className={loading ? 'animate-spin text-blue-600' : ''} />
              </button>
            </div>
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1">
            {[
              { key: 'ALL', label: 'Tất cả', count: totalCount },
              { key: 'PENDING_ASSIGNMENT', label: 'Chờ xếp kho', count: pendingAssignmentCount },
              { key: 'PENDING_CONTACT', label: 'Chờ tư vấn', count: pendingContactCount },
              { key: 'CONFIRMED', label: 'Sẵn sàng nhận', count: confirmedCount },
              { key: 'ACTIVE', label: 'Đang thuê', count: activeCount },
              { key: 'CANCELLED', label: 'Đã hủy', count: cancelledCount },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-2 ${
                  statusFilter === tab.key
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    statusFilter === tab.key
                      ? 'bg-blue-800 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ============================================================== */}
        {/* 5. BOOKINGS LIST GRID (REORGANIZED DISPLAY)                     */}
        {/* ============================================================== */}
        {loading ? (
          <div className="p-16 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-center flex flex-col items-center justify-center gap-3">
            <RefreshCw size={32} className="animate-spin text-blue-600" />
            <span className="text-xs sm:text-sm text-slate-500">Đang tải danh sách đơn đặt chỗ từ hệ thống Boxora...</span>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="p-16 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-center flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
              <Box size={32} />
            </div>
            <div className="max-w-md space-y-1">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Không tìm thấy đơn đặt chỗ nào</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {searchTerm || statusFilter !== 'ALL' || facilityFilter !== 'ALL'
                  ? 'Thử xóa bộ lọc hoặc tìm kiếm bằng từ khóa khác.'
                  : 'Quý khách chưa có đơn đặt giữ chỗ nào trên hệ thống Boxora.'}
              </p>
            </div>
            <Link
              to="/booking"
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20 transition-all cursor-pointer"
            >
              Đặt thuê kho ngay
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredBookings.map((b) => {
              const stageInfo = getBookingStage(b)
              const checkInCountdown = getCheckInCountdownInfo(b, currentTime)
              const isPaid =
                b.paymentStatus === 'PAID' ||
                Number(b.depositPaid || 0) > 0 ||
                (b.status || '').toUpperCase() === 'PAID_CONFIRMED' ||
                (b.status || '').toUpperCase() === 'PAID_AND_SIGNED' ||
                (b.status || '').toUpperCase() === 'PAID_PENDING_ASSIGNMENT'

              const isHighlighted = highlightedBookingCode === b.bookingCode

              return (
                <div
                  key={b.id}
                  id={`booking-card-${b.bookingCode}`}
                  className={`rounded-2xl bg-white dark:bg-slate-900 border p-5 shadow-xs transition-all flex flex-col justify-between gap-4 ${
                    isHighlighted
                      ? 'border-blue-500 ring-4 ring-blue-500/20 shadow-xl bg-blue-50/20 dark:bg-blue-950/20 relative'
                      : 'border-slate-200/80 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-md'
                  }`}
                >
                  <div className="space-y-4">
                    {/* Header: Storage Room Title & Status Badge */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 border ${
                          isHighlighted
                            ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/30'
                            : 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-900/40 text-blue-600 dark:text-blue-400'
                        }`}>
                          {b.unitCode ? b.unitCode.substring(0, 3) : <Layers size={22} />}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="font-extrabold text-base text-slate-900 dark:text-white tracking-tight">
                              {b.unitCode && (stageInfo.stage === 'CONFIRMED' || stageInfo.stage === 'ACTIVE')
                                ? `Kho #${b.unitCode}`
                                : formatUnitTypeName(b)}
                            </h3>
                            {isHighlighted && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-600 text-white shadow-2xs animate-pulse">
                                <Sparkles size={11} className="text-amber-300" />
                                <span>Đơn vừa đặt</span>
                              </span>
                            )}
                            {(!b.unitCode || (stageInfo.stage !== 'CONFIRMED' && stageInfo.stage !== 'ACTIVE')) && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
                                Chọn vị trí kho khi check-in
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[210px] flex items-center gap-1 mt-0.5">
                            <MapPin size={12} className="text-slate-400 shrink-0" />
                            <span className="truncate">{b.facilityName}</span>
                          </span>
                        </div>
                      </div>

                      {/* Status Badges */}
                      <div className="text-right flex items-center justify-end">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${stageInfo.badgeClass}`}>
                          <span className={`w-2 h-2 rounded-full ${stageInfo.dotClass}`} />
                          <span>{stageInfo.label}</span>
                        </span>
                      </div>
                    </div>

                    {/* Booking Code with Quick Copy Bar */}
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                        <span className="font-mono text-[11px]">MÃ ĐƠN:</span>
                        <strong className="font-mono text-slate-900 dark:text-white font-bold text-sm">
                          {b.bookingCode}
                        </strong>
                      </div>
                      <div className="flex items-center gap-2">
                        {b.createdAt && (
                          <span className="text-[10px] text-slate-400 hidden sm:inline">
                            {safeFormatDateTime(b.createdAt)}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleCopyCode(b.bookingCode)}
                          className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 transition-colors"
                          title="Sao chép mã đơn"
                        >
                          <Copy size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Visual 4-Step Progress Track */}
                    {stageInfo.stage !== 'CANCELLED' && (
                      <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/70">
                        <div className="flex items-center justify-between gap-1">
                          {stepsList.map((step) => {
                            const isHandedOver =
                              stageInfo.stage === 'ACTIVE' ||
                              (b.status || '').toUpperCase() === 'ACTIVE' ||
                              (b.status || '').toUpperCase() === 'COMPLETED'
                            const isPassed = isHandedOver ? true : step.num < stageInfo.step
                            const isCurrent = isHandedOver ? false : step.num === stageInfo.step
                            return (
                              <div key={step.num} className="flex-1 flex flex-col items-center gap-1">
                                <div
                                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                                    isPassed
                                      ? 'bg-emerald-500 text-white'
                                      : isCurrent
                                      ? 'bg-blue-600 text-white ring-2 ring-blue-300 dark:ring-blue-900 animate-pulse'
                                      : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                                  }`}
                                >
                                  {isPassed ? <Check size={11} /> : step.num}
                                </div>
                                <span
                                  className={`text-[9px] text-center font-medium leading-tight ${
                                    isCurrent
                                      ? 'text-blue-700 dark:text-blue-400 font-bold'
                                      : isPassed
                                      ? 'text-slate-700 dark:text-slate-300'
                                      : 'text-slate-400'
                                  }`}
                                >
                                  {step.label}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Key Specifications Grid (2x2) */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                        <span className="text-slate-400 block text-[10px] font-bold uppercase">LOẠI BUỒNG KHO</span>
                        <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 truncate" title={formatUnitTypeName(b)}>
                          {formatUnitTypeName(b)}
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          {b.unitCode && (stageInfo.stage === 'CONFIRMED' || stageInfo.stage === 'ACTIVE')
                            ? `Vị trí: ${b.floorLevel || 'Tầng 1'}`
                            : 'Vị trí kho sẽ chọn khi đến check-in'}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-slate-400 block text-[10px] font-bold uppercase">LỊCH HẸN TIẾP ĐÓN</span>
                          {checkInCountdown && (
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold border shrink-0 ${
                                checkInCountdown.type === 'TODAY'
                                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 animate-pulse'
                                  : checkInCountdown.type === 'UPCOMING'
                                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                                  : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800 font-extrabold'
                              }`}
                            >
                              {checkInCountdown.badgeText}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5 font-semibold text-slate-800 dark:text-slate-200">
                          <Calendar size={12} className="text-blue-500 shrink-0" />
                          <span>{(b as any).checkInDate || safeFormatDate(b.expectedCheckInAt)}</span>
                        </div>
                        {b.checkInTime && (
                          <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-0.5">
                            <Clock size={11} />
                            <span>{b.checkInTime}</span>
                          </div>
                        )}
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                        <span className="text-slate-400 block text-[10px]">THỜI HẠN THUÊ</span>
                        <strong className="block mt-0.5 font-semibold text-slate-800 dark:text-slate-200">
                          {b.rentalMonths} tháng
                        </strong>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          {safeFormatDate(b.startDate)} - {safeFormatDate(b.endDate)}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                        <span className="text-slate-400 block text-[10px]">TIỀN THUÊ &amp; CỌC</span>
                        <div className="font-bold text-slate-900 dark:text-white mt-0.5 font-mono">
                          {Number(b.totalRentalFee || 0).toLocaleString('vi-VN')} ₫
                        </div>
                        <span className={`text-[10px] font-semibold block mt-0.5 ${
                          b.paymentStatus === 'REFUNDED'
                            ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                            : isPaid
                            ? 'text-emerald-600'
                            : 'text-amber-600'
                        }`}>
                          {b.paymentStatus === 'REFUNDED'
                            ? '✓ Đã hoàn tất hoàn tiền'
                            : isPaid
                            ? '✓ Đã thanh toán'
                            : '• Ký & Thanh toán tại kho'}
                        </span>
                      </div>
                    </div>

                    {/* Cảnh báo đơn đang quá thời gian check-in & đếm ngược tự động hủy đơn theo chính sách */}
                    {checkInCountdown?.isOverdue && (
                      <div className="p-3 rounded-xl border border-rose-300 dark:border-rose-800/80 bg-rose-50/95 dark:bg-rose-950/50 text-xs space-y-2 shadow-xs">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 font-bold text-rose-800 dark:text-rose-300">
                            <AlertTriangle size={15} className="shrink-0 text-rose-600 animate-bounce" />
                            <span>Quá thời gian check-in: Quá {checkInCountdown.overdueDays} ngày</span>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-600 text-white shrink-0 uppercase tracking-wider">
                            Quá hạn
                          </span>
                        </div>
                        <p className="text-[11px] leading-relaxed text-rose-900 dark:text-rose-200">
                          Đơn của quý khách đã quá lịch hẹn nhận kho ban đầu ({checkInCountdown.formattedDate}). Theo chính sách bảo lưu giữ chỗ của cơ sở, hệ thống sẽ <strong>tự động hủy đơn và giải phóng buồng kho</strong> sau:
                        </p>
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/90 dark:bg-slate-900/90 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-mono font-bold text-xs">
                          <Clock size={14} className="text-rose-600 shrink-0 animate-spin" />
                          <span>Thời gian còn lại: {checkInCountdown.autoCancelCountdownStr}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2 pt-0.5">
                          <span className="text-[10px] text-rose-700 dark:text-rose-400 italic">
                            * Vui lòng mang CCCD gốc đến cơ sở nhận kho sớm nhất hoặc đổi lịch hẹn.
                          </span>
                          <button
                            type="button"
                            onClick={() => setSelectedBookingForReschedule(b)}
                            className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold transition shrink-0 cursor-pointer shadow-xs"
                          >
                            Đổi lịch hẹn
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Notice Callout Box */}
                    <div
                      className={`p-3 rounded-xl border text-xs space-y-1 ${
                        stageInfo.stage === 'PENDING_ASSIGNMENT'
                          ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-900/60 text-indigo-950 dark:text-indigo-200'
                          : stageInfo.stage === 'CONFIRMED'
                          ? 'bg-cyan-50/80 dark:bg-cyan-950/40 border-cyan-200 dark:border-cyan-900/60 text-cyan-950 dark:text-cyan-200'
                          : stageInfo.stage === 'ACTIVE'
                          ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60 text-emerald-950 dark:text-emerald-200'
                          : stageInfo.stage === 'CANCELLED'
                          ? (b.paymentStatus === 'REFUNDED'
                              ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60 text-emerald-950 dark:text-emerald-200'
                              : stageInfo.label.includes('chờ')
                              ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60 text-amber-950 dark:text-amber-200'
                              : 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 text-rose-950 dark:text-rose-200')
                          : 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60 text-amber-950 dark:text-amber-200'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold">
                        {stageInfo.stage === 'PENDING_ASSIGNMENT' && <Clock size={14} className="text-indigo-600 shrink-0" />}
                        {stageInfo.stage === 'CONFIRMED' && <ShieldCheck size={14} className="text-cyan-600 shrink-0" />}
                        {stageInfo.stage === 'ACTIVE' && <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />}
                        {stageInfo.stage === 'PENDING_CONTACT' && <PhoneCall size={14} className="text-amber-600 shrink-0" />}
                        {stageInfo.stage === 'CANCELLED' && (
                          b.paymentStatus === 'REFUNDED'
                            ? <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                            : stageInfo.label.includes('chờ')
                            ? <Clock size={14} className="text-amber-600 shrink-0" />
                            : <AlertCircle size={14} className="text-rose-600 shrink-0" />
                        )}
                        <span>
                          {stageInfo.stage === 'PENDING_ASSIGNMENT' && 'Hợp đồng điện tử đã ký — Chờ chọn kho khi check-in'}
                          {stageInfo.stage === 'CONFIRMED' && `Đã xếp ô kho #${b.unitCode || 'thực tế'} sẵn sàng đón`}
                          {stageInfo.stage === 'ACTIVE' && 'Hợp đồng kho đang hoạt động 24/7'}
                          {stageInfo.stage === 'PENDING_CONTACT' && 'Ký HĐ & Thanh toán tại kho khi check-in'}
                          {stageInfo.stage === 'CANCELLED' && (
                            b.paymentStatus === 'REFUNDED'
                              ? 'Đã hoàn tất chuyển khoản tiền hoàn vào tài khoản ngân hàng'
                              : stageInfo.label.includes('chờ')
                              ? 'Đã gửi yêu cầu hủy — Đang chờ đối soát hoàn tiền'
                              : 'Đơn đặt giữ chỗ đã hủy'
                          )}
                        </span>
                      </div>
                      <p className="text-[11px] leading-relaxed opacity-90">
                        {stageInfo.description}
                      </p>
                    </div>
                  </div>

                  {/* Actions Footer Bar */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                    {/* Primary Workflow CTA */}
                    {stageInfo.stage === 'ACTIVE' ? (
                      <button
                        type="button"
                        onClick={() => handleNavigateToUnitPortal(b.unitCode)}
                        className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[17px]">dashboard</span>
                        <span>Vào Portal Quản Lý Kho (Khóa IoT)</span>
                      </button>
                    ) : (stageInfo.stage === 'PENDING_ASSIGNMENT' || (stageInfo.stage === 'CONFIRMED' && (b.contractSigned || isPaid))) ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/online-booking-contract?bookingId=${encodeURIComponent(b.id)}`)}
                        className="w-full py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                      >
                        <FileText size={15} />
                        <span>Xem hợp đồng điện tử đã ký</span>
                      </button>
                    ) : stageInfo.stage === 'PENDING_CONTACT' ? (
                      <div className="space-y-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedBookingForDetail(b)}
                          className="w-full py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                        >
                          <QrCode size={15} />
                          <span>Xem phiếu hẹn &amp; Mã QR</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate(`/online-booking-contract?bookingId=${encodeURIComponent(b.id)}&autoSign=true`)}
                          className="w-full py-1.5 px-2 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 text-blue-600 dark:text-blue-400 text-[11px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer border border-blue-100 dark:border-blue-900/50"
                        >
                          <span>Chuyển sang Ký HĐ &amp; Thanh toán online</span>
                          <ArrowRight size={12} />
                        </button>
                      </div>
                    ) : null}

                    {/* Secondary Utility Actions */}
                    <div className="flex items-center gap-2">
                      {stageInfo.stage !== 'PENDING_CONTACT' && (
                        <button
                          type="button"
                          onClick={() => setSelectedBookingForDetail(b)}
                          className="flex-1 py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors cursor-pointer text-center"
                        >
                          Xem phiếu hẹn &amp; QR
                        </button>
                      )}

                      {stageInfo.stage !== 'CANCELLED' && stageInfo.stage !== 'ACTIVE' && (
                        <>
                          <button
                            type="button"
                            onClick={() => setSelectedBookingForReschedule(b)}
                            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-blue-50 text-slate-600 hover:text-blue-600 transition-colors cursor-pointer"
                            title="Đổi lịch hẹn tiếp đón"
                          >
                            <Calendar size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedBookingForCancel(b)}
                            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-rose-50 text-slate-600 hover:text-rose-600 transition-colors cursor-pointer"
                            title="Hủy đơn đặt chỗ"
                          >
                            <X size={15} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
    </>
  )

  const modalsContent = (
    <>
      {/* Detail & QR Ticket Modal */}
      {selectedBookingForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/60 text-blue-600 flex items-center justify-center font-bold">
                  BX
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                    Phiếu Giữ Chỗ · {formatUnitTypeName(selectedBookingForDetail)}
                  </h3>
                  <span className="text-xs text-slate-400">Mã đơn: #{selectedBookingForDetail.bookingCode}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBookingForDetail(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {/* QR Code and Check-in Info */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
              {detailQrCodeUrl ? (
                <img
                  src={detailQrCodeUrl}
                  alt="QR Check-in"
                  className="w-28 h-28 rounded-xl bg-white p-1 border border-slate-200 shrink-0"
                />
              ) : (
                <div className="w-28 h-28 rounded-xl bg-slate-200 flex items-center justify-center text-xs text-slate-400">
                  QR
                </div>
              )}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">
                  MÃ QUÉT TẠI QUẦY TIẾP ĐÓN
                </span>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Xuất trình mã QR này hoặc cung cấp mã đơn <strong className="font-mono text-slate-900 dark:text-white font-bold">{selectedBookingForDetail.bookingCode}</strong> cho nhân viên trực tại chi nhánh khi đến nhận kho.
                </p>
                <div className="pt-1 text-xs text-slate-500 font-medium">
                  Cơ sở: <strong className="text-slate-900 dark:text-white">{selectedBookingForDetail.facilityName}</strong>
                </div>
              </div>
            </div>

            {/* Customer & Rental Info */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 block text-[10px] font-bold uppercase">KHÁCH HÀNG:</span>
                <strong className="text-slate-900 dark:text-white block mt-0.5">{selectedBookingForDetail.customerName}</strong>
                <span className="text-slate-500">{selectedBookingForDetail.customerPhone}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">LỊCH HẸN TIẾP ĐÓN:</span>
                  {(() => {
                    const cd = getCheckInCountdownInfo(selectedBookingForDetail, currentTime)
                    if (!cd) return null
                    return (
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold border shrink-0 ${
                          cd.type === 'TODAY'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300 animate-pulse'
                            : cd.type === 'UPCOMING'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-rose-100 text-rose-800 border-rose-300 font-extrabold'
                        }`}
                      >
                        {cd.badgeText}
                      </span>
                    )
                  })()}
                </div>
                <strong className="text-slate-900 dark:text-white block mt-0.5">
                  {(selectedBookingForDetail as any).checkInDate || safeFormatDate(selectedBookingForDetail.expectedCheckInAt)}
                </strong>
                <span className="text-blue-600 font-semibold">{selectedBookingForDetail.checkInTime || 'Giờ hành chính'}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 block text-[10px] font-bold uppercase">LOẠI BUỒNG KHO:</span>
                <strong className="text-slate-900 dark:text-white block mt-0.5 truncate" title={formatUnitTypeName(selectedBookingForDetail)}>
                  {formatUnitTypeName(selectedBookingForDetail)}
                </strong>
                <span className="text-slate-500">
                  {selectedBookingForDetail.unitCode ? `Mã ô kho: #${selectedBookingForDetail.unitCode}` : 'Vị trí gán trực tiếp khi check-in'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 block text-[10px] font-bold uppercase">TIỀN CỌC &amp; THỜI HẠN:</span>
                <strong className="text-blue-600 dark:text-blue-400 block mt-0.5 font-bold">
                  {Number(selectedBookingForDetail.depositPaid || selectedBookingForDetail.depositAmount || 0).toLocaleString('vi-VN')} ₫
                </strong>
                <span className="text-slate-500">Thời hạn: {selectedBookingForDetail.rentalMonths || 1} tháng</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedBookingForDetail(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold text-xs cursor-pointer"
              >
                Đóng
              </button>
              {(selectedBookingForDetail.status === 'ACTIVE' || selectedBookingForDetail.status === 'COMPLETED') && (
                <button
                  type="button"
                  onClick={() => {
                    const uCode = selectedBookingForDetail.unitCode
                    setSelectedBookingForDetail(null)
                    handleNavigateToUnitPortal(uCode)
                  }}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">dashboard</span>
                  <span>Vào Portal Quản Lý Kho (Khóa IoT)</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Booking Cancel Modal */}
      <BookingCancelModal
        isOpen={Boolean(selectedBookingForCancel)}
        booking={selectedBookingForCancel}
        onClose={() => setSelectedBookingForCancel(null)}
        onSuccess={() => {
          setSelectedBookingForCancel(null)
          fetchBookings()
          window.dispatchEvent(new Event('boxora:storage-units-refresh'))
        }}
      />

      {/* Booking Reschedule Modal */}
      <BookingRescheduleModal
        isOpen={Boolean(selectedBookingForReschedule)}
        booking={selectedBookingForReschedule}
        onClose={() => setSelectedBookingForReschedule(null)}
        onSuccess={() => {
          setSelectedBookingForReschedule(null)
          fetchBookings()
        }}
      />

      {/* Policy Modal */}
      <CustomerPolicyModal
        isOpen={isPolicyModalOpen}
        onClose={() => setIsPolicyModalOpen(false)}
        initialTab={policyModalTab}
        facilityName="Hệ thống Kho Thông Minh Boxora"
      />
    </>
  )

  if (embedded) {
    return (
      <div className="w-full space-y-6 text-left">
        {reservationsContent}
        {modalsContent}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors">
      <header className="sticky top-0 z-[100] border-b border-slate-200/70 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl transition-colors">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-10">
          <BrandLogo size="sm" subtitle="KHO TỰ QUẢN THÔNG MINH" />
          <nav className="hidden items-center gap-7 text-[13px] font-medium text-slate-600 dark:text-slate-300 lg:flex">
            <a href="/#services" className="transition-colors hover:text-slate-950 dark:hover:text-white">Dịch vụ</a>
            <a href="/#process" className="transition-colors hover:text-slate-950 dark:hover:text-white">Cách hoạt động</a>
            <a href="/#iot-access" className="transition-colors hover:text-slate-950 dark:hover:text-white">Công nghệ</a>
            <a href="/#faq" className="transition-colors hover:text-slate-950 dark:hover:text-white">Hỗ trợ</a>
          </nav>
          <div className="flex items-center gap-3">
            <QuickThemeLanguageToggle />
            {isAuthenticated ? (
              <UserAvatarDropdown
                user={user}
                role={user?.role?.name || 'CUSTOMER'}
                onOpenProfile={() => setIsProfileModalOpen(true)}
                onOpenSettings={() => setIsSettingsModalOpen(true)}
                onOpenLogoutConfirm={() => setIsLogoutConfirmOpen(true)}
                extraActions={
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => navigate('/portal/customer')}
                      className="w-full py-2.5 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs flex items-center justify-between transition-all cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-emerald-400">dashboard</span>
                        <span>{t('Vào Portal Quản Lý Kho (Khóa IoT)')}</span>
                      </span>
                      <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                    </button>
                  </div>
                }
              />
            ) : (
              <>
                <Link to="/login" className="px-3 py-2 text-[13px] font-medium text-slate-700 dark:text-slate-300 transition-colors hover:text-slate-950 dark:hover:text-white">
                  {t('Đăng Nhập')}
                </Link>
                <Link to="/booking" className="inline-flex items-center gap-1.5 rounded-full bg-blue-700 hover:bg-blue-800 px-4 py-2.5 text-[13px] font-semibold text-white transition-colors shadow-xs">
                  <span>{t('Thuê Kho Ngay')}</span>
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {reservationsContent}
      </main>
      {modalsContent}
      <AccountProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
      <WebSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
      />
      <LogoutConfirmModal
        isOpen={isLogoutConfirmOpen}
        onClose={() => setIsLogoutConfirmOpen(false)}
        onConfirm={async () => {
          await logout()
          navigate('/login')
        }}
        userName={user?.fullName || user?.username}
        userEmail={user?.email}
        userRole={user?.role?.name || 'CUSTOMER'}
      />
    </div>
  )
}
export default MyBookingsPage
