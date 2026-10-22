import React, { useState, useEffect } from 'react'
import {
  getStorageUnitImages,
  getStorageUnitDetailedSpecs,
  StorageUnitImage
} from '../../utils/storageUnitImages'

export interface StorageUnitDetailModalData {
  id: string
  backendId?: string
  unitCode: string
  unitTypeName?: string
  name?: string
  facilityId?: string
  facilityName?: string
  facilityAddress?: string
  floorLevel?: string
  pricePerMonth?: number
  depositAmount?: number
  areaSqMeters?: number
  distanceKm?: number
  status?: string
  images?: string[]
}

interface StorageUnitDetailModalProps {
  isOpen: boolean
  unit: StorageUnitDetailModalData | null
  onClose: () => void
  onReserve?: (unit: StorageUnitDetailModalData) => void
}

export const StorageUnitDetailModal: React.FC<StorageUnitDetailModalProps> = ({
  isOpen,
  unit,
  onClose,
  onReserve
}) => {
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'capacity' | 'amenities'>('overview')

  useEffect(() => {
    if (isOpen) {
      setActiveImageIndex(0)
      setActiveTab('overview')
      setIsFullscreen(false)
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, unit?.id])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return
      if (e.key === 'Escape') {
        if (isFullscreen) {
          setIsFullscreen(false)
        } else {
          onClose()
        }
      } else if (e.key === 'ArrowLeft') {
        setActiveImageIndex(prev => (prev > 0 ? prev - 1 : images.length - 1))
      } else if (e.key === 'ArrowRight') {
        setActiveImageIndex(prev => (prev < images.length - 1 ? prev + 1 : 0))
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isFullscreen, onClose, unit])

  if (!isOpen || !unit) return null

  const images: StorageUnitImage[] = getStorageUnitImages({
    unitCode: unit.unitCode,
    unitTypeName: unit.unitTypeName,
    areaSqMeters: unit.areaSqMeters,
    images: unit.images
  })

  const specs = getStorageUnitDetailedSpecs({
    unitCode: unit.unitCode,
    unitTypeName: unit.unitTypeName,
    areaSqMeters: unit.areaSqMeters,
    floorLevel: unit.floorLevel,
    pricePerMonth: unit.pricePerMonth,
    depositAmount: unit.depositAmount
  })

  const currentImage = images[activeImageIndex] || images[0]
  const isAvailable = !unit.status || unit.status === 'Sẵn sàng' || unit.status === 'AVAILABLE'
  const priceFormatted = Number(unit.pricePerMonth || 0).toLocaleString('vi-VN')
  const depositFormatted = Number(unit.depositAmount || unit.pricePerMonth || 0).toLocaleString('vi-VN')
  const floorText = unit.floorLevel ? unit.floorLevel.replace(/^floor\s*/i, 'Tầng ') : 'Tầng 1'

  const handleNextImage = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    setActiveImageIndex(prev => (prev < images.length - 1 ? prev + 1 : 0))
  }

  const handlePrevImage = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    setActiveImageIndex(prev => (prev > 0 ? prev - 1 : images.length - 1))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Main Dialog Modal */}
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden z-10 my-auto flex flex-col max-h-[92vh]">
        
        {/* ============================================================ */}
        {/* 1. MODAL HEADER                                              */}
        {/* ============================================================ */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between gap-4 shrink-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-mono text-xs font-black px-2.5 py-1 rounded-lg bg-slate-900 text-white">
              #{unit.unitCode}
            </span>
            <span className="font-bold text-xs px-2.5 py-1 rounded-lg bg-blue-100 text-blue-900 border border-blue-200">
              {floorText}
            </span>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${
              isAvailable
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}>
              {isAvailable ? 'Sẵn Sàng Cho Thuê' : 'Đang Được Thuê'}
            </span>
            {unit.distanceKm != null && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-cyan-50 text-cyan-800 border border-cyan-200 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">near_me</span>
                Cách bạn {unit.distanceKm} km
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng chi tiết"
            className="w-9 h-9 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* ============================================================ */}
        {/* 2. SCROLLABLE BODY CONTENT                                   */}
        {/* ============================================================ */}
        <div className="overflow-y-auto flex-1 p-6 space-y-6">

          {/* Unit Title & Location Info */}
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 pb-2">
            <div>
              <h2 className="font-headline text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {unit.unitTypeName || `Buồng Kho Tiêu Chuẩn #${unit.unitCode}`}
              </h2>
              <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-slate-600 mt-1">
                <span className="flex items-center gap-1 font-semibold text-slate-800">
                  <span className="material-symbols-outlined text-[16px] text-blue-600">apartment</span>
                  {unit.facilityName || 'Cơ sở Boxora'}
                </span>
                {unit.facilityAddress && (
                  <span className="flex items-center gap-1 text-slate-500">
                    <span className="material-symbols-outlined text-[16px] text-slate-400">location_on</span>
                    {unit.facilityAddress}
                  </span>
                )}
                {unit.facilityAddress && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(unit.facilityAddress)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 text-blue-600 hover:text-blue-800 font-bold hover:underline"
                  >
                    <span>Xem bản đồ</span>
                    <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                  </a>
                )}
              </div>
            </div>

            <div className="text-left sm:text-right shrink-0">
              <span className="text-xl sm:text-2xl font-black text-blue-700 font-headline">
                {priceFormatted} ₫
              </span>
              <span className="text-xs font-medium text-slate-500"> / tháng</span>
              <div className="text-[11px] text-slate-500">
                Tiền cọc: <strong className="text-slate-700">{depositFormatted} ₫</strong> (hoàn lại)
              </div>
            </div>
          </div>

          {/* ============================================================ */}
          {/* 3. INTERACTIVE IMAGE GALLERY                                 */}
          {/* ============================================================ */}
          <div className="space-y-3">
            <div className="relative rounded-2xl overflow-hidden bg-slate-950 aspect-[16/10] sm:aspect-[16/9] shadow-md border border-slate-200 group select-none">
              <img
                src={currentImage.url}
                alt={currentImage.title}
                className="w-full h-full object-cover transition-all duration-300 group-hover:scale-102"
              />

              {/* Tag Pill on Image */}
              <div className="absolute top-3.5 left-3.5 flex items-center gap-2">
                <span className="px-3 py-1 rounded-lg bg-slate-900/85 backdrop-blur-md text-white text-xs font-bold shadow-sm flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  {currentImage.tag}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-white text-[11px] font-mono">
                  {activeImageIndex + 1} / {images.length}
                </span>
              </div>

              {/* Fullscreen Toggle Button */}
              <button
                type="button"
                onClick={() => setIsFullscreen(true)}
                title="Xem ảnh phóng to"
                className="absolute top-3.5 right-3.5 w-9 h-9 rounded-xl bg-slate-900/80 hover:bg-slate-900 text-white flex items-center justify-center transition-colors backdrop-blur-md cursor-pointer shadow-sm"
              >
                <span className="material-symbols-outlined text-[18px]">fullscreen</span>
              </button>

              {/* Prev / Next Carousel Arrow Controls */}
              <button
                type="button"
                onClick={handlePrevImage}
                aria-label="Ảnh trước"
                className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-slate-900 flex items-center justify-center shadow-lg transition-all opacity-85 hover:opacity-100 hover:scale-110 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[24px]">chevron_left</span>
              </button>
              <button
                type="button"
                onClick={handleNextImage}
                aria-label="Ảnh tiếp theo"
                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-slate-900 flex items-center justify-center shadow-lg transition-all opacity-85 hover:opacity-100 hover:scale-110 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[24px]">chevron_right</span>
              </button>

              {/* Bottom Caption Overlay */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 via-slate-950/60 to-transparent p-4 sm:p-5 text-white">
                <h4 className="font-bold text-sm sm:text-base text-white">
                  {currentImage.title}
                </h4>
                <p className="text-xs text-slate-200 mt-0.5 line-clamp-2">
                  {currentImage.description}
                </p>
              </div>
            </div>

            {/* Thumbnail Row */}
            <div className="grid grid-cols-4 gap-2.5">
              {images.map((img, idx) => {
                const isActive = idx === activeImageIndex
                return (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setActiveImageIndex(idx)}
                    className={`relative rounded-xl overflow-hidden aspect-[4/3] border-2 transition-all cursor-pointer group/thumb ${
                      isActive
                        ? 'border-blue-600 ring-2 ring-blue-500/30 shadow-md scale-102'
                        : 'border-slate-200 hover:border-slate-400 opacity-75 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={img.url}
                      alt={img.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-slate-900/80 py-0.5 px-1 text-[10px] font-medium text-white truncate text-center">
                      {img.tag.split('&')[0]}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* ============================================================ */}
          {/* 4. QUICK SPECIFICATIONS KPI TILES                            */}
          {/* ============================================================ */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="p-3.5 bg-slate-50 border border-slate-200/90 rounded-xl text-left">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                Diện tích sàn
              </span>
              <span className="text-base font-extrabold text-slate-900 font-mono mt-0.5 block">
                {specs.areaLabel}
              </span>
              <span className="text-[10px] text-slate-400">Rộng x Dài chuẩn xác</span>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200/90 rounded-xl text-left">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                Thể tích lưu trữ
              </span>
              <span className="text-base font-extrabold text-slate-900 font-mono mt-0.5 block">
                {specs.volumeLabel}
              </span>
              <span className="text-[10px] text-slate-400">Trần cao {specs.ceilingHeight}</span>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200/90 rounded-xl text-left">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                Hệ thống khóa
              </span>
              <span className="text-base font-extrabold text-slate-900 mt-0.5 block truncate">
                Smart Lock IoT
              </span>
              <span className="text-[10px] text-slate-400">Mã PIN cá nhân 24/7</span>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200/90 rounded-xl text-left">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                An ninh &amp; PCCC
              </span>
              <span className="text-base font-extrabold text-slate-900 mt-0.5 block truncate">
                CCTV AI &amp; Sprinkler
              </span>
              <span className="text-[10px] text-slate-400">Thẩm duyệt chuẩn BCA</span>
            </div>
          </div>

          {/* ============================================================ */}
          {/* 5. TABS NAVIGATION & DETAILED SPECS PANELS                   */}
          {/* ============================================================ */}
          <div className="space-y-4 pt-2">
            <div className="flex border-b border-slate-200 gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'overview'
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">info</span>
                <span>Thông Số &amp; Quy Cách</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('capacity')}
                className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'capacity'
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">inventory_2</span>
                <span>Gợi Ý Sức Chứa Thực Tế</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('amenities')}
                className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'amenities'
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">shield</span>
                <span>Tiện Ích &amp; An Ninh 24/7</span>
              </button>
            </div>

            {/* TAB 1: OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-left">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5">
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[18px] text-blue-600">straighten</span>
                    Kích Thước &amp; Kết Cấu
                  </h4>
                  <div className="space-y-1.5 text-slate-600">
                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-500">Kích thước quy chuẩn:</span>
                      <strong className="text-slate-900 font-mono">{specs.dimensions}</strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-500">Chiều cao trần:</span>
                      <strong className="text-slate-900">{specs.ceilingHeight}</strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-500">Loại cửa phòng:</span>
                      <strong className="text-slate-900">{specs.doorType}</strong>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">Vị trí trong cơ sở:</span>
                      <strong className="text-slate-900">{floorText} · #{unit.unitCode}</strong>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5">
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[18px] text-emerald-600">verified_user</span>
                    Chính Sách &amp; Đối Tượng
                  </h4>
                  <div className="space-y-2 text-slate-600">
                    <p>
                      <strong className="text-slate-800">Khuyên dùng cho: </strong>
                      {specs.bestFor}
                    </p>
                    <div className="pt-1 text-[11px] text-slate-500 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[15px] text-emerald-600">check_circle</span>
                        <span>Thời hạn thuê tối thiểu linh hoạt từ 01 tháng.</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[15px] text-emerald-600">check_circle</span>
                        <span>Giảm 5% khi thuê 3 tháng, 10% khi thuê 6 tháng.</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[15px] text-emerald-600">check_circle</span>
                        <span>Hoàn trả 100% tiền đặt cọc khi kết thúc hợp đồng.</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: CAPACITY */}
            {activeTab === 'capacity' && (
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4 text-left">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">
                    Buồng kho #{unit.unitCode} ({specs.areaLabel}) có thể chứa được những gì?
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Ước tính thực tế dựa trên quy chuẩn đóng gói và kinh nghiệm vận hành của Boxora:
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {specs.suitableItems.map((item, index) => (
                    <div
                      key={index}
                      className="p-3 bg-white rounded-xl border border-slate-200 flex items-start gap-3 shadow-2xs"
                    >
                      <span className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">
                        {index + 1}
                      </span>
                      <span className="text-xs font-semibold text-slate-800 leading-snug">
                        {item}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="p-3.5 bg-blue-50/70 border border-blue-200/60 rounded-xl text-xs text-blue-900 flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[20px] text-blue-700 shrink-0">tips_and_updates</span>
                  <span>
                    <strong>Mẹo tối ưu:</strong> Tận dụng chiều cao trần {specs.ceilingHeight} bằng cách xếp chồng các thùng carton cùng kích cỡ hoặc gắn kệ lắp ghép để tăng gấp đôi sức chứa.
                  </span>
                </div>
              </div>
            )}

            {/* TAB 3: AMENITIES & SECURITY */}
            {activeTab === 'amenities' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-left">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5">
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[18px] text-amber-600">lock</span>
                    An Ninh Độc Quyền
                  </h4>
                  <ul className="space-y-2 text-slate-700">
                    {specs.securityHighlights.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="material-symbols-outlined text-[16px] text-emerald-600 shrink-0 mt-0.5">check</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5">
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[18px] text-cyan-600">room_service</span>
                    Tiện Ích Đi Kèm Tại Cơ Sở
                  </h4>
                  <ul className="space-y-2 text-slate-700">
                    {specs.includedAmenities.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="material-symbols-outlined text-[16px] text-cyan-600 shrink-0 mt-0.5">check</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

          </div>

        </div>

        {/* ============================================================ */}
        {/* 6. MODAL FOOTER & ACTION BAR                                 */}
        {/* ============================================================ */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/90 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
            <div>
              <span className="text-[11px] text-slate-500 uppercase font-semibold block">Giá thuê tháng:</span>
              <span className="font-mono text-lg sm:text-xl font-black text-slate-900">
                {priceFormatted} ₫
              </span>
            </div>
            <div className="h-7 w-[1px] bg-slate-300"></div>
            <div>
              <span className="text-[11px] text-slate-500 uppercase font-semibold block">Tiền cọc an toàn:</span>
              <span className="font-mono text-xs sm:text-sm font-bold text-slate-700">
                {depositFormatted} ₫
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
            >
              Đóng
            </button>

            {isAvailable ? (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  if (onReserve) {
                    onReserve(unit)
                  }
                }}
                className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Đặt Giữ Chỗ Ngay</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            ) : (
              <button
                type="button"
                disabled
                className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-slate-200 text-slate-400 text-xs font-bold cursor-not-allowed"
              >
                Kho Hiện Đang Có Khách
              </button>
            )}
          </div>
        </div>

      </div>

      {/* ============================================================ */}
      {/* 7. FULLSCREEN LIGHTBOX OVERLAY                               */}
      {/* ============================================================ */}
      {isFullscreen && (
        <div
          className="fixed inset-0 z-60 bg-black/95 flex flex-col items-center justify-between p-4 select-none"
          onClick={() => setIsFullscreen(false)}
        >
          <div className="w-full flex items-center justify-between text-white py-2 px-4 max-w-6xl">
            <div>
              <h3 className="font-bold text-base">{currentImage.title}</h3>
              <p className="text-xs text-slate-400">{currentImage.description}</p>
            </div>
            <button
              type="button"
              onClick={() => setIsFullscreen(false)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[24px]">close</span>
            </button>
          </div>

          <div
            className="relative flex items-center justify-center max-w-6xl max-h-[80vh] w-full"
            onClick={e => e.stopPropagation()}
          >
            <img
              src={currentImage.url}
              alt={currentImage.title}
              className="max-h-[78vh] max-w-full object-contain rounded-xl shadow-2xl"
            />
            <button
              type="button"
              onClick={handlePrevImage}
              className="absolute left-4 w-12 h-12 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center shadow-lg transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[28px]">chevron_left</span>
            </button>
            <button
              type="button"
              onClick={handleNextImage}
              className="absolute right-4 w-12 h-12 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center shadow-lg transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[28px]">chevron_right</span>
            </button>
          </div>

          <div className="text-xs text-slate-400 py-2">
            Ảnh {activeImageIndex + 1} / {images.length} · Bấm phím Esc hoặc nút Đóng để thoát
          </div>
        </div>
      )}

    </div>
  )
}

