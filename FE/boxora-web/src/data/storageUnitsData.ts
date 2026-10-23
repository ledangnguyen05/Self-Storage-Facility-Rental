export interface StorageUnitType {
  id: string
  backendId?: string
  unitCode: string
  name: string
  unitTypeName?: string
  category: 'mini' | 'personal' | 'business' | 'special'
  areaSqMeters?: number
  monthlyPrice: string
  monthlyPriceNumeric: number
  depositAmountNumeric?: number
  status: 'Sẵn sàng' | 'Đang thuê' | 'Bảo trì' | 'Chờ duyệt'
  isAvailable: boolean
  facilityId: string
  facilityName: string
  facilityAddress: string
  floorLevel: string
  floorLocation: string
  coords?: { lat: number; lng: number } | null
  distanceKm?: number
  imageUrl?: string
}

export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round((R * c) * 10) / 10
}
