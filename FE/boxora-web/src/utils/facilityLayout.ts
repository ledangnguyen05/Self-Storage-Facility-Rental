import { FacilityLayoutConfig } from '../types'

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

export const parseFacilityLayoutConfig = (rawConfig?: string | null): FacilityLayoutConfig => {
  if (!rawConfig) return { ...DEFAULT_FACILITY_LAYOUT_CONFIG }

  try {
    const parsed = JSON.parse(rawConfig) as Partial<FacilityLayoutConfig>
    return { ...DEFAULT_FACILITY_LAYOUT_CONFIG, ...parsed }
  } catch {
    return { ...DEFAULT_FACILITY_LAYOUT_CONFIG }
  }
}
