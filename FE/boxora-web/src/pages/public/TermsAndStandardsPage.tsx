import React from 'react'
import { Link } from 'react-router-dom'
import {
  ShieldCheck,
  Lock,
  CheckCircle2,
  DollarSign,
  Flame,
  ArrowLeft,
  Printer,
  FileCheck2,
  AlertOctagon,
  Award,
  Sparkles,
  ChevronRight,
  PhoneCall,
  CheckSquare
} from 'lucide-react'
import boxoraLogo from '../../assets/boxora-logo.png'
import futuristicBoxoraBg from '../../assets/Futuristic BOXORA Smart Warehouse.png'

interface StandardModule {
  id: string
  badge: string
  badgeColor: string
  title: string
  subtitle: string
  icon: React.ComponentType<{ className?: string }>
  iconBg: string
  iconColor: string
  borderColor: string
  accentColor: string
  kpiLabel: string
  kpiValue: string
  items: {
    label: string
    detail: string
  }[]
  tag: string
}

export const TermsAndStandardsPage: React.FC = () => {
  const handlePrint = () => {
    window.print()
  }

  // 6 CORE OPERATIONAL MODULES (All on 1 single unified dashboard grid)
  const modules: StandardModule[] = [
    {
      id: 'contract',
      badge: 'Luật GDĐT 20/2023',
      badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-400/30',
      title: '1. Hợp Đồng & Pháp Lý Số',
      subtitle: 'Hiệu lực văn bản điện tử & Quyền truy cập 24/7/365',
      icon: FileCheck2,
      iconBg: 'bg-sky-500/20',
      iconColor: 'text-sky-300',
      borderColor: 'hover:border-sky-500/50',
      accentColor: 'text-sky-400',
      kpiLabel: 'Thời hạn thuê',
      kpiValue: '1 ngày – 5 năm linh hoạt',
      tag: 'Pháp lý 100%',
      items: [
        {
          label: 'Hiệu lực pháp lý điện tử',
          detail: 'Hợp đồng được ký số thông qua OTP và sinh trắc học, có giá trị pháp lý đầy đủ tương đương văn bản công chứng theo quy định của Luật Giao dịch Điện tử Việt Nam.'
        },
        {
          label: 'Tự do truy cập 24/7/365',
          detail: 'Khách hàng có toàn quyền ra vào cơ sở kho Boxora và mở kho lưu trữ cá nhân bất kỳ lúc nào trong ngày, 365 ngày/năm mà không cần đặt lịch hẹn trước hay chờ nhân viên trực.'
        },
        {
          label: 'Bảo mật tài khoản & PIN',
          detail: 'Người thuê tự bảo quản mã số PIN và mã QR truy cập. Boxora không can thiệp hay chia sẻ thông tin truy cập cá nhân cho bên thứ ba khi chưa có sự chấp thuận hợp pháp.'
        }
      ]
    },
    {
      id: 'safety',
      badge: 'QCVN 06:2022/BXD',
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-400/30',
      title: '2. Quy Chuẩn PCCC & Khí Hậu',
      subtitle: 'Chữa cháy khí sạch FM-200 & Kiểm soát vi khí hậu',
      icon: Flame,
      iconBg: 'bg-amber-500/20',
      iconColor: 'text-amber-300',
      borderColor: 'hover:border-amber-500/50',
      accentColor: 'text-amber-400',
      kpiLabel: 'Cảm biến giám sát',
      kpiValue: 'Thermal AI từng ô kho',
      tag: 'Không dùng nước',
      items: [
        {
          label: 'Hệ thống khí sạch FM-200/Aerosol',
          detail: 'Dập tắt đám cháy trong vòng 10 giây mà hoàn toàn không dùng nước, bảo vệ tuyệt đối thiết bị vi tính, máy móc tinh xảo và giấy tờ hợp đồng không bị hư hỏng do ẩm ướt.'
        },
        {
          label: 'Kiểm soát ẩm độ 45% – 55% RH',
          detail: 'Hệ thống hút ẩm công nghiệp hoạt động 24/7 loại bỏ nguy cơ nấm mốc, mối mọt, rỉ sét linh kiện kim loại và bảo quản tài liệu lưu trữ dài hạn an toàn tuyệt đối.'
        },
        {
          label: 'Nhiệt độ phòng ổn định 20°C – 25°C',
          detail: 'Điều hòa luân chuyển khí mát inverter đảm bảo môi trường lý tưởng cho đồ da đắt tiền, thời trang cao cấp, thiết bị điện tử và bộ sưu tập rượu vang.'
        }
      ]
    },
    {
      id: 'security',
      badge: 'ISO/IEC 27001',
      badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/30',
      title: '3. An Ninh & Khóa IoT',
      subtitle: 'Khóa điện tử độc lập & Camera AI hành lang AES-256',
      icon: Lock,
      iconBg: 'bg-cyan-500/20',
      iconColor: 'text-cyan-300',
      borderColor: 'hover:border-cyan-500/50',
      accentColor: 'text-cyan-400',
      kpiLabel: 'Nhật ký truy cập',
      kpiValue: 'Real-time Audit Log',
      tag: 'Bảo mật ngân hàng',
      items: [
        {
          label: 'Khóa điện tử độc lập tuyệt đối',
          detail: 'Nhân viên Boxora không nắm giữ bất kỳ chìa khóa vật lý hay thẻ dự phòng nào của ô kho. Quyền mở cửa chỉ do duy nhất khách hàng nắm giữ trên thiết bị cá nhân.'
        },
        {
          label: 'Mã hóa truyền tin AES-256 GCM',
          detail: 'Toàn bộ tín hiệu đóng mở cửa từ ứng dụng điện thoại đến bộ điều khiển chốt khóa IoT được mã hóa đa tầng theo chuẩn bảo mật ngân hàng quốc tế.'
        },
        {
          label: 'Camera AI 4K hành lang 24/7',
          detail: 'Giám sát lối đi chung 24/7 nhận diện chuyển động bất thường. Boxora cam kết tuyệt đối không lắp đặt góc quay vào bên trong không gian riêng tư của ô kho.'
        }
      ]
    },
    {
      id: 'deposit',
      badge: 'Hoàn Tiền 100%',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
      title: '4. Cọc & Hoàn Tiền 24 Giờ',
      subtitle: 'Minh bạch tài chính & Ân hạn thanh toán 3 ngày',
      icon: DollarSign,
      iconBg: 'bg-emerald-500/20',
      iconColor: 'text-emerald-300',
      borderColor: 'hover:border-emerald-500/50',
      accentColor: 'text-emerald-400',
      kpiLabel: 'Xử lý trả kho',
      kpiValue: 'Nghiệm thu 60p • Tiền về 24h',
      tag: 'Cam kết 24 Giờ',
      items: [
        {
          label: 'Hoàn 100% tiền cọc trong 24 giờ',
          detail: 'Sau khi khách hàng dọn sạch tài sản và bấm Trả kho trên ứng dụng, đội ngũ kỹ thuật nghiệm thu hiện trạng sạch sẽ và tiền cọc được hoàn về tài khoản trong tối đa 24 giờ.'
        },
        {
          label: 'Thời gian ân hạn 03 ngày (Grace Period)',
          detail: 'Khi hóa đơn định kỳ đến hạn, khách hàng có thêm 03 ngày ân hạn để gia hạn hợp đồng mà không phải chịu bất kỳ khoản tiền phạt trễ hạn nào.'
        },
        {
          label: 'Không chi phí ẩn phát sinh',
          detail: 'Mức giá niêm yết trên hợp đồng đã bao gồm toàn bộ chi phí điện, nước, điều hòa, PCCC, dọn dẹp vệ sinh khuôn viên chung và an ninh cơ sở.'
        }
      ]
    },
    {
      id: 'prohibited',
      badge: 'Cấm Tuyệt Đối',
      badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-400/30',
      title: '5. Danh Mục Hàng Cấm',
      subtitle: 'Bảo vệ an toàn cộng đồng & Tuân thủ pháp luật',
      icon: AlertOctagon,
      iconBg: 'bg-rose-500/20',
      iconColor: 'text-rose-300',
      borderColor: 'hover:border-rose-500/50',
      accentColor: 'text-rose-400',
      kpiLabel: 'Chế tài vi phạm',
      kpiValue: 'Hủy HĐ & Phối hợp CA',
      tag: 'Nghiêm ngặt',
      items: [
        {
          label: 'Chất dễ cháy nổ & Hóa chất độc hại',
          detail: 'Nghiêm cấm lưu trữ xăng, dầu hỏa, bình gas, khí nén, pháo hoa, pin ắc quy axit hở, hóa chất ăn mòn, chất độc sinh học và chất phóng xạ.'
        },
        {
          label: 'Hàng hóa phi pháp & Vũ khí quân dụng',
          detail: 'Tuyệt đối cấm cất giữ ma túy, chất kích thích bị cấm, súng đạn, vật liệu nổ, công cụ hỗ trợ không phép, hàng buôn lậu hoặc tài sản do phạm tội mà có.'
        },
        {
          label: 'Sinh vật sống & Thực phẩm tươi sống',
          detail: 'Cấm giữ gia súc, thú cưng, cây cảnh sống hoặc các loại thực phẩm tươi sống dễ ôi thiu phát sinh vi khuẩn, mùi khó chịu hoặc thu hút côn trùng.'
        }
      ]
    },
    {
      id: 'insurance',
      badge: 'Đền Bù Tới 500Tr',
      badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-400/30',
      title: '6. Bảo Hiểm & Đền Bù',
      subtitle: 'Bảo trợ rủi ro bởi Bảo Việt / PTI toàn diện',
      icon: Award,
      iconBg: 'bg-indigo-500/20',
      iconColor: 'text-indigo-300',
      borderColor: 'hover:border-indigo-500/50',
      accentColor: 'text-indigo-400',
      kpiLabel: 'Thời gian giải ngân',
      kpiValue: 'Tối đa 07 ngày làm việc',
      tag: 'Bảo trợ uy tín',
      items: [
        {
          label: 'Gói bảo hiểm tiêu chuẩn (Miễn phí)',
          detail: 'Mỗi hợp đồng thuê ô kho tự động được cấp hạn mức bảo hiểm cơ bản lên đến 50.000.000 VNĐ cho các sự cố hỏa hoạn hoặc thiên tai bất khả kháng.'
        },
        {
          label: 'Gói bảo hiểm nâng cao (Tùy chọn)',
          detail: 'Khách hàng có thể đăng ký gói bảo hiểm tài sản cao cấp với hạn mức bồi thường mở rộng lên đến 500.000.000 VNĐ cho các thiết bị công nghệ, tác phẩm nghệ thuật.'
        },
        {
          label: 'Quy trình giám định & Bồi thường 7 ngày',
          detail: 'Thủ tục giám định độc lập cùng đơn vị bảo hiểm uy tín (Bảo Việt / PTI). Thời gian hoàn tất thanh toán bồi thường tối đa 07 ngày làm việc kể từ khi duyệt hồ sơ.'
        }
      ]
    }
  ]

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white relative">
      {/* Background Futuristic Image with Semi-transparent Overlay */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <img
          src={futuristicBoxoraBg}
          alt="Boxora Background"
          className="w-full h-full object-cover object-center opacity-25 filter blur-xs scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/85 via-slate-950/90 to-slate-950" />
      </div>

      {/* ============================================================ */}
      {/* 1. TOP HEADER NAVIGATION                                     */}
      {/* ============================================================ */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-8 lg:px-12 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-cyan-400" />
            <span className="hidden sm:inline">Về trang chủ</span>
          </Link>
          <div className="h-5 w-px bg-slate-800" />
          <Link to="/" className="flex items-center gap-2.5">
            <img src={boxoraLogo} alt="BOXORA" className="h-8 w-auto object-contain" />
            <span className="hidden md:inline text-xs font-mono font-bold tracking-wider text-cyan-400 uppercase">
              • SMART STORAGE DASHBOARD
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          {/* Print Button */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200 transition-all cursor-pointer"
            title="In toàn bộ văn bản quy chuẩn"
          >
            <Printer className="w-4 h-4 text-cyan-400" />
            <span className="hidden sm:inline">In văn bản</span>
          </button>

          {/* Login Link */}
          <Link
            to="/login"
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 text-slate-950 text-xs font-black transition-all shadow-md shadow-cyan-500/20"
          >
            Đăng nhập ngay
          </Link>
        </div>
      </header>

      {/* ============================================================ */}
      {/* 2. HERO BANNER: STRICT USER TYPOGRAPHY & OVERLAY             */}
      {/* ============================================================ */}
      <section className="relative z-10 px-4 sm:px-8 lg:px-12 py-10 lg:py-14 border-b border-slate-800/80 overflow-hidden">
        {/* Subtle radial glow */}
        <div className="absolute top-0 left-1/3 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/3 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-6xl mx-auto text-left relative z-10 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-400/40 text-cyan-300 text-xs font-mono font-bold">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span>BỘ QUY CHUẨN VẬN HÀNH NGHIỆP VỤ KHO BOXORA 2026</span>
          </div>

          {/* Tiêu đề chính: trắng #FFFFFF, font đậm 800–900, text-shadow: 0 3px 8px rgba(0,0,0,0.8) */}
          <h1
            className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight"
            style={{
              color: '#FFFFFF',
              fontWeight: 900,
              textShadow: '0 3px 8px rgba(0,0,0,0.8)'
            }}
          >
            DASHBOARD QUY CHUẨN &amp; ĐIỀU KHOẢN VẬN HÀNH KHO BOXORA
          </h1>

          {/* Tiêu đề phụ: cyan #00E5FF, có bóng đổ xanh đậm */}
          <h2
            className="text-base sm:text-lg lg:text-xl font-extrabold tracking-wide uppercase"
            style={{
              color: '#00E5FF',
              textShadow: '0 2px 10px rgba(0, 119, 182, 0.85)'
            }}
          >
            KỶ NGUYÊN KHO TỰ QUẢN THÔNG MINH • CHẠM ĐỂ MỞ KHÓA • AN TÂM LƯU GIỮ • TRUY CẬP 24/7
          </h2>

          {/* Mô tả: trắng ngà #F1F5F9 */}
          <p
            className="text-sm sm:text-base max-w-4xl leading-relaxed"
            style={{ color: '#F1F5F9' }}
          >
            Hệ thống quy chuẩn vận hành kho tự quản thông minh khép kín: hợp đồng điện tử hợp chuẩn, tiêu chuẩn PCCC khí sạch FM-200 không dùng nước, khóa IoT độc lập mã hóa chuẩn ngân hàng ISO/IEC 27001 và chính sách hoàn cọc minh bạch trong 24 giờ.
          </p>

          {/* Quick KPI stats dashboard */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 pt-4">
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm">
              <span className="block text-[11px] font-mono text-cyan-400 font-bold uppercase">Hợp đồng điện tử</span>
              <span className="block text-sm sm:text-base font-black text-white mt-0.5">Pháp lý 100%</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm">
              <span className="block text-[11px] font-mono text-cyan-400 font-bold uppercase">PCCC Khí sạch</span>
              <span className="block text-sm sm:text-base font-black text-white mt-0.5">FM-200 10 Giây</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm">
              <span className="block text-[11px] font-mono text-cyan-400 font-bold uppercase">Bảo mật IoT</span>
              <span className="block text-sm sm:text-base font-black text-white mt-0.5">ISO/IEC 27001</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm">
              <span className="block text-[11px] font-mono text-cyan-400 font-bold uppercase">Hoàn cọc</span>
              <span className="block text-sm sm:text-base font-black text-white mt-0.5">Trong 24 Giờ</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm">
              <span className="block text-[11px] font-mono text-cyan-400 font-bold uppercase">Bảo hiểm đền bù</span>
              <span className="block text-sm sm:text-base font-black text-white mt-0.5">Đến 500 Triệu</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm">
              <span className="block text-[11px] font-mono text-cyan-400 font-bold uppercase">Kiểm soát ẩm</span>
              <span className="block text-sm sm:text-base font-black text-white mt-0.5">45% – 55% RH</span>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 3. UNIFIED ALL-IN-ONE DASHBOARD GRID (NO SUB-TABS)           */}
      {/* ============================================================ */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 lg:px-12 py-8 lg:py-12 space-y-8">
        
        {/* Dashboard Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left">
          <div>
            <h3 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
              <span>Bảng Tổng Hợp 6 Trụ Cột Vận Hành</span>
              <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-xs font-mono font-bold">
                Tất cả trên 1 Dashboard
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Toàn bộ tiêu chuẩn được trình bày trực quan trên một màn hình thống nhất, thuận tiện đối chiếu và theo dõi.
            </p>
          </div>
        </div>

        {/* 6 MODULES GRID: NO SUB-TABS, DISPLAYED SIMULTANEOUSLY */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((m) => {
            const Icon = m.icon
            return (
              <div
                key={m.id}
                className={`p-6 rounded-3xl bg-slate-900/80 backdrop-blur-md border border-slate-800 ${m.borderColor} shadow-xl hover:shadow-cyan-500/10 transition-all duration-300 flex flex-col justify-between space-y-4 text-left`}
              >
                <div className="space-y-3.5">
                  {/* Module Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-9 h-9 rounded-xl ${m.iconBg} flex items-center justify-center ${m.iconColor}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className={`text-xs font-black uppercase tracking-wider ${m.accentColor}`}>
                        {m.title}
                      </span>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold border ${m.badgeColor}`}>
                      {m.badge}
                    </span>
                  </div>

                  {/* Feature Title: Trắng #FFFFFF, font đậm */}
                  <h4 className="text-base font-extrabold text-white leading-snug">
                    {m.subtitle}
                  </h4>

                  {/* Clause Items List */}
                  <div className="space-y-2.5 pt-1">
                    {m.items.map((item, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className={`w-3.5 h-3.5 ${m.accentColor} shrink-0`} />
                          {/* Tên tính năng: trắng #FFFFFF */}
                          <span className="text-xs font-bold text-white">
                            {item.label}
                          </span>
                        </div>
                        {/* Phần chữ phụ / chi tiết dùng #D1E5F0 */}
                        <p
                          className="text-[12px] leading-relaxed pl-5 font-normal"
                          style={{ color: '#D1E5F0' }}
                        >
                          {item.detail}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Module Footer Meta */}
                <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-slate-400">{m.kpiLabel}: <strong className="text-white">{m.kpiValue}</strong></span>
                  <span className={`font-bold ${m.accentColor}`}>{m.tag}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* ============================================================ */}
        {/* 4. COMPARISON DASHBOARD: BOXORA VS TRADITIONAL WAREHOUSES   */}
        {/* ============================================================ */}
        <section className="p-6 sm:p-8 rounded-3xl bg-slate-900/70 border border-slate-800 backdrop-blur-md text-left space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-widest">
                ĐỐI CHIẾU TIÊU CHUẨN NGHIỆP VỤ
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-white mt-1">
                Boxora Smart Storage so với Kho Lưu Trữ Truyền Thống
              </h3>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-cyan-500/10 border border-cyan-400/30 text-cyan-300 text-xs font-bold font-mono">
              <CheckSquare className="w-4 h-4 text-cyan-400" />
              <span>100% TIÊU CHUẨN THÔNG MINH</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300 border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-mono text-[11px] uppercase">
                  <th className="py-3 px-4">Hạng mục tiêu chuẩn</th>
                  <th className="py-3 px-4 text-cyan-400 font-bold">Boxora Smart Storage 2026</th>
                  <th className="py-3 px-4 text-slate-500">Kho truyền thống thông thường</th>
                </tr>
              </thead>
              <tbody className="divide-y border-slate-800/60 font-sans">
                <tr className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-4 font-bold text-white">1. Cơ chế đóng mở khóa</td>
                  <td className="py-3 px-4 text-cyan-300 font-semibold">Khóa điện tử IoT độc lập qua App, không ai giữ chìa dự phòng</td>
                  <td className="py-3 px-4 text-slate-400">Khóa cơ truyền thống, bảo vệ giữ chìa chủ mở cửa</td>
                </tr>
                <tr className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-4 font-bold text-white">2. Công nghệ chữa cháy</td>
                  <td className="py-3 px-4 text-cyan-300 font-semibold">Khí sạch FM-200 / Aerosol 10s không dùng nước, không ướt đồ</td>
                  <td className="py-3 px-4 text-slate-400">Phun nước Sprinkler gây ướt hỏng sách vở, máy vi tính</td>
                </tr>
                <tr className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-4 font-bold text-white">3. Thời gian hoàn trả cọc</td>
                  <td className="py-3 px-4 text-cyan-300 font-semibold">Hoàn tiền 100% về tài khoản trong 24 giờ sau khi nghiệm thu</td>
                  <td className="py-3 px-4 text-slate-400">Mất từ 15 – 45 ngày làm việc để làm thủ tục đối soát</td>
                </tr>
                <tr className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-4 font-bold text-white">4. Thời gian ra vào cơ sở</td>
                  <td className="py-3 px-4 text-cyan-300 font-semibold">Tự do 24/7/365, không hạn chế lượt, không cần đặt hẹn</td>
                  <td className="py-3 px-4 text-slate-400">Giới hạn giờ hành chính (8h00 – 17h00), đóng cửa lễ tết</td>
                </tr>
                <tr className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-4 font-bold text-white">5. Hạn mức bảo hiểm tài sản</td>
                  <td className="py-3 px-4 text-cyan-300 font-semibold">Lên đến 500.000.000 VNĐ (PTI / Bảo Việt bồi thường trong 7 ngày)</td>
                  <td className="py-3 px-4 text-slate-400">Không có bảo hiểm hoặc người thuê tự đàm phán mua ngoài</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ============================================================ */}
        {/* 5. NOTICE & LEGAL COMMITMENT CALLOUT                         */}
        {/* ============================================================ */}
        <section className="p-6 rounded-3xl bg-gradient-to-r from-cyan-950/60 via-slate-900/80 to-blue-950/60 border border-cyan-500/30 flex flex-col sm:flex-row items-center justify-between gap-5 text-left">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-cyan-400 font-mono font-bold text-xs uppercase">
              <Sparkles className="w-4 h-4" />
              <span>HỆ THỐNG VẬN HÀNH BẢO MẬT STORAGEOPS PRO</span>
            </div>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Mọi lịch sử mở khóa, nhật ký biến động nhiệt độ, độ ẩm và dữ liệu hợp đồng điện tử đều được lưu trữ phân tán chống giả mạo. Khách hàng hoàn toàn yên tâm khi lưu trữ tài sản giá trị tại Boxora.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <a
              href="tel:19806868"
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-cyan-500/40 text-cyan-300 text-xs font-bold transition-all flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
            >
              <PhoneCall className="w-4 h-4" />
              <span>Hotline 1980-6868</span>
            </a>

            <Link
              to="/register"
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 text-slate-950 text-xs font-black transition-all shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <span>Thuê kho ngay</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

      </main>

      {/* ============================================================ */}
      {/* 6. FOOTER                                                    */}
      {/* ============================================================ */}
      <footer className="relative z-10 border-t border-slate-800/80 py-8 px-4 sm:px-8 text-center text-xs text-slate-500 space-y-2">
        <p>
          &copy; 2026 BOXORA SMART STORAGE VIETNAM. Tiêu chuẩn PCCC QCVN 06:2022/BXD &amp; An ninh bảo mật IoT ISO/IEC 27001.
        </p>
        <p className="text-[11px] text-slate-600">
          Văn bản quy chuẩn nghiệp vụ này được áp dụng thống nhất cho toàn bộ hệ thống cơ sở kho tự quản thông minh Boxora.
        </p>
      </footer>
    </div>
  )
}
