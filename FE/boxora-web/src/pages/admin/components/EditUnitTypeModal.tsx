import React, { useState, useEffect } from 'react'
import { UnitType, FacilityPolicy } from '../../../types'
import { storageUnitService } from '../../../services/storageUnitService'
import { facilityUnitTypeService } from '../../../services/facilityUnitTypeService'
import { useLanguage } from '../../../context/LanguageContext'
import { resolveUnitImageUrl } from '../../../utils/storageUnitImages'

interface EditUnitTypeModalProps {
  unitType: UnitType | null
  isOpen: boolean
  onClose: () => void
  onSuccess: (updated: UnitType) => void
  facilityId?: string
  facilityName?: string
  policy?: FacilityPolicy | null
}

export const EditUnitTypeModal: React.FC<EditUnitTypeModalProps> = ({
  unitType,
  isOpen,
  onClose,
  onSuccess,
  facilityId,
  facilityName,
  policy,
}) => {
  const { t } = useLanguage()

  const [typeName, setTypeName] = useState('')
  const [lengthM, setLengthM] = useState<number | ''>('')
  const [widthM, setWidthM] = useState<number | ''>('')
  const [heightM, setHeightM] = useState<number | ''>('')
  const [volumeM3, setVolumeM3] = useState<number | ''>('')
  const [areaSqm, setAreaSqm] = useState<number | ''>('')
  const [basePrice, setBasePrice] = useState<number | ''>('')
  const [acPrice, setAcPrice] = useState<number | ''>('')
  const [isActive, setIsActive] = useState<boolean>(true)
  const [imageUrl, setImageUrl] = useState<string>('')
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string>('')
  const [isUploadingImage, setIsUploadingImage] = useState<boolean>(false)
  const [imageUploadSuccessMsg, setImageUploadSuccessMsg] = useState<string | null>(null)
  const [imageLoadError, setImageLoadError] = useState<boolean>(false)
  const [showRemoveImageConfirm, setShowRemoveImageConfirm] = useState<boolean>(false)

  const [isSaving, setIsSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (unitType) {
      setTypeName(unitType.typeName || '')
      setLengthM(unitType.lengthM ?? '')
      setWidthM(unitType.widthM ?? '')
      setHeightM(unitType.heightM ?? 2.5)
      setVolumeM3(unitType.volumeM3 ?? '')
      setAreaSqm(unitType.areaSqm ?? '')
      setBasePrice(unitType.basePricePerMonth ?? 0)
      setAcPrice(unitType.acPricePerMonth != null && unitType.acPricePerMonth > 0 ? unitType.acPricePerMonth : '')
      setIsActive(unitType.isActive ?? true)
      setImageUrl(unitType.imageUrl || '')
      setLocalPreviewUrl('')
      setImageUploadSuccessMsg(null)
      setImageLoadError(false)
      setShowRemoveImageConfirm(false)
      setErrorMsg(null)
    } else {
      setTypeName('')
      setLengthM('')
      setWidthM('')
      setHeightM(2.5)
      setVolumeM3('')
      setAreaSqm('')
      setBasePrice('')
      setAcPrice('')
      setIsActive(true)
      setImageUrl('')
      setLocalPreviewUrl('')
      setImageUploadSuccessMsg(null)
      setImageLoadError(false)
      setShowRemoveImageConfirm(false)
      setErrorMsg(null)
    }
  }, [unitType, isOpen])

  if (!isOpen) return null

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

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    const allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'gif']

    if (!allowedMimeTypes.includes(file.type.toLowerCase()) || !allowedExts.includes(ext)) {
      setErrorMsg('Định dạng tệp không hợp lệ. Vui lòng chọn tệp hình ảnh (JPG, JPEG, PNG, WEBP, GIF).')
      e.target.value = ''
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('Dung lượng ảnh không được vượt quá 10MB.')
      e.target.value = ''
      return
    }

    // Hiển thị ngay ảnh xem trước từ tệp cục bộ (0s delay, không lỗi tải)
    const previewUrl = URL.createObjectURL(file)
    setLocalPreviewUrl(previewUrl)
    setImageLoadError(false)

    setIsUploadingImage(true)
    setErrorMsg(null)
    setImageUploadSuccessMsg(null)
    setShowRemoveImageConfirm(false)
    try {
      const res = await storageUnitService.uploadUnitImage(file)
      if (res?.fileUrl) {
        setImageUrl(res.fileUrl)
        setImageLoadError(false)
        setImageUploadSuccessMsg('Đã tải ảnh mô phỏng lên thành công. Hãy nhấn Lưu để áp dụng.')
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || err.message || 'Không thể tải lên ảnh mô phỏng.')
    } finally {
      setIsUploadingImage(false)
      // reset file input value
      e.target.value = ''
    }
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

    if (acPrice !== '' && Number(acPrice) < 0) {
      setErrorMsg('Giá thuê máy lạnh A/C không thể là số âm.')
      return
    }

    setIsSaving(true)
    try {
      const calcArea = areaSqm !== '' ? Number(areaSqm) : (lengthM && widthM ? Number(lengthM) * Number(widthM) : 1)
      const numAcPrice = acPrice !== '' && Number(acPrice) > 0 ? Number(acPrice) : undefined

      if (unitType) {
        const isBackendUnitType = !unitType.id.startsWith('fut_')
        const trimmedImg = imageUrl.trim()
        const defaultReason = isActive !== unitType.isActive
          ? (isActive ? 'Kích hoạt lại loại kho' : 'Tạm ngưng hoạt động loại kho')
          : 'Cập nhật cấu hình loại kho'

        const payload: UnitType = {
          ...unitType,
          typeName: typeName.trim(),
          lengthM: lengthM !== '' ? Number(lengthM) : undefined,
          widthM: widthM !== '' ? Number(widthM) : undefined,
          heightM: heightM !== '' ? Number(heightM) : undefined,
          volumeM3: volumeM3 !== '' ? Number(volumeM3) : undefined,
          areaSqm: calcArea,
          basePricePerMonth: Number(basePrice),
          acPricePerMonth: numAcPrice,
          isActive,
          imageUrl: trimmedImg || undefined,
          priceChangeReason: defaultReason,
        }

        let updatedType: UnitType = payload

        // Luôn đồng bộ và lưu thông tin cập nhật vào Database backend đối với loại kho hệ thống
        if (isBackendUnitType) {
          const dims = (lengthM && widthM && heightM)
            ? `${lengthM}m x ${widthM}m x ${heightM}m`
            : (calcArea ? `${calcArea}m²` : undefined)
          const bePayload = {
            typeName: typeName.trim() || unitType.typeName,
            dimensions: dims,
            lengthM: lengthM !== '' ? Number(lengthM) : undefined,
            widthM: widthM !== '' ? Number(widthM) : undefined,
            heightM: heightM !== '' ? Number(heightM) : undefined,
            volumeM3: volumeM3 !== '' ? Number(volumeM3) : undefined,
            areaSqm: calcArea,
            basePricePerMonth: Number(basePrice),
            acPricePerMonth: numAcPrice ?? 0,
            depositAmount: Number(basePrice),
            isActive,
            imageUrl: trimmedImg, // chuỗi rỗng để xóa ảnh, hoặc link ảnh đã upload
            priceChangeReason: defaultReason,
          }
          const beRes = await storageUnitService.updateUnitType(unitType.id, bePayload)
          if (beRes) {
            updatedType = { ...updatedType, ...beRes, imageUrl: beRes.imageUrl || trimmedImg || undefined }
          }
        }

        if (facilityId) {
          const res = await facilityUnitTypeService.saveFacilityUnitType(
            facilityId,
            {
              ...updatedType,
              ...payload,
              imageUrl: trimmedImg || undefined,
            },
            policy
          )
          onSuccess(res)
        } else {
          onSuccess(updatedType)
        }
      } else {
        const dims = (lengthM && widthM && heightM)
          ? `${lengthM}m x ${widthM}m x ${heightM}m`
          : `${calcArea}m²`
        const createPayload = {
          typeName: typeName.trim(),
          dimensions: dims,
          areaSqm: calcArea,
          volumeM3: volumeM3 !== '' ? Number(volumeM3) : Math.round(calcArea * Number(heightM || 2.5) * 100) / 100,
          lengthM: lengthM !== '' ? Number(lengthM) : undefined,
          widthM: widthM !== '' ? Number(widthM) : undefined,
          heightM: heightM !== '' ? Number(heightM) : 2.5,
          depositAmount: Number(basePrice),
          basePricePerMonth: Number(basePrice),
          acPricePerMonth: numAcPrice,
          isActive,
          imageUrl: imageUrl.trim() || undefined,
        }

        if (facilityId) {
          try {
            const createdBackend = await storageUnitService.createUnitType({
              ...createPayload,
              acPricePerMonth: numAcPrice ?? 0,
            })
            if (createdBackend?.id) {
              const res = await facilityUnitTypeService.saveFacilityUnitType(facilityId, createdBackend, policy)
              onSuccess(res)
              onClose()
              return
            }
          } catch (e) {
            console.warn('Backend unit type create fallback:', e)
          }
          const res = await facilityUnitTypeService.createFacilityUnitType(facilityId, createPayload, policy)
          onSuccess(res)
        } else {
          const created = await storageUnitService.createUnitType({
            ...createPayload,
            acPricePerMonth: numAcPrice ?? 0,
          })
          onSuccess(created)
        }
      }
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
              {unitType ? 'edit_note' : 'add_box'}
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {unitType ? t('Chỉnh sửa Loại Kho') : t('Thêm Loại Kho Mới')}
              </h3>
              {facilityName && (
                <p className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                  {t('Áp dụng cho cơ sở:')} <span className="font-bold">{facilityName}</span>
                </p>
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Mã định danh: <span className="font-mono font-medium text-cyan-600">{unitType?.id || 'Mới'}</span>
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
                  onClick={() => setIsActive((prev) => !prev)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    isActive
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 hover:bg-emerald-200'
                      : 'bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 hover:bg-rose-200'
                  }`}
                  title={t('Nhấn để chuyển đổi trạng thái (chỉ áp dụng sau khi nhấn Lưu thay đổi)')}
                >
                  <span className="material-symbols-outlined text-sm">
                    {isActive ? 'check_circle' : 'block'}
                  </span>
                  <span>{isActive ? t('Hoạt động') : t('Tạm ngưng')}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Upload ảnh mô phỏng loại kho */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-cyan-600 text-[18px]">image</span>
                <span>{t('Ảnh mô phỏng loại kho (Hiển thị ở bước 2 đặt kho)')}</span>
              </div>
              <div className="flex items-center gap-2">
                {unitType?.imageUrl && imageUrl !== unitType.imageUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setImageUrl(unitType.imageUrl || '')
                      setLocalPreviewUrl('')
                      setImageLoadError(false)
                      setImageUploadSuccessMsg(null)
                      setShowRemoveImageConfirm(false)
                    }}
                    className="text-[11px] text-cyan-600 hover:text-cyan-700 font-semibold flex items-center gap-0.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px]">undo</span>
                    <span>{t('Khôi phục ảnh đã lưu')}</span>
                  </button>
                )}
                {(imageUrl || localPreviewUrl) && !showRemoveImageConfirm && (
                  <button
                    type="button"
                    onClick={() => setShowRemoveImageConfirm(true)}
                    className="text-[11px] text-rose-600 hover:text-rose-700 font-medium flex items-center gap-0.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px]">delete</span>
                    <span>{t('Gỡ ảnh')}</span>
                  </button>
                )}
              </div>
            </div>

            {showRemoveImageConfirm && (
              <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center justify-between gap-2 text-xs">
                <span className="text-rose-800 dark:text-rose-200 font-medium">
                  Bạn có chắc muốn gỡ ảnh mô phỏng của loại kho này?
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowRemoveImageConfirm(false)}
                    className="px-2.5 py-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-semibold cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setImageUrl('')
                      setLocalPreviewUrl('')
                      setImageLoadError(false)
                      setImageUploadSuccessMsg(null)
                      setShowRemoveImageConfirm(false)
                    }}
                    className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold cursor-pointer"
                  >
                    Xác nhận gỡ ảnh
                  </button>
                </div>
              </div>
            )}

            {imageUploadSuccessMsg && (
              <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-[11px] text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px] text-emerald-600">check_circle</span>
                <span>{imageUploadSuccessMsg}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-3">
              {/* Preview Thumbnail */}
              <div className="w-full sm:w-36 h-24 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden flex items-center justify-center shrink-0 relative group">
                {(localPreviewUrl || imageUrl) && !imageLoadError ? (
                  <img
                    src={localPreviewUrl || resolveUnitImageUrl(imageUrl)}
                    alt={typeName || 'Ảnh mô phỏng kho'}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.currentTarget
                      if (!target.src.includes('localhost:8080') && imageUrl?.startsWith('/uploads')) {
                        target.src = `http://localhost:8080${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`
                      } else {
                        setImageLoadError(true)
                      }
                    }}
                  />
                ) : (localPreviewUrl || imageUrl) && imageLoadError ? (
                  <div className="flex flex-col items-center justify-center text-amber-500 p-2 text-center">
                    <span className="material-symbols-outlined text-2xl">broken_image</span>
                    <span className="text-[10px] mt-0.5">Ảnh lỗi hiển thị</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-400 p-2 text-center">
                    <span className="material-symbols-outlined text-2xl text-slate-300">hide_image</span>
                    <span className="text-[10px] mt-0.5">Chưa có ảnh</span>
                  </div>
                )}
                {isUploadingImage && (
                  <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center text-white text-[11px] font-bold">
                    <span className="animate-spin material-symbols-outlined text-lg mr-1">progress_activity</span>
                    Đang lưu...
                  </div>
                )}
              </div>

              {/* Upload controls */}
              <div className="flex-1 w-full space-y-1.5 text-left">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-semibold cursor-pointer transition shadow-xs">
                  <span className="material-symbols-outlined text-[16px]">upload_file</span>
                  <span>{(imageUrl || localPreviewUrl) ? t('Thay ảnh khác') : t('Tải ảnh mô phỏng lên')}</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/jpg,image/gif"
                    onChange={handleImageFileChange}
                    className="hidden"
                    disabled={isUploadingImage}
                  />
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Hỗ trợ định dạng PNG, JPG, WEBP, GIF tối đa 10MB. Ảnh này sẽ được tự động kế thừa khi tạo buồng kho và xuất hiện trực quan cho khách hàng ở bước 2 chọn kho.
                </p>
                {imageUrl && (
                  <div className="text-[10px] text-slate-400 font-mono truncate max-w-sm">
                    URL: {imageUrl}
                  </div>
                )}
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

            {/* Auto metrics: Area & Volume (Sức chứa đã loại bỏ hoàn toàn theo yêu cầu) */}
            <div className="grid grid-cols-2 gap-3 pt-1">
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
                onChange={(e) => setBasePrice(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="VD: 4500000"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold text-slate-800 dark:text-slate-100"
                required
              />
              <p className="text-[10px] text-slate-400">
                {typeof basePrice === 'number' ? basePrice.toLocaleString('vi-VN') + ' đ' : ''}
              </p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t('Giá Máy lạnh / tháng (VNĐ)')}{' '}
              </label>
              <input
                type="number"
                step="10000"
                min="0"
                value={acPrice}
                onChange={(e) => setAcPrice(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="VD: 5400000 (Để trống nếu kho không hỗ trợ A/C)"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold text-teal-700 dark:text-teal-400"
              />
              <p className="text-[10px] text-slate-400">
                {typeof acPrice === 'number' && acPrice > 0
                  ? acPrice.toLocaleString('vi-VN') + ' đ'
                  : t('Kho này không có máy lạnh A/C (sẽ ẩn tùy chọn A/C khi khách đặt kho)')}
              </p>
            </div>
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
                  <span>{unitType ? t('Lưu thay đổi') : t('Tạo loại kho')}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
