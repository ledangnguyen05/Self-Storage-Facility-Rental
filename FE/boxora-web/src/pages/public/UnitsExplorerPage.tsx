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
import { QuickThemeLanguageToggle } from '../../components/common/QuickThemeLanguageToggle'
import { useLanguage } from '../../context/LanguageContext'
import { Facility, StorageUnit } from '../../types'
import { BookingCheckoutModal, BookingCheckoutUnit } from '../../components/modals/BookingCheckoutModal'
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
  const [unitTypeFilter, setUnitTypeFilter] = useState('all')
  const [sizeFilter, setSizeFilter] = useState<'all' | 'under3' | '3to8' | '8to15' | '15plus'>('all')
  const [sortByDistance, setSortByDistance] = useState<boolean>(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  // Customer Location State
  const [customerLocation, setCustomerLocation] = useState<CustomerCoordinates | null>(null)
  const [manualAddress, setManualAddress] = useState('')
  const [manualLocationResolved, setManualLocationResolved] = useState(false)
  const [isSearchingAddress, setIsSearchingAddress] = useState(false)
  const [isLocatingGPS, setIsLocatingGPS] = useState<boolean>(false)
  const [gpsNotice, setGpsNotice] = useState<string | null>(null)

  // Selected Unit & Modal State
  const [selectedUnit, setSelectedUnit] = useState<StorageUnitType | null>(null)
  const [checkoutUnit, setCheckoutUnit] = useState<BookingCheckoutUnit | null>(null)
  const [dataLoadError, setDataLoadError] = useState('')
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false)

  // Fetch real data from backend database
  useEffect(() => {
    const fetchRealData = async () => {
      setLoadingUnits(true);
      const [facResult, unitResult] = await Promise.allSettled([
        facilityService.getFacilities({ size: 100 }),
        storageUnitService.getUnits()
      ]);

      const facList = facResult.status === 'fulfilled' && Array.isArray(facResult.value?.content)
        ? facResult.value.content
        : [];
      const unitList = unitResult.status === 'fulfilled' && Array.isArray(unitResult.value)
        ? unitResult.value
        : [];
      setDbFacilities(facList);
      setRawUnits(unitList);

      if (facResult.status === 'rejected') {
        console.error('Failed to load facilities in UnitsExplorerPage:', facResult.reason);
      }
      if (unitResult.status === 'rejected') {
        console.error('Failed to load storage units in UnitsExplorerPage:', unitResult.reason);
        setDataLoadError('Không thể tải danh sách kho từ máy chủ. Vui lòng thử tải lại trang.');
      } else {
        setDataLoadError('');
      }
      setLoadingUnits(false);
    };
    fetchRealData()
  }, [])

  const effectiveFacilities = useMemo(() => {
    if (dbFacilities.length > 0) {
      return dbFacilities
        .filter(f => !f.status || f.status === 'ACTIVE')
        .map(f => ({
        id: f.id,
        name: f.name,
        shortName: f.name.replace('StoreHub ', 'Boxora '),
        district: f.city || 'TP.HCM',
        address: f.address,
        coords: f.latitude == null || f.longitude == null
          ? null
          : { lat: Number(f.latitude), lng: Number(f.longitude) },
        contactPhone: f.contactPhone
        }))
    }

    const inferred = new Map<string, { id: string; name: string; shortName: string; district: string; address: string; coords: { lat: number; lng: number } | null; contactPhone: string }>()
    rawUnits.forEach(unit => {
      if (!unit.facilityId || inferred.has(unit.facilityId)) return
      const name = unit.facilityName || ''
      inferred.set(unit.facilityId, {
        id: unit.facilityId,
        name,
        shortName: name,
        district: 'TP.HCM',
        address: '',
        coords: null,
        contactPhone: ''
      })
    })
    return [...inferred.values()]
  }, [dbFacilities, rawUnits])

  const effectiveUnits: StorageUnitType[] = useMemo(() => {
    const facMap = new Map(effectiveFacilities.map(facility => [facility.id, facility]));
    const visibleUnits = dbFacilities.length > 0
      ? rawUnits.filter(unit => facMap.has(unit.facilityId))
      : rawUnits;

    return visibleUnits.map(unit => {
      const facility = facMap.get(unit.facilityId);
      const area = unit.areaSqMeters == null ? undefined : Number(unit.areaSqMeters);
      const typeName = unit.unitTypeName || '';
      const normalizedType = normalizeSearchText(typeName);

      let category: StorageUnitType['category'] = 'personal';
      if (normalizedType.includes('climate') || normalizedType.includes('cold') || normalizedType.includes('lanh')) {
        category = 'special';
      } else if ((area != null && area <= 3.5) || normalizedType.includes('mini') || normalizedType.includes('locker')) {
        category = 'mini';
      } else if ((area != null && area > 8) || normalizedType.includes('business') || normalizedType.includes('commercial')) {
        category = 'business';
      }

      const statusMap: Record<string, StorageUnitType['status']> = {
        AVAILABLE: 'Sẵn sàng',
        OCCUPIED: 'Đang thuê',
        UNDER_MAINTENANCE: 'Bảo trì',
        MAINTENANCE: 'Bảo trì',
        RESERVED: 'Chờ duyệt'
      };

      return {
        id: unit.id,
        backendId: unit.id,
        name: `Kho #${unit.unitCode}`,
        unitTypeName: typeName || undefined,
        category,
        areaSqMeters: area,
        monthlyPrice: `${Number(unit.pricePerMonth).toLocaleString('vi-VN')} ₫/tháng`,
        monthlyPriceNumeric: Number(unit.pricePerMonth),
        depositAmountNumeric: unit.depositAmount == null ? undefined : Number(unit.depositAmount),
        status: statusMap[unit.status] || 'Bảo trì',
        facilityId: unit.facilityId,
        facilityName: unit.facilityName || facility?.name || '',
        facilityAddress: facility?.address || '',
        floorLocation: unit.floorLevel ? `${unit.floorLevel} · ${unit.unitCode}` : unit.unitCode,
        coords: facility?.coords || null
      };
    });
  }, [rawUnits, effectiveFacilities, dbFacilities]);

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
      if (match) setSelectedUnit(match)
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
      setGpsNotice('Trình duyệt không hỗ trợ định vị.')
      return
    }
    setIsLocatingGPS(true)
    setGpsNotice(null)
    navigator.geolocation.getCurrentPosition(
      position => {
        const currentLocation: CustomerCoordinates = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          displayName: 'Vị trí hiện tại'
        }
        setCustomerLocation(currentLocation)
        setManualAddress('')
        setManualLocationResolved(true)
        setSortByDistance(true)
        setIsLocatingGPS(false)
        setGpsNotice('Đã cập nhật vị trí của bạn.')
      },
      () => {
        setIsLocatingGPS(false)
        setGpsNotice('Không thể lấy vị trí. Hãy cho phép trình duyệt truy cập vị trí rồi thử lại.')
      },
      { timeout: 10000, enableHighAccuracy: true }
    )
  }
  // Calculate dynamic proximity (distance & travel time) from customer location
  const unitsWithProximity = useMemo(() => {
    return effectiveUnits.map(unit => {
      if (!customerLocation || !unit.coords) return unit;
      const dist = calculateDistanceKm(customerLocation.lat, customerLocation.lng, unit.coords.lat, unit.coords.lng);
      return { ...unit, distanceKm: dist };
    });
  }, [effectiveUnits, customerLocation]);
  const rentableUnits = useMemo(
    () => unitsWithProximity.filter(unit => unit.status === 'Sẵn sàng' && Boolean(unit.backendId)),
    [unitsWithProximity]
  );
  const availableUnitTypes = useMemo(
    () => [...new Set(rentableUnits.map(unit => unit.unitTypeName).filter((name): name is string => Boolean(name)))].sort((a, b) => a.localeCompare(b, 'vi')),
    [rentableUnits]
  );
  const filteredUnits = useMemo(() => {
    let list = rentableUnits.filter(unit => {
      const matchCategory = activeCategory === 'all' || unit.category === activeCategory;
      const matchFacility = selectedFacilityFilter === 'all' || unit.facilityId === selectedFacilityFilter;
      const matchType = unitTypeFilter === 'all' || unit.unitTypeName === unitTypeFilter;
      const area = unit.areaSqMeters;
      const matchSize = sizeFilter === 'all'
        || (area != null && sizeFilter === 'under3' && area < 3)
        || (area != null && sizeFilter === '3to8' && area >= 3 && area <= 8)
        || (area != null && sizeFilter === '8to15' && area > 8 && area <= 15)
        || (area != null && sizeFilter === '15plus' && area > 15);
      const normalizedQuery = normalizeSearchText(searchQuery);
      const matchQuery = !normalizedQuery || [unit.id, unit.name, unit.unitTypeName || '', unit.facilityName, unit.facilityAddress]
        .some(value => normalizeSearchText(value).includes(normalizedQuery));
      return matchCategory && matchFacility && matchType && matchSize && matchQuery;
    });

    if (sortByDistance && customerLocation) {
      list = [...list].sort((a, b) => (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY));
    }
    return list;
  }, [rentableUnits, activeCategory, selectedFacilityFilter, unitTypeFilter, sizeFilter, searchQuery, sortByDistance, customerLocation]);

  const nearestFacility = useMemo(() => {
    if (!customerLocation || !manualLocationResolved) return null;
    return effectiveFacilities
      .filter(facility => facility.coords != null)
      .map(facility => ({
        ...facility,
        coords: facility.coords!,
        distanceKm: calculateDistanceKm(customerLocation.lat, customerLocation.lng, facility.coords!.lat, facility.coords!.lng),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm)[0] || null;
  }, [customerLocation, manualLocationResolved, effectiveFacilities]);

  const handleSearchAddress = async () => {
    if (!manualAddress.trim()) {
      setGpsNotice('Nhập địa chỉ để tìm kiếm.')
      return
    }

    setIsSearchingAddress(true)
    setGpsNotice(null)
    try {
      const result = await geocodeAddressWithNominatim(manualAddress)
      setCustomerLocation(result)
      setManualAddress(result.displayName)
      setManualLocationResolved(true)
      setSortByDistance(true)
      setGpsNotice(`Đã xác định địa chỉ: ${result.displayName}`)
    } catch (error) {
      setCustomerLocation(null)
      setManualLocationResolved(false)
      setSortByDistance(false)
      setGpsNotice(getNominatimErrorMessage(error))
    } finally {
      setIsSearchingAddress(false)
    }
  }
  const handleRentUnitClick = (unit: StorageUnitType) => {
    if (unit.status !== 'Sẵn sàng' || !unit.backendId) return
    if (!isAuthenticated) {
      navigate(`/login?redirect=${encodeURIComponent(`/units?unit=${unit.backendId}`)}`)
      return
    }
    setCheckoutUnit({
      backendId: unit.backendId,
      code: unit.id,
      name: unit.name,
      facilityName: unit.facilityName,
      monthlyPrice: unit.monthlyPriceNumeric,
      depositAmount: unit.depositAmountNumeric ?? unit.monthlyPriceNumeric,
      size: unit.areaSqMeters == null ? 'Chưa cập nhật' : `${unit.areaSqMeters} m²`,
      address: unit.facilityAddress
    })
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
                  Tìm kho gần bạn
                </h2>
                <p className="text-[11px] text-slate-500">
                  Nhập địa chỉ hoặc bật vị trí để xem các cơ sở kho gần bạn.
                </p>
              </div>
            </div>

            {/* Nearest Unit Highlight Badge */}
            {nearestFacility && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold self-start sm:self-auto">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                <span>
                  Gần bạn nhất: <strong>{nearestFacility.name}</strong> (khoảng {nearestFacility.distanceKm} km)
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5 items-start">
            
            {/* Customer address search */}
            <div className="lg:col-span-7 space-y-2.5">
              <label htmlFor="customer-address" className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[17px] text-cyan-600">person_pin_circle</span>
                <span>Vị trí của bạn</span>
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input id="customer-address" type="text" value={manualAddress}
                  onChange={event => {
                    setManualAddress(event.target.value);
                    setCustomerLocation(null);
                    setManualLocationResolved(false);
                    setSortByDistance(false);
                    setGpsNotice(null);
                  }}
                  onKeyDown={event => { if (event.key === 'Enter') void handleSearchAddress(); }}
                  placeholder="Nhập địa chỉ của bạn" aria-label="Địa chỉ của bạn"
                  className="min-w-0 flex-1 px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500" />
                <button type="button" onClick={() => void handleSearchAddress()} disabled={isSearchingAddress || !manualAddress.trim()} className="px-3 py-2.5 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white text-xs font-bold shrink-0 disabled:opacity-60">
                  {isSearchingAddress ? 'Đang tìm…' : 'Tìm địa chỉ'}
                </button>
                <button type="button" onClick={handleGetGpsLocation} disabled={isLocatingGPS} className="px-3 py-2.5 rounded-xl bg-slate-900 hover:bg-neutral-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-60" title="Dùng vị trí hiện tại của bạn">
                  {isLocatingGPS ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <span className="material-symbols-outlined text-[16px] text-cyan-400">my_location</span>}
                  <span>{isLocatingGPS ? 'Đang lấy vị trí…' : 'Bật vị trí'}</span>
                </button>
              </div>
              {customerLocation && <p className="text-[11px] text-slate-600 truncate" title={customerLocation.displayName}>Đang tìm quanh: {customerLocation.displayName}</p>}
              {gpsNotice && <p className="text-[11px] text-cyan-700 font-medium" role="status">{gpsNotice}</p>}
            </div>
            {/* Column 2: VỊ TRÍ CƠ SỞ KHO MUỐN THUÊ (5 Cols) */}
            <div className="lg:col-span-5 space-y-2.5">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[17px] text-[var(--brand-teal,#0891b2)]">domain</span>
                <span>Cơ sở kho</span>
              </label>

              <select
                value={selectedFacilityFilter}
                onChange={(e) => setSelectedFacilityFilter(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500 shadow-2xs"
              >
                <option value="all">Tất Cả Cơ Sở Kho Boxora ({effectiveFacilities.length} Chi Nhánh)</option>
                {effectiveFacilities.map((fac) => {
                  const dist = customerLocation && fac.coords ? calculateDistanceKm(customerLocation.lat, customerLocation.lng, fac.coords.lat, fac.coords.lng) : null;
                  return (
                    <option key={fac.id} value={fac.id}>
                      {fac.name}{dist === null ? '' : ` (khoảng ${dist} km)`}
                    </option>
                  );
                })}
              </select>

              {/* Facility summary highlight */}
              <div className="text-[11px] text-slate-600 flex items-center gap-1 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200/70">
                <span className="material-symbols-outlined text-[14px] text-slate-500 shrink-0">warehouse</span>
                <span className="truncate">
                  {selectedFacilityFilter === 'all'
                    ? `Kho tại ${effectiveFacilities.length} cơ sở`
                    : effectiveFacilities.find(f => f.id === selectedFacilityFilter)?.address || ''}
                </span>
              </div>
            </div>

            {/* Column 3: SORT & PROXIMITY TOGGLE (2 Cols) */}
            <div className="lg:col-span-2 space-y-2.5">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[17px] text-amber-600">tune</span>
                <span>Kho gần bạn</span>
              </label>

              <button
                type="button"
                disabled={!customerLocation}
                onClick={() => setSortByDistance(prev => !prev)}
                className={`w-full disabled:cursor-not-allowed disabled:opacity-50 py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer ${
                  sortByDistance
                    ? 'bg-cyan-600 text-white border-cyan-600 shadow-cyan-600/20 shadow-xs'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">
                  {sortByDistance ? 'check_circle' : 'swap_vert'}
                </span>
                <span>{sortByDistance ? 'Đang ưu tiên kho gần bạn' : 'Ưu tiên kho gần bạn'}</span>
              </button>

              <p className="text-[10px] text-slate-500 text-center">
                {sortByDistance ? 'Các kho gần bạn được hiển thị trước' : 'Bật để xem kho gần bạn trước'}
              </p>
            </div>

          </div>
        </div>

        {/* ============================================================ */}
        {/* 4. CATEGORY TABS & SEARCH TOOLBAR                            */}
        {/* ============================================================ */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Search, unit filters and view toggle */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative min-w-[200px] flex-1 sm:flex-none">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-slate-400">
                search
              </span>
              <input
                type="text"
                placeholder="Tìm mã kho, loại kho, chi nhánh..."
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

            <select
              value={activeCategory}
              onChange={event => setActiveCategory(event.target.value as typeof activeCategory)}
              aria-label="Lọc theo phân hạng"
              className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none"
            >
              <option value="all">Tất cả phân hạng</option>
              <option value="mini">Locker Mini (1–3 m²)</option>
              <option value="personal">Kho Cá nhân (4–8 m²)</option>
              <option value="business">Kho Doanh nghiệp (10–20 m²)</option>
              <option value="special">Kho lạnh / đặc biệt</option>
            </select>

            <select
              value={unitTypeFilter}
              onChange={event => setUnitTypeFilter(event.target.value)}
              aria-label="Lọc theo loại kho"
              className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none"
            >
              <option value="all">Tất cả loại kho</option>
              {availableUnitTypes.map(typeName => <option key={typeName} value={typeName}>{typeName}</option>)}
            </select>
            <select
              value={sizeFilter}
              onChange={event => setSizeFilter(event.target.value as typeof sizeFilter)}
              aria-label="Lọc theo diện tích kho"
              className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none"
            >
              <option value="all">Mọi diện tích</option>
              <option value="under3">Dưới 3 m²</option>
              <option value="3to8">3–8 m²</option>
              <option value="8to15">Trên 8–15 m²</option>
              <option value="15plus">Trên 15 m²</option>
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
        {loadingUnits ? (
          <div className="py-16 text-center bg-white rounded-2xl border border-slate-200 text-sm text-slate-500">
            Đang tải danh sách kho...
          </div>
        ) : dataLoadError ? (
          <div role="alert" className="py-16 text-center bg-white rounded-2xl border border-rose-200 text-sm text-rose-700">{dataLoadError}</div>
        ) : filteredUnits.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <span className="material-symbols-outlined text-5xl text-slate-300">inventory_2</span>
            <h3 className="font-headline text-base font-bold text-slate-800">{rentableUnits.length === 0 ? 'Hiện chưa có kho để hiển thị' : 'Không tìm thấy kho phù hợp'}</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">Thử đổi loại kho, diện tích, chi nhánh hoặc từ khóa tìm kiếm.</p>
            <button
              type="button"
              onClick={() => {
                setActiveCategory('all')
                setSelectedFacilityFilter('all')
                setUnitTypeFilter('all')
                setSizeFilter('all')
                setSearchQuery('')
                setManualAddress('')
                setCustomerLocation(null)
                setManualLocationResolved(false)
                setSortByDistance(false)
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
              const isSelected = selectedUnit?.id === unit.id
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
                    <div className="flex items-center">
                      <span className="font-mono text-sm font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md">{unit.id}</span>
                    </div>

                    <div>
                      <h3 className="font-headline text-lg font-bold text-slate-900">{unit.name}</h3>
                      {(unit.unitTypeName || unit.areaSqMeters != null) && (
                        <div className="mt-1 text-xs text-slate-600">
                          {[unit.unitTypeName, unit.areaSqMeters == null ? null : `${unit.areaSqMeters} m²`].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </div>

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
                        {unit.distanceKm != null && (
                          <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-cyan-100 text-cyan-900 border border-cyan-200 flex items-center gap-1 shrink-0">
                            <span className="material-symbols-outlined text-[13px] text-cyan-700">near_me</span>
                            Khoảng {unit.distanceKm} km
                          </span>
                        )}
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

                      <div className="pt-1 flex items-center justify-end text-[11px]">
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
                      disabled={!unit.backendId}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRentUnitClick(unit)
                      }}
                      className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-all flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      <span>Gửi yêu cầu thuê</span>
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
              const isSelected = selectedUnit?.id === unit.id
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
                  <div className="space-y-2 min-w-[260px]">
                    <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">{unit.id}</span>
                    <h3 className="font-headline text-base font-bold text-slate-900">{unit.name}</h3>
                    {(unit.unitTypeName || unit.areaSqMeters != null) && (
                      <p className="text-xs text-slate-600">
                        {[unit.unitTypeName, unit.areaSqMeters == null ? null : `${unit.areaSqMeters} m²`].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>

                  {/* Middle Column: Facility, Floor Location, Distance */}
                  <div className="space-y-1.5 flex-1 max-w-xl text-xs">
                    <div className="flex items-center gap-2">
                      <strong className="text-slate-800">{unit.facilityName}</strong>
                      {unit.distanceKm != null && (
                        <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-cyan-100 text-cyan-900 border border-cyan-200 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px] text-cyan-700">near_me</span>
                          Khoảng {unit.distanceKm} km
                        </span>
                      )}
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
                      disabled={!unit.backendId}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRentUnitClick(unit)
                      }}
                      className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      <span>Gửi yêu cầu thuê</span>
                      <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                    </button>
                  </div>

                </div>
              )
            })}
          </div>
        )}

      </section>

      {checkoutUnit && user && (
        <BookingCheckoutModal
          unit={checkoutUnit}
          user={user}
          onClose={() => setCheckoutUnit(null)}
        />
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
