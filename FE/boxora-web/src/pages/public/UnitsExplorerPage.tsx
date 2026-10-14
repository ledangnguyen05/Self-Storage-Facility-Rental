import React, { useState, useMemo, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  StorageUnitType,
  CustomerLocationOption,
  BOXORA_FACILITIES,
  CUSTOMER_LOCATIONS,
  STORAGE_UNITS,
  calculateDistanceKm,
  estimateTravelMinutes
} from '../../data/storageUnitsData'
import { checkCustomerPortalAccess, activateCustomerRental } from '../../utils/rentalAccess'
import { FloatingContactWidget } from '../../components/common/FloatingContactWidget'
import { facilityService } from '../../services/facilityService'
import { storageUnitService } from '../../services/storageUnitService'
import { bookingService } from '../../services/bookingService'
import { BrandLogo } from '../../components/common/BrandLogo'
import { AccountProfileModal } from '../../components/common/AccountProfileModal'
import { LogoutConfirmModal } from '../../components/common/LogoutConfirmModal'
import { WebSettingsModal } from '../../components/common/WebSettingsModal'
import { UserAvatarDropdown } from '../../components/common/UserAvatarDropdown'
import { QuickThemeLanguageToggle } from '../../components/common/QuickThemeLanguageToggle'
import { useLanguage } from '../../context/LanguageContext'
import { Facility, StorageUnit } from '../../types'

export const UnitsExplorerPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { isAuthenticated, user, logout } = useAuth()
  const { t } = useLanguage()
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false)

  // Real Database Data State
  const [dbFacilities, setDbFacilities] = useState<Facility[]>([])
  const [rawUnits, setRawUnits] = useState<StorageUnit[]>([])
  const [loadingUnits, setLoadingUnits] = useState(true)

  // Customer rental access
  const isCustomer = user?.role?.name === 'CUSTOMER'
  const [customerAccess, setCustomerAccess] = useState(() => checkCustomerPortalAccess(user))
  const canAccessPortal = !isCustomer || customerAccess.hasAccess

  // Filter States
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<'all' | 'mini' | 'personal' | 'business' | 'special'>('all')
  const [selectedFacilityFilter, setSelectedFacilityFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'Sẵn sàng' | 'Đang thuê'>('all')
  const [sortByDistance, setSortByDistance] = useState<boolean>(true)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  // Customer Location State
  const [customerLocation, setCustomerLocation] = useState<CustomerLocationOption>(CUSTOMER_LOCATIONS[0])
  const [isLocatingGPS, setIsLocatingGPS] = useState<boolean>(false)
  const [gpsNotice, setGpsNotice] = useState<string | null>(null)

  // Selected Unit & Modal State
  const [selectedUnit, setSelectedUnit] = useState<StorageUnitType>(STORAGE_UNITS[0])
  const [rentalModalUnit, setRentalModalUnit] = useState<StorageUnitType | null>(null)
  const [isActivatingRental, setIsActivatingRental] = useState(false)
  const [activationDone, setActivationDone] = useState(false)
  const [activatedPin, setActivatedPin] = useState('841 902')
  const [copiedPin, setCopiedPin] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  // Fetch real data from backend database
  useEffect(() => {
    const fetchRealData = async () => {
      try {
        setLoadingUnits(true)
        const [facRes, unitRes] = await Promise.all([
          facilityService.getFacilities({ size: 100 }),
          storageUnitService.getUnits()
        ])
        const facList = facRes?.content || []
        const unitList = Array.isArray(unitRes) ? unitRes : []
        setDbFacilities(facList)
        setRawUnits(unitList)
      } catch (err) {
        console.error('Failed to load database units in UnitsExplorerPage:', err)
      } finally {
        setLoadingUnits(false)
      }
    }
    fetchRealData()
  }, [])

  const effectiveFacilities = useMemo(() => {
    if (dbFacilities.length === 0) return BOXORA_FACILITIES
    return dbFacilities.map(f => {
      let coords = { lat: 10.7745, lng: 106.6925 }
      const fName = (f.name || '').toLowerCase()
      if (fName.includes('district 7') || fName.includes('quận 7')) coords = { lat: 10.7380, lng: 106.7082 }
      if (fName.includes('thu duc') || fName.includes('thủ đức')) coords = { lat: 10.8521, lng: 106.7684 }
      if (fName.includes('tan binh') || fName.includes('tân bình')) coords = { lat: 10.8015, lng: 106.6550 }
      return {
        id: f.id,
        name: f.name,
        shortName: f.name.replace('StoreHub ', 'Boxora '),
        district: f.city || 'TP.HCM',
        address: f.address,
        coords,
        contactPhone: f.contactPhone
      }
    })
  }, [dbFacilities])

  const effectiveUnits: StorageUnitType[] = useMemo(() => {
    if (rawUnits.length === 0) return STORAGE_UNITS
    const facMap = new Map(effectiveFacilities.map(f => [f.id, f]))

    return rawUnits.map(su => {
      const fac = facMap.get(su.facilityId)
      const coords = fac?.coords || { lat: 10.7745, lng: 106.6925 }
      const area = su.areaSqMeters || 8

      let category: StorageUnitType['category'] = 'personal'
      if ((su.unitTypeName || '').toLowerCase().includes('climate') || (su.unitTypeName || '').toLowerCase().includes('lạnh')) {
        category = 'special'
      } else if (area <= 7) {
        category = 'mini'
      } else if (area <= 11) {
        category = 'personal'
      } else {
        category = 'business'
      }

      const statusMap: Record<string, StorageUnitType['status']> = {
        'AVAILABLE': 'Sẵn sàng',
        'OCCUPIED': 'Đang thuê',
        'UNDER_MAINTENANCE': 'Bảo trì',
        'MAINTENANCE': 'Bảo trì',
        'RESERVED': 'Đang thuê'
      }

      return {
        id: su.id,
        name: `Kho #${su.unitCode} — ${su.unitTypeName || 'Standard'}`,
        category,
        size: `${area.toFixed(1)} m²`,
        volume: `${(area * 3.0).toFixed(1)} m³`,
        capacityDesc: `Sức chứa tiêu chuẩn ${su.unitTypeName || 'chuyên dụng'}, chiều cao 3.0m`,
        itemsExample: area <= 7 ? ['Vali', 'Thùng carton', 'Đồ gia dụng nhỏ'] : area <= 11 ? ['Tủ lạnh mini', 'Xe máy', 'Bàn ghế', 'Hồ sơ'] : ['Pallet hàng hóa', 'Thiết bị văn phòng', 'Nội thất gia đình trọn gói'],
        monthlyPrice: `${Number(su.pricePerMonth || 0).toLocaleString('vi-VN')} ₫/tháng`,
        monthlyPriceNumeric: Number(su.pricePerMonth || 0),
        temp: (su.unitTypeName || '').toLowerCase().includes('climate') ? '18°C - 22°C' : '23.5°C',
        humidity: '45% - 55% RH',
        status: statusMap[su.status] || 'Sẵn sàng',
        facilityId: su.facilityId,
        facilityName: su.facilityName || fac?.name || 'Boxora Hub',
        facilityAddress: fac?.address || 'TP. Hồ Chí Minh',
        floorLocation: `${su.floorLevel || 'Floor 1'} (Khối #${su.unitCode})`,
        coords
      }
    })
  }, [rawUnits, effectiveFacilities])

  // Update selected unit when effectiveUnits load
  useEffect(() => {
    if (effectiveUnits.length > 0 && (!selectedUnit || !effectiveUnits.some(u => u.id === selectedUnit.id))) {
      setSelectedUnit(effectiveUnits[0])
    }
  }, [effectiveUnits])

  // Check URL query for default unit
  useEffect(() => {
    const unitParam = searchParams.get('unit')
    if (unitParam) {
      const match = effectiveUnits.find(u => u.id === unitParam || u.name.includes(unitParam))
      if (match) {
        setSelectedUnit(match)
      }
    }
  }, [searchParams, effectiveUnits])

  // Listen to rental update events
  useEffect(() => {
    const handleRentalChange = () => {
      setCustomerAccess(checkCustomerPortalAccess(user))
    }
    window.addEventListener('boxora_rental_updated', handleRentalChange)
    return () => window.removeEventListener('boxora_rental_updated', handleRentalChange)
  }, [user])

  const handleGetGpsLocation = () => {
    if (!navigator.geolocation) {
      setGpsNotice('Trình duyệt của bạn không hỗ trợ Geolocation.')
      return
    }
    setIsLocatingGPS(true)
    setGpsNotice(null)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        const gpsLocation: CustomerLocationOption = {
          id: 'loc-gps',
          label: `GPS Tọa độ thực (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
          district: 'GPS Của Bạn',
          detailAddress: `Vị trí định vị GPS thực tế: ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
          coords: { lat, lng },
          isGps: true
        }
        setCustomerLocation(gpsLocation)
        setIsLocatingGPS(false)
        setGpsNotice('Đã xác định vị trí GPS thực tế của bạn!')
        setTimeout(() => setGpsNotice(null), 4000)
      },
      () => {
        setIsLocatingGPS(false)
        setGpsNotice('Không thể lấy vị trí GPS (vui lòng cho phép quyền truy cập vị trí).')
        setTimeout(() => setGpsNotice(null), 4000)
      },
      { timeout: 8000, enableHighAccuracy: true }
    )
  }

  // Calculate dynamic proximity (distance & travel time) from customer location
  const unitsWithProximity = useMemo(() => {
    return effectiveUnits.map(unit => {
      const dist = calculateDistanceKm(
        customerLocation.coords.lat,
        customerLocation.coords.lng,
        unit.coords.lat,
        unit.coords.lng
      )
      const mins = estimateTravelMinutes(dist)
      return {
        ...unit,
        distanceKm: dist,
        travelMins: mins
      }
    })
  }, [effectiveUnits, customerLocation])

  const filteredUnits = useMemo(() => {
    let list = unitsWithProximity.filter(u => {
      const matchCat = activeCategory === 'all' || u.category === activeCategory
      const matchFac = selectedFacilityFilter === 'all' || u.facilityId === selectedFacilityFilter
      const matchStatus = statusFilter === 'all' || u.status === statusFilter
      const matchQuery =
        !searchQuery.trim() ||
        u.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.facilityName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.itemsExample.some(item => item.toLowerCase().includes(searchQuery.toLowerCase()))

      return matchCat && matchFac && matchStatus && matchQuery
    })

    if (sortByDistance) {
      list = [...list].sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0))
    }
    return list
  }, [unitsWithProximity, activeCategory, selectedFacilityFilter, statusFilter, searchQuery, sortByDistance])

  const nearestUnit = useMemo(() => {
    if (unitsWithProximity.length === 0) return null
    return [...unitsWithProximity].sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0))[0]
  }, [unitsWithProximity])

  const handleRentUnitClick = (unit: StorageUnitType) => {
    if (!isAuthenticated) {
      navigate(`/register?unit=${unit.id}`)
      return
    }
    const randomPin = `${Math.floor(100 + Math.random() * 900)} ${Math.floor(100 + Math.random() * 900)}`
    setActivatedPin(randomPin)
    setActivationDone(false)
    setIsActivatingRental(false)
    setRentalModalUnit(unit)
  }

  const handleConfirmRentalActivation = async () => {
    if (!rentalModalUnit || !user) return
    setIsActivatingRental(true)
    try {
      const priceNum = Number(rentalModalUnit.monthlyPriceNumeric || 1850000)
      const res = await bookingService.createBooking({
        storageUnitId: rentalModalUnit.id.length === 36 ? rentalModalUnit.id : (rawUnits[0]?.id || 'b0000000-0000-0000-0000-000000000101'),
        customerId: user?.id,
        startDate: new Date().toISOString().split('T')[0],
        rentalMonths: 3,
        totalRentalFee: priceNum * 3,
        depositPaid: priceNum
      })
      if (res?.accessPin) {
        setActivatedPin(res.accessPin)
      }
    } catch (err) {
      console.warn('Booking create fallback:', err)
    } finally {
      activateCustomerRental(user, rentalModalUnit.id, rentalModalUnit.name)
      setIsActivatingRental(false)
      setActivationDone(true)
      setCustomerAccess(checkCustomerPortalAccess(user))
    }
  }

  return (
    <div className="min-h-screen bg-[var(--surface-canvas,#f8fafc)] text-slate-900 font-sans selection:bg-blue-600 selection:text-white pb-20">
      
      {/* ============================================================ */}
      {/* 1. TOP HEADER & NAVIGATION                                   */}
      {/* ============================================================ */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          
          {/* Logo & Explorer Identity */}
          <div className="flex items-center gap-4 sm:gap-6">
            <BrandLogo subtitle="STORAGE EXPLORER" />

            <div className="hidden sm:flex items-center gap-2 border-l border-slate-200 pl-4">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono">
                Tìm Kiếm &amp; Đặt Thuê Kho
              </span>
            </div>
          </div>

          {/* Navigation Links & User Action */}
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="hidden md:flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              <span>{t('Trang Giới Thiệu (Landing)')}</span>
            </Link>

            <QuickThemeLanguageToggle />

            {isAuthenticated ? (
              <UserAvatarDropdown
                user={user}
                role={user?.role?.name || 'CUSTOMER'}
                onOpenProfile={() => setIsProfileModalOpen(true)}
                onOpenSettings={() => setIsSettingsModalOpen(true)}
                onOpenLogoutConfirm={() => setIsLogoutConfirmOpen(true)}
                extraActions={
                  canAccessPortal ? (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => navigate(isCustomer ? '/portal/customer' : '/portal')}
                        className="w-full py-2.5 px-3.5 rounded-xl bg-slate-900 dark:bg-blue-600 text-white font-semibold text-xs flex items-center justify-between hover:bg-neutral-800 dark:hover:bg-blue-700 transition-all shadow-xs cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[18px] text-emerald-400">dashboard</span>
                          <span>{t('Vào Portal')}</span>
                        </span>
                        <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                      </button>
                    </div>
                  ) : undefined
                }
              />
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-cyan-400 transition-colors"
                >
                  {t('Đăng Nhập')}
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-all flex items-center gap-1"
                >
                  <span>{t('Đăng Ký Thuê')}</span>
                  <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                </Link>
              </div>
            )}
          </div>

        </div>
      </header>

      {/* ============================================================ */}
      {/* 2. DASHBOARD HERO BANNER                                     */}
      {/* ============================================================ */}
      <section className="bg-gradient-to-b from-white to-slate-50 border-b border-slate-200 py-10 sm:py-14 text-left">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          
          <div className="max-w-3xl space-y-2">
            <h1 className="font-headline text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Tìm Kiếm &amp; Đặt Thuê Kho Trực Tuyến
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-2xl">
              Định vị vị trí hiện tại của bạn, kiểm tra cự ly thực tế tới các chi nhánh, so sánh phân hạng buồng kho và đặt giữ chỗ ngay để nhận mã PIN tự quản 24/7.
            </p>
          </div>

        </div>
      </section>

      {/* ============================================================ */}
      {/* 3. LOCATION & PROXIMITY CONTROL CENTER                       */}
      {/* ============================================================ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-8">
        
        <div className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200 shadow-sm text-left space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">near_me</span>
              </div>
              <div>
                <h2 className="font-headline text-base font-bold text-slate-900">
                  Đối Chiếu Vị Trí Của Bạn &amp; Cơ Sở Kho Muốn Thuê
                </h2>
                <p className="text-[11px] text-slate-500">
                  Xác định vị trí người thuê để hệ thống tự động đo cự ly (km) và thời gian di chuyển chính xác đến từng kho
                </p>
              </div>
            </div>

            {/* Nearest Unit Highlight Badge */}
            {nearestUnit && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold self-start sm:self-auto">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                <span>
                  Kho gần bạn nhất: <strong>{nearestUnit.facilityName.split('—')[0].trim()}</strong> ({nearestUnit.distanceKm} km • ~{nearestUnit.travelMins} phút)
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5 items-start">
            
            {/* Column 1: VỊ TRÍ CỦA NGƯỜI THUÊ KHO (5 Cols) */}
            <div className="lg:col-span-5 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[17px] text-cyan-600">person_pin_circle</span>
                  <span>1. Vị trí của bạn (Khách thuê đang ở đâu?)</span>
                </label>
                {customerLocation.isGps && (
                  <span className="font-mono text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-bold">
                    GPS Trực Tiếp
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={customerLocation.id}
                  onChange={(e) => {
                    const selected = CUSTOMER_LOCATIONS.find(loc => loc.id === e.target.value)
                    if (selected) {
                      setCustomerLocation(selected)
                      setGpsNotice(null)
                    }
                  }}
                  className="flex-1 px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500 shadow-2xs"
                >
                  {customerLocation.isGps && (
                    <option value="loc-gps">{customerLocation.label}</option>
                  )}
                  {CUSTOMER_LOCATIONS.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.label}
                    </option>
                  ))}
                </select>

                {/* GPS Locator Button */}
                <button
                  type="button"
                  onClick={handleGetGpsLocation}
                  disabled={isLocatingGPS}
                  className="px-3 py-2.5 rounded-xl bg-slate-900 hover:bg-neutral-800 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors shadow-2xs cursor-pointer disabled:opacity-60"
                  title="Định vị GPS thực tế của bạn"
                >
                  {isLocatingGPS ? (
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <span className="material-symbols-outlined text-[16px] text-cyan-400">my_location</span>
                  )}
                  <span className="hidden sm:inline">GPS của tôi</span>
                </button>
              </div>

              {/* Customer Location Detail info */}
              <div className="text-[11px] text-slate-600 flex items-center gap-1 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200/70">
                <span className="material-symbols-outlined text-[14px] text-slate-500 shrink-0">pin_drop</span>
                <span className="truncate">
                  <strong>Điểm xuất phát:</strong> {customerLocation.detailAddress}
                </span>
              </div>

              {gpsNotice && (
                <p className="text-[11px] text-cyan-700 font-medium animate-in fade-in">
                  {gpsNotice}
                </p>
              )}
            </div>

            {/* Column 2: VỊ TRÍ CƠ SỞ KHO MUỐN THUÊ (5 Cols) */}
            <div className="lg:col-span-5 space-y-2.5">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[17px] text-[var(--brand-teal,#0891b2)]">domain</span>
                <span>2. Vị trí cơ sở kho muốn thuê</span>
              </label>

              <select
                value={selectedFacilityFilter}
                onChange={(e) => setSelectedFacilityFilter(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500 shadow-2xs"
              >
                <option value="all">Tất Cả Cơ Sở Kho Boxora ({effectiveFacilities.length} Chi Nhánh)</option>
                {effectiveFacilities.map((fac) => {
                  const dist = calculateDistanceKm(
                    customerLocation.coords.lat,
                    customerLocation.coords.lng,
                    fac.coords.lat,
                    fac.coords.lng
                  )
                  const mins = estimateTravelMinutes(dist)
                  return (
                    <option key={fac.id} value={fac.id}>
                      {fac.name} (Cách bạn: {dist} km • ~{mins} phút)
                    </option>
                  )
                })}
              </select>

              {/* Facility summary highlight */}
              <div className="text-[11px] text-slate-600 flex items-center gap-1 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200/70">
                <span className="material-symbols-outlined text-[14px] text-slate-500 shrink-0">warehouse</span>
                <span className="truncate">
                  {selectedFacilityFilter === 'all'
                    ? `Đang hiển thị các phòng kho trên toàn hệ thống ${effectiveFacilities.length} cơ sở`
                    : effectiveFacilities.find(f => f.id === selectedFacilityFilter)?.address || ''}
                </span>
              </div>
            </div>

            {/* Column 3: SORT & PROXIMITY TOGGLE (2 Cols) */}
            <div className="lg:col-span-2 space-y-2.5">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[17px] text-amber-600">tune</span>
                <span>Sắp xếp cự ly</span>
              </label>

              <button
                type="button"
                onClick={() => setSortByDistance(prev => !prev)}
                className={`w-full py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer ${
                  sortByDistance
                    ? 'bg-cyan-600 text-white border-cyan-600 shadow-cyan-600/20 shadow-xs'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">
                  {sortByDistance ? 'check_circle' : 'swap_vert'}
                </span>
                <span>{sortByDistance ? 'Gần tôi nhất' : 'Gần tôi nhất'}</span>
              </button>

              <p className="text-[10px] text-slate-500 text-center">
                {sortByDistance ? '✓ Đang xếp theo km ngắn nhất' : 'Bật để ưu tiên kho gần bạn'}
              </p>
            </div>

          </div>
        </div>

        {/* ============================================================ */}
        {/* 4. CATEGORY TABS & SEARCH TOOLBAR                            */}
        {/* ============================================================ */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-200/80 border border-slate-300/80 self-start md:self-auto overflow-x-auto max-w-full">
            {[
              { id: 'all', label: 'Tất Cả Phân Hạng' },
              { id: 'mini', label: 'Locker Mini (1-3m²)' },
              { id: 'personal', label: 'Kho Cá Nhân (4-8m²)' },
              { id: 'business', label: 'Kho Doanh Nghiệp (10-20m²)' },
              { id: 'special', label: 'Kho Lạnh Rượu' }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveCategory(tab.id as any)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  activeCategory === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search, Status & View Toggle */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative min-w-[200px] flex-1 sm:flex-none">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-slate-400">
                search
              </span>
              <input
                type="text"
                placeholder="Tìm mã kho, đồ đạc..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              )}
            </div>

            {/* Status Select */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none"
            >
              <option value="all">Tất cả tình trạng</option>
              <option value="Sẵn sàng">Sẵn sàng (Thuê ngay)</option>
              <option value="Đang thuê">Đang thuê</option>
            </select>

            {/* Grid / List View Toggle */}
            <div className="flex items-center gap-0.5 bg-white border border-slate-300 rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1 rounded ${viewMode === 'grid' ? 'bg-slate-100 text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
                title="Dạng lưới"
              >
                <span className="material-symbols-outlined text-[18px]">grid_view</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-1 rounded ${viewMode === 'list' ? 'bg-slate-100 text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
                title="Dạng danh sách"
              >
                <span className="material-symbols-outlined text-[18px]">view_list</span>
              </button>
            </div>
          </div>

        </div>

        {/* ============================================================ */}
        {/* 5. STORAGE UNITS INVENTORY (GRID OR LIST)                    */}
        {/* ============================================================ */}
        {filteredUnits.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <span className="material-symbols-outlined text-5xl text-slate-300">inventory_2</span>
            <h3 className="font-headline text-base font-bold text-slate-800">
              Không tìm thấy phòng kho phù hợp
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Vui lòng thử chọn lại phân hạng, cơ sở hoặc xóa từ khóa tìm kiếm để xem các phòng kho khả dụng khác.
            </p>
            <button
              type="button"
              onClick={() => {
                setActiveCategory('all')
                setSelectedFacilityFilter('all')
                setStatusFilter('all')
                setSearchQuery('')
              }}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              Xem Lại Tất Cả Phòng Kho
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          /* GRID VIEW */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-left items-stretch">
            {filteredUnits.map((unit) => {
              const isSelected = selectedUnit.id === unit.id
              return (
                <div
                  key={unit.id}
                  onClick={() => setSelectedUnit(unit)}
                  className={`p-6 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-5 h-full ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/20 ring-2 ring-blue-500/20 shadow-md'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                  }`}
                >
                  <div className="flex-1 flex flex-col space-y-3.5">
                    {/* Top unit code & status */}
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md">
                        {unit.id}
                      </span>
                      <span
                        className={`font-mono text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                          unit.status === 'Sẵn sàng'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : unit.status === 'Đang thuê'
                            ? 'bg-cyan-50 text-cyan-700 border-cyan-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {unit.status}
                      </span>
                    </div>

                    {/* Unit Title */}
                    <div>
                      <h3 className="font-headline text-lg font-bold text-slate-900">{unit.name}</h3>
                      
                      {/* Size & Volume Badges */}
                      <div className="flex items-center gap-2 font-mono text-xs text-slate-600 mt-1">
                        <span className="font-semibold text-slate-900">{unit.size}</span>
                        <span>•</span>
                        <span>Thể tích {unit.volume}</span>
                        <span>•</span>
                        <span className="text-teal-700 font-semibold">{unit.temp}</span>
                      </div>
                    </div>

                    {/* VỊ TRÍ KHO & CỰ LY DI CHUYỂN */}
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/90 space-y-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 font-bold text-slate-800 min-w-0">
                          <span className="material-symbols-outlined text-[16px] text-blue-600 shrink-0">
                            domain
                          </span>
                          <span className="truncate" title={unit.facilityName}>
                            {unit.facilityName}
                          </span>
                        </div>
                        <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-cyan-100 text-cyan-900 border border-cyan-200 flex items-center gap-1 shrink-0">
                          <span className="material-symbols-outlined text-[13px] text-cyan-700">directions_car</span>
                          {unit.distanceKm} km • ~{unit.travelMins}p
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-600 flex items-start gap-1">
                        <span className="material-symbols-outlined text-[14px] text-slate-400 shrink-0 mt-0.5">location_on</span>
                        <span className="line-clamp-1" title={unit.facilityAddress}>
                          {unit.facilityAddress}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-700 font-medium flex items-center gap-1 pt-1 border-t border-slate-200/60">
                        <span className="material-symbols-outlined text-[14px] text-amber-600 shrink-0">door_front</span>
                        <span className="truncate" title={unit.floorLocation}>
                          {unit.floorLocation}
                        </span>
                      </div>

                      <div className="pt-1 flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 font-mono text-[10px]">
                          Từ: {customerLocation.district}
                        </span>
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(unit.facilityAddress)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-0.5 hover:underline"
                        >
                          <span>Xem chỉ đường</span>
                          <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                        </a>
                      </div>
                    </div>

                    {/* Sức Chứa Thực Tế */}
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs text-slate-600 leading-relaxed">
                      <strong className="text-slate-800 block mb-0.5">Sức chứa thực tế:</strong>
                      {unit.capacityDesc}
                    </div>

                    {/* Example Items */}
                    <div className="flex flex-wrap gap-1.5">
                      {unit.itemsExample.map((item) => (
                        <span key={item} className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Price & CTA */}
                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="font-mono text-xl font-bold text-slate-900 tabular-nums">
                        {unit.monthlyPrice}
                      </span>
                      <span className="text-xs text-slate-500 font-normal"> / tháng</span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRentUnitClick(unit)
                      }}
                      className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <span>Giữ Chỗ / Thuê</span>
                      <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                    </button>
                  </div>

                </div>
              )
            })}
          </div>
        ) : (
          /* LIST VIEW */
          <div className="space-y-4">
            {filteredUnits.map((unit) => {
              const isSelected = selectedUnit.id === unit.id
              return (
                <div
                  key={unit.id}
                  onClick={() => setSelectedUnit(unit)}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 text-left ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/20 ring-2 ring-blue-500/20 shadow-md'
                      : 'border-slate-200 bg-white hover:border-slate-300 shadow-2xs'
                  }`}
                >
                  {/* Left Column: Code, Name, Size */}
                  <div className="space-y-2 min-w-[260px]">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                        {unit.id}
                      </span>
                      <span
                        className={`font-mono text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          unit.status === 'Sẵn sàng'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : unit.status === 'Đang thuê'
                            ? 'bg-cyan-50 text-cyan-700 border-cyan-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {unit.status}
                      </span>
                    </div>
                    <h3 className="font-headline text-base font-bold text-slate-900">{unit.name}</h3>
                    <div className="flex items-center gap-2 font-mono text-xs text-slate-500">
                      <span>{unit.size}</span>
                      <span>•</span>
                      <span>{unit.volume}</span>
                      <span>•</span>
                      <span className="text-teal-700 font-semibold">{unit.temp}</span>
                    </div>
                  </div>

                  {/* Middle Column: Facility, Floor Location, Distance */}
                  <div className="space-y-1.5 flex-1 max-w-xl text-xs">
                    <div className="flex items-center gap-2">
                      <strong className="text-slate-800">{unit.facilityName}</strong>
                      <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-cyan-100 text-cyan-900 border border-cyan-200 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px] text-cyan-700">directions_car</span>
                        {unit.distanceKm} km • ~{unit.travelMins}p
                      </span>
                    </div>
                    <p className="text-slate-500 text-[11px] flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px] text-slate-400">location_on</span>
                      <span>{unit.facilityAddress}</span>
                    </p>
                    <p className="text-slate-700 font-medium text-[11px] flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px] text-amber-600">door_front</span>
                      <span>{unit.floorLocation}</span>
                    </p>
                  </div>

                  {/* Right Column: Price & Button */}
                  <div className="flex items-center justify-between lg:justify-end gap-6 w-full lg:w-auto pt-4 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                    <div className="text-left lg:text-right">
                      <span className="font-mono text-xl font-bold text-slate-900 tabular-nums block">
                        {unit.monthlyPrice}
                      </span>
                      <span className="text-[10px] text-slate-500">/ tháng</span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRentUnitClick(unit)
                      }}
                      className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>Giữ Chỗ / Thuê</span>
                      <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                    </button>
                  </div>

                </div>
              )
            })}
          </div>
        )}

      </section>

      {/* ============================================================ */}
      {/* 6. RENTAL BOOKING & APP ACTIVATION MODAL                    */}
      {/* ============================================================ */}
      {rentalModalUnit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden text-left animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white">
                  <span className="material-symbols-outlined text-[22px]">verified</span>
                </div>
                <div>
                  <h3 className="font-headline text-lg font-bold">
                    {activationDone ? 'Xác Nhận Kích Hoạt Mở App Thành Công' : 'Thuê Kho & Bàn Giao Mã Kích Hoạt App'}
                  </h3>
                  <p className="text-xs text-slate-400">Hệ thống kho thông minh Boxora Cloud</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRentalModalUnit(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              {!activationDone ? (
                <>
                  {/* Unit summary */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-800">
                          {rentalModalUnit.id}
                        </span>
                        <span className="font-headline font-bold text-sm text-slate-900">
                          {rentalModalUnit.name}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-mono">
                        {rentalModalUnit.size} • {rentalModalUnit.volume} • Nhiệt ẩm {rentalModalUnit.temp}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-base font-bold text-blue-600 block">
                        {rentalModalUnit.monthlyPrice}
                      </span>
                      <span className="text-[10px] text-slate-500">/ tháng</span>
                    </div>
                  </div>

                  {/* Location & Routing Summary */}
                  <div className="p-4 rounded-xl bg-gradient-to-br from-slate-50 to-cyan-50/40 border border-slate-200 text-xs space-y-2.5">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
                      <span className="font-bold text-slate-800 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-cyan-600">location_on</span>
                        <span>Đối Chiếu Vị Trí &amp; Lộ Trình Di Chuyển</span>
                      </span>
                      <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-cyan-100 text-cyan-900 border border-cyan-200 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px] text-cyan-700">directions_car</span>
                        {rentalModalUnit.distanceKm ?? calculateDistanceKm(customerLocation.coords.lat, customerLocation.coords.lng, rentalModalUnit.coords.lat, rentalModalUnit.coords.lng)} km • ~{rentalModalUnit.travelMins ?? estimateTravelMinutes(1)}p
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                      {/* Customer Location */}
                      <div className="space-y-0.5">
                        <span className="text-slate-400 font-semibold block uppercase text-[10px]">Vị trí của bạn (Khách thuê):</span>
                        <div className="text-slate-800 font-medium flex items-start gap-1">
                          <span className="material-symbols-outlined text-[13px] text-cyan-600 shrink-0 mt-0.5">person_pin</span>
                          <span>{customerLocation.detailAddress}</span>
                        </div>
                      </div>

                      {/* Storage Unit Location */}
                      <div className="space-y-0.5">
                        <span className="text-slate-400 font-semibold block uppercase text-[10px]">Vị trí kho muốn thuê:</span>
                        <div className="text-slate-800 font-medium flex items-start gap-1">
                          <span className="material-symbols-outlined text-[13px] text-blue-600 shrink-0 mt-0.5">warehouse</span>
                          <span><strong>{rentalModalUnit.facilityName}</strong></span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]">
                      <div className="text-slate-600 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px] text-amber-600 shrink-0">door_front</span>
                        <span>{rentalModalUnit.floorLocation}</span>
                      </div>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(rentalModalUnit.facilityAddress)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-0.5 hover:underline self-end sm:self-auto"
                      >
                        <span>Mở bản đồ chỉ đường</span>
                        <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                      </a>
                    </div>
                  </div>

                  {/* Customer Info */}
                  <div className="p-3.5 rounded-xl bg-cyan-50/50 border border-cyan-100 text-xs text-slate-700 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Khách thuê:</span>
                      <strong className="text-slate-900">{user?.fullName || user?.username}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Email:</span>
                      <span className="font-mono text-slate-900">{user?.email || 'customer@boxora.vn'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Thời gian bắt đầu:</span>
                      <span className="font-mono text-slate-900">{new Date().toLocaleDateString('vi-VN')}</span>
                    </div>
                  </div>

                  {/* Checklist Items */}
                  <div className="space-y-2.5 text-xs">
                    <span className="font-semibold text-slate-900 block">Quy trình cấp quyền truy cập:</span>
                    <div className="flex items-start gap-2.5 text-slate-600">
                      <span className="material-symbols-outlined text-[18px] text-emerald-600 shrink-0">check_circle</span>
                      <span>Ký kết thỏa thuận hợp đồng điện tử tự quản thông minh.</span>
                    </div>
                    <div className="flex items-start gap-2.5 text-slate-600">
                      <span className="material-symbols-outlined text-[18px] text-emerald-600 shrink-0">check_circle</span>
                      <span>Cấp mã PIN mở cửa tự động 24/7 bảo mật riêng biệt.</span>
                    </div>
                    <div className="flex items-start gap-2.5 text-slate-600">
                      <span className="material-symbols-outlined text-[18px] text-emerald-600 shrink-0">check_circle</span>
                      <span><strong>Kích hoạt dịch vụ &amp; quyền mở app:</strong> Mở toàn quyền quản lý kho trên Cổng khách hàng (Customer Portal).</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setRentalModalUnit(null)}
                      className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Hủy Bỏ
                    </button>
                    <button
                      type="button"
                      disabled={isActivatingRental}
                      onClick={handleConfirmRentalActivation}
                      className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {isActivatingRental ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Đang kích hoạt hợp đồng &amp; mở app...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[16px]">key</span>
                          <span>Xác Nhận Thuê &amp; Kích Hoạt Mở App</span>
                        </>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                /* Success State */
                <div className="py-2 space-y-5 text-center">
                  <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
                    <span className="material-symbols-outlined text-[32px]">task_alt</span>
                  </div>

                  <div className="space-y-1">
                    <h4 className="font-headline text-lg font-extrabold text-slate-900">
                      Thuê Kho &amp; Kích Hoạt App Thành Công!
                    </h4>
                    <p className="text-xs text-slate-600 max-w-sm mx-auto">
                      Phòng kho <strong>{rentalModalUnit.name} ({rentalModalUnit.id})</strong> đã được cấp quyền sở hữu. 
                      Vị trí tại: <strong>{rentalModalUnit.floorLocation}</strong> — <em>{rentalModalUnit.facilityName}</em> ({rentalModalUnit.facilityAddress}).
                    </p>
                  </div>

                  {/* PIN Display Card */}
                  <div className="p-4 rounded-xl bg-slate-950 text-white space-y-2 max-w-xs mx-auto shadow-md">
                    <span className="font-mono text-[10px] uppercase text-cyan-400 tracking-widest font-semibold block">
                      MÃ PIN MỞ CỬA IOT TỰ QUẢN
                    </span>
                    <div className="flex items-center justify-center gap-3">
                      <span className="font-mono text-2xl font-bold tracking-widest text-white">
                        {activatedPin}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(activatedPin)
                          setCopiedPin(true)
                          setTimeout(() => setCopiedPin(false), 2000)
                        }}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                        title="Sao chép mã PIN"
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          {copiedPin ? 'check' : 'content_copy'}
                        </span>
                      </button>
                    </div>
                    <span className="text-[10px] text-emerald-400 block font-medium">
                      ✓ Đã xác nhận quyền mở app &amp; Portal
                    </span>
                  </div>

                  {/* Navigation CTAs */}
                  <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setRentalModalUnit(null)
                        navigate('/portal/customer')
                      }}
                      className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-neutral-800 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px] text-emerald-400">dashboard</span>
                      <span>Truy Cập Customer Portal Ngay</span>
                      <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRentalModalUnit(null)}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Đóng
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Floating Action Speed-Dial Widget (Scroll Top, Zalo, Hotline, Maps) */}
      <FloatingContactWidget />

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
