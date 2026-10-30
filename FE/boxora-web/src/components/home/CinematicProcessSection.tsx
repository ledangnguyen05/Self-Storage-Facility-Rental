import React, { useEffect, useRef } from 'react'
import { useLanguage } from '../../context/LanguageContext'
import { motion, AnimatePresence } from 'framer-motion'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import facilityD1 from '../../assets/facilities/facility-d1.jpg'

gsap.registerPlugin(ScrollTrigger)

export type ProcessStepNumber = 1 | 2 | 3 | 4 | 5 | 6

export interface ProcessStepItem {
  step: ProcessStepNumber
  code: string
  stepLabel: string
  title: string
  cardDesc: string
  footerLabel: string
  metricLabel: string
  metricValue: string
  image: string
  imageCaption: string
}

export const PROCESS_STEPS_DATA: ProcessStepItem[] = [
  {
    step: 1,
    code: '01',
    stepLabel: 'BƯỚC 1',
    title: 'Chọn Cơ Sở Kho',
    cardDesc: 'Khám phá danh sách các chi nhánh Boxora hiện đại và lựa chọn địa điểm lưu trữ thuận tiện nhất.',
    footerLabel: 'Hệ thống 4 cơ sở TP.HCM',
    metricLabel: 'Mạng lưới trung tâm',
    metricValue: 'Quận 1 • Quận 7 • Thủ Đức • Tân Bình',
    image: facilityD1,
    imageCaption: 'Hệ thống 4 cơ sở kho tự quản hiện đại tại TP. Hồ Chí Minh'
  },
  {
    step: 2,
    code: '02',
    stepLabel: 'BƯỚC 2',
    title: 'Chọn Kích Thước 3D',
    cardDesc: 'Trải nghiệm 16 quy chuẩn thể tích từ 1m³ đến 24m³, tùy chọn buồng tiêu chuẩn hoặc kho lạnh A/C.',
    footerLabel: 'Mô hình 3D trực quan',
    metricLabel: 'Quy chuẩn không gian',
    metricValue: '16 cỡ (1m³ – 24m³) • Non-A/C & A/C',
    image: '/assets/units/unit-standard.jpg',
    imageCaption: 'Không gian bên trong buồng kho thực tế cao thoáng, sàn phủ epoxy'
  },
  {
    step: 3,
    code: '03',
    stepLabel: 'BƯỚC 3',
    title: 'Thời Gian & Lịch Hẹn',
    cardDesc: 'Chọn kỳ hạn thuê (gói tháng hoặc theo ngày ≥ 7 ngày), lịch đón tiếp và tự động đồng bộ CCCD tài khoản.',
    footerLabel: 'Đồng bộ từ tài khoản',
    metricLabel: 'Ưu đãi kỳ hạn dài',
    metricValue: 'Giảm 5% – 20% • Thuê lẻ từ 7 ngày',
    image: '/assets/units/facility-hallway.jpg',
    imageCaption: 'Hành lang buồng kho an ninh 24/7 sẵn sàng đón khách theo lịch hẹn'
  },
  {
    step: 4,
    code: '04',
    stepLabel: 'BƯỚC 4',
    title: 'Xem Báo Giá & Chi Tiết',
    cardDesc: 'Xem bảng kê chi phí chính thức, tiền cọc bảo đảm kho, phí 0đ và rà soát kỹ lưỡng chi tiết đơn đặt.',
    footerLabel: 'Báo giá minh bạch 0đ phí',
    metricLabel: 'Cam kết tài chính',
    metricValue: 'Tiền cọc bảo đảm kho • Hoàn trả khi ngừng thuê',
    image: '/assets/units/unit-capacity-standard.jpg',
    imageCaption: 'Sức chứa thực tế minh bạch, chỉ trả phí theo đúng cỡ kho lựa chọn'
  },
  {
    step: 5,
    code: '05',
    stepLabel: 'BƯỚC 5',
    title: 'Thanh Toán Linh Hoạt',
    cardDesc: 'Thanh toán trực tuyến qua cổng VNPay / VietQR để ký hợp đồng điện tử ngay, hoặc chọn giữ chỗ trước 0đ thanh toán khi nhận kho.',
    footerLabel: 'VNPay / VietQR hoặc Giữ chỗ 0đ',
    metricLabel: 'Phương thức giao dịch',
    metricValue: 'Ký HĐ điện tử ngay hoặc Giữ chỗ 0₫',
    image: '/assets/units/unit-front-standard.jpg',
    imageCaption: 'Buồng kho riêng biệt tích hợp khóa thông minh sẵn sàng kích hoạt'
  },
  {
    step: 6,
    code: '06',
    stepLabel: 'BƯỚC 6',
    title: 'Đặt Chỗ & Chờ Tiếp Đón',
    cardDesc: 'Nhận mã giữ chỗ tức thì. Chuyên viên Boxora chủ động liên hệ hỗ trợ thủ tục nhận bàn giao buồng kho.',
    footerLabel: 'Nhân viên hỗ trợ tận tình',
    metricLabel: 'Quyền truy cập tự quản',
    metricValue: 'Cấp mã PIN khóa số IoT ra vào 24/7',
    image: '/assets/units/unit-front-large.jpg',
    imageCaption: 'Nhận bàn giao buồng kho thực tế và mã PIN khóa số IoT cá nhân'
  }
]

interface CinematicProcessSectionProps {
  activeProcessStep: ProcessStepNumber
  setActiveProcessStep: React.Dispatch<React.SetStateAction<ProcessStepNumber>>
  onBookNow: () => void
}

export const CinematicProcessSection: React.FC<CinematicProcessSectionProps> = ({ activeProcessStep,
  setActiveProcessStep,
  onBookNow }) => {
  const { t } = useLanguage();
  const sectionRef = useRef<HTMLElement | null>(null)
  const photoStage3dRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const section = sectionRef.current
    const photoStage = photoStage3dRef.current
    if (!section || !photoStage) return

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) return

    const ctx = gsap.context(() => {
      // 1. Scroll-scrubbed 3D perspective tilt on the real photography stage
      gsap.fromTo(
        photoStage,
        { rotateX: 16, rotateY: -14, rotateZ: 1.5, scale: 0.92 },
        {
          rotateX: -4,
          rotateY: 8,
          rotateZ: -1,
          scale: 1.02,
          ease: 'none',
          scrollTrigger: {
            trigger: section,
            start: 'top 75%',
            end: 'bottom 25%',
            scrub: 0.75,
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              const p = self.progress
              const nextStep = Math.min(6, Math.max(1, Math.ceil(p * 6))) as ProcessStepNumber
              setActiveProcessStep((prev) => (prev !== nextStep ? nextStep : prev))
            }
          }
        }
      )

      // 2. 3D Perspective entrance for the 6 step cards
      const cards = gsap.utils.toArray<HTMLElement>('[data-step-card-3d]')
      cards.forEach((card, i) => {
        gsap.fromTo(
          card,
          {
            rotateX: 20,
            rotateY: i % 2 === 0 ? -10 : 10,
            z: -100,
            y: 48,
            opacity: 0
          },
          {
            rotateX: 0,
            rotateY: 0,
            z: 0,
            y: 0,
            opacity: 1,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: card,
              start: 'top 92%',
              end: 'top 62%',
              scrub: 0.6,
              invalidateOnRefresh: true
            }
          }
        )
      })
    }, section)

    return () => ctx.revert()
  }, [setActiveProcessStep])

  const currentStep = PROCESS_STEPS_DATA.find((s) => s.step === activeProcessStep) || PROCESS_STEPS_DATA[0]

  return (
    <section
      id="process"
      ref={sectionRef}
      className="relative isolate overflow-hidden bg-[linear-gradient(180deg,#f1fff8_0%,#f7faff_28%,#ffffff_100%)] dark:bg-[linear-gradient(180deg,#090d16_0%,#0d172a_30%,#0a0f1d_100%)] py-24 lg:py-36 border-b border-slate-200/60"
    >
      {/* Luminous Daylight Spatial Orbs */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-24 -translate-x-1/2 h-[540px] w-[980px] rounded-full bg-[radial-gradient(ellipse,rgba(8,102,245,0.10)_0%,rgba(0,191,216,0.08)_42%,transparent_72%)] blur-3xl"
      />

      <div className="relative z-10 mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10 space-y-20">
        
        {/* Top Editorial Typography & Real Photography 3D Perspective Stage */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 items-center">
          
          {/* Left 6 Cols: Editorial Narrative */}
          <div className="lg:col-span-6 space-y-6 text-left">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">
              {t('01 / HÀNH TRÌNH ĐẶT KHO KHÉP KÍN')}
            </div>

            <h2 className="font-headline text-3xl sm:text-5xl lg:text-[54px] font-semibold text-slate-950 tracking-[-0.04em] leading-[1.04]">
              Sáu bước trực tuyến.
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-500">
                Nhận buồng kho thực tế.
              </span>
            </h2>

            <p className="text-sm sm:text-base lg:text-lg text-slate-600 leading-relaxed max-w-xl">
              Từ bước chọn cơ sở, chọn kích thước kho phù hợp, đối soát báo giá minh bạch đến thanh toán trực tuyến VNPay và nhận bàn giao mã PIN khóa thông minh tại cơ sở.
            </p>

            {/* Live Active Stage Readout Glass Bar */}
            <div className="rounded-3xl bg-white/90 backdrop-blur-xl border border-blue-100/90 p-5 sm:p-6 shadow-[0_20px_50px_rgba(8,102,245,0.07)] space-y-3 max-w-xl">
              <div className="flex items-center justify-between text-xs font-semibold text-blue-600">
                <span>ĐANG XEM • {currentStep.stepLabel}</span>
                <span className="font-mono text-slate-400">{currentStep.code} / 06</span>
              </div>
              <div className="text-lg sm:text-xl font-bold text-slate-950">
                {t(currentStep.title)} — <span className="text-blue-600">{currentStep.metricValue}</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                {currentStep.cardDesc}
              </p>
            </div>
          </div>

          {/* Right 6 Cols: Real Warehouse Photography in 3D Perspective Stage */}
          <div className="lg:col-span-6" style={{ perspective: '1600px' }}>
            <div
              ref={photoStage3dRef}
              className="relative will-change-transform"
              style={{ transformStyle: 'preserve-3d' }}
            >
              {/* Back Floating Depth Frame */}
              <div
                aria-hidden="true"
                className="absolute -inset-3 rounded-[36px] bg-gradient-to-tr from-blue-500/15 via-cyan-400/15 to-teal-300/15 border border-blue-200/60"
                style={{ transform: 'translateZ(-35px)' }}
              />

              {/* Main Real Photo Viewport */}
              <div className="relative aspect-[16/11] w-full rounded-[32px] overflow-hidden bg-slate-100 border-2 border-white shadow-[0_30px_80px_rgba(15,23,42,0.14)]">
                <AnimatePresence mode="wait">
                  <motion.img
                    key={currentStep.image}
                    src={currentStep.image}
                    alt={currentStep.title}
                    initial={{ opacity: 0, scale: 1.05 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.35 }}
                    className="h-full w-full object-cover"
                  />
                </AnimatePresence>
              </div>

              {/* Floating 3D Glass Caption Plaque */}
              <div
                className="mt-4 sm:mt-0 sm:absolute sm:-bottom-5 sm:left-6 sm:right-6 rounded-2xl bg-white/92 backdrop-blur-xl border border-blue-100 px-5 py-4 shadow-[0_20px_50px_rgba(8,102,245,0.14)] flex items-center justify-between gap-4 text-left"
                style={{ transform: 'translateZ(45px)' }}
              >
                <div>
                  <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-blue-600">
                    HÌNH ẢNH THỰC TẾ • {currentStep.stepLabel}
                  </div>
                  <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                    {currentStep.imageCaption}
                  </div>
                </div>
                <span className="font-headline text-2xl font-bold text-blue-600 shrink-0">
                  {currentStep.code}
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* 6-Step 3D Perspective Cards Grid (Includes Step 5 Payment & Step 6 Handover) */}
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-left pt-4"
          style={{ perspective: '1400px' }}
        >
          {PROCESS_STEPS_DATA.map((item) => {
            const isActive = activeProcessStep === item.step
            return (
              <div
                key={item.step}
                data-step-card-3d
                onClick={() => setActiveProcessStep(item.step)}
                className={`group relative rounded-[28px] p-7 transition-all duration-300 cursor-pointer flex flex-col justify-between will-change-transform ${
                  isActive
                    ? 'bg-white dark:bg-slate-900 border-2 border-blue-600 shadow-[0_24px_60px_rgba(8,102,245,0.14)] -translate-y-2'
                    : 'bg-white/80 hover:bg-white border border-slate-200/90 hover:border-blue-300 shadow-[0_10px_30px_rgba(15,23,42,0.04)] hover:-translate-y-1.5'
                }`}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span
                      className={`font-headline text-3xl font-bold tracking-tight transition-colors ${
                        isActive ? 'text-blue-600' : 'text-slate-300 group-hover:text-blue-500'
                      }`}
                    >
                      {item.code}
                    </span>
                    <span
                      className={`text-[11px] font-bold tracking-wider uppercase px-3 py-1 rounded-full ${
                        isActive
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-600 group-hover:bg-blue-50 group-hover:text-blue-700'
                      }`}
                    >
                      {item.stepLabel}
                    </span>
                  </div>

                  <h3 className="font-headline text-xl font-bold text-slate-950 tracking-tight">
                    {item.title}
                  </h3>

                  <p className="text-sm text-slate-600 leading-relaxed">
                    {item.cardDesc}
                  </p>
                </div>

                <div className="pt-5 mt-6 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-blue-700">
                  <span>{item.footerLabel}</span>
                  <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Bottom Action Row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200/70">
          <p className="text-sm text-slate-600">
            Hoàn tất giữ chỗ trực tuyến trong 2 phút • Hỗ trợ thanh toán VNPay / VietQR hoặc giữ chỗ trước 0 ₫.
          </p>
          <button
            type="button"
            onClick={onBookNow}
            className="inline-flex items-center gap-2.5 rounded-full bg-blue-600 hover:bg-blue-700 active:scale-95 px-8 py-4 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-all cursor-pointer"
          >
            <span>Tiến hành đặt kho ngay</span>
            <span>→</span>
          </button>
        </div>

      </div>
    </section>
  )
}
