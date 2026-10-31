import {
  FacilityFloorPlanConfig,
  FacilityFloor,
  FacilityZone,
  FacilityFunctionalArea,
  FacilityLayoutConfig,
  ZoneType,
  FunctionalAreaType,
} from '../types'

export const DEFAULT_FACILITY_LAYOUT_CONFIG: FacilityLayoutConfig = {
  title: 'Sơ đồ mặt bằng cơ sở',
  floor1Name: 'Tầng 1',
  floor2Name: 'Tầng 2',
  zoneAName: 'Phân khu A',
  zoneADesc: '',
  zoneBName: 'Phân khu B',
  zoneBDesc: '',
  zoneCName: 'Phân khu C',
  zoneCDesc: '',
  loadingBayFloor1: 'Khu nhận và xuất hàng',
  corridorNorth: 'Hành lang chính',
  exitFloor1: 'Lối thoát tầng 1',
  loadingBayFloor2: 'Khu nhận và xuất hàng',
  corridorClimate: 'Hành lang chính',
  exitFloor2: 'Lối thoát tầng 2',
  totalAreaFloor1: '',
  totalAreaFloor2: '',
}

export interface ZoneTypeOption {
  type: ZoneType
  label: string
  description: string
  icon: string
  color: string
  badgeColor: string
}

export const ZONE_TYPE_OPTIONS: ZoneTypeOption[] = [
  {
    type: 'MINI_STORAGE',
    label: 'Kho mini (1m³ - 3m³)',
    description: 'Kho lưu trữ tư trang, đồ gia đình nhỏ, vali du lịch',
    icon: 'inventory_2',
    color: 'border-blue-300 bg-blue-50/70 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
    badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200',
  },
  {
    type: 'STANDARD_STORAGE',
    label: 'Kho tiêu chuẩn (4m³ - 8m³)',
    description: 'Kho chứa đồ nội thất, thiết bị gia đình, hàng dọn nhà',
    icon: 'warehouse',
    color: 'border-cyan-300 bg-cyan-50/70 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300',
    badgeColor: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/60 dark:text-cyan-200',
  },
  {
    type: 'BUSINESS_STORAGE',
    label: 'Kho doanh nghiệp (9m³ - 20m³)',
    description: 'Kho hồ sơ tài liệu, hàng mẫu, tồn kho thương mại',
    icon: 'business_center',
    color: 'border-indigo-300 bg-indigo-50/70 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300',
    badgeColor: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200',
  },
  {
    type: 'LARGE_STORAGE',
    label: 'Kho hàng lớn (Trên 20m³)',
    description: 'Kho diện tích lớn, lưu trữ pallet và máy móc công nghiệp',
    icon: 'forklift',
    color: 'border-amber-300 bg-amber-50/70 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200',
  },
  {
    type: 'CLIMATE_CONTROLLED',
    label: 'Kho điều hòa kiểm soát nhiệt ẩm',
    description: 'Nhiệt độ ổn định 20-24°C, bảo quản tranh ảnh, thiết bị điện tử, dược phẩm',
    icon: 'ac_unit',
    color: 'border-teal-300 bg-teal-50/70 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300',
    badgeColor: 'bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-200',
  },
  {
    type: 'COLD_STORAGE',
    label: 'Kho lạnh (Cold Storage)',
    description: 'Nhiệt độ dưới 10°C, hàng đông lạnh chuyên dụng',
    icon: 'severe_cold',
    color: 'border-sky-300 bg-sky-50/70 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
    badgeColor: 'bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-200',
  },
  {
    type: 'SPECIAL_STORAGE',
    label: 'Khu vực lưu trữ đặc biệt',
    description: 'Lưu trữ tài sản giá trị cao, két sắt bảo mật, hầm rượu vang',
    icon: 'lock',
    color: 'border-purple-300 bg-purple-50/70 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300',
    badgeColor: 'bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200',
  },
  {
    type: 'UNEXPLOITED',
    label: 'Khu vực chưa khai thác / Dự phòng',
    description: 'Diện tích mặt bằng dự trữ mở rộng giai đoạn tiếp theo',
    icon: 'hourglass_empty',
    color: 'border-slate-300 bg-slate-50/70 text-slate-600 dark:bg-slate-800/40 dark:text-slate-400',
    badgeColor: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
  {
    type: 'CUSTOM',
    label: 'Loại phân khu khác',
    description: 'Phân khu theo nhu cầu kiến trúc riêng của cơ sở',
    icon: 'category',
    color: 'border-emerald-300 bg-emerald-50/70 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200',
  },
]

export interface FunctionalAreaTypeOption {
  type: FunctionalAreaType
  label: string
  category: 'LOGISTICS' | 'CIRCULATION' | 'VERTICAL_TRANS' | 'SAFETY' | 'FACILITY_TECH' | 'SERVICES'
  icon: string
  color: string
}

export const FUNCTIONAL_AREA_TYPE_OPTIONS: FunctionalAreaTypeOption[] = [
  // LOGISTICS
  { type: 'LOADING_BAY', label: 'Khu nhận hàng (Loading Bay)', category: 'LOGISTICS', icon: 'local_shipping', color: 'text-blue-600 dark:text-blue-400' },
  { type: 'DISPATCH_BAY', label: 'Khu xuất hàng (Dispatch Bay)', category: 'LOGISTICS', icon: 'output', color: 'text-blue-600 dark:text-blue-400' },
  { type: 'STAGING_AREA', label: 'Khu tập kết hàng tạm', category: 'LOGISTICS', icon: 'layers', color: 'text-blue-600 dark:text-blue-400' },
  { type: 'TROLLEY_BAY', label: 'Khu để xe đẩy & thang nâng', category: 'LOGISTICS', icon: 'trolley', color: 'text-blue-600 dark:text-blue-400' },

  // CIRCULATION
  { type: 'MAIN_CORRIDOR', label: 'Hành lang chính', category: 'CIRCULATION', icon: 'alt_route', color: 'text-teal-600 dark:text-teal-400' },
  { type: 'SUB_CORRIDOR', label: 'Hành lang phụ / Nhánh', category: 'CIRCULATION', icon: 'fork_right', color: 'text-teal-600 dark:text-teal-400' },
  { type: 'ACCESS_RAMP', label: 'Ram dốc bốc dỡ', category: 'CIRCULATION', icon: 'trending_up', color: 'text-teal-600 dark:text-teal-400' },

  // VERTICAL TRANSPORT
  { type: 'CARGO_ELEVATOR', label: 'Thang máy chở hàng', category: 'VERTICAL_TRANS', icon: 'elevator', color: 'text-purple-600 dark:text-purple-400' },
  { type: 'CARGO_LIFT', label: 'Thang nâng thủy lực', category: 'VERTICAL_TRANS', icon: 'vertical_align_top', color: 'text-purple-600 dark:text-purple-400' },
  { type: 'PASSENGER_ELEVATOR', label: 'Thang máy chở người', category: 'VERTICAL_TRANS', icon: 'escalator', color: 'text-purple-600 dark:text-purple-400' },
  { type: 'STAIRCASE', label: 'Cầu thang bộ', category: 'VERTICAL_TRANS', icon: 'stairs', color: 'text-purple-600 dark:text-purple-400' },

  // SAFETY & FIRE
  { type: 'EMERGENCY_EXIT', label: 'Lối thoát hiểm', category: 'SAFETY', icon: 'emergency', color: 'text-rose-600 dark:text-rose-400' },
  { type: 'FIRE_DOOR', label: 'Cửa chống cháy ngăn kho', category: 'SAFETY', icon: 'door_front', color: 'text-rose-600 dark:text-rose-400' },

  // TECH & OPERATION
  { type: 'TECHNICAL_ROOM', label: 'Phòng kỹ thuật', category: 'FACILITY_TECH', icon: 'build', color: 'text-amber-600 dark:text-amber-400' },
  { type: 'ELECTRICAL_ROOM', label: 'Phòng điện / Biến áp', category: 'FACILITY_TECH', icon: 'bolt', color: 'text-amber-600 dark:text-amber-400' },
  { type: 'HVAC_ROOM', label: 'Phòng điều hòa trung tâm', category: 'FACILITY_TECH', icon: 'hvac', color: 'text-amber-600 dark:text-amber-400' },

  // SERVICES & AMENITIES
  { type: 'OFFICE', label: 'Văn phòng tiếp đón khách', category: 'SERVICES', icon: 'desk', color: 'text-emerald-600 dark:text-emerald-400' },
  { type: 'SECURITY_GUARD', label: 'Phòng bảo vệ / Kiểm soát an ninh', category: 'SERVICES', icon: 'shield', color: 'text-emerald-600 dark:text-emerald-400' },
  { type: 'RESTROOM', label: 'Nhà vệ sinh', category: 'SERVICES', icon: 'wc', color: 'text-emerald-600 dark:text-emerald-400' },
  { type: 'PARKING', label: 'Bãi đỗ xe khách & xe tải', category: 'SERVICES', icon: 'local_parking', color: 'text-emerald-600 dark:text-emerald-400' },
  { type: 'OTHER', label: 'Khu vực chức năng khác', category: 'SERVICES', icon: 'more_horiz', color: 'text-slate-600 dark:text-slate-400' },
]

export const generateId = (): string => {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : 'id-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
}

/**
 * Creates an empty floor without auto-injecting default functional areas.
 */
export const createEmptyFloor = (floorNumber = 1, name = `Tầng ${floorNumber}`, code = `FL-${String(floorNumber).padStart(2, '0')}`): FacilityFloor => {
  const floorId = generateId()
  return {
    id: floorId,
    name,
    code,
    floorNumber,
    totalArea: 400,
    height: 3.5,
    status: 'ACTIVE',
    displayOrder: floorNumber,
    description: '',
    zones: [],
    functionalAreas: [],
  }
}

/**
 * Parses raw JSON string into rich FacilityFloorPlanConfig.
 * Seamlessly converts legacy v1 layout format into multi-floor structure.
 */
export const parseFacilityFloorPlanConfig = (rawConfig?: string | null): FacilityFloorPlanConfig => {
  if (!rawConfig || rawConfig.trim() === '') {
    // Return standard 1-floor initial structure
    return {
      version: 2,
      title: 'Sơ đồ mặt bằng chi nhánh',
      floors: [createEmptyFloor(1, 'Tầng 1', 'FL-01')],
    }
  }

  try {
    const parsed = JSON.parse(rawConfig)

    // Check if this is already a v2 configuration with floors array
    if (parsed && Array.isArray(parsed.floors) && parsed.floors.length > 0) {
      return {
        version: 2,
        title: parsed.title || 'Sơ đồ mặt bằng chi nhánh',
        totalFloorsCount: parsed.floors.length,
        floors: parsed.floors.map((f: any, idx: number) => ({
          id: f.id || generateId(),
          name: f.name || `Tầng ${idx + 1}`,
          code: f.code || `FL-${String(idx + 1).padStart(2, '0')}`,
          floorNumber: typeof f.floorNumber === 'number' ? f.floorNumber : idx + 1,
          totalArea: typeof f.totalArea === 'number' && f.totalArea > 0 ? f.totalArea : (Number(f.totalArea) || 300),
          height: f.height ? Number(f.height) : undefined,
          loadCapacity: f.loadCapacity ? Number(f.loadCapacity) : undefined,
          description: f.description || '',
          status: f.status || 'ACTIVE',
          displayOrder: typeof f.displayOrder === 'number' ? f.displayOrder : idx + 1,
          zones: Array.isArray(f.zones)
            ? f.zones.map((z: any, zIdx: number) => ({
                id: z.id || generateId(),
                floorId: f.id,
                name: z.name || `Phân khu ${zIdx + 1}`,
                code: z.code || `Z-${zIdx + 1}`,
                zoneType: z.zoneType || 'STANDARD_STORAGE',
                customTypeLabel: z.customTypeLabel || '',
                area: Number(z.area) || 50,
                description: z.description || '',
                status: z.status || 'ACTIVE',
                displayOrder: typeof z.displayOrder === 'number' ? z.displayOrder : zIdx + 1,
              }))
            : [],
          functionalAreas: Array.isArray(f.functionalAreas)
            ? f.functionalAreas.map((fa: any, faIdx: number) => ({
                id: fa.id || generateId(),
                floorId: f.id,
                name: fa.name || `Khu vực ${faIdx + 1}`,
                code: fa.code || `FA-${faIdx + 1}`,
                areaType: fa.areaType || 'MAIN_CORRIDOR',
                customTypeLabel: fa.customTypeLabel || '',
                area: fa.area ? Number(fa.area) : undefined,
                description: fa.description || '',
                status: fa.status || 'ACTIVE',
                displayOrder: typeof fa.displayOrder === 'number' ? fa.displayOrder : faIdx + 1,
                attributes: fa.attributes || {},
              }))
            : [],
        })),
        legacy: parsed.legacy || {},
      }
    }

    // Convert Legacy v1 layout format (floor1Name, zoneAName...) into v2
    const v1 = parsed as Partial<FacilityLayoutConfig>
    const floor1Id = generateId()
    const floor2Id = generateId()

    const floor1Zones: FacilityZone[] = []
    if (v1.zoneAName) {
      floor1Zones.push({
        id: generateId(),
        floorId: floor1Id,
        name: v1.zoneAName,
        code: 'ZA',
        zoneType: 'MINI_STORAGE',
        area: 100,
        description: v1.zoneADesc || '',
        status: 'ACTIVE',
        displayOrder: 1,
      })
    }
    if (v1.zoneBName) {
      floor1Zones.push({
        id: generateId(),
        floorId: floor1Id,
        name: v1.zoneBName,
        code: 'ZB',
        zoneType: 'STANDARD_STORAGE',
        area: 120,
        description: v1.zoneBDesc || '',
        status: 'ACTIVE',
        displayOrder: 2,
      })
    }

    const floor1Areas: FacilityFunctionalArea[] = []
    if (v1.loadingBayFloor1) {
      floor1Areas.push({
        id: generateId(),
        floorId: floor1Id,
        name: v1.loadingBayFloor1,
        code: 'FA-FL01-LOAD',
        areaType: 'LOADING_BAY',
        area: 30,
        status: 'ACTIVE',
        displayOrder: 1,
      })
    }
    if (v1.corridorNorth) {
      floor1Areas.push({
        id: generateId(),
        floorId: floor1Id,
        name: v1.corridorNorth,
        code: 'FA-FL01-CORR',
        areaType: 'MAIN_CORRIDOR',
        area: 40,
        status: 'ACTIVE',
        displayOrder: 2,
      })
    }
    if (v1.exitFloor1) {
      floor1Areas.push({
        id: generateId(),
        floorId: floor1Id,
        name: v1.exitFloor1,
        code: 'FA-FL01-EXIT',
        areaType: 'EMERGENCY_EXIT',
        status: 'ACTIVE',
        displayOrder: 3,
      })
    }

    const floor2Zones: FacilityZone[] = []
    if (v1.zoneCName) {
      floor2Zones.push({
        id: generateId(),
        floorId: floor2Id,
        name: v1.zoneCName,
        code: 'ZC',
        zoneType: 'BUSINESS_STORAGE',
        area: 150,
        description: v1.zoneCDesc || '',
        status: 'ACTIVE',
        displayOrder: 1,
      })
    }

    const floor2Areas: FacilityFunctionalArea[] = []
    if (v1.loadingBayFloor2) {
      floor2Areas.push({
        id: generateId(),
        floorId: floor2Id,
        name: v1.loadingBayFloor2,
        code: 'FA-FL02-LOAD',
        areaType: 'LOADING_BAY',
        area: 30,
        status: 'ACTIVE',
        displayOrder: 1,
      })
    }
    if (v1.corridorClimate) {
      floor2Areas.push({
        id: generateId(),
        floorId: floor2Id,
        name: v1.corridorClimate,
        code: 'FA-FL02-CORR',
        areaType: 'MAIN_CORRIDOR',
        area: 40,
        status: 'ACTIVE',
        displayOrder: 2,
      })
    }
    if (v1.exitFloor2) {
      floor2Areas.push({
        id: generateId(),
        floorId: floor2Id,
        name: v1.exitFloor2,
        code: 'FA-FL02-EXIT',
        areaType: 'EMERGENCY_EXIT',
        status: 'ACTIVE',
        displayOrder: 3,
      })
    }

    const total1 = Number(v1.totalAreaFloor1) || (floor1Zones.reduce((s, z) => s + z.area, 0) + 70)
    const total2 = Number(v1.totalAreaFloor2) || (floor2Zones.reduce((s, z) => s + z.area, 0) + 70)

    return {
      version: 2,
      title: v1.title || 'Sơ đồ mặt bằng cơ sở',
      totalFloorsCount: 2,
      floors: [
        {
          id: floor1Id,
          name: v1.floor1Name || 'Tầng 1',
          code: 'FL-01',
          floorNumber: 1,
          totalArea: total1,
          status: 'ACTIVE',
          displayOrder: 1,
          zones: floor1Zones,
          functionalAreas: floor1Areas,
        },
        {
          id: floor2Id,
          name: v1.floor2Name || 'Tầng 2',
          code: 'FL-02',
          floorNumber: 2,
          totalArea: total2,
          status: 'ACTIVE',
          displayOrder: 2,
          zones: floor2Zones,
          functionalAreas: floor2Areas,
        },
      ],
      legacy: v1,
    }
  } catch (err) {
    console.warn('Failed to parse floor plan JSON:', err)
    return {
      version: 2,
      title: 'Sơ đồ mặt bằng chi nhánh',
      floors: [createEmptyFloor(1, 'Tầng 1', 'FL-01')],
    }
  }
}

/**
 * Backward compatibility parser for components still expecting FacilityLayoutConfig.
 */
export const parseFacilityLayoutConfig = (rawConfig?: string | null): FacilityLayoutConfig => {
  const floorPlan = parseFacilityFloorPlanConfig(rawConfig)

  // Map floor plan to legacy fields so ManagerDashboard does not break
  const f1 = floorPlan.floors.find((f) => f.floorNumber === 1 || f.displayOrder === 1) || floorPlan.floors[0]
  const f2 = floorPlan.floors.find((f) => f.floorNumber === 2 || f.displayOrder === 2) || floorPlan.floors[1]

  const zA = f1?.zones[0]
  const zB = f1?.zones[1]
  const zC = f2?.zones[0]

  return {
    title: floorPlan.title,
    floor1Name: f1?.name || 'Tầng 1',
    floor2Name: f2?.name || (floorPlan.floors.length > 1 ? floorPlan.floors[1].name : 'Tầng 2'),
    zoneAName: zA?.name || 'Phân khu A',
    zoneADesc: zA?.description || '',
    zoneBName: zB?.name || 'Phân khu B',
    zoneBDesc: zB?.description || '',
    zoneCName: zC?.name || 'Phân khu C',
    zoneCDesc: zC?.description || '',
    loadingBayFloor1: f1?.functionalAreas.find((a) => a.areaType === 'LOADING_BAY')?.name || 'Khu nhận và xuất hàng',
    corridorNorth: f1?.functionalAreas.find((a) => a.areaType === 'MAIN_CORRIDOR')?.name || 'Hành lang chính',
    exitFloor1: f1?.functionalAreas.find((a) => a.areaType === 'EMERGENCY_EXIT')?.name || 'Lối thoát tầng 1',
    loadingBayFloor2: f2?.functionalAreas.find((a) => a.areaType === 'LOADING_BAY')?.name || 'Khu nhận và xuất hàng',
    corridorClimate: f2?.functionalAreas.find((a) => a.areaType === 'MAIN_CORRIDOR')?.name || 'Hành lang chính',
    exitFloor2: f2?.functionalAreas.find((a) => a.areaType === 'EMERGENCY_EXIT')?.name || 'Lối thoát tầng 2',
    totalAreaFloor1: f1 ? String(f1.totalArea) : '',
    totalAreaFloor2: f2 ? String(f2.totalArea) : '',
    version: 2,
    floors: floorPlan.floors,
  }
}

/**
 * Serializes rich FacilityFloorPlanConfig into JSON string.
 * Generates both v2 structure and legacy compatibility fields.
 */
export const serializeFacilityFloorPlanConfig = (config: FacilityFloorPlanConfig): string => {
  const f1 = config.floors.find((f) => f.floorNumber === 1 || f.displayOrder === 1) || config.floors[0]
  const f2 = config.floors.find((f) => f.floorNumber === 2 || f.displayOrder === 2) || config.floors[1]

  const zA = f1?.zones[0]
  const zB = f1?.zones[1]
  const zC = f2?.zones[0]

  const payload = {
    ...config,
    version: 2,
    // Legacy fields for backward compatibility with ManagerDashboard
    title: config.title,
    floor1Name: f1?.name || 'Tầng 1',
    floor2Name: f2?.name || (config.floors.length > 1 ? config.floors[1].name : 'Tầng 2'),
    zoneAName: zA?.name || 'Phân khu A',
    zoneADesc: zA?.description || '',
    zoneBName: zB?.name || 'Phân khu B',
    zoneBDesc: zB?.description || '',
    zoneCName: zC?.name || 'Phân khu C',
    zoneCDesc: zC?.description || '',
    loadingBayFloor1: f1?.functionalAreas.find((a) => a.areaType === 'LOADING_BAY')?.name || 'Khu nhận và xuất hàng',
    corridorNorth: f1?.functionalAreas.find((a) => a.areaType === 'MAIN_CORRIDOR')?.name || 'Hành lang chính',
    exitFloor1: f1?.functionalAreas.find((a) => a.areaType === 'EMERGENCY_EXIT')?.name || 'Lối thoát tầng 1',
    loadingBayFloor2: f2?.functionalAreas.find((a) => a.areaType === 'LOADING_BAY')?.name || 'Khu nhận và xuất hàng',
    corridorClimate: f2?.functionalAreas.find((a) => a.areaType === 'MAIN_CORRIDOR')?.name || 'Hành lang chính',
    exitFloor2: f2?.functionalAreas.find((a) => a.areaType === 'EMERGENCY_EXIT')?.name || 'Lối thoát tầng 2',
    totalAreaFloor1: f1 ? String(f1.totalArea) : '',
    totalAreaFloor2: f2 ? String(f2.totalArea) : '',
  }

  return JSON.stringify(payload)
}

/**
 * Calculates area allocations and validates floor usage.
 */
export const calculateFloorAllocation = (floor: FacilityFloor) => {
  const totalArea = Number(floor.totalArea) || 0
  const zoneAreaTotal = floor.zones.reduce((sum, z) => sum + (Number(z.area) || 0), 0)
  const functionalAreaTotal = floor.functionalAreas.reduce((sum, fa) => sum + (Number(fa.area) || 0), 0)
  const allocatedArea = zoneAreaTotal + functionalAreaTotal
  const unallocatedArea = Math.max(0, totalArea - allocatedArea)
  const isExceeded = allocatedArea > totalArea + 0.05
  const percentageAllocated = totalArea > 0 ? Math.min(100, Math.round((allocatedArea / totalArea) * 100)) : 0

  return {
    totalArea,
    zoneAreaTotal,
    functionalAreaTotal,
    allocatedArea,
    unallocatedArea,
    isExceeded,
    percentageAllocated,
    zoneCount: floor.zones.length,
    functionalAreaCount: floor.functionalAreas.length,
  }
}
