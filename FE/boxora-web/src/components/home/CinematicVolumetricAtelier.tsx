import { useLanguage } from '../../context/LanguageContext'
import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SizeTierKey } from '../booking/LandingBookingWizardModal'
import { StorageSizeIsometric3D } from '../booking/StorageSizeIsometric3D'

gsap.registerPlugin(ScrollTrigger)

export interface SizeTierSpec {
  name: string
  area: string
  volume: string
  dims: string
  desc: string
  fits: string[]
  rate: string
  rateAC: string
  door: string
  bestFor: string
  defaultVolM3: number
  defaultDims: string
  volumesList: string[]
  scaleFactor: number
}

const SIZE_TIER_ATELIER_DATA: Record<SizeTierKey, SizeTierSpec> = {
  LOCKER: {
    name: 'Cá Nhân & Mini (1 – 4 m³)',
    area: '1.0 – 1.6 m²',
    volume: '1.0 – 4.0 m³',
    dims: 'Các cỡ 1m³, 2m³, 3m³, 4m³ • Cao 2.7m',
    desc: 'Giải pháp nhỏ gọn, tối ưu chi phí lưu giữ tư trang cá nhân, vali du lịch lớn, tài liệu công việc và đồ thể thao.',
    fits: [
      '4–6 Vali du lịch cỡ lớn',
      '8–18 Thùng carton tiêu chuẩn',
      'Đồ thể thao, máy ảnh, laptop, thiết bị cá nhân',
      'Giấy tờ hồ sơ đóng hộp lưu trữ'
    ],
    rate: 'Từ 350.000 ₫ / tháng',
    rateAC: 'Kho lạnh A/C từ 420.000 ₫ / tháng',
    door: 'Cửa thép đơn khóa IoT mã PIN',
    bestFor: 'Sinh viên, cá nhân, người đi công tác, chuyên gia',
    defaultVolM3: 2,
    defaultDims: '1.2m × 1.0m × Cao 1.8m',
    volumesList: ['1 m³', '2 m³', '3 m³', '4 m³'],
    scaleFactor: 0.96
  },
  STANDARD: {
    name: 'Buồng Kho Tiêu Chuẩn (5 – 9 m³)',
    area: '1.9 – 3.4 m²',
    volume: '5.0 – 9.0 m³',
    dims: 'Các cỡ 5m³, 6m³, 7m³, 8m³, 9m³ • Cao 2.7m',
    desc: 'Không gian đa dụng nhất: Chứa được xe đạp/xe máy, nội thất gia đình tháo lắp, tủ kệ mini và hàng chục thùng đồ gia dụng.',
    fits: [
      '1–2 Xe đạp thể thao hoặc xe máy',
      'Bàn làm việc, ghế công thái học, đệm ngủ',
      'Tủ quần áo mini, kệ sách, tủ lạnh vừa',
      '25–40 Thùng carton đồ đạc gia đình'
    ],
    rate: 'Từ 1.250.000 ₫ / tháng',
    rateAC: 'Kho lạnh A/C từ 1.500.000 ₫ / tháng',
    door: 'Cửa bản lề rộng 1.0m – 1.2m, mở 180°',
    bestFor: 'Gia đình sửa nhà, chuyển trọ, shop bán hàng online',
    defaultVolM3: 6,
    defaultDims: '1.8m × 1.5m × Cao 2.2m',
    volumesList: ['5 m³', '6 m³', '7 m³', '8 m³', '9 m³'],
    scaleFactor: 1.0
  },
  LARGE: {
    name: 'Buồng Kho Lớn Đa Năng (10 – 16 m³)',
    area: '3.8 – 6.0 m²',
    volume: '10.0 – 16.0 m³',
    dims: 'Các cỡ 10m³, 12m³, 14m³, 15m³, 16m³ • Cao 2.7m',
    desc: 'Dung tích rộng rãi cho đồ đạc nguyên căn hộ 2–3 phòng ngủ, nội thất cồng kềnh, thiết bị tổ chức sự kiện hoặc máy móc văn phòng.',
    fits: [
      'Sofa chữ L, giường đệm Queen/King',
      'Tủ lạnh Side-by-Side, máy giặt, máy sấy',
      'Bộ bàn ăn 6 ghế, tủ kệ lớn tháo rời',
      '50–80 Thùng hàng hóa tiêu chuẩn'
    ],
    rate: 'Từ 2.300.000 ₫ / tháng',
    rateAC: 'Kho lạnh A/C từ 2.760.000 ₫ / tháng',
    door: 'Cửa thép đôi rộng 1.6m tiện bốc xếp',
    bestFor: 'Cải tạo toàn bộ nhà ở, đi định cư nước ngoài, studio ảnh',
    defaultVolM3: 12,
    defaultDims: '2.5m × 2.0m × Cao 2.5m',
    volumesList: ['10 m³', '12 m³', '14 m³', '15 m³', '16 m³'],
    scaleFactor: 1.04
  },
  ENTERPRISE: {
    name: 'Kho Doanh Nghiệp & Sỉ (18 – 24 m³)',
    area: '6.8 – 9.0 m²',
    volume: '18.0 – 24.0 m³',
    dims: 'Các cỡ 18m³, 20m³, 24m³ • Cao 2.7m – 3.0m',
    desc: 'Thiết kế cửa cuốn / cửa công nghiệp chịu tải trọng lớn, xe tải 2.5T đỗ bốc dỡ hàng trực tiếp tại sảnh có mái che.',
    fits: [
      '6–10 Pallet hàng tiêu chuẩn',
      'Hồ sơ chứng từ kế toán lưu trữ 10 năm',
      '100–140 Thùng hàng tồn kho E-commerce',
      'Thiết bị triển lãm, hội chợ, sự kiện'
    ],
    rate: 'Từ 3.900.000 ₫ / tháng',
    rateAC: 'Kho lạnh A/C từ 4.680.000 ₫ / tháng',
    door: 'Cửa cuốn / Cửa đôi công nghiệp 2.0m – 2.4m',
    bestFor: 'Doanh nghiệp thương mại, công ty phân phối, đại lý bán sỉ',
    defaultVolM3: 20,
    defaultDims: '4.5m × 1.8m × Cao 2.5m',
    volumesList: ['18 m³', '20 m³', '24 m³'],
    scaleFactor: 1.06
  }
}

const ALL_16_VOLUMES = [
  { vol: '1 m³', volM3: 1, dims: '1.0m × 1.0m × Cao 1.0m', tier: 'LOCKER' as SizeTierKey },
  { vol: '2 m³', volM3: 2, dims: '1.2m × 1.0m × Cao 1.8m', tier: 'LOCKER' as SizeTierKey },
  { vol: '3 m³', volM3: 3, dims: '1.5m × 1.0m × Cao 2.0m', tier: 'LOCKER' as SizeTierKey },
  { vol: '4 m³', volM3: 4, dims: '1.5m × 1.2m × Cao 2.2m', tier: 'LOCKER' as SizeTierKey },
  { vol: '5 m³', volM3: 5, dims: '1.6m × 1.4m × Cao 2.2m', tier: 'STANDARD' as SizeTierKey },
  { vol: '6 m³', volM3: 6, dims: '1.8m × 1.5m × Cao 2.2m', tier: 'STANDARD' as SizeTierKey },
  { vol: '7 m³', volM3: 7, dims: '2.0m × 1.5m × Cao 2.4m', tier: 'STANDARD' as SizeTierKey },
  { vol: '8 m³', volM3: 8, dims: '2.2m × 1.5m × Cao 2.5m', tier: 'STANDARD' as SizeTierKey },
  { vol: '9 m³', volM3: 9, dims: '2.4m × 1.5m × Cao 2.5m', tier: 'STANDARD' as SizeTierKey },
  { vol: '10 m³', volM3: 10, dims: '2.2m × 1.8m × Cao 2.5m', tier: 'LARGE' as SizeTierKey },
  { vol: '12 m³', volM3: 12, dims: '2.5m × 2.0m × Cao 2.5m', tier: 'LARGE' as SizeTierKey },
  { vol: '14 m³', volM3: 14, dims: '2.8m × 2.0m × Cao 2.5m', tier: 'LARGE' as SizeTierKey },
  { vol: '15 m³', volM3: 15, dims: '3.0m × 2.0m × Cao 2.5m', tier: 'LARGE' as SizeTierKey },
  { vol: '16 m³', volM3: 16, dims: '3.2m × 2.0m × Cao 2.5m', tier: 'LARGE' as SizeTierKey },
  { vol: '18 m³', volM3: 18, dims: '4.0m × 1.8m × Cao 2.5m', tier: 'ENTERPRISE' as SizeTierKey },
  { vol: '20 m³', volM3: 20, dims: '4.5m × 1.8m × Cao 2.5m', tier: 'ENTERPRISE' as SizeTierKey },
  { vol: '24 m³', volM3: 24, dims: '6.0m × 1.5m × Cao 2.7m', tier: 'ENTERPRISE' as SizeTierKey }
]

interface CinematicVolumetricAtelierProps {
  selectedSizeTier: SizeTierKey
  setSelectedSizeTier: React.Dispatch<React.SetStateAction<SizeTierKey>>
  onBookTier: (tier: SizeTierKey) => void
}

export const CinematicVolumetricAtelier: React.FC<CinematicVolumetricAtelierProps> = ({ selectedSizeTier,
  setSelectedSizeTier,
  onBookTier }) => {
  const { t } = useLanguage();
  const sectionRef = useRef<HTMLElement | null>(null)
  const stage3dRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const section = sectionRef.current
    const stage3d = stage3dRef.current
    if (!section || !stage3d) return
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) return

    const ctx = gsap.context(() => {
      // Scroll-scrubbed 3D perspective tilt of the entire volumetric atelier stage
      gsap.fromTo(
        stage3d,
        { rotateX: 16, rotateY: -12, z: -80 },
        {
          rotateX: -4,
          rotateY: 8,
          z: 0,
          ease: 'none',
          scrollTrigger: {
            trigger: section,
            start: 'top 78%',
            end: 'bottom 22%',
            scrub: 0.7,
            invalidateOnRefresh: true
          }
        }
      )
    }, section)

    return () => ctx.revert()
  }, [])

  const currentTier = SIZE_TIER_ATELIER_DATA[selectedSizeTier]
  const [activeVolM3, setActiveVolM3] = useState<number>(currentTier.defaultVolM3)

  useEffect(() => {
    setActiveVolM3(SIZE_TIER_ATELIER_DATA[selectedSizeTier].defaultVolM3)
  }, [selectedSizeTier])

  const activeVolumeSpec =
    ALL_16_VOLUMES.find((v) => v.volM3 === activeVolM3) ||
    ALL_16_VOLUMES.find((v) => v.tier === selectedSizeTier) ||
    ALL_16_VOLUMES[1]

  return (
    <section
      id="size-guide"
      ref={sectionRef}
      className="relative isolate overflow-hidden bg-[linear-gradient(180deg,#f7faff_0%,#f1fff8_55%,#ffffff_100%)] dark:bg-[linear-gradient(180deg,#090d16_0%,#0c1527_55%,#090d16_100%)] py-24 lg:py-36 border-b border-slate-200/70"
    >
      {/* Subtle Architectural Floor Grid */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-45 [background-image:linear-gradient(to_right,rgba(8,102,245,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(8,102,245,0.06)_1px,transparent_1px)] [background-size:48px_48px]"
      />

      <div className="relative z-10 mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10 space-y-14">
        
        {/* Top Editorial Header */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end text-left">
          <div className="lg:col-span-7 space-y-4">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">
              04 / BỘ ƯỚC TÍNH THỂ TÍCH 3D (1 M³ – 24 M³)
            </div>
            <h2 className="font-headline text-3xl sm:text-5xl lg:text-[52px] font-semibold text-slate-950 tracking-[-0.04em] leading-[1.05]">
              Mười sáu quy chuẩn thể tích.
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-cyan-600 to-emerald-500">
                Trực quan hóa trong không gian 3D.
              </span>
            </h2>
          </div>
          <div className="lg:col-span-5">
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              Chiều cao trần tiêu chuẩn từ 2.7m – 3.0m giúp tối ưu thể tích lưu trữ theo chiều dọc. Chọn nhóm kích cỡ bên dưới để xoay và phóng chiếu sức chứa thực tế.
            </p>
          </div>
        </div>

        {/* Interactive 4-Tier Selector (Clean Daylight Pills — No Black Backgrounds) */}
        <div className="flex flex-wrap items-center gap-3">
          {(['LOCKER', 'STANDARD', 'LARGE', 'ENTERPRISE'] as const).map((tierKey) => {
            const tier = SIZE_TIER_ATELIER_DATA[tierKey]
            const isSelected = selectedSizeTier === tierKey
            return (
              <button
                key={tierKey}
                type="button"
                onClick={() => setSelectedSizeTier(tierKey)}
                className={`py-3.5 px-5 rounded-full text-xs sm:text-sm font-semibold transition-all flex items-center gap-3 cursor-pointer border ${
                  isSelected
                    ? 'bg-blue-600 text-white border-blue-600 shadow-[0_12px_30px_rgba(8,102,245,0.28)] -translate-y-0.5'
                    : 'bg-white/90 hover:bg-white text-slate-700 border-slate-200/90 hover:border-blue-300'
                }`}
              >
                <span>{tier.name}</span>
                <span
                  className={`font-mono text-[11px] px-2.5 py-0.5 rounded-full font-bold ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-700'
                  }`}
                >
                  {tier.area}
                </span>
              </button>
            )
          })}
        </div>

        {/* 16 Volume Scale Quick Scrubber Bar */}
        <div className="rounded-3xl bg-white/85 backdrop-blur-xl border border-blue-100 p-4 sm:p-5 shadow-[0_14px_40px_rgba(8,102,245,0.06)]">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-500 mb-3 px-1">
            <span>Thang đo 16 quy chuẩn thể tích thực tế (1 m³ → 24 m³)</span>
            <span className="text-blue-600 font-bold">Nhóm đang chọn: {currentTier.volume}</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {ALL_16_VOLUMES.map((item) => {
              const isSelectedVol = item.volM3 === activeVolM3
              const activeGroup = item.tier === selectedSizeTier
              return (
                <button
                  key={item.vol}
                  type="button"
                  onClick={() => {
                    setSelectedSizeTier(item.tier)
                    setActiveVolM3(item.volM3)
                  }}
                  className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all cursor-pointer ${
                    isSelectedVol
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20 ring-2 ring-blue-300'
                      : activeGroup
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-slate-100/80 hover:bg-blue-50 text-slate-600 hover:text-blue-700'
                  }`}
                >
                  {item.vol}
                </button>
              )
            })}
          </div>
        </div>

        {/* Main 3D Perspective Stage */}
        <div style={{ perspective: '1600px' }}>
          <div ref={stage3dRef} className="will-change-transform" style={{ transformStyle: 'preserve-3d' }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedSizeTier}
                initial={{ opacity: 0, rotateY: -8, scale: 0.96 }}
                animate={{ opacity: 1, rotateY: 0, scale: 1 }}
                exit={{ opacity: 0, rotateY: 8, scale: 0.96 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="rounded-[36px] bg-white/95 backdrop-blur-xl border border-blue-100/90 shadow-[0_32px_80px_rgba(8,102,245,0.10)] p-6 sm:p-10 lg:p-14 text-left"
              >
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
                  
                  {/* Left 6 Cols: 3D Volumetric Room Cage + Levitating Isometric Model */}
                  <div className="lg:col-span-6 space-y-6">
                    <div
                      className="relative rounded-[28px] bg-[linear-gradient(145deg,#f0f7ff_0%,#ffffff_55%,#ecfdf5_100%)] dark:bg-[linear-gradient(145deg,#0d172a_0%,#090d16_55%,#0b1a20_100%)] border border-blue-200/70 p-8 sm:p-10 flex flex-col items-center justify-center overflow-hidden min-h-[320px]"
                      style={{ transformStyle: 'preserve-3d' }}
                    >
                      {/* 3D Perspective Floor Grid Plane */}
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-x-6 bottom-4 h-36 rounded-2xl border border-blue-300/50 bg-[linear-gradient(to_right,rgba(8,102,245,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(8,102,245,0.12)_1px,transparent_1px)] bg-[size:20px_20px]"
                        style={{
                          transform: 'perspective(700px) rotateX(62deg)'
                        }}
                      />

                      <div className="relative z-10 w-full flex items-center justify-between text-xs font-mono font-bold text-blue-700 mb-3">
                        <span>MÔ HÌNH KHÔNG GIAN 3D • KHO {activeVolumeSpec.vol}</span>
                        <span>TRẦN CAO 2.7M – 3.0M</span>
                      </div>

                      <div
                        style={{ transform: `scale(${currentTier.scaleFactor})` }}
                        className="relative z-10 h-52 sm:h-60 w-full max-w-md flex items-center justify-center transition-transform duration-500"
                      >
                        <StorageSizeIsometric3D
                          sizeId={`${activeVolumeSpec.volM3}m3`}
                          volumeM3={activeVolumeSpec.volM3}
                          dimensions={activeVolumeSpec.dims}
                          isAc={true}
                          showDimensions={true}
                        />
                      </div>

                      <div className="relative z-10 mt-5 flex flex-wrap items-center justify-center gap-2">
                        {ALL_16_VOLUMES.filter((v) => v.tier === selectedSizeTier).map((v) => (
                          <button
                            key={v.vol}
                            type="button"
                            onClick={() => setActiveVolM3(v.volM3)}
                            className={`px-3.5 py-1 rounded-full border text-xs font-mono font-bold transition-all cursor-pointer ${
                              v.volM3 === activeVolM3
                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                : 'bg-white/90 hover:bg-blue-50 border-blue-200 text-blue-800'
                            }`}
                          >
                            {v.vol}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Daylight Pricing Bar (No Black Box) */}
                    <div className="rounded-3xl bg-gradient-to-r from-blue-50/90 via-cyan-50/70 to-teal-50/80 dark:from-slate-900 dark:via-slate-850 dark:to-slate-900 border border-blue-200/80 dark:border-slate-800 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 block">
                          ĐƠN GIÁ THUÊ TIÊU CHUẨN (NON-A/C)
                        </span>
                        <div className="font-headline text-2xl sm:text-3xl font-bold text-slate-950 mt-0.5">
                          {currentTier.rate}
                        </div>
                        <div className="text-xs font-semibold text-teal-700 mt-0.5">
                          {currentTier.rateAC}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onBookTier(selectedSizeTier)}
                        className="px-7 py-4 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm shadow-lg shadow-blue-600/25 transition-all cursor-pointer shrink-0"
                      >
                        Đặt kích thước này →
                      </button>
                    </div>
                  </div>

                  {/* Right 6 Cols: Clean Editorial Specification Sheet */}
                  <div className="lg:col-span-6 space-y-6">
                    <div className="flex flex-wrap items-center gap-3 text-xs font-bold">
                      <span className="px-3.5 py-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                        Diện tích sàn: {currentTier.area}
                      </span>
                      <span className="px-3.5 py-1.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                        Thể tích: {currentTier.volume}
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      <h3 className="font-headline text-2xl sm:text-4xl font-semibold text-slate-950 tracking-[-0.03em]">
                        {currentTier.name}
                      </h3>
                      <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                        {currentTier.desc}
                      </p>
                    </div>

                    {/* Clean Architectural Capacity List */}
                    <div className="space-y-2">
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Sức chứa vật dụng thực tế
                      </div>
                      <div className="divide-y divide-slate-200/80 border-y border-slate-200/80">
                        {currentTier.fits.map((fitItem, idx) => (
                          <div
                            key={idx}
                            className="py-3.5 flex items-center justify-between text-xs sm:text-sm font-medium text-slate-800"
                          >
                            <span>{fitItem}</span>
                            <span className="font-mono text-xs text-blue-600 font-bold">0{idx + 1}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Door & Target Audience */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 text-xs">
                      <div className="p-4 rounded-2xl bg-slate-50/90 border border-slate-200/70 space-y-1">
                        <span className="text-slate-500 block">Kết cấu cửa &amp; Khóa:</span>
                        <strong className="text-slate-900 text-sm block">{t(currentTier.door)}</strong>
                      </div>
                      <div className="p-4 rounded-2xl bg-slate-50/90 border border-slate-200/70 space-y-1">
                        <span className="text-slate-500 block">Phù hợp nhất cho:</span>
                        <strong className="text-slate-900 text-sm block">{t(currentTier.bestFor)}</strong>
                      </div>
                    </div>
                  </div>

                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

      </div>
    </section>
  )
}
