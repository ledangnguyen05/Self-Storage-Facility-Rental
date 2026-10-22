import { FacilityFloorConfig, FacilityLayoutConfig } from '../types'

export const createDefaultFloor = (floorNumber: number, name?: string): FacilityFloorConfig => ({
  id: `floor-${floorNumber}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  floorNumber,
  name: name || (floorNumber === 1 ? 'Tầng trệt' : `Tầng ${floorNumber}`),
  totalArea: '',
  operationPoints: [
    { id: `op-${Date.now()}-1`, name: 'Khu nhận / xuất hàng' },
    { id: `op-${Date.now()}-2`, name: 'Hành lang chính' },
    { id: `op-${Date.now()}-3`, name: 'Lối thoát hiểm' },
  ],
  zones: [
    { id: `zone-${Date.now()}-1`, code: 'A', name: 'Khu lưu trữ A' },
  ],
})

export const DEFAULT_FACILITY_LAYOUT_CONFIG: FacilityLayoutConfig = {
  title: 'Sơ đồ mặt bằng cơ sở',
  floors: [
    {
      id: 'floor-1',
      floorNumber: 1,
      name: 'Tầng trệt',
      totalArea: '',
      operationPoints: [
        { id: 'op-1', name: 'Khu nhận / xuất hàng' },
        { id: 'op-2', name: 'Hành lang chính' },
        { id: 'op-3', name: 'Lối thoát hiểm' },
      ],
      zones: [
        { id: 'zone-1', code: 'A', name: 'Khu lưu trữ A' },
      ],
    },
  ],
  floor1Name: 'Tầng trệt',
  floor2Name: 'Tầng 1',
  zoneAName: 'Khu lưu trữ A',
  zoneADesc: '',
  zoneBName: 'Phân khu B',
  zoneBDesc: '',
  zoneCName: 'Phân khu C',
  zoneCDesc: '',
  loadingBayFloor1: 'Khu nhận / xuất hàng',
  corridorNorth: 'Hành lang chính',
  exitFloor1: 'Lối thoát hiểm',
  loadingBayFloor2: 'Khu nhận và xuất hàng',
  corridorClimate: 'Hành lang chính',
  exitFloor2: 'Lối thoát hiểm',
  totalAreaFloor1: '',
  totalAreaFloor2: '',
}

export const syncLegacyLayoutFields = (config: FacilityLayoutConfig): FacilityLayoutConfig => {
  const floors = config.floors || []
  const floor1 = floors[0]
  const floor2 = floors[1]

  const floor1Name = floor1?.name || config.floor1Name || 'Tầng trệt'
  const floor2Name = floor2?.name || config.floor2Name || 'Tầng 1'
  const totalAreaFloor1 = floor1?.totalArea || config.totalAreaFloor1 || ''
  const totalAreaFloor2 = floor2?.totalArea || config.totalAreaFloor2 || ''

  const loadingBayFloor1 = floor1?.operationPoints?.[0]?.name || config.loadingBayFloor1 || 'Khu nhận / xuất hàng'
  const corridorNorth = floor1?.operationPoints?.[1]?.name || config.corridorNorth || 'Hành lang chính'
  const exitFloor1 = floor1?.operationPoints?.[2]?.name || config.exitFloor1 || 'Lối thoát hiểm'

  const loadingBayFloor2 = floor2?.operationPoints?.[0]?.name || config.loadingBayFloor2 || 'Khu nhận và xuất hàng'
  const corridorClimate = floor2?.operationPoints?.[1]?.name || config.corridorClimate || 'Hành lang chính'
  const exitFloor2 = floor2?.operationPoints?.[2]?.name || config.exitFloor2 || 'Lối thoát hiểm'

  const zoneAName = floor1?.zones?.[0]?.name || config.zoneAName || 'Khu lưu trữ A'
  const zoneBName = floor1?.zones?.[1]?.name || floor2?.zones?.[0]?.name || config.zoneBName || 'Phân khu B'
  const zoneCName = floor1?.zones?.[2]?.name || floor2?.zones?.[1]?.name || config.zoneCName || 'Phân khu C'

  return {
    ...config,
    floor1Name,
    floor2Name,
    totalAreaFloor1,
    totalAreaFloor2,
    loadingBayFloor1,
    corridorNorth,
    exitFloor1,
    loadingBayFloor2,
    corridorClimate,
    exitFloor2,
    zoneAName,
    zoneBName,
    zoneCName,
  }
}

export const parseFacilityLayoutConfig = (rawConfig?: string | null): FacilityLayoutConfig => {
  if (!rawConfig) {
    return { ...DEFAULT_FACILITY_LAYOUT_CONFIG }
  }

  try {
    const parsed = JSON.parse(rawConfig) as Partial<FacilityLayoutConfig>

    if (Array.isArray(parsed.floors) && parsed.floors.length > 0) {
      const sanitizedFloors: FacilityFloorConfig[] = parsed.floors.map((fl, idx) => ({
        id: fl.id || `floor-${idx + 1}-${Date.now()}`,
        floorNumber: fl.floorNumber || idx + 1,
        name: fl.name || (idx === 0 ? 'Tầng trệt' : `Tầng ${idx + 1}`),
        totalArea: fl.totalArea || '',
        operationPoints: Array.isArray(fl.operationPoints)
          ? fl.operationPoints.map((op, opIdx) => ({
              id: op.id || `op-${opIdx + 1}`,
              name: op.name || '',
            }))
          : [],
        zones: Array.isArray(fl.zones)
          ? fl.zones.map((z, zIdx) => ({
              id: z.id || `zone-${zIdx + 1}`,
              code: z.code || String.fromCharCode(65 + zIdx),
              name: z.name || `Khu lưu trữ ${String.fromCharCode(65 + zIdx)}`,
              description: z.description || '',
            }))
          : [],
      }))

      return syncLegacyLayoutFields({
        ...DEFAULT_FACILITY_LAYOUT_CONFIG,
        ...parsed,
        floors: sanitizedFloors,
      })
    }

    // Reconstruct floors from legacy format
    const legacyFloor1: FacilityFloorConfig = {
      id: 'floor-1',
      floorNumber: 1,
      name: parsed.floor1Name || 'Tầng trệt',
      totalArea: parsed.totalAreaFloor1 || '',
      operationPoints: [
        { id: 'op-1-1', name: parsed.loadingBayFloor1 || 'Khu nhận / xuất hàng' },
        { id: 'op-1-2', name: parsed.corridorNorth || 'Hành lang chính' },
        { id: 'op-1-3', name: parsed.exitFloor1 || 'Lối thoát hiểm' },
      ],
      zones: [
        { id: 'zone-1-1', code: 'A', name: parsed.zoneAName || 'Khu lưu trữ A' },
        ...(parsed.zoneBName ? [{ id: 'zone-1-2', code: 'B', name: parsed.zoneBName }] : []),
        ...(parsed.zoneCName ? [{ id: 'zone-1-3', code: 'C', name: parsed.zoneCName }] : []),
      ],
    }

    const legacyFloors: FacilityFloorConfig[] = [legacyFloor1]

    if (parsed.floor2Name || parsed.totalAreaFloor2 || parsed.loadingBayFloor2) {
      legacyFloors.push({
        id: 'floor-2',
        floorNumber: 2,
        name: parsed.floor2Name || 'Tầng 1',
        totalArea: parsed.totalAreaFloor2 || '',
        operationPoints: [
          { id: 'op-2-1', name: parsed.loadingBayFloor2 || 'Khu nhận và xuất hàng' },
          { id: 'op-2-2', name: parsed.corridorClimate || 'Hành lang chính' },
          { id: 'op-2-3', name: parsed.exitFloor2 || 'Lối thoát hiểm' },
        ],
        zones: [
          { id: 'zone-2-1', code: 'A', name: parsed.zoneAName || 'Khu lưu trữ A' },
          ...(parsed.zoneBName ? [{ id: 'zone-2-2', code: 'B', name: parsed.zoneBName }] : []),
        ],
      })
    }

    return syncLegacyLayoutFields({
      ...DEFAULT_FACILITY_LAYOUT_CONFIG,
      ...parsed,
      floors: legacyFloors,
    })
  } catch {
    return { ...DEFAULT_FACILITY_LAYOUT_CONFIG }
  }
}
