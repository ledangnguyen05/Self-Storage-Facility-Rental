import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { Facility, StorageUnit, UnitType } from '../../../types'
import { storageUnitService } from '../../../services/storageUnitService'
import { useLanguage } from '../../../context/LanguageContext'
import { parseFacilityFloorPlanConfig } from '../../../utils/facilityLayout'

interface CreateStorageUnitModalProps {
  isOpen: boolean
  facilities: Facility[]
  selectedFacilityId: string
  onClose: () => void
  onCreated: (unit: StorageUnit) => void
}

const fieldClassName =
  'mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 font-medium'

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
  const { role, user } = useAuth()
  const { language, t } = useLanguage()

  const [unitTypes, setUnitTypes] = useState<UnitType[]>([])
  const [isLoadingTypes, setIsLoadingTypes] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form states
  const [unitCode, setUnitCode] = useState('')
  const [unitTypeId, setUnitTypeId] = useState('')
  const [selectedFloorName, setSelectedFloorName] = useState('')
  const [selectedZoneCode, setSelectedZoneCode] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  // Resolve assigned facility: FM only manages assigned facility
  const effectiveFacilityId = user?.facilityId || selectedFacilityId || facilities[0]?.id || ''
  const currentFacility = useMemo(() => {
    return facilities.find((f) => f.id === effectiveFacilityId) || facilities[0] || null
  }, [facilities, effectiveFacilityId])

  // Parse Floor Plan / Layout Config dynamically
  const floorPlanConfig = useMemo(() => {
    return parseFacilityFloorPlanConfig(currentFacility?.layoutConfig)
  }, [currentFacility?.layoutConfig])

  // Only ACTIVE floors (Task 6.2)
  const activeFloors = useMemo(() => {
    if (!floorPlanConfig?.floors || floorPlanConfig.floors.length === 0) return []
    return floorPlanConfig.floors.filter((fl) => fl.status === 'ACTIVE' || !fl.status)
  }, [floorPlanConfig])

  // Matched Floor object
  const currentFloorObj = useMemo(() => {
    if (activeFloors.length === 0) return null
    return (
      activeFloors.find(
        (f) => f.name === selectedFloorName || f.code === selectedFloorName
      ) || activeFloors[0]
    )
  }, [activeFloors, selectedFloorName])

  // Only ACTIVE STORAGE ZONES (Task 6.2: Exclude functional areas like loading bay, restroom, office)
  const activeStorageZones = useMemo(() => {
    if (!currentFloorObj?.zones || currentFloorObj.zones.length === 0) return []
    return currentFloorObj.zones.filter((zn) => zn.status === 'ACTIVE' || !zn.status)
  }, [currentFloorObj])

  // Matched Zone object
  const currentZoneObj = useMemo(() => {
    if (activeStorageZones.length === 0) return null
    return (
      activeStorageZones.find(
        (z) => z.code === selectedZoneCode || z.id === selectedZoneCode
      ) || activeStorageZones[0]
    )
  }, [activeStorageZones, selectedZoneCode])

  const selectedType = useMemo(
    () => unitTypes.find((ut) => ut.id === unitTypeId),
    [unitTypes, unitTypeId]
  )

  useEffect(() => {
    if (!isOpen) return

    setUnitCode('')
    setErrorMessage('')
    setIsLoadingTypes(true)

    // Set initial floor
    if (activeFloors.length > 0) {
      const firstFl = activeFloors[0]
      setSelectedFloorName(firstFl.name || firstFl.code)
    }

    // Load active unit types
    storageUnitService
      .getUnitTypes()
      .then((types) => {
        const availableTypes = Array.isArray(types)
          ? types.filter((ut) => ut.isActive !== false) // Only show active unit types for new creation
          : []
        setUnitTypes(availableTypes)
        if (availableTypes.length > 0) {
          setUnitTypeId(availableTypes[0].id)
        }
      })
      .catch((error) => {
        setUnitTypes([])
        setErrorMessage(
          getErrorMessage(error, t('Không thể tải danh sách loại kho.', 'Could not load storage types.'))
        )
      })
      .finally(() => setIsLoadingTypes(false))
  }, [isOpen, activeFloors.length])

  // Sync selected zone code when floor changes
  useEffect(() => {
    if (activeStorageZones.length > 0) {
      const match = activeStorageZones.find(
        (z) => z.code === selectedZoneCode || z.id === selectedZoneCode
      )
      if (!match) {
        setSelectedZoneCode(activeStorageZones[0].code || activeStorageZones[0].id)
      }
    } else {
      setSelectedZoneCode('')
    }
  }, [currentFloorObj, activeStorageZones])

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

    if (!effectiveFacilityId) {
      setErrorMessage(
        t('Chưa xác định cơ sở để thêm kho.', 'No facility is available for this storage unit.')
      )
      return
    }

    if (!unitTypeId) {
      setErrorMessage(t('Vui lòng chọn loại kho.', 'Select a storage type.'))
      return
    }

    if (activeFloors.length === 0) {
      setErrorMessage(
        t(
          'Cơ sở chưa có tầng hoạt động (ACTIVE). Vui lòng cấu hình Sơ đồ mặt bằng trước.',
          'Facility has no active floors in Floor Plan.'
        )
      )
      return
    }

    if (activeStorageZones.length === 0) {
      setErrorMessage(
        t(
          'Tầng đã chọn chưa có phân khu lưu trữ hoạt động. Vui lòng thêm phân khu kho trong Sơ đồ mặt bằng.',
          'Selected floor has no active storage zones.'
        )
      )
      return
    }

    setIsSubmitting(true)
    try {
      const createdUnit = await storageUnitService.createUnit({
        unitCode: trimmedCode,
        floorLevel: currentFloorObj?.name || selectedFloorName,
        zoneCode: currentZoneObj?.code || selectedZoneCode,
        zoneName: currentZoneObj?.name,
        facilityId: effectiveFacilityId,
        unitTypeId,
        // Custom monthly price input removed per Task 6.2; price is resolved by backend from catalog/policy
      })
      onCreated(createdUnit)
      onClose()
    } catch (error) {
      setErrorMessage(
        getErrorMessage(
          error,
          t('Không thể thêm kho. Vui lòng thử lại.', 'Could not add the storage unit. Please try again.')
        )
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  const formatVnd = (amount: number) =>
    new Intl.NumberFormat(language === 'vi' ? 'vi-VN' : 'en-US', {
      maximumFractionDigits: 0,
    }).format(amount) + (language === 'vi' ? ' ₫' : ' VND')

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close()
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-storage-unit-title"
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 animate-scale-in"
      >
        {/* Header */}
        <header className="flex items-start justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined rounded-xl bg-blue-50 p-2 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              warehouse
            </span>
            <div>
              <h2
                id="create-storage-unit-title"
                className="text-base font-bold text-slate-900 dark:text-slate-100"
              >
                {t('Thêm ngăn kho mới', 'Add a storage unit')}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t(
                  'Khởi tạo ngăn kho vật lý gắn với Tầng & Phân khu trên Sơ đồ mặt bằng cơ sở.',
                  'Create a storage unit attached to Floor & Zone in the facility floor plan.'
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            disabled={isSubmitting}
            aria-label={t('Đóng', 'Close')}
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {errorMessage && (
            <div
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200 flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-rose-600 shrink-0">error</span>
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Task 6.2: Read-only Facility Badge */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t('Cơ sở lưu trữ')}
            </label>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-blue-50/70 border border-blue-200 text-blue-900 text-xs font-bold dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-200">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-blue-600">store</span>
                <span>{currentFacility?.name || user?.facilityName || 'Cơ sở hiện tại'}</span>
              </div>
              <span className="text-[10px] bg-blue-200/80 dark:bg-blue-900 text-blue-800 dark:text-blue-200 font-mono px-2 py-0.5 rounded">
                {currentFacility?.code || 'ACTIVE'}
              </span>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Unit Code */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t('Mã buồng kho', 'Storage unit code')} <span className="text-rose-600">*</span>
              </label>
              <input
                autoFocus
                required
                maxLength={40}
                value={unitCode}
                onChange={(event) => setUnitCode(event.target.value)}
                placeholder={t('Ví dụ: TB-A-101', 'Example: TB-A-101')}
                className={fieldClassName}
              />
            </div>

            {/* Storage Type */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t('Loại kho', 'Storage type')} <span className="text-rose-600">*</span>
              </label>
              <select
                required
                value={unitTypeId}
                onChange={(event) => setUnitTypeId(event.target.value)}
                disabled={isLoadingTypes || unitTypes.length === 0}
                className={fieldClassName}
              >
                <option value="">
                  {isLoadingTypes
                    ? t('Đang tải loại kho...', 'Loading storage types...')
                    : t('Chọn loại kho', 'Select a storage type')}
                </option>
                {unitTypes.map((unitType) => (
                  <option key={unitType.id} value={unitType.id}>
                    {unitType.typeName} ({unitType.dimensions})
                  </option>
                ))}
              </select>
            </div>

            {/* Dynamic Floor Selector (Task 6.2: only ACTIVE floors) */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t('Tầng', 'Floor')} <span className="text-rose-600">*</span>
              </label>
              {activeFloors.length > 0 ? (
                <select
                  required
                  value={selectedFloorName}
                  onChange={(event) => setSelectedFloorName(event.target.value)}
                  className={fieldClassName}
                >
                  {activeFloors.map((fl) => (
                    <option key={fl.id || fl.code} value={fl.name || fl.code}>
                      {fl.name} ({fl.code})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="p-2 rounded border border-amber-300 bg-amber-50 text-[11px] text-amber-800">
                  {t('Chưa có tầng hoạt động. Vui lòng tạo tầng trong Sơ đồ mặt bằng.')}
                </div>
              )}
            </div>

            {/* Dynamic Storage Zone Selector (Task 6.2: only ACTIVE STORAGE zones, NO functional areas) */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t('Phân khu lưu trữ', 'Storage Zone')} <span className="text-rose-600">*</span>
              </label>
              {activeStorageZones.length > 0 ? (
                <select
                  required
                  value={selectedZoneCode}
                  onChange={(event) => setSelectedZoneCode(event.target.value)}
                  className={fieldClassName}
                >
                  {activeStorageZones.map((zn) => (
                    <option key={zn.id || zn.code} value={zn.code || zn.id}>
                      {zn.name} ({zn.code})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="p-2 rounded border border-amber-300 bg-amber-50 text-[11px] text-amber-800">
                  {t('Tầng này chưa có phân khu kho hoạt động. Vui lòng thêm trong Sơ đồ mặt bằng.')}
                </div>
              )}
            </div>
          </div>

          {/* Selected Type Specs & Standard Pricing Preview */}
          {selectedType && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300 space-y-1.5 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-cyan-600 text-[16px]">
                    inventory_2
                  </span>
                  {selectedType.typeName}
                </span>
                <span className="font-mono text-slate-600 dark:text-slate-300">
                  {selectedType.areaSqm} m² · {selectedType.dimensions}
                </span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700/60 text-[11px]">
                <span className="text-slate-500">
                  {t('Giá niêm yết chuẩn cơ sở:')}
                </span>
                <span className="font-mono font-bold text-cyan-700 dark:text-cyan-400">
                  {formatVnd(selectedType.basePricePerMonth)} / tháng
                </span>
              </div>
            </div>
          )}

          {/* Footer actions */}
          <footer className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end dark:border-slate-800">
            <button
              type="button"
              onClick={close}
              disabled={isSubmitting}
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {t('Hủy', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={
                isSubmitting ||
                isLoadingTypes ||
                !effectiveFacilityId ||
                unitTypes.length === 0 ||
                activeFloors.length === 0 ||
                activeStorageZones.length === 0
              }
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 shadow-xs"
            >
              {isSubmitting && (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              )}
              {isSubmitting ? t('Đang lưu...', 'Saving...') : t('Tạo ngăn kho', 'Add unit')}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}
