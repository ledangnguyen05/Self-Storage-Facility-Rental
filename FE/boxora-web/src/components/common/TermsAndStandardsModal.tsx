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

  const modules: StandardModule[] = useMemo(
    () => [
      {
        id: 'contract',
        badge: 'Luật GDĐT',
        badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
        title: '1. Hợp Đồng & Pháp Lý Số',
        subtitle: 'Hiệu lực pháp lý điện tử & Quyền truy cập 24/7',
        icon: FileCheck2,
        iconBg: 'bg-blue-50',
        iconColor: 'text-blue-600',
        borderColor: 'hover:border-blue-300',
        accentColor: 'text-blue-600',
        kpiLabel: 'Thời hạn thuê',
        kpiValue: '7 ngày – Nhiều năm',
        tag: 'Linh hoạt',
        items: [
          {
            label: 'Hiệu lực văn bản',
            detail: 'Ký số qua OTP/định danh CCCD, có giá trị pháp lý đầy đủ theo Luật Giao dịch Điện tử.'
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
        badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
        title: '2. Quy Chuẩn PCCC & Khí Hậu',
        subtitle: 'Chữa cháy khí sạch FM-200 & Kiểm soát ẩm độ',
        icon: Flame,
        iconBg: 'bg-amber-50',
        iconColor: 'text-amber-600',
        borderColor: 'hover:border-amber-300',
        accentColor: 'text-amber-600',
        kpiLabel: 'Cảm biến nhiệt',
        kpiValue: 'Thermal AI từng buồng kho',
        tag: 'Không dùng nước',
        items: [
          {
            label: 'Khí sạch FM-200/Aerosol',
            detail: 'Chữa cháy trong 10 giây mà không dùng nước, bảo vệ thiết bị điện tử, máy móc, giấy tờ không bị ướt.'
          },
          {
            label: 'Độ ẩm kiểm soát 45% – 55% RH',
            detail: 'Hút ẩm công nghiệp 24/7, loại bỏ nấm mốc và mối mọt.'
          },
          {
            label: 'Nhiệt độ ổn định 18°C – 25°C',
            detail: 'Điều hòa trung tâm inverter bảo quản nội thất, đồ da và hàng công nghệ an toàn lâu dài.'
          }
        ]
      },
      {
        id: 'security',
        badge: 'Bảo mật 24/7',
        badgeColor: 'bg-cyan-50 text-cyan-700 border-cyan-200',
        title: '3. An Ninh & Khóa Điện Tử',
        subtitle: 'Khóa điện tử độc lập & Camera giám sát hành lang',
        icon: Lock,
        iconBg: 'bg-cyan-50',
        iconColor: 'text-cyan-600',
        borderColor: 'hover:border-cyan-300',
        accentColor: 'text-cyan-600',
        kpiLabel: 'Nhật ký truy cập',
        kpiValue: 'Lưu trữ tự động',
        tag: 'Bảo mật riêng tư',
        items: [
          {
            label: 'Khóa độc lập tuyệt đối',
            detail: 'Nhân viên Boxora không giữ chìa khóa dự phòng của buồng kho, bảo mật riêng tư 100%.'
          },
          {
            label: 'Mã hóa truyền dữ liệu',
            detail: 'Dữ liệu điều khiển khóa được mã hóa bảo mật an toàn giữa máy chủ và thiết bị.'
          },
          {
            label: 'Camera giám sát hành lang',
            detail: 'Giám sát lối đi 24/7 (cam kết tuyệt đối không đặt camera quay vào bên trong buồng kho cá nhân).'
          }
        ]
      },
      {
        id: 'deposit',
        badge: 'Bảo Đảm Kho',
        badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        title: '4. Tiền Cọc & Hoàn Trả',
        subtitle: 'Bảo đảm buồng kho & Hoàn trả khi ngừng thuê',
        icon: DollarSign,
        iconBg: 'bg-emerald-50',
        iconColor: 'text-emerald-600',
        borderColor: 'hover:border-emerald-300',
        accentColor: 'text-emerald-600',
        kpiLabel: 'Hoàn trả cọc',
        kpiValue: 'Khi ngừng thuê kho',
        tag: 'Minh bạch 100%',
        items: [
          {
            label: 'Bảo đảm cho buồng kho',
            detail: 'Tiền đặt cọc được giữ để bảo đảm cho buồng kho trong thời gian thuê và hoàn trả 100% khi khách hàng ngừng thuê và bàn giao lại kho.'
          },
          {
            label: 'Thời gian ân hạn (Grace Period)',
            detail: 'Cung cấp 03 ngày ân hạn sau hạn thanh toán mà không tính phí phạt trễ hạn.'
          },
          {
            label: 'Không chi phí ẩn',
            detail: 'Giá niêm yết đã bao gồm điện, chiếu sáng, điều hòa, PCCC và phí quản lý cơ sở.'
          }
        ]
      },
      {
        id: 'prohibited',
        badge: 'Cấm Tuyệt Đối',
        badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
        title: '5. Hàng Cấm Lưu Trữ',
        subtitle: 'Danh mục nghiêm cấm vì an toàn cộng đồng',
        icon: AlertOctagon,
        iconBg: 'bg-rose-50',
        iconColor: 'text-rose-600',
        borderColor: 'hover:border-rose-300',
        accentColor: 'text-rose-600',
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
        badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        title: '6. Bảo Hiểm & Đền Bù',
        subtitle: 'Bảo trợ bởi Bảo hiểm Bảo Việt / PTI',
        icon: Award,
        iconBg: 'bg-indigo-50',
        iconColor: 'text-indigo-600',
        borderColor: 'hover:border-indigo-300',
        accentColor: 'text-indigo-600',
        kpiLabel: 'Phạm vi',
        kpiValue: 'Hỏa hoạn, thiên tai, cơ sở',
        tag: 'Bảo trợ uy tín',
        items: [
          {
            label: 'Gói tiêu chuẩn (Miễn phí)',
            detail: 'Đính kèm theo mỗi hợp đồng, hạn mức đền bù lên đến 50.000.000 VNĐ / buồng kho.'
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
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-3 sm:p-5 lg:p-6 bg-slate-900/45 backdrop-blur-md animate-fadeIn">
      {/* Modal Dialog Card (Clean White Daylight Surface) */}
      <div
        className="relative w-full max-w-6xl bg-white text-slate-900 rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. DASHBOARD HEADER */}
        <div className="px-6 sm:px-8 py-5 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-blue-50 via-white to-cyan-50 dark:from-slate-900 dark:via-slate-850 dark:to-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3.5 text-left">
            <div className="w-11 h-11 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-600/20 shrink-0">
              <ShieldCheck className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono font-bold tracking-widest text-blue-600 uppercase">
                  BOXORA SMART STORAGE
                </span>
                <span className="px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-bold font-mono">
                  CHUẨN QUỐC TẾ 2026
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                Quy Chuẩn &amp; Điều Khoản Vận Hành Kho Boxora
              </h2>
              <p className="text-xs font-bold uppercase tracking-wider mt-0.5 text-blue-600">
                KHO TỰ QUẢN THÔNG MINH • CHỌN KÍCH CỠ 1M³ – 24M³ • AN TÂM LƯU GIỮ 24/7
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-end sm:self-auto">
            <button
              onClick={handlePrint}
              className="w-9 h-9 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
              title="In văn bản quy chuẩn"
            >
              <Printer className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
              title="Đóng cửa sổ"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2. TOP KPI METRICS BAR */}
        <div className="px-6 sm:px-8 py-3 bg-slate-50 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-left shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Hợp đồng điện tử</span>
              <span className="block text-xs font-extrabold text-slate-900">Pháp lý hợp chuẩn 100%</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-600 flex items-center justify-center shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">An ninh &amp; Khóa</span>
              <span className="block text-xs font-extrabold text-slate-900">Khóa điện tử độc lập</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tiền đặt cọc</span>
              <span className="block text-xs font-extrabold text-slate-900">Hoàn trả khi ngừng thuê</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Bảo hiểm đền bù</span>
              <span className="block text-xs font-extrabold text-slate-900">Hạn mức đến 500 Triệu</span>
            </div>
          </div>
        </div>

        {/* 3. UNIFIED ALL-IN-ONE DASHBOARD BODY */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 text-left bg-white">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {modules.map((m) => {
              const Icon = m.icon
              return (
                <div
                  key={m.id}
                  className={`p-5 rounded-2xl bg-slate-50/70 border border-slate-200/90 ${m.borderColor} transition-all flex flex-col justify-between space-y-3.5`}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className={`flex items-center gap-2 font-extrabold text-xs uppercase tracking-wider ${m.accentColor}`}>
                        <div className={`w-7 h-7 rounded-lg ${m.iconBg} flex items-center justify-center ${m.iconColor}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <span>{m.title}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${m.badgeColor}`}>
                        {m.badge}
                      </span>
                    </div>

                    <h3 className="text-sm font-extrabold text-slate-900">
                      {m.subtitle}
                    </h3>

                    <div className="space-y-2 pt-0.5">
                      {m.items.map((item, idx) => (
                        <div key={idx} className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className={`${m.accentColor} font-bold text-xs`}>•</span>
                            <strong className="text-slate-900 text-xs font-bold">{item.label}:</strong>
                          </div>
                          <p className="text-[12px] leading-relaxed pl-3 font-normal text-slate-600">
                            {item.detail}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span>{m.kpiLabel}: <strong className="text-slate-900">{m.kpiValue}</strong></span>
                    <span className={`font-bold ${m.accentColor}`}>{m.tag}</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Quick Notice Banner */}
          <div className="p-4 rounded-2xl bg-blue-50/80 border border-blue-200 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-blue-600 shrink-0" />
              <p className="text-xs text-slate-700 font-medium">
                Toàn bộ các quy chuẩn trên đều được áp dụng thống nhất trên toàn hệ thống kho Boxora.
              </p>
            </div>
            <a
              href="tel:1900636888"
              className="text-xs font-bold text-blue-600 hover:text-blue-800 whitespace-nowrap hidden sm:inline"
            >
              Hotline: 1900 636 888
            </a>
          </div>
        </div>

        {/* 4. MODAL FOOTER */}
        <div className="px-6 sm:px-8 py-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-600 text-left">
            Bằng việc nhấn xác nhận, bạn cam kết tuân thủ đầy đủ Bộ Quy chuẩn &amp; Điều khoản vận hành kho Boxora.
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
            >
              Đóng
            </button>

            {onAccept && (
              <button
                onClick={() => {
                  onAccept()
                  onClose()
                }}
                className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
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
