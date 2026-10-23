import { useLanguage } from '../../context/LanguageContext'
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
  const { t } = useLanguage();

  const handlePrint = () => {
    window.print()
  }

  const modules: StandardModule[] = [
    {
      id: 'contract',
      badge: 'Luật GDĐT 20/2023',
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
      title: '1. Hợp Đồng & Pháp Lý Số',
      subtitle: 'Hiệu lực văn bản điện tử & Quyền truy cập 24/7/365',
      icon: FileCheck2,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      borderColor: 'hover:border-blue-300',
      accentColor: 'text-blue-600',
      kpiLabel: 'Thời hạn thuê',
      kpiValue: '7 ngày – 5 năm linh hoạt',
      tag: 'Pháp lý 100%',
      items: [
        {
          label: 'Hiệu lực pháp lý điện tử',
          detail: 'Hợp đồng được ký số thông qua OTP và định danh CCCD, có giá trị pháp lý đầy đủ tương đương văn bản truyền thống theo Luật Giao dịch Điện tử Việt Nam.'
        },
        {
          label: 'Tự do truy cập 24/7/365',
          detail: 'Khách hàng có toàn quyền ra vào cơ sở kho Boxora và mở buồng kho cá nhân bất kỳ lúc nào trong ngày, 365 ngày/năm mà không cần đặt lịch hẹn trước.'
        },
        {
          label: 'Bảo mật tài khoản & PIN',
          detail: 'Người thuê tự bảo quản mã số PIN và mã QR truy cập. Boxora không can thiệp hay chia sẻ thông tin truy cập cá nhân cho bên thứ ba.'
        }
      ]
    },
    {
      id: 'safety',
      badge: 'QCVN 06:2022/BXD',
      badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
      title: '2. Quy Chuẩn PCCC & Khí Hậu',
      subtitle: 'Chữa cháy khí sạch FM-200 & Kiểm soát vi khí hậu',
      icon: Flame,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      borderColor: 'hover:border-amber-300',
      accentColor: 'text-amber-600',
      kpiLabel: 'Cảm biến giám sát',
      kpiValue: 'Thermal AI từng buồng kho',
      tag: 'Không dùng nước',
      items: [
        {
          label: 'Hệ thống khí sạch FM-200/Aerosol',
          detail: 'Dập tắt đám cháy trong vòng 10 giây mà không gây ướt hỏng thiết bị điện tử, máy móc tinh xảo và hồ sơ tài liệu quan trọng.'
        },
        {
          label: 'Kiểm soát ẩm độ 45% – 55% RH',
          detail: 'Hệ thống hút ẩm công nghiệp hoạt động 24/7 loại bỏ nguy cơ nấm mốc, mối mọt, rỉ sét linh kiện kim loại.'
        },
        {
          label: 'Nhiệt độ phòng ổn định 18°C – 25°C',
          detail: 'Điều hòa luân chuyển khí mát inverter đảm bảo môi trường lý tưởng cho nội thất, đồ da, thiết bị điện tử và hàng hóa.'
        }
      ]
    },
    {
      id: 'security',
      badge: 'Bảo Mật 24/7',
      badgeColor: 'bg-cyan-50 text-cyan-700 border-cyan-200',
      title: '3. An Ninh & Khóa Điện Tử',
      subtitle: 'Khóa điện tử độc lập & Camera giám sát hành lang',
      icon: Lock,
      iconBg: 'bg-cyan-50',
      iconColor: 'text-cyan-600',
      borderColor: 'hover:border-cyan-300',
      accentColor: 'text-cyan-600',
      kpiLabel: 'Nhật ký truy cập',
      kpiValue: 'Lưu trữ tự động 24/7',
      tag: 'Bảo mật an toàn',
      items: [
        {
          label: 'Khóa điện tử độc lập tuyệt đối',
          detail: 'Nhân viên Boxora không nắm giữ chìa khóa vật lý hay thẻ dự phòng của buồng kho. Quyền mở cửa chỉ do duy nhất khách hàng nắm giữ.'
        },
        {
          label: 'Mã hóa truyền tin an toàn',
          detail: 'Toàn bộ tín hiệu đóng mở cửa từ ứng dụng điện thoại đến bộ điều khiển chốt khóa được mã hóa an toàn.'
        },
        {
          label: 'Camera giám sát hành lang 24/7',
          detail: 'Giám sát lối đi chung 24/7 nhận diện chuyển động. Cam kết tuyệt đối không lắp đặt góc quay vào bên trong không gian riêng tư của buồng kho.'
        }
      ]
    },
    {
      id: 'deposit',
      badge: 'Bảo Đảm Buồng Kho',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      title: '4. Tiền Đặt Cọc & Hoàn Trả',
      subtitle: 'Bảo đảm buồng kho & Hoàn trả 100% khi ngừng thuê',
      icon: DollarSign,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      borderColor: 'hover:border-emerald-300',
      accentColor: 'text-emerald-600',
      kpiLabel: 'Hoàn trả tiền cọc',
      kpiValue: 'Khi ngừng thuê kho',
      tag: 'Minh bạch 100%',
      items: [
        {
          label: 'Mục đích khoản tiền đặt cọc (1 tháng)',
          detail: 'Tiền đặt cọc được giữ để bảo đảm cho buồng kho và thiết bị khóa IoT trong suốt thời gian thuê, và được hoàn trả 100% khi khách hàng ngừng thuê và bàn giao lại kho.'
        },
        {
          label: 'Thời gian ân hạn 03 ngày (Grace Period)',
          detail: 'Khi hóa đơn định kỳ đến hạn, khách hàng có thêm 03 ngày ân hạn để gia hạn hợp đồng mà không phải chịu khoản tiền phạt trễ hạn.'
        },
        {
          label: 'Không chi phí ẩn phát sinh',
          detail: 'Mức giá niêm yết trên hợp đồng đã bao gồm toàn bộ chi phí điện, chiếu sáng, điều hòa, PCCC, vệ sinh hành lang chung và an ninh cơ sở.'
        }
      ]
    },
    {
      id: 'prohibited',
      badge: 'Cấm Tuyệt Đối',
      badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
      title: '5. Danh Mục Hàng Cấm',
      subtitle: 'Bảo vệ an toàn cộng đồng & Tuân thủ pháp luật',
      icon: AlertOctagon,
      iconBg: 'bg-rose-50',
      iconColor: 'text-rose-600',
      borderColor: 'hover:border-rose-300',
      accentColor: 'text-rose-600',
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
          detail: 'Tuyệt đối cấm cất giữ ma túy, chất kích thích bị cấm, súng đạn, vật liệu nổ, công cụ hỗ trợ không phép, hàng buôn lậu.'
        },
        {
          label: 'Sinh vật sống & Thực phẩm tươi sống',
          detail: 'Cấm giữ gia súc, thú cưng, cây cảnh sống hoặc các loại thực phẩm tươi sống dễ ôi thiu phát sinh mùi hoặc thu hút côn trùng.'
        }
      ]
    },
    {
      id: 'insurance',
      badge: 'Đền Bù Tới 500Tr',
      badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      title: '6. Bảo Hiểm & Đền Bù',
      subtitle: 'Bảo trợ rủi ro bởi Bảo Việt / PTI toàn diện',
      icon: Award,
      iconBg: 'bg-indigo-50',
      iconColor: 'text-indigo-600',
      borderColor: 'hover:border-indigo-300',
      accentColor: 'text-indigo-600',
      kpiLabel: 'Thời gian giải ngân',
      kpiValue: 'Tối đa 07 ngày làm việc',
      tag: 'Bảo trợ uy tín',
      items: [
        {
          label: 'Gói bảo hiểm tiêu chuẩn (Miễn phí)',
          detail: 'Mỗi hợp đồng thuê buồng kho tự động được cấp hạn mức bảo hiểm cơ bản lên đến 50.000.000 VNĐ cho các sự cố hỏa hoạn hoặc thiên tai.'
        },
        {
          label: 'Gói bảo hiểm nâng cao (Tùy chọn)',
          detail: 'Khách hàng có thể đăng ký gói bảo hiểm tài sản cao cấp với hạn mức bồi thường mở rộng lên đến 500.000.000 VNĐ.'
        },
        {
          label: 'Quy trình giám định & Bồi thường 7 ngày',
          detail: 'Thủ tục giám định độc lập cùng đơn vị bảo hiểm uy tín (Bảo Việt / PTI). Thời gian hoàn tất thanh toán bồi thường tối đa 07 ngày làm việc.'
        }
      ]
    }
  ]

  return (
    <div className="min-h-screen bg-[#f8fbff] dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white relative">
      {/* Top Header Navigation (Clean White Daylight Header) */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-4 sm:px-8 lg:px-12 py-3.5 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-blue-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-blue-600" />
            <span className="hidden sm:inline">Về trang chủ</span>
          </Link>
          <div className="h-5 w-px bg-slate-200" />
          <Link to="/" className="flex items-center gap-2.5">
            <img src={boxoraLogo} alt="BOXORA" className="h-8 w-auto object-contain" />
            <span className="hidden md:inline text-xs font-mono font-bold tracking-wider text-blue-600 uppercase">
              • TIÊU CHUẨN &amp; NỘI QUY VẬN HÀNH
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 transition-all cursor-pointer shadow-2xs"
            title="In toàn bộ văn bản quy chuẩn"
          >
            <Printer className="w-4 h-4 text-blue-600" />
            <span className="hidden sm:inline">In văn bản</span>
          </button>

          <Link
            to="/booking"
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm shadow-blue-600/20"
          >
            Đặt thuê kho ngay
          </Link>
        </div>
      </header>

      {/* Hero Section (Daylight White & Soft Blue Gradient) */}
      <section className="relative z-10 px-4 sm:px-8 lg:px-12 py-10 lg:py-14 bg-gradient-to-b from-blue-50/70 via-white to-[#f8fbff] dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 border-b border-slate-200 dark:border-slate-800/80 overflow-hidden">
        <div className="max-w-6xl mx-auto text-left relative z-10 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-mono font-bold">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <span>BỘ QUY CHUẨN VẬN HÀNH NGHIỆP VỤ KHO BOXORA 2026</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-950 tracking-tight leading-tight">
            Quy Chuẩn &amp; Điều Khoản Vận Hành Kho Tự Quản Boxora
          </h1>

          <h2 className="text-sm sm:text-base lg:text-lg font-bold tracking-wide uppercase text-blue-600">
            KHO TỰ QUẢN THÔNG MINH • CHỌN KÍCH CỠ 1M³ – 24M³ • MỞ KHÓA IOT 24/7
          </h2>

          <p className="text-sm sm:text-base max-w-4xl leading-relaxed text-slate-600">
            Hệ thống quy chuẩn vận hành kho tự quản thông minh khép kín: hợp đồng điện tử hợp chuẩn, tiêu chuẩn PCCC khí sạch FM-200 không dùng nước, khóa điện tử độc lập an toàn và chính sách tiền cọc bảo đảm buồng kho minh bạch.
          </p>

          {/* Quick KPI stats dashboard */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-4">
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
              <span className="block text-[11px] font-mono text-blue-600 font-bold uppercase">Hợp đồng điện tử</span>
              <span className="block text-sm sm:text-base font-extrabold text-slate-900 mt-0.5">Pháp lý 100%</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
              <span className="block text-[11px] font-mono text-blue-600 font-bold uppercase">PCCC Khí sạch</span>
              <span className="block text-sm sm:text-base font-extrabold text-slate-900 mt-0.5">FM-200 10 Giây</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
              <span className="block text-[11px] font-mono text-blue-600 font-bold uppercase">Bảo mật</span>
              <span className="block text-sm sm:text-base font-extrabold text-slate-900 mt-0.5">An Ninh 24/7</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
              <span className="block text-[11px] font-mono text-blue-600 font-bold uppercase">Hoàn trả cọc</span>
              <span className="block text-sm sm:text-base font-extrabold text-slate-900 mt-0.5">Khi ngừng thuê</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
              <span className="block text-[11px] font-mono text-blue-600 font-bold uppercase">Bảo hiểm đền bù</span>
              <span className="block text-sm sm:text-base font-extrabold text-slate-900 mt-0.5">Đến 500 Triệu</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
              <span className="block text-[11px] font-mono text-blue-600 font-bold uppercase">Kiểm soát ẩm</span>
              <span className="block text-sm sm:text-base font-extrabold text-slate-900 mt-0.5">45% – 55% RH</span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 lg:px-12 py-8 lg:py-12 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left">
          <div>
            <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 flex items-center gap-2.5">
              <span>Bảng Tổng Hợp 6 Trụ Cột Vận Hành</span>
              <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-mono font-bold">
                Minh bạch 100%
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Toàn bộ tiêu chuẩn được trình bày trực quan trên một màn hình thống nhất, thuận tiện đối chiếu và theo dõi.
            </p>
          </div>
        </div>

        {/* 6 MODULES GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((m) => {
            const Icon = m.icon
            return (
              <div
                key={m.id}
                className={`p-6 rounded-3xl bg-white border border-slate-200/90 ${m.borderColor} shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between space-y-4 text-left`}
              >
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-9 h-9 rounded-xl ${m.iconBg} flex items-center justify-center ${m.iconColor}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className={`text-xs font-extrabold uppercase tracking-wider ${m.accentColor}`}>
                        {m.title}
                      </span>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold border ${m.badgeColor}`}>
                      {m.badge}
                    </span>
                  </div>

                  <h4 className="text-base font-extrabold text-slate-900 leading-snug">
                    {m.subtitle}
                  </h4>

                  <div className="space-y-2.5 pt-1">
                    {m.items.map((item, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-slate-50/90 border border-slate-200/70 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className={`w-3.5 h-3.5 ${m.accentColor} shrink-0`} />
                          <span className="text-xs font-bold text-slate-900">
                            {item.label}
                          </span>
                        </div>
                        <p className="text-[12px] leading-relaxed pl-5 font-normal text-slate-600">
                          {item.detail}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-slate-500">{m.kpiLabel}: <strong className="text-slate-900">{m.kpiValue}</strong></span>
                  <span className={`font-bold ${m.accentColor}`}>{m.tag}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Comparison Table (Clean White Surface) */}
        <section className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200/90 shadow-sm text-left space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-xs font-mono font-bold text-blue-600 uppercase tracking-widest">
                ĐỐI CHIẾU TIÊU CHUẨN NGHIỆP VỤ
              </span>
              <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">
                Boxora Smart Storage so với Kho Lưu Trữ Truyền Thống
              </h3>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold font-mono">
              <CheckSquare className="w-4 h-4 text-blue-600" />
              <span>100% TIÊU CHUẨN THÔNG MINH</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-mono text-[11px] uppercase">
                  <th className="py-3 px-4">Hạng mục tiêu chuẩn</th>
                  <th className="py-3 px-4 text-blue-700 font-bold">Boxora Smart Storage 2026</th>
                  <th className="py-3 px-4 text-slate-500">Kho truyền thống thông thường</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 font-sans">
                <tr className="hover:bg-blue-50/40 transition-colors">
                  <td className="py-3 px-4 font-bold text-slate-900">1. Cơ chế đóng mở khóa</td>
                  <td className="py-3 px-4 text-blue-700 font-semibold">Khóa điện tử IoT độc lập qua App/PIN, không ai giữ chìa dự phòng</td>
                  <td className="py-3 px-4 text-slate-500">Khóa cơ truyền thống, bảo vệ giữ chìa chủ mở cửa</td>
                </tr>
                <tr className="hover:bg-blue-50/40 transition-colors">
                  <td className="py-3 px-4 font-bold text-slate-900">2. Công nghệ chữa cháy</td>
                  <td className="py-3 px-4 text-blue-700 font-semibold">Khí sạch FM-200 / Aerosol 10s không dùng nước, không ướt đồ</td>
                  <td className="py-3 px-4 text-slate-500">Phun nước Sprinkler dễ gây ướt hỏng sách vở, điện tử</td>
                </tr>
                <tr className="hover:bg-blue-50/40 transition-colors">
                  <td className="py-3 px-4 font-bold text-slate-900">3. Chính sách tiền đặt cọc</td>
                  <td className="py-3 px-4 text-blue-700 font-semibold">Cọc bảo đảm cho buồng kho, hoàn trả 100% khi khách ngừng thuê kho</td>
                  <td className="py-3 px-4 text-slate-500">Mất từ 15 – 45 ngày làm việc và nhiều thủ tục khấu trừ</td>
                </tr>
                <tr className="hover:bg-blue-50/40 transition-colors">
                  <td className="py-3 px-4 font-bold text-slate-900">4. Thời gian ra vào cơ sở</td>
                  <td className="py-3 px-4 text-blue-700 font-semibold">Tự do 24/7/365, không hạn chế lượt, không cần đặt hẹn</td>
                  <td className="py-3 px-4 text-slate-500">Giới hạn giờ hành chính (8h00 – 17h00), đóng cửa lễ tết</td>
                </tr>
                <tr className="hover:bg-blue-50/40 transition-colors">
                  <td className="py-3 px-4 font-bold text-slate-900">5. Hạn mức bảo hiểm tài sản</td>
                  <td className="py-3 px-4 text-blue-700 font-semibold">Lên đến 500.000.000 VNĐ (PTI / Bảo Việt bồi thường trong 7 ngày)</td>
                  <td className="py-3 px-4 text-slate-500">Không có bảo hiểm hoặc người thuê tự đàm phán mua ngoài</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Callout Banner */}
        <section className="p-6 rounded-3xl bg-gradient-to-r from-blue-50 via-white to-cyan-50 dark:from-slate-900 dark:via-slate-850 dark:to-slate-900 border border-blue-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-5 text-left shadow-xs">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-blue-600 font-mono font-bold text-xs uppercase">
              <Sparkles className="w-4 h-4" />
              <span>HỆ THỐNG QUẢN LÝ VÀ VẬN HÀNH BOXORA</span>
            </div>
            <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
              Mọi lịch sử mở khóa, nhật ký biến động nhiệt độ, độ ẩm và dữ liệu hợp đồng điện tử đều được lưu trữ minh bạch. Khách hàng hoàn toàn yên tâm khi thuê buồng kho tự quản tại Boxora.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <a
              href="tel:1900636888"
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-white hover:bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold transition-all flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer shadow-2xs"
            >
              <PhoneCall className="w-4 h-4" />
              <span>Hotline 1900 636 888</span>
            </a>

            <Link
              to="/booking"
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <span>Đặt thuê kho ngay</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}
