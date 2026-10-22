import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import QRCode from 'qrcode'
import {
  Calendar,
  Clock,
  Building2,
  Box,
  CreditCard,
  PhoneCall,
  CheckCircle2,
  AlertCircle,
  Copy,
  ChevronRight,
  RefreshCw,
  Search,
  Filter,
  FileText,
  ShieldCheck,
  ArrowRight,
  ExternalLink,
  X,
  Lock,
  Unlock,
  Sparkles,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { bookingService } from '../../services/bookingService'
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
import { checkCustomerPortalAccess, activateCustomerRental } from '../../utils/rentalAccess'

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

export const MyBookingsPage: React.FC = () => {
  const navigate = useNavigate()
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
  }, [user])

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

  // Data state
  const [bookings, setBookings] = useState<Booking[]>([])
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

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
              if (!existingCodes.has(code)) {
                localAsBookings.push({
                  id: `LOCAL-RES-${idx}-${code}`,
                  bookingCode: code,
                  customerId: user?.id || 'guest',
                  customerName: r.customer?.fullName || r.customerName || user?.fullName || 'Khách hàng',
                  customerEmail: r.customer?.email || r.customerEmail || user?.email || '',
                  customerPhone: r.customer?.phone || r.customerPhone || user?.phone || '',
                  identityCardNumber: r.identityCardNumber || r.customer?.idCard || '',
                  storageUnitId: `UNIT-${r.size?.volumeText || 'std'}`,
                  unitCode: r.unitCode || r.size?.volumeText || 'Kho Boxora',
                  facilityId: r.facility?.id || r.facilityId || 'FAC-LOCAL-1',
                  facilityName: r.facility?.name || r.facilityName || 'Boxora Smart Storage',
                  startDate: r.startDate || new Date().toISOString().split('T')[0],
                  endDate: r.rentalEndDate || new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
                  rentalMonths: r.duration?.months || r.rentalMonths || 1,
                  totalRentalFee: r.totalRentalFee || 0,
                  depositAmount: r.depositAmount || 0,
                  expectedCheckInAt: r.expectedCheckInAt || `${r.checkInDate || ''}T${r.checkInTime || '09:00'}:00`,
                  checkInDate: r.checkInDate,
                  checkInTime: r.checkInTime,
                  status: (r.status as any) || 'PENDING_CONTACT',
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
      // Search
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim()
        const matchCode = b.bookingCode?.toLowerCase().includes(q)
        const matchUnit = b.unitCode?.toLowerCase().includes(q)
        const matchFac = b.facilityName?.toLowerCase().includes(q)
        const matchPhone = b.customerPhone?.toLowerCase().includes(q)
        if (!matchCode && !matchUnit && !matchFac && !matchPhone) return false
      }

      // Facility
      if (facilityFilter !== 'ALL') {
        const facMatch = b.facilityId === facilityFilter || b.facilityName === facilityFilter
        if (!facMatch) return false
      }

      // Status
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'PENDING_CONTACT') {
          const isPending =
            (b.status as string) === 'PENDING_CONTACT' ||
            (b.status as string) === 'PENDING_CONFIRMATION' ||
            b.id?.startsWith('LOCAL-RES-')
          if (!isPending) return false
        } else if (statusFilter === 'CONFIRMED') {
          if (b.status !== 'CONFIRMED') return false
        } else if (statusFilter === 'ACTIVE_OR_SIGNED') {
          const isSigned = (b.status as string) === 'ACTIVE' || (b.status as string) === 'COMPLETED'
          if (!isSigned) return false
        } else if (statusFilter === 'CANCELLED') {
          if (b.status !== 'CANCELLED') return false
        } else if (b.status !== statusFilter) {
          return false
        }
      }

      return true
    })
  }, [bookings, searchTerm, facilityFilter, statusFilter])

  // Metric counts
  const totalCount = bookings.length
  const pendingContactCount = bookings.filter(
    (b) =>
      (b.status as string) === 'PENDING_CONTACT' ||
      (b.status as string) === 'PENDING_CONFIRMATION' ||
      b.id?.startsWith('LOCAL-RES-')
  ).length
  const confirmedCount = bookings.filter((b) => b.status === 'CONFIRMED').length
  const activeOrSignedCount = bookings.filter(
    (b) => (b.status as string) === 'ACTIVE' || (b.status as string) === 'COMPLETED'
  ).length

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors">
      {/* ================================================================ */}
      {/* 1. TOP UNIFIED NAVIGATION BAR (FROM HOMEPAGE & BOOKINGPAGE)       */}
      {/* ================================================================ */}
      <header className="sticky top-0 z-[100] border-b border-slate-200/70 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl transition-colors">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-10">
          {/* Brand Logo */}
          <BrandLogo size="sm" subtitle="KHO TỰ QUẢN THÔNG MINH" />

          {/* Nav Links (Desktop) */}
          <nav className="hidden items-center gap-7 text-[13px] font-medium text-slate-600 dark:text-slate-300 lg:flex">
            <a href="/#services" className="transition-colors hover:text-slate-950 dark:hover:text-white">
              Dịch vụ
            </a>
            <a href="/#process" className="transition-colors hover:text-slate-950 dark:hover:text-white">
              Cách hoạt động
            </a>
            <a href="/#iot-access" className="transition-colors hover:text-slate-950 dark:hover:text-white">
              Công nghệ
            </a>
            <a href="/#faq" className="transition-colors hover:text-slate-950 dark:hover:text-white">
              Hỗ trợ
            </a>
          </nav>

          {/* Action CTAs */}
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
                    {canAccessPortal ? (
                      <button
                        type="button"
                        onClick={() => navigate(isCustomer ? '/portal/customer' : '/portal')}
                        className="w-full py-2.5 px-3.5 rounded-xl bg-slate-900 dark:bg-blue-600 text-white font-semibold text-xs flex items-center justify-between hover:bg-neutral-800 dark:hover:bg-blue-700 transition-all shadow-xs cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[18px] text-emerald-400">dashboard</span>
                          <span>{isCustomer ? t('Vào Portal Quản Lý Kho (Khóa IoT)') : t('Vào Trang Điều Hành Portal')}</span>
                        </span>
                        <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => navigate('/my-bookings')}
                        className="w-full py-2.5 px-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-semibold text-xs flex items-center justify-between hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-all shadow-xs cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[18px] text-blue-600 dark:text-blue-400">calendar_month</span>
                          <span>{t('Đơn Đặt Giữ Chỗ Của Tôi')}</span>
                        </span>
                        <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                      </button>
                    )}
                  </div>
                }
              />
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-3 py-2 text-[13px] font-medium text-slate-700 dark:text-slate-300 transition-colors hover:text-slate-950 dark:hover:text-white"
                >
                  {t('Đăng Nhập')}
                </Link>
                <Link
                  to="/units"
                  className="inline-flex items-center gap-1.5 rounded-full bg-blue-700 hover:bg-blue-800 px-4 py-2.5 text-[13px] font-semibold text-white transition-colors shadow-xs"
                >
                  <span>{t('Thuê Kho Ngay')}</span>
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ================================================================ */}
      {/* 2. MAIN CONTENT BODY: DEDICATED RESERVATIONS DASHBOARD           */}
      {/* ================================================================ */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Page Title & Breadcrumbs */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
              <Link to="/" className="hover:text-blue-600 transition-colors">
                Trang chủ
              </Link>
              <span>/</span>
              <span className="text-slate-800 dark:text-slate-200 font-semibold">Đơn đặt chỗ của tôi</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Đơn Đặt Giữ Chỗ Của Tôi
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Dashboard riêng quản lý tiến trình giữ chỗ, lịch hẹn tiếp đón tại cơ sở và hoàn tất hợp đồng thuê kho.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setPolicyModalTab('cancellation')
                setIsPolicyModalOpen(true)
              }}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-all flex items-center gap-1.5 shadow-2xs"
            >
              <FileText size={15} className="text-blue-600" />
              <span>Chính sách cọc &amp; hủy</span>
            </button>

            <Link
              to="/booking"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white shadow-md shadow-blue-600/20 transition-all cursor-pointer"
            >
              <span>+ Đặt giữ thêm kho</span>
            </Link>
          </div>
        </div>

        {/* ============================================================== */}
        {/* ACCESS LOCK STATUS BANNER (CRITICAL USER SPECIFICATION)        */}
        {/* ============================================================== */}
        {!canAccessPortal ? (
          <div className="rounded-2xl border-2 border-amber-300 dark:border-amber-700/80 bg-gradient-to-r from-amber-50 via-amber-50/60 to-orange-50/40 dark:from-amber-950/40 dark:via-slate-900 dark:to-slate-900 p-5 sm:p-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Lock size={24} />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 font-bold text-[11px] uppercase tracking-wider">
                      Trạng thái bảo mật
                    </span>
                    <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                      Portal Quản Lý Kho &amp; Mã PIN IoT đang khóa
                    </h3>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed max-w-3xl">
                    Quý khách đang ở <strong>Dashboard riêng xem Đơn đặt giữ chỗ</strong>. Theo quy trình tại Boxora, <strong>thủ tục ký hợp đồng và thanh toán sẽ do nhân viên (Staff) thực hiện trực tiếp tại cơ sở</strong> khi quý khách đến nhận buồng kho theo lịch hẹn. Sau khi nhân viên hoàn tất thủ tục bàn giao, Portal quản lý khóa thông minh IoT 24/7 sẽ tự động mở khóa.
                  </p>
                </div>
              </div>

              <div className="shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <a
                  href="#bookings-list"
                  className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
                >
                  <span>Xem danh sách đơn giữ chỗ</span>
                  <ChevronRight size={16} />
                </a>
              </div>
            </div>

            {/* 4-Step Progress Roadmap */}
            <div className="mt-5 pt-4 border-t border-amber-200/80 dark:border-amber-900/50 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-amber-200 dark:border-amber-900/40">
                <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
                  ✓
                </span>
                <span className="font-medium text-slate-800 dark:text-slate-200">1. Đã tiếp nhận đặt giữ chỗ</span>
              </div>
              <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-amber-200 dark:border-amber-900/40">
                <span className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
                  2
                </span>
                <span className="font-medium text-slate-800 dark:text-slate-200">2. Chờ nhân viên xác nhận đơn</span>
              </div>
              <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-amber-100/90 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800">
                <span className="w-6 h-6 rounded-full bg-amber-600 text-white flex items-center justify-center text-xs font-bold shrink-0 animate-pulse">
                  3
                </span>
                <span className="font-bold text-amber-950 dark:text-amber-200">3. Nhân viên tiếp đón &amp; Ký HĐ, thanh toán</span>
              </div>
              <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-slate-400">
                <span className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-500 flex items-center justify-center text-xs font-bold shrink-0">
                  4
                </span>
                <span>4. Mở Portal &amp; Mã PIN IoT 24/7</span>
              </div>
            </div>
          </div>
        ) : (
          /* Unlocked Portal Congratulatory Banner */
          <div className="rounded-2xl border-2 border-emerald-400 dark:border-emerald-600 bg-gradient-to-r from-emerald-50 via-teal-50/60 to-cyan-50/40 dark:from-emerald-950/40 dark:via-slate-900 dark:to-slate-900 p-5 sm:p-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Unlock size={24} />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-200 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200 font-bold text-[11px] uppercase tracking-wider">
                      Đã kích hoạt thành công
                    </span>
                    <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                      Portal Quản Lý Kho &amp; Mã Khóa IoT Đã Mở Khóa!
                    </h3>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed max-w-3xl">
                    Quý khách đã hoàn tất ký hợp đồng và xác nhận thanh toán. Giờ đây quý khách có thể vào Portal điều khiển mã khóa IoT, xem mã PIN truy cập buồng kho và quản lý hợp đồng lưu kho 24/7.
                  </p>
                </div>
              </div>

              <div className="shrink-0">
                <button
                  type="button"
                  onClick={() => navigate('/portal/customer')}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">dashboard</span>
                  <span>Vào Portal Quản Lý Kho (Khóa IoT)</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* 3. SUMMARY STATS METRICS CARDS                                 */}
        {/* ============================================================== */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Tổng đơn giữ chỗ</span>
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
              <span className="text-xs font-semibold uppercase tracking-wider">Chờ xác nhận</span>
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
              <span className="text-xs font-semibold uppercase tracking-wider">Chờ check in</span>
              <CheckCircle2 size={20} className="text-cyan-500" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-cyan-600 dark:text-cyan-400 font-mono">
                {confirmedCount}
              </span>
              <span className="text-xs text-slate-400">đã tiếp nhận</span>
            </div>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Đã nhận kho</span>
              <ShieldCheck size={20} className="text-emerald-500" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                {activeOrSignedCount}
              </span>
              <span className="text-xs text-slate-400">đã mở Portal</span>
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
                placeholder="Tìm theo mã đơn (BX-...), kích thước, số điện thoại hoặc tên cơ sở..."
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

          {/* Status Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1">
            {[
              { key: 'ALL', label: 'Tất cả đơn', count: totalCount },
              { key: 'PENDING_CONTACT', label: 'Chờ xác nhận', count: pendingContactCount },
              { key: 'CONFIRMED', label: 'Chờ check in', count: confirmedCount },
              { key: 'ACTIVE_OR_SIGNED', label: 'Đã nhận kho', count: activeOrSignedCount },
              { key: 'CANCELLED', label: 'Đã hủy', count: bookings.filter((b) => b.status === 'CANCELLED').length },
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
        {/* 5. BOOKINGS LIST GRID                                          */}
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
              const isLocal = b.id?.startsWith('LOCAL-RES-')
              const isPendingContact = (b.status as string) === 'PENDING_CONTACT' || (b.status as string) === 'PENDING_CONFIRMATION' || isLocal
              const isConfirmed = b.status === 'CONFIRMED'
              const isActiveOrSigned = b.status === 'ACTIVE' || b.status === 'COMPLETED'
              const isCancelled = b.status === 'CANCELLED'

              return (
                <div
                  key={b.id}
                  className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-md transition-all flex flex-col justify-between gap-4"
                >
                  <div className="space-y-4">
                    {/* Header: Unit Code & Status Badge */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black text-sm">
                          {b.unitCode ? b.unitCode.substring(0, 3) : 'KHO'}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h3 className="font-mono text-base font-extrabold text-slate-900 dark:text-white">
                              {b.unitCode ? `#${b.unitCode}` : 'Kho Boxora'}
                            </h3>
                          </div>
                          <span className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[170px] block">
                            {b.facilityName}
                          </span>
                        </div>
                      </div>

                      {/* Status Badges */}
                      <div className="text-right flex flex-col items-end gap-1">
                        {isPendingContact && (
                          <>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                              <span>Chờ xác nhận</span>
                            </span>
                            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold">
                              📞 CSKH gọi 15-30p
                            </span>
                          </>
                        )}

                        {isConfirmed && (
                          <>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-cyan-100 dark:bg-cyan-950/80 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800">
                              <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></span>
                              <span>Chờ check in</span>
                            </span>
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                              ✓ Đã xác nhận đón
                            </span>
                          </>
                        )}

                        {isActiveOrSigned && (
                          <>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                              <CheckCircle2 size={12} className="text-emerald-600" />
                              <span>Đã Ký &amp; Thanh Toán</span>
                            </span>
                            <span className="text-[10px] text-emerald-600 font-semibold">
                              ✓ Đã mở Portal IoT
                            </span>
                          </>
                        )}

                        {isCancelled && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                            Đã Hủy
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Booking Code with Copy */}
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-xs">
                      <span className="text-slate-400 font-mono">MÃ ĐƠN:</span>
                      <div className="flex items-center gap-2">
                        <strong className="font-mono text-slate-900 dark:text-white font-bold text-sm">
                          {b.bookingCode}
                        </strong>
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

                    {/* Booking Details Grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                        <span className="text-slate-400 block text-[10px]">LỊCH HẸN CHECK-IN</span>
                        <div className="flex items-center gap-1 mt-1 font-semibold text-slate-800 dark:text-slate-200">
                          <Calendar size={13} className="text-blue-500 shrink-0" />
                          <span>{(b as any).checkInDate || safeFormatDate(b.expectedCheckInAt)}</span>
                        </div>
                        {b.checkInTime && (
                          <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                            <Clock size={12} />
                            <span>{b.checkInTime}</span>
                          </div>
                        )}
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                        <span className="text-slate-400 block text-[10px]">THỜI HẠN THUÊ</span>
                        <strong className="block mt-1 font-semibold text-slate-800 dark:text-slate-200">
                          {b.rentalMonths} tháng
                        </strong>
                        <span className="text-[10px] text-slate-400 block">
                          {safeFormatDate(b.startDate)} - {safeFormatDate(b.endDate)}
                        </span>
                      </div>
                    </div>

                    {/* Price Breakdown */}
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1.5 text-xs">
                      <div className="flex justify-between text-slate-500 dark:text-slate-400">
                        <span>Tiền thuê hàng tháng:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                          {Number(b.totalRentalFee / (b.rentalMonths || 1)).toLocaleString('vi-VN')} ₫
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-500 dark:text-slate-400">
                        <span>Tiền cọc giữ chỗ (1 tháng):</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                          {Number(b.depositAmount || b.totalRentalFee / (b.rentalMonths || 1)).toLocaleString('vi-VN')} ₫
                        </span>
                      </div>
                      <div className="pt-1.5 border-t border-slate-200 dark:border-slate-700 flex justify-between font-bold text-sm text-blue-700 dark:text-blue-400">
                        <span>Tổng thanh toán:</span>
                        <span className="font-mono">
                          {(
                            Number(b.totalRentalFee || 0) +
                            Number(b.depositAmount || b.totalRentalFee / (b.rentalMonths || 1))
                          ).toLocaleString('vi-VN')} ₫
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                    {/* Primary Action Button */}
                    {!isCancelled && (
                      isActiveOrSigned ? (
                        <button
                          type="button"
                          onClick={() => navigate('/portal/customer')}
                          className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[17px]">dashboard</span>
                          <span>Vào Portal Quản Lý Kho (Khóa IoT)</span>
                        </button>
                      ) : (
                        <div className="w-full p-2.5 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/60 text-left space-y-1">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900 dark:text-blue-300">
                            <span className="material-symbols-outlined text-[16px] text-blue-600 dark:text-cyan-400">badge</span>
                            <span>Ký HĐ &amp; Thanh toán do Staff thực hiện</span>
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                            Quý khách vui lòng mang theo CCCD bản gốc đến cơ sở vào ngày hẹn. Nhân viên Staff sẽ trực tiếp đối soát, lập hợp đồng và hỗ trợ thanh toán tại quầy.
                          </p>
                        </div>
                      )
                    )}

                    {/* Secondary Action Buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedBookingForDetail(b)}
                        className="flex-1 py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
                      >
                        Xem phiếu hẹn
                      </button>

                      {!isCancelled && !isActiveOrSigned && (
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
      </main>

      {/* ================================================================ */}
      {/* 6. MODALS                                                        */}
      {/* ================================================================ */}

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
                    Phiếu Giữ Chỗ Kho Boxora
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
                <span className="text-slate-400 block text-[10px]">KHÁCH HÀNG:</span>
                <strong className="text-slate-900 dark:text-white block mt-0.5">{selectedBookingForDetail.customerName}</strong>
                <span className="text-slate-500">{selectedBookingForDetail.customerPhone}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 block text-[10px]">LỊCH HẸN TIẾP ĐÓN:</span>
                <strong className="text-slate-900 dark:text-white block mt-0.5">
                  {(selectedBookingForDetail as any).checkInDate || safeFormatDate(selectedBookingForDetail.expectedCheckInAt)}
                </strong>
                <span className="text-blue-600 font-semibold">{selectedBookingForDetail.checkInTime || 'Giờ hành chính'}</span>
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
                    setSelectedBookingForDetail(null)
                    navigate('/portal/customer')
                  }}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer"
                >
                  Vào Portal Quản Lý Kho
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

      {/* Account / Settings / Logout Modals */}
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
