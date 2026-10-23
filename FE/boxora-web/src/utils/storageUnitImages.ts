export interface StorageUnitImage {
  id: string
  url: string
  title: string
  description: string
  tag: 'Mặt trước & Khóa' | 'Không gian bên trong' | 'Minh họa sức chứa' | 'Hành lang & An ninh' | 'Quy cách & Bản vẽ'
}

export interface StorageUnitDetailSpecs {
  dimensions: string
  areaLabel: string
  volumeLabel: string
  ceilingHeight: string
  doorType: string
  lockType: string
  suitableItems: string[]
  bestFor: string
  securityHighlights: string[]
  includedAmenities: string[]
}

// Curated high quality storage and warehouse images tailored strictly to each storage tier
const IMAGE_SETS = {
  MINI: [
    {
      id: 'mini-1',
      url: '/assets/units/unit-front-mini.jpg',
      title: 'Mặt Trước Buồng Kho Mini M-05 & Khóa Số Smart Lock',
      description: 'Mặt trước buồng kho mini 1.5 m² cửa kim loại màu cam hé mở, bên trong xếp gọn gàng vali du lịch, thùng hồ sơ lưu trữ và balo trên giá kệ kim loại vững chắc.',
      tag: 'Mặt trước & Khóa' as const
    },
    {
      id: 'mini-2',
      url: '/assets/units/unit-mini.jpg',
      title: 'Bên Trong Buồng Kho Mini Cá Nhân (1.0 – 2.0 m²)',
      description: 'Không gian buồng kho mini vách thép gợn sóng bạc, sàn epoxy xám bóng láng, đèn LED trần sạch sẽ, chuẩn kiến trúc kho tự quản hiện đại.',
      tag: 'Không gian bên trong' as const
    },
    {
      id: 'mini-3',
      url: '/assets/units/unit-front-mini.jpg',
      title: 'Minh Họa Sức Chứa Buồng Kho Mini M-05 (Vali & Đồ Cá Nhân)',
      description: 'Dung tích 1.5 – 3.0 m³, chứa thoải mái 4–6 vali du lịch cỡ lớn, 10 thùng hồ sơ tài liệu tiêu chuẩn, thiết bị cá nhân hoặc túi gậy golf xếp tầng trên giá kệ vững chắc.',
      tag: 'Minh họa sức chứa' as const
    },
    {
      id: 'mini-4',
      url: '/assets/units/facility-hallway.jpg',
      title: 'Hành Lang Đa Tầng Kho Tự Quản Hiện Đại',
      description: 'Hành lang rộng rãi, vách thép xanh/cam hiện đại, camera CCTV đèn báo đỏ, vạch sơn định hướng sàn, biển chỉ dẫn PCCC chuẩn quốc tế.',
      tag: 'Hành lang & An ninh' as const
    }
  ],
  STANDARD: [
    {
      id: 'std-1',
      url: '/assets/units/unit-front-standard.jpg',
      title: 'Mặt Trước Buồng Kho Tiêu Chuẩn A-108 (Cửa Cuộn 50%)',
      description: 'Mặt trước buồng kho hiện đại với cửa cuốn màu cam cuộn mở 50%, để lộ đồ đạc bên trong: thùng carton đóng gói, xe đạp, hộp đồ gia đình, sofa bọc màng bảo vệ, chốt khóa trượt và bàn phím IoT Smart Keypad.',
      tag: 'Mặt trước & Khóa' as const
    },
    {
      id: 'std-2',
      url: '/assets/units/unit-standard.jpg',
      title: 'Bên Trong Buồng Kho Tiêu Chuẩn (3.0 – 5.0 m²)',
      description: 'Góc nhìn rộng toàn cảnh buồng kho 4 m², vách ngăn kim loại dạng sóng module, trần cao, sàn bê tông láng bóng, đèn LED trung tính sắc nét.',
      tag: 'Không gian bên trong' as const
    },
    {
      id: 'std-3',
      url: '/assets/units/unit-capacity-standard.jpg',
      title: 'Minh Họa Sức Chứa Buồng Kho A-108 (Đầy Đủ Đồ Gia Đình & Xe Máy)',
      description: 'Chứa vừa vặn 1 bộ sofa bọc màng PE, bộ bàn ghế ăn, xe đạp, thảm cuộn tròn đứng, thùng nhựa trong suốt và các chồng thùng carton chuyển nhà phân loại rõ ràng (Kitchen, Books, Home).',
      tag: 'Minh họa sức chứa' as const
    },
    {
      id: 'std-4',
      url: '/assets/units/facility-hallway.jpg',
      title: 'Hành Lang Kho Đa Tầng Rộng Rãi & Đèn LED',
      description: 'Hành lang kho thông thoáng với các dãy cửa cuốn đánh số thứ tự (B-201, B-202...), sàn bê tông có line vàng an toàn, camera an ninh và cảm biến PCCC Sprinkler.',
      tag: 'Hành lang & An ninh' as const
    }
  ],
  LARGE: [
    {
      id: 'large-1',
      url: '/assets/units/unit-front-large.jpg',
      title: 'Mặt Trước Buồng Kho Lớn L-302 Khổ Rộng',
      description: 'Biển số L-302 dập sơn nổi bật, cửa cuốn công nghiệp khổ rộng mở 50% để lộ trọn bộ nội thất gia đình: sofa bọc màng PE, bàn ăn gỗ, tủ lạnh, máy giặt và hàng chục thùng carton phân loại rõ ràng.',
      tag: 'Mặt trước & Khóa' as const
    },
    {
      id: 'large-2',
      url: '/assets/units/unit-large.jpg',
      title: 'Bên Trong Buồng Kho Lớn Đa Năng (8.0 – 15.0 m²)',
      description: 'Không gian buồng kho thương mại 12 m² chiều sâu thoáng đạt, vách panel thép công nghiệp, sàn epoxy phản chiếu bóng đẹp, dải đèn LED đối xứng hiện đại.',
      tag: 'Không gian bên trong' as const
    },
    {
      id: 'large-3',
      url: '/assets/units/unit-capacity-large.jpg',
      title: 'Minh Họa Sức Chứa Buồng Kho L-302 (Trọn Bộ Căn Hộ 2–3 Phòng Ngủ)',
      description: 'Dung tích cực lớn 25–40 m³, chứa trọn bộ nội thất căn hộ: sofa bọc màng PE, nệm Queen, tủ lạnh Side-by-side, máy giặt sấy, xe đạp và hơn 40 thùng carton cao sát trần.',
      tag: 'Minh họa sức chứa' as const
    },
    {
      id: 'large-4',
      url: '/assets/units/facility-hallway.jpg',
      title: 'Hành Lang Vận Chuyển Hàng Nặng & Xe Nâng Tay',
      description: 'Lối đi rộng rãi hỗ trợ xe đẩy 4 bánh tải trọng 300kg, thang máy nâng hàng 1.500kg, camera AI quan sát liên tục 24/7.',
      tag: 'Hành lang & An ninh' as const
    }
  ],
  COMMERCIAL: [
    {
      id: 'com-1',
      url: '/assets/units/unit-front-large.jpg',
      title: 'Mặt Trước Kho Doanh Nghiệp & Cửa Cuốn Tự Động',
      description: 'Cửa cuốn công nghiệp khổ rộng tiện bốc dỡ hàng hóa cồng kềnh, tích hợp bàn phím phân quyền mã truy cập IoT Smart Lock cho nhân sự và đơn vị vận chuyển.',
      tag: 'Mặt trước & Khóa' as const
    },
    {
      id: 'com-2',
      url: '/assets/units/unit-large.jpg',
      title: 'Không Gian Kho Thương Mại & Logistics (12 – 25 m²)',
      description: 'Không gian kho quy mô lớn trần cao, sàn epoxy chịu tải trọng nặng cho hoạt động logistics và lưu trữ hàng sỉ.',
      tag: 'Không gian bên trong' as const
    },
    {
      id: 'com-3',
      url: '/assets/units/unit-capacity-commercial.jpg',
      title: 'Minh Họa Sức Chứa Kho Thương Mại C-401 (Pallet & Hàng Hóa Sỉ)',
      description: 'Hệ thống giá kệ pallet công nghiệp chịu tải lớn chứa hàng chục kiện hàng bọc màng co, thùng hàng TMĐT và hồ sơ chứng từ doanh nghiệp.',
      tag: 'Minh họa sức chứa' as const
    },
    {
      id: 'com-4',
      url: '/assets/units/facility-hallway.jpg',
      title: 'Hành Lang Logistics Đạt Tiêu Chuẩn Thẩm Duyệt PCCC',
      description: 'Hành lang chịu tải trọng xe đẩy hàng hóa, trang bị hệ thống thông gió đối lưu, cảm biến khói báo cháy và camera an ninh góc rộng.',
      tag: 'Hành lang & An ninh' as const
    }
  ],
  CLIMATE: [
    {
      id: 'climate-1',
      url: '/assets/units/unit-cold.jpg',
      title: 'Buồng Kho Lạnh Chuyên Dụng 5 m² (Walk-in Cold Storage)',
      description: 'Không gian buồng kho lạnh 5 m² ốp vách panel sandwich trắng cách nhiệt, sàn dập gân nhôm chống trượt, dàn lạnh công nghiệp 2 quạt, bảng điện tử hiển thị nhiệt độ 5°C, cửa kho bảo ôn gioăng cao su dày kín khít.',
      tag: 'Không gian bên trong' as const
    },
    {
      id: 'climate-2',
      url: '/assets/units/unit-cold.jpg',
      title: 'Cửa Kho Bảo Ôn Cách Nhiệt & Màn Hình 5°C',
      description: 'Cửa xoay bảo ôn kín khít gioăng cao su chịu nhiệt âm, kèm màn hình kỹ thuật số hiển thị 5°C và cảm biến kiểm soát vi khí hậu.',
      tag: 'Mặt trước & Khóa' as const
    },
    {
      id: 'climate-3',
      url: 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=1200&q=80',
      title: 'Kệ Inox Lưu Trữ Hàng Nhạy Cảm Vi Khí Hậu',
      description: 'Chuyên dụng cho mỹ phẩm, vắc-xin, sinh phẩm y tế, dược phẩm và thực phẩm cao cấp cần duy trì nhiệt độ ổn định.',
      tag: 'Minh họa sức chứa' as const
    },
    {
      id: 'climate-4',
      url: '/assets/units/facility-hallway.jpg',
      title: 'Hành Lang Kho Trung Tâm Điều Hòa 24/7',
      description: 'Khu vực kho lạnh nằm trong sảnh bảo ôn khép kín, camera CCTV giám sát liên tục và máy phát điện dự phòng tự động.',
      tag: 'Hành lang & An ninh' as const
    }
  ]
}

export type StorageUnitCategoryKey = 'MINI' | 'STANDARD' | 'LARGE' | 'COMMERCIAL' | 'CLIMATE'

export function detectUnitCategory(unit: {
  unitCode?: string
  unitTypeName?: string
  category?: string
  areaSqMeters?: number
}): StorageUnitCategoryKey {
  const typeName = (unit.unitTypeName || '').toLowerCase()
  const category = (unit.category || '').toLowerCase()
  const area = unit.areaSqMeters != null ? Number(unit.areaSqMeters) : 5

  if (
    typeName.includes('climate') ||
    typeName.includes('cold') ||
    typeName.includes('lanh') ||
    typeName.includes('lạnh') ||
    typeName.includes('chilled') ||
    category === 'special' ||
    category === 'cold' ||
    category === 'climate'
  ) {
    return 'CLIMATE'
  }
  if (area <= 2.5 || typeName.includes('locker') || typeName.includes('mini') || category === 'mini') {
    return 'MINI'
  }
  if (area >= 10 || typeName.includes('commercial') || typeName.includes('extra large') || typeName.includes('enterprise') || typeName.includes('suite') || category === 'business') {
    return 'COMMERCIAL'
  }
  if (area >= 5 || typeName.includes('large') || typeName.includes('1-bedroom')) {
    return 'LARGE'
  }
  return 'STANDARD'
}

/**
 * Returns a list of 4 illustrative images for any given storage unit,
 * with titles, descriptions, and tags tailored to its type.
 */
export function getStorageUnitImages(unit: {
  unitCode?: string
  unitTypeName?: string
  category?: string
  areaSqMeters?: number
  images?: string[]
}): StorageUnitImage[] {
  // If custom images are provided explicitly, format them
  if (unit.images && unit.images.length > 0) {
    const tags: StorageUnitImage['tag'][] = [
      'Không gian bên trong',
      'Mặt trước & Khóa',
      'Minh họa sức chứa',
      'Hành lang & An ninh'
    ]
    return unit.images.map((url, idx) => ({
      id: `custom-${idx}`,
      url,
      title: `Hình ảnh buồng kho #${idx + 1} - Kho #${unit.unitCode || ''}`,
      description: 'Hình ảnh thực tế không gian và quy cách buồng kho Boxora.',
      tag: tags[idx % tags.length]
    }))
  }

  const categoryKey = detectUnitCategory(unit)
  const baseImages = IMAGE_SETS[categoryKey]

  // Add subtle customization based on unit code if not already included
  const code = unit.unitCode || 'Boxora'
  return baseImages.map(img => ({
    ...img,
    title: img.title.includes('#') ? img.title : `${img.title} #${code}`
  }))
}

/**
 * Returns primary single thumbnail image for unit cards
 */
export function getStorageUnitPrimaryImage(unit: {
  unitCode?: string
  unitTypeName?: string
  category?: string
  areaSqMeters?: number
  images?: string[]
}): string {
  const images = getStorageUnitImages(unit)
  return images[0]?.url || '/assets/units/unit-standard.jpg'
}

/**
 * Returns detailed specifications and real-world capacity info
 */
export function getStorageUnitDetailedSpecs(unit: {
  unitCode?: string
  unitTypeName?: string
  category?: string
  areaSqMeters?: number
  floorLevel?: string
  pricePerMonth?: number
  depositAmount?: number
}): StorageUnitDetailSpecs {
  const categoryKey = detectUnitCategory(unit)
  const area = unit.areaSqMeters != null ? Number(unit.areaSqMeters) : (
    categoryKey === 'MINI' ? 1.0 :
    categoryKey === 'STANDARD' ? 3.0 :
    categoryKey === 'LARGE' ? 6.0 :
    categoryKey === 'COMMERCIAL' ? 12.0 : 4.0
  )

  const volume = Math.round(area * 2.8 * 10) / 10

  switch (categoryKey) {
    case 'MINI':
      return {
        dimensions: '1.0m (D) x 1.0m (R) x 1.2m (C)',
        areaLabel: `${area.toFixed(1)} m²`,
        volumeLabel: `${volume.toFixed(1)} m³`,
        ceilingHeight: '1.2m – 1.5m',
        doorType: 'Cửa thép đơn buồng kho mini sơn tĩnh điện',
        lockType: 'Smart Lock IoT độc lập mở bằng mã số PIN 6 ký tự hoặc App',
        suitableItems: [
          '4 – 6 Vali du lịch cỡ lớn',
          '8 – 12 Thùng carton tiêu chuẩn (40x40x50cm)',
          'Thiết bị điện tử, máy ảnh, laptop, tài liệu đóng hộp',
          'Túi gậy golf, dụng cụ thể thao, đồ lưu niệm'
        ],
        bestFor: 'Sinh viên, cá nhân đi công tác, chuyên gia nước ngoài, nhu cầu lưu trữ hành lý & hồ sơ với chi phí tiết kiệm nhất.',
        securityHighlights: [
          'Camera CCTV giám sát 24/7 có lưu trữ đám mây',
          'Cảm biến chống cậy phá cửa tự động',
          'Hệ thống báo khói & PCCC tự động',
          'Kiểm soát ra vào hành lang bằng thẻ từ & mã PIN'
        ],
        includedAmenities: [
          'Xe đẩy hành lý miễn phí tại sảnh',
          'Đèn chiếu sáng cảm biến chuyển động',
          'Hành lang có điều hòa nhiệt độ mát mẻ',
          'Tiếp cận tự quản 24/7/365'
        ]
      }

    case 'LARGE':
      return {
        dimensions: '2.0m (D) x 3.0m (R) x 2.8m (C)',
        areaLabel: `${area.toFixed(1)} m²`,
        volumeLabel: `${volume.toFixed(1)} m³`,
        ceilingHeight: '2.8m (thoáng khí)',
        doorType: 'Cửa thép cuốn/cửa đôi rộng rãi tiện bốc dỡ',
        lockType: 'Smart Lock IoT mã PIN + App Boxora Mobile',
        suitableItems: [
          'Đồ nội thất nguyên căn hộ 1-2 phòng ngủ',
          'Bộ sofa góc L, bàn trà, kệ TV lớn',
          'Giường đệm Queen/King-size, tủ quần áo tháo lắp',
          'Tủ lạnh side-by-side, máy giặt, máy sấy',
          '50 – 70 Thùng carton đồ đạc gia đình'
        ],
        bestFor: 'Gia đình cải tạo sửa nhà, chuyển chỗ ở dài hạn, người đi định cư nước ngoài, studio ảnh lưu trữ đạo cụ.',
        securityHighlights: [
          'Camera an ninh độ nét cao Full HD 24/7',
          'Đầu phun nước Sprinkler chữa cháy tự động từng buồng',
          'Hệ thống cảm biến nhiệt độ & báo khói độc lập',
          'Nhật ký ra vào cửa ghi nhận trên hệ thống thời gian thực'
        ],
        includedAmenities: [
          'Thang nâng hàng tải trọng 1.500kg kết nối thẳng cửa kho',
          'Hỗ trợ xe nâng tay & xe kéo 4 bánh miễn phí',
          'Sảnh đón xe tải có mái che bốc dỡ',
          'Wifi tốc độ cao phủ sóng toàn bộ cơ sở'
        ]
      }

    case 'COMMERCIAL':
      return {
        dimensions: '3.0m (D) x 4.0m (R) x 3.0m (C)',
        areaLabel: `${area.toFixed(1)} m²`,
        volumeLabel: `${volume.toFixed(1)} m³`,
        ceilingHeight: '3.0m (chuẩn kho logistics)',
        doorType: 'Cửa cuốn motor công nghiệp tự động rộng 2.4m',
        lockType: 'Khóa Smart Lock IoT tích hợp kiểm soát phân quyền nhân viên',
        suitableItems: [
          '6 – 10 Pallet hàng hóa tiêu chuẩn công nghiệp',
          'Hàng tồn kho thương mại điện tử (E-commerce)',
          'Hồ sơ, chứng từ tài chính kế toán lưu trữ 10 năm',
          'Vật tư thiết bị hội nghị, triển lãm, sự kiện',
          'Hàng trăm thùng carton đóng gói xuất nhập khẩu'
        ],
        bestFor: 'Doanh nghiệp thương mại, công ty phân phối hàng, shop online quy mô lớn, đơn vị tổ chức sự kiện.',
        securityHighlights: [
          'Camera giám sát AI nhận diện chuyển động 24/7',
          'PCCC tiêu chuẩn công nghiệp nghiệm thu cấp phép',
          'Bảo vệ tuần tra thường trực cơ sở 24/7',
          'Bảo hiểm phòng kho theo chính sách doanh nghiệp'
        ],
        includedAmenities: [
          'Loading dock bốc xếp cho xe tải từ 2.5 đến 5 tấn',
          'Xe nâng tay thủy lực & xe đẩy pallet miễn phí',
          'Bãi đỗ xe rộng rãi, khu vực chờ cho tài xế giao nhận',
          'Hóa đơn VAT điện tử & chứng từ kế toán đầy đủ'
        ]
      }

    case 'CLIMATE':
      return {
        dimensions: '2.0m (D) x 2.5m (R) x 2.6m (C)',
        areaLabel: `${area.toFixed(1)} m²`,
        volumeLabel: `${volume.toFixed(1)} m³`,
        ceilingHeight: '2.6m (chuẩn kho lạnh walk-in)',
        doorType: 'Cửa xoay bảo ôn kho lạnh chuyên dụng, gioăng cao su dày kín khí',
        lockType: 'Smart Lock IoT + Cảm biến giám sát vi khí hậu & nhiệt độ tự động',
        suitableItems: [
          'Dược phẩm, vắc-xin, sinh phẩm y tế, mỹ phẩm cao cấp',
          'Rượu vang hảo hạng, thực phẩm khô cần duy trì ổn định 2°C – 8°C',
          'Linh kiện điện tử tinh xảo nhạy cảm nhiệt độ & độ ẩm',
          'Mẫu sinh học, hóa chất lưu trữ tiêu chuẩn phòng lab'
        ],
        bestFor: 'Công ty y tế & dược phẩm, phân phối mỹ phẩm, nhà hàng/F&B cao cấp, người sưu tầm rượu vang.',
        securityHighlights: [
          'Màn hình LED hiển thị nhiệt độ (5°C) & cảm biến IoT giám sát liên tục 24/7',
          'Cụm dàn lạnh công nghiệp đa quạt dự phòng, tự động chuyển mạch máy phát điện',
          'Hệ thống chuông & tin nhắn báo động tức thì khi nhiệt độ chênh lệch',
          'Camera CCTV chịu nhiệt âm & cảm biến đóng mở cửa lưu vết thời gian thực'
        ],
        includedAmenities: [
          'Hệ thống giá kệ inox chuyên dụng chống gỉ lắp đặt sẵn dọc 2 bên',
          'Sàn dập gân nhôm chịu lực chống trượt an toàn tuyệt đối',
          'Đèn LED chống ẩm hơi nước (vapor-proof) sáng rõ tự nhiên',
          'Theo dõi trực tiếp biểu đồ nhiệt độ thời gian thực trên Boxora Mobile'
        ]
      }

    case 'STANDARD':
    default:
      return {
        dimensions: '1.5m (D) x 2.0m (R) x 2.6m (C)',
        areaLabel: `${area.toFixed(1)} m²`,
        volumeLabel: `${volume.toFixed(1)} m³`,
        ceilingHeight: '2.6m',
        doorType: 'Cửa cuốn thép bản lề chắc chắn khóa Smart Lock',
        lockType: 'Smart Lock IoT mở bằng mã PIN 6 số hoặc App',
        suitableItems: [
          '1 – 2 Xe máy, xe máy điện hoặc xe đạp thể thao',
          'Bàn làm việc, ghế công thái học, tủ sách nhỏ',
          'Tủ quần áo mini, đệm gấp, quạt máy, lò vi sóng',
          '25 – 35 Thùng carton đóng gói đồ đạc cá nhân/gia đình'
        ],
        bestFor: 'Hộ gia đình chuyển nhà hoặc sửa chữa trọ, shop bán lẻ online, nhân viên văn phòng chuyển đổi nơi ở.',
        securityHighlights: [
          'Camera an ninh giám sát 24/7 trực diện hành lang',
          'Hệ thống phòng cháy chữa cháy Sprinkler tự động',
          'Mã PIN cá nhân bảo mật cao, tự đổi mã trên ứng dụng',
          'Đèn chiếu sáng tự động bật sáng khi mở cửa buồng kho'
        ],
        includedAmenities: [
          'Xe đẩy hàng 4 bánh chịu tải 300kg miễn phí tại sảnh',
          'Thang máy chở hàng chuyên dụng rộng rãi',
          'Ra vào kho tự do 24/7 không cần người mở cửa',
          'Khu vực sảnh đón đóng gói đồ đạc sạch sẽ'
        ]
      }
  }
}
