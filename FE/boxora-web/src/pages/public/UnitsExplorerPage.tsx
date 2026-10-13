import React, { useState, useMemo, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  StorageUnitType,
  CustomerLocationOption,
  FacilityLocation,
  BOXORA_FACILITIES,
  CUSTOMER_LOCATIONS,
  STORAGE_UNITS,
  calculateDistanceKm,
  estimateTravelMinutes
} from '../../data/storageUnitsData'
import { checkCustomerPortalAccess } from '../../utils/rentalAccess'
import { FloatingContactWidget } from '../../components/common/FloatingContactWidget'
import { BookingCheckoutModal } from '../../components/modals/BookingCheckoutModal'
import { facilityService } from '../../services/facilityService'
import { storageUnitService } from '../../services/storageUnitService'

const FACILITY_COORDS: Record<string, { lat: number; lng: number }> = {
  'HCM-D1': { lat: 10.7745, lng: 106.7025 },
  'HCM-D7': { lat: 10.7325, lng: 106.7005 },
  'HCM-TD': { lat: 10.8540, lng: 106.7865 },
}

const mapBackendUnitToStorageUnitType = (
  unit: any,
  facilityMap: Map<string, FacilityLocation>
): StorageUnitType => {
  const fac = facilityMap.get(unit.facilityId)
  const isCold =
    unit.unitTypeName?.toLowerCase().includes('cold') ||
    unit.unitTypeName?.toLowerCase().includes('climate')
  const area = unit.areaSqMeters || 6
  let category: 'mini' | 'personal' | 'business' | 'special' = 'personal'
  if (isCold) category = 'special'
  else if (area <= 3) category = 'mini'
  else if (area <= 8) category = 'personal'
  else category = 'business'

  let capacityDesc =
    'Phù hợp nội thất chuyển nhà 1-2 phòng ngủ, nệm, sofa, máy giặt và 15-20 thùng carton.'
  let itemsExample = ['Nội thất căn hộ', 'Tủ lạnh, Máy giặt', '15-20 Thùng đồ']
  if (category === 'mini') {
    capacityDesc = 'Phù hợp 1-3 vali cỡ lớn, balo du lịch, đồ gia dụng nhỏ, thùng hồ sơ tài liệu.'
    itemsExample = ['2-3 Vali lớn', 'Thùng hồ sơ', 'Hộp đồ cá nhân']
  } else if (category === 'business') {
    capacityDesc =
      'Kho quy mô lớn có thể chứa pallet hàng hóa, vật tư sự kiện, thiết bị máy móc kinh doanh.'
    itemsExample = ['Pallet hàng hóa', 'Hàng TMĐT', 'Hồ sơ doanh nghiệp']
  } else if (category === 'special') {
    capacityDesc =
      'Kho vi khí hậu kiểm soát nhiệt độ 18°C-22°C và độ ẩm, phù hợp bảo quản rượu vang, đồ da cao cấp.'
    itemsExample = ['Rượu vang cao cấp', 'Bộ sưu tập đồ da', 'Tranh nghệ thuật']
  }

  const statusMapped: 'Sẵn sàng' | 'Đang thuê' | 'Bảo trì' =
    unit.status === 'AVAILABLE' ? 'Sẵn sàng' : unit.status === 'OCCUPIED' ? 'Đang thuê' : 'Bảo trì'

  return {
    id: `#${unit.unitCode}`,
    backendId: unit.id,
    name: `${unit.unitTypeName || 'Kho tiêu chuẩn'} #${unit.unitCode}`,
    category,
    size: `${area} m²`,
    volume: `${Math.round(area * 2.8)} m³`,
    capacityDesc,
    itemsExample,
    monthlyPrice: `${Number(unit.pricePerMonth || 1500000).toLocaleString('vi-VN')}₫`,
    monthlyPriceNumeric: Number(unit.pricePerMonth || 1500000),
    temp: isCold ? '18.5°C' : '21.5°C',
    humidity: '45%',
    status: statusMapped,
    facilityId: unit.facilityId,
    facilityName: unit.facilityName || fac?.name || 'Boxora Storage',
    facilityAddress: fac?.address || 'Cơ sở Boxora',
    floorLocation: `${unit.floorLevel || 'Tầng 1'} • SmartLock ${unit.smartLockSerial || 'IoT'}`,
    coords: fac?.coords || { lat: 10.7745, lng: 106.6925 },
  }
}

export const UnitsExplorerPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { isAuthenticated, user, logout } = useAuth()

  // Dynamic API state with fallbacks
  const [facilities, setFacilities] = useState<FacilityLocation[]>(BOXORA_FACILITIES)
  const [allUnits, setAllUnits] = useState<StorageUnitType[]>(STORAGE_UNITS)
  const [isLoadingApi, setIsLoadingApi] = useState<boolean>(true)

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
  const [dropdownOpen, setDropdownOpen] = useState(false)

  // Load facilities and available units from real API
  useEffect(() => {
    let isMounted = true
    async function loadApiData() {
      try {
        setIsLoadingApi(true)
        const [facRes, unitsRes] = await Promise.all([
          facilityService.getFacilities({ size: 100 }),
          storageUnitService.getUnits(),
        ])
        if (!isMounted) return

        const fetchedFacs = facRes?.content || []
        const fetchedUnits = unitsRes || []

        if (fetchedFacs.length > 0) {
          const mappedFacs: FacilityLocation[] = fetchedFacs.map((f) => {
            const coords = (f.code && FACILITY_COORDS[f.code]) || { lat: 10.7745, lng: 106.6925 }
            return {
              id: f.id,
              name: f.name,
              shortName: f.name,
              district: f.city || 'TP.HCM',
              address: f.address,
              coords,
              contactPhone: f.contactPhone || '1900 6868',
              highlight: `${f.code || 'BOXORA'} • Mở cửa ${f.openTime || '08:00'} - ${f.closeTime || '20:00'} • Chuẩn An Ninh 24/7`,
            }
          })
          setFacilities(mappedFacs)

          const facMap = new Map<string, FacilityLocation>()
          mappedFacs.forEach((mf) => facMap.set(mf.id, mf))

          if (fetchedUnits.length > 0) {
            const mappedUnits = fetchedUnits.map((u) => mapBackendUnitToStorageUnitType(u, facMap))
            setAllUnits(mappedUnits)
            setSelectedUnit(mappedUnits[0])
          }
        }
      } catch (err) {
        console.warn('API error, using initial storage data fallback:', err)
      } finally {
        if (isMounted) setIsLoadingApi(false)
      }
    }
    loadApiData()
    return () => {
      isMounted = false
    }
  }, [])

  // Check URL query for default unit
  useEffect(() => {
    const unitParam = searchParams.get('unit')
    if (unitParam) {
      const match = allUnits.find(
        (u) =>
          u.id === unitParam ||
          u.backendId === unitParam ||
          u.id === `#${unitParam}` ||
          u.id.replace('#', '') === unitParam
      )
      if (match) {
        setSelectedUnit(match)
      }
    }
  }, [searchParams, allUnits])


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
    return allUnits.map(unit => {
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
  }, [allUnits, customerLocation])

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
    setRentalModalUnit(unit)
  }

  return (
    <div className="min-h-screen bg-[var(--surface-canvas,#f8fafc)] text-slate-900 font-sans selection:bg-[#0891b2] selection:text-white pb-20">
      
      {/* ============================================================ */}
      {/* 1. TOP HEADER & NAVIGATION                                   */}
      {/* ============================================================ */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          
          {/* Logo & Explorer Identity */}
          <div className="flex items-center gap-4 sm:gap-6">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-10 h-10 rounded-xl bg-[var(--brand-teal,#0891b2)] flex items-center justify-center text-white font-bold shadow-sm group-hover:bg-[var(--brand-teal-hover,#0e7490)] transition-colors">
                <span className="material-symbols-outlined text-[22px]">domain</span>
              </div>
              <div className="flex flex-col text-left">
                <span className="font-headline text-lg sm:text-xl font-bold tracking-tight text-slate-900 leading-none">
                  Boxora<span className="text-[var(--brand-teal,#0891b2)]">.</span>
                </span>
                <span className="font-mono text-[9px] text-cyan-800 font-semibold uppercase tracking-widest mt-1">
                  Storage Explorer
                </span>
              </div>
            </Link>

            <div className="hidden sm:flex items-center gap-2 border-l border-slate-200 pl-4">
              <span className="material-symbols-outlined text-[18px] text-cyan-600">travel_explore</span>
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono">
                Trung Tâm Phân Hạng &amp; Đặt Thuê Kho
              </span>
            </div>
          </div>

          {/* Navigation Links & User Action */}
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="hidden md:flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              <span>Trang Giới Thiệu (Landing)</span>
            </Link>

            {isAuthenticated ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setDropdownOpen(prev => !prev)}
                  className={`flex items-center gap-2 p-1.5 pr-3 rounded-full border shadow-2xs transition-all cursor-pointer text-left focus:outline-none ${
                    !canAccessPortal
                      ? 'bg-amber-50/90 hover:bg-amber-100 border-amber-200'
                      : 'bg-white hover:bg-slate-50 border-slate-200'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shadow-2xs ${
                      !canAccessPortal ? 'bg-amber-700 text-white' : 'bg-slate-900 text-white'
                    }`}
                  >
                    {user?.fullName ? user.fullName[0].toUpperCase() : user?.username ? user.username[0].toUpperCase() : 'U'}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-900 leading-tight">
                      {user?.fullName || user?.username || 'Khách Hàng'}
                    </span>
                    <span className="text-[9px] font-mono font-semibold text-cyan-800">
                      {!canAccessPortal ? 'Chưa Kích Hoạt Kho' : (user?.role?.name || 'CUSTOMER')}
                    </span>
                  </div>
                  <span className="material-symbols-outlined text-[16px] text-slate-400">expand_more</span>
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 p-4 space-y-3 text-left">
                    <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-100">
                      <div className="w-8 h-8 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center text-xs">
                        {user?.fullName ? user.fullName[0].toUpperCase() : user?.username ? user.username[0].toUpperCase() : 'U'}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold text-slate-900 truncate">{user?.fullName || user?.username}</span>
                        <span className="text-[11px] text-slate-500 truncate">{user?.email}</span>
                      </div>
                    </div>

                    {canAccessPortal && (
                      <button
                        type="button"
                        onClick={() => {
                          setDropdownOpen(false)
                          navigate(isCustomer ? '/portal/customer' : '/portal')
                        }}
                        className="w-full py-2 px-3 rounded-xl bg-slate-900 text-white font-semibold text-xs flex items-center justify-between hover:bg-neutral-800 transition-colors cursor-pointer"
                      >
                        <span className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[16px] text-emerald-400">dashboard</span>
                          <span>Vào Portal Quản Lý</span>
                        </span>
                        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setDropdownOpen(false)
                        logout()
                      }}
                      className="w-full py-1.5 px-3 rounded-lg text-rose-700 hover:bg-rose-50 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">logout</span>
                      <span>Đăng xuất</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-3.5 py-2 text-xs font-semibold text-slate-700 hover:text-[var(--brand-teal,#0891b2)] transition-colors"
                >
                  Đăng Nhập
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 rounded-lg bg-[var(--brand-teal,#0891b2)] hover:bg-[var(--brand-teal-hover,#0e7490)] text-white text-xs font-semibold shadow-xs transition-all flex items-center gap-1"
                >
                  <span>Đăng Ký Thuê</span>
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
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="max-w-3xl space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-50 border border-cyan-200 text-[var(--brand-teal,#0891b2)] font-mono text-xs font-bold uppercase tracking-wider">
                <span className="material-symbols-outlined text-[15px]">warehouse</span>
                <span>DASHBOARD TÌM KHO &amp; ĐẶT THUÊ CHUYÊN BIỆT</span>
              </div>
              <h1 className="font-headline text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                Trung Tâm Phân Hạng &amp; Tìm Kiếm Thuê Kho Thông Minh
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-2xl">
                Dành cho khách hàng đã tìm hiểu quy trình và công nghệ Boxora. Định vị vị trí hiện tại của bạn, kiểm tra cự ly thực tế tới các chi nhánh, so sánh các phân hạng kho và đặt giữ chỗ ngay để nhận mã PIN tự quản 24/7.
              </p>
            </div>

            {/* Quick Metrics Strip */}
            <div className="grid grid-cols-3 gap-3 self-start md:self-auto shrink-0 font-mono text-left">
              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] text-slate-400 block font-semibold uppercase">Cơ sở trực tuyến</span>
                <span className="text-lg font-bold text-slate-900">{facilities.length} Chi Nhánh</span>
                <span className="text-[10px] text-cyan-700 block truncate max-w-[140px]" title={facilities.map(f => f.district || f.shortName).join(' • ')}>
                  {facilities.map(f => f.district || f.shortName).join(' • ')}
                </span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] text-slate-400 block font-semibold uppercase">Kho phòng trống</span>
                <span className="text-lg font-bold text-emerald-700">Khả Dụng</span>
                <span className="text-[10px] text-slate-500 block">Cấp mã PIN tức thời</span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] text-slate-400 block font-semibold uppercase">Vi khí hậu chuẩn</span>
                <span className="text-lg font-bold text-slate-900">21.5°C</span>
                <span className="text-[10px] text-slate-500 block">Độ ẩm 45% RH</span>
              </div>
            </div>
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
              <div className="w-9 h-9 rounded-xl bg-cyan-100 text-[var(--brand-teal,#0891b2)] flex items-center justify-center">
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
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
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
                <option value="all">Tất Cả Cơ Sở Kho Boxora ({facilities.length} Chi Nhánh)</option>
                {facilities.map((fac) => {
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
                    ? `Đang hiển thị các phòng kho trên toàn hệ thống ${facilities.length} cơ sở`
                    : facilities.find(f => f.id === selectedFacilityFilter)?.address || ''}
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
        {isLoadingApi ? (
          <div className="py-20 text-center bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div className="w-8 h-8 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin mx-auto" />
            <p className="text-xs text-slate-500">Đang đồng bộ dữ liệu phòng kho trực tiếp từ hệ thống Boxora...</p>
          </div>
        ) : filteredUnits.length === 0 ? (
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
                      ? 'border-[var(--brand-teal,#0891b2)] bg-cyan-50/20 ring-2 ring-[var(--brand-teal,#0891b2)]/20 shadow-md'
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
                          <span className="material-symbols-outlined text-[16px] text-[var(--brand-teal,#0891b2)] shrink-0">
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
                          className="text-[var(--brand-teal,#0891b2)] hover:text-cyan-800 font-semibold flex items-center gap-0.5 hover:underline"
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
                      className="px-4 py-2 rounded-lg bg-[var(--brand-teal,#0891b2)] hover:bg-[var(--brand-teal-hover,#0e7490)] text-white text-xs font-semibold shadow-xs transition-all flex items-center gap-1 cursor-pointer"
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
                      ? 'border-[var(--brand-teal,#0891b2)] bg-cyan-50/20 ring-2 ring-[var(--brand-teal,#0891b2)]/20 shadow-md'
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
                      className="px-5 py-2.5 rounded-xl bg-[var(--brand-teal,#0891b2)] hover:bg-[var(--brand-teal-hover,#0e7490)] text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
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

      {rentalModalUnit && user && (
        <BookingCheckoutModal
          unit={{
            backendId: rentalModalUnit.backendId,
            code: rentalModalUnit.id,
            name: rentalModalUnit.name,
            facilityName: rentalModalUnit.facilityName,
            monthlyPrice: rentalModalUnit.monthlyPriceNumeric,
            size: rentalModalUnit.size,
            address: rentalModalUnit.facilityAddress,
          }}
          user={user}
          onClose={() => setRentalModalUnit(null)}
        />
      )}

      {/* Floating Action Speed-Dial Widget (Scroll Top, Zalo, Hotline, Maps) */}
      <FloatingContactWidget />

    </div>
  )
}
