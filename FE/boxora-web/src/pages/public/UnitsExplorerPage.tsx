import React, { useState, useMemo, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  StorageUnitType,
  calculateDistanceKm,
} from '../../data/storageUnitsData'
import { checkCustomerPortalAccess } from '../../utils/rentalAccess'
import { FloatingContactWidget } from '../../components/common/FloatingContactWidget'
import { facilityService } from '../../services/facilityService'
import { storageUnitService } from '../../services/storageUnitService'
import { BrandLogo } from '../../components/common/BrandLogo'
import { AccountProfileModal } from '../../components/common/AccountProfileModal'
import { LogoutConfirmModal } from '../../components/common/LogoutConfirmModal'
import { WebSettingsModal } from '../../components/common/WebSettingsModal'
import { UserAvatarDropdown } from '../../components/common/UserAvatarDropdown'
import { useLanguage } from '../../context/LanguageContext'
import { Facility, StorageUnit } from '../../types'
import { BookingCheckoutModal, BookingCheckoutUnit } from '../../components/modals/BookingCheckoutModal'
import { UnitDetailModal } from '../../components/modals/UnitDetailModal'
import { geocodeAddressWithNominatim, getNominatimErrorMessage } from '../../services/nominatimGeocodingService'

interface CustomerCoordinates {
  lat: number
  lng: number
  displayName: string
}

const normalizeSearchText = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[đĐ]/g, 'd')
  .toLocaleLowerCase('vi-VN')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()

const getCardImage = (category: StorageUnitType['category']) => {
  switch (category) {
    case 'mini':
      return 'https://images.unsplash.com/photo-1590402494682-cd3fb53b1f70?auto=format&fit=crop&w=600&q=80'
    case 'special':
      return 'https://images.unsplash.com/photo-1553413077-190dd305871c?auto=format&fit=crop&w=600&q=80'
    case 'business':
      return 'https://images.unsplash.com/photo-1587293852726-70cdb56c2866?auto=format&fit=crop&w=600&q=80'
    case 'personal':
    default:
      return 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80'
  }
}

const getCategoryDisplayName = (category: StorageUnitType['category']) => {
  switch (category) {
    case 'mini':
      return 'Kho cá nhân (Locker)'
    case 'business':
      return 'Kho doanh nghiệp'
    case 'special':
      return 'Kho mát / Điều hòa'
    case 'personal':
    default:
      return 'Kho tiêu chuẩn'
  }
}

export const UnitsExplorerPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { isAuthenticated, user, logout } = useAuth()
  const { t, language, setLanguage } = useLanguage()

  // Modals state
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false)
  const [inspectingUnit, setInspectingUnit] = useState<StorageUnitType | null>(null)
  const [checkoutUnit, setCheckoutUnit] = useState<BookingCheckoutUnit | null>(null)

  // Real Database Data State
  const [dbFacilities, setDbFacilities] = useState<Facility[]>([])
  const [rawUnits, setRawUnits] = useState<StorageUnit[]>([])
  const [loadingUnits, setLoadingUnits] = useState(true)
  const [dataLoadError, setDataLoadError] = useState('')

  // Customer rental access
  const isCustomer = user?.role?.name === 'CUSTOMER'
  const [customerAccess, setCustomerAccess] = useState(() => checkCustomerPortalAccess(user))
  const canAccessPortal = !isCustomer || customerAccess.hasAccess

  // Customer Location State
  const [customerLocation, setCustomerLocation] = useState<CustomerCoordinates | null>(null)
  const [manualAddress, setManualAddress] = useState('')
  const [manualLocationResolved, setManualLocationResolved] = useState(false)
  const [isSearchingAddress, setIsSearchingAddress] = useState(false)
  const [isLocatingGPS, setIsLocatingGPS] = useState(false)
  const [gpsNotice, setGpsNotice] = useState<string | null>(null)

  // Grouped Filter States
  // 1. Vị trí: customerLocation & manualAddress
  // 2. Cơ sở: selectedFacilityFilter
  const [selectedFacilityFilter, setSelectedFacilityFilter] = useState<string>('all')
  // 3. Loại kho: categoryFilter ('all' | 'personal' | 'standard' | 'business' | 'climate')
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'personal' | 'business' | 'special'>('all')
  // 4. Diện tích: sizeFilter
  const [sizeFilter, setSizeFilter] = useState<'all' | 'under3' | '3to8' | '8to15' | '15plus'>('all')
  // 5. Giá thuê: priceFilter
  const [priceFilter, setPriceFilter] = useState<'all' | 'under1m5' | '1m5to3m' | '3mto5m' | 'above5m'>('all')
  // 6. Sắp xếp: sortOption
  const [sortOption, setSortOption] = useState<'price_asc' | 'price_desc' | 'distance' | 'area_desc'>('price_asc')
  // 7. Tình trạng kho: statusFilter
  const [statusFilter, setStatusFilter] = useState<'all' | 'available'>('all')
  // 8. Từ khóa tìm kiếm: searchQuery
  const [searchQuery, setSearchQuery] = useState('')
  // View mode
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  // Fetch real data from backend
  useEffect(() => {
    const fetchRealData = async () => {
      setLoadingUnits(true)
      const [facResult, unitResult] = await Promise.allSettled([
        facilityService.getFacilities({ size: 100 }),
        storageUnitService.getUnits(),
      ])

      const facList =
        facResult.status === 'fulfilled' && Array.isArray(facResult.value?.content)
          ? facResult.value.content
          : []
      const unitList =
        unitResult.status === 'fulfilled' && Array.isArray(unitResult.value)
          ? unitResult.value
          : []

      setDbFacilities(facList)
      setRawUnits(unitList)

      if (facResult.status === 'rejected') {
        console.error('Failed to load facilities:', facResult.reason)
      }
      if (unitResult.status === 'rejected') {
        console.error('Failed to load storage units:', unitResult.reason)
        setDataLoadError('Không thể tải danh sách kho từ máy chủ. Vui lòng thử tải lại trang.')
      } else {
        setDataLoadError('')
      }
      setLoadingUnits(false)
    }
    void fetchRealData()
  }, [])

  // Process facilities
  const effectiveFacilities = useMemo(() => {
    if (dbFacilities.length > 0) {
      return dbFacilities
        .filter((f) => !f.status || f.status === 'ACTIVE')
        .map((f) => ({
          id: f.id,
          name: f.name,
          shortName: f.name.replace('StoreHub ', 'Boxora '),
          district: f.city || 'TP.HCM',
          address: f.address,
          coords:
            f.latitude == null || f.longitude == null
              ? null
              : { lat: Number(f.latitude), lng: Number(f.longitude) },
          contactPhone: f.contactPhone,
        }))
    }

    const inferred = new Map<
      string,
      {
        id: string
        name: string
        shortName: string
        district: string
        address: string
        coords: { lat: number; lng: number } | null
        contactPhone: string
      }
    >()
    rawUnits.forEach((unit) => {
      if (!unit.facilityId || inferred.has(unit.facilityId)) return
      const name = unit.facilityName || ''
      inferred.set(unit.facilityId, {
        id: unit.facilityId,
        name,
        shortName: name,
        district: 'TP.HCM',
        address: '',
        coords: null,
        contactPhone: '',
      })
    })
    return [...inferred.values()]
  }, [dbFacilities, rawUnits])

  // Process storage units
  const effectiveUnits: StorageUnitType[] = useMemo(() => {
    const facMap = new Map(effectiveFacilities.map((facility) => [facility.id, facility]))
    const visibleUnits =
      dbFacilities.length > 0
        ? rawUnits.filter((unit) => facMap.has(unit.facilityId))
        : rawUnits

    return visibleUnits.map((unit) => {
      const facility = facMap.get(unit.facilityId)
      const area = unit.areaSqMeters == null ? undefined : Number(unit.areaSqMeters)
      const typeName = unit.unitTypeName || ''
      const normalizedType = normalizeSearchText(typeName)

      // Map to 4 clear categories
      let category: StorageUnitType['category'] = 'personal'
      if (
        normalizedType.includes('climate') ||
        normalizedType.includes('cold') ||
        normalizedType.includes('lanh')
      ) {
        category = 'special'
      } else if (
        (area != null && area <= 3) ||
        normalizedType.includes('mini') ||
        normalizedType.includes('locker')
      ) {
        category = 'mini'
      } else if (
        (area != null && area > 8) ||
        normalizedType.includes('business') ||
        normalizedType.includes('commercial')
      ) {
        category = 'business'
      } else {
        category = 'personal'
      }

      const isAvailable = unit.status === 'AVAILABLE'

      const statusDisplayMap: Record<string, StorageUnitType['status']> = {
        AVAILABLE: 'Sẵn sàng',
        OCCUPIED: 'Đang thuê',
        UNDER_MAINTENANCE: 'Bảo trì',
        MAINTENANCE: 'Bảo trì',
        RESERVED: 'Chờ duyệt',
      }

      const cleanFloor = unit.floorLevel
        ? unit.floorLevel.replace(/^Floor\s*/i, 'Tầng ')
        : 'Tầng 1'

      const unitCode = unit.unitCode || 'N/A'

      return {
        id: unit.id, // Internal UUID kept for keys and backend booking
        backendId: unit.id,
        unitCode, // User-facing clean code (e.g. TD-A101)
        name: `Kho ${unitCode}`,
        unitTypeName: typeName || undefined,
        category,
        areaSqMeters: area,
        monthlyPrice: `${Number(unit.pricePerMonth).toLocaleString('vi-VN')} ₫`,
        monthlyPriceNumeric: Number(unit.pricePerMonth),
        depositAmountNumeric:
          unit.depositAmount == null ? undefined : Number(unit.depositAmount),
        status: statusDisplayMap[unit.status] || 'Bảo trì',
        isAvailable,
        facilityId: unit.facilityId,
        facilityName: unit.facilityName || facility?.name || '',
        facilityAddress: facility?.address || '',
        floorLocation: `${cleanFloor}`,
        coords: facility?.coords || null,
        imageUrl: getCardImage(category),
      }
    })
  }, [rawUnits, effectiveFacilities, dbFacilities])

  // Check URL query for default unit
  useEffect(() => {
    const unitParam = searchParams.get('unit')
    if (unitParam) {
      const match = effectiveUnits.find(
        (u) => u.id === unitParam || u.unitCode === unitParam || u.name.includes(unitParam)
      )
      if (match) setInspectingUnit(match)
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

  // GPS Location handler
  const handleGetGpsLocation = () => {
    if (!navigator.geolocation) {
      setGpsNotice('Trình duyệt không hỗ trợ định vị.')
      return
    }
    setIsLocatingGPS(true)
    setGpsNotice(null)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const currentLocation: CustomerCoordinates = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          displayName: 'Vị trí hiện tại của bạn',
        }
        setCustomerLocation(currentLocation)
        setManualAddress('')
        setManualLocationResolved(true)
        setSortOption('distance')
        setIsLocatingGPS(false)
        setGpsNotice('Đã cập nhật vị trí GPS của bạn.')
      },
      () => {
        setIsLocatingGPS(false)
        setGpsNotice('Không thể lấy vị trí. Hãy cho phép trình duyệt truy cập vị trí rồi thử lại.')
      },
      { timeout: 10000, enableHighAccuracy: true }
    )
  }

  // Address search via Nominatim
  const handleSearchAddress = async () => {
    if (!manualAddress.trim()) {
      setGpsNotice('Nhập địa chỉ để tìm kiếm vị trí gần nhất.')
      return
    }

    setIsSearchingAddress(true)
    setGpsNotice(null)
    try {
      const result = await geocodeAddressWithNominatim(manualAddress)
      setCustomerLocation(result)
      setManualAddress(result.displayName)
      setManualLocationResolved(true)
      setSortOption('distance')
      setGpsNotice(`Đã xác định vị trí: ${result.displayName}`)
    } catch (error) {
      setCustomerLocation(null)
      setManualLocationResolved(false)
      setGpsNotice(getNominatimErrorMessage(error))
    } finally {
      setIsSearchingAddress(false)
    }
  }

  // Calculate dynamic proximity only when valid coordinates exist
  const unitsWithProximity = useMemo(() => {
    return effectiveUnits.map((unit) => {
      if (!customerLocation || !unit.coords) return unit
      const dist = calculateDistanceKm(
        customerLocation.lat,
        customerLocation.lng,
        unit.coords.lat,
        unit.coords.lng
      )
      return { ...unit, distanceKm: dist }
    })
  }, [effectiveUnits, customerLocation])

  // Nearest facility badge calculation
  const nearestFacility = useMemo(() => {
    if (!customerLocation || !manualLocationResolved) return null
    return (
      effectiveFacilities
        .filter((facility) => facility.coords != null)
        .map((facility) => ({
          ...facility,
          coords: facility.coords!,
          distanceKm: calculateDistanceKm(
            customerLocation.lat,
            customerLocation.lng,
            facility.coords!.lat,
            facility.coords!.lng
          ),
        }))
        .sort((a, b) => a.distanceKm - b.distanceKm)[0] || null
    )
  }, [customerLocation, manualLocationResolved, effectiveFacilities])

  // Counts for status tabs
  const totalCount = unitsWithProximity.length
  const availableCount = unitsWithProximity.filter((u) => u.isAvailable).length

  // Filter & Sort logic
  const filteredUnits = useMemo(() => {
    let list = unitsWithProximity.filter((unit) => {
      // 1. Cơ sở
      const matchFacility =
        selectedFacilityFilter === 'all' || unit.facilityId === selectedFacilityFilter

      // 2. Loại kho
      const matchCategory =
        categoryFilter === 'all' || unit.category === categoryFilter

      // 3. Diện tích
      const area = unit.areaSqMeters
      const matchSize =
        sizeFilter === 'all' ||
        (area != null && sizeFilter === 'under3' && area < 3) ||
        (area != null && sizeFilter === '3to8' && area >= 3 && area <= 8) ||
        (area != null && sizeFilter === '8to15' && area > 8 && area <= 15) ||
        (area != null && sizeFilter === '15plus' && area > 15)

      // 4. Giá thuê
      const price = unit.monthlyPriceNumeric
      const matchPrice =
        priceFilter === 'all' ||
        (priceFilter === 'under1m5' && price < 1500000) ||
        (priceFilter === '1m5to3m' && price >= 1500000 && price <= 3000000) ||
        (priceFilter === '3mto5m' && price > 3000000 && price <= 5000000) ||
        (priceFilter === 'above5m' && price > 5000000)

      // 5. Trạng thái
      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'available' && unit.isAvailable)

      // 6. Từ khóa
      const normalizedQuery = normalizeSearchText(searchQuery)
      const matchQuery =
        !normalizedQuery ||
        [
          unit.unitCode,
          unit.name,
          unit.unitTypeName || '',
          unit.facilityName,
          unit.facilityAddress,
        ].some((value) => normalizeSearchText(value).includes(normalizedQuery))

      return (
        matchFacility &&
        matchCategory &&
        matchSize &&
        matchPrice &&
        matchStatus &&
        matchQuery
      )
    })

    // Sắp xếp
    list = [...list].sort((a, b) => {
      if (sortOption === 'distance') {
        return (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY)
      }
      if (sortOption === 'price_asc') {
        return a.monthlyPriceNumeric - b.monthlyPriceNumeric
      }
      if (sortOption === 'price_desc') {
        return b.monthlyPriceNumeric - a.monthlyPriceNumeric
      }
      if (sortOption === 'area_desc') {
        return (b.areaSqMeters ?? 0) - (a.areaSqMeters ?? 0)
      }
      return 0
    })

    return list
  }, [
    unitsWithProximity,
    selectedFacilityFilter,
    categoryFilter,
    sizeFilter,
    priceFilter,
    statusFilter,
    searchQuery,
    sortOption,
  ])

  // Rent click handler
  const handleRentUnitClick = (unit: StorageUnitType) => {
    if (!unit.isAvailable || !unit.backendId) return
    if (!isAuthenticated) {
      navigate(`/login?redirect=${encodeURIComponent(`/units?unit=${unit.backendId}`)}`)
      return
    }
    setCheckoutUnit({
      backendId: unit.backendId,
      code: unit.unitCode,
      name: unit.name,
      facilityName: unit.facilityName,
      monthlyPrice: unit.monthlyPriceNumeric,
      depositAmount: unit.depositAmountNumeric ?? unit.monthlyPriceNumeric,
      size: unit.areaSqMeters == null ? 'Chưa cập nhật' : `${unit.areaSqMeters} m²`,
      address: unit.facilityAddress,
    })
  }

  // Reset all filters
  const handleResetFilters = () => {
    setSelectedFacilityFilter('all')
    setCategoryFilter('all')
    setSizeFilter('all')
    setPriceFilter('all')
    setStatusFilter('all')
    setSearchQuery('')
    setSortOption('price_asc')
    setCustomerLocation(null)
    setManualAddress('')
    setManualLocationResolved(false)
    setGpsNotice(null)
  }

  const renderStatusBadge = (unit: StorageUnitType) => {
    if (unit.isAvailable) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Còn trống
        </span>
      )
    }
    if (unit.status === 'Đang thuê') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
          Đang thuê
        </span>
      )
    }
    if (unit.status === 'Chờ duyệt') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          Đang giữ chỗ
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        Bảo trì
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--surface-canvas,#f8fafc)] text-slate-900 font-sans selection:bg-blue-600 selection:text-white pb-20">
      {/* ============================================================ */}
      {/* 1. TOP HEADER & NAVIGATION                                   */}
      {/* ============================================================ */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          {/* Logo Boxora */}
          <div className="flex items-center gap-4 sm:gap-6">
            <BrandLogo subtitle="STORAGE EXPLORER" />

            <div className="hidden sm:flex items-center gap-2 border-l border-slate-200 pl-4">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono">
                Tìm Kiếm &amp; Đặt Thuê Kho
              </span>
            </div>
          </div>

          {/* Navigation Links, Language Toggle & User Auth */}
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">home</span>
              <span>{t('Trang Giới Thiệu')}</span>
            </Link>

            <Link
              to="/units"
              className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-blue-600 bg-blue-50 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">search</span>
              <span>{t('Khám Phá Kho')}</span>
            </Link>

            {/* Language Selector: Clear VI | EN with Globe icon */}
            <div
              role="group"
              aria-label={t('Chọn ngôn ngữ', 'Select language')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold shadow-2xs"
            >
              <span className="material-symbols-outlined text-[15px] text-slate-500">language</span>
              <button
                type="button"
                onClick={() => setLanguage('vi')}
                className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                  language === 'vi'
                    ? 'bg-white text-blue-600 shadow-xs font-extrabold'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Tiếng Việt"
              >
                VI
              </button>
              <span className="text-slate-300 font-normal">|</span>
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                  language === 'en'
                    ? 'bg-white text-blue-600 shadow-xs font-extrabold'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title="English"
              >
                EN
              </button>
            </div>

            {/* Auth Actions: User Dropdown or Login / Register */}
            {isAuthenticated ? (
              <UserAvatarDropdown
                user={user}
                role={user?.role?.name || 'CUSTOMER'}
                onOpenProfile={() => setIsProfileModalOpen(true)}
                onOpenSettings={() => setIsSettingsModalOpen(true)}
                onOpenLogoutConfirm={() => setIsLogoutConfirmOpen(true)}
                extraActions={
                  canAccessPortal ? (
                    <div className="pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => navigate(isCustomer ? '/portal/customer' : '/portal')}
                        className="w-full py-2.5 px-3.5 rounded-xl bg-slate-900 text-white font-semibold text-xs flex items-center justify-between hover:bg-neutral-800 transition-all shadow-xs cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[18px] text-emerald-400">
                            dashboard
                          </span>
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
                  className="px-3 py-2 text-xs font-semibold text-slate-700 hover:text-blue-600 transition-colors"
                >
                  {t('Đăng Nhập')}
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
                >
                  <span>{t('Tạo Tài Khoản')}</span>
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
      <section className="bg-gradient-to-b from-white to-slate-50 border-b border-slate-200 py-10 sm:py-12 text-left">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
          <div className="max-w-3xl space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
              <span>Hệ thống kho tự quản thông minh Boxora</span>
            </div>
            <h1 className="font-headline text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Không Gian Của Bạn, Theo Cách Linh Hoạt Hơn
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-2xl">
              Khám phá kho lưu trữ theo vị trí, cơ sở, loại kho và diện tích phù hợp. So sánh khoảng cách thực tế, kiểm tra tình trạng buồng kho sẵn sàng và đặt giữ chỗ trực tuyến dễ dàng.
            </p>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 3. SEARCH & 4-GROUP FILTER CONTROL CENTER                    */}
      {/* ============================================================ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-5">
        {/* Main 4-Group Filter Card */}
        <div className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200 shadow-sm text-left space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">tune</span>
              </div>
              <div>
                <h2 className="font-headline text-base font-bold text-slate-900">
                  Bộ Lọc Tìm Kiếm Kho Lưu Trữ
                </h2>
                <p className="text-[11px] text-slate-500">
                  Lọc theo vị trí của bạn, cơ sở chi nhánh, loại phân hạng và diện tích buồng kho.
                </p>
              </div>
            </div>

            {/* Nearest Facility Highlight Badge (Only shown when distance is computed) */}
            {nearestFacility && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold self-start sm:self-auto">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                <span>
                  Gần bạn nhất: <strong>{nearestFacility.name}</strong> (khoảng {nearestFacility.distanceKm} km)
                </span>
              </div>
            )}
          </div>

          {/* 4 CLEAR GROUPS GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
            {/* NHÓM 1: VỊ TRÍ TÌM KIẾM */}
            <div className="space-y-2">
              <label htmlFor="customer-address" className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[17px] text-cyan-600">near_me</span>
                <span>1. Vị trí của bạn</span>
              </label>

              <div className="flex items-center gap-1.5">
                <input
                  id="customer-address"
                  type="text"
                  value={manualAddress}
                  onChange={(e) => {
                    setManualAddress(e.target.value)
                    setCustomerLocation(null)
                    setManualLocationResolved(false)
                    setGpsNotice(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleSearchAddress()
                  }}
                  placeholder="Nhập địa chỉ hoặc khu vực..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500 shadow-2xs"
                />
                <button
                  type="button"
                  onClick={handleGetGpsLocation}
                  disabled={isLocatingGPS}
                  title="Dùng vị trí GPS hiện tại"
                  className="p-2 rounded-xl bg-slate-900 hover:bg-neutral-800 text-white shrink-0 disabled:opacity-60 cursor-pointer shadow-2xs"
                >
                  {isLocatingGPS ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin block" />
                  ) : (
                    <span className="material-symbols-outlined text-[16px] text-cyan-400 block">my_location</span>
                  )}
                </button>
              </div>

              {customerLocation ? (
                <p className="text-[11px] text-cyan-700 font-medium truncate" title={customerLocation.displayName}>
                  Đang tìm quanh: {customerLocation.displayName}
                </p>
              ) : (
                <p className="text-[10px] text-slate-400">
                  Nhập địa chỉ hoặc bật GPS để xem khoảng cách km.
                </p>
              )}
            </div>

            {/* NHÓM 2: CƠ SỞ KHO */}
            <div className="space-y-2">
              <label htmlFor="facility-filter" className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[17px] text-blue-600">domain</span>
                <span>2. Cơ sở Boxora</span>
              </label>

              <select
                id="facility-filter"
                value={selectedFacilityFilter}
                onChange={(e) => setSelectedFacilityFilter(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 shadow-2xs"
              >
                <option value="all">Tất cả cơ sở ({effectiveFacilities.length} chi nhánh)</option>
                {effectiveFacilities.map((fac) => {
                  const dist =
                    customerLocation && fac.coords
                      ? calculateDistanceKm(
                          customerLocation.lat,
                          customerLocation.lng,
                          fac.coords.lat,
                          fac.coords.lng
                        )
                      : null
                  return (
                    <option key={fac.id} value={fac.id}>
                      {fac.name}
                      {dist !== null ? ` (khoảng ${dist} km)` : ''}
                    </option>
                  )
                })}
              </select>

              <p className="text-[10px] text-slate-500 truncate">
                {selectedFacilityFilter === 'all'
                  ? `Hệ thống có ${effectiveFacilities.length} cơ sở tại TP.HCM`
                  : effectiveFacilities.find((f) => f.id === selectedFacilityFilter)?.address || ''}
              </p>
            </div>

            {/* NHÓM 3: LOẠI KHO */}
            <div className="space-y-2">
              <label htmlFor="category-filter" className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[17px] text-indigo-600">category</span>
                <span>3. Loại kho lưu trữ</span>
              </label>

              <select
                id="category-filter"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as typeof categoryFilter)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 shadow-2xs"
              >
                <option value="all">Tất cả loại kho</option>
                <option value="mini">Kho cá nhân (Mini Locker 1–3 m²)</option>
                <option value="personal">Kho tiêu chuẩn (Gia đình 3–8 m²)</option>
                <option value="business">Kho doanh nghiệp (Lớn 8–20 m²)</option>
                <option value="special">Kho mát / Kiểm soát nhiệt độ</option>
              </select>

              <p className="text-[10px] text-slate-500">
                Phân loại theo quy mô lưu trữ và điều kiện nhiệt độ.
              </p>
            </div>

            {/* NHÓM 4: DIỆN TÍCH */}
            <div className="space-y-2">
              <label htmlFor="size-filter" className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[17px] text-emerald-600">aspect_ratio</span>
                <span>4. Diện tích buồng kho</span>
              </label>

              <select
                id="size-filter"
                value={sizeFilter}
                onChange={(e) => setSizeFilter(e.target.value as typeof sizeFilter)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 shadow-2xs"
              >
                <option value="all">Mọi diện tích</option>
                <option value="under3">Dưới 3 m² (Nhỏ gọn)</option>
                <option value="3to8">3 – 8 m² (Vừa - Đồ gia đình)</option>
                <option value="8to15">8 – 15 m² (Lớn - Nhiều đồ)</option>
                <option value="15plus">Trên 15 m² (Doanh nghiệp &amp; pallet)</option>
              </select>

              <p className="text-[10px] text-slate-500">
                Lựa chọn diện tích sàn phù hợp thể tích đồ đạc.
              </p>
            </div>
          </div>

          {gpsNotice && (
            <p className="text-xs text-cyan-800 bg-cyan-50 border border-cyan-100 p-2.5 rounded-xl font-medium">
              {gpsNotice}
            </p>
          )}
        </div>

        {/* Secondary Bar: Status Tabs, Price Filter, Keyword Search & Sorting */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4 text-left">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl shrink-0">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tất cả kho ({totalCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('available')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                statusFilter === 'available'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-emerald-700 hover:text-emerald-800'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${statusFilter === 'available' ? 'bg-white' : 'bg-emerald-500'}`} />
              Còn trống ({availableCount})
            </button>
          </div>

          {/* Secondary Controls: Price, Search, Sort & View Mode */}
          <div className="flex flex-wrap items-center gap-2.5 flex-1 lg:justify-end">
            {/* Price Filter */}
            <select
              value={priceFilter}
              onChange={(e) => setPriceFilter(e.target.value as typeof priceFilter)}
              aria-label="Khoảng giá thuê"
              className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-2xs"
            >
              <option value="all">Mọi mức giá</option>
              <option value="under1m5">Dưới 1.5 triệu / tháng</option>
              <option value="1m5to3m">1.5 – 3 triệu / tháng</option>
              <option value="3mto5m">3 – 5 triệu / tháng</option>
              <option value="above5m">Trên 5 triệu / tháng</option>
            </select>

            {/* Sort Dropdown */}
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as typeof sortOption)}
              aria-label="Sắp xếp kết quả"
              className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-2xs"
            >
              <option value="price_asc">Giá: Thấp đến cao</option>
              <option value="price_desc">Giá: Cao đến thấp</option>
              <option value="distance" disabled={!customerLocation}>
                {customerLocation ? 'Khoảng cách: Gần nhất' : 'Gần nhất (cần bật vị trí)'}
              </option>
              <option value="area_desc">Diện tích: Lớn đến nhỏ</option>
            </select>

            {/* Keyword Search */}
            <div className="relative min-w-[180px] sm:w-56">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-slate-400">
                search
              </span>
              <input
                type="text"
                placeholder="Tìm mã kho, cơ sở..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-7 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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

            {/* View Mode Toggle */}
            <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'grid' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-400 hover:text-slate-600'
                }`}
                title="Dạng lưới"
              >
                <span className="material-symbols-outlined text-[18px]">grid_view</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'list' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-400 hover:text-slate-600'
                }`}
                title="Dạng danh sách"
              >
                <span className="material-symbols-outlined text-[18px]">view_list</span>
              </button>
            </div>
          </div>
        </div>

        {/* Results Header Count & Clear Filter */}
        <div className="flex items-center justify-between text-xs text-slate-500 px-1">
          <div>
            Hiển thị <strong>{filteredUnits.length}</strong> buồng kho phù hợp
          </div>

          {(selectedFacilityFilter !== 'all' ||
            categoryFilter !== 'all' ||
            sizeFilter !== 'all' ||
            priceFilter !== 'all' ||
            statusFilter !== 'all' ||
            searchQuery ||
            customerLocation) && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[14px]">restart_alt</span>
              <span>Đặt lại bộ lọc</span>
            </button>
          )}
        </div>

        {/* ============================================================ */}
        {/* 4. STORAGE UNITS INVENTORY (GRID OR LIST)                    */}
        {/* ============================================================ */}
        {loadingUnits ? (
          <div className="py-20 text-center bg-white rounded-3xl border border-slate-200 text-sm text-slate-500 space-y-3">
            <span className="w-8 h-8 border-3 border-blue-600/30 border-t-blue-600 rounded-full animate-spin inline-block" />
            <p className="font-semibold text-slate-700">Đang tải danh sách kho lưu trữ Boxora...</p>
          </div>
        ) : dataLoadError ? (
          <div role="alert" className="py-16 text-center bg-white rounded-3xl border border-rose-200 text-sm text-rose-700 space-y-2">
            <p className="font-bold">{dataLoadError}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold"
            >
              Tải lại trang
            </button>
          </div>
        ) : filteredUnits.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-3xl border border-slate-200 shadow-2xs space-y-3">
            <span className="material-symbols-outlined text-5xl text-slate-300">inventory_2</span>
            <h3 className="font-headline text-base font-bold text-slate-800">
              Không tìm thấy buồng kho phù hợp
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Hãy thử chọn lại cơ sở, đổi phân loại kho, thay đổi khoảng giá hoặc mở rộng diện tích tìm kiếm.
            </p>
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-neutral-800 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              Xem lại toàn bộ kho
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          /* ============================================================ */
          /* GRID VIEW                                                    */
          /* ============================================================ */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-left items-stretch">
            {filteredUnits.map((unit) => {
              return (
                <div
                  key={unit.id}
                  className="rounded-3xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-lg transition-all duration-200 flex flex-col justify-between overflow-hidden group"
                >
                  {/* Card Thumbnail Image with Badges */}
                  <div className="relative h-44 w-full bg-slate-100 overflow-hidden">
                    <img
                      src={unit.imageUrl || getCardImage(unit.category)}
                      alt={`Kho ${unit.unitCode}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = '/smart-warehouse-clean.jpg'
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent" />

                    {/* Status Badge floating on top-left */}
                    <div className="absolute top-3 left-3">
                      {renderStatusBadge(unit)}
                    </div>

                    {/* Unit Code on image bottom-left */}
                    <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-2">
                      <div>
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-white/90 text-slate-900 shadow-2xs backdrop-blur-xs">
                          {unit.unitCode}
                        </span>
                        <h3 className="font-headline text-lg font-extrabold text-white mt-1 drop-shadow-sm">
                          Kho {unit.unitCode}
                        </h3>
                      </div>

                      {unit.distanceKm != null && (
                        <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-cyan-600/90 text-white backdrop-blur-xs flex items-center gap-1 shadow-2xs">
                          <span className="material-symbols-outlined text-[13px]">near_me</span>
                          ~{unit.distanceKm} km
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Body Information */}
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      {/* Facility & Location snippet */}
                      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-1.5 text-xs">
                        <div className="flex items-center gap-1.5 font-bold text-slate-800">
                          <span className="material-symbols-outlined text-[16px] text-blue-600 shrink-0">
                            domain
                          </span>
                          <span className="truncate">{unit.facilityName} · {unit.floorLocation}</span>
                        </div>

                        <div className="text-[11px] text-slate-500 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px] text-slate-400 shrink-0">
                            location_on
                          </span>
                          <span className="truncate" title={unit.facilityAddress}>
                            {unit.facilityAddress}
                          </span>
                        </div>
                      </div>

                      {/* Specs Row: Area & Category */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                          <span className="text-[10px] text-slate-400 font-medium block">Diện tích</span>
                          <span className="font-headline font-bold text-slate-800">
                            {unit.areaSqMeters != null ? `${unit.areaSqMeters} m²` : 'Tiêu chuẩn'}
                          </span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                          <span className="text-[10px] text-slate-400 font-medium block">Phân hạng</span>
                          <span className="font-headline font-semibold text-slate-800 truncate block" title={unit.unitTypeName}>
                            {unit.unitTypeName || getCategoryDisplayName(unit.category)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Price and Action Buttons */}
                    <div className="pt-3 border-t border-slate-100 space-y-3">
                      <div className="flex items-baseline justify-between">
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                            Giá thuê niêm yết
                          </span>
                          <div className="flex items-baseline gap-1">
                            <span className="font-mono text-xl font-bold text-blue-600 tabular-nums">
                              {unit.monthlyPriceNumeric.toLocaleString('vi-VN')} ₫
                            </span>
                            <span className="text-xs text-slate-500 font-medium"> / tháng</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setInspectingUnit(unit)}
                          className="text-xs font-bold text-slate-700 hover:text-blue-600 transition-colors flex items-center gap-0.5 cursor-pointer"
                        >
                          <span>Xem chi tiết</span>
                          <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                        </button>
                      </div>

                      {/* Primary CTA */}
                      {unit.isAvailable ? (
                        <button
                          type="button"
                          onClick={() => handleRentUnitClick(unit)}
                          className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <span>Đặt thuê ngay</span>
                          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="w-full py-2.5 px-4 rounded-xl bg-slate-100 text-slate-400 text-xs font-semibold cursor-not-allowed flex items-center justify-center gap-1"
                        >
                          <span>{unit.status === 'Đang thuê' ? 'Đã có người thuê' : 'Tạm không khả dụng'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* ============================================================ */
          /* LIST VIEW                                                    */
          /* ============================================================ */
          <div className="space-y-4">
            {filteredUnits.map((unit) => {
              return (
                <div
                  key={unit.id}
                  className="p-5 rounded-3xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-md transition-all flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 text-left"
                >
                  {/* Left Column: Image thumbnail + Unit info */}
                  <div className="flex items-center gap-4 min-w-[280px]">
                    <div className="w-20 h-20 rounded-2xl overflow-hidden bg-slate-100 shrink-0 relative">
                      <img
                        src={unit.imageUrl || getCardImage(unit.category)}
                        alt={`Kho ${unit.unitCode}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = '/smart-warehouse-clean.jpg'
                        }}
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                          {unit.unitCode}
                        </span>
                        {renderStatusBadge(unit)}
                      </div>
                      <h3 className="font-headline text-base font-bold text-slate-900">
                        Kho {unit.unitCode}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {[
                          unit.areaSqMeters != null ? `${unit.areaSqMeters} m²` : null,
                          unit.unitTypeName || getCategoryDisplayName(unit.category),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                  </div>

                  {/* Middle Column: Facility & Address */}
                  <div className="space-y-1.5 flex-1 max-w-xl text-xs">
                    <div className="flex items-center gap-2">
                      <strong className="text-slate-800">{unit.facilityName} · {unit.floorLocation}</strong>
                      {unit.distanceKm != null && (
                        <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-cyan-100 text-cyan-900 border border-cyan-200 flex items-center gap-1 shrink-0">
                          <span className="material-symbols-outlined text-[13px] text-cyan-700">near_me</span>
                          Khoảng {unit.distanceKm} km
                        </span>
                      )}
                    </div>
                    <p className="text-slate-500 text-[11px] flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px] text-slate-400">location_on</span>
                      <span>{unit.facilityAddress}</span>
                    </p>
                  </div>

                  {/* Right Column: Price & Actions */}
                  <div className="flex items-center justify-between lg:justify-end gap-5 w-full lg:w-auto pt-4 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                    <div className="text-left lg:text-right">
                      <span className="font-mono text-xl font-bold text-blue-600 tabular-nums block">
                        {unit.monthlyPriceNumeric.toLocaleString('vi-VN')} ₫
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium">/ tháng</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setInspectingUnit(unit)}
                        className="px-3.5 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                      >
                        Chi tiết
                      </button>

                      {unit.isAvailable ? (
                        <button
                          type="button"
                          onClick={() => handleRentUnitClick(unit)}
                          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>Đặt thuê</span>
                          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-400 text-xs font-semibold cursor-not-allowed"
                        >
                          {unit.status === 'Đang thuê' ? 'Hết chỗ' : 'Không khả dụng'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ============================================================ */}
      {/* 5. MODALS                                                    */}
      {/* ============================================================ */}
      {/* Unit Detail Modal (Specifications & Rental Conditions) */}
      <UnitDetailModal
        unit={inspectingUnit}
        isOpen={Boolean(inspectingUnit)}
        onClose={() => setInspectingUnit(null)}
        onRent={(unit) => handleRentUnitClick(unit)}
      />

      {/* Booking Checkout Modal (Rental Duration, Quote, Auth, & Payment) */}
      {checkoutUnit && user && (
        <BookingCheckoutModal
          unit={checkoutUnit}
          user={user}
          onClose={() => setCheckoutUnit(null)}
        />
      )}

      {/* Floating Action Speed-Dial Widget */}
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
export default UnitsExplorerPage
