import { useLanguage } from '../../context/LanguageContext'
import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const IOT_REAL_FEATURES = [
  {
    id: 0,
    num: '01',
    category: 'KHÓA SỐ THÔNG MINH 24/7',
    title: 'Mã PIN Cá Nhân & Mở Kho Qua Web Portal',
    desc: 'Cấp mã PIN cá nhân hóa bảo mật ngay sau khi hoàn tất thủ tục thuê. Khách hàng tự do ra vào kho 24/7/365 chỉ với mã số trên bàn phím khóa thông minh hoặc mở từ xa trên Cổng khách hàng mà không cần chìa khóa cơ.',
    spec: 'Mã hóa AES-256 • Mở kho tự chủ 24/7',
    image: '/assets/units/unit-front-standard.jpg',
    imageTag: 'Khóa số thông minh tích hợp trực tiếp trên cửa buồng kho'
  },
  {
    id: 1,
    num: '02',
    category: 'CHỐT KHÓA TỰ ĐỘNG',
    title: 'Tự Động Chốt Khóa An Toàn Sau Khi Đóng',
    desc: 'Cảm biến từ tính phát hiện trạng thái cánh cửa và tự động kích hoạt chốt khóa thép sau 3 giây. Hệ thống phát cảnh báo âm thanh và gửi thông báo nếu phát hiện cửa buồng kho khép chưa kín.',
    spec: 'Chốt thép tự hành • Chống quên khóa cửa',
    image: '/assets/units/unit-standard-door.jpg',
    imageTag: 'Cửa thép chuyên dụng và chốt khóa tự động bảo vệ tài sản'
  },
  {
    id: 2,
    num: '03',
    category: 'ỦY QUYỀN TRUY CẬP LINH HOẠT',
    title: 'Cấp Mã Phụ Dùng Một Lần (OTP)',
    desc: 'Dễ dàng tạo mã PIN tạm thời hoặc mã mở 1 lần gửi cho người thân hoặc cộng sự khi cần ủy quyền mở buồng kho, và chủ động thu hồi quyền truy cập bất kỳ lúc nào trên hệ thống.',
    spec: 'Phân quyền theo giờ • Thu hồi tức thì',
    image: '/assets/units/facility-hallway.jpg',
    imageTag: 'Hành lang buồng kho giám sát Camera AI và kiểm soát truy cập 24/7'
  },
  {
    id: 3,
    num: '04',
    category: 'VI KHÍ HẬU & NHẬT KÝ TRUY CẬP',
    title: 'Cảm Biến Môi Trường & Lịch Sử Đóng Mở Kho',
    desc: 'Duy trì nhiệt độ 18°C – 22°C và độ ẩm dưới 55% RH tại khu vực kho máy lạnh A/C chống ẩm mốc đồ đạc. Toàn bộ mốc thời gian mở và khóa cửa đều được ghi nhận minh bạch theo thời gian thực.',
    spec: 'Nhiệt độ 18–22°C • Độ ẩm < 55% RH',
    image: '/assets/units/unit-cold.jpg',
    imageTag: 'Hệ thống kiểm soát nhiệt độ và độ ẩm tiêu chuẩn tại khu vực kho A/C'
  }
]

export const CinematicIotVaultSection: React.FC = () => {
  const { t } = useLanguage();

  const sectionRef = useRef<HTMLElement | null>(null)
  const photoCard3dRef = useRef<HTMLDivElement | null>(null)
  const [activeLayer, setActiveLayer] = useState<number>(0)

  useEffect(() => {
    const section = sectionRef.current
    const photoCard = photoCard3dRef.current
    if (!section || !photoCard) return

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) return

    const ctx = gsap.context(() => {
      // Scroll-scrubbed 3D perspective tilt on the real hardware photography showcase
      gsap.fromTo(
        photoCard,
        { rotateX: 16, rotateY: 14, rotateZ: -1.5, scale: 0.92 },
        {
          rotateX: -4,
          rotateY: -8,
          rotateZ: 1,
          scale: 1.02,
          ease: 'none',
          scrollTrigger: {
            trigger: section,
            start: 'top 72%',
            end: 'bottom 28%',
            scrub: 0.75,
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              const idx = Math.min(3, Math.max(0, Math.floor(self.progress * 4)))
              setActiveLayer((prev) => (prev !== idx ? idx : prev))
            }
          }
        }
      )
    }, section)

    return () => ctx.revert()
  }, [])

  const currentFeature = IOT_REAL_FEATURES[activeLayer] || IOT_REAL_FEATURES[0]

  return (
    <section
      id="iot-access"
      ref={sectionRef}
      className="relative isolate overflow-hidden bg-[linear-gradient(180deg,#ffffff_0%,#f2f8ff_52%,#f7faff_100%)] dark:bg-[linear-gradient(180deg,#0a0f1d_0%,#0d172a_50%,#090d16_100%)] py-24 lg:py-36 border-b border-slate-200/70"
    >
      {/* Soft Daylight Ambient Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-0 top-1/3 h-[520px] w-[780px] rounded-full bg-[radial-gradient(ellipse,rgba(0,191,216,0.12)_0%,rgba(8,102,245,0.08)_45%,transparent_72%)] blur-3xl"
      />

      <div className="relative z-10 mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10 space-y-20">
        
        {/* Top Editorial Heading */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end text-left">
          <div className="lg:col-span-7 space-y-4">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">
              02 / CÔNG NGHỆ KHÓA SỐ IOT &amp; BẢO MẬT ĐA TẦNG
            </div>
            <h2 className="font-headline text-3xl sm:text-5xl lg:text-[52px] font-semibold text-slate-950 tracking-[-0.04em] leading-[1.05]">
              Bốn lớp bảo vệ tự hành.
              <span className="block text-slate-400">An toàn tuyệt đối cho buồng kho.</span>
            </h2>
          </div>
          <div className="lg:col-span-5">
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              Mỗi buồng kho Boxora tích hợp khóa điện tử kết nối mạng độc lập và hệ thống cảm biến môi trường 24/7, loại bỏ hoàn toàn rủi ro thất lạc chìa khóa cơ truyền thống.
            </p>
          </div>
        </div>

        {/* Main Real Photography 3D Stage + 4 Architectural Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left 5 Cols: Real Warehouse & Smart Lock Photography in 3D Perspective Stage */}
          <div className="lg:col-span-5" style={{ perspective: '1600px' }}>
            <div
              ref={photoCard3dRef}
              className="relative will-change-transform"
              style={{ transformStyle: 'preserve-3d' }}
            >
              {/* Back Floating Depth Frame */}
              <div
                aria-hidden="true"
                className="absolute -inset-3 rounded-[36px] bg-gradient-to-br from-blue-500/15 via-cyan-400/15 to-teal-300/15 border border-blue-200/70"
                style={{ transform: 'translateZ(-35px)' }}
              />

              {/* Real Image Container */}
              <div className="relative aspect-[4/3] w-full rounded-[32px] overflow-hidden bg-slate-100 border-2 border-white shadow-[0_30px_80px_rgba(15,23,42,0.14)]">
                <AnimatePresence mode="wait">
                  <motion.img
                    key={currentFeature.image}
                    src={currentFeature.image}
                    alt={currentFeature.title}
                    initial={{ opacity: 0, scale: 1.05 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.35 }}
                    className="h-full w-full object-cover"
                  />
                </AnimatePresence>
              </div>

              {/* Floating 3D Glass Telemetry Plaque */}
              <div
                className="mt-4 rounded-2xl bg-white/92 backdrop-blur-xl border border-blue-100 p-5 shadow-[0_20px_50px_rgba(8,102,245,0.12)] text-left space-y-2"
                style={{ transform: 'translateZ(40px)' }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-blue-600">
                    {currentFeature.category}
                  </span>
                  <span className="font-mono text-xs font-bold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
                    {currentFeature.spec}
                  </span>
                </div>
                <p className="text-xs sm:text-sm font-semibold text-slate-900">
                  {currentFeature.imageTag}
                </p>
              </div>
            </div>
          </div>

          {/* Right 7 Cols: Clean Swiss Editorial Ledger */}
          <div className="lg:col-span-7 divide-y divide-slate-200/80 border-y border-slate-200/80 text-left">
            {IOT_REAL_FEATURES.map((item, idx) => {
              const isFocused = activeLayer === idx
              return (
                <div
                  key={item.num}
                  onMouseEnter={() => setActiveLayer(idx)}
                  onClick={() => setActiveLayer(idx)}
                  className={`py-7 px-5 sm:px-7 transition-all duration-300 cursor-pointer flex flex-col sm:flex-row sm:items-start gap-5 ${
                    isFocused ? 'bg-white dark:bg-slate-900 shadow-[0_12px_40px_rgba(8,102,245,0.06)] rounded-2xl' : 'hover:bg-white/60 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="font-headline text-3xl sm:text-4xl font-semibold tracking-tight text-blue-600 shrink-0 sm:w-16">
                    {item.num}
                  </div>

                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-700">
                        {item.category}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">
                        {item.spec}
                      </span>
                    </div>

                    <h3 className="font-headline text-xl sm:text-2xl font-bold text-slate-950 tracking-tight">
                      {item.title}
                    </h3>

                    <p className="text-sm text-slate-600 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>

        </div>

      </div>
    </section>
  )
}
