import React, { useState, useMemo } from 'react'
import { StorageUnit, Booking } from '../../../types'
import { extractFloor } from '../../../utils/floorUtils'
import { storageUnitService } from '../../../services/storageUnitService'
import { useAuth } from '../../../context/AuthContext'

export interface FacilityStaffStorageDiagramProps {
  units: StorageUnit[]
  facilityName: string
  facilityId?: string
  arrivals: Booking[]
  activeRentals: Booking[]
  tickets: Array<{
    id: string
    backendId?: string
    title: string
    priority: string
    status: string
    unitCode?: string
  }>
  userRole?: string
  onSelectBookingForHandover?: (bookingId: string) => void
  onUnitMaintenanceToggled?: (updatedUnit: StorageUnit) => void
  onReportIncident?: (unit: StorageUnit) => void
}

export const FacilityStaffStorageDiagram: React.FC<FacilityStaffStorageDiagramProps> = ({
  units,
  facilityName,
  arrivals,
  activeRentals,
  tickets,
  userRole = 'STAFF',
  onSelectBookingForHandover,
  onUnitMaintenanceToggled,
  onReportIncident,
}) => {
  // Filter states
  const [selectedFloor, setSelectedFloor] = useState<string>('all')
  const [selectedZone, setSelectedZone] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [selectedSize, setSelectedSize] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')

  const { user } = useAuth()
  // Selected Unit Modal State
  const [selectedUnit, setSelectedUnit] = useState<StorageUnit | null>(null)
  const [isTogglingMaintenance, setIsTogglingMaintenance] = useState(false)
  const [showMaintInputForm, setShowMaintInputForm] = useState(false)
  const [maintReasonInput, setMaintReasonInput] = useState('')
  const [maintByInput, setMaintByInput] = useState('')
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Determine zone from unitCode or unit metadata
  const getUnitZone = (u: StorageUnit): string => {
    const code = (u.unitCode || '').toUpperCase()
    if (code.includes('-A') || code.includes('ZONE A') || /A\d+/.test(code)) return 'Khu A'
    if (code.includes('-B') || code.includes('ZONE B') || /B\d+/.test(code)) return 'Khu B'
    if (code.includes('-C') || code.includes('ZONE C') || /C\d+/.test(code)) return 'Khu C'
    if (code.includes('-D') || code.includes('ZONE D') || /D\d+/.test(code)) return 'Khu D'
    return 'Khu Tiêu chuẩn'
  }

  // Determine unit operational status
  const getUnitOperationalInfo = (u: StorageUnit) => {
    const pendingHandoverBooking = arrivals.find(
      (a) => a.unitCode === u.unitCode || (a.storageUnitId && a.storageUnitId === u.id)
    )
    const pendingReturnBooking = activeRentals.find(
      (r) =>
        (r.unitCode === u.unitCode || (r.storageUnitId && r.storageUnitId === u.id)) &&
        (((r.status as string) === 'CHECKOUT_REQUESTED') || (r as any).status === 'INSPECTED')
    )
    const activeIncident = tickets.find(
      (t) => t.unitCode === u.unitCode && t.status !== 'RESOLVED' && t.status !== 'CLOSED'
    )
    const isMaintenance = u.status === 'MAINTENANCE' || u.status === 'UNDER_MAINTENANCE'
    const isOverdue = u.status === 'OVERDUE_LOCKED'
    const isOccupied = u.status === 'OCCUPIED'

    // Trạng thái vận hành không gian kho (Primary Mutually Exclusive Statuses)
    let primaryStatus: 'AVAILABLE' | 'RESERVED' | 'OCCUPIED' | 'RETURN_PENDING' | 'MAINTENANCE' | 'OVERDUE_LOCKED' = 'AVAILABLE'
    let label = 'Trống sẵn sàng'
    let badgeBg = 'bg-emerald-50 text-emerald-700 border-emerald-200'
    let cardBorder = 'border-emerald-300 hover:border-emerald-500 hover:shadow-emerald-100'

    if (isOverdue) {
      primaryStatus = 'OVERDUE_LOCKED'
      label = 'Khóa quá hạn'
      badgeBg = 'bg-rose-50 text-rose-700 border-rose-200'
      cardBorder = 'border-rose-400 bg-rose-50/20 hover:border-rose-600 hover:shadow-rose-100'
    } else if (isMaintenance) {
      primaryStatus = 'MAINTENANCE'
      label = 'Đang bảo trì'
      badgeBg = 'bg-purple-50 text-purple-700 border-purple-200'
      cardBorder = 'border-purple-300 bg-purple-50/20 hover:border-purple-500 hover:shadow-purple-100'
    } else if (pendingHandoverBooking) {
      primaryStatus = 'RESERVED'
      label = 'Chờ bàn giao'
      badgeBg = 'bg-cyan-50 text-cyan-700 border-cyan-200'
      cardBorder = 'border-cyan-400 bg-cyan-50/30 hover:border-cyan-600 hover:shadow-cyan-100'
    } else if (pendingReturnBooking) {
      primaryStatus = 'RETURN_PENDING'
      label = 'Chờ trả kho'
      badgeBg = 'bg-amber-50 text-amber-700 border-amber-200'
      cardBorder = 'border-amber-300 bg-amber-50/30 hover:border-amber-500 hover:shadow-amber-100'
    } else if (isOccupied) {
      primaryStatus = 'OCCUPIED'
      label = 'Đang thuê'
      badgeBg = 'bg-slate-100 text-slate-700 border-slate-300'
      cardBorder = 'border-slate-300 bg-slate-50/50 hover:border-slate-400 hover:shadow-slate-100'
    }

    const hasActiveIncident = Boolean(activeIncident) || isOverdue

    return {
      primaryStatus,
      hasActiveIncident,
      label,
      badgeBg,
      cardBorder,
      pendingHandoverBooking,
      pendingReturnBooking,
      activeIncident,
      floor: extractFloor(u.floorLevel) || '1',
      zone: getUnitZone(u),
    }
  }

  // Discover distinct floors and zones dynamically
  const availableFloors = useMemo(() => {
    const floorSet = new Set<string>()
    units.forEach((u) => {
      const fl = extractFloor(u.floorLevel)
      if (fl) floorSet.add(fl)
    })
    if (floorSet.size === 0) {
      floorSet.add('1')
      floorSet.add('2')
    }
    return Array.from(floorSet).sort((a, b) => {
      const numA = parseInt(a, 10)
      const numB = parseInt(b, 10)
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB
      return a.localeCompare(b)
    })
  }, [units])

  const availableZones = useMemo(() => {
    const zoneSet = new Set<string>()
    units.forEach((u) => zoneSet.add(getUnitZone(u)))
    return Array.from(zoneSet).sort()
  }, [units])

  // Real-time Metrics Counters: Đảm bảo không cộng dồn chồng chéo sự cố vào các nhóm loại trừ nhau
  const metrics = useMemo(() => {
    let total = units.length
    let available = 0
    let occupied = 0
    let reserved = 0
    let returnPending = 0
    let maintenance = 0
    let overdueLocked = 0
    let activeIncidents = 0

    units.forEach((u) => {
      const { primaryStatus, hasActiveIncident } = getUnitOperationalInfo(u)
      if (primaryStatus === 'AVAILABLE') available++
      else if (primaryStatus === 'OCCUPIED') occupied++
      else if (primaryStatus === 'RESERVED') reserved++
      else if (primaryStatus === 'RETURN_PENDING') returnPending++
      else if (primaryStatus === 'MAINTENANCE') maintenance++
      else if (primaryStatus === 'OVERDUE_LOCKED') overdueLocked++

      if (hasActiveIncident) activeIncidents++
    })

    return { total, available, occupied, reserved, returnPending, maintenance, overdueLocked, activeIncidents }
  }, [units, arrivals, activeRentals, tickets])

  // Filter units
  const filteredUnits = useMemo(() => {
    return units.filter((u) => {
      const { primaryStatus, hasActiveIncident, floor, zone } = getUnitOperationalInfo(u)

      // 1. Floor filter
      if (selectedFloor !== 'all' && floor !== selectedFloor) return false

      // 2. Zone filter
      if (selectedZone !== 'all' && zone !== selectedZone) return false

      // 3. Status filter
      if (selectedStatus !== 'all') {
        if (selectedStatus === 'INCIDENT') {
          if (!hasActiveIncident) return false
        } else if (primaryStatus !== selectedStatus) {
          return false
        }
      }

      // 4. Size filter
      if (selectedSize !== 'all') {
        const area = u.areaSqMeters || (u.unitTypeName?.includes('1m') ? 1 : u.unitTypeName?.includes('3m') ? 3 : 6)
        if (selectedSize === 's' && area > 6.5) return false
        if (selectedSize === 'm' && (area <= 6.5 || area > 12)) return false
        if (selectedSize === 'l' && (area <= 12 || area > 20)) return false
        if (selectedSize === 'commercial' && area <= 20) return false
      }

      // 5. Search query (unitCode, tenantName)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const codeMatch = (u.unitCode || '').toLowerCase().includes(q)
        const tenantMatch = (u.tenantName || '').toLowerCase().includes(q)
        if (!codeMatch && !tenantMatch) return false
      }

      return true
    })
  }, [units, selectedFloor, selectedZone, selectedStatus, selectedSize, searchQuery, arrivals, activeRentals, tickets])

  // Toggle Maintenance handler (Staff and Manager permission)
  const handleToggleMaintenance = async (unit: StorageUnit) => {
    const isCurrentlyMaint = unit.status === 'MAINTENANCE' || unit.status === 'UNDER_MAINTENANCE'
    if (!isCurrentlyMaint && !showMaintInputForm) {
      const roleLabel = userRole === 'STAFF' ? 'Nhân viên cơ sở' : 'Quản lý cơ sở'
      setMaintByInput(`${user?.fullName || user?.username || 'Nhân sự cơ sở'} (${roleLabel})`)
      setMaintReasonInput('')
      setActionMessage(null)
      setShowMaintInputForm(true)
      return
    }

    if (!isCurrentlyMaint) {
      if (!maintByInput.trim()) {
        setActionMessage({ type: 'error', text: 'Vui lòng nhập tên người thực hiện / phụ trách bảo trì.' })
        return
      }
      if (!maintReasonInput.trim()) {
        setActionMessage({ type: 'error', text: 'Vui lòng nhập lý do bảo trì kỹ thuật.' })
        return
      }
    }

    try {
      setIsTogglingMaintenance(true)
      setActionMessage(null)
      const updated = await storageUnitService.toggleMaintenance(
        unit.id,
        !isCurrentlyMaint ? { reason: maintReasonInput.trim(), maintenanceBy: maintByInput.trim() } : undefined
      )
      setShowMaintInputForm(false)
      if (onUnitMaintenanceToggled) {
        onUnitMaintenanceToggled(updated)
      }
      setSelectedUnit(updated)
      setActionMessage({
        type: 'success',
        text: `Đã ${updated.status === 'MAINTENANCE' || updated.status === 'UNDER_MAINTENANCE' ? 'chuyển sang' : 'hoàn tất'} chế độ bảo trì cho kho #${unit.unitCode}`,
      })
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err?.response?.data?.message || 'Không thể thay đổi trạng thái bảo trì. Vui lòng kiểm tra quyền.',
      })
    } finally {
      setIsTogglingMaintenance(false)
    }
  }

  const isManager = userRole === 'FACILITY_MANAGER' || userRole === 'ADMIN' || userRole === 'BUSINESS_MANAGER'

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
      {/* 1. Header with Title & Operational Badges */}
      <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-600 text-white flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-[20px]">grid_view</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-headline text-sm font-bold text-slate-900">
                  Sơ Đồ Tổ Chức Buồng Kho &amp; Thiết Bị
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-800 font-mono">
                  {facilityName}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  isManager ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                }`}>
                  {isManager ? 'Quản lý cơ sở' : 'Nhân viên quầy'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Ma trận tổ chức không gian lưu trữ theo tầng và phân khu quản lý tại cơ sở (Logical Organization Matrix)
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs font-mono font-bold text-slate-700">
              {filteredUnits.length} / {units.length} lô kho
            </span>
            <span className="text-[10px] text-slate-400 block">Dữ liệu thực tế cơ sở</span>
          </div>
        </div>

        {/* 2. Real-time Summary Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 pt-2 text-xs">
          <div
            onClick={() => setSelectedStatus('all')}
            className={`p-2 rounded-xl border text-center transition cursor-pointer ${
              selectedStatus === 'all'
                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <span className="text-[10px] uppercase font-bold tracking-tight block">Tổng số kho</span>
            <span className="text-base font-extrabold font-mono mt-0.5 block">{metrics.total}</span>
          </div>

          <div
            onClick={() => setSelectedStatus(selectedStatus === 'AVAILABLE' ? 'all' : 'AVAILABLE')}
            className={`p-2 rounded-xl border text-center transition cursor-pointer ${
              selectedStatus === 'AVAILABLE'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                : 'bg-white text-emerald-800 border-slate-200 hover:bg-emerald-50/60'
            }`}
          >
            <span className="text-[10px] uppercase font-bold tracking-tight block">Trống sẵn sàng</span>
            <span className="text-base font-extrabold font-mono text-emerald-600 mt-0.5 block ${selectedStatus === 'AVAILABLE' ? 'text-white' : ''}">
              {metrics.available}
            </span>
          </div>

          <div
            onClick={() => setSelectedStatus(selectedStatus === 'OCCUPIED' ? 'all' : 'OCCUPIED')}
            className={`p-2 rounded-xl border text-center transition cursor-pointer ${
              selectedStatus === 'OCCUPIED'
                ? 'bg-slate-700 text-white border-slate-700 shadow-xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <span className="text-[10px] uppercase font-bold tracking-tight block">Đang thuê</span>
            <span className="text-base font-extrabold font-mono mt-0.5 block">{metrics.occupied}</span>
          </div>

          <div
            onClick={() => setSelectedStatus(selectedStatus === 'RESERVED' ? 'all' : 'RESERVED')}
            className={`p-2 rounded-xl border text-center transition cursor-pointer ${
              selectedStatus === 'RESERVED'
                ? 'bg-cyan-600 text-white border-cyan-600 shadow-xs'
                : 'bg-white text-cyan-800 border-slate-200 hover:bg-cyan-50/60'
            }`}
          >
            <span className="text-[10px] uppercase font-bold tracking-tight block">Chờ bàn giao</span>
            <span className="text-base font-extrabold font-mono text-cyan-600 mt-0.5 block ${selectedStatus === 'RESERVED' ? 'text-white' : ''}">
              {metrics.reserved}
            </span>
          </div>

          <div
            onClick={() => setSelectedStatus(selectedStatus === 'RETURN_PENDING' ? 'all' : 'RETURN_PENDING')}
            className={`p-2 rounded-xl border text-center transition cursor-pointer ${
              selectedStatus === 'RETURN_PENDING'
                ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                : 'bg-white text-amber-800 border-slate-200 hover:bg-amber-50/60'
            }`}
          >
            <span className="text-[10px] uppercase font-bold tracking-tight block">Chờ trả kho</span>
            <span className="text-base font-extrabold font-mono text-amber-600 mt-0.5 block ${selectedStatus === 'RETURN_PENDING' ? 'text-white' : ''}">
              {metrics.returnPending}
            </span>
          </div>

          <div
            onClick={() => setSelectedStatus(selectedStatus === 'MAINTENANCE' ? 'all' : 'MAINTENANCE')}
            className={`p-2 rounded-xl border text-center transition cursor-pointer ${
              selectedStatus === 'MAINTENANCE'
                ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                : 'bg-white text-purple-800 border-slate-200 hover:bg-purple-50/60'
            }`}
          >
            <span className="text-[10px] uppercase font-bold tracking-tight block">Đang bảo trì</span>
            <span className="text-base font-extrabold font-mono text-purple-600 mt-0.5 block ${selectedStatus === 'MAINTENANCE' ? 'text-white' : ''}">
              {metrics.maintenance}
            </span>
          </div>

          <div
            onClick={() => setSelectedStatus(selectedStatus === 'INCIDENT' ? 'all' : 'INCIDENT')}
            className={`p-2 rounded-xl border text-center transition cursor-pointer col-span-2 sm:col-span-1 ${
              selectedStatus === 'INCIDENT'
                ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                : 'bg-white text-rose-800 border-slate-200 hover:bg-rose-50/60'
            }`}
            title="Số lô kho đang phát sinh sự cố hoặc khóa quá hạn (Trạng thái song song, không loại trừ trạng thái thuê)"
          >
            <span className="text-[10px] uppercase font-bold tracking-tight block">Cảnh báo sự cố</span>
            <span className="text-base font-extrabold font-mono text-rose-600 mt-0.5 block ${selectedStatus === 'INCIDENT' ? 'text-white' : ''}">
              {metrics.activeIncidents}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Multi-dimensional Filters Toolbar */}
      <div className="p-3 bg-white border-b border-slate-100 flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-[280px]">
          {/* Tầng Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg text-xs">
            <span className="text-slate-500 font-medium">Tầng:</span>
            <select
              value={selectedFloor}
              onChange={(e) => setSelectedFloor(e.target.value)}
              className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="all">Tất cả tầng</option>
              {availableFloors.map((fl) => (
                <option key={fl} value={fl}>
                  Tầng {fl}
                </option>
              ))}
            </select>
          </div>

          {/* Phân khu Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg text-xs">
            <span className="text-slate-500 font-medium">Khu:</span>
            <select
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
              className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="all">Tất cả khu</option>
              {availableZones.map((zn) => (
                <option key={zn} value={zn}>
                  {zn}
                </option>
              ))}
            </select>
          </div>

          {/* Trạng thái Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg text-xs">
            <span className="text-slate-500 font-medium">Trạng thái:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="AVAILABLE">Kho trống ({metrics.available})</option>
              <option value="OCCUPIED">Đang thuê ({metrics.occupied})</option>
              <option value="RESERVED">Chờ bàn giao ({metrics.reserved})</option>
              <option value="RETURN_PENDING">Chờ trả kho ({metrics.returnPending})</option>
              <option value="OVERDUE_LOCKED">Quá hạn ({units.filter(u => u.status === 'OVERDUE_LOCKED').length})</option>
              <option value="MAINTENANCE">Đang bảo trì ({metrics.maintenance})</option>
              <option value="INCIDENT">Cảnh báo sự cố ({metrics.activeIncidents})</option>
            </select>
          </div>

          {/* Kích thước Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg text-xs">
            <span className="text-slate-500 font-medium">Loại kho:</span>
            <select
              value={selectedSize}
              onChange={(e) => setSelectedSize(e.target.value)}
              className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="all">Tất cả kích cỡ</option>
              <option value="s">Nhỏ S (≤ 6.5m²)</option>
              <option value="m">Vừa M (8m² - 12m²)</option>
              <option value="l">Lớn L (15m² - 20m²)</option>
              <option value="commercial">Thương mại (&gt; 20m²)</option>
            </select>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 min-w-[160px]">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px] text-slate-400">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm mã kho (#TB-A101)..."
              className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 text-slate-900 text-xs rounded-lg border border-slate-200 focus:outline-none focus:bg-white font-mono"
            />
          </div>
        </div>

        {/* Clear Filters Button */}
        {(selectedFloor !== 'all' || selectedZone !== 'all' || selectedStatus !== 'all' || selectedSize !== 'all' || searchQuery.trim() !== '') && (
          <button
            type="button"
            onClick={() => {
              setSelectedFloor('all')
              setSelectedZone('all')
              setSelectedStatus('all')
              setSelectedSize('all')
              setSearchQuery('')
            }}
            className="text-xs text-blue-600 hover:text-blue-800 font-semibold px-2 py-1 rounded hover:bg-blue-50 transition cursor-pointer flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[14px]">refresh</span>
            <span>Đặt lại bộ lọc</span>
          </button>
        )}
      </div>

      {/* 4. Visual Storage Unit Grid Matrix */}
      <div className="p-4 bg-slate-100/70 overflow-y-auto max-h-[560px]">
        {filteredUnits.length === 0 ? (
          <div className="p-10 text-center text-slate-400">
            <span className="material-symbols-outlined text-4xl text-slate-300 mb-1 block">warehouse</span>
            <p className="font-semibold text-slate-600 text-xs">Không tìm thấy ngăn kho phù hợp</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Vui lòng điều chỉnh tiêu chí lọc tầng, phân khu hoặc từ khóa tìm kiếm</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
            {filteredUnits.map((unit) => {
              const { label, badgeBg, cardBorder, pendingHandoverBooking, activeIncident, floor, zone } =
                getUnitOperationalInfo(unit)

              return (
                <div
                  key={unit.id}
                  onClick={() => {
                    setSelectedUnit(unit)
                    setActionMessage(null)
                  }}
                  className={`p-3 rounded-xl bg-white border shadow-2xs transition-all cursor-pointer flex flex-col justify-between group ${cardBorder}`}
                >
                  <div>
                    {/* Unit Code & Status Badge */}
                    <div className="flex items-start justify-between gap-1 mb-1.5">
                      <span className="font-mono text-xs font-extrabold text-slate-900 group-hover:text-blue-600 transition-colors">
                        #{unit.unitCode}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${badgeBg}`}>
                        {label}
                      </span>
                    </div>

                    {/* Floor & Zone */}
                    <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                      <span>Tầng {floor}</span>
                      <span>•</span>
                      <span>{zone}</span>
                    </div>

                    {/* Size & Dimensions */}
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                      {unit.areaSqMeters || (unit.unitTypeName?.includes('1m') ? 1 : 3)} m² •{' '}
                      {unit.unitTypeName || 'Tiêu chuẩn'}
                    </div>
                  </div>

                  {/* Footer Indicators (IoT Battery, Lock & Action Icon) */}
                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                    <div className="flex items-center gap-1.5 font-mono">
                      {unit.smartLockSerial ? (
                        <span
                          className="material-symbols-outlined text-[13px] text-emerald-600"
                          title={`SmartLock S/N: ${unit.smartLockSerial}`}
                        >
                          lock
                        </span>
                      ) : (
                        <span
                          className="material-symbols-outlined text-[13px] text-slate-400"
                          title="Khóa cơ / Chưa kết nối Gateway IoT"
                        >
                          key
                        </span>
                      )}
                      {unit.batteryLevel ? (
                        <span
                          className="material-symbols-outlined text-[13px] text-emerald-600"
                          title={`Pin IoT: ${unit.batteryLevel}`}
                        >
                          battery_std
                        </span>
                      ) : null}
                      {activeIncident && (
                        <span
                          className="material-symbols-outlined text-[13px] text-rose-600 animate-pulse"
                          title="Lô kho có cảnh báo sự cố kỹ thuật hoặc khóa quá hạn"
                        >
                          warning
                        </span>
                      )}
                    </div>

                    <span className="text-blue-600 font-bold group-hover:underline text-[10px]">
                      {pendingHandoverBooking ? 'Bàn giao' : 'Chi tiết'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 5. Storage Unit Detail Modal (Respects Role Permissions) */}
      {selectedUnit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-cyan-600 text-white flex items-center justify-center font-mono font-bold text-sm">
                  #{selectedUnit.unitCode.slice(-3)}
                </div>
                <div>
                  <h4 className="font-headline font-bold text-base text-slate-900">
                    Chi Tiết Ngăn Kho #{selectedUnit.unitCode}
                  </h4>
                  <p className="text-xs text-slate-500 font-mono">
                    {facilityName} • Tầng {extractFloor(selectedUnit.floorLevel) || '1'} • {getUnitZone(selectedUnit)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedUnit(null)}
                className="w-8 h-8 rounded-lg hover:bg-slate-200 text-slate-500 flex items-center justify-center transition cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 space-y-4 max-h-[70vh] overflow-y-auto text-xs">
              {actionMessage && (
                <div
                  className={`p-3 rounded-xl border text-xs font-medium flex items-center gap-2 ${
                    actionMessage.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border-rose-200'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {actionMessage.type === 'success' ? 'check_circle' : 'error'}
                  </span>
                  <span>{actionMessage.text}</span>
                </div>
              )}

              {/* Technical Specifications */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200 font-mono">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">Diện tích</span>
                  <span className="text-sm font-bold text-slate-900">
                    {selectedUnit.areaSqMeters || (selectedUnit.unitTypeName?.includes('1m') ? 1 : 3)} m²
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">Loại ngăn</span>
                  <span className="text-sm font-bold text-slate-900">{selectedUnit.unitTypeName || 'Tiêu chuẩn'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">Giá niêm yết</span>
                  <span className="text-sm font-bold text-blue-600">
                    {(selectedUnit.pricePerMonth || 0).toLocaleString('vi-VN')}đ/th
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">SmartLock S/N</span>
                  <span className="text-xs font-bold text-slate-700">
                    {selectedUnit.smartLockSerial || 'Chưa gắn IoT (Khóa cơ)'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">Pin IoT</span>
                  <span className="text-xs font-bold text-slate-700">
                    {selectedUnit.batteryLevel ? selectedUnit.batteryLevel : 'Chưa có dữ liệu'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">Trạng thái</span>
                  <span className="text-xs font-bold text-slate-900">{selectedUnit.status}</span>
                </div>
              </div>

              {/* Booking & Handover Relationship Info */}
              {(() => {
                const { pendingHandoverBooking, pendingReturnBooking, activeIncident } =
                  getUnitOperationalInfo(selectedUnit)

                return (
                  <div className="space-y-3">
                    {pendingHandoverBooking && (
                      <div className="p-3.5 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-900">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-xs uppercase flex items-center gap-1 text-cyan-800">
                            <span className="material-symbols-outlined text-[16px]">how_to_reg</span>
                            Khách Hàng Đặt Chỗ Chờ Bàn Giao
                          </span>
                          <span className="font-mono font-bold text-xs">{pendingHandoverBooking.bookingCode}</span>
                        </div>
                        <p className="text-xs font-medium text-slate-800">
                          Khách: <strong>{pendingHandoverBooking.customerName || 'N/A'}</strong> (
                          {pendingHandoverBooking.customerPhone || 'N/A'})
                        </p>
                        <p className="text-[11px] text-slate-600 mt-0.5">
                          Ngày bắt đầu thuê: {pendingHandoverBooking.startDate} • Cọc đã đóng:{' '}
                          {(pendingHandoverBooking.depositPaid || 0).toLocaleString('vi-VN')}đ
                        </p>
                        {onSelectBookingForHandover && (
                          <button
                            type="button"
                            onClick={() => {
                              onSelectBookingForHandover(pendingHandoverBooking.id)
                              setSelectedUnit(null)
                              document.getElementById('handover-workbench')?.scrollIntoView({ behavior: 'smooth' })
                            }}
                            className="mt-2.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[16px]">touch_app</span>
                            <span>Tiếp đón &amp; Đối soát tại bàn làm việc</span>
                          </button>
                        )}
                      </div>
                    )}

                    {pendingReturnBooking && (
                      <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
                        <span className="font-bold text-xs uppercase block text-amber-800">
                          Đơn Thuê Đang Chờ Nghiệm Thu Trả Kho
                        </span>
                        <p className="text-xs font-medium mt-1">
                          Khách: {pendingReturnBooking.customerName} • Mã đơn: #{pendingReturnBooking.bookingCode}
                        </p>
                      </div>
                    )}

                    {activeIncident && (
                      <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900">
                        <span className="font-bold text-xs uppercase flex items-center gap-1 text-rose-800">
                          <span className="material-symbols-outlined text-[16px]">error</span>
                          Sự Cố Kỹ Thuật Đang Xử Lý: {activeIncident.id}
                        </span>
                        <p className="text-xs font-medium mt-1">{activeIncident.title}</p>
                      </div>
                    )}

                    {(selectedUnit.status === 'MAINTENANCE' || selectedUnit.status === 'UNDER_MAINTENANCE') && (
                      <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-950 space-y-1.5">
                        <span className="font-bold text-xs uppercase flex items-center gap-1.5 text-purple-800">
                          <span className="material-symbols-outlined text-[16px]">engineering</span>
                          Thông Tin Bảo Trì Kỹ Thuật
                        </span>
                        <p className="text-xs">
                          Người bảo trì: <strong>{selectedUnit.maintenanceBy || 'Kỹ thuật viên cơ sở'}</strong>
                        </p>
                        <p className="text-xs">
                          Lý do bảo trì: <strong>{selectedUnit.maintenanceReason || 'Bảo trì kỹ thuật định kỳ'}</strong>
                        </p>
                        {selectedUnit.maintenanceAt && (
                          <p className="font-mono text-[11px] text-purple-700">
                            Thời điểm bắt đầu: {new Date(selectedUnit.maintenanceAt).toLocaleString('vi-VN')}
                          </p>
                        )}
                      </div>
                    )}

                    {showMaintInputForm && selectedUnit.status === 'AVAILABLE' && (
                      <div className="p-3.5 rounded-xl bg-purple-50/80 border border-purple-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs uppercase text-purple-900 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[16px]">build_circle</span>
                            Nhập Thông Tin Chuyển Bảo Trì Kỹ Thuật
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowMaintInputForm(false)}
                            className="text-[11px] text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
                          >
                            Đóng
                          </button>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Người bảo trì / Phụ trách <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={maintByInput}
                            onChange={(e) => setMaintByInput(e.target.value)}
                            placeholder="Nhập tên người bảo trì..."
                            className="w-full px-3 py-2 rounded-lg border border-purple-300 bg-white text-xs text-slate-900 outline-none focus:border-purple-600"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Lý do bảo trì <span className="text-rose-500">*</span>
                          </label>
                          <textarea
                            rows={2}
                            value={maintReasonInput}
                            onChange={(e) => setMaintReasonInput(e.target.value)}
                            placeholder="Ghi rõ lý do bảo trì hoặc sự cố kỹ thuật..."
                            className="w-full p-2.5 rounded-lg border border-purple-300 bg-white text-xs text-slate-900 outline-none focus:border-purple-600 resize-none"
                          />
                        </div>
                      </div>
                    )}

                    {selectedUnit.status === 'OCCUPIED' && !pendingHandoverBooking && (
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700">
                        <span className="font-bold text-xs uppercase block text-slate-800">
                          Hợp Đồng Thuê Hiệu Lực
                        </span>
                        <div className="mt-1 space-y-0.5 text-xs">
                          <p>
                            Khách thuê: <strong>{selectedUnit.tenantName || 'Khách hàng Boxora'}</strong>
                          </p>
                          <p className="font-mono text-[11px] text-slate-500">
                            Mã HĐ: {selectedUnit.contractCode || 'HĐ-BX-2026'} • Hạn đến: {selectedUnit.dueDate || 'N/A'}
                          </p>
                          <p className="text-[10px] text-slate-400 italic mt-1">
                            Lưu ý bảo mật: Mã PIN và thông tin hợp đồng chi tiết chỉ được giải mã trong quy trình xác minh chính chủ.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Staff vs Manager Permission Matrix Note */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-500">
                <span className="font-bold text-slate-700 block mb-0.5">Phân quyền vận hành:</span>
                {isManager ? (
                  <span>
                    Bạn đang đăng nhập với vai trò <strong>Quản lý cơ sở (Facility Manager)</strong>. Bạn có quyền cấu hình thông số, đưa kho vào bảo trì và quản lý thiết bị cơ sở.
                  </span>
                ) : (
                  <span>
                    Bạn đang thao tác với vai trò <strong>Nhân viên quầy (Facility Staff)</strong>. Bạn có quyền tiếp đón khách và tạo báo cáo sự cố. Quyền phê duyệt chuyển trạng thái bảo trì kho thuộc Quản lý cơ sở (Facility Manager).
                  </span>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                {/* Toggle Maintenance (Manager Only) */}
                {isManager ? (
                  <button
                    type="button"
                    disabled={isTogglingMaintenance}
                    onClick={() => handleToggleMaintenance(selectedUnit)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                      selectedUnit.status === 'MAINTENANCE' || selectedUnit.status === 'UNDER_MAINTENANCE'
                        ? 'bg-purple-100 hover:bg-purple-200 text-purple-800'
                        : 'bg-purple-600 hover:bg-purple-700 text-white shadow-xs'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">build</span>
                    <span>
                      {isTogglingMaintenance
                        ? 'Đang cập nhật...'
                        : selectedUnit.status === 'MAINTENANCE' || selectedUnit.status === 'UNDER_MAINTENANCE'
                        ? 'Hoàn tất bảo trì'
                        : 'Đưa vào bảo trì'}
                    </span>
                  </button>
                ) : (
                  <span className="text-[11px] text-slate-400 italic">
                    * Chuyển trạng thái bảo trì cần quyền Quản lý cơ sở.
                  </span>
                )}

                {/* Report Incident */}
                {onReportIncident && (
                  <button
                    type="button"
                    onClick={() => {
                      onReportIncident(selectedUnit)
                      setSelectedUnit(null)
                    }}
                    className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">report_problem</span>
                    <span>Báo sự cố</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setSelectedUnit(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
