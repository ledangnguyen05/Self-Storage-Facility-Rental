import React, { useState } from 'react'
import { useAuth } from '../../context/AuthContext'

export const CustomerDashboard: React.FC = () => {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<'explore' | 'my-units' | 'contracts'>('explore')
  
  // IoT Remote Unlock state
  const [unlockingUnit, setUnlockingUnit] = useState<string | null>(null)
  const [unlockedSuccess, setUnlockedSuccess] = useState<string | null>(null)

  // Copy PIN notification
  const [copiedPin, setCopiedPin] = useState<string | null>(null)

  // Booking Modal
  const [selectedBookingUnit, setSelectedBookingUnit] = useState<{ id: string; name: string; price: string } | null>(null)
  const [bookingSuccess, setBookingSuccess] = useState(false)

  // Renewal Modal
  const [renewUnit, setRenewUnit] = useState<{ id: string; price: string } | null>(null)
  const [renewMonths, setRenewMonths] = useState(3)
  const [renewSuccess, setRenewSuccess] = useState(false)

  // Support Ticket Form State
  const [ticketUnit, setTicketUnit] = useState('A-108')
  const [ticketType, setTicketType] = useState('lock')
  const [ticketContent, setTicketContent] = useState('')
  const [ticketSubmitted, setTicketSubmitted] = useState(false)

  const handleCopy = (id: string, pin: string) => {
    navigator.clipboard?.writeText(pin)
    setCopiedPin(id)
    setTimeout(() => setCopiedPin(null), 2000)
  }

  const handleRemoteUnlock = (unitId: string) => {
    setUnlockingUnit(unitId)
    setTimeout(() => {
      setUnlockingUnit(null)
      setUnlockedSuccess(unitId)
      setTimeout(() => setUnlockedSuccess(null), 4000)
    }, 1800)
  }

  const handleSupportSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setTicketSubmitted(true)
    setTimeout(() => {
      setTicketSubmitted(false)
      setTicketContent('')
    }, 3000)
  }

  return (
    <div className="flex flex-col gap-6 text-left max-w-7xl mx-auto">
      
      {/* Hero Banner with Radial Glow */}
      <section className="relative w-full rounded-2xl bg-white p-6 md:p-8 shadow-sm border border-slate-200 overflow-hidden">
        <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full bg-orange-500/10 blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col gap-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 text-orange-600 font-unit-code text-xs mb-1">
                <span className="material-symbols-outlined text-[16px]">verified_user</span>
                <span>HỆ THỐNG LƯU TRỮ THÔNG MINH IOT CẤP QUỐC TẾ</span>
              </div>
              <h1 className="font-headline text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
                Tìm &amp; Đặt Kho Tự Phục Vụ Thông Minh
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Truy cập 24/7 bằng thẻ số IoT, kiểm soát độ ẩm đa tầng và bảo hiểm tài sản toàn diện.
              </p>
            </div>
            
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl shrink-0">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse"></span>
              <span className="text-xs text-slate-800 font-semibold">
                Tỷ lệ trống mạng lưới: <span className="text-orange-600 font-bold">8.4%</span>
              </span>
            </div>
          </div>

          {/* Quick Filter Bar */}
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Cơ sở vận hành</label>
              <div className="relative">
                <select className="w-full h-10 pl-3 pr-8 bg-white border border-slate-200 text-slate-900 text-xs font-semibold rounded-lg appearance-none cursor-pointer focus:outline-none focus:border-slate-400 shadow-sm">
                  <option value="tb">Cơ sở Tân Bình (TP.HCM)</option>
                  <option value="q7">Cơ sở Quận 7 (Phú Mỹ Hưng)</option>
                  <option value="bt">Cơ sở Bình Thạnh (Hàng Xanh)</option>
                  <option value="cg">Cơ sở Cầu Giấy (Hà Nội)</option>
                </select>
                <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[18px]">
                  expand_more
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Phân loại thể tích</label>
              <div className="relative">
                <select className="w-full h-10 pl-3 pr-8 bg-white border border-slate-200 text-slate-900 text-xs font-semibold rounded-lg appearance-none cursor-pointer focus:outline-none focus:border-slate-400 shadow-sm">
                  <option value="all">Tất cả quy mô kho</option>
                  <option value="mini">Kho Mini (2 - 4 m² | Đồ cá nhân)</option>
                  <option value="home">Kho Gia Đình (6 - 10 m² | Nội thất)</option>
                  <option value="business">Kho Doanh Nghiệp (15 - 30 m² | Pallet)</option>
                  <option value="climate">Kho Lạnh Điều Hòa (22°C Chuẩn)</option>
                </select>
                <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[18px]">
                  expand_more
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Ngày bắt đầu thuê</label>
              <input
                type="date"
                defaultValue="2025-04-20"
                className="w-full h-10 px-3 bg-white border border-slate-200 text-slate-900 text-xs font-semibold rounded-lg focus:outline-none focus:border-slate-400 shadow-sm"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Kỳ hạn thanh toán</label>
              <div className="relative">
                <select className="w-full h-10 pl-3 pr-8 bg-white border border-slate-200 text-slate-900 text-xs font-semibold rounded-lg appearance-none cursor-pointer focus:outline-none focus:border-slate-400 shadow-sm">
                  <option value="1">1 Tháng (Tiêu chuẩn)</option>
                  <option value="3">3 Tháng (Ưu đãi linh hoạt)</option>
                  <option value="6">6 Tháng (Tặng 1 tuần lưu kho)</option>
                  <option value="12">12 Tháng (Giảm ngay 10% cước)</option>
                </select>
                <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[18px]">
                  expand_more
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Tab Navigation Buttons */}
      <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl w-fit border border-slate-200 shadow-sm">
        <button
          onClick={() => setActiveTab('explore')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'explore'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">travel_explore</span>
          <span>Kho Đang Tìm &amp; Đặt Mới</span>
        </button>

        <button
          onClick={() => setActiveTab('my-units')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'my-units'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">garage_door</span>
          <span>Kho Của Tôi Đang Thuê</span>
          <span className="ml-1 px-1.5 py-0.5 rounded-full bg-orange-600 text-white text-[10px] font-bold">
            2 kho
          </span>
        </button>

        <button
          onClick={() => setActiveTab('contracts')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'contracts'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">receipt_long</span>
          <span>Lịch Sử Hợp Đồng &amp; Hóa Đơn</span>
        </button>
      </div>

      {/* TAB 1: KHO ĐANG TÌM & ĐẶT MỚI */}
      {activeTab === 'explore' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-headline text-lg font-bold text-slate-900">
                Kho Tiêu Chuẩn Sẵn Sàng Bàn Giao
              </span>
              <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded-md font-mono text-[11px] font-bold text-slate-600">
                3 Vị trí khả dụng
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Trống bàn giao ngay
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span> Đã khóa giữ chỗ
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            
            {/* Card 1: Kho Mini Standard #A-112 */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
              <div>
                <div className="relative h-44 overflow-hidden bg-slate-800">
                  <div 
                    className="w-full h-full bg-cover bg-center transition-transform duration-500 group-hover:scale-105 opacity-90"
                    style={{ backgroundImage: "url('https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80')" }}
                  ></div>
                  <div className="absolute top-3 left-3 flex gap-1.5">
                    <span className="bg-slate-900/90 backdrop-blur text-white font-unit-code text-xs px-2 py-1 rounded-md">
                      #A-112
                    </span>
                    <span className="bg-orange-600 text-white font-mono text-[10px] uppercase font-bold px-2 py-1 rounded-md">
                      Tầng Trệt
                    </span>
                  </div>
                  <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur px-2.5 py-1 rounded-md text-slate-900 text-xs font-semibold flex items-center gap-1 shadow-sm">
                    <span className="material-symbols-outlined text-orange-600 text-[16px]">thermostat</span>
                    22°C Ổn định
                  </div>
                </div>

                <div className="p-5 flex flex-col gap-3">
                  <div className="flex items-baseline justify-between">
                    <span className="font-headline text-base font-bold text-slate-900">Kho Mini Standard</span>
                    <span className="font-headline text-base font-bold text-orange-600">
                      1.850.000 đ<span className="text-xs font-normal text-slate-500">/tháng</span>
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Phù hợp lưu trữ đồ gia dụng, vali cá nhân, thiết bị văn phòng cỡ vừa.
                  </p>

                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg flex items-center gap-2 text-xs">
                      <span className="material-symbols-outlined text-orange-600 text-[18px]">aspect_ratio</span>
                      <span className="font-data-tabular text-slate-700">2.0m × 2.5m (5m²)</span>
                    </div>
                    <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg flex items-center gap-2 text-xs">
                      <span className="material-symbols-outlined text-orange-600 text-[18px]">deployed_code</span>
                      <span className="font-data-tabular text-slate-700">Thể tích 15m³</span>
                    </div>
                    <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg flex items-center gap-2 text-xs">
                      <span className="material-symbols-outlined text-orange-600 text-[18px]">pin</span>
                      <span className="text-slate-700 font-medium">Cửa cuốn + Smart PIN</span>
                    </div>
                    <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg flex items-center gap-2 text-xs">
                      <span className="material-symbols-outlined text-orange-600 text-[18px]">videocam</span>
                      <span className="text-slate-700 font-medium">CCTV AI bảo vệ 24/7</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-5 pt-0">
                <button
                  onClick={() => setSelectedBookingUnit({ id: 'A-112', name: 'Kho Mini Standard 5m²', price: '1.850.000' })}
                  className="w-full h-10 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                  <span>Đặt Giữ Chỗ &amp; Ký Online</span>
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </button>
              </div>
            </div>

            {/* Card 2: Kho Gia Đình Plus #B-104 */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
              <div>
                <div className="relative h-44 overflow-hidden bg-slate-800">
                  <div 
                    className="w-full h-full bg-cover bg-center transition-transform duration-500 group-hover:scale-105 opacity-90"
                    style={{ backgroundImage: "url('https://images.unsplash.com/photo-1553413077-190dd305871c?auto=format&fit=crop&w=800&q=80')" }}
                  ></div>
                  <div className="absolute top-3 left-3 flex gap-1.5">
                    <span className="bg-slate-900/90 backdrop-blur text-white font-unit-code text-xs px-2 py-1 rounded-md">
                      #B-104
                    </span>
                    <span className="bg-blue-600 text-white font-mono text-[10px] uppercase font-bold px-2 py-1 rounded-md">
                      Tầng 2 (Thang tải)
                    </span>
                  </div>
                  <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur px-2.5 py-1 rounded-md text-slate-900 text-xs font-semibold flex items-center gap-1 shadow-sm">
                    <span className="material-symbols-outlined text-blue-600 text-[16px]">ac_unit</span>
                    Lạnh 20-22°C
                  </div>
                </div>

                <div className="p-5 flex flex-col gap-3">
                  <div className="flex items-baseline justify-between">
                    <span className="font-headline text-base font-bold text-slate-900">Kho Gia Đình Plus</span>
                    <span className="font-headline text-base font-bold text-orange-600">
                      3.400.000 đ<span className="text-xs font-normal text-slate-500">/tháng</span>
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Lưu kho nội thất căn hộ 2 phòng ngủ, nệm, sofa, đàn piano chống ẩm tiêu chuẩn.
                  </p>

                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg flex items-center gap-2 text-xs">
                      <span className="material-symbols-outlined text-orange-600 text-[18px]">aspect_ratio</span>
                      <span className="font-data-tabular text-slate-700">3.0m × 3.0m (9m²)</span>
                    </div>
                    <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg flex items-center gap-2 text-xs">
                      <span className="material-symbols-outlined text-orange-600 text-[18px]">deployed_code</span>
                      <span className="font-data-tabular text-slate-700">Thể tích 27m³</span>
                    </div>
                    <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg flex items-center gap-2 text-xs">
                      <span className="material-symbols-outlined text-orange-600 text-[18px]">sensors</span>
                      <span className="text-slate-700 font-medium">Khóa Bluetooth App</span>
                    </div>
                    <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg flex items-center gap-2 text-xs">
                      <span className="material-symbols-outlined text-orange-600 text-[18px]">dry</span>
                      <span className="text-slate-700 font-medium">Độ ẩm &lt; 55% RH</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-5 pt-0">
                <button
                  onClick={() => setSelectedBookingUnit({ id: 'B-104', name: 'Kho Gia Đình Plus 9m²', price: '3.400.000' })}
                  className="w-full h-10 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                  <span>Đặt Giữ Chỗ &amp; Ký Online</span>
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </button>
              </div>
            </div>

            {/* Card 3: Kho Doanh Nghiệp Pro #C-005 */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
              <div>
                <div className="relative h-44 overflow-hidden bg-slate-800">
                  <div 
                    className="w-full h-full bg-cover bg-center transition-transform duration-500 group-hover:scale-105 opacity-90"
                    style={{ backgroundImage: "url('https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=800&q=80')" }}
                  ></div>
                  <div className="absolute top-3 left-3 flex gap-1.5">
                    <span className="bg-slate-900/90 backdrop-blur text-white font-unit-code text-xs px-2 py-1 rounded-md">
                      #C-005
                    </span>
                    <span className="bg-emerald-600 text-white font-mono text-[10px] uppercase font-bold px-2 py-1 rounded-md">
                      Cửa đôi xe tải
                    </span>
                  </div>
                  <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur px-2.5 py-1 rounded-md text-slate-900 text-xs font-semibold flex items-center gap-1 shadow-sm">
                    <span className="material-symbols-outlined text-orange-600 text-[16px]">forklift</span>
                    Xe tải vào tận cửa
                  </div>
                </div>

                <div className="p-5 flex flex-col gap-3">
                  <div className="flex items-baseline justify-between">
                    <span className="font-headline text-base font-bold text-slate-900">Kho Doanh Nghiệp Pro</span>
                    <span className="font-headline text-base font-bold text-orange-600">
                      6.900.000 đ<span className="text-xs font-normal text-slate-500">/tháng</span>
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Dành cho công ty thương mại điện tử, nhập khẩu phụ tùng hoặc trung chuyển hàng hóa.
                  </p>

                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg flex items-center gap-2 text-xs">
                      <span className="material-symbols-outlined text-orange-600 text-[18px]">aspect_ratio</span>
                      <span className="font-data-tabular text-slate-700">4.0m × 5.0m (20m²)</span>
                    </div>
                    <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg flex items-center gap-2 text-xs">
                      <span className="material-symbols-outlined text-orange-600 text-[18px]">deployed_code</span>
                      <span className="font-data-tabular text-slate-700">Thể tích 65m³</span>
                    </div>
                    <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg flex items-center gap-2 text-xs">
                      <span className="material-symbols-outlined text-orange-600 text-[18px]">security</span>
                      <span className="text-slate-700 font-medium">Bảo hiểm 200 Triệu</span>
                    </div>
                    <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg flex items-center gap-2 text-xs">
                      <span className="material-symbols-outlined text-orange-600 text-[18px]">pallet</span>
                      <span className="text-slate-700 font-medium">Sức chứa 6 Pallet</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-5 pt-0">
                <button
                  onClick={() => setSelectedBookingUnit({ id: 'C-005', name: 'Kho Doanh Nghiệp Pro 20m²', price: '6.900.000' })}
                  className="w-full h-10 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                  <span>Đặt Giữ Chỗ &amp; Ký Online</span>
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* TAB 2: KHO CỦA TÔI ĐANG THUÊ */}
      {activeTab === 'my-units' && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="font-headline text-lg font-bold text-slate-900">
                Kho Của Tôi Đang Thuê (2 Units Active)
              </h2>
              <p className="text-xs text-slate-500">
                Quản lý mã PIN cửa cuốn, lệnh mở khóa IoT từ xa và tình trạng môi trường kho theo thời gian thực.
              </p>
            </div>
            <button
              onClick={() => alert('Đã gửi xung tín hiệu kiểm tra toàn bộ 2 kho. Trạng thái bình thường.')}
              className="px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px]">refresh</span>
              Kiểm tra tình trạng cổng
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Unit A-108 */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[26px]">garage_door</span>
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-unit-code text-base font-bold text-slate-900">KHO #A-108</span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                          Đang hoạt động
                        </span>
                      </div>
                      <span className="text-xs text-slate-500">Cơ sở Tân Bình - Tầng 1 (Lô Đông, Gần Thang Tải 1)</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-red-600 block">Hạn hợp đồng</span>
                    <span className="font-unit-code text-xs font-bold text-slate-900">28/04/2025</span>
                    <span className="text-[10px] text-red-600 font-semibold block">(Còn 12 ngày)</span>
                  </div>
                </div>

                {/* IoT PIN and Remote Unlock Bar */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col gap-3">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="flex items-center gap-1 font-medium">
                      <span className="material-symbols-outlined text-[16px]">lock</span> Khóa Điện Tử Cửa Cuốn
                    </span>
                    <span className="text-orange-600 font-bold">Trạng thái: ĐÃ KHÓA BẢO VỆ</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between shadow-sm">
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-semibold text-slate-400">Mã PIN điện tử:</span>
                        <span className="font-unit-code text-lg text-slate-900 tracking-widest font-black">
                          849204
                        </span>
                      </div>
                      <button
                        onClick={() => handleCopy('A-108', '849204')}
                        className="p-1.5 hover:bg-slate-100 rounded text-slate-500 transition-colors"
                        title="Sao chép PIN"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {copiedPin === 'A-108' ? 'check' : 'content_copy'}
                        </span>
                      </button>
                    </div>

                    <button
                      onClick={() => handleRemoteUnlock('A-108')}
                      disabled={unlockingUnit === 'A-108'}
                      className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-lg px-4 py-2.5 flex items-center justify-center gap-2 transition-all shadow-sm"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {unlockedSuccess === 'A-108' ? 'lock_open' : 'key'}
                      </span>
                      <span>
                        {unlockingUnit === 'A-108' ? 'Đang gửi xung IoT...' : 
                         unlockedSuccess === 'A-108' ? 'CỬA ĐÃ MỞ (30S)' : 'Mở Khóa Từ Xa (IoT)'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Telemetry Metrics */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
                    <span className="text-[10px] text-slate-500 block uppercase font-medium">Diện tích</span>
                    <span className="font-unit-code text-xs font-bold text-slate-800">5.0 m²</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
                    <span className="text-[10px] text-slate-500 block uppercase font-medium">Nhiệt độ</span>
                    <span className="font-unit-code text-xs font-bold text-slate-800">23.5°C</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
                    <span className="text-[10px] text-slate-500 block uppercase font-medium">Cảm biến khói</span>
                    <span className="font-unit-code text-xs font-bold text-emerald-600">Bình thường</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center gap-3">
                <button
                  onClick={() => setRenewUnit({ id: 'A-108', price: '1.850.000' })}
                  className="flex-1 h-10 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
                >
                  Gia Hạn Kho Ngay (+3 Tháng)
                </button>
                <button
                  onClick={() => {
                    setTicketUnit('A-108')
                    setTicketType('lock')
                    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
                  }}
                  className="px-4 h-10 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">support_agent</span>
                  Báo Sự Cố
                </button>
              </div>
            </div>

            {/* Unit B-205 */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[26px]">ac_unit</span>
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-unit-code text-base font-bold text-slate-900">KHO #B-205</span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                          Đang thuê
                        </span>
                      </div>
                      <span className="text-xs text-slate-500">Kho Lưu Hồ Sơ Công Ty • Điều Hòa 22°C • Tầng 2</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Hạn hợp đồng</span>
                    <span className="font-unit-code text-xs font-bold text-slate-900">15/08/2025</span>
                    <span className="text-[10px] text-slate-500 font-semibold block">(Còn 121 ngày)</span>
                  </div>
                </div>

                {/* IoT PIN and Remote Unlock Bar */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col gap-3">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="flex items-center gap-1 font-medium">
                      <span className="material-symbols-outlined text-[16px]">lock</span> Khóa Tự Động Thẻ Từ / App
                    </span>
                    <span className="text-orange-600 font-bold">Trạng thái: ĐÃ KHÓA BẢO VỆ</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between shadow-sm">
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-semibold text-slate-400">Mã PIN điện tử:</span>
                        <span className="font-unit-code text-lg text-slate-900 tracking-widest font-black">
                          931102
                        </span>
                      </div>
                      <button
                        onClick={() => handleCopy('B-205', '931102')}
                        className="p-1.5 hover:bg-slate-100 rounded text-slate-500 transition-colors"
                        title="Sao chép PIN"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {copiedPin === 'B-205' ? 'check' : 'content_copy'}
                        </span>
                      </button>
                    </div>

                    <button
                      onClick={() => handleRemoteUnlock('B-205')}
                      disabled={unlockingUnit === 'B-205'}
                      className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-lg px-4 py-2.5 flex items-center justify-center gap-2 transition-all shadow-sm"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {unlockedSuccess === 'B-205' ? 'lock_open' : 'key'}
                      </span>
                      <span>
                        {unlockingUnit === 'B-205' ? 'Đang gửi xung IoT...' : 
                         unlockedSuccess === 'B-205' ? 'CỬA ĐÃ MỞ (30S)' : 'Mở Khóa Từ Xa (IoT)'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Telemetry Metrics */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
                    <span className="text-[10px] text-slate-500 block uppercase font-medium">Diện tích</span>
                    <span className="font-unit-code text-xs font-bold text-slate-800">12.0 m²</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
                    <span className="text-[10px] text-slate-500 block uppercase font-medium">Nhiệt / Độ ẩm</span>
                    <span className="font-unit-code text-xs font-bold text-slate-800">21.8°C / 48%</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
                    <span className="text-[10px] text-slate-500 block uppercase font-medium">Lần mở gần nhất</span>
                    <span className="font-unit-code text-xs font-bold text-slate-800">Hôm qua, 16:20</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center gap-3">
                <button
                  onClick={() => alert('Cấp quyền thành công: Đã chia sẻ mã token cho người ủy quyền qua SĐT.')}
                  className="flex-1 h-10 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">group_add</span>
                  Cấp Quyền Cho Nhân Viên
                </button>
                <button
                  onClick={() => setRenewUnit({ id: 'B-205', price: '4.200.000' })}
                  className="flex-1 h-10 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
                >
                  Gia Hạn Hợp Đồng
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* TAB 3: LỊCH SỬ HỢP ĐỒNG & HÓA ĐƠN */}
      {activeTab === 'contracts' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-headline text-lg font-bold text-slate-900">
                Lịch Sử Hợp Đồng Thuê Kho &amp; Hóa Đơn VAT
              </h3>
              <span className="text-xs text-slate-500">Dữ liệu đối soát bảo mật chuẩn ISO 27001</span>
            </div>
            <span className="px-2.5 py-1 rounded bg-slate-100 font-mono text-xs font-semibold text-slate-700">
              2 Hợp đồng hoàn tất
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-mono uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4 rounded-l-lg">Mã Hợp Đồng</th>
                  <th className="py-3 px-4">Mã Kho</th>
                  <th className="py-3 px-4">Kỳ Hạn Thuê</th>
                  <th className="py-3 px-4">Tổng Cước</th>
                  <th className="py-3 px-4">Trạng Thái</th>
                  <th className="py-3 px-4 rounded-r-lg text-right">Tác Vụ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                <tr className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-4 px-4 font-unit-code text-xs font-bold text-slate-900">#HD-2024-8891</td>
                  <td className="py-4 px-4 font-bold text-orange-600">#A-108 (5m²)</td>
                  <td className="py-4 px-4 text-slate-700">28/10/2024 - 28/04/2025 (6 Tháng)</td>
                  <td className="py-4 px-4 font-data-tabular font-bold text-slate-900">11.100.000 đ</td>
                  <td className="py-4 px-4">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                      Đã thanh toán đủ
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <button
                      onClick={() => alert('Đang tải hóa đơn VAT điện tử & hợp đồng PDF mã #HD-2024-8891...')}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md font-semibold text-xs transition-colors"
                    >
                      Tải PDF / HĐĐT
                    </button>
                  </td>
                </tr>

                <tr className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-4 px-4 font-unit-code text-xs font-bold text-slate-900">#HD-2024-9104</td>
                  <td className="py-4 px-4 font-bold text-orange-600">#B-205 (12m²)</td>
                  <td className="py-4 px-4 text-slate-700">15/08/2024 - 15/08/2025 (12 Tháng)</td>
                  <td className="py-4 px-4 font-data-tabular font-bold text-slate-900">45.360.000 đ</td>
                  <td className="py-4 px-4">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                      Đã thanh toán đủ
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <button
                      onClick={() => alert('Đang tải hóa đơn VAT điện tử & hợp đồng PDF mã #HD-2024-9104...')}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md font-semibold text-xs transition-colors"
                    >
                      Tải PDF / HĐĐT
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION: TRUNG TÂM PHẢN ỨNG NHANH 24/7 */}
      <section className="bg-white rounded-2xl p-6 md:p-8 border border-slate-200 shadow-sm mt-2">
        <div className="flex flex-col lg:flex-row gap-8 justify-between">
          <div className="flex flex-col gap-3 max-w-md">
            <div className="flex items-center gap-1.5 text-orange-600 font-unit-code text-xs font-bold">
              <span className="material-symbols-outlined text-[18px]">support_agent</span>
              <span>TRUNG TÂM PHẢN ỨNG NHANH 24/7</span>
            </div>
            <h3 className="font-headline text-xl font-bold text-slate-900">
              Cần Hỗ Trợ Kỹ Thuật &amp; Kiểm Soát Truy Cập?
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Gửi yêu cầu tức thì đến Đội ngũ Điều phối Cơ sở Tân Bình. Các sự cố kẹt cửa cuốn hoặc quên mã PIN được xử lý qua hệ thống trong vòng 3 phút.
            </p>
            <div className="mt-2 flex flex-col gap-2 text-slate-600 text-xs">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-orange-600">call</span>
                <span>Hotline khẩn cấp tại trạm: <strong className="text-slate-900">1900 6828 (Ext. 1)</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-orange-600">verified</span>
                <span>Bảo vệ trực chốt tại cổng 24/7 kiểm soát xe tải và hàng ra vào</span>
              </div>
            </div>
          </div>

          <div className="flex-1 bg-slate-50 border border-slate-200 p-6 rounded-xl">
            {ticketSubmitted ? (
              <div className="py-8 text-center flex flex-col items-center justify-center gap-2">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[28px]">check</span>
                </div>
                <h4 className="font-bold text-slate-900 text-sm">Yêu Cầu Đã Được Tiếp Nhận!</h4>
                <p className="text-xs text-slate-500 max-w-xs">
                  Nhân viên trực ca tại Cơ sở Tân Bình đang xử lý và sẽ liên hệ ngay cho anh/chị.
                </p>
              </div>
            ) : (
              <form className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left" onSubmit={handleSupportSubmit}>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Kho lưu trữ liên quan
                  </label>
                  <select
                    value={ticketUnit}
                    onChange={(e) => setTicketUnit(e.target.value)}
                    className="h-10 px-3 bg-white border border-slate-200 text-slate-900 text-xs font-semibold rounded-lg focus:outline-none focus:border-slate-400"
                  >
                    <option value="A-108">Kho #A-108 (Cơ sở Tân Bình)</option>
                    <option value="B-205">Kho #B-205 (Cơ sở Tân Bình)</option>
                    <option value="general">Thắc mắc chung / Chưa thuê kho</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Loại sự cố / Yêu cầu
                  </label>
                  <select
                    value={ticketType}
                    onChange={(e) => setTicketType(e.target.value)}
                    className="h-10 px-3 bg-white border border-slate-200 text-slate-900 text-xs font-semibold rounded-lg focus:outline-none focus:border-slate-400"
                  >
                    <option value="lock">Sự cố khóa Smart Lock / Không mở được cửa</option>
                    <option value="pin">Yêu cầu cấp lại mã PIN mới ngay lập tức</option>
                    <option value="delegate">Cấp quyền mở kho tạm thời cho tài xế/người thân</option>
                    <option value="climate">Yêu cầu kiểm tra nhiệt độ / độ ẩm phòng</option>
                    <option value="billing">Hỗ trợ đối soát hóa đơn VAT &amp; Gia hạn</option>
                  </select>
                </div>

                <div className="sm:col-span-2 flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Mô tả chi tiết nội dung
                  </label>
                  <textarea
                    rows={3}
                    value={ticketContent}
                    onChange={(e) => setTicketContent(e.target.value)}
                    required
                    placeholder="Nhập chi tiết sự cố, mã số thẻ ra vào nếu có hoặc thời gian dự kiến người thân đến nhận hàng..."
                    className="p-3 bg-white border border-slate-200 text-slate-900 text-xs rounded-lg focus:outline-none focus:border-slate-400"
                  ></textarea>
                </div>

                <div className="sm:col-span-2 flex items-center justify-between pt-2">
                  <span className="text-[11px] text-slate-400 font-mono">Thời gian phản hồi cam kết: &lt; 3 phút</span>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-lg transition-colors shadow-sm flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">send</span>
                    Gửi Yêu Cầu Hỗ Trợ
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Booking Drawer / Modal */}
      {selectedBookingUnit && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            {bookingSuccess ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <span className="material-symbols-outlined text-[28px]">check_circle</span>
                </div>
                <h3 className="font-headline text-lg font-bold text-slate-900">
                  Đặt Giữ Chỗ Thành Công!
                </h3>
                <p className="text-xs text-slate-600">
                  Mã đặt chỗ của bạn: <strong>#RES-2025-9988</strong>. Hợp đồng điện tử và mã PIN đã được tạo.
                </p>
                <button
                  onClick={() => {
                    setBookingSuccess(false)
                    setSelectedBookingUnit(null)
                    setActiveTab('my-units')
                  }}
                  className="mt-2 w-full py-2.5 bg-slate-900 text-white text-xs font-bold rounded-lg"
                >
                  Đến Danh Sách Kho Của Tôi
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="font-headline text-base font-bold text-slate-900">
                      Xác Nhận Thuê Kho Online
                    </h3>
                    <span className="text-xs text-slate-500">Mã kho: #{selectedBookingUnit.id}</span>
                  </div>
                  <button
                    onClick={() => setSelectedBookingUnit(null)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <span className="material-symbols-outlined text-[20px]">close</span>
                  </button>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Loại kho:</span>
                    <span className="font-bold text-slate-900">{selectedBookingUnit.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Đơn giá tháng:</span>
                    <span className="font-unit-code font-bold text-orange-600">{selectedBookingUnit.price} đ</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Tiền cọc an ninh (hoàn lại):</span>
                    <span className="font-unit-code font-bold text-slate-900">{selectedBookingUnit.price} đ</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Kỳ hạn thuê</label>
                  <select className="w-full h-10 px-3 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800">
                    <option value="1">1 Tháng</option>
                    <option value="3">3 Tháng (Giảm 5%)</option>
                    <option value="6">6 Tháng (Giảm 10%)</option>
                    <option value="12">12 Tháng (Giảm 15%)</option>
                  </select>
                </div>

                <div className="pt-3 flex gap-2">
                  <button
                    onClick={() => setSelectedBookingUnit(null)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    onClick={() => setBookingSuccess(true)}
                    className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold shadow-sm"
                  >
                    Ký Online &amp; Thanh Toán
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Renewal Modal */}
      {renewUnit && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            {renewSuccess ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <span className="material-symbols-outlined text-[28px]">check_circle</span>
                </div>
                <h3 className="font-headline text-lg font-bold text-slate-900">
                  Gia Hạn Hợp Đồng Thành Công!
                </h3>
                <p className="text-xs text-slate-600">
                  Hạn thuê kho #{renewUnit.id} đã được tự động cộng thêm {renewMonths} tháng.
                </p>
                <button
                  onClick={() => {
                    setRenewSuccess(false)
                    setRenewUnit(null)
                  }}
                  className="mt-2 w-full py-2.5 bg-slate-900 text-white text-xs font-bold rounded-lg"
                >
                  Đóng
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="font-headline text-base font-bold text-slate-900">
                      Gia Hạn Thuê Kho #{renewUnit.id}
                    </h3>
                    <span className="text-xs text-slate-500">Cơ sở Tân Bình - Mega Central</span>
                  </div>
                  <button
                    onClick={() => setRenewUnit(null)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <span className="material-symbols-outlined text-[20px]">close</span>
                  </button>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Thời gian gia hạn thêm</label>
                  <select
                    value={renewMonths}
                    onChange={(e) => setRenewMonths(parseInt(e.target.value))}
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                  >
                    <option value={1}>1 Tháng (+1.850.000 đ)</option>
                    <option value={3}>3 Tháng (+5.272.500 đ - Tiết kiệm 5%)</option>
                    <option value={6}>6 Tháng (+9.990.000 đ - Tiết kiệm 10%)</option>
                    <option value={12}>12 Tháng (+18.870.000 đ - Tiết kiệm 15%)</option>
                  </select>
                </div>

                <div className="pt-3 flex gap-2">
                  <button
                    onClick={() => setRenewUnit(null)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    onClick={() => setRenewSuccess(true)}
                    className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold shadow-sm"
                  >
                    Xác Nhận Gia Hạn
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}

