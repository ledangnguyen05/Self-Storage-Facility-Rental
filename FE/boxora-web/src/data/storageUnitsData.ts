export interface FacilityLocation {
  id: string
  name: string
  shortName: string
  district: string
  address: string
  coords: { lat: number; lng: number }
  contactPhone: string
  highlight?: string
}

export interface CustomerLocationOption {
  id: string
  label: string
  district: string
  detailAddress: string
  coords: { lat: number; lng: number }
  isGps?: boolean
}

export interface StorageUnitType {
  id: string
  name: string
  category: 'mini' | 'personal' | 'business' | 'special'
  size: string
  volume: string
  capacityDesc: string
  itemsExample: string[]
  monthlyPrice: string
  monthlyPriceNumeric: number
  temp: string
  humidity: string
  status: 'Sẵn sàng' | 'Đang thuê' | 'Bảo trì'
  facilityId: string
  facilityName: string
  facilityAddress: string
  floorLocation: string
  coords: { lat: number; lng: number }
  distanceKm?: number
  travelMins?: number
}

export const BOXORA_FACILITIES: FacilityLocation[] = [
  {
    id: 'fac-1',
    name: 'Boxora Central Landmark — Quận 1',
    shortName: 'Boxora Quận 1',
    district: 'Quận 1',
    address: '142 Nguyễn Thị Minh Khai, P. Bến Thành, Quận 1, TP.HCM',
    coords: { lat: 10.7745, lng: 106.6925 },
    contactPhone: '028 3822 9901',
    highlight: 'Trung tâm Quận 1 • Mở cửa 24/7 • Thang máy tải hàng'
  },
  {
    id: 'fac-3',
    name: 'Boxora Riverside — Bình Thạnh',
    shortName: 'Boxora Bình Thạnh',
    district: 'Bình Thạnh',
    address: '208 Nguyễn Hữu Cảnh, Phường 22, Quận Bình Thạnh, TP.HCM',
    coords: { lat: 10.7925, lng: 106.7195 },
    contactPhone: '028 3514 6677',
    highlight: 'Ven sông Sài Gòn • Xe tải tiếp vận đỗ tận cửa • Kho mát vi khí hậu'
  },
  {
    id: 'fac-2',
    name: 'Boxora Tech Park — TP. Thủ Đức',
    shortName: 'Boxora Thủ Đức',
    district: 'TP. Thủ Đức',
    address: 'Lô E2a-7, Đường D1, Khu Công Nghệ Cao, TP. Thủ Đức, TP.HCM',
    coords: { lat: 10.8540, lng: 106.7865 },
    contactPhone: '028 7300 8822',
    highlight: 'Khu Công Nghệ Cao • Kho pallet logistics • Cửa cuốn trợ lực'
  }
]

export const CUSTOMER_LOCATIONS: CustomerLocationOption[] = [
  {
    id: 'loc-q1',
    label: 'Quận 1 (Trung tâm Bến Thành / Lê Lợi)',
    district: 'Quận 1',
    detailAddress: 'Khu vực P. Bến Thành, Quận 1, TP.HCM',
    coords: { lat: 10.7725, lng: 106.6980 }
  },
  {
    id: 'loc-q3',
    label: 'Quận 3 (Hồ Con Rùa / Võ Thị Sáu)',
    district: 'Quận 3',
    detailAddress: 'Khu vực P. Võ Thị Sáu, Quận 3, TP.HCM',
    coords: { lat: 10.7830, lng: 106.6890 }
  },
  {
    id: 'loc-bt',
    label: 'Bình Thạnh (Hàng Xanh / Điện Biên Phủ)',
    district: 'Bình Thạnh',
    detailAddress: 'Ngã tư Hàng Xanh, Quận Bình Thạnh, TP.HCM',
    coords: { lat: 10.8010, lng: 106.7110 }
  },
  {
    id: 'loc-td',
    label: 'TP. Thủ Đức (Thảo Điền / Xa Lộ Hà Nội)',
    district: 'TP. Thủ Đức',
    detailAddress: 'Khu Thảo Điền & An Phú, TP. Thủ Đức, TP.HCM',
    coords: { lat: 10.8030, lng: 106.7380 }
  },
  {
    id: 'loc-q7',
    label: 'Quận 7 (Phú Mỹ Hưng / Nguyễn Văn Linh)',
    district: 'Quận 7',
    detailAddress: 'Khu đô thị Phú Mỹ Hưng, Quận 7, TP.HCM',
    coords: { lat: 10.7300, lng: 106.7150 }
  },
  {
    id: 'loc-tb',
    label: 'Tân Bình (Sân Bay Tân Sơn Nhất / Trường Chinh)',
    district: 'Tân Bình',
    detailAddress: 'Khu vực Sân bay Tân Sơn Nhất, Quận Tân Bình, TP.HCM',
    coords: { lat: 10.8015, lng: 106.6550 }
  },
  {
    id: 'loc-q10',
    label: 'Quận 10 (Sư Vạn Hạnh / Ba Tháng Hai)',
    district: 'Quận 10',
    detailAddress: 'Khu vực Sư Vạn Hạnh, Quận 10, TP.HCM',
    coords: { lat: 10.7710, lng: 106.6670 }
  }
]

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

export function estimateTravelMinutes(distanceKm: number): number {
  return Math.max(4, Math.round((distanceKm / 24) * 60 + 3))
}

export const STORAGE_UNITS: StorageUnitType[] = [
  {
    id: 'BX-101',
    name: 'Locker Mini A1',
    category: 'mini',
    size: '2.5 m²',
    volume: '6.5 m³',
    capacityDesc: '3 vali lớn + 4 thùng carton cỡ vừa + 2 balo',
    itemsExample: ['Vali du lịch', 'Hồ sơ sách vở', 'Thiết bị điện tử nhỏ'],
    monthlyPrice: '850.000₫',
    monthlyPriceNumeric: 850000,
    temp: '21.5°C',
    humidity: '44%',
    status: 'Sẵn sàng',
    facilityId: 'fac-1',
    facilityName: 'Boxora Central Landmark — Quận 1',
    facilityAddress: '142 Nguyễn Thị Minh Khai, P. Bến Thành, Quận 1, TP.HCM',
    floorLocation: 'Tầng 1 • Dãy Locker A1 (Sát sảnh chính & Thang máy tải)',
    coords: { lat: 10.7745, lng: 106.6925 }
  },
  {
    id: 'BX-102',
    name: 'Kho Cá Nhân B2',
    category: 'personal',
    size: '5.0 m²',
    volume: '13.5 m³',
    capacityDesc: 'Đồ đạc căn hộ 1 phòng ngủ: Nệm, sofa nhỏ, tủ lạnh mini, 12 thùng hàng',
    itemsExample: ['Sofa & Bàn trà', 'Tủ lạnh mini', '12 thùng carton'],
    monthlyPrice: '1.850.000₫',
    monthlyPriceNumeric: 1850000,
    temp: '21.8°C',
    humidity: '45%',
    status: 'Sẵn sàng',
    facilityId: 'fac-3',
    facilityName: 'Boxora Riverside — Bình Thạnh',
    facilityAddress: '208 Nguyễn Hữu Cảnh, Phường 22, Quận Bình Thạnh, TP.HCM',
    floorLocation: 'Tầng 2 • Khu Buồng B2 (Hành lang đối lưu gió, xe đẩy sảnh)',
    coords: { lat: 10.7925, lng: 106.7195 }
  },
  {
    id: 'BX-103',
    name: 'Kho Tiêu Chuẩn C1',
    category: 'personal',
    size: '7.5 m²',
    volume: '20.0 m³',
    capacityDesc: 'Nội thất căn hộ 2 phòng ngủ: Giường nệm, bàn ghế ăn, máy giặt, 20 thùng',
    itemsExample: ['Giường nệm đôi', 'Bộ bàn ăn', 'Máy giặt & Gia dụng'],
    monthlyPrice: '2.450.000₫',
    monthlyPriceNumeric: 2450000,
    temp: '22.0°C',
    humidity: '43%',
    status: 'Đang thuê',
    facilityId: 'fac-1',
    facilityName: 'Boxora Central Landmark — Quận 1',
    facilityAddress: '142 Nguyễn Thị Minh Khai, P. Bến Thành, Quận 1, TP.HCM',
    floorLocation: 'Tầng 3 • Dãy C1 (Khóa số thông minh, trần cao 3.2m rộng thoáng)',
    coords: { lat: 10.7745, lng: 106.6925 }
  },
  {
    id: 'BX-104',
    name: 'Kho Lạnh Rượu & Đồ Quý',
    category: 'special',
    size: '6.0 m²',
    volume: '15.0 m³',
    capacityDesc: 'Nhiệt độ ổn định 16°C, độ ẩm 60% RH cho rượu vang, tranh nghệ thuật, nhạc cụ',
    itemsExample: ['Tủ rượu vang', 'Tranh sơn mài', 'Đàn Piano điện'],
    monthlyPrice: '2.600.000₫',
    monthlyPriceNumeric: 2600000,
    temp: '16.0°C',
    humidity: '60%',
    status: 'Sẵn sàng',
    facilityId: 'fac-1',
    facilityName: 'Boxora Central Landmark — Quận 1',
    facilityAddress: '142 Nguyễn Thị Minh Khai, P. Bến Thành, Quận 1, TP.HCM',
    floorLocation: 'Tầng Hầm B1 • Phòng Vi Khí Hậu Kép (Kiểm soát nhiệt ẩm chuẩn hầm rượu)',
    coords: { lat: 10.7745, lng: 106.6925 }
  },
  {
    id: 'BX-201',
    name: 'Kho Doanh Nghiệp Pro',
    category: 'business',
    size: '12.0 m²',
    volume: '32.0 m³',
    capacityDesc: 'Hàng thương mại điện tử, 4-6 pallet hàng tiêu chuẩn, tài liệu kế toán doanh nghiệp',
    itemsExample: ['6 Pallet hàng hóa', 'Tủ hồ sơ văn phòng', 'Bao bì đóng gói'],
    monthlyPrice: '3.400.000₫',
    monthlyPriceNumeric: 3400000,
    temp: '22.2°C',
    humidity: '46%',
    status: 'Sẵn sàng',
    facilityId: 'fac-2',
    facilityName: 'Boxora Tech Park — TP. Thủ Đức',
    facilityAddress: 'Lô E2a-7, Đường D1, Khu Công Nghệ Cao, TP. Thủ Đức, TP.HCM',
    floorLocation: 'Tầng Trệt G • Khoang E2 (Sát Dock tải hàng container & xe nâng)',
    coords: { lat: 10.8540, lng: 106.7865 }
  },
  {
    id: 'BX-202',
    name: 'Kho Thương Mại Lớn',
    category: 'business',
    size: '20.0 m²',
    volume: '54.0 m³',
    capacityDesc: 'Kho đệm logistics, đồ đạc nhà phố 3 tầng, thiết bị sự kiện và máy móc',
    itemsExample: ['10+ Pallet hàng', 'Toàn bộ nội thất nhà phố', 'Dàn thiết bị sự kiện'],
    monthlyPrice: '4.800.000₫',
    monthlyPriceNumeric: 4800000,
    temp: '21.4°C',
    humidity: '45%',
    status: 'Đang thuê',
    facilityId: 'fac-2',
    facilityName: 'Boxora Tech Park — TP. Thủ Đức',
    facilityAddress: 'Lô E2a-7, Đường D1, Khu Công Nghệ Cao, TP. Thủ Đức, TP.HCM',
    floorLocation: 'Tầng Trệt G • Khoang E5 (Cửa cuốn trợ lực, xe tải 5 tấn tiếp cận thẳng)',
    coords: { lat: 10.8540, lng: 106.7865 }
  },
  {
    id: 'BX-301',
    name: 'Kho Gia Đình Riverside',
    category: 'personal',
    size: '6.5 m²',
    volume: '17.5 m³',
    capacityDesc: 'Phù hợp nội thất chuyển nhà chung cư, máy giặt, tủ sách, xe đạp thể thao',
    itemsExample: ['Bộ bàn ghế sofa', 'Tủ quần áo 3 cánh', 'Đồ cắm trại thể thao'],
    monthlyPrice: '2.150.000₫',
    monthlyPriceNumeric: 2150000,
    temp: '22.0°C',
    humidity: '44%',
    status: 'Sẵn sàng',
    facilityId: 'fac-3',
    facilityName: 'Boxora Riverside — Bình Thạnh',
    facilityAddress: '208 Nguyễn Hữu Cảnh, Phường 22, Quận Bình Thạnh, TP.HCM',
    floorLocation: 'Tầng 1 • Khu R-102 (Đường nội bộ rộng, bốc dỡ xe ô tô trực tiếp)',
    coords: { lat: 10.7925, lng: 106.7195 }
  },
  {
    id: 'BX-302',
    name: 'Locker Tiện Ích Sông Sài Gòn',
    category: 'mini',
    size: '1.8 m²',
    volume: '4.8 m³',
    capacityDesc: 'Chứa 2 vali lớn, vali cabin, tài liệu hồ sơ kế toán và đồ dùng cá nhân',
    itemsExample: ['2 Vali cỡ đại', 'Hộp hồ sơ công ty', 'Túi gậy Golf'],
    monthlyPrice: '690.000₫',
    monthlyPriceNumeric: 690000,
    temp: '21.6°C',
    humidity: '45%',
    status: 'Sẵn sàng',
    facilityId: 'fac-3',
    facilityName: 'Boxora Riverside — Bình Thạnh',
    facilityAddress: '208 Nguyễn Hữu Cảnh, Phường 22, Quận Bình Thạnh, TP.HCM',
    floorLocation: 'Tầng 1 • Dãy Locker R-Mini (Gần sảnh lễ tân & Quầy bảo vệ)',
    coords: { lat: 10.7925, lng: 106.7195 }
  }
]
