import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { 
  ShieldCheck, 
  KeyRound, 
  Clock, 
  Building2, 
  ArrowRight, 
  CheckCircle2, 
  Boxes, 
  MapPin, 
  Sparkles, 
  LockKeyhole,
  PhoneCall,
  ChevronRight
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { MOCK_FACILITIES, MOCK_UNIT_TYPES } from '../../services/mockData'
import { useAuth } from '../../context/AuthContext'

export const HomePage: React.FC = () => {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  // Reservation quick-modal
  const [isReserveModalOpen, setIsReserveModalOpen] = useState(false)
  const [selectedFacility, setSelectedFacility] = useState(MOCK_FACILITIES[0].id)
  const [selectedUnitType, setSelectedUnitType] = useState(MOCK_UNIT_TYPES[1].id)
  const [rentalMonths, setRentalMonths] = useState(3)
  const [startDate, setStartDate] = useState('2025-05-01')
  const [bookingSuccess, setBookingSuccess] = useState(false)

  // Size calculator state
  const [storageItems, setStorageItems] = useState({
    boxes: 10,
    luggage: 2,
    mattress: 1,
    appliance: 1,
    furniture: 2
  })

  // Calculate recommended unit
  const totalVolumeEstimate = 
    storageItems.boxes * 0.15 + 
    storageItems.luggage * 0.2 + 
    storageItems.mattress * 1.5 + 
    storageItems.appliance * 1.0 + 
    storageItems.furniture * 1.8

  const recommendedUnitType = 
    totalVolumeEstimate < 1.5 ? MOCK_UNIT_TYPES[0] :
    totalVolumeEstimate < 5.0 ? MOCK_UNIT_TYPES[1] :
    totalVolumeEstimate < 12.0 ? MOCK_UNIT_TYPES[2] : MOCK_UNIT_TYPES[3]

  const activeFacilityObj = MOCK_FACILITIES.find(f => f.id === selectedFacility) || MOCK_FACILITIES[0]
  const activeTypeObj = MOCK_UNIT_TYPES.find(t => t.id === selectedUnitType) || MOCK_UNIT_TYPES[1]
  const totalFee = activeTypeObj.basePricePerMonth * rentalMonths + activeTypeObj.depositAmount

  const handleBookingConfirm = () => {
    if (!isAuthenticated) {
      setIsReserveModalOpen(false)
      navigate('/login?redirect=reserve')
      return
    }
    setBookingSuccess(true)
    setTimeout(() => {
      setBookingSuccess(false)
      setIsReserveModalOpen(false)
      navigate('/portal/customer?tab=my-units')
    }, 1500)
  }

  return (
    <div className="bg-slate-50 min-h-screen text-slate-900 font-sans antialiased">
      
      {/* 1. Hero Section */}
      <section className="relative pt-12 pb-20 border-b border-slate-200 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left 7 cols: Headline & Value Prop */}
            <div className="lg:col-span-7 space-y-6 text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-50 border border-orange-200 text-xs font-semibold text-orange-700">
                <span className="w-2 h-2 rounded-full bg-orange-600 animate-pulse"></span>
                Dịch Vụ Thuê Kho Tự Quản Thông Minh • Ra Vào 24/7
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl tracking-tight font-extrabold text-slate-900 leading-[1.18]">
                Lưu Trữ An Toàn. Quản Lý Dễ Dàng. Truy Cập 24/7.
              </h1>

              <p className="text-base sm:text-lg text-slate-600 max-w-2xl leading-relaxed">
                Giải pháp thuê kho cá nhân, kho gia đình và kho doanh nghiệp tiêu chuẩn cao tại TP.HCM &amp; Hà Nội. Không gian sạch sẽ, điều hòa kiểm soát độ ẩm, mã khóa PIN điện tử riêng biệt cho từng khách hàng.
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Button 
                  size="lg" 
                  onClick={() => setIsReserveModalOpen(true)}
                  className="bg-orange-600 hover:bg-orange-700 text-white shadow-sm font-bold text-sm"
                >
                  Đặt Thuê Kho Ngay
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Link to="/facilities">
                  <Button variant="secondary" size="lg" className="border-slate-200 text-slate-800 text-sm font-semibold">
                    Xem 3 Cơ Sở Kho
                  </Button>
                </Link>
              </div>

              {/* Real Metric Strip */}
              <div className="grid grid-cols-3 gap-6 pt-8 border-t border-slate-100">
                <div>
                  <p className="text-2xl sm:text-3xl font-extrabold text-slate-900">100%</p>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">Tự do ra vào 24/7</p>
                </div>
                <div>
                  <p className="text-2xl sm:text-3xl font-extrabold text-slate-900">550+</p>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">Kho đang hoạt động</p>
                </div>
                <div>
                  <p className="text-2xl sm:text-3xl font-extrabold text-slate-900">22 - 25°C</p>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">Nhiệt độ bảo quản chuẩn</p>
                </div>
              </div>
            </div>

            {/* Right 5 cols: Facility Preview Card */}
            <div className="lg:col-span-5">
              <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-lg p-2.5">
                <div className="relative h-72 sm:h-80 rounded-xl overflow-hidden">
                  <img 
                    src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&q=80&w=1200" 
                    alt="Kho Boxora Tân Bình"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent"></div>
                  <div className="absolute top-3 left-3">
                    <span className="px-2.5 py-1 rounded-md bg-emerald-600 text-white text-xs font-bold shadow-sm">
                      Đang còn kho trống
                    </span>
                  </div>
                  <div className="absolute bottom-4 left-4 right-4 text-white text-left">
                    <p className="text-[11px] font-mono uppercase tracking-wider text-white/80">Cơ sở trung tâm</p>
                    <p className="text-lg font-bold">Boxora Tân Bình — Mega Central</p>
                    <p className="text-xs text-white/80 mt-1 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" /> 52 Bạch Đằng, Phường 2, Tân Bình, TP.HCM
                    </p>
                  </div>
                </div>

                {/* Quick Unit Snapshot */}
                <div className="p-4 space-y-3 bg-white text-left">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-600">Giá thuê chỉ từ</span>
                    <span className="font-bold text-lg text-orange-600">450.000 ₫<span className="text-xs text-slate-500 font-normal"> / tháng</span></span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2.5">
                    <span>Kích thước từ 1.0m² đến 20.0m²</span>
                    <span className="text-emerald-600 font-semibold">Bàn giao sử dụng ngay</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 2. Core Pillars (4 Ưu điểm nổi bật) */}
      <section className="py-16 border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-left">
          <div className="max-w-2xl mb-12">
            <h2 className="text-xs font-bold uppercase tracking-wider text-orange-600 mb-2">Ưu Điểm Vượt Trội</h2>
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Tất cả những gì bạn cần cho một kho lưu trữ an tâm tuyệt đối
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="p-6 border border-slate-200 hover:border-slate-300 transition-all shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center mb-4">
                <LockKeyhole className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-slate-900 mb-2">Mã Khóa Số Riêng Biệt</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Mỗi kho có mã PIN điện tử riêng. Bạn có thể mở khóa từ xa qua điện thoại hoặc chia sẻ mã cho người thân tiện lợi.
              </p>
            </Card>

            <Card className="p-6 border border-slate-200 hover:border-slate-300 transition-all shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-slate-900 mb-2">Điều Hòa Chống Ẩm Mốc</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Hệ thống làm mát 24/7 duy trì 22-25°C và độ ẩm dưới 55% giúp bảo quản tối ưu đồ gỗ, quần áo da, hồ sơ và thiết bị.
              </p>
            </Card>

            <Card className="p-6 border border-slate-200 hover:border-slate-300 transition-all shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-slate-900 mb-2">Thuê Linh Hoạt Theo Tháng</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Không bắt buộc ràng buộc dài hạn. Bạn có thể thuê từ 1 tháng, gia hạn tự động hoặc nâng cấp diện tích kho bất cứ lúc nào.
              </p>
            </Card>

            <Card className="p-6 border border-slate-200 hover:border-slate-300 transition-all shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
                <Building2 className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-slate-900 mb-2">Vị Trí Đắc Địa, Tiện Xe Tải</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Các chi nhánh đều nằm gần trục đường chính, có sân đỗ xe tải bốc xếp rộng rãi và thang tải hàng trọng tải lớn.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* 3. Unit Types & Pricing Matrix (Bảng giá các loại kho) */}
      <section id="sizes" className="py-16 border-b border-slate-200 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-left">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-orange-600 mb-2">Bảng Giá &amp; Kích Thước</h2>
              <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Chọn kích thước kho phù hợp với nhu cầu
              </p>
            </div>
            <p className="text-xs text-slate-500 mt-3 md:mt-0 max-w-md">
              Đơn giá đã bao gồm bảo an 24/7, điện chiếu sáng hành lang và phí dịch vụ dọn dẹp khuôn viên.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {MOCK_UNIT_TYPES.map((type) => (
              <Card key={type.id} className="flex flex-col justify-between p-6 bg-white border border-slate-200 hover:border-orange-500 transition-all shadow-sm">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-xs text-slate-500 font-semibold">{type.dimensions}</span>
                    <Badge variant="outline" className="font-bold">{type.areaSqm} m²</Badge>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">{type.typeName}</h3>
                  <p className="text-xs text-slate-600 mb-4 leading-relaxed">{type.description}</p>
                  
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 mb-6">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Phù hợp lưu trữ:</p>
                    <p className="text-xs text-slate-800 font-medium">{type.suitableFor}</p>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <div className="mb-4">
                    <span className="text-xl font-extrabold text-orange-600 font-unit-code">
                      {type.basePricePerMonth.toLocaleString()} ₫
                    </span>
                    <span className="text-xs text-slate-500"> / tháng</span>
                  </div>
                  <Button 
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs" 
                    variant="primary"
                    onClick={() => {
                      setSelectedUnitType(type.id)
                      setIsReserveModalOpen(true)
                    }}
                  >
                    Chọn &amp; Đặt Giữ Chỗ
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Interactive Size Estimator (Tính diện tích kho) */}
      <section className="py-16 border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-left">
          <div className="max-w-3xl mb-12">
            <h2 className="text-xs font-bold uppercase tracking-wider text-orange-600 mb-2">Ước Tính Thể Tích</h2>
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Chưa biết chọn kho nào? Hãy ước tính nhanh đồ đạc của bạn
            </p>
            <p className="text-xs text-slate-500 mt-2">
              Kéo thanh điều chỉnh số lượng đồ vật bên dưới để xem kích thước kho được gợi ý phù hợp nhất.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Sliders */}
            <div className="lg:col-span-7 bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-6">
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-800 mb-1.5">
                  <span>Thùng carton tiêu chuẩn (chứa sách, quần áo, chén bát)</span>
                  <span className="font-unit-code text-orange-600">{storageItems.boxes} thùng</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="40" 
                  value={storageItems.boxes} 
                  onChange={(e) => setStorageItems({...storageItems, boxes: parseInt(e.target.value)})}
                  className="w-full accent-orange-600 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold text-slate-800 mb-1.5">
                  <span>Vali du lịch &amp; túi xách cỡ lớn</span>
                  <span className="font-unit-code text-orange-600">{storageItems.luggage} vali</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="10" 
                  value={storageItems.luggage} 
                  onChange={(e) => setStorageItems({...storageItems, luggage: parseInt(e.target.value)})}
                  className="w-full accent-orange-600 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold text-slate-800 mb-1.5">
                  <span>Nệm giường ngủ (Nệm đơn / Queen size)</span>
                  <span className="font-unit-code text-orange-600">{storageItems.mattress} tấm</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="4" 
                  value={storageItems.mattress} 
                  onChange={(e) => setStorageItems({...storageItems, mattress: parseInt(e.target.value)})}
                  className="w-full accent-orange-600 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold text-slate-800 mb-1.5">
                  <span>Thiết bị gia dụng lớn (Tủ lạnh, Máy giặt, Lò vi sóng)</span>
                  <span className="font-unit-code text-orange-600">{storageItems.appliance} món</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="6" 
                  value={storageItems.appliance} 
                  onChange={(e) => setStorageItems({...storageItems, appliance: parseInt(e.target.value)})}
                  className="w-full accent-orange-600 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold text-slate-800 mb-1.5">
                  <span>Nội thất lớn (Bàn làm việc, Tủ quần áo, Sofa)</span>
                  <span className="font-unit-code text-orange-600">{storageItems.furniture} món</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="8" 
                  value={storageItems.furniture} 
                  onChange={(e) => setStorageItems({...storageItems, furniture: parseInt(e.target.value)})}
                  className="w-full accent-orange-600 cursor-pointer"
                />
              </div>
            </div>

            {/* Recommendation Result */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-1.5 text-xs font-bold text-orange-600 mb-3">
                <Sparkles className="w-4 h-4" />
                <span>KÍCH THƯỚC ĐƯỢC ĐỀ XUẤT</span>
              </div>

              <h3 className="text-2xl font-extrabold text-slate-900 mb-1">
                {recommendedUnitType.typeName}
              </h3>
              <p className="text-xs font-mono text-slate-500 mb-4">
                Kích thước: {recommendedUnitType.dimensions} ({recommendedUnitType.areaSqm} m²)
              </p>

              <div className="space-y-3 border-y border-slate-100 py-4 my-4 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>Ước tính thể tích đồ:</span>
                  <span className="font-unit-code font-bold text-slate-900">~{totalVolumeEstimate.toFixed(1)} m³</span>
                </div>
                <div className="flex justify-between">
                  <span>Giá thuê theo tháng:</span>
                  <span className="font-unit-code font-bold text-orange-600">{recommendedUnitType.basePricePerMonth.toLocaleString()} ₫</span>
                </div>
                <div className="flex justify-between">
                  <span>Tiền cọc an ninh (hoàn lại):</span>
                  <span className="font-unit-code font-bold text-slate-900">{recommendedUnitType.depositAmount.toLocaleString()} ₫</span>
                </div>
              </div>

              <Button 
                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs" 
                size="lg"
                onClick={() => {
                  setSelectedUnitType(recommendedUnitType.id)
                  setIsReserveModalOpen(true)
                }}
              >
                Đặt Thuê Kích Thước Này
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Contact & Support Banner */}
      <section className="py-12 bg-slate-900 text-white text-left">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-xl font-bold">Cần khảo sát kho hoặc hỗ trợ vận chuyển?</h3>
            <p className="text-xs text-slate-400 mt-1">
              Đội ngũ Boxora sẵn sàng tư vấn loại kho phù hợp và hỗ trợ xe tải vận chuyển đồ tận nhà.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="tel:19006868"
              className="px-5 py-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-md"
            >
              <PhoneCall className="w-4 h-4" />
              <span>Hotline: 1900 6868</span>
            </a>
          </div>
        </div>
      </section>

      {/* Reservation Modal */}
      <Modal
        isOpen={isReserveModalOpen}
        onClose={() => setIsReserveModalOpen(false)}
        title="Đặt Giữ Chỗ Kho Trực Tuyến"
        description="Chọn cơ sở, loại kho và ngày bắt đầu thuê để hoàn tất giữ chỗ nhanh chóng."
      >
        {bookingSuccess ? (
          <div className="py-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Đặt Giữ Chỗ Thành Công!</h3>
            <p className="text-xs text-slate-600 max-w-sm mx-auto">
              Thông tin đặt kho đã được ghi nhận. Đang chuyển hướng bạn tới trang quản lý kho để xem mã PIN và hợp đồng...
            </p>
          </div>
        ) : (
          <div className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Chọn Cơ Sở Kho
              </label>
              <select
                value={selectedFacility}
                onChange={(e) => setSelectedFacility(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-400"
              >
                {MOCK_FACILITIES.map(fac => (
                  <option key={fac.id} value={fac.id}>{fac.name} ({fac.city})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Chọn Loại Kho
              </label>
              <select
                value={selectedUnitType}
                onChange={(e) => setSelectedUnitType(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-400"
              >
                {MOCK_UNIT_TYPES.map(type => (
                  <option key={type.id} value={type.id}>
                    {type.typeName} • {type.areaSqm}m² • {type.basePricePerMonth.toLocaleString()} ₫/tháng
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Ngày Bắt Đầu Thuê
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Kỳ Hạn Thuê
                </label>
                <select
                  value={rentalMonths}
                  onChange={(e) => setRentalMonths(parseInt(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-400"
                >
                  <option value={1}>1 Tháng</option>
                  <option value={3}>3 Tháng (Tiết kiệm 5%)</option>
                  <option value={6}>6 Tháng (Tiết kiệm 10%)</option>
                  <option value={12}>12 Tháng (Tiết kiệm 15%)</option>
                </select>
              </div>
            </div>

            {/* Price Breakdown */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-2 mt-2">
              <div className="flex justify-between text-slate-600">
                <span>Tiền thuê ({rentalMonths} tháng):</span>
                <span className="font-unit-code font-bold text-slate-900">{(activeTypeObj.basePricePerMonth * rentalMonths).toLocaleString()} ₫</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Tiền cọc an ninh (hoàn lại):</span>
                <span className="font-unit-code font-bold text-slate-900">{activeTypeObj.depositAmount.toLocaleString()} ₫</span>
              </div>
              <div className="flex justify-between font-bold text-sm text-slate-900 border-t border-slate-200 pt-2">
                <span>Tổng thanh toán đợt đầu:</span>
                <span className="font-unit-code text-orange-600">{totalFee.toLocaleString()} ₫</span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <Button variant="ghost" onClick={() => setIsReserveModalOpen(false)} className="text-xs">
                Hủy bỏ
              </Button>
              <Button onClick={handleBookingConfirm} className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold">
                Xác Nhận Giữ Chỗ Online
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default HomePage
