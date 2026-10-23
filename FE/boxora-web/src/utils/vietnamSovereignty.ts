import L from 'leaflet'

/**
 * Tiện ích bản đồ khẳng định chủ quyền lãnh thổ Việt Nam trên nền tảng Leaflet
 * Tương tự kiến trúc D:\ganhmuusinh\website\src\utils\vietnamSovereignty.ts
 * 1. Tile layer Google Maps Tiếng Việt chuẩn mực (hl=vi, gl=VN):
 *    - 100% địa danh hiển thị Tiếng Việt chuẩn quốc gia.
 *    - KHÔNG CÓ chữ Trung Quốc tại vùng lãnh thổ Việt Nam.
 *    - KHÔNG CÓ đường lưỡi bò phi pháp.
 * 2. Khẳng định chủ quyền Quần đảo Hoàng Sa (TP. Đà Nẵng) và Quần đảo Trường Sa (Tỉnh Khánh Hòa).
 * 3. Nhãn BIỂN ĐÔNG trang trọng, chuẩn mực pháp lý quốc tế.
 */

export interface SovereigntyPoint {
  name: string
  sub: string
  lat: number
  lng: number
}

export const VIETNAM_SOVEREIGNTY_POINTS: SovereigntyPoint[] = [
  {
    name: 'QUẦN ĐẢO HOÀNG SA',
    sub: '(Huyện đảo Hoàng Sa, TP. Đà Nẵng, Việt Nam)',
    lat: 16.5412,
    lng: 112.0125,
  },
  {
    name: 'QUẦN ĐẢO TRƯỜNG SA',
    sub: '(Huyện đảo Trường Sa, Tỉnh Khánh Hòa, Việt Nam)',
    lat: 10.1256,
    lng: 114.3647,
  },
  {
    name: 'BIỂN ĐÔNG',
    sub: '(Vùng biển chủ quyền Việt Nam)',
    lat: 13.5,
    lng: 112.8,
  },
]

/**
 * Khởi tạo Tile Layer hiển thị 100% TIẾNG VIỆT, KHÔNG CHỮ TRUNG QUỐC, KHÔNG ĐƯỜNG LƯỠI BÒ
 */
export const createVietnamTileLayer = (): L.TileLayer => {
  return L.tileLayer('https://{s}.google.com/vt/lyrs=m&hl=vi&gl=VN&x={x}&y={y}&z={z}', {
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    maxZoom: 20,
    attribution: 'Bản đồ Google Tiếng Việt &middot; Khẳng định chủ quyền Việt Nam',
  })
}

/**
 * Áp dụng lớp đánh dấu chủ quyền Biển Đông, Hoàng Sa, Trường Sa lên bản đồ Leaflet
 */
export const applyVietnamSovereignty = (map: L.Map): L.LayerGroup => {
  const layerGroup = L.layerGroup()

  VIETNAM_SOVEREIGNTY_POINTS.forEach((point) => {
    const isSea = point.name === 'BIỂN ĐÔNG'
    const labelHtml = `
      <div style="text-align: center; font-weight: 800; font-family: 'Be Vietnam Pro', sans-serif; pointer-events: none; text-shadow: 0 1px 3px rgba(0,0,0,0.6); color: ${
        isSea ? '#0369a1' : '#b91c1c'
      }; font-size: ${isSea ? '13px' : '11px'}; letter-spacing: 0.5px;">
        <div>${point.name}</div>
        <div style="font-size: 9px; opacity: 0.85; font-weight: 600;">${point.sub}</div>
      </div>
    `

    const icon = L.divIcon({
      className: 'sovereignty-label',
      html: labelHtml,
      iconSize: [220, 40],
      iconAnchor: [110, 20],
    })

    const marker = L.marker([point.lat, point.lng], {
      icon,
      interactive: false,
    })

    marker.addTo(layerGroup)
  })

  layerGroup.addTo(map)
  return layerGroup
}
