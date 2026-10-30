import { useLanguage } from '../../context/LanguageContext'
import React, { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import facilityD1 from '../../assets/facilities/facility-d1.jpg'
import facilityD7 from '../../assets/facilities/facility-d7.jpg'
import facilityThuduc from '../../assets/facilities/facility-thuduc.jpg'
import facilityTanbinh from '../../assets/facilities/facility-tanbinh.jpg'

gsap.registerPlugin(ScrollTrigger)

interface CinematicServicesSectionProps {
  onBookNow: () => void
}

export const STORAGE_UNIT_TYPES = [
  {
    index: '01',
    subtitle: 'CHẾ ĐỘ TIÊU CHUẨN • NON-A/C',
    title: 'Buồng Kho Tiêu Chuẩn (Non-A/C)',
    desc: 'Không gian buồng kho độc lập, khô ráo, thông khí tự nhiên và bảo mật bằng khóa số IoT 24/7. Đầy đủ 16 mức kích thước từ 1 m³ đến 24 m³ để khách hàng chủ động chọn đúng diện tích cần thuê.',
    image: '/assets/units/unit-front-standard.jpg',
    specs: [
      'Đủ 16 kích cỡ từ 1 m³ đến 24 m³ (1.0 – 9.0 m²)',
      'Không gian riêng tư, tự khóa & mở bằng mã PIN 24/7',
      'Thuê ngắn hạn (≥ 7 ngày) hoặc theo tháng (giảm 5% – 20%)'
    ],
    priceTag: 'Chỉ từ 350.000 ₫/tháng'
  },
  {
    index: '02',
    subtitle: 'CHẾ ĐỘ KIỂM SOÁT NHIỆT ẨM • A/C 24/7',
    title: 'Buồng Kho Máy Lạnh (A/C)',
    desc: 'Buồng kho tích hợp hệ thống điều hòa duy trì nhiệt độ ổn định 18°C – 22°C và độ ẩm dưới 55% RH suốt ngày đêm. Lựa chọn lý tưởng khi bạn cần thuê kho bảo quản đồ điện tử, đồ da, tài liệu hoặc vật dụng nhạy cảm với nhiệt ẩm.',
    image: '/assets/units/unit-cold.jpg',
    specs: [
      'Duy trì nhiệt độ 18°C – 22°C & Độ ẩm < 55% RH 24/7',
      'Áp dụng cho toàn bộ 16 kích thước từ 1 m³ đến 24 m³',
      'Cảm biến môi trường IoT giám sát tự động liên tục'
    ],
    priceTag: 'Kho lạnh A/C từ 420.000 ₫/tháng'
  },
  {
    index: '03',
    subtitle: 'LINH HOẠT THỂ TÍCH • 16 QUY CHUẨN',
    title: 'Tự Do Chọn Cỡ Kho (1 m³ – 24 m³)',
    desc: 'Chỉ trả phí cho đúng không gian bạn thực sự sử dụng. Từ buồng kho mini 1 m³ – 4 m³ đến các buồng kho lớn 10 m³ – 24 m³, bạn có thể dễ dàng chọn kích cỡ trên mô hình 3D và nâng/hạ cỡ kho bất kỳ lúc nào.',
    image: '/assets/units/unit-front-large.jpg',
    specs: [
      'Nhóm Nhỏ & Mini: 1m³, 2m³, 3m³, 4m³ (1.0 – 1.6 m²)',
      'Nhóm Tiêu Chuẩn: 5m³, 6m³, 7m³, 8m³, 9m³ (1.9 – 3.4 m²)',
      'Nhóm Lớn: 10m³, 12m³, 14m³, 15m³, 16m³, 18m³, 20m³, 24m³'
    ],
    priceTag: 'Miễn phí chuyển đổi cỡ kho'
  }
]

export const FACILITIES_LIST = [
  {
    code: '01 / QUẬN 1',
    name: 'Boxora Quận 1 — Central Hub',
    address: '123 Nguyễn Huệ, P. Bến Nghé, Quận 1, TP.HCM',
    image: facilityD1
  },
  {
    code: '02 / QUẬN 7',
    name: 'Boxora Quận 7 — Nam Sài Gòn',
    address: '456 Nguyễn Hữu Thọ, P. Tân Hưng, Quận 7, TP.HCM',
    image: facilityD7
  },
  {
    code: '03 / THỦ ĐỨC',
    name: 'Boxora TP. Thủ Đức Hub',
    address: '789 Võ Văn Ngân, P. Linh Chiểu, TP. Thủ Đức, TP.HCM',
    image: facilityThuduc
  },
  {
    code: '04 / TÂN BÌNH',
    name: 'Boxora Tân Bình Mega Hub',
    address: '102 Trường Sơn, Phường 2, Quận Tân Bình, TP.HCM',
    image: facilityTanbinh
  }
]

export const CinematicServicesSection: React.FC<CinematicServicesSectionProps> = ({ onBookNow }) => {
  const { t } = useLanguage();

  const sectionRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) return

    const ctx = gsap.context(() => {
      // 3D Perspective Tilt & Depth Parallax on Scroll for each Storage Unit Type
      const planes = gsap.utils.toArray<HTMLElement>('[data-service-3d-plane]')
      planes.forEach((plane, index) => {
        const direction = index % 2 === 0 ? 1 : -1
        const floatingPlaque = plane.querySelector('[data-floating-plaque]')

        gsap.fromTo(
          plane,
          {
            rotateX: 18,
            rotateY: -14 * direction,
            z: -140,
            scale: 0.9
          },
          {
            rotateX: -4,
            rotateY: 4 * direction,
            z: 0,
            scale: 1,
            ease: 'none',
            scrollTrigger: {
              trigger: plane,
              start: 'top 90%',
              end: 'bottom 20%',
              scrub: 0.7,
              invalidateOnRefresh: true
            }
          }
        )

        if (floatingPlaque) {
          gsap.fromTo(
            floatingPlaque,
            { y: 36, z: 20 },
            {
              y: -24,
              z: 65,
              ease: 'none',
              scrollTrigger: {
                trigger: plane,
                start: 'top 85%',
                end: 'bottom 20%',
                scrub: 0.7,
                invalidateOnRefresh: true
              }
            }
          )
        }
      })

      // 3D perspective glide for the 4 facilities
      const hubs = gsap.utils.toArray<HTMLElement>('[data-hub-3d]')
      hubs.forEach((hub, i) => {
        gsap.fromTo(
          hub,
          { rotateY: (i - 1.5) * 14, rotateX: 14, y: 45, opacity: 0.2 },
          {
            rotateY: 0,
            rotateX: 0,
            y: 0,
            opacity: 1,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: hub,
              start: 'top 92%',
              end: 'top 55%',
              scrub: 0.6,
              invalidateOnRefresh: true
            }
          }
        )
      })
    }, section)

    return () => ctx.revert()
  }, [])

  return (
    <section
      id="services"
      ref={sectionRef}
      className="relative isolate overflow-hidden bg-white dark:bg-slate-950 py-24 lg:py-36 border-b border-slate-200/70 dark:border-slate-800"
    >
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10 space-y-28">
        
        {/* Editorial Heading — Focused strictly on Self-Storage Unit Rental & Choosing Sizes */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end text-left">
          <div className="lg:col-span-7 space-y-4">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">
              03 / LOẠI BUỒNG KHO &amp; CHẾ ĐỘ BẢO QUẢN
            </div>
            <h2 className="font-headline text-3xl sm:text-5xl lg:text-[52px] font-semibold text-slate-950 tracking-[-0.04em] leading-[1.05]">
              Thuê kho tự quản theo kích cỡ.
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500">
                Chủ động chọn diện tích &amp; chế độ kho.
              </span>
            </h2>
          </div>
          <div className="lg:col-span-5">
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              Boxora chuyên cung cấp dịch vụ cho thuê buồng kho tự quản theo kích thước chuẩn (1 m³ – 24 m³). Bạn toàn quyền lựa chọn cỡ kho, chế độ bảo quản (Tiêu chuẩn hoặc Máy lạnh A/C) và tự quản lý khóa số IoT 24/7.
            </p>
          </div>
        </div>

        {/* Alternating Asymmetric 3D Perspective Showcases */}
        <div className="space-y-20 lg:space-y-28">
          {STORAGE_UNIT_TYPES.map((unitType, idx) => {
            const isReversed = idx % 2 === 1
            return (
              <div
                key={unitType.index}
                className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center text-left"
                style={{ perspective: '1600px' }}
              >
                {/* 3D Tilting Image Plane with Floating Glass Plaque */}
                <div
                  data-service-3d-plane
                  className={`lg:col-span-7 relative will-change-transform ${
                    isReversed ? 'lg:order-2' : 'lg:order-1'
                  }`}
                  style={{ transformStyle: 'preserve-3d' }}
                >
                  <div className="relative aspect-[16/10] w-full rounded-[32px] overflow-hidden border border-slate-200/90 bg-slate-100 shadow-[0_28px_70px_rgba(15,23,42,0.10)]">
                    <img
                      src={unitType.image}
                      alt={unitType.title}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </div>

                  {/* Floating 3D Translucent Glass Plaque (Hovering in Z-space) */}
                  <div
                    data-floating-plaque
                    className={`hidden sm:flex items-center justify-between gap-6 absolute -bottom-6 ${
                      isReversed ? 'left-6' : 'right-6'
                    } rounded-2xl bg-white/90 backdrop-blur-xl border border-blue-100 px-6 py-4 shadow-[0_20px_50px_rgba(8,102,245,0.15)]`}
                    style={{ transform: 'translateZ(55px)' }}
                  >
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-blue-600">
                        {unitType.subtitle}
                      </div>
                      <div className="text-sm font-bold text-slate-950 mt-0.5">{unitType.priceTag}</div>
                    </div>
                    <span className="font-headline text-2xl font-bold text-blue-600/30">
                      {unitType.index}
                    </span>
                  </div>
                </div>

                {/* Editorial Typography Column */}
                <div
                  className={`lg:col-span-5 space-y-6 ${
                    isReversed ? 'lg:order-1 lg:pr-6' : 'lg:order-2 lg:pl-6'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-headline text-4xl font-semibold text-blue-600 tracking-tight">
                      {unitType.index}
                    </span>
                    <span className="h-px w-10 bg-slate-300" />
                    <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                      {unitType.subtitle}
                    </span>
                  </div>

                  <h3 className="font-headline text-2xl sm:text-4xl font-semibold text-slate-950 tracking-[-0.03em]">
                    {unitType.title}
                  </h3>

                  <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                    {unitType.desc}
                  </p>

                  {/* Clean Architectural Hairline Specs */}
                  <div className="divide-y divide-slate-200/80 border-y border-slate-200/80">
                    {unitType.specs.map((spec, sIdx) => (
                      <div key={sIdx} className="py-3 flex items-center justify-between text-xs sm:text-sm font-medium text-slate-800">
                        <span>{spec}</span>
                        <span className="font-mono text-[11px] text-blue-600 font-semibold">0{sIdx + 1}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
                      {unitType.priceTag}
                    </span>
                    <button
                      type="button"
                      onClick={onBookNow}
                      className="inline-flex items-center gap-2 text-sm font-semibold text-slate-950 hover:text-blue-600 transition-colors cursor-pointer"
                    >
                      <span>Chọn kích cỡ &amp; Đặt thuê</span>
                      <span>→</span>
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* 4 Strategic Hubs in 3D Perspective Row */}
        <div className="space-y-10 pt-8 border-t border-slate-200/80">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 text-left">
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
                {t('HỆ THỐNG 4 CƠ SỞ CHO THUÊ KHO TẠI TP. HỒ CHÍ MINH')}
              </div>
              <h3 className="font-headline text-2xl sm:text-4xl font-semibold text-slate-950 tracking-[-0.03em]">
                Chọn cơ sở gần bạn, kiểm tra buồng kho trống tức thì.
              </h3>
            </div>
            <button
              type="button"
              onClick={onBookNow}
              className="self-start sm:self-auto inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white hover:border-blue-600 hover:text-blue-600 px-6 py-3 text-xs font-semibold text-slate-900 transition-all cursor-pointer"
            >
              <span>Kiểm tra phòng trống tại 4 cơ sở</span>
              <span>→</span>
            </button>
          </div>

          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-left"
            style={{ perspective: '1400px' }}
          >
            {FACILITIES_LIST.map((hub) => (
              <div
                key={hub.code}
                data-hub-3d
                onClick={onBookNow}
                className="group rounded-[26px] bg-white border border-slate-200/90 hover:border-blue-500 overflow-hidden shadow-[0_12px_36px_rgba(15,23,42,0.05)] hover:shadow-[0_24px_50px_rgba(8,102,245,0.12)] transition-all duration-300 cursor-pointer will-change-transform"
              >
                <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100">
                  <img
                    src={hub.image}
                    alt={t(hub.name)}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="p-5 space-y-1.5">
                  <div className="font-mono text-[10px] font-bold uppercase tracking-widest text-blue-600">
                    {hub.code}
                  </div>
                  <h4 className="font-headline text-base font-bold text-slate-950 group-hover:text-blue-600 transition-colors">
                    {hub.name}
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed">{hub.address}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  )
}
