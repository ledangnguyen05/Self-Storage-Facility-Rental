import React, { useState } from 'react'

interface InspectedUnit {
  id: string
  size: string
  type: string
  status: 'Available' | 'Rented' | 'Pending' | 'Overdue' | 'Maintenance'
  color: 'emerald' | 'blue' | 'amber' | 'purple' | 'red'
  tenant: string
  contract: string
  due: string
  battery: string
  smartlock: string
  lastAccess: string
}

const INITIAL_UNITS: InspectedUnit[] = [
  // Zone A
  { id: 'A-101', size: '6.5 m²', type: 'Standard Dry', status: 'Available', color: 'emerald', tenant: 'Chưa có khách', contract: 'Trống', due: '--', battery: '98%', smartlock: 'SL-9011', lastAccess: 'Chưa ghi nhận' },
  { id: 'A-102', size: '6.5 m²', type: 'Standard Dry', status: 'Available', color: 'emerald', tenant: 'Chưa có khách', contract: 'Trống', due: '--', battery: '95%', smartlock: 'SL-9012', lastAccess: 'Chưa ghi nhận' },
  { id: 'A-103', size: '12.0 m²', type: 'Standard Roll-up', status: 'Rented', color: 'blue', tenant: 'Công ty TNHH Hóa Mỹ Phẩm An Bình', contract: 'HD-2024-8891', due: '18/11/2025', battery: '92%', smartlock: 'SL-8812', lastAccess: 'Hôm nay 08:15' },
  { id: 'A-104', size: '12.0 m²', type: 'Standard Roll-up', status: 'Rented', color: 'blue', tenant: 'Võ Thành Đạt (Cá nhân)', contract: 'HD-2024-7742', due: '30/08/2025', battery: '89%', smartlock: 'SL-8814', lastAccess: '3 ngày trước' },
  { id: 'A-105', size: '8.0 m²', type: 'Standard Dry', status: 'Rented', color: 'blue', tenant: 'Bùi Thị Thanh Hằng', contract: 'HD-2025-0102', due: '28/02/2026', battery: '100%', smartlock: 'SL-8820', lastAccess: 'Hôm qua 19:40' },
  { id: 'A-106', size: '8.0 m²', type: 'Standard Dry', status: 'Rented', color: 'blue', tenant: 'Startup Logistic Tân Bình Express', contract: 'HD-2024-9118', due: '12/12/2025', battery: '94%', smartlock: 'SL-8822', lastAccess: 'Hôm nay 07:11' },
  { id: 'A-107', size: '8.0 m²', type: 'Standard Dry', status: 'Rented', color: 'blue', tenant: 'Phòng Trưng Bày Scandinavia', contract: 'HD-2024-6550', due: '10/01/2026', battery: '87%', smartlock: 'SL-8830', lastAccess: '5 ngày trước' },
  { id: 'A-108', size: '8.0 m²', type: 'Standard Roll-up', status: 'Pending', color: 'amber', tenant: 'Phạm Hoàng Nam', contract: 'HD-2025-4421', due: '15/05/2025', battery: '99%', smartlock: 'SL-8841', lastAccess: 'Hôm qua 18:24' },
  { id: 'A-109', size: '15.0 m²', type: 'Large Bulk Space', status: 'Rented', color: 'blue', tenant: 'Kho Phụ Kiện Sài Gòn', contract: 'HD-2023-3392', due: '01/10/2025', battery: '91%', smartlock: 'SL-8850', lastAccess: 'Hôm nay 09:50' },
  { id: 'A-110', size: '15.0 m²', type: 'Large Bulk Space', status: 'Maintenance', color: 'red', tenant: 'ĐANG BẢO TRÌ SỬA CỬA CUỐN', contract: 'TICKET-MT-402', due: 'Dự kiến 17:00', battery: 'Cắt nguồn', smartlock: 'SL-8855 (Tạm ngắt)', lastAccess: 'Kỹ thuật viên' },
  { id: 'A-111', size: '10.0 m²', type: 'Standard Roll-up', status: 'Rented', color: 'blue', tenant: 'Chuỗi Coffee Bean Lab', contract: 'HD-2024-5221', due: '19/04/2026', battery: '97%', smartlock: 'SL-8861', lastAccess: 'Hôm qua 14:10' },
  { id: 'A-112', size: '10.0 m²', type: 'Standard Roll-up', status: 'Rented', color: 'blue', tenant: 'Nguyễn Mai Hương', contract: 'HD-2024-9099', due: '05/06/2025', battery: '93%', smartlock: 'SL-8864', lastAccess: '2 ngày trước' },
  { id: 'A-113', size: '10.0 m²', type: 'Standard Roll-up', status: 'Rented', color: 'blue', tenant: 'Studio Nhiếp Ảnh Sáng Tạo', contract: 'HD-2024-1188', due: '11/11/2025', battery: '86%', smartlock: 'SL-8870', lastAccess: 'Hôm nay 06:40' },
  { id: 'A-114', size: '10.0 m²', type: 'Standard Roll-up', status: 'Rented', color: 'blue', tenant: 'Dương Minh Trí', contract: 'HD-2024-2200', due: '24/07/2025', battery: '90%', smartlock: 'SL-8873', lastAccess: '1 tuần trước' },
  { id: 'A-115', size: '10.0 m²', type: 'Standard Roll-up', status: 'Overdue', color: 'purple', tenant: 'Trần Quốc Tuấn (Kinh doanh)', contract: 'HD-2024-0044', due: 'Quá hạn 7 ngày', battery: '88%', smartlock: 'SL-8880 [KHOÁ TẠM]', lastAccess: '7 ngày trước 14:20' },
  { id: 'A-116', size: '10.0 m²', type: 'Standard Dry', status: 'Rented', color: 'blue', tenant: 'Đoàn Thị Bích Ngọc', contract: 'HD-2024-6331', due: '18/09/2025', battery: '92%', smartlock: 'SL-8889', lastAccess: 'Hôm qua 11:30' },
  // Zone B
  { id: 'B-101', size: '20.0 m²', type: 'High Ceiling Bulk', status: 'Rented', color: 'blue', tenant: 'Hàng Tiêu Dùng Á Châu JSC', contract: 'HD-2023-1100', due: '25/12/2025', battery: '95%', smartlock: 'SL-7001', lastAccess: 'Hôm nay 08:30' },
  { id: 'B-102', size: '20.0 m²', type: 'High Ceiling Bulk', status: 'Rented', color: 'blue', tenant: 'Công ty Dược Medipharm', contract: 'HD-2024-5510', due: '15/07/2025', battery: '99%', smartlock: 'SL-7002', lastAccess: 'Hôm qua 16:45' },
  { id: 'B-103', size: '15.0 m²', type: 'Heavy Duty Space', status: 'Rented', color: 'blue', tenant: 'Vật Tư Y Tế Phúc Khang', contract: 'HD-2024-6622', due: '10/11/2025', battery: '94%', smartlock: 'SL-7003', lastAccess: '3 ngày trước' },
  { id: 'B-104', size: '15.0 m²', type: 'Heavy Duty Space', status: 'Rented', color: 'blue', tenant: 'Chuỗi Cửa Hàng Decathlon Depot', contract: 'HD-2024-3312', due: '01/01/2026', battery: '96%', smartlock: 'SL-7004', lastAccess: 'Hôm nay 09:12' },
  { id: 'B-105', size: '12.0 m²', type: 'Standard Roll-up', status: 'Pending', color: 'amber', tenant: 'Đỗ Nhật Huy (App Booking)', contract: 'HD-2025-9901', due: 'Hẹn check-in 14:00', battery: '100%', smartlock: 'SL-7005', lastAccess: 'Chưa check-in' },
  { id: 'B-106', size: '12.0 m²', type: 'Standard Dry', status: 'Rented', color: 'blue', tenant: 'Lê Thanh Thảo', contract: 'HD-2024-7711', due: '18/06/2025', battery: '89%', smartlock: 'SL-7006', lastAccess: '4 ngày trước' },
  { id: 'B-107', size: '12.0 m²', type: 'Standard Dry', status: 'Rented', color: 'blue', tenant: 'Trương Vĩnh Kỳ', contract: 'HD-2024-4481', due: '20/10/2025', battery: '92%', smartlock: 'SL-7007', lastAccess: 'Hôm nay 10:00' },
  { id: 'B-108', size: '8.0 m²', type: 'Standard Dry', status: 'Rented', color: 'blue', tenant: 'Kho Đồ Gia Dụng Thông Minh', contract: 'HD-2024-3388', due: '12/12/2025', battery: '91%', smartlock: 'SL-7008', lastAccess: 'Hôm qua 09:20' },
  { id: 'B-109', size: '8.0 m²', type: 'Standard Dry', status: 'Rented', color: 'blue', tenant: 'Ngô Gia Cường', contract: 'HD-2024-8822', due: '05/05/2025', battery: '90%', smartlock: 'SL-7009', lastAccess: '3 ngày trước' },
  { id: 'B-110', size: '8.0 m²', type: 'Standard Dry', status: 'Available', color: 'emerald', tenant: 'Chưa có khách', contract: 'Trống', due: '--', battery: '97%', smartlock: 'SL-7010', lastAccess: 'Chưa ghi nhận' },
  { id: 'B-111', size: '8.0 m²', type: 'Standard Dry', status: 'Available', color: 'emerald', tenant: 'Chưa có khách', contract: 'Trống', due: '--', battery: '96%', smartlock: 'SL-7011', lastAccess: 'Chưa ghi nhận' },
  { id: 'B-112', size: '15.0 m²', type: 'Standard Dry', status: 'Rented', color: 'blue', tenant: 'Cty Kiến Trúc Nghệ Thuật', contract: 'HD-2024-9912', due: '14/09/2025', battery: '93%', smartlock: 'SL-7012', lastAccess: 'Hôm qua 15:00' },
  { id: 'B-113', size: '15.0 m²', type: 'Standard Dry', status: 'Rented', color: 'blue', tenant: 'Chuỗi Sách Ngoại Văn Bookland', contract: 'HD-2024-4112', due: '30/11/2025', battery: '98%', smartlock: 'SL-7013', lastAccess: 'Hôm nay 09:44' },
  { id: 'B-114', size: '15.0 m²', type: 'Standard Dry', status: 'Rented', color: 'blue', tenant: 'Huỳnh Thanh Tùng', contract: 'HD-2024-5509', due: '01/08/2025', battery: '85%', smartlock: 'SL-7014', lastAccess: '5 ngày trước' },
  { id: 'B-120', size: '20.0 m²', type: 'High Ceiling Bulk', status: 'Overdue', color: 'purple', tenant: 'Kho Đồ Điện Tử Việt Phát', contract: 'HD-2023-8811', due: 'Quá hạn 12 ngày', battery: '82%', smartlock: 'SL-7020 [KHOÁ TẠM]', lastAccess: '12 ngày trước 18:00' },
  { id: 'B-121', size: '20.0 m²', type: 'High Ceiling Bulk', status: 'Rented', color: 'blue', tenant: 'Cửa Hàng Thể Thao ProSport', contract: 'HD-2024-7700', due: '20/09/2025', battery: '94%', smartlock: 'SL-7021', lastAccess: 'Hôm qua 17:15' }
]

export const ManagerDashboard: React.FC = () => {
  const [selectedFloor, setSelectedFloor] = useState<'floor1' | 'floor2'>('floor1')
  const [sizeFilter, setSizeFilter] = useState<'all' | 's' | 'm' | 'l'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUnit, setSelectedUnit] = useState<InspectedUnit>(INITIAL_UNITS.find(u => u.id === 'A-108') || INITIAL_UNITS[0])
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null)

  const handleInspect = (unit: InspectedUnit) => {
    setSelectedUnit(unit)
  }

  const triggerAction = (msg: string) => {
    setActionSuccessMessage(msg)
    setTimeout(() => setActionSuccessMessage(null), 3000)
  }

  const filteredUnits = INITIAL_UNITS.filter(u => {
    // Search query filter
    const matchesSearch = u.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          u.tenant.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          u.contract.toLowerCase().includes(searchQuery.toLowerCase())
    
    // Size filter
    let matchesSize = true
    const sizeNum = parseFloat(u.size)
    if (sizeFilter === 's') matchesSize = sizeNum <= 6.5
    else if (sizeFilter === 'm') matchesSize = sizeNum > 6.5 && sizeNum <= 12
    else if (sizeFilter === 'l') matchesSize = sizeNum > 12

    return matchesSearch && matchesSize
  })

  const zoneAUnits = filteredUnits.filter(u => u.id.startsWith('A-'))
  const zoneBUnits = filteredUnits.filter(u => u.id.startsWith('B-'))

  const getStatusBadgeStyle = (status: InspectedUnit['status']) => {
    switch (status) {
      case 'Available': return 'bg-emerald-100 text-emerald-800 border-emerald-300'
      case 'Rented': return 'bg-blue-100 text-blue-800 border-blue-300'
      case 'Pending': return 'bg-amber-100 text-amber-900 border-amber-300'
      case 'Overdue': return 'bg-purple-100 text-purple-900 border-purple-300'
      case 'Maintenance': return 'bg-red-100 text-red-800 border-red-300'
    }
  }

  const getUnitCardBorder = (unit: InspectedUnit) => {
    const isSelected = selectedUnit.id === unit.id ? 'ring-2 ring-neutral-900 shadow-md' : ''
    switch (unit.color) {
      case 'emerald': return `border-t-4 border-t-emerald-500 hover:bg-emerald-50/50 ${isSelected}`
      case 'blue': return `border-t-4 border-t-blue-600 hover:bg-blue-50/50 ${isSelected}`
      case 'amber': return `border-t-4 border-t-amber-500 hover:bg-amber-50/60 ${isSelected}`
      case 'purple': return `border-t-4 border-t-purple-600 hover:bg-purple-50/60 ${isSelected}`
      case 'red': return `border-t-4 border-t-red-500 hover:bg-red-50/60 ${isSelected}`
    }
  }

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Action Notification Toast */}
      {actionSuccessMessage && (
        <div className="fixed top-24 right-8 z-50 flex items-center gap-2 px-4 py-3 bg-neutral-900 text-white rounded-lg shadow-xl border border-neutral-700 animate-in fade-in duration-200">
          <span className="material-symbols-outlined text-emerald-400 text-[20px]">check_circle</span>
          <span className="text-xs font-semibold">{actionSuccessMessage}</span>
        </div>
      )}

      {/* TOP CONTEXT & OCCUPANCY METRIC STRIP */}
      <section className="flex flex-col lg:flex-row items-stretch justify-between gap-4 p-6 bg-white rounded-xl shadow-sm relative overflow-hidden border border-slate-200">
        <div className="flex flex-col gap-2 max-w-2xl z-10">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-slate-100 font-mono text-xs text-slate-800 uppercase tracking-wider font-semibold">
              <span className="w-2 h-2 rounded-full bg-orange-600 animate-pulse"></span> Trực quan thời gian thực
            </span>
            <span className="text-xs text-slate-500 font-medium">Bản cập nhật: 10:42 SA (Hôm nay)</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Cơ sở Tân Bình - Mega Central (240 Kho tự phục vụ)
          </h1>
          <p className="text-sm text-slate-600">
            Sơ đồ cấu trúc hai tầng chuyên dụng: <strong className="text-slate-900 font-semibold">Tầng 1 (Khu A &amp; Khu B tiêu chuẩn)</strong> và <strong className="text-slate-900 font-semibold">Tầng 2 (Khu C - Kho lạnh Climate-Controlled 18°C-22°C)</strong>.
          </p>
        </div>

        {/* Quick action & Facility Switcher */}
        <div className="flex items-center gap-3 self-start lg:self-center shrink-0 z-10">
          <button 
            type="button" 
            onClick={() => triggerAction('Đã đồng bộ kiểm tra 240 trạm cảm biến LoRaWAN Mesh')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-100 text-slate-800 font-medium text-xs hover:bg-slate-200 transition-all border border-slate-200"
          >
            <span className="material-symbols-outlined text-[18px]">tune</span>
            <span>Cấu hình Cảm biến IoT</span>
          </button>
          <button 
            type="button" 
            onClick={() => triggerAction('Đã tạo ticket khảo sát bổ sung khu vực Bay B')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-orange-600 text-white font-medium text-xs shadow-sm hover:bg-orange-700 transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">add_box</span>
            <span>Thêm Yêu cầu Khảo sát</span>
          </button>
        </div>

        {/* Decorative background blueprint grid */}
        <div className="absolute right-0 top-0 bottom-0 w-96 opacity-5 pointer-events-none hidden md:block">
          <svg height="100%" width="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern height="24" id="facility-blueprint" patternUnits="userSpaceOnUse" width="24">
                <path d="M 24 0 L 0 0 0 24" fill="none" stroke="currentColor" strokeWidth="1"></path>
              </pattern>
            </defs>
            <rect fill="url(#facility-blueprint)" height="100%" width="100%"></rect>
          </svg>
        </div>
      </section>

      {/* 5 CRITICAL KPI TILES */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Tile 1: Total Units */}
        <div className="p-4 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-semibold text-slate-500">Tổng số kho</span>
            <span className="material-symbols-outlined text-slate-400 text-[20px]">warehouse</span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-extrabold font-mono text-slate-900 leading-none">240</span>
            <span className="text-xs text-slate-500">kho đơn vị</span>
          </div>
          <div className="mt-3 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-slate-900 h-full rounded-full" style={{ width: '100%' }}></div>
          </div>
        </div>

        {/* Tile 2: Rented (90%) */}
        <div className="p-4 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-semibold text-slate-500">Đang thuê hoạt động</span>
            <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-mono text-xs font-bold">90.0%</span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-extrabold font-mono text-slate-900 leading-none">216</span>
            <span className="text-xs text-slate-500">/ 240 kho</span>
          </div>
          <div className="mt-3 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-blue-600 h-full rounded-full" style={{ width: '90%' }}></div>
          </div>
        </div>

        {/* Tile 3: Available */}
        <div className="p-4 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-semibold text-slate-500">Kho trống sẵn sàng</span>
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-extrabold font-mono text-emerald-600 leading-none">18</span>
            <span className="text-xs text-slate-500">kho nhận ngay</span>
          </div>
          <div className="mt-3 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-emerald-500 h-full rounded-full" style={{ width: '7.5%' }}></div>
          </div>
        </div>

        {/* Tile 4: Maintenance */}
        <div className="p-4 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-semibold text-slate-500">Đang bảo trì kỹ thuật</span>
            <span className="material-symbols-outlined text-rose-500 text-[18px]">build_circle</span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-extrabold font-mono text-rose-600 leading-none">04</span>
            <span className="text-xs text-slate-500">kho ngưng dùng</span>
          </div>
          <div className="mt-3 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-rose-500 h-full rounded-full" style={{ width: '1.6%' }}></div>
          </div>
        </div>

        {/* Tile 5: Overdue */}
        <div className="p-4 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between col-span-2 md:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-semibold text-slate-500">Quá hạn thanh toán</span>
            <span className="material-symbols-outlined text-purple-600 text-[18px]">lock_clock</span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-extrabold font-mono text-purple-700 leading-none">02</span>
            <span className="text-xs text-slate-500">khóa điện tử tạm</span>
          </div>
          <div className="mt-3 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-purple-600 h-full rounded-full" style={{ width: '0.8%' }}></div>
          </div>
        </div>
      </section>

      {/* INTERACTIVE FLOOR GRID MAP & CONTEXTUAL SLIDE DRAWER CONTAINER */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* LEFT & CENTER: FLOOR MATRIX CANVAS (xl:col-span-8) */}
        <div className="xl:col-span-8 flex flex-col gap-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          {/* Controls Toolbar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 bg-slate-50 p-4 rounded-lg border border-slate-200">
            {/* Floor Selector Tabs */}
            <div className="inline-flex p-1 bg-white rounded-lg border border-slate-200">
              <button 
                type="button" 
                onClick={() => setSelectedFloor('floor1')}
                className={`px-4 py-1.5 rounded-md font-semibold text-xs transition-all ${
                  selectedFloor === 'floor1' 
                    ? 'bg-slate-900 text-white shadow-sm' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tầng 1 (Khu A &amp; Khu B)
              </button>
              <button 
                type="button" 
                onClick={() => setSelectedFloor('floor2')}
                className={`px-4 py-1.5 rounded-md font-semibold text-xs transition-all ${
                  selectedFloor === 'floor2' 
                    ? 'bg-slate-900 text-white shadow-sm' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tầng 2 (Khu C - Climate Cold)
              </button>
            </div>

            {/* Filter and Search Matrix */}
            <div className="flex items-center gap-2 flex-wrap">
              <select 
                value={sizeFilter}
                onChange={(e) => setSizeFilter(e.target.value as any)}
                className="px-3 py-1.5 bg-white rounded-md text-slate-800 text-xs border border-slate-200 focus:outline-none shadow-sm font-medium"
              >
                <option value="all">Tất cả kích thước</option>
                <option value="s">Kho nhỏ S (≤ 6.5m²)</option>
                <option value="m">Kho vừa M (8m² - 12m²)</option>
                <option value="l">Kho lớn L (15m² - 20m²)</option>
              </select>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px] text-slate-400">filter_alt</span>
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Lọc mã #A-..., #B-..." 
                  className="pl-8 pr-3 py-1.5 bg-white text-slate-800 text-xs rounded-md placeholder:text-slate-400 focus:outline-none border border-slate-200 shadow-sm w-36 sm:w-44 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Color Legend Bar */}
          <div className="flex items-center flex-wrap gap-x-5 gap-y-2 px-3 py-2 bg-slate-50/70 rounded-lg border border-slate-200 text-xs font-medium">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span className="text-slate-700">Kho trống sẵn sàng (18)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
              <span className="text-slate-700">Đang thuê hoạt động (216)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              <span className="text-slate-700">Chờ check-in bàn giao (2)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span>
              <span className="text-slate-700">Quá hạn nợ cước (2)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
              <span className="text-slate-700">Bảo trì kỹ thuật (4)</span>
            </div>
          </div>

          {/* VISUAL MATRIX: WAREHOUSE CORRIDOR LAYOUT */}
          <div className="relative bg-slate-100 p-4 rounded-xl border border-slate-200 overflow-x-auto">
            {/* Physical Corridor Blueprint Overlay */}
            <div className="flex items-center justify-between px-3 py-1.5 mb-3 bg-white rounded font-mono text-[11px] text-slate-600 uppercase tracking-wider border border-slate-200 shadow-xs">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px] text-slate-500">meeting_room</span> 
                Cửa nhập hàng Loading Bay #01
              </span>
              <span className="font-semibold text-slate-800">Hành lang lưu thông trục chính: 2.4 mét</span>
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px] text-rose-500">emergency</span> 
                Lối thoát hiểm E-02
              </span>
            </div>

            {/* ZONE A GRID */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs font-bold text-slate-900 uppercase">
                  Phân khu A (Hành lang Aisle North)
                </span>
                <span className="text-[11px] text-slate-500">Lô 16 kho mặt tiền cửa cuốn cơ &amp; điện tử</span>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                {zoneAUnits.map(unit => (
                  <button 
                    key={unit.id}
                    type="button" 
                    onClick={() => handleInspect(unit)}
                    className={`flex flex-col p-2 rounded-lg text-left bg-white transition-all group relative border border-slate-200 ${getUnitCardBorder(unit)}`}
                  >
                    <span className="font-mono text-xs font-bold text-slate-900">#{unit.id}</span>
                    <span className="text-[11px] text-slate-500">{unit.size}</span>
                    <span className={`mt-1 text-[10px] font-bold flex items-center gap-1 ${
                      unit.status === 'Available' ? 'text-emerald-700' :
                      unit.status === 'Rented' ? 'text-blue-700' :
                      unit.status === 'Pending' ? 'text-amber-700' :
                      unit.status === 'Overdue' ? 'text-purple-700' : 'text-rose-700'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        unit.color === 'emerald' ? 'bg-emerald-500' :
                        unit.color === 'blue' ? 'bg-blue-600' :
                        unit.color === 'amber' ? 'bg-amber-500' :
                        unit.color === 'purple' ? 'bg-purple-600' : 'bg-rose-500'
                      }`}></span>
                      {unit.status === 'Available' ? 'Trống' :
                       unit.status === 'Rented' ? 'Thuê' :
                       unit.status === 'Pending' ? 'Chờ giao' :
                       unit.status === 'Overdue' ? 'Quá hạn' : 'Bảo trì'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* ZONE B GRID */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs font-bold text-slate-900 uppercase">
                  Phân khu B (Hành lang Aisle South &amp; Giáp kho hàng xuất)
                </span>
                <span className="text-[11px] text-slate-500">Lô 16 kho trần cao 3.8 mét &amp; Pallet tải nặng</span>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                {zoneBUnits.map(unit => (
                  <button 
                    key={unit.id}
                    type="button" 
                    onClick={() => handleInspect(unit)}
                    className={`flex flex-col p-2 rounded-lg text-left bg-white transition-all group relative border border-slate-200 ${getUnitCardBorder(unit)}`}
                  >
                    <span className="font-mono text-xs font-bold text-slate-900">#{unit.id}</span>
                    <span className="text-[11px] text-slate-500">{unit.size}</span>
                    <span className={`mt-1 text-[10px] font-bold flex items-center gap-1 ${
                      unit.status === 'Available' ? 'text-emerald-700' :
                      unit.status === 'Rented' ? 'text-blue-700' :
                      unit.status === 'Pending' ? 'text-amber-700' :
                      unit.status === 'Overdue' ? 'text-purple-700' : 'text-rose-700'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        unit.color === 'emerald' ? 'bg-emerald-500' :
                        unit.color === 'blue' ? 'bg-blue-600' :
                        unit.color === 'amber' ? 'bg-amber-500' :
                        unit.color === 'purple' ? 'bg-purple-600' : 'bg-rose-500'
                      }`}></span>
                      {unit.status === 'Available' ? 'Trống' :
                       unit.status === 'Rented' ? 'Thuê' :
                       unit.status === 'Pending' ? 'Chờ giao' :
                       unit.status === 'Overdue' ? 'Quá hạn' : 'Bảo trì'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Elevator & Loading Bay Corridor Footer */}
            <div className="mt-4 pt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-200">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1 font-medium">
                  <span className="material-symbols-outlined text-[16px] text-slate-600">elevator</span> 
                  Thang máy tải hàng 3.000kg
                </span>
                <span className="flex items-center gap-1 font-medium text-emerald-700">
                  <span className="material-symbols-outlined text-[16px]">wifi</span> 
                  Mạng lưới IoT LoRaWAN Mesh: Ổn định (Ping 14ms)
                </span>
              </div>
              <span className="font-mono font-semibold text-slate-700">Tổng diện tích mặt sàn Tầng 1: 1.850 m²</span>
            </div>
          </div>
        </div>

        {/* RIGHT: CONTEXTUAL INSPECTION SLIDE-DRAWER PANEL (xl:col-span-4) */}
        <div className="xl:col-span-4 flex flex-col gap-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200 sticky top-24">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-100 text-slate-800">
                <span className="material-symbols-outlined text-[24px]">door_sliding</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">Chi tiết kho giám sát</span>
                <h2 className="text-xl font-bold text-slate-900 font-mono">#{selectedUnit.id}</h2>
              </div>
            </div>
            <span className={`px-2.5 py-1 rounded-full font-mono text-xs font-bold border ${getStatusBadgeStyle(selectedUnit.status)}`}>
              {selectedUnit.status === 'Available' ? 'Kho trống' :
               selectedUnit.status === 'Rented' ? 'Đang thuê' :
               selectedUnit.status === 'Pending' ? 'Chờ bàn giao' :
               selectedUnit.status === 'Overdue' ? 'Quá hạn nợ' : 'Đang bảo trì'}
            </span>
          </div>

          {/* Live Photo of Storage Bay */}
          <div className="relative w-full h-44 rounded-lg overflow-hidden bg-slate-900 border border-slate-200 shadow-inner">
            <img 
              className="w-full h-full object-cover" 
              src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800&auto=format&fit=crop&q=80" 
              alt={`Storage Bay ${selectedUnit.id}`}
            />
            <div className="absolute bottom-2 left-2 px-2.5 py-1 bg-slate-900/85 backdrop-blur-sm rounded text-white font-mono text-[11px] flex items-center gap-1.5 shadow-sm">
              <span className="material-symbols-outlined text-[14px] text-emerald-400">photo_camera</span> 
              Cam An Ninh Giám Sát Bay {selectedUnit.id.startsWith('A') ? 'A-North' : 'B-South'}
            </div>
          </div>

          {/* Unit Spec Table */}
          <div className="flex flex-col gap-1.5 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
            <div className="flex items-center justify-between py-1 text-xs border-b border-slate-200/50">
              <span className="text-slate-500">Diện tích kho:</span>
              <span className="font-mono font-bold text-slate-900">{selectedUnit.size} (2m × 4m × 3m)</span>
            </div>
            <div className="flex items-center justify-between py-1 text-xs border-b border-slate-200/50">
              <span className="text-slate-500">Quy chuẩn kho:</span>
              <span className="font-medium text-slate-800">{selectedUnit.type}</span>
            </div>
            <div className="flex items-center justify-between py-1 text-xs border-b border-slate-200/50">
              <span className="text-slate-500">Khách thuê hiện tại:</span>
              <span className="font-semibold text-slate-900 text-right">{selectedUnit.tenant}</span>
            </div>
            <div className="flex items-center justify-between py-1 text-xs border-b border-slate-200/50">
              <span className="text-slate-500">Mã hợp đồng điện tử:</span>
              <span className="font-mono font-bold text-orange-600">{selectedUnit.contract}</span>
            </div>
            <div className="flex items-center justify-between py-1 text-xs">
              <span className="text-slate-500">Thời hạn thuê:</span>
              <span className="font-mono font-semibold text-slate-800">{selectedUnit.due}</span>
            </div>
          </div>

          {/* Smart Lock & IoT Telemetry */}
          <div className="flex flex-col gap-2 bg-slate-100 p-3.5 rounded-lg border border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-orange-600">lock</span>
                <span className="text-xs font-bold text-slate-800">Smart Lock IoT Seri</span>
              </div>
              <span className="font-mono text-xs font-bold text-slate-900">{selectedUnit.smartlock}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <div className="flex flex-col p-2 bg-white rounded border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Pin SmartLock</span>
                <span className="font-mono text-xs font-bold text-slate-900 flex items-center gap-1 mt-0.5">
                  <span className="material-symbols-outlined text-[16px] text-emerald-600">battery_full</span> 
                  {selectedUnit.battery} (Tốt)
                </span>
              </div>
              <div className="flex flex-col p-2 bg-white rounded border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Truy cập gần nhất</span>
                <span className="font-mono text-[11px] font-bold text-slate-800 mt-0.5">{selectedUnit.lastAccess}</span>
              </div>
            </div>
          </div>

          {/* Operational Action Buttons */}
          <div className="flex flex-col gap-2 pt-1">
            <button 
              type="button" 
              onClick={() => triggerAction(`Đã gửi mã PIN và kích hoạt App cho kho #${selectedUnit.id}`)}
              className="w-full py-2.5 px-4 rounded-lg bg-slate-900 text-white font-semibold text-xs flex items-center justify-center gap-2 hover:bg-neutral-800 transition-all shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">key</span>
              <span>Bàn giao Mã Khóa &amp; Kích hoạt Quyền App</span>
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button 
                type="button" 
                onClick={() => triggerAction(`Nhật ký mở cửa #${selectedUnit.id}: 14 lượt trong 30 ngày qua`)}
                className="py-2 px-3 rounded-lg bg-slate-100 text-slate-800 font-medium text-xs flex items-center justify-center gap-1 hover:bg-slate-200 transition-all border border-slate-200"
              >
                <span className="material-symbols-outlined text-[16px]">history</span>
                <span>Nhật ký mở cửa</span>
              </button>
              <button 
                type="button" 
                onClick={() => triggerAction(`Đã kích hoạt chế độ khóa khẩn cấp cho #${selectedUnit.id}`)}
                className="py-2 px-3 rounded-lg bg-rose-50 text-rose-700 font-medium text-xs flex items-center justify-center gap-1 hover:bg-rose-100 transition-all border border-rose-200"
              >
                <span className="material-symbols-outlined text-[16px]">lock_reset</span>
                <span>Khóa khẩn cấp</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* BOTTOM SECTION: OVERDUE HANDLING & STAFF WORKFORCE ALLOCATION */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT (col-span-7): OVERDUE DELINQUENCY & AUTOMATED LOCKOUT CONSOLE */}
        <div className="lg:col-span-7 flex flex-col gap-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 text-purple-900">
                <span className="material-symbols-outlined text-[22px]">warning</span>
              </div>
              <div className="flex flex-col">
                <h3 className="text-base font-bold text-slate-900">Xử lý Nợ cước Quá hạn (Overdue Handling)</h3>
                <span className="text-xs text-slate-500">Phát hiện 02 hợp đồng vi phạm điều khoản thanh toán kỳ hạn</span>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-purple-50 text-purple-900 font-mono text-xs font-bold border border-purple-200">
              2 Cần xử lý
            </span>
          </div>

          {/* Delinquent Cases Stack */}
          <div className="flex flex-col gap-3">
            {/* Case 1: Unit A-115 */}
            <div className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-purple-50/50 rounded-xl gap-4 border border-purple-200/60">
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-purple-700 text-white font-mono text-xs font-bold">Kho #A-115</span>
                  <span className="text-xs font-bold text-slate-900 truncate">Trần Quốc Tuấn (HĐ #HD-2024-0044)</span>
                </div>
                <div className="flex items-center gap-4 flex-wrap text-slate-600 text-xs mt-1">
                  <span className="text-rose-600 font-semibold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">schedule</span> Quá hạn 7 ngày
                  </span>
                  <span>Cước nợ: <strong className="text-slate-900 font-mono">3.600.000đ</strong></span>
                  <span>Phí phạt: <strong className="text-rose-600 font-mono">250.000đ</strong></span>
                </div>
                <span className="text-[11px] text-slate-500 mt-1">
                  SmartLock SL-8880: Đã kích hoạt chế độ khóa tạm quyền mã PIN và App
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                <button 
                  type="button" 
                  onClick={() => triggerAction('Đã phát tán SMS nhắc nợ và thông báo phí phạt tới khách Trần Quốc Tuấn')}
                  className="px-3 py-2 rounded-lg bg-white text-slate-800 text-xs font-medium border border-slate-200 hover:bg-slate-100 transition-all flex items-center gap-1 shadow-xs"
                >
                  <span className="material-symbols-outlined text-[16px]">forward_to_inbox</span>
                  <span>Gửi SMS/Email</span>
                </button>
                <button 
                  type="button" 
                  onClick={() => triggerAction('Đã khóa cưỡng chế cổng SmartLock kho #A-115')}
                  className="px-3 py-2 rounded-lg bg-purple-700 text-white text-xs font-bold shadow-sm hover:bg-purple-800 transition-all flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]">lock_person</span>
                  <span>Khóa tạm (Lockout)</span>
                </button>
              </div>
            </div>

            {/* Case 2: Unit B-120 */}
            <div className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-purple-50/50 rounded-xl gap-4 border border-purple-200/60">
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-purple-700 text-white font-mono text-xs font-bold">Kho #B-120</span>
                  <span className="text-xs font-bold text-slate-900 truncate">Kho Đồ Điện Tử Việt Phát (HĐ #HD-2023-8811)</span>
                </div>
                <div className="flex items-center gap-4 flex-wrap text-slate-600 text-xs mt-1">
                  <span className="text-rose-600 font-semibold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">schedule</span> Quá hạn 12 ngày
                  </span>
                  <span>Cước nợ: <strong className="text-slate-900 font-mono">4.900.000đ</strong></span>
                  <span>Phí phạt: <strong className="text-rose-600 font-mono">500.000đ</strong></span>
                </div>
                <span className="text-[11px] text-slate-500 mt-1">
                  Đã gửi thông báo lần 2. Dự kiến lập biên bản niêm phong sau 3 ngày nữa
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                <button 
                  type="button" 
                  onClick={() => triggerAction('Đã gửi thông báo nhắc hạn đợt 3 cho Kho Đồ Điện Tử Việt Phát')}
                  className="px-3 py-2 rounded-lg bg-white text-slate-800 text-xs font-medium border border-slate-200 hover:bg-slate-100 transition-all flex items-center gap-1 shadow-xs"
                >
                  <span className="material-symbols-outlined text-[16px]">forward_to_inbox</span>
                  <span>Gửi SMS/Email</span>
                </button>
                <button 
                  type="button" 
                  onClick={() => triggerAction('Đã xuất mẫu Biên bản Niêm phong Tài sản theo quy chuẩn pháp lý')}
                  className="px-3 py-2 rounded-lg bg-orange-600 text-white text-xs font-bold shadow-sm hover:bg-orange-700 transition-all flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]">description</span>
                  <span>Lập Biên Bản</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT (col-span-5): WORKFORCE & ON-DUTY SHIFT ROSTER */}
        <div className="lg:col-span-5 flex flex-col gap-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-100 text-slate-800">
                <span className="material-symbols-outlined text-[22px]">badge</span>
              </div>
              <div className="flex flex-col">
                <h3 className="text-base font-bold text-slate-900">Nhân sự Trực ca (4/6 Nhân viên)</h3>
                <span className="text-xs text-slate-500">Ca sáng: 07:00 - 15:30 (Trạm Mega Central)</span>
              </div>
            </div>
            <button 
              type="button" 
              onClick={() => triggerAction('Mở giao diện phân bổ ca trực nhân sự')}
              className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-800 text-xs font-semibold hover:bg-slate-200 transition-all flex items-center gap-1 border border-slate-200"
            >
              <span className="material-symbols-outlined text-[16px]">person_add</span> Phân công mới
            </button>
          </div>

          {/* Staff List */}
          <div className="flex flex-col gap-2 divide-y divide-slate-100">
            {/* Staff 1 */}
            <div className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-slate-50 transition-all">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img 
                    className="w-10 h-10 rounded-full object-cover border border-slate-200" 
                    src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80" 
                    alt="Lê Hoàng Nam"
                  />
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white"></span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-900">Lê Hoàng Nam</span>
                  <span className="text-[11px] text-slate-500">Lễ tân Check-in &amp; Ký HĐ điện tử</span>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-mono text-[11px] font-bold border border-emerald-200">
                Đang ở Quầy
              </span>
            </div>

            {/* Staff 2 */}
            <div className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-slate-50 transition-all">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img 
                    className="w-10 h-10 rounded-full object-cover border border-slate-200" 
                    src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80" 
                    alt="Trịnh Đình Dũng"
                  />
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white"></span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-900">Trịnh Đình Dũng</span>
                  <span className="text-[11px] text-slate-500">Kỹ thuật viên Trưởng (Sửa #A-110)</span>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 font-mono text-[11px] font-bold border border-blue-200">
                Tại Khu A
              </span>
            </div>

            {/* Staff 3 */}
            <div className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-slate-50 transition-all">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img 
                    className="w-10 h-10 rounded-full object-cover border border-slate-200" 
                    src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80" 
                    alt="Phạm Văn Kiên"
                  />
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white"></span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-900">Phạm Văn Kiên</span>
                  <span className="text-[11px] text-slate-500">Bảo vệ &amp; Tuần tra An ninh IoT</span>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-800 font-mono text-[11px] font-bold border border-amber-200">
                Tuần tra Bay B
              </span>
            </div>

            {/* Staff 4 */}
            <div className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-slate-50 transition-all">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img 
                    className="w-10 h-10 rounded-full object-cover border border-slate-200" 
                    src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80" 
                    alt="Trần Thùy Linh"
                  />
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white"></span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-900">Trần Thùy Linh</span>
                  <span className="text-[11px] text-slate-500">Điều phối Bàn giao &amp; Ký gửi</span>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-md bg-purple-50 text-purple-800 font-mono text-[11px] font-bold border border-purple-200">
                Phòng Vận Hành
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
