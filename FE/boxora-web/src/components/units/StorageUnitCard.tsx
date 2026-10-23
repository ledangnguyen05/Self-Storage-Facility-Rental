import React from 'react'
import {
  getStorageUnitImages,
  getStorageUnitPrimaryImage,
  getStorageUnitDetailedSpecs
} from '../../utils/storageUnitImages'

interface StorageUnitCardProps {
  unitCode: string
  unitTypeName?: string
  facilityName?: string
  facilityAddress?: string
  floorLevel?: string
  pricePerMonth: number
  areaSqMeters?: number
  distanceKm?: number
  isSelected?: boolean
  reserveDisabled?: boolean
  images?: string[]
  onSelect?: () => void
  onViewDetails?: () => void
  onReserve: () => void
}

const formatFloorLevel = (floorLevel?: string) => {
  if (!floorLevel) return 'Tầng 1'
  return floorLevel.replace(/^floor\s*/i, 'Tầng ')
}

export const StorageUnitCard: React.FC<StorageUnitCardProps> = ({
  unitCode,
  unitTypeName,
  facilityName,
  facilityAddress,
  floorLevel,
  pricePerMonth,
  areaSqMeters,
  distanceKm,
  isSelected = false,
  reserveDisabled = false,
  images,
  onSelect,
  onViewDetails,
  onReserve
}) => {
  const priceFormatted = Number(pricePerMonth || 0).toLocaleString('vi-VN')
  const hasArea = areaSqMeters != null && Number.isFinite(Number(areaSqMeters))
  const areaValue = hasArea ? Number(areaSqMeters) : undefined
  const areaLabel = areaValue == null ? 'Chưa cập nhật' : `${areaValue.toFixed(1)} m²`
  const volumeLabel = areaValue == null ? 'Chưa cập nhật' : `${Math.round(areaValue * 2.8)} m³`
  const floorLabel = formatFloorLevel(floorLevel)

  const cardImages = getStorageUnitImages({
    unitCode,
    unitTypeName,
    areaSqMeters,
    images
  })
  const primaryImage = getStorageUnitPrimaryImage({
    unitCode,
    unitTypeName,
    areaSqMeters,
    images
  })
  const specs = getStorageUnitDetailedSpecs({
    unitCode,
    unitTypeName,
    areaSqMeters,
    floorLevel,
    pricePerMonth
  })

  const handleCardClick = () => {
    if (onViewDetails) {
      onViewDetails()
    } else if (onSelect) {
      onSelect()
    }
  }

  return (
    <article
      onClick={handleCardClick}
      className={`bg-white rounded-2xl border overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between group cursor-pointer ${
        isSelected ? 'border-blue-600 ring-2 ring-blue-500/20' : 'border-slate-200'
      }`}
    >
      <div>
        <div className="relative h-48 overflow-hidden bg-slate-100">
          <img
            src={primaryImage}
            alt={`Kho #${unitCode}`}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 opacity-90"
          />

          {/* Top badges: Unit code & floor level */}
          <div className="absolute top-3 left-3 flex gap-1.5">
            <span className="bg-white/95 backdrop-blur-md text-slate-900 border border-slate-200 font-mono text-xs px-2.5 py-1 rounded-md font-bold shadow-sm">
              #{unitCode}
            </span>
            <span className="bg-blue-600 text-white font-mono text-[10px] uppercase font-bold px-2 py-1 rounded-md shadow-sm">
              {floorLabel}
            </span>
          </div>

          {/* Photo Count Badge */}
          <div className="absolute top-3 right-3">
            <span className="bg-slate-900/80 hover:bg-slate-900 backdrop-blur-md text-white text-[11px] font-semibold px-2.5 py-1 rounded-md flex items-center gap-1 shadow-sm transition-colors">
              <span className="material-symbols-outlined text-[14px]">photo_library</span>
              {cardImages.length} ảnh chi tiết
            </span>
          </div>

          {/* Facility Name Pill */}
          <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-md text-slate-900 text-xs font-semibold flex items-center gap-1 shadow-sm max-w-[75%]">
            <span className="text-slate-600 truncate">{facilityName || 'Kho Boxora'}</span>
          </div>

          {/* Hover Overlay Hint */}
          <div className="absolute inset-0 bg-blue-900/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
            <span className="bg-white/90 text-slate-900 text-xs font-bold px-3 py-1.5 rounded-full shadow-md flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">visibility</span>
              Xem chi tiết &amp; ảnh minh họa
            </span>
          </div>
        </div>

        <div className="p-5 flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-headline text-base font-bold text-slate-900 min-w-0 truncate group-hover:text-blue-600 transition-colors">
              {unitTypeName || `Kho Tiêu Chuẩn #${unitCode}`}
            </span>
            <span className="font-headline text-base font-bold text-blue-600 shrink-0">
              {priceFormatted} ₫<span className="text-xs font-normal text-slate-500">/tháng</span>
            </span>
          </div>

          <p className="text-xs text-slate-500 line-clamp-2">
            {specs.bestFor}
          </p>

          {facilityAddress && (
            <div className="space-y-1 text-[11px] text-slate-500">
              <div className="flex items-start justify-between gap-2">
                <span className="flex min-w-0 items-start gap-1.5">
                  <span className="material-symbols-outlined text-[14px] text-slate-400 shrink-0">location_on</span>
                  <span className="line-clamp-2">{facilityAddress}</span>
                </span>
                {distanceKm != null && (
                  <span className="shrink-0 rounded-md border border-cyan-200 bg-cyan-50 px-1.5 py-0.5 font-semibold text-cyan-800">
                    {distanceKm} km
                  </span>
                )}
              </div>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(facilityAddress)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => event.stopPropagation()}
                className="inline-flex items-center gap-0.5 font-semibold text-blue-600 hover:text-blue-800 hover:underline"
              >
                <span>Xem chỉ đường</span>
                <span className="material-symbols-outlined text-[12px]">open_in_new</span>
              </a>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg text-xs">
              <span className="text-slate-400 block text-[10px] uppercase font-medium">Diện tích</span>
              <span className="font-mono font-semibold text-slate-800">{areaLabel}</span>
            </div>
            <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg text-xs">
              <span className="text-slate-400 block text-[10px] uppercase font-medium">Thể tích</span>
              <span className="font-mono font-semibold text-slate-800">{volumeLabel}</span>
            </div>
            <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg text-xs">
              <span className="text-slate-400 block text-[10px] uppercase font-medium">Khóa cửa</span>
              <span className="text-slate-800 font-semibold truncate block">Smart Lock + PIN</span>
            </div>
            <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg text-xs">
              <span className="text-slate-400 block text-[10px] uppercase font-medium">An ninh</span>
              <span className="text-slate-800 font-semibold truncate block">CCTV 24/7 AI</span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-5 pt-0 flex items-center gap-2">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            handleCardClick()
          }}
          className="flex-1 h-10 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px]">visibility</span>
          <span>Xem Chi Tiết &amp; Ảnh</span>
        </button>

        <button
          type="button"
          disabled={reserveDisabled}
          onClick={(event) => {
            event.stopPropagation()
            onReserve()
          }}
          className="flex-1 h-10 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm cursor-pointer disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <span>Đặt Giữ Chỗ</span>
          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
        </button>
      </div>
    </article>
  )
}

export const StorageUnitCardSkeleton: React.FC = () => (
  <article
    aria-hidden="true"
    className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col justify-between animate-pulse motion-reduce:animate-none"
  >
    <div>
      <div className="relative h-48 overflow-hidden bg-slate-200">
        <div className="absolute top-3 left-3 flex gap-1.5">
          <div className="h-6 w-16 rounded-md bg-slate-300" />
          <div className="h-6 w-14 rounded-md bg-slate-300" />
        </div>
        <div className="absolute top-3 right-3 h-6 w-24 rounded-md bg-slate-300" />
        <div className="absolute bottom-3 right-3 h-6 w-28 rounded-md bg-slate-300" />
      </div>

      <div className="p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="h-5 w-2/5 rounded bg-slate-200" />
          <div className="h-5 w-1/3 rounded bg-slate-200" />
        </div>

        <div className="space-y-2">
          <div className="h-3 w-full rounded bg-slate-100" />
          <div className="h-3 w-4/5 rounded bg-slate-100" />
        </div>

        <div className="space-y-2">
          <div className="h-3 w-full rounded bg-slate-100" />
          <div className="h-3 w-1/3 rounded bg-slate-100" />
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="p-2.5 h-[58px] bg-slate-50 border border-slate-100 rounded-lg">
              <div className="h-2 w-2/5 rounded bg-slate-200 mb-2" />
              <div className="h-3 w-3/4 rounded bg-slate-200" />
            </div>
          ))}
        </div>
      </div>
    </div>

    <div className="p-5 pt-0 flex items-center gap-2">
      <div className="flex-1 h-10 rounded-lg bg-slate-100" />
      <div className="flex-1 h-10 rounded-lg bg-slate-200" />
    </div>
  </article>
)

export default StorageUnitCard
