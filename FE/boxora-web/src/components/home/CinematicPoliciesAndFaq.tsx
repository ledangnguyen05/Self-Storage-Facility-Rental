import { useLanguage } from '../../context/LanguageContext'
import React, { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export type PolicyTabKey = 'deposit' | 'insurance' | 'contract' | 'prohibited'
export type FaqCategoryKey = 'ALL' | 'IOT' | 'CONTRACT' | 'FACILITY'

interface CinematicPoliciesAndFaqProps {
  activePolicyTab: PolicyTabKey
  setActivePolicyTab: React.Dispatch<React.SetStateAction<PolicyTabKey>>
  faqFilter: FaqCategoryKey
  setFaqFilter: React.Dispatch<React.SetStateAction<FaqCategoryKey>>
  activeFaqIndex: number | null
  setActiveFaqIndex: React.Dispatch<React.SetStateAction<number | null>>
  onBookNow: () => void
}

export const POLICY_DOSSIER: Record<
  PolicyTabKey,
  {
    code: string
    metric: string
    metricSub: string
    headline: string
    subtitle: string
    clauses: { num: string; label: string; title: string; body: string }[]
  }
> = {
  deposit: {
    code: '01',
    metric: '100%',
    metricSub: 'Tiền cọc dùng để bảo đảm cho kho và hoàn trả lại khi ngừng thuê',
    headline: 'Chính Sách Tiền Cọc Bảo Đảm Kho & Hoàn Trả Khi Kết Thúc Thuê',
    subtitle: 'ÁP DỤNG CHO KHÁCH HÀNG CÁ NHÂN & DOANH NGHIỆP',
    clauses: [
      {
        num: '01',
        label: 'MỤC ĐÍCH TIỀN CỌC',
        title: 'Bảo Đảm Buồng Kho Trong Thời Gian Thuê',
        body: 'Khoản tiền đặt cọc (tương đương 01 tháng tiền thuê cơ bản) được dùng để bảo đảm cho buồng kho và thiết bị khóa thông minh IoT trong suốt thời gian khách hàng thuê kho.'
      },
      {
        num: '02',
        label: 'HOÀN TRẢ KHI NGỪNG THUÊ',
        title: 'Trả Lại Đầy Đủ Khi Không Thuê Kho Nữa',
        body: 'Tiền cọc được giữ bảo đảm trong suốt kỳ hạn hợp đồng và sẽ được hoàn trả lại đầy đủ cho khách hàng khi khách hàng kết thúc hợp đồng (không thuê kho nữa) và bàn giao lại buồng kho nguyên vẹn.'
      },
      {
        num: '03',
        label: 'KHÔNG CHI PHÍ ẨN',
        title: 'Thanh Toán VNPay Hoặc Giữ Chỗ 0₫',
        body: 'Giá niêm yết đã bao gồm điện chiếu sáng, điều hòa thông gió, phí an ninh 24/7 và bảo trì khóa IoT. Hỗ trợ thanh toán VNPay / VietQR hoặc giữ chỗ trước 0 ₫.'
      }
    ]
  },
  insurance: {
    code: '02',
    metric: '500M',
    metricSub: 'Bảo vệ an toàn giá trị tài sản lưu kho toàn diện',
    headline: 'Gói Bảo Hiểm Tài Sản & Cơ Chế Đền Bù Minh Bạch',
    subtitle: 'BẢO TRỢ BỞI ĐƠN VỊ BẢO HIỂM TÀI SẢN UY TÍN',
    clauses: [
      {
        num: '01',
        label: 'GÓI TIÊU CHUẨN • MIỄN PHÍ',
        title: 'Bồi Thường Đến 50 Triệu VNĐ',
        body: 'Mỗi buồng kho ký hợp đồng đều được tự động kích hoạt gói bảo hiểm cơ bản lên đến 50.000.000 VNĐ cho rủi ro cháy nổ, ngập úng hoặc sự cố kỹ thuật.'
      },
      {
        num: '02',
        label: 'GÓI MỞ RỘNG • DOANH NGHIỆP',
        title: 'Bảo Vệ Lên Đến 500 Triệu VNĐ',
        body: 'Dành cho doanh nghiệp hoặc cá nhân cất giữ hàng hóa giá trị cao, thiết bị quang học, máy móc chính xác với mức phí phụ trợ ưu đãi.'
      },
      {
        num: '03',
        label: 'QUY TRÌNH BỒI THƯỜNG',
        title: 'Giải Quyết Minh Bạch 7 – 14 Ngày',
        body: 'Khi có sự cố khách quan được xác nhận bởi đơn vị giám định độc lập, biên bản bồi thường được giải quyết và chi trả nhanh chóng trong 7 – 14 ngày làm việc.'
      }
    ]
  },
  contract: {
    code: '03',
    metric: '-20%',
    metricSub: 'Ưu đãi chiết khấu hợp đồng dài hạn & Thuê từ 07 ngày',
    headline: 'Thời Hạn Thuê Linh Hoạt, Tự Động Gia Hạn & Đổi Cỡ Kho Miễn Phí',
    subtitle: 'ĐIỀU KHOẢN HỢP ĐỒNG MINH BẠCH & CHỦ ĐỘNG',
    clauses: [
      {
        num: '01',
        label: 'THỜI HẠN LINH HOẠT',
        title: 'Thuê Từ 07 Ngày Hoặc Theo Tháng',
        body: 'Hỗ trợ thuê ngắn hạn theo ngày (tối thiểu ≥ 07 ngày) hoặc thuê theo tháng (1, 3, 6, 12, 24 tháng) với mức chiết khấu tự động từ 5% đến 20%.'
      },
      {
        num: '02',
        label: 'GIA HẠN & ĐỔI CỠ KHO',
        title: 'Thông Báo Trước 5 Ngày • Đổi Cỡ 0₫',
        body: 'Hệ thống tự động nhắc hạn trước 5 ngày qua Email/SMS. Khách hàng có thể nâng hoặc hạ kích thước buồng kho (1m³ – 24m³) bất kỳ lúc nào mà không mất phí chuyển đổi.'
      },
      {
        num: '03',
        label: 'CHỦ ĐỘNG HỦY HỢP ĐỒNG',
        title: 'Báo Trước 07 Ngày Không Phí Phạt',
        body: 'Khách hàng chủ động gửi yêu cầu kết thúc hợp đồng trước 07 ngày trực tiếp trên Cổng khách hàng (Portal) để nghiệm thu và nhận lại tiền cọc nhanh chóng.'
      }
    ]
  },
  prohibited: {
    code: '04',
    metric: '24/7',
    metricSub: '100% buồng kho trang bị cảm biến khói nhiệt tự động',
    headline: 'Danh Mục Hàng Hóa Nghiêm Cấm & Tiêu Chuẩn An Toàn PCCC',
    subtitle: 'TIÊU CHUẨN AN TOÀN PHÒNG CHÁY CHỮA CHÁY QUỐC GIA',
    clauses: [
      {
        num: '01',
        label: 'CHẤT DỄ CHÁY NỔ & HÓA CHẤT',
        title: 'Tuyệt Đối Nghiêm Cấm Lưu Trữ',
        body: 'Cấm lưu trữ xăng dầu, bình gas, pháo hoa, pin lithium hỏng/phồng, dung môi sơn, hóa chất ăn mòn và các vật liệu nguy hại dễ bắt lửa.'
      },
      {
        num: '02',
        label: 'HÀNG HÓA BẤT HỢP PHÁP & TƯƠI SỐNG',
        title: 'Tuân Thủ Quy Định Pháp Luật',
        body: 'Cấm động vật sống, thực phẩm tươi sống dễ phân hủy gây mùi hôi, vũ khí, hàng lậu hoặc bất kỳ tài sản nào vi phạm pháp luật Việt Nam.'
      },
      {
        num: '03',
        label: 'CƠ CHẾ GIÁM SÁT PCCC 24/7',
        title: 'Cảm Biến Khói Nhiệt & Phun Sương Tự Động',
        body: '100% buồng kho trang bị đầu dò khói nhiệt thông minh kết nối trung tâm PCCC. Hệ thống chữa cháy tự động luôn trực chiến 24/7/365.'
      }
    ]
  }
}

export const FAQ_ITEMS: { cat: Exclude<FaqCategoryKey, 'ALL'>; q: string; a: string }[] = [
  {
    cat: 'IOT',
    q: 'Tôi có thể ra vào buồng kho vào ban đêm hoặc ngày Lễ/Tết không?',
    a: 'Hoàn toàn ĐƯỢC. Boxora ứng dụng công nghệ khóa số IoT thông minh độc lập cho từng buồng kho, hoạt động liên tục 24/7/365. Bạn có thể tự do mở cửa buồng kho của mình vào bất kỳ lúc nào lúc nửa đêm, sáng sớm hay ngày Lễ Tết chỉ bằng mã PIN cá nhân hoặc trên Cổng khách hàng (Portal) mà không cần báo trước hay đợi nhân viên mở cửa.'
  },
  {
    cat: 'CONTRACT',
    q: 'Thời hạn thuê kho tối thiểu tại Boxora là bao lâu? Có ưu đãi dài hạn không?',
    a: 'Boxora hỗ trợ thuê ngắn hạn theo ngày (tối thiểu từ 07 ngày) hoặc thuê theo tháng (1, 3, 6, 12, 24 tháng). Khi ký hợp đồng theo kỳ hạn tháng, bạn nhận ngay mức chiết khấu tiết kiệm từ 5% đến 20% (3 tháng -5%, 6 tháng -10%, 12 tháng -15%, 24 tháng -20%).'
  },
  {
    cat: 'CONTRACT',
    q: 'Tôi có thể thanh toán trực tuyến VNPay hay giữ chỗ trước rồi thanh toán sau?',
    a: 'Tại Bước 5 (Thanh toán), bạn có thể chọn: (1) Thanh toán trực tuyến ngay qua cổng VNPay / VietQR để ký hợp đồng điện tử và kích hoạt kho tức thì; hoặc (2) Đặt giữ chỗ trước với phí 0 ₫ và thanh toán sau khi đến cơ sở kiểm tra buồng kho thực tế.'
  },
  {
    cat: 'CONTRACT',
    q: 'Tôi có thể đổi sang buồng kho lớn hơn hoặc nhỏ hơn khi đang thuê không?',
    a: 'Hoàn toàn thuận tiện. Khách hàng có thể yêu cầu nâng cấp hoặc thu nhỏ buồng kho (trong 16 quy chuẩn từ 1 m³ đến 24 m³) bất kỳ lúc nào trên Dashboard. Hệ thống sẽ tự động đối soát số dư tiền thuê và tiền cọc còn lại của hợp đồng cũ sang buồng kho mới ngay trong ngày mà không mất phí chuyển đổi buồng.'
  },
  {
    cat: 'IOT',
    q: 'Mã PIN của tôi có bảo mật không? Nhân viên Boxora có biết mã mở khóa không?',
    a: 'Mã PIN mở khóa được mã hóa bảo mật trực tiếp trên hệ thống. Nhân viên Boxora không thể xem hoặc can thiệp vào mã PIN cá nhân của bạn. Chỉ duy nhất bạn sở hữu mã và có thể chủ động đổi mã số mới trực tiếp trên tài khoản bất cứ lúc nào.'
  },
  {
    cat: 'FACILITY',
    q: 'Sự khác biệt giữa Buồng Kho Tiêu Chuẩn (Non-A/C) và Kho Máy Lạnh (A/C) là gì?',
    a: 'Buồng Kho Tiêu Chuẩn (Non-A/C) thông thoáng, khô ráo, phù hợp khi thuê cất giữ đồ gia dụng, nội thất hoặc thùng đồ thông thường. Buồng Kho Máy Lạnh (A/C) duy trì nhiệt độ ổn định 18°C – 22°C và độ ẩm dưới 55% RH suốt 24/7, phù hợp khi thuê bảo quản thiết bị điện tử, đồ da, máy ảnh và tài liệu quan trọng.'
  }
]

export const CinematicPoliciesAndFaq: React.FC<CinematicPoliciesAndFaqProps> = ({ activePolicyTab,
  setActivePolicyTab,
  faqFilter,
  setFaqFilter,
  activeFaqIndex,
  setActiveFaqIndex,
  onBookNow }) => {
  const { t } = useLanguage();
  const containerRef = useRef<HTMLDivElement | null>(null)
  const policy3dRef = useRef<HTMLDivElement | null>(null)
  const finale3dRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) return

    const ctx = gsap.context(() => {
      if (policy3dRef.current) {
        gsap.fromTo(
          policy3dRef.current,
          { rotateX: 16, rotateY: 8, z: -90 },
          {
            rotateX: -3,
            rotateY: -4,
            z: 0,
            ease: 'none',
            scrollTrigger: {
              trigger: policy3dRef.current,
              start: 'top 88%',
              end: 'bottom 25%',
              scrub: 0.7,
              invalidateOnRefresh: true
            }
          }
        )
      }

      if (finale3dRef.current) {
        gsap.fromTo(
          finale3dRef.current,
          { rotateX: 22, scale: 0.88, z: -120 },
          {
            rotateX: 0,
            scale: 1,
            z: 0,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: finale3dRef.current,
              start: 'top 92%',
              end: 'top 42%',
              scrub: 0.7,
              invalidateOnRefresh: true
            }
          }
        )
      }
    }, el)

    return () => ctx.revert()
  }, [])

  const currentPolicy = POLICY_DOSSIER[activePolicyTab]
  const filteredFaqs = faqFilter === 'ALL' ? FAQ_ITEMS : FAQ_ITEMS.filter((f) => f.cat === faqFilter)

  return (
    <div ref={containerRef}>
      {/* ============================================================ */}
      {/* SCENE 05: DAYLIGHT 3D SWISS-GRID TRANSPARENT POLICIES         */}
      {/* ============================================================ */}
      <section id="policies" className="py-24 lg:py-36 border-b border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-950">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10 space-y-14">
          
          {/* Editorial Header + Tab Bar */}
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 border-b border-slate-200/80 pb-10 text-left">
            <div className="space-y-4 max-w-2xl">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">
                05 / CAM KẾT PHÁP LÝ &amp; MINH BẠCH TÀI CHÍNH
              </div>
              <h2 className="font-headline text-3xl sm:text-5xl font-semibold text-slate-950 tracking-[-0.04em] leading-[1.06]">
                Chính sách rõ ràng.
                <span className="block text-slate-400">Bảo vệ quyền lợi tuyệt đối.</span>
              </h2>
            </div>

            {/* Clean Daylight Policy Switcher Tabs */}
            <div className="flex flex-wrap gap-2.5">
              {[
                { id: 'deposit' as const, label: '01 / Hoàn Cọc & Chi Phí' },
                { id: 'insurance' as const, label: '02 / Bảo Hiểm Tài Sản' },
                { id: 'contract' as const, label: '03 / Kỳ Hạn & Đổi Cỡ' },
                { id: 'prohibited' as const, label: '04 / An Toàn PCCC' }
              ].map((tab) => {
                const active = activePolicyTab === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActivePolicyTab(tab.id)}
                    className={`py-3 px-5 rounded-full text-xs font-semibold transition-all cursor-pointer border ${
                      active
                        ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-600/20'
                        : 'bg-slate-50 hover:bg-white text-slate-700 border-slate-200/90 hover:border-blue-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 3D Perspective Daylight Swiss Dossier */}
          <div style={{ perspective: '1600px' }}>
            <div ref={policy3dRef} className="will-change-transform" style={{ transformStyle: 'preserve-3d' }}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={activePolicyTab}
                  initial={{ opacity: 0, rotateX: 8, y: 12 }}
                  animate={{ opacity: 1, rotateX: 0, y: 0 }}
                  exit={{ opacity: 0, rotateX: -8, y: -12 }}
                  transition={{ duration: 0.3 }}
                  className="rounded-[36px] border border-blue-100 bg-[linear-gradient(135deg,#f4f9ff_0%,#ffffff_55%,#f0fdf9_100%)] overflow-hidden shadow-[0_28px_70px_rgba(8,102,245,0.08)]"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-12">
                    
                    {/* Left Daylight Frosted Glass Metric Column (No Black Background) */}
                    <div className="lg:col-span-4 bg-gradient-to-br from-blue-600/8 via-cyan-500/8 to-teal-400/10 border-b lg:border-b-0 lg:border-r border-blue-100/90 p-8 sm:p-12 flex flex-col justify-between text-left">
                      <div className="space-y-3">
                        <span className="font-mono text-xs font-bold text-blue-600 uppercase tracking-widest">
                          ĐIỀU KHOẢN {currentPolicy.code} / 04
                        </span>
                        <div className="font-headline text-6xl sm:text-7xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-500 pt-2">
                          {currentPolicy.metric}
                        </div>
                        <p className="text-sm text-slate-600 leading-relaxed pt-1">
                          {currentPolicy.metricSub}
                        </p>
                      </div>

                      <div className="pt-8 mt-8 border-t border-blue-200/60 space-y-2">
                        <div className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">
                          {currentPolicy.subtitle}
                        </div>
                        <div className="text-base font-bold text-slate-950 leading-snug">
                          {currentPolicy.headline}
                        </div>
                      </div>
                    </div>

                    {/* Right 3-Clause Specification Ledger */}
                    <div className="lg:col-span-8 divide-y divide-slate-200/70 bg-white/80 text-left">
                      {currentPolicy.clauses.map((clause) => (
                        <div key={clause.num} className="p-7 sm:p-9 flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-8">
                          <span className="font-mono text-xs font-bold px-3.5 py-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 shrink-0">
                            {clause.num} • {clause.label}
                          </span>
                          <div className="space-y-2">
                            <h3 className="font-headline text-lg sm:text-xl font-bold text-slate-950">
                              {clause.title}
                            </h3>
                            <p className="text-sm text-slate-600 leading-relaxed">
                              {clause.body}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

        </div>
      </section>

      {/* ============================================================ */}
      {/* SCENE 06: ASYMMETRIC FAQ & MULTI-CHANNEL DISPATCH DESK        */}
      {/* ============================================================ */}
      <section id="faq" className="py-24 lg:py-36 border-b border-slate-200/70 dark:border-slate-800 bg-[#f8fafc] dark:bg-slate-900">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start text-left">
            
            {/* Left Sticky Dispatch Column */}
            <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-8">
              <div className="space-y-4">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">
                  06 / GIẢI ĐÁP &amp; KẾT NỐI TRỰC TIẾP
                </div>
                <h2 className="font-headline text-3xl sm:text-4xl font-semibold text-slate-950 tracking-[-0.03em] leading-tight">
                  Câu hỏi thường gặp &amp; Hỗ trợ khách hàng 24/7.
                </h2>
                <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                  Giải đáp nhanh những băn khoăn phổ biến nhất khi bắt đầu thuê buồng kho tự quản tại Boxora.
                </p>
              </div>

              {/* Filter Chips */}
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'ALL' as const, label: 'Tất Cả' },
                  { id: 'IOT' as const, label: 'Khóa IoT & Ra Vào 24/7' },
                  { id: 'CONTRACT' as const, label: 'Hợp Đồng & Chi Phí' },
                  { id: 'FACILITY' as const, label: 'Cơ Sở & Chế Độ Kho' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setFaqFilter(tab.id)
                      setActiveFaqIndex(0)
                    }}
                    className={`py-2.5 px-4 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                      faqFilter === tab.id
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20'
                        : 'bg-white border border-slate-200 hover:border-blue-300 text-slate-600'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* 4 Multi-Channel Support Touchpoints */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
                <div className="p-5 rounded-2xl bg-white border border-slate-200/80 space-y-1">
                  <span className="font-mono text-[10px] font-bold text-blue-600 uppercase">TỔNG ĐÀI 24/7</span>
                  <div className="text-base font-bold text-slate-950">1900-BOXORA</div>
                  <div className="text-xs text-slate-500">1900 269 672 • Trực kỹ thuật</div>
                </div>

                <div className="p-5 rounded-2xl bg-white border border-slate-200/80 space-y-1">
                  <span className="font-mono text-[10px] font-bold text-cyan-700 uppercase">EMAIL HỖ TRỢ</span>
                  <div className="text-base font-bold text-slate-950">support@boxora.vn</div>
                  <div className="text-xs text-slate-500">Hợp đồng B2B &amp; Hóa đơn VAT</div>
                </div>

                <div className="p-5 rounded-2xl bg-white border border-slate-200/80 space-y-1">
                  <span className="font-mono text-[10px] font-bold text-teal-700 uppercase">ZALO DOANH NGHIỆP</span>
                  <div className="text-base font-bold text-slate-950">Boxora Storage</div>
                  <div className="text-xs text-slate-500">Gửi ảnh kho thực tế tức thì</div>
                </div>

                <div className="p-5 rounded-2xl bg-white border border-slate-200/80 space-y-1">
                  <span className="font-mono text-[10px] font-bold text-blue-700 uppercase">GIỜ TRỰC TẠI QUẦY</span>
                  <div className="text-base font-bold text-slate-950">08:00 – 20:00</div>
                  <div className="text-xs text-slate-500">Mỗi ngày (Kể cả Lễ/Tết)</div>
                </div>
              </div>
            </div>

            {/* Right Accordion Column */}
            <div className="lg:col-span-7 space-y-4">
              {filteredFaqs.map((faq, idx) => {
                const isOpen = activeFaqIndex === idx
                return (
                  <div
                    key={faq.q}
                    className={`rounded-3xl border transition-all overflow-hidden ${
                      isOpen
                        ? 'bg-white border-blue-500 shadow-[0_16px_40px_rgba(8,102,245,0.08)]'
                        : 'bg-white/90 border-slate-200/90 hover:border-blue-300'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveFaqIndex(isOpen ? null : idx)}
                      className="w-full p-6 sm:p-7 text-left flex items-center justify-between gap-4 font-headline text-base sm:text-lg font-semibold text-slate-950 cursor-pointer hover:text-blue-600 transition-colors"
                    >
                      <span className="flex items-center gap-4">
                        <span className="font-mono text-xs font-bold text-blue-600">
                          0{idx + 1}
                        </span>
                        <span>{faq.q}</span>
                      </span>
                      <span
                        className={`text-slate-400 shrink-0 transition-transform duration-200 text-xl leading-none ${
                          isOpen ? 'rotate-45 text-blue-600' : ''
                        }`}
                      >
                        +
                      </span>
                    </button>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                          className="overflow-hidden"
                        >
                          <div className="px-6 sm:px-7 pb-7 pt-4 text-sm text-slate-600 leading-relaxed border-t border-slate-100">
                            {faq.a}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })}
            </div>

          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* SCENE 07: LUMINOUS DAYLIGHT 3D ORBITAL FINALE PORTAL          */}
      {/*           (Zero Black Box — Matches Hero Light Field)         */}
      {/* ============================================================ */}
      <section className="py-24 lg:py-32 bg-white dark:bg-slate-950 relative overflow-hidden">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10" style={{ perspective: '1500px' }}>
          <div
            ref={finale3dRef}
            className="rounded-[44px] bg-[linear-gradient(135deg,#f0f7ff_0%,#e6f6ff_45%,#ecfdf5_100%)] dark:bg-[linear-gradient(135deg,#0c192e_0%,#091322_45%,#081d19_100%)] text-slate-950 p-10 sm:p-16 lg:p-24 relative overflow-hidden border border-blue-200/80 shadow-[0_32px_90px_rgba(8,102,245,0.12)] will-change-transform"
            style={{ transformStyle: 'preserve-3d' }}
          >
            {/* 3D Orbital Daylight Rings */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[420px] w-[860px] rounded-[50%] border border-blue-500/20"
              style={{ transform: 'rotateX(58deg) rotateZ(-12deg)' }}
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[320px] w-[680px] rounded-[50%] border border-cyan-500/25"
              style={{ transform: 'rotateX(58deg) rotateZ(14deg)' }}
            />

            <div className="relative z-10 max-w-3xl mx-auto text-center space-y-6">
              <div className="text-xs font-bold uppercase tracking-[0.22em] text-blue-600">
                BẮT ĐẦU LƯU TRỮ THÔNG MINH 24/7
              </div>

              <h2 className="font-headline text-3xl sm:text-5xl lg:text-6xl font-semibold text-slate-950 tracking-[-0.04em] leading-[1.04]">
                Sẵn sàng mở rộng không gian sống của bạn?
              </h2>

              <p className="text-sm sm:text-base lg:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
                16 quy chuẩn thể tích từ 1 m³ đến 24 m³ • Thanh toán trực tuyến VNPay ký hợp đồng điện tử ngay hoặc đặt giữ chỗ trước 0 ₫.
              </p>

              <div className="flex flex-wrap justify-center gap-4 pt-3">
                <button
                  type="button"
                  onClick={onBookNow}
                  className="px-8 py-4 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-lg shadow-blue-600/25 transition-all flex items-center gap-2.5 cursor-pointer"
                >
                  <span>Đặt kho ngay</span>
                  <span>→</span>
                </button>

                <a
                  href="tel:1900BOXORA"
                  className="px-7 py-4 rounded-full bg-white/90 hover:bg-white border border-blue-200 text-blue-950 font-semibold text-sm shadow-xs transition-all flex items-center gap-2"
                >
                  <span>Hotline 1900-BOXORA</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
