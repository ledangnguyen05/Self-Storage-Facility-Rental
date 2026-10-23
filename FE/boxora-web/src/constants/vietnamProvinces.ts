/**
 * Standard Vietnam GSO province codes & names (Mã tỉnh Tổng cục Thống kê)
 * Reference: D:\ganhmuusinh\website\vn_provinces.py
 */
export interface VietnamProvince {
  code: string
  name: string
  shortCode: string
}

export const VIETNAM_PROVINCES: VietnamProvince[] = [
  { code: '01', name: 'Hà Nội', shortCode: 'HN' },
  { code: '02', name: 'Hà Giang', shortCode: 'HG' },
  { code: '04', name: 'Cao Bằng', shortCode: 'CB' },
  { code: '06', name: 'Bắc Kạn', shortCode: 'BK' },
  { code: '08', name: 'Tuyên Quang', shortCode: 'TQ' },
  { code: '10', name: 'Lào Cai', shortCode: 'LC' },
  { code: '11', name: 'Điện Biên', shortCode: 'DB' },
  { code: '12', name: 'Lai Châu', shortCode: 'LC' },
  { code: '14', name: 'Sơn La', shortCode: 'SL' },
  { code: '15', name: 'Yên Bái', shortCode: 'YB' },
  { code: '17', name: 'Hòa Bình', shortCode: 'HB' },
  { code: '19', name: 'Thái Nguyên', shortCode: 'TN' },
  { code: '20', name: 'Lạng Sơn', shortCode: 'LS' },
  { code: '22', name: 'Quảng Ninh', shortCode: 'QN' },
  { code: '24', name: 'Bắc Giang', shortCode: 'BG' },
  { code: '25', name: 'Phú Thọ', shortCode: 'PT' },
  { code: '26', name: 'Vĩnh Phúc', shortCode: 'VP' },
  { code: '27', name: 'Bắc Ninh', shortCode: 'BN' },
  { code: '30', name: 'Hải Dương', shortCode: 'HD' },
  { code: '31', name: 'Hải Phòng', shortCode: 'HP' },
  { code: '33', name: 'Hưng Yên', shortCode: 'HY' },
  { code: '34', name: 'Thái Bình', shortCode: 'TB' },
  { code: '35', name: 'Hà Nam', shortCode: 'HNA' },
  { code: '36', name: 'Nam Định', shortCode: 'ND' },
  { code: '37', name: 'Ninh Bình', shortCode: 'NB' },
  { code: '38', name: 'Thanh Hóa', shortCode: 'TH' },
  { code: '40', name: 'Nghệ An', shortCode: 'NA' },
  { code: '42', name: 'Hà Tĩnh', shortCode: 'HT' },
  { code: '44', name: 'Quảng Bình', shortCode: 'QB' },
  { code: '45', name: 'Quảng Trị', shortCode: 'QT' },
  { code: '46', name: 'Thừa Thiên Huế', shortCode: 'TTH' },
  { code: '48', name: 'Đà Nẵng', shortCode: 'DN' },
  { code: '49', name: 'Quảng Nam', shortCode: 'QNA' },
  { code: '51', name: 'Quảng Ngãi', shortCode: 'QNG' },
  { code: '52', name: 'Bình Định', shortCode: 'BD' },
  { code: '54', name: 'Phú Yên', shortCode: 'PY' },
  { code: '56', name: 'Khánh Hòa', shortCode: 'KH' },
  { code: '58', name: 'Ninh Thuận', shortCode: 'NT' },
  { code: '60', name: 'Bình Thuận', shortCode: 'BTH' },
  { code: '62', name: 'Kon Tum', shortCode: 'KT' },
  { code: '64', name: 'Gia Lai', shortCode: 'GL' },
  { code: '66', name: 'Đắk Lắk', shortCode: 'DL' },
  { code: '67', name: 'Đắk Nông', shortCode: 'DN' },
  { code: '68', name: 'Lâm Đồng', shortCode: 'LD' },
  { code: '70', name: 'Bình Phước', shortCode: 'BP' },
  { code: '72', name: 'Tây Ninh', shortCode: 'TN' },
  { code: '74', name: 'Bình Dương', shortCode: 'BDG' },
  { code: '75', name: 'Đồng Nai', shortCode: 'DNA' },
  { code: '77', name: 'Bà Rịa - Vũng Tàu', shortCode: 'VT' },
  { code: '79', name: 'TP. Hồ Chí Minh', shortCode: 'HCM' },
  { code: '80', name: 'Long An', shortCode: 'LA' },
  { code: '82', name: 'Tiền Giang', shortCode: 'TG' },
  { code: '83', name: 'Bến Tre', shortCode: 'BT' },
  { code: '84', name: 'Trà Vinh', shortCode: 'TV' },
  { code: '86', name: 'Vĩnh Long', shortCode: 'VL' },
  { code: '87', name: 'Đồng Tháp', shortCode: 'DT' },
  { code: '89', name: 'An Giang', shortCode: 'AG' },
  { code: '91', name: 'Kiên Giang', shortCode: 'KG' },
  { code: '92', name: 'Cần Thơ', shortCode: 'CT' },
  { code: '93', name: 'Hậu Giang', shortCode: 'HG' },
  { code: '94', name: 'Sóc Trăng', shortCode: 'ST' },
  { code: '95', name: 'Bạc Liêu', shortCode: 'BL' },
  { code: '96', name: 'Cà Mau', shortCode: 'CM' },
]

export const getProvinceShortCode = (cityName?: string): string => {
  if (!cityName) return 'BR'
  const clean = cityName.toLowerCase().trim()
  const found = VIETNAM_PROVINCES.find(p => {
    const pName = p.name.toLowerCase()
    return clean.includes(pName) || pName.includes(clean)
  })
  return found ? found.shortCode : 'BR'
}
