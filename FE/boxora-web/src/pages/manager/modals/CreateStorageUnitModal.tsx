import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { Facility, StorageUnit, UnitType } from '../../../types'
import { storageUnitService } from '../../../services/storageUnitService'
import { useLanguage } from '../../../context/LanguageContext'

interface CreateStorageUnitModalProps {
  isOpen: boolean
  facilities: Facility[]
  selectedFacilityId: string
  onClose: () => void
  onCreated: (unit: StorageUnit) => void
}

const fieldClassName = 'mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'

const getErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response
    if (response?.data?.message) return response.data.message
  }
  return error instanceof Error ? error.message : fallback
}

export const CreateStorageUnitModal: React.FC<CreateStorageUnitModalProps> = ({
  isOpen,
  facilities,
  selectedFacilityId,
  onClose,
  onCreated,
}) => {
  const { role } = useAuth()
  const { language, t } = useLanguage()
  const [unitTypes, setUnitTypes] = useState<UnitType[]>([])
  const [isLoadingTypes, setIsLoadingTypes] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [unitCode, setUnitCode] = useState('')
  const [facilityId, setFacilityId] = useState(selectedFacilityId)
  const [unitTypeId, setUnitTypeId] = useState('')
  const [floorLevel, setFloorLevel] = useState('Tầng 1')
  const [pricePerMonth, setPricePerMonth] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const selectedType = useMemo(
    () => unitTypes.find(unitType => unitType.id === unitTypeId),
    [unitTypes, unitTypeId]
  )
  const availableFacilities = useMemo(
    () => role === 'FACILITY_MANAGER'
      ? facilities.filter(facility => facility.id === selectedFacilityId)
      : facilities,
    [facilities, role, selectedFacilityId]
  )

  useEffect(() => {
    if (!isOpen) return

    setUnitCode('')
    setUnitTypeId('')
    setFloorLevel('Tầng 1')
    setPricePerMonth('')
    setErrorMessage('')
    setFacilityId(selectedFacilityId || availableFacilities[0]?.id || '')
    setIsLoadingTypes(true)

    storageUnitService.getUnitTypes()
      .then(types => {
        const availableTypes = Array.isArray(types) ? types : []
        setUnitTypes(availableTypes)
        setUnitTypeId(availableTypes[0]?.id || '')
      })
      .catch(error => {
        setUnitTypes([])
        setErrorMessage(getErrorMessage(error, t('Không thể tải danh sách loại kho.', 'Could not load storage types.')))
      })
      .finally(() => setIsLoadingTypes(false))
  }, [isOpen])

  useEffect(() => {
    if (isOpen && !facilityId && availableFacilities.length > 0) {
      setFacilityId(selectedFacilityId || availableFacilities[0].id)
    }
  }, [isOpen, facilityId, availableFacilities, selectedFacilityId])

  const close = () => {
    if (!isSubmitting) onClose()
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage('')

    const trimmedCode = unitCode.trim()
    if (!trimmedCode) {
      setErrorMessage(t('Vui lòng nhập mã kho.', 'Enter a storage unit code.'))
      return
    }
    if (!facilityId) {
      setErrorMessage(t('Chưa có cơ sở để thêm kho.', 'No facility is available for this storage unit.'))
      return
    }
    if (!unitTypeId) {
      setErrorMessage(t('Vui lòng chọn loại kho.', 'Select a storage type.'))
      return
    }

    const customPrice = pricePerMonth.trim() ? Number(pricePerMonth) : undefined
    if (customPrice !== undefined && (!Number.isFinite(customPrice) || customPrice <= 0)) {
      setErrorMessage(t('Giá thuê phải lớn hơn 0.', 'Monthly rent must be greater than 0.'))
      return
    }

    setIsSubmitting(true)
    try {
      const createdUnit = await storageUnitService.createUnit({
        unitCode: trimmedCode,
        floorLevel,
        facilityId,
        unitTypeId,
        ...(customPrice !== undefined ? { pricePerMonth: customPrice } : {}),
      })
      onCreated(createdUnit)
      onClose()
    } catch (error) {
      setErrorMessage(getErrorMessage(error, t('Không thể thêm kho. Vui lòng thử lại.', 'Could not add the storage unit. Please try again.')))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  const formatVnd = (amount: number) => new Intl.NumberFormat(language === 'vi' ? 'vi-VN' : 'en-US', {
    maximumFractionDigits: 0,
  }).format(amount) + (language === 'vi' ? ' ₫' : ' VND')

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      onMouseDown={event => {
        if (event.target === event.currentTarget) close()
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-storage-unit-title"
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        <header className="flex items-start justify-between border-b border-slate-200 px-6 py-5 dark:border-slate-700">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined rounded-xl bg-blue-50 p-2 text-blue-700 dark:bg-blue-950 dark:text-blue-300">warehouse</span>
            <div>
              <h2 id="create-storage-unit-title" className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {t('Thêm kho mới', 'Add a storage unit')}
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {t('Nhập thông tin kho để đưa vào danh sách của cơ sở.', 'Enter the unit details to add it to a facility.')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            disabled={isSubmitting}
            aria-label={t('Đóng', 'Close')}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {errorMessage && (
            <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200">
              {errorMessage}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t('Mã kho', 'Storage unit code')} <span className="text-rose-600">*</span>
              <input
                autoFocus
                required
                maxLength={40}
                value={unitCode}
                onChange={event => setUnitCode(event.target.value)}
                placeholder={t('Ví dụ: A-101', 'Example: A-101')}
                className={fieldClassName}
              />
            </label>

            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t('Cơ sở', 'Facility')} <span className="text-rose-600">*</span>
              <select
                required
                value={facilityId}
                onChange={event => setFacilityId(event.target.value)}
                className={fieldClassName}
              >
                <option value="" disabled>{t('Chọn cơ sở', 'Select a facility')}</option>
                {availableFacilities.map(facility => (
                  <option key={facility.id} value={facility.id}>{facility.name}</option>
                ))}
              </select>
            </label>

            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t('Loại kho', 'Storage type')} <span className="text-rose-600">*</span>
              <select
                required
                value={unitTypeId}
                onChange={event => setUnitTypeId(event.target.value)}
                disabled={isLoadingTypes || unitTypes.length === 0}
                className={fieldClassName}
              >
                <option value="">
                  {isLoadingTypes
                    ? t('Đang tải loại kho...', 'Loading storage types...')
                    : t('Chọn loại kho', 'Select a storage type')}
                </option>
                {unitTypes.map(unitType => (
                  <option key={unitType.id} value={unitType.id}>{unitType.typeName}</option>
                ))}
              </select>
            </label>

            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t('Tầng', 'Floor')} <span className="text-rose-600">*</span>
              <select
                required
                value={floorLevel}
                onChange={event => setFloorLevel(event.target.value)}
                className={fieldClassName}
              >
                <option value="Tầng 1">{t('Tầng 1', 'Floor 1')}</option>
                <option value="Tầng 2">{t('Tầng 2', 'Floor 2')}</option>
              </select>
            </label>
          </div>

          {selectedType && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-slate-800 dark:text-slate-100">{selectedType.typeName}</span>
                <span>{selectedType.areaSqm} m² · {selectedType.dimensions}</span>
              </div>
              <p className="mt-1">{t('Giá chuẩn theo tháng:', 'Standard monthly price:')} <strong>{formatVnd(selectedType.basePricePerMonth)}</strong></p>
            </div>
          )}

          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            {t('Giá thuê riêng theo tháng (₫, không bắt buộc)', 'Custom monthly rent (VND, optional)')}
            <input
              type="number"
              min="1"
              step="1000"
              value={pricePerMonth}
              onChange={event => setPricePerMonth(event.target.value)}
              placeholder={selectedType ? String(selectedType.basePricePerMonth) : t('Để trống để dùng giá chuẩn', 'Leave blank to use the standard price')}
              className={fieldClassName}
            />
            <span className="mt-1 block font-normal text-slate-500 dark:text-slate-400">
              {t('Để trống nếu áp dụng giá chuẩn của loại kho đã chọn.', 'Leave blank to use the selected storage type’s standard price.')}
            </span>
          </label>

          {!isLoadingTypes && unitTypes.length === 0 && !errorMessage && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              {t('Hiện chưa có loại kho để lựa chọn.', 'There are no storage types available to choose from.')}
            </p>
          )}

          <footer className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end dark:border-slate-800">
            <button
              type="button"
              onClick={close}
              disabled={isSubmitting}
              className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {t('Hủy', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isLoadingTypes || !facilityId || !unitTypes.length}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
              {isSubmitting ? t('Đang lưu...', 'Saving...') : t('Thêm kho', 'Add unit')}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}
