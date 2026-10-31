import React, { useState } from 'react'
import {
  Layers,
  ChevronRight,
  ChevronDown,
  Building2,
  Box,
  Compass,
  CheckCircle2,
  AlertTriangle,
  Info,
  Maximize2,
} from 'lucide-react'
import { FacilityFloor, FacilityZone, FacilityFunctionalArea } from '../../types'
import {
  ZONE_TYPE_OPTIONS,
  FUNCTIONAL_AREA_TYPE_OPTIONS,
  calculateFloorAllocation,
} from '../../utils/facilityLayout'

interface FloorPlanHierarchyPreviewProps {
  floors: FacilityFloor[]
  facilityName?: string
  facilityCode?: string
  physicalUnits?: any[]
}

export const FloorPlanHierarchyPreview: React.FC<FloorPlanHierarchyPreviewProps> = ({
  floors,
  facilityName = 'Chi nhánh Boxora',
  facilityCode = 'BOXORA',
  physicalUnits = [],
}) => {
  const [selectedFloorId, setSelectedFloorId] = useState<string>(
    floors.length > 0 ? floors[0].id : ''
  )
  const [viewMode, setViewMode] = useState<'TREE' | 'FLOOR_GRID'>('TREE')
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>(() => {
    // Default expand all floors
    const map: Record<string, boolean> = { root: true }
    floors.forEach((f) => {
      map[f.id] = true
    })
    return map
  })

  // Ensure selected floor is valid
  const currentFloor =
    floors.find((f) => f.id === selectedFloorId) || (floors.length > 0 ? floors[0] : null)

  const toggleNode = (id: string) => {
    setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  // Count physical storage units assigned to each floor
  const getPhysicalUnitsForFloor = (floor: FacilityFloor) => {
    if (!physicalUnits || physicalUnits.length === 0) return []
    const fCode = floor.code.toLowerCase()
    const fName = floor.name.toLowerCase()
    return physicalUnits.filter((u) => {
      const fl = (u.floorLevel || '').trim().toLowerCase()
      return (
        fl === fCode ||
        fl === fName ||
        fl === String(floor.floorNumber) ||
        fl === `tầng ${floor.floorNumber}`
      )
    })
  }

  const totalFacilityArea = floors.reduce((s, f) => s + (Number(f.totalArea) || 0), 0)
  const totalZonesCount = floors.reduce((s, f) => s + f.zones.length, 0)
  const totalFunctionalAreasCount = floors.reduce((s, f) => s + f.functionalAreas.length, 0)

  if (floors.length === 0) {
    return (
      <div className="p-8 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 text-slate-500 space-y-2">
        <Layers className="w-9 h-9 mx-auto text-slate-400" />
        <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300">
          Chưa có dữ liệu tầng nào để xem trước
        </h5>
        <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
          Vui lòng thêm ít nhất một tầng và cấu hình phân khu để xem trước cấu trúc phân cấp mặt bằng.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Top Controls & Summary Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-700 text-white shadow-xs">
            <Building2 size={20} />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                {facilityName}
              </h4>
              <span className="px-2 py-0.5 rounded-md bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-800 text-[10px] font-mono font-bold text-cyan-800 dark:text-cyan-300 uppercase">
                {facilityCode}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Quy mô: <strong>{floors.length} tầng</strong> • Tổng diện tích sàn:{' '}
              <strong className="text-slate-800 dark:text-slate-200">
                {totalFacilityArea.toLocaleString('vi-VN')} m²
              </strong>{' '}
              • <strong>{totalZonesCount}</strong> phân khu •{' '}
              <strong>{totalFunctionalAreasCount}</strong> khu vực chức năng
            </p>
          </div>
        </div>

        {/* View mode toggle buttons */}
        <div className="flex items-center gap-1.5 self-end sm:self-auto bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0">
          <button
            type="button"
            onClick={() => setViewMode('TREE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'TREE'
                ? 'bg-white dark:bg-slate-900 text-cyan-800 dark:text-cyan-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">account_tree</span>
            <span>Cây phân cấp</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('FLOOR_GRID')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'FLOOR_GRID'
                ? 'bg-white dark:bg-slate-900 text-cyan-800 dark:text-cyan-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">view_quilt</span>
            <span>Xem theo tầng</span>
          </button>
        </div>
      </div>

      {/* VIEW 1: CÂY PHÂN CẤP (TREE VIEW) */}
      {viewMode === 'TREE' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 font-sans text-xs space-y-3 shadow-xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-cyan-600">device_hub</span>
              <strong>Sơ đồ cấu trúc phân tầng chi nhánh (Branch Hierarchy Tree)</strong>
            </span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-blue-700 dark:text-blue-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                Phân khu kho (Zones)
              </span>
              <span className="flex items-center gap-1 text-teal-700 dark:text-teal-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-teal-500" />
                Khu chức năng (Functional Areas)
              </span>
            </div>
          </div>

          <div className="space-y-2 pl-1">
            {/* Facility Root Node */}
            <div className="space-y-2">
              <div
                onClick={() => toggleNode('root')}
                className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition select-none"
              >
                {expandedNodes['root'] ? (
                  <ChevronDown size={15} className="text-slate-500" />
                ) : (
                  <ChevronRight size={15} className="text-slate-500" />
                )}
                <Building2 size={16} className="text-cyan-700 dark:text-cyan-400 shrink-0" />
                <span className="font-extrabold text-slate-900 dark:text-white">
                  {facilityName} ({facilityCode})
                </span>
                <span className="ml-auto text-[11px] text-slate-500 font-mono">
                  {floors.length} tầng • {totalFacilityArea} m²
                </span>
              </div>

              {expandedNodes['root'] && (
                <div className="pl-6 border-l-2 border-dashed border-slate-200 dark:border-slate-800 space-y-3 pt-1">
                  {floors.map((floor) => {
                    const isFloorExpanded = !!expandedNodes[floor.id]
                    const alloc = calculateFloorAllocation(floor)
                    const floorUnits = getPhysicalUnitsForFloor(floor)

                    return (
                      <div key={floor.id} className="space-y-2">
                        {/* Floor Node */}
                        <div
                          onClick={() => toggleNode(floor.id)}
                          className="flex items-center justify-between gap-2 p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-cyan-400 dark:hover:border-cyan-700 cursor-pointer transition select-none shadow-2xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {isFloorExpanded ? (
                              <ChevronDown size={14} className="text-slate-400 shrink-0" />
                            ) : (
                              <ChevronRight size={14} className="text-slate-400 shrink-0" />
                            )}
                            <Layers size={15} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                            <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                              {floor.name}
                            </span>
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              {floor.code}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-[11px] shrink-0">
                            <span className="font-mono text-cyan-800 dark:text-cyan-300 font-bold">
                              {floor.totalArea} m²
                            </span>
                            <span className="text-slate-400">•</span>
                            <span className="text-slate-500">
                              {floor.zones.length} phân khu, {floor.functionalAreas.length} khu CN
                            </span>
                            {floorUnits.length > 0 && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                                {floorUnits.length} kho vật lý
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Floor Children: Zones & Functional Areas */}
                        {isFloorExpanded && (
                          <div className="pl-6 border-l-2 border-dashed border-slate-200 dark:border-slate-800 space-y-1.5 pt-1 pb-1">
                            {/* Zones Group */}
                            {floor.zones.length > 0 && (
                              <div className="space-y-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 block px-1">
                                  Phân khu lưu trữ ({floor.zones.length})
                                </span>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                                  {floor.zones.map((zone) => {
                                    const typeOpt =
                                      ZONE_TYPE_OPTIONS.find((t) => t.type === zone.zoneType) ||
                                      ZONE_TYPE_OPTIONS[1]
                                    return (
                                      <div
                                        key={zone.id}
                                        className="flex items-center justify-between p-2 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 text-xs"
                                      >
                                        <div className="flex items-center gap-2 min-w-0">
                                          <span className="material-symbols-outlined text-[15px] text-blue-600 dark:text-blue-400 shrink-0">
                                            {typeOpt.icon}
                                          </span>
                                          <div className="min-w-0">
                                            <p className="font-bold text-slate-800 dark:text-slate-200 truncate" title={zone.name}>
                                              {zone.name}
                                            </p>
                                            <p className="text-[10px] text-blue-700 dark:text-blue-300 font-mono">
                                              {zone.code} • {typeOpt.label}
                                            </p>
                                          </div>
                                        </div>
                                        <span className="font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300 shrink-0 ml-2">
                                          {zone.area} m²
                                        </span>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Functional Areas Group */}
                            {floor.functionalAreas.length > 0 && (
                              <div className="space-y-1 pt-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400 block px-1">
                                  Khu vực chức năng &amp; Vận hành ({floor.functionalAreas.length})
                                </span>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                                  {floor.functionalAreas.map((fa) => {
                                    const typeOpt =
                                      FUNCTIONAL_AREA_TYPE_OPTIONS.find(
                                        (t) => t.type === fa.areaType
                                      ) || FUNCTIONAL_AREA_TYPE_OPTIONS[0]
                                    return (
                                      <div
                                        key={fa.id}
                                        className="flex items-center justify-between p-2 rounded-lg bg-teal-50/50 dark:bg-teal-950/20 border border-teal-200/60 dark:border-teal-900/40 text-xs"
                                      >
                                        <div className="flex items-center gap-2 min-w-0">
                                          <span className="material-symbols-outlined text-[15px] text-teal-600 dark:text-teal-400 shrink-0">
                                            {typeOpt.icon}
                                          </span>
                                          <div className="min-w-0">
                                            <p className="font-bold text-slate-800 dark:text-slate-200 truncate" title={fa.name}>
                                              {fa.name}
                                            </p>
                                            <p className="text-[10px] text-teal-700 dark:text-teal-300 font-mono">
                                              {fa.code} • {typeOpt.label}
                                            </p>
                                          </div>
                                        </div>
                                        {fa.area ? (
                                          <span className="font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300 shrink-0 ml-2">
                                            {fa.area} m²
                                          </span>
                                        ) : (
                                          <span className="text-[9px] text-slate-400 italic shrink-0">
                                            Không diện tích
                                          </span>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: XEM CHI TIẾT THEO TẦNG (FLOOR DETAIL GRID) */}
      {viewMode === 'FLOOR_GRID' && currentFloor && (
        <div className="space-y-4">
          {/* Floor Selector Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {floors.map((floor) => {
              const isSelected = floor.id === currentFloor.id
              return (
                <button
                  key={floor.id}
                  type="button"
                  onClick={() => setSelectedFloorId(floor.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 flex items-center gap-2 ${
                    isSelected
                      ? 'bg-cyan-700 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <Layers size={14} />
                  <span>{floor.name}</span>
                  <span className="font-mono text-[10px] opacity-80">({floor.code})</span>
                </button>
              )
            })}
          </div>

          {/* Current Floor Card */}
          {(() => {
            const alloc = calculateFloorAllocation(currentFloor)
            const floorUnits = getPhysicalUnitsForFloor(currentFloor)

            return (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-xs">
                {/* Floor Header Info */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                        {currentFloor.name}
                      </h4>
                      <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                        {currentFloor.code}
                      </span>
                    </div>
                    {currentFloor.description && (
                      <p className="text-xs text-slate-500 mt-0.5 italic">
                        "{currentFloor.description}"
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs shrink-0 flex-wrap">
                    <div className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-center">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Tổng diện tích sàn</span>
                      <strong className="text-sm font-mono text-slate-900 dark:text-white">{alloc.totalArea} m²</strong>
                    </div>
                    {currentFloor.height && (
                      <div className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-center">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Chiều cao tầng</span>
                        <strong className="text-sm font-mono text-slate-900 dark:text-white">{currentFloor.height} m</strong>
                      </div>
                    )}
                    {currentFloor.loadCapacity && (
                      <div className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-center">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Tải trọng sàn</span>
                        <strong className="text-sm font-mono text-slate-900 dark:text-white">{currentFloor.loadCapacity} kg/m²</strong>
                      </div>
                    )}
                  </div>
                </div>

                {/* Area Allocation Progress Bar */}
                <div className="space-y-1.5 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      Tỷ lệ phân bổ diện tích sàn ({alloc.percentageAllocated}%)
                    </span>
                    <span className="font-mono text-xs text-slate-500">
                      Đã phân bổ: <strong>{alloc.allocatedArea} m²</strong> / {alloc.totalArea} m² (Còn trống:{' '}
                      <strong>{alloc.unallocatedArea} m²</strong>)
                    </span>
                  </div>

                  <div className="h-3 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden flex">
                    <div
                      style={{
                        width: `${alloc.totalArea > 0 ? (alloc.zoneAreaTotal / alloc.totalArea) * 100 : 0}%`,
                      }}
                      className="bg-blue-600 transition-all duration-300"
                      title={`Phân khu kho: ${alloc.zoneAreaTotal} m²`}
                    />
                    <div
                      style={{
                        width: `${alloc.totalArea > 0 ? (alloc.functionalAreaTotal / alloc.totalArea) * 100 : 0}%`,
                      }}
                      className="bg-teal-500 transition-all duration-300"
                      title={`Khu chức năng: ${alloc.functionalAreaTotal} m²`}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-blue-600" />
                        <span>Kho lưu trữ: <strong>{alloc.zoneAreaTotal} m²</strong></span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-teal-500" />
                        <span>Khu chức năng: <strong>{alloc.functionalAreaTotal} m²</strong></span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-slate-300 dark:bg-slate-600" />
                        <span>Chưa phân bổ: <strong>{alloc.unallocatedArea} m²</strong></span>
                      </span>
                    </div>

                    {alloc.isExceeded && (
                      <span className="text-rose-600 font-bold flex items-center gap-1">
                        <AlertTriangle size={13} />
                        Vượt quá diện tích sàn!
                      </span>
                    )}
                  </div>
                </div>

                {/* Section: Zones in Floor */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                      <Box size={14} className="text-blue-600" />
                      <span>Phân khu lưu trữ ({currentFloor.zones.length})</span>
                    </h5>
                  </div>

                  {currentFloor.zones.length === 0 ? (
                    <p className="text-xs text-slate-400 italic p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                      Tầng này chưa có phân khu kho nào.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {currentFloor.zones.map((zone) => {
                        const typeOpt =
                          ZONE_TYPE_OPTIONS.find((t) => t.type === zone.zoneType) ||
                          ZONE_TYPE_OPTIONS[1]
                        return (
                          <div
                            key={zone.id}
                            className="p-3 rounded-xl border border-blue-200/80 bg-blue-50/30 dark:border-blue-900/40 dark:bg-blue-950/20 space-y-2"
                          >
                            <div className="flex items-start justify-between gap-1.5">
                              <div>
                                <h6 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                                  {zone.name}
                                </h6>
                                <span className="font-mono text-[10px] font-bold text-blue-700 dark:text-blue-300">
                                  {zone.code}
                                </span>
                              </div>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200">
                                {zone.area} m²
                              </span>
                            </div>

                            <p className="text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px] text-blue-600">
                                {typeOpt.icon}
                              </span>
                              <span>{typeOpt.label}</span>
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Section: Functional Areas in Floor */}
                <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-teal-900 dark:text-teal-300 flex items-center gap-1.5">
                      <Compass size={14} className="text-teal-600" />
                      <span>Khu vực chức năng &amp; Vận hành ({currentFloor.functionalAreas.length})</span>
                    </h5>
                  </div>

                  {currentFloor.functionalAreas.length === 0 ? (
                    <p className="text-xs text-slate-400 italic p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                      Tầng này chưa khai báo khu vực chức năng.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {currentFloor.functionalAreas.map((fa) => {
                        const typeOpt =
                          FUNCTIONAL_AREA_TYPE_OPTIONS.find((t) => t.type === fa.areaType) ||
                          FUNCTIONAL_AREA_TYPE_OPTIONS[0]
                        const attrs = fa.attributes || {}
                        return (
                          <div
                            key={fa.id}
                            className="p-3 rounded-xl border border-teal-200/80 bg-teal-50/30 dark:border-teal-900/40 dark:bg-teal-950/20 space-y-1.5"
                          >
                            <div className="flex items-start justify-between gap-1.5">
                              <div>
                                <h6 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                                  {fa.name}
                                </h6>
                                <span className="font-mono text-[10px] font-bold text-teal-700 dark:text-teal-300">
                                  {fa.code}
                                </span>
                              </div>
                              {fa.area ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-200">
                                  {fa.area} m²
                                </span>
                              ) : null}
                            </div>

                            <p className="text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px] text-teal-600">
                                {typeOpt.icon}
                              </span>
                              <span>{typeOpt.label}</span>
                            </p>

                            {attrs.maxPayloadKg && (
                              <p className="text-[10px] text-purple-700 dark:text-purple-300 font-mono">
                                Tải trọng: {attrs.maxPayloadKg} kg
                              </p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* Realistic notice */}
      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 flex items-start gap-2">
        <Info size={15} className="text-cyan-600 shrink-0 mt-0.5" />
        <p>
          Hệ thống Boxora tổ chức sơ đồ mặt bằng logic theo chuẩn phân cấp: <strong>Cơ sở → Tầng → Phân khu → Khu vực chức năng</strong>. Khi cơ sở phát sinh các buồng kho vật lý (Storage Units), buồng kho sẽ được gán tương ứng theo tầng mà không làm ảnh hưởng đến cấu hình phân khu chung.
        </p>
      </div>
    </div>
  )
}
