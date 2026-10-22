import React, { useState, useMemo, useEffect } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  StorageUnitType,
  calculateDistanceKm,
} from '../../data/storageUnitsData'
import { FloatingContactWidget } from '../../components/common/FloatingContactWidget'
import { facilityService } from '../../services/facilityService'
import { storageUnitService } from '../../services/storageUnitService'
import { BrandLogo } from '../../components/common/BrandLogo'
import { AccountProfileModal } from '../../components/common/AccountProfileModal'
import { LogoutConfirmModal } from '../../components/common/LogoutConfirmModal'
import { WebSettingsModal } from '../../components/common/WebSettingsModal'
import { UserAvatarDropdown } from '../../components/common/UserAvatarDropdown'
import { QuickThemeLanguageToggle } from '../../components/common/QuickThemeLanguageToggle'
import NotificationCenter from '../../components/layout/NotificationCenter'
import { StorageUnitCard, StorageUnitCardSkeleton } from '../../components/units/StorageUnitCard'
import { StorageUnitDetailModal } from '../../components/modals/StorageUnitDetailModal'
import { useLanguage } from '../../context/LanguageContext'
import { Facility, StorageUnit } from '../../types'
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

<<<<<<< Updated upstream
=======
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

interface StorageUnitOffer extends StorageUnitType {
  availableUnitCount: number
  totalUnitCount: number
}

>>>>>>> Stashed changes
export const UnitsExplorerPage: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
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

  const isCustomer = user?.role?.name === 'CUSTOMER'
  const [welcomeMessage, setWelcomeMessage] = useState<string | null>(null)

  useEffect(() => {
    const message = (location.state as { welcomeMessage?: string } | null)?.welcomeMessage
    if (!message) return
    setWelcomeMessage(message)
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null })
  }, [location.key, location.pathname, location.search, location.state, navigate])

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

<<<<<<< Updated upstream
  // Selected Unit & Modal State
  const [selectedUnit, setSelectedUnit] = useState<StorageUnitType | null>(null)
  const [detailModalUnit, setDetailModalUnit] = useState<StorageUnitType | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false)
  const [dataLoadError, setDataLoadError] = useState('')
=======
  // Grouped Filter States
  // 1. Vị trí: customerLocation & manualAddress
  // 2. Cơ sở: selectedFacilityFilter
  const [selectedFacilityFilter, setSelectedFacilityFilter] = useState<string>('all')
  // 3. Loại kho: categoryFilter ('all' | 'personal' | 'standard' | 'business' | 'climate')
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'mini' | 'personal' | 'business' | 'special'>('all')
  // 4. Diện tích: sizeFilter
  const [sizeFilter, setSizeFilter] = useState<'all' | 'under3' | '3to8' | '8to15' | '15plus'>('all')
  // 5. Giá thuê: priceFilter
  const [priceFilter, setPriceFilter] = useState<'all' | 'under1m5' | '1m5to3m' | '3mto5m' | 'above5m'>('all')
  // 6. Sắp xếp: sortOption
  const [sortOption, setSortOption] = useState<'price_asc' | 'price_desc' | 'distance' | 'area_desc'>('price_asc')
  // 7. Tình trạng kho: statusFilter
  const [statusFilter, setStatusFilter] = useState<'all' | 'available'>('available')
  // 8. Từ khóa tìm kiếm: searchQuery
  const [searchQuery, setSearchQuery] = useState('')
  // View mode
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
>>>>>>> Stashed changes

  const handleOpenDetailModal = (unit: StorageUnitType) => {
    setSelectedUnit(unit)
    setDetailModalUnit(unit)
    setIsDetailModalOpen(true)
  }

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

<<<<<<< Updated upstream
=======
  // Process facilities
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
        unitCode: unit.unitCode,
        name: `Kho #${unit.unitCode}`,
=======
        unitCode, // User-facing clean code (e.g. TD-A101)
        name: typeName || getCategoryDisplayName(category),
>>>>>>> Stashed changes
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
        floorLevel: unit.floorLevel || 'Tầng 1',
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
<<<<<<< Updated upstream
  const handleRentUnitClick = (unit: StorageUnitType) => {
    if (unit.status !== 'Sẵn sàng' || !unit.backendId) return
    navigate(`/reserve?unit=${encodeURIComponent(unit.backendId)}`)
=======

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
        (area != null && sizeFilter === 'under3' && area <= 3) ||
        (area != null && sizeFilter === '3to8' && area > 3 && area < 8) ||
        (area != null && sizeFilter === '8to15' && area >= 8 && area <= 15) ||
        (area != null && sizeFilter === '15plus' && area >= 15)

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

  // Customers choose the size and branch first. The exact unit code and floor
  // are assigned with staff at check-in, so group equivalent positions into
  // one offer and use an available inventory row only as the booking handle.
  const storageOffers = useMemo<StorageUnitOffer[]>(() => {
    const grouped = new Map<string, StorageUnitType[]>()
    filteredUnits.forEach((unit) => {
      const key = [
        unit.facilityId,
        normalizeSearchText(unit.unitTypeName || getCategoryDisplayName(unit.category)),
        unit.areaSqMeters ?? 'unknown-size',
        unit.monthlyPriceNumeric,
        unit.depositAmountNumeric ?? '',
      ].join('|')
      grouped.set(key, [...(grouped.get(key) || []), unit])
    })

    return [...grouped.entries()].map(([key, units]) => {
      const bookableUnit = units.find((unit) => unit.isAvailable && unit.backendId) || units[0]
      const availableUnitCount = units.filter((unit) => unit.isAvailable).length
      return {
        ...bookableUnit,
        id: `offer:${key}`,
        unitCode: '',
        name: bookableUnit.unitTypeName || getCategoryDisplayName(bookableUnit.category),
        floorLocation: '',
        isAvailable: availableUnitCount > 0,
        status: availableUnitCount > 0 ? 'Sẵn sàng' : bookableUnit.status,
        availableUnitCount,
        totalUnitCount: units.length,
      }
    })
  }, [filteredUnits])

  // Open the portal's reservation dashboard directly on the landing search page.
  const handleRentUnitClick = (unit: StorageUnitType) => {
    if (!unit.isAvailable || !unit.backendId) return
    if (!isAuthenticated) {
      const landingBookingPath = `/units?unit=${encodeURIComponent(unit.backendId)}&book=1`
      navigate(`/login?redirect=${encodeURIComponent(landingBookingPath)}`)
      return
    }

    setSelectedBookingUnit({
      id: unit.backendId,
      unitCode: unit.unitCode,
      name: unit.unitTypeName || unit.name,
      facilityName: unit.facilityName || '',
      facilityStatus: (unit as any).facilityStatus,
      priceFormatted: unit.monthlyPrice,
      priceNumber: unit.monthlyPriceNumeric || 1250000,
      depositNumber: unit.depositAmountNumeric || unit.monthlyPriceNumeric || 1250000,
      areaSqMeters: unit.areaSqMeters,
      floorLevel: unit.floorLocation || (language === 'vi' ? 'Tầng 1' : 'Floor 1'),
    })
  }

  const closeBookingModal = () => {
    setSelectedBookingUnit(null)
    if (searchParams.get('book') === '1') {
      const nextParams = new URLSearchParams(searchParams)
      nextParams.delete('book')
      nextParams.delete('unit')
      setSearchParams(nextParams, { replace: true })
    }
  }

  // Reset all filters
  const handleResetFilters = () => {
    setSelectedFacilityFilter('all')
    setCategoryFilter('all')
    setSizeFilter('all')
    setPriceFilter('all')
    setStatusFilter('available')
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
>>>>>>> Stashed changes
  }

  return (
    <div className="min-h-screen bg-[var(--surface-canvas,#f8fafc)] text-slate-900 font-sans selection:bg-blue-600 selection:text-white pb-20">
      {welcomeMessage && (
        <div role="status" className="fixed right-4 top-20 z-50 flex max-w-md items-start gap-3 rounded-xl border border-emerald-200 bg-white p-4 text-sm text-emerald-900 shadow-lg">
          <span className="material-symbols-outlined text-emerald-600">check_circle</span>
          <p className="flex-1">{welcomeMessage}</p>
          <button type="button" aria-label="Đóng thông báo" onClick={() => setWelcomeMessage(null)} className="text-emerald-700 hover:text-emerald-900">×</button>
        </div>
      )}
      
      {/* ============================================================ */}
      {/* 1. TOP HEADER & NAVIGATION                                   */}
      {/* ============================================================ */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-5 lg:px-6 h-16 flex items-center justify-between">
          
          {/* Logo & Explorer Identity */}
          <div className="flex items-center">
            <BrandLogo subtitle="STORAGE EXPLORER" />
          </div>

          {/* Navigation Links & User Action */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/"
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              <span>{t('Trang Giới Thiệu (Landing)')}</span>
            </Link>

            <QuickThemeLanguageToggle />

            {isAuthenticated && <NotificationCenter userId={user?.id} />}

            {isAuthenticated ? (
              <UserAvatarDropdown
                user={user}
                role={user?.role?.name || 'CUSTOMER'}
                onOpenProfile={() => setIsProfileModalOpen(true)}
                onOpenSettings={() => setIsSettingsModalOpen(true)}
                onOpenLogoutConfirm={() => setIsLogoutConfirmOpen(true)}
                extraActions={
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
<<<<<<< Updated upstream
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
=======
                    {canAccessPortal ? (
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
>>>>>>> Stashed changes
                  </div>
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
      <section className="bg-gradient-to-b from-white to-slate-50 border-b border-slate-200 py-6 sm:py-8 text-left">
        <div className="max-w-7xl mx-auto px-4 sm:px-5 lg:px-6">
          
          <div className="max-w-3xl space-y-1.5">
            <h1 className="font-headline text-xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Tìm Kiếm &amp; Đặt Thuê Kho Trực Tuyến
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-2xl">
<<<<<<< Updated upstream
              Định vị vị trí hiện tại của bạn, kiểm tra cự ly thực tế tới các chi nhánh, so sánh phân hạng buồng kho và đặt giữ chỗ ngay để nhận mã PIN tự quản 24/7.
=======
              Chọn cơ sở và diện tích phù hợp, xem giá thuê theo kho còn trống rồi đặt lịch nhận kho. Mã kho cụ thể được chọn cùng nhân viên Boxora khi check-in.
>>>>>>> Stashed changes
            </p>
          </div>

        </div>
      </section>

      {/* ============================================================ */}
      {/* 3. LOCATION & PROXIMITY CONTROL CENTER                       */}
      {/* ============================================================ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-5 lg:px-6 mt-5 sm:mt-6 space-y-5">
        
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-sm text-left space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">near_me</span>
              </div>
              <div>
                <h2 className="font-headline text-sm font-bold text-slate-900">
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 items-start">
            
            {/* Customer address search */}
            <div className="lg:col-span-5 space-y-2">
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
            {/* Facility filter */}
            <div className="lg:col-span-4 space-y-2">
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

            {/* Proximity sorting */}
            <div className="md:col-span-2 lg:col-span-3 space-y-2">
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

<<<<<<< Updated upstream
=======
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
                <option value="under3">Đến 3 m² (Nhỏ gọn)</option>
                <option value="3to8">Trên 3 đến dưới 8 m² (Đồ gia đình)</option>
                <option value="8to15">8 – 15 m² (Lớn - Nhiều đồ)</option>
                <option value="15plus">Từ 15 m² (Doanh nghiệp &amp; pallet)</option>
              </select>

              <p className="text-[10px] text-slate-500">
                Lựa chọn diện tích sàn phù hợp thể tích đồ đạc.
              </p>
            </div>
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
                placeholder="Tìm mã kho, loại kho, chi nhánh..."
=======
                placeholder="Tìm loại kho, cơ sở..."
>>>>>>> Stashed changes
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

<<<<<<< Updated upstream
=======
        {/* Results Header Count & Clear Filter */}
        <div className="flex items-center justify-between text-xs text-slate-500 px-1">
          <div>
            Hiển thị <strong>{storageOffers.length}</strong> lựa chọn diện tích và cơ sở
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
>>>>>>> Stashed changes
        </div>

        {/* ============================================================ */}
        {/* 5. STORAGE UNITS INVENTORY (GRID OR LIST)                    */}
        {/* ============================================================ */}
        {loadingUnits ? (
          <div
            role="status"
            aria-label="Đang tải danh sách kho"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-left items-stretch"
          >
            {Array.from({ length: 6 }, (_, index) => <StorageUnitCardSkeleton key={index} />)}
          </div>
        ) : dataLoadError ? (
<<<<<<< Updated upstream
          <div role="alert" className="py-16 text-center bg-white rounded-2xl border border-rose-200 text-sm text-rose-700">{dataLoadError}</div>
        ) : filteredUnits.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
=======
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
        ) : storageOffers.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-3xl border border-slate-200 shadow-2xs space-y-3">
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
            {filteredUnits.map((unit) => {
              const isSelected = selectedUnit?.id === unit.id
=======
            {storageOffers.map((unit) => {
>>>>>>> Stashed changes
              return (
                <StorageUnitCard
                  key={unit.id}
<<<<<<< Updated upstream
                  unitCode={unit.unitCode}
                  unitTypeName={unit.unitTypeName}
                  facilityName={unit.facilityName}
                  facilityAddress={unit.facilityAddress}
                  floorLevel={unit.floorLevel}
                  pricePerMonth={unit.monthlyPriceNumeric}
                  areaSqMeters={unit.areaSqMeters}
                  distanceKm={unit.distanceKm}
                  isSelected={isSelected}
                  reserveDisabled={!unit.backendId}
                  onSelect={() => handleOpenDetailModal(unit)}
                  onViewDetails={() => handleOpenDetailModal(unit)}
                  onReserve={() => handleRentUnitClick(unit)}
                />
=======
                  className="rounded-3xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-lg transition-all duration-200 flex flex-col justify-between overflow-hidden group"
                >
                  {/* Card Thumbnail Image with Badges */}
                  <div className="relative h-44 w-full bg-slate-100 overflow-hidden">
                    <img
                      src={unit.imageUrl || getCardImage(unit.category)}
                      alt={unit.unitTypeName || getCategoryDisplayName(unit.category)}
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

                    <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-2">
                      <div>
                        <h3 className="font-headline text-lg font-extrabold text-white mt-1 drop-shadow-sm">
                          {unit.unitTypeName || getCategoryDisplayName(unit.category)}
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
                          <span className="truncate">{unit.facilityName}</span>
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
                          <span className="text-[10px] text-slate-400 font-medium block">Kho còn trống</span>
                          <span className="font-headline font-semibold text-slate-800 truncate block">
                            {unit.availableUnitCount} vị trí
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Price and Action Buttons */}
                    <div className="pt-3 border-t border-slate-100 space-y-3">
                      <div className="flex items-baseline justify-between">
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                            Giá thuê tham khảo
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
                          <span>Xem giá &amp; đặt lịch</span>
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
>>>>>>> Stashed changes
              )
            })}
          </div>
        ) : (
          /* LIST VIEW */
          <div className="space-y-4">
<<<<<<< Updated upstream
            {filteredUnits.map((unit) => {
              const isSelected = selectedUnit?.id === unit.id
=======
            {storageOffers.map((unit) => {
>>>>>>> Stashed changes
              return (
                <div
                  key={unit.id}
                  onClick={() => handleOpenDetailModal(unit)}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 text-left ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/20 ring-2 ring-blue-500/20 shadow-md'
                      : 'border-slate-200 bg-white hover:border-slate-300 shadow-2xs'
                  }`}
                >
<<<<<<< Updated upstream
                  <div className="space-y-2 min-w-[260px]">
                    <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">#{unit.unitCode}</span>
                    <h3 className="font-headline text-base font-bold text-slate-900 hover:text-blue-600 transition-colors">{unit.name}</h3>
                    {(unit.unitTypeName || unit.areaSqMeters != null) && (
                      <p className="text-xs text-slate-600">
                        {[unit.unitTypeName, unit.areaSqMeters == null ? null : `${unit.areaSqMeters} m²`].filter(Boolean).join(' · ')}
=======
                  {/* Left Column: Image thumbnail + Unit info */}
                  <div className="flex items-center gap-4 min-w-[280px]">
                    <div className="w-20 h-20 rounded-2xl overflow-hidden bg-slate-100 shrink-0 relative">
                      <img
                        src={unit.imageUrl || getCardImage(unit.category)}
                        alt={unit.unitTypeName || getCategoryDisplayName(unit.category)}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = '/smart-warehouse-clean.jpg'
                        }}
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {renderStatusBadge(unit)}
                        <span className="text-[11px] font-semibold text-slate-500">
                          {unit.availableUnitCount} vị trí trống
                        </span>
                      </div>
                      <h3 className="font-headline text-base font-bold text-slate-900">
                        {unit.unitTypeName || getCategoryDisplayName(unit.category)}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {[
                          unit.areaSqMeters != null ? `${unit.areaSqMeters} m²` : null,
                          unit.unitTypeName || getCategoryDisplayName(unit.category),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
>>>>>>> Stashed changes
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

                  {/* Right Column: Price & Buttons */}
                  <div className="flex items-center justify-between lg:justify-end gap-3 w-full lg:w-auto pt-4 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                    <div className="text-left lg:text-right mr-2">
                      <span className="font-mono text-xl font-bold text-slate-900 tabular-nums block">
                        {unit.monthlyPrice}
                      </span>
                      <span className="text-[10px] text-slate-500">/ tháng</span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleOpenDetailModal(unit)
                      }}
                      className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">visibility</span>
                      <span>Chi Tiết &amp; Ảnh</span>
                    </button>

<<<<<<< Updated upstream
                    <button
                      type="button"
                      disabled={!unit.backendId}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRentUnitClick(unit)
                      }}
                      className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      <span>Đặt Giữ Chỗ</span>
                      <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                    </button>
=======
                      {unit.isAvailable ? (
                        <button
                          type="button"
                          onClick={() => handleRentUnitClick(unit)}
                          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>Xem giá &amp; đặt lịch</span>
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
>>>>>>> Stashed changes
                  </div>

                </div>
              )
            })}
          </div>
        )}

      </section>

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

      <StorageUnitDetailModal
        isOpen={isDetailModalOpen}
        unit={detailModalUnit ? {
          id: detailModalUnit.id,
          backendId: detailModalUnit.backendId,
          unitCode: detailModalUnit.unitCode,
          unitTypeName: detailModalUnit.unitTypeName,
          facilityId: detailModalUnit.facilityId,
          facilityName: detailModalUnit.facilityName,
          facilityAddress: detailModalUnit.facilityAddress,
          floorLevel: detailModalUnit.floorLevel,
          pricePerMonth: detailModalUnit.monthlyPriceNumeric,
          depositAmount: detailModalUnit.depositAmountNumeric,
          areaSqMeters: detailModalUnit.areaSqMeters,
          distanceKm: detailModalUnit.distanceKm,
          status: detailModalUnit.status,
          images: detailModalUnit.images
        } : null}
        onClose={() => setIsDetailModalOpen(false)}
        onReserve={(unitData) => {
          const matched = effectiveUnits.find(u => u.id === unitData.id) || detailModalUnit
          if (matched) {
            handleRentUnitClick(matched)
          }
        }}
      />

    </div>
  )
}
