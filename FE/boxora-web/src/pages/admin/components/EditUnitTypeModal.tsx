import React, { useState, useEffect } from 'react'
import { UnitType } from '../../../types'
import { storageUnitService } from '../../../services/storageUnitService'
import { useLanguage } from '../../../context/LanguageContext'

interface EditUnitTypeModalProps {
  unitType: UnitType | null
  isOpen: boolean
  onClose: () => void
  onSuccess: (updated: UnitType) => void
}

export const EditUnitTypeModal: React.FC<EditUnitTypeModalProps> = ({
  unitType,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { t } = useLanguage()

  const [typeName, setTypeName] = useState('')
  const [lengthM, setLengthM] = useState<number | ''>('')
  const [widthM, setWidthM] = useState<number | ''>('')
  const [heightM, setHeightM] = useState<number | ''>('')
  const [volumeM3, setVolumeM3] = useState<number | ''>('')
  const [areaSqm, setAreaSqm] = useState<number | ''>('')
  const [capacityBoxes, setCapacityBoxes] = useState<number | ''>('')
  const [basePrice, setBasePrice] = useState<number | ''>('')
  const [acPrice, setAcPrice] = useState<number | ''>('')
  const [isActive, setIsActive] = useState<boolean>(true)
  const [priceChangeReason, setPriceChangeReason] = useState('')

  const [isSaving, setIsSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [showStatusConfirm, setShowStatusConfirm] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<boolean | null>(null)

  useEffect(() => {
    if (unitType) {
      setTypeName(unitType.typeName || '')
      setLengthM(unitType.lengthM ?? '')
      setWidthM(unitType.widthM ?? '')
      setHeightM(unitType.heightM ?? 2.5)
      setVolumeM3(unitType.volumeM3 ?? '')
      setAreaSqm(unitType.areaSqm ?? '')
      setCapacityBoxes(unitType.capacityBoxes ?? '')
      setBasePrice(unitType.basePricePerMonth ?? 0)
      setAcPrice(unitType.acPricePerMonth ?? Math.round((unitType.basePricePerMonth || 0) * 1.2))
      setIsActive(unitType.isActive ?? true)
      setPriceChangeReason('')
      setErrorMsg(null)
      setShowStatusConfirm(false)
    }
  }, [unitType, isOpen])

  if (!isOpen || !unitType) return null

  // Auto calculate volume & area when length, width, height change
  const handleDimensionChange = (l: number | '', w: number | '', h: number | '') => {
    setLengthM(l)
    setWidthM(w)
    setHeightM(h)
    if (typeof l === 'number' && typeof w === 'number' && l > 0 && w > 0) {
      const calcArea = Math.round(l * w * 100) / 100
      setAreaSqm(calcArea)
      if (typeof h === 'number' && h > 0) {
        const calcVol = Math.round(calcArea * h * 100) / 100
        setVolumeM3(calcVol)
      }
    }
  }

  const handleToggleStatus = (newStatus: boolean) => {
    setPendingStatus(newStatus)
    setShowStatusConfirm(true)
  }

  const confirmStatusChange = () => {
    if (pendingStatus !== null) {
      setIsActive(pendingStatus)
    }
    setShowStatusConfirm(false)
    setPendingStatus(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    if (!typeName.trim()) {
      setErrorMsg('Vui lòng nhập tên loại kho.')
      return
    }

    if (basePrice === '' || Number(basePrice) < 0) {
      setErrorMsg('Giá thuê tiêu chuẩn phải lớn hơn hoặc bằng 0.')
      return
    }

    if (acPrice === '' || Number(acPrice) < 0) {
      setErrorMsg('Giá thuê máy lạnh A/C phải lớn hơn hoặc bằng 0.')
      return
    }

    setIsSaving(true)
    try {
      const payload = {
        typeName: typeName.trim(),
        lengthM: lengthM !== '' ? Number(lengthM) : undefined,
        widthM: widthM !== '' ? Number(widthM) : undefined,
        heightM: heightM !== '' ? Number(heightM) : undefined,
        volumeM3: volumeM3 !== '' ? Number(volumeM3) : undefined,
        areaSqm: areaSqm !== '' ? Number(areaSqm) : undefined,
        capacityBoxes: capacityBoxes !== '' ? Number(capacityBoxes) : undefined,
        basePricePerMonth: Number(basePrice),
        acPricePerMonth: Number(acPrice),
        isActive,
        priceChangeReason: priceChangeReason.trim() || 'Cập nhật cấu hình loại kho',
      }

      const res = await storageUnitService.updateUnitType(unitType.id, payload)
      onSuccess(res || { ...unitType, ...payload })
      onClose()
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || err.message || 'Không thể cập nhật loại kho')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-cyan-600 dark:text-cyan-400 text-2xl">
              edit_note
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {t('Chỉnh sửa Loại Kho')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Mã định danh: <span className="font-mono font-medium text-cyan-600">{unitType.id}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <span className="material-symbols-outlined text-rose-600 shrink-0">error</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Type Name & Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t('Tên loại kho')} <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={typeName}
                onChange={(e) => setTypeName(e.target.value)}
                placeholder="VD: Tủ cá nhân (Mini 1m³)"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-cyan-500 outline-none"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t('Trạng thái hoạt động')}
              </label>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleToggleStatus(!isActive)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300'
                      : 'bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950/50 dark:text-rose-300'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">
                    {isActive ? 'check_circle' : 'block'}
                  </span>
                  <span>{isActive ? t('Hoạt động') : t('Tạm ngưng')}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Dimensions: Length, Width, Height */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-cyan-600 text-[18px]">straighten</span>
              <span>{t('Kích thước quy chuẩn')}</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  {t('Dài (m)')}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.1"
                  value={lengthM}
                  onChange={(e) =>
                    handleDimensionChange(
                      e.target.value === '' ? '' : Number(e.target.value),
                      widthM,
                      heightM
                    )
                  }
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  {t('Rộng (m)')}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.1"
                  value={widthM}
                  onChange={(e) =>
                    handleDimensionChange(
                      lengthM,
                      e.target.value === '' ? '' : Number(e.target.value),
                      heightM
                    )
                  }
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  {t('Cao (m)')}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.1"
                  value={heightM}
                  onChange={(e) =>
                    handleDimensionChange(
                      lengthM,
                      widthM,
                      e.target.value === '' ? '' : Number(e.target.value)
                    )
                  }
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                />
              </div>
            </div>

            {/* Auto metrics: Area, Volume, Capacity */}
            <div className="grid grid-cols-3 gap-3 pt-1">
              <div className="space-y-1">
                <label className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  {t('Diện tích (m²)')}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={areaSqm}
                  onChange={(e) => setAreaSqm(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold text-slate-700"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  {t('Thể tích (m³)')}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={volumeM3}
                  onChange={(e) => setVolumeM3(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold text-cyan-700"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  {t('Sức chứa (hộp/thùng)')}
                </label>
                <input
                  type="number"
                  value={capacityBoxes}
                  onChange={(e) => setCapacityBoxes(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="VD: 48"
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Pricing: Standard vs AC */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t('Giá Tiêu chuẩn / tháng (VNĐ)')} <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="10000"
                min="0"
                value={basePrice}
                onChange={(e) => {
                  const val = e.target.value === '' ? '' : Number(e.target.value)
                  setBasePrice(val)
                  // Propose AC price if unset or linked
                  if (typeof val === 'number') {
                    setAcPrice(Math.round(val * 1.2))
                  }
                }}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold text-slate-800 dark:text-slate-100"
                required
              />
              <p className="text-[10px] text-slate-400">
                {typeof basePrice === 'number' ? basePrice.toLocaleString('vi-VN') + ' đ' : ''}
              </p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t('Giá Máy lạnh A/C / tháng (VNĐ)')} <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="10000"
                min="0"
                value={acPrice}
                onChange={(e) => setAcPrice(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold text-teal-700 dark:text-teal-400"
                required
              />
              <p className="text-[10px] text-slate-400">
                {typeof acPrice === 'number' ? acPrice.toLocaleString('vi-VN') + ' đ' : ''}
              </p>
            </div>
          </div>

          {/* Reason for change */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t('Lý do cập nhật')}
            </label>
            <input
              type="text"
              value={priceChangeReason}
              onChange={(e) => setPriceChangeReason(e.target.value)}
              placeholder="VD: Điều chỉnh giá niêm yết theo quý / Cập nhật kích thước chuẩn"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          {/* Action buttons */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              {t('Hủy')}
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 rounded-lg bg-cyan-700 hover:bg-cyan-800 text-white text-xs font-bold transition shadow-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  <span>{t('Đang lưu...')}</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">save</span>
                  <span>{t('Lưu thay đổi')}</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Confirmation Modal for Active/Inactive toggle */}
        {showStatusConfirm && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-2xs">
            <div className="bg-white dark:bg-slate-900 rounded-xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 max-w-sm w-full space-y-3 animate-scale-in">
              <div className="flex items-center gap-2.5 text-amber-600">
                <span className="material-symbols-outlined text-2xl">warning</span>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  {pendingStatus ? t('Kích hoạt loại kho') : t('Tạm ngưng loại kho')}
                </h4>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {pendingStatus
                  ? t('Bạn có chắc muốn kích hoạt lại loại kho này? Khách hàng sẽ có thể đặt chỗ loại kho này ngay lập tức.')
                  : t('Bạn có chắc muốn tạm ngưng loại kho này? Khách hàng sẽ bị chặn không thể đặt chỗ mới với loại kho này (các hợp đồng cũ vẫn duy trì bình thường).')}
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowStatusConfirm(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  {t('Hủy bỏ')}
                </button>
                <button
                  type="button"
                  onClick={confirmStatusChange}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold text-white shadow-xs ${
                    pendingStatus ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {t('Xác nhận')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
