import React, { useMemo } from 'react'
import {
  ShieldCheck,
  Lock,
  CheckCircle2,
  DollarSign,
  Flame,
  Shield,
  Printer,
  FileCheck2,
  AlertOctagon,
  Award,
  Sparkles,
  Check,
  X
} from 'lucide-react'

export interface TermsAndStandardsModalProps {
  isOpen: boolean
  onClose: () => void
  onAccept?: () => void
}

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

export const TermsAndStandardsModal: React.FC<TermsAndStandardsModalProps> = ({
  isOpen,
  onClose,
  onAccept
}) => {
  const handlePrint = () => {
    window.print()
  }

  // 6 CORE OPERATIONAL MODULES (All on 1 single unified dashboard grid - No sub-tabs)
  const modules: StandardModule[] = useMemo(
    () => [
      {
        id: 'contract',
        badge: 'Luật GDĐT',
        badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-400/30',
        title: '1. Hợp Đồng & Pháp Lý Số',
        subtitle: 'Hiệu lực pháp lý điện tử & Quyền truy cập 24/7',
        icon: FileCheck2,
        iconBg: 'bg-sky-500/20',
        iconColor: 'text-sky-300',
        borderColor: 'hover:border-sky-500/50',
        accentColor: 'text-sky-400',
        kpiLabel: 'Thời hạn thuê',
        kpiValue: '1 ngày – Nhiều năm',
        tag: 'Linh hoạt',
        items: [
          {
            label: 'Hiệu lực văn bản',
            detail: 'Ký số qua OTP/sinh trắc học, có giá trị pháp lý đầy đủ tương đương văn bản công chứng theo Luật Giao dịch Điện tử.'
          },
          {
            label: 'Truy cập tự do 24/7/365',
            detail: 'Khách hàng ra vào cơ sở kho bất kỳ lúc nào, không giới hạn số lần, không cần đặt hẹn trước.'
          },
          {
            label: 'Trách nhiệm bảo mật',
            detail: 'Người thuê tự quản lý mã PIN/QR. Không chuyển nhượng tài khoản trái phép cho bên thứ ba.'
          }
        ]
      },
      {
        id: 'safety',
        badge: 'QCVN 06:2022',
        badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-400/30',
        title: '2. Quy Chuẩn PCCC & Khí Hậu',
        subtitle: 'Chữa cháy khí sạch FM-200 & Kiểm soát ẩm độ',
        icon: Flame,
        iconBg: 'bg-amber-500/20',
        iconColor: 'text-amber-300',
        borderColor: 'hover:border-amber-500/50',
        accentColor: 'text-amber-400',
        kpiLabel: 'Cảm biến nhiệt',
        kpiValue: 'Thermal AI từng ô kho',
        tag: 'Không dùng nước',
        items: [
          {
            label: 'Khí sạch FM-200/Aerosol',
            detail: 'Chữa cháy trong 10 giây mà không dùng nước, bảo vệ tuyệt đối thiết bị điện tử, máy móc, giấy tờ không bị ướt.'
          },
          {
            label: 'Độ ẩm kiểm soát 45% – 55% RH',
            detail: 'Hút ẩm công nghiệp 24/7, loại bỏ 100% nấm mốc và mối mọt.'
          },
          {
            label: 'Nhiệt độ ổn định 20°C – 25°C',
            detail: 'Điều hòa trung tâm inverter bảo quản đồ da, rượu vang và hàng công nghệ an toàn lâu dài.'
          }
        ]
      },
      {
        id: 'security',
        badge: 'ISO/IEC 27001',
        badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/30',
        title: '3. An Ninh & Bảo Mật IoT',
        subtitle: 'Khóa điện tử độc lập & Camera AI hành lang',
        icon: Lock,
        iconBg: 'bg-cyan-500/20',
        iconColor: 'text-cyan-300',
        borderColor: 'hover:border-cyan-500/50',
        accentColor: 'text-cyan-400',
        kpiLabel: 'Nhật ký truy cập',
        kpiValue: 'Real-time Audit Log',
        tag: 'Bảo mật đa tầng',
        items: [
          {
            label: 'Khóa độc lập tuyệt đối',
            detail: 'Nhân viên Boxora không giữ chìa khóa dự phòng của ô kho, bảo mật riêng tư 100%.'
          },
          {
            label: 'Mã hóa AES-256 GCM',
            detail: 'Dữ liệu từ khóa điện tử về máy chủ đạt tiêu chuẩn bảo mật cấp ngân hàng và quân sự.'
          },
          {
            label: 'Camera AI 4K hành lang',
            detail: 'Giám sát lối đi 24/7 (cam kết tuyệt đối không đặt camera quay vào bên trong ô kho cá nhân).'
          }
        ]
      },
      {
        id: 'deposit',
        badge: 'Hoàn 100%',
        badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
        title: '4. Cọc & Hoàn Tiền 24 Giờ',
        subtitle: 'Minh bạch tài chính & Ân hạn thanh toán 3 ngày',
        icon: DollarSign,
        iconBg: 'bg-emerald-500/20',
        iconColor: 'text-emerald-300',
        borderColor: 'hover:border-emerald-500/50',
        accentColor: 'text-emerald-400',
        kpiLabel: 'Xử lý trả kho',
        kpiValue: 'Nghiệm thu tự động 60p',
        tag: 'Cam kết 24h',
        items: [
          {
            label: 'Hoàn cọc 100% trong 24 giờ',
            detail: 'Sau khi trả kho trống, tiền cọc được hoàn trực tiếp qua ngân hàng tối đa 24 giờ làm việc.'
          },
          {
            label: 'Thời gian ân hạn (Grace Period)',
            detail: 'Cung cấp 03 ngày ân hạn sau hạn thanh toán mà không tính phí phạt trễ hạn.'
          },
          {
            label: 'Không chi phí ẩn',
            detail: 'Giá niêm yết đã bao gồm điện, nước, điều hòa, PCCC và phí quản lý cơ sở.'
          }
        ]
      },
      {
        id: 'prohibited',
        badge: 'Cấm Tuyệt Đối',
        badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-400/30',
        title: '5. Hàng Cấm Lưu Trữ',
        subtitle: 'Danh mục nghiêm cấm vì an toàn cộng đồng',
        icon: AlertOctagon,
        iconBg: 'bg-rose-500/20',
        iconColor: 'text-rose-300',
        borderColor: 'hover:border-rose-500/50',
        accentColor: 'text-rose-400',
        kpiLabel: 'Xử lý vi phạm',
        kpiValue: 'Chấm dứt HĐ & Báo công an',
        tag: 'Nghiêm cấm',
        items: [
          {
            label: 'Chất dễ cháy nổ & hóa chất',
            detail: 'Xăng, dầu, bình gas, pháo hoa, pin ắc quy hở, axit ăn mòn, chất độc hại.'
          },
          {
            label: 'Hàng hóa phi pháp & vũ khí',
            detail: 'Ma túy, vũ khí quân dụng, công cụ hỗ trợ trái phép, hàng lậu trốn thuế.'
          },
          {
            label: 'Sinh vật sống & thực phẩm tươi',
            detail: 'Động thực vật, đồ ăn tươi sống dễ ôi thiu phát sinh mùi hoặc côn trùng.'
          }
        ]
      },
      {
        id: 'insurance',
        badge: 'Tới 500 Triệu',
        badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-400/30',
        title: '6. Bảo Hiểm & Đền Bù',
        subtitle: 'Bảo trợ bởi Bảo hiểm Bảo Việt / PTI',
        icon: Award,
        iconBg: 'bg-indigo-500/20',
        iconColor: 'text-indigo-300',
        borderColor: 'hover:border-indigo-500/50',
        accentColor: 'text-indigo-400',
        kpiLabel: 'Phạm vi',
        kpiValue: 'Hỏa hoạn, thiên tai, cơ sở',
        tag: 'Bảo trợ uy tín',
        items: [
          {
            label: 'Gói tiêu chuẩn (Miễn phí)',
            detail: 'Đính kèm theo mỗi hợp đồng, hạn mức đền bù lên đến 50.000.000 VNĐ / ô kho.'
          },
          {
            label: 'Gói nâng cao (Tùy chọn)',
            detail: 'Mở rộng bảo vệ lên tới 500.000.000 VNĐ cho hàng giá trị cao, đồ điện tử đắt tiền.'
          },
          {
            label: 'Thời gian giải ngân đền bù',
            detail: 'Tối đa 07 ngày làm việc kể từ ngày hoàn tất hồ sơ giám định sự cố.'
          }
        ]
      }
    ],
    []
  )

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-3 sm:p-5 lg:p-6 bg-slate-950/75 backdrop-blur-md animate-fadeIn">
      {/* Modal Dialog Card */}
      <div
        className="relative w-full max-w-6xl bg-slate-900 text-slate-100 rounded-3xl shadow-2xl border border-slate-700/80 overflow-hidden flex flex-col max-h-[92vh] animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ============================================================ */}
        {/* 1. DASHBOARD HEADER                                          */}
        {/* ============================================================ */}
        <div className="px-6 sm:px-8 py-5 border-b border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3.5 text-left">
            <div className="w-11 h-11 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.35)] shrink-0">
              <ShieldCheck className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono font-bold tracking-widest text-cyan-400 uppercase">
                  BOXORA SMART STORAGE
                </span>
                <span className="px-2 py-0.5 rounded-full bg-cyan-400/20 border border-cyan-400/40 text-cyan-200 text-[10px] font-bold font-mono">
                  CHUẨN QUỐC TẾ 2026
                </span>
              </div>
              {/* Tiêu đề chính: trắng #FFFFFF, font đậm 800–900, text-shadow */}
              <h2
                className="text-xl sm:text-2xl font-black text-white tracking-tight"
                style={{
                  color: '#FFFFFF',
                  fontWeight: 900,
                  textShadow: '0 3px 8px rgba(0,0,0,0.8)'
                }}
              >
                Dashboard Quy Chuẩn &amp; Điều Khoản Vận Hành Kho Boxora
              </h2>
              {/* Tiêu đề phụ: cyan #00E5FF, có bóng đổ xanh đậm */}
              <p
                className="text-xs font-bold uppercase tracking-wider mt-0.5"
                style={{
                  color: '#00E5FF',
                  textShadow: '0 2px 8px rgba(0, 119, 182, 0.8)'
                }}
              >
                KỶ NGUYÊN KHO TỰ QUẢN THÔNG MINH • CHẠM ĐỂ MỞ KHÓA • AN TÂM LƯU GIỮ 24/7
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-end sm:self-auto">
            {/* Print Button */}
            <button
              onClick={handlePrint}
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition-all cursor-pointer"
              title="In văn bản quy chuẩn"
            >
              <Printer className="w-4 h-4" />
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition-all cursor-pointer"
              title="Đóng cửa sổ"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ============================================================ */}
        {/* 2. TOP KPI METRICS BAR                                        */}
        {/* ============================================================ */}
        <div className="px-6 sm:px-8 py-3 bg-slate-950/60 border-b border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-left shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Hợp đồng điện tử</span>
              <span className="block text-xs font-black text-white">Pháp lý hợp chuẩn 100%</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">An ninh &amp; Khóa</span>
              <span className="block text-xs font-black text-white">ISO/IEC 27001 • Khóa độc lập</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-400 flex items-center justify-center shrink-0">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cam kết tài chính</span>
              <span className="block text-xs font-black text-white">Hoàn cọc 100% trong 24h</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bảo hiểm đền bù</span>
              <span className="block text-xs font-black text-white">Hạn mức đến 500 Triệu</span>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* 3. UNIFIED ALL-IN-ONE DASHBOARD BODY (NO SUB-TABS)           */}
        {/* ============================================================ */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 text-left">
          
          {/* DASHBOARD GRID: 6 MAIN BUSINESS MODULES */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {modules.map((m) => {
              const Icon = m.icon
              return (
                <div
                  key={m.id}
                  className={`p-5 rounded-2xl bg-slate-800/70 border border-slate-700/80 ${m.borderColor} transition-all flex flex-col justify-between space-y-3.5`}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className={`flex items-center gap-2 font-black text-xs uppercase tracking-wider ${m.accentColor}`}>
                        <div className={`w-7 h-7 rounded-lg ${m.iconBg} flex items-center justify-center ${m.iconColor}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <span>{m.title}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${m.badgeColor}`}>
                        {m.badge}
                      </span>
                    </div>

                    {/* Tiêu đề nhóm / tính năng: trắng #FFFFFF */}
                    <h3 className="text-sm font-black text-white">
                      {m.subtitle}
                    </h3>

                    {/* Clauses Items */}
                    <div className="space-y-2 pt-0.5">
                      {m.items.map((item, idx) => (
                        <div key={idx} className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className={`${m.accentColor} font-bold text-xs`}>•</span>
                            {/* Tên tính năng: trắng #FFFFFF */}
                            <strong className="text-white text-xs font-bold">{item.label}:</strong>
                          </div>
                          {/* Phần chữ phụ: dùng #D1E5F0 */}
                          <p
                            className="text-[12px] leading-relaxed pl-3 font-normal"
                            style={{ color: '#D1E5F0' }}
                          >
                            {item.detail}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                    <span>{m.kpiLabel}: <strong className="text-white">{m.kpiValue}</strong></span>
                    <span className={`font-bold ${m.accentColor}`}>{m.tag}</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Quick Notice Banner */}
          <div className="p-4 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-cyan-400 shrink-0" />
              <p className="text-xs text-[#F1F5F9]">
                Toàn bộ các quy chuẩn trên đều được giám sát tự động bằng hệ thống quản trị <strong>StorageOps Pro</strong> và lưu trữ trên cơ sở dữ liệu phân tán chuẩn ISO/IEC 27001.
              </p>
            </div>
            <a
              href="tel:19806868"
              className="text-xs font-bold text-cyan-400 hover:text-cyan-300 whitespace-nowrap hidden sm:inline"
            >
              Hotline: 1980-6868
            </a>
          </div>

        </div>

        {/* ============================================================ */}
        {/* 4. MODAL FOOTER WITH SINGLE CONFIRMATION                     */}
        {/* ============================================================ */}
        <div className="px-6 sm:px-8 py-4 border-t border-slate-800 bg-slate-950 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-400 text-left">
            Bằng việc nhấn xác nhận, bạn cam kết tuân thủ đầy đủ Bộ Quy chuẩn &amp; Điều khoản vận hành kho Boxora.
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
            >
              Đóng
            </button>

            {onAccept && (
              <button
                onClick={() => {
                  onAccept()
                  onClose()
                }}
                className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600 text-slate-950 text-xs font-black shadow-lg shadow-cyan-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Tôi Đã Hiểu &amp; Đồng Ý</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
