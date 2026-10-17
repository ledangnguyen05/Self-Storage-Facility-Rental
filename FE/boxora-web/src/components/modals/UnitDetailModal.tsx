import React from 'react'
import { StorageUnitType } from '../../data/storageUnitsData'

interface UnitDetailModalProps {
  unit: StorageUnitType | null
  isOpen: boolean
  onClose: () => void
  onRent: (unit: StorageUnitType) => void
}

const getUnitImage = (category: StorageUnitType['category']) => {
  switch (category) {
    case 'mini':
      return 'https://images.unsplash.com/photo-1590402494682-cd3fb53b1f70?auto=format&fit=crop&w=900&q=80'
    case 'special':
      return 'https://images.unsplash.com/photo-1553413077-190dd305871c?auto=format&fit=crop&w=900&q=80'
    case 'business':
      return 'https://images.unsplash.com/photo-1587293852726-70cdb56c2866?auto=format&fit=crop&w=900&q=80'
    case 'personal':
    default:
      return 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=900&q=80'
  }
}

const getCapacityText = (area?: number) => {
  if (area == null) return 'Linh hoạt cho nhiều nhu cầu lưu trữ cá nhân hoặc doanh nghiệp.'
  if (area < 3) return 'Chứa khoảng 10–15 thùng carton, tài liệu, vali, xe đạp và đồ dùng cá nhân gọn nhẹ.'
  if (area <= 8) return 'Chứa trọn gói đồ đạc căn hộ 1 phòng ngủ, bàn ghế, tủ kệ, nệm và đồ gia dụng.'
  if (area <= 15) return 'Chứa nội thất căn hộ 2–3 phòng ngủ, hàng mẫu, thiết bị văn phòng cỡ vừa.'
  return 'Chứa hàng hóa thương mại, máy móc, pallet phân phối số lượng lớn cho doanh nghiệp.'
}

export const UnitDetailModal: React.FC<UnitDetailModalProps> = ({
  unit,
  isOpen,
  onClose,
  onRent,
}) => {
  if (!isOpen || !unit) return null

  const isAvailable = unit.isAvailable ?? (unit.status === 'Sẵn sàng')
  const unitImage = unit.imageUrl || getUnitImage(unit.category)

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden text-left animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-unit-title"
      >
        {/* Header with image */}
        <div className="relative h-48 sm:h-56 w-full bg-slate-100 overflow-hidden">
          <img
            src={unitImage}
            alt={`Kho ${unit.unitCode}`}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = '/smart-warehouse-clean.jpg'
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/30 to-transparent" />

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-900/60 hover:bg-slate-900 text-white flex items-center justify-center backdrop-blur-md transition-all cursor-pointer"
            aria-label="Đóng"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>

          {/* Unit code & badges on image */}
          <div className="absolute bottom-4 left-5 right-5 flex items-end justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-md bg-white/20 text-white backdrop-blur-md">
                  Mã kho: {unit.unitCode}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold border backdrop-blur-md flex items-center gap-1 ${
                    isAvailable
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
                      : 'bg-slate-500/20 text-slate-300 border-slate-400/30'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isAvailable ? 'bg-emerald-400' : 'bg-slate-400'}`} />
                  {unit.status}
                </span>
              </div>
              <h2 id="modal-unit-title" className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Kho {unit.unitCode} · {unit.unitTypeName || 'Kho lưu trữ'}
              </h2>
            </div>

            {unit.distanceKm != null && (
              <span className="hidden sm:inline-flex items-center gap-1 px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-200 border border-cyan-400/30 text-xs font-semibold backdrop-blur-md shrink-0">
                <span className="material-symbols-outlined text-[14px]">near_me</span>
                Khoảng {unit.distanceKm} km
              </span>
            )}
          </div>
        </div>

        {/* Modal body content */}
        <div className="p-6 space-y-6 max-h-[calc(85vh-200px)] overflow-y-auto">
          {/* Key Specifications Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-[11px] font-medium text-slate-500 block">Diện tích</span>
              <span className="font-headline text-lg font-bold text-slate-900">
                {unit.areaSqMeters != null ? `${unit.areaSqMeters} m²` : 'Tiêu chuẩn'}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-[11px] font-medium text-slate-500 block">Vị trí buồng</span>
              <span className="font-headline text-sm font-bold text-slate-900 truncate block" title={unit.floorLocation}>
                {unit.floorLocation}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-[11px] font-medium text-slate-500 block">Giá thuê tháng</span>
              <span className="font-headline text-base font-bold text-blue-600 truncate block">
                {Number(unit.monthlyPriceNumeric).toLocaleString('vi-VN')} ₫
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-[11px] font-medium text-slate-500 block">Tiền đặt cọc</span>
              <span className="font-headline text-sm font-bold text-slate-800 truncate block">
                {Number(unit.depositAmountNumeric || unit.monthlyPriceNumeric).toLocaleString('vi-VN')} ₫
              </span>
            </div>
          </div>

          {/* Facility location details */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-bold text-slate-900">
                <span className="material-symbols-outlined text-[18px] text-blue-600">domain</span>
                <span>{unit.facilityName}</span>
              </div>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(unit.facilityAddress)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 text-[11px] hover:underline"
              >
                <span>Chỉ đường trên Google Maps</span>
                <span className="material-symbols-outlined text-[13px]">open_in_new</span>
              </a>
            </div>
            <p className="text-slate-600 flex items-center gap-1 text-[11px]">
              <span className="material-symbols-outlined text-[15px] text-slate-400">location_on</span>
              <span>{unit.facilityAddress}</span>
            </p>
          </div>

          {/* Storage Capacity Guidance */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-emerald-600">inventory</span>
              <span>Sức chứa &amp; Gợi ý lưu trữ</span>
            </h3>
            <p className="text-xs text-slate-600 bg-emerald-50/60 p-3 rounded-xl border border-emerald-100/80 leading-relaxed">
              {getCapacityText(unit.areaSqMeters)}
            </p>
          </div>

          {/* Features and Safety */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-blue-600">verified_user</span>
              <span>Tiêu chuẩn an ninh &amp; Tiện ích cơ sở</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
              <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100">
                <span className="material-symbols-outlined text-[16px] text-emerald-500">videocam</span>
                <span>CCTV giám sát an ninh 24/7 toàn khu vực</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100">
                <span className="material-symbols-outlined text-[16px] text-emerald-500">key</span>
                <span>Khóa tự quản (Mã PIN kích hoạt sau bàn giao)</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100">
                <span className="material-symbols-outlined text-[16px] text-emerald-500">ac_unit</span>
                <span>Không gian khô ráo, thông gió tiêu chuẩn</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100">
                <span className="material-symbols-outlined text-[16px] text-emerald-500">fire_extinguisher</span>
                <span>Hệ thống PCCC tự động đạt chuẩn thẩm duyệt</span>
              </div>
            </div>
          </div>

          {/* Rental Terms and Conditions */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-amber-600">contract</span>
              <span>Điều kiện &amp; Quy trình thuê kho</span>
            </h3>
            <ul className="text-[11px] text-slate-600 space-y-1.5 bg-amber-50/50 p-3.5 rounded-xl border border-amber-100/80 list-disc list-inside">
              <li><strong>Thời hạn thuê:</strong> Tối thiểu từ 1 tháng, thanh toán linh hoạt và có chiết khấu khi trả trước dài hạn.</li>
              <li><strong>Tiền đặt cọc:</strong> Tương đương 1 tháng tiền thuê, được hoàn trả đầy đủ khi hoàn tất bàn giao và thanh lý hợp đồng.</li>
              <li><strong>Hợp đồng pháp lý:</strong> Ký hợp đồng điện tử trực tuyến hoặc trực tiếp tại cơ sở Boxora.</li>
              <li><strong>Bàn giao &amp; Kích hoạt mã PIN:</strong> Mã PIN tự quản được hệ thống kích hoạt sau khi hợp đồng ký kết và nhân viên cơ sở hoàn tất biên bản bàn giao.</li>
            </ul>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3">
          <div>
            <span className="text-[11px] text-slate-500 block">Giá thuê niêm yết</span>
            <div className="flex items-baseline gap-1">
              <span className="font-mono text-xl font-bold text-slate-900">
                {Number(unit.monthlyPriceNumeric).toLocaleString('vi-VN')} ₫
              </span>
              <span className="text-xs text-slate-500">/ tháng</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
            >
              Đóng
            </button>

            {isAvailable ? (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onRent(unit)
                }}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span>Đặt thuê kho này</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            ) : (
              <button
                type="button"
                disabled
                className="px-5 py-2.5 rounded-xl bg-slate-200 text-slate-400 text-xs font-bold cursor-not-allowed flex items-center gap-1.5"
              >
                <span>Kho không khả dụng</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
