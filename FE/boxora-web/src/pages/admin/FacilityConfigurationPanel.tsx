import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { facilityService } from '../../services/facilityService'
import {
  geocodeAddress,
  autocompleteAddress,
  getGeocodingErrorMessage,
  GeocodingSource,
  GeocodingSuggestion,
} from '../../services/nominatimGeocodingService'
import { VIETNAM_PROVINCES, getProvinceShortCode } from '../../constants/vietnamProvinces'
import {
  Facility,
  FacilityFloorConfig,
  FacilityLayoutConfig,
  FacilityPolicy,
  FloorFunctionalZone,
  FloorOperationPoint,
} from '../../types'
import {
  DEFAULT_FACILITY_LAYOUT_CONFIG,
  createDefaultFloor,
  parseFacilityLayoutConfig,
  syncLegacyLayoutFields,
} from '../../utils/facilityLayout'
import { FacilityPolicyViewModal } from '../manager/modals/FacilityPolicyViewModal'
import { FacilityOperatingPoliciesPanel } from './FacilityOperatingPoliciesPanel'
import { DynamicPricingMatrixPanel } from './DynamicPricingMatrixPanel'
import { LocationPickerMap } from '../../components/map/LocationPickerMap'

interface FacilityConfigurationPanelProps {
  facilities: Facility[]
  onFacilitiesChange: (facilities: Facility[]) => void
}

interface FacilityDraft {
  name: string
  code: string
  address: string
  city: string
  contactPhone: string
  email: string
  description: string
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE'
  latitude: string
  longitude: string
  geoSource: GeocodingSource
  geoConfidenceNote?: string
  layout: FacilityLayoutConfig
}

const blankDraft = (): FacilityDraft => ({
  name: '',
  code: '',
  address: '',
  city: 'TP. Hồ Chí Minh',
  contactPhone: '',
  email: '',
  description: '',
  status: 'ACTIVE',
  latitude: '',
  longitude: '',
  geoSource: 'UNVERIFIED',
  geoConfidenceNote: '',
  layout: { ...DEFAULT_FACILITY_LAYOUT_CONFIG },
})

const inputClassName =
  'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/15 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 placeholder:text-slate-400'

const toDraft = (facility: Facility): FacilityDraft => ({
  name: facility.name || '',
  code: facility.code || '',
  address: facility.address || '',
  city: facility.city || 'TP. Hồ Chí Minh',
  contactPhone: facility.contactPhone || '',
  email: facility.email || '',
  description: facility.description || '',
  status: facility.status === 'INACTIVE' || facility.status === 'MAINTENANCE' ? facility.status : 'ACTIVE',
  latitude: facility.latitude == null ? '' : String(facility.latitude),
  longitude: facility.longitude == null ? '' : String(facility.longitude),
  geoSource: facility.latitude != null && facility.longitude != null ? 'EXACT' : 'UNVERIFIED',
  geoConfidenceNote: facility.latitude != null && facility.longitude != null ? 'Tọa độ đã xác lập' : '',
  layout: parseFacilityLayoutConfig(facility.layoutConfig),
})

const getRequestError = (error: unknown) => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response
    if (response?.data?.message) return response.data.message
  }
  return error instanceof Error ? error.message : 'Không thể lưu thông tin chi nhánh.'
}

export const FacilityConfigurationPanel: React.FC<FacilityConfigurationPanelProps> = ({
  facilities,
  onFacilitiesChange,
}) => {
  const { role } = useAuth()
  const canManage = role === 'BUSINESS_MANAGER'
  const { t } = useLanguage()
  const [searchParams, setSearchParams] = useSearchParams()
  const subtabParam = searchParams.get('subtab')

  const [configTab, setConfigTab] = useState<'branches' | 'policies' | 'pricing'>(() => {
    if (subtabParam === 'policies' || subtabParam === 'operating-policies') return 'policies'
    if (subtabParam === 'pricing' || subtabParam === 'pricing-matrix') return 'pricing'
    return 'branches'
  })

  useEffect(() => {
    if (subtabParam === 'policies' || subtabParam === 'operating-policies') {
      setConfigTab('policies')
    } else if (subtabParam === 'pricing' || subtabParam === 'pricing-matrix') {
      setConfigTab('pricing')
    } else {
      setConfigTab('branches')
    }
  }, [subtabParam])

  const handleTabChange = (newTab: 'branches' | 'policies' | 'pricing') => {
    setConfigTab(newTab)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (newTab === 'branches') {
        next.delete('subtab')
      } else {
        next.set('subtab', newTab)
      }
      return next
    })
  }

  // Form & Wizard state
  const [editingFacility, setEditingFacility] = useState<Facility | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(1)
  const [draft, setDraft] = useState<FacilityDraft>(blankDraft)
  const [selectedFloorIndex, setSelectedFloorIndex] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [isGeocoding, setIsGeocoding] = useState(false)
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')

  // Autocomplete state for Address
  const [suggestions, setSuggestions] = useState<GeocodingSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isSearchingSuggestions, setIsSearchingSuggestions] = useState(false)
  const autocompleteTimeoutRef = useRef<number | null>(null)

  // Policy view state for branch cards
  const [expandedPolicyFacilityId, setExpandedPolicyFacilityId] = useState<string | null>(null)
  const [facilityPoliciesMap, setFacilityPoliciesMap] = useState<Record<string, FacilityPolicy>>({})
  const [facilityPolicyErrors, setFacilityPolicyErrors] = useState<Record<string, 'missing' | 'error'>>({})
  const [loadingPolicyFacilityId, setLoadingPolicyFacilityId] = useState<string | null>(null)
  const [modalPolicyFacility, setModalPolicyFacility] = useState<Facility | null>(null)

  const togglePolicy = async (facility: Facility) => {
    if (expandedPolicyFacilityId === facility.id) {
      setExpandedPolicyFacilityId(null)
      return
    }
    setExpandedPolicyFacilityId(facility.id)
    if (!facilityPoliciesMap[facility.id]) {
      setLoadingPolicyFacilityId(facility.id)
      setFacilityPolicyErrors((previous) => {
        const next = { ...previous }
        delete next[facility.id]
        return next
      })
      try {
        const pol = await facilityService.getPolicyByFacilityId(facility.id)
        if (pol) {
          setFacilityPoliciesMap((prev) => ({ ...prev, [facility.id]: pol }))
        } else {
          setFacilityPolicyErrors((previous) => ({ ...previous, [facility.id]: 'missing' }))
        }
      } catch (error: unknown) {
        const status =
          typeof error === 'object' && error !== null && 'response' in error
            ? (error as { response?: { status?: number } }).response?.status
            : undefined
        setFacilityPolicyErrors((previous) => ({
          ...previous,
          [facility.id]: status === 404 ? 'missing' : 'error',
        }))
      } finally {
        setLoadingPolicyFacilityId(null)
      }
    }
  }

  const refreshFacilities = async () => {
    const result = await facilityService.getFacilities({ size: 100 })
    const facilityList = Array.isArray(result?.content) ? result.content : []
    onFacilitiesChange(facilityList)
  }

  const startCreate = () => {
    setEditingFacility(null)
    setDraft(blankDraft())
    setSelectedFloorIndex(0)
    setActiveStep(1)
    setFormError('')
    setNotice('')
    setSuggestions([])
    setShowSuggestions(false)
    setIsFormOpen(true)
  }

  const startEdit = (facility: Facility) => {
    setEditingFacility(facility)
    setDraft(toDraft(facility))
    setSelectedFloorIndex(0)
    setActiveStep(1)
    setFormError('')
    setNotice('')
    setSuggestions([])
    setShowSuggestions(false)
    setIsFormOpen(true)
  }

  // Auto-generate unique branch code
  const handleAutoGenerateCode = () => {
    const cityCode = getProvinceShortCode(draft.city)
    const existingCodes = new Set(facilities.map((f) => (f.code || '').toUpperCase()))
    let counter = 1
    let candidate = `BX-${cityCode}-${String(counter).padStart(2, '0')}`
    while (existingCodes.has(candidate)) {
      counter += 1
      candidate = `BX-${cityCode}-${String(counter).padStart(2, '0')}`
    }
    setDraft((cur) => ({ ...cur, code: candidate }))
  }

  // Address input change with debounced autocomplete
  const handleAddressChange = (newAddress: string) => {
    setDraft((cur) => ({
      ...cur,
      address: newAddress,
      geoSource: 'UNVERIFIED',
    }))

    if (autocompleteTimeoutRef.current) {
      window.clearTimeout(autocompleteTimeoutRef.current)
    }

    if (newAddress.trim().length >= 3) {
      autocompleteTimeoutRef.current = window.setTimeout(async () => {
        setIsSearchingSuggestions(true)
        try {
          const items = await autocompleteAddress(newAddress, draft.city)
          setSuggestions(items)
          setShowSuggestions(items.length > 0)
        } catch {
          setSuggestions([])
        } finally {
          setIsSearchingSuggestions(false)
        }
      }, 350)
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }

  const handleSelectSuggestion = (suggestion: GeocodingSuggestion) => {
    setDraft((cur) => ({
      ...cur,
      address: suggestion.displayName,
      city: suggestion.city || cur.city,
      latitude: String(suggestion.lat),
      longitude: String(suggestion.lng),
      geoSource: 'EXACT',
      geoConfidenceNote: 'Được xác nhận qua gợi ý bản đồ',
    }))
    setShowSuggestions(false)
    setSuggestions([])
    setNotice(t('Đã tự động điền địa chỉ chuẩn hóa và tọa độ GPS.', 'Filled standardized address and GPS.'))
  }

  const lookupCoordinates = async () => {
    if (!draft.address.trim()) {
      setFormError(t('Nhập địa chỉ trước khi tìm tọa độ.', 'Enter an address before looking up coordinates.'))
      return
    }
    setIsGeocoding(true)
    setFormError('')
    setShowSuggestions(false)
    try {
      const result = await geocodeAddress(draft.address, draft.city)
      setDraft((current) => ({
        ...current,
        latitude: String(result.lat),
        longitude: String(result.lng),
        geoSource: result.source,
        geoConfidenceNote: result.confidence || (result.source === 'EXACT' ? 'Định vị chính xác' : 'Định vị theo trục đường'),
      }))
      setNotice(
        result.source === 'EXACT'
          ? t('Đã tìm thấy tọa độ chính xác cho địa chỉ này.', 'Exact coordinates found.')
          : t('Đã tìm thấy vị trí gần đúng theo trục đường.', 'Approximate street-level coordinates found.')
      )
    } catch (error) {
      setFormError(t(getGeocodingErrorMessage(error), 'Could not find coordinates. Check the address and try again.'))
    } finally {
      setIsGeocoding(false)
    }
  }

  const handleManualCoordinateChange = (field: 'latitude' | 'longitude', value: string) => {
    setDraft((cur) => ({
      ...cur,
      [field]: value,
      geoSource: 'MANUAL',
      geoConfidenceNote: 'Nhập tọa độ thủ công',
    }))
  }

  const floors = useMemo(() => draft.layout.floors || [], [draft.layout.floors])
  const activeFloor = floors[selectedFloorIndex] || floors[0]

  const updateLayoutTitle = (title: string) => {
    setDraft((cur) => ({
      ...cur,
      layout: {
        ...cur.layout,
        title,
      },
    }))
  }

  const handleAddFloor = () => {
    const nextNumber = floors.length + 1
    const newFloor = createDefaultFloor(nextNumber)
    const nextFloors = [...floors, newFloor]
    setDraft((cur) => ({
      ...cur,
      layout: {
        ...cur.layout,
        floors: nextFloors,
      },
    }))
    setSelectedFloorIndex(nextFloors.length - 1)
  }

  const handleRemoveFloor = (indexToRemove: number) => {
    if (floors.length <= 1) return
    const nextFloors = floors
      .filter((_, idx) => idx !== indexToRemove)
      .map((fl, idx) => ({ ...fl, floorNumber: idx + 1 }))

    setDraft((cur) => ({
      ...cur,
      layout: {
        ...cur.layout,
        floors: nextFloors,
      },
    }))
    setSelectedFloorIndex((prev) => Math.min(prev, Math.max(0, nextFloors.length - 1)))
  }

  const handleUpdateFloor = (index: number, updates: Partial<FacilityFloorConfig>) => {
    const nextFloors = floors.map((fl, idx) => (idx === index ? { ...fl, ...updates } : fl))
    setDraft((cur) => ({
      ...cur,
      layout: {
        ...cur.layout,
        floors: nextFloors,
      },
    }))
  }

  const handleAddOperationPoint = (floorIndex: number) => {
    const targetFloor = floors[floorIndex]
    if (!targetFloor) return
    const newPoint: FloorOperationPoint = {
      id: `op-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: 'Điểm vận hành mới',
    }
    const nextFloors = floors.map((fl, idx) =>
      idx === floorIndex ? { ...fl, operationPoints: [...fl.operationPoints, newPoint] } : fl
    )
    setDraft((cur) => ({
      ...cur,
      layout: {
        ...cur.layout,
        floors: nextFloors,
      },
    }))
  }

  const handleUpdateOperationPoint = (floorIndex: number, pointIndex: number, name: string) => {
    const nextFloors = floors.map((fl, fIdx) => {
      if (fIdx !== floorIndex) return fl
      const nextPoints = fl.operationPoints.map((op, pIdx) => (pIdx === pointIndex ? { ...op, name } : op))
      return { ...fl, operationPoints: nextPoints }
    })
    setDraft((cur) => ({
      ...cur,
      layout: {
        ...cur.layout,
        floors: nextFloors,
      },
    }))
  }

  const handleRemoveOperationPoint = (floorIndex: number, pointIndex: number) => {
    const nextFloors = floors.map((fl, fIdx) => {
      if (fIdx !== floorIndex) return fl
      return { ...fl, operationPoints: fl.operationPoints.filter((_, pIdx) => pIdx !== pointIndex) }
    })
    setDraft((cur) => ({
      ...cur,
      layout: {
        ...cur.layout,
        floors: nextFloors,
      },
    }))
  }

  const handleAddZone = (floorIndex: number) => {
    const targetFloor = floors[floorIndex]
    if (!targetFloor) return
    const nextCode = String.fromCharCode(65 + targetFloor.zones.length)
    const newZone: FloorFunctionalZone = {
      id: `zone-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      code: nextCode,
      name: `Khu lưu trữ ${nextCode}`,
    }
    const nextFloors = floors.map((fl, idx) =>
      idx === floorIndex ? { ...fl, zones: [...fl.zones, newZone] } : fl
    )
    setDraft((cur) => ({
      ...cur,
      layout: {
        ...cur.layout,
        floors: nextFloors,
      },
    }))
  }

  const handleUpdateZone = (floorIndex: number, zoneIndex: number, updates: Partial<FloorFunctionalZone>) => {
    const nextFloors = floors.map((fl, fIdx) => {
      if (fIdx !== floorIndex) return fl
      const nextZones = fl.zones.map((z, zIdx) => (zIdx === zoneIndex ? { ...z, ...updates } : z))
      return { ...fl, zones: nextZones }
    })
    setDraft((cur) => ({
      ...cur,
      layout: {
        ...cur.layout,
        floors: nextFloors,
      },
    }))
  }

  const handleRemoveZone = (floorIndex: number, zoneIndex: number) => {
    const nextFloors = floors.map((fl, fIdx) => {
      if (fIdx !== floorIndex) return fl
      return { ...fl, zones: fl.zones.filter((_, zIdx) => zIdx !== zoneIndex) }
    })
    setDraft((cur) => ({
      ...cur,
      layout: {
        ...cur.layout,
        floors: nextFloors,
      },
    }))
  }

  // Validate step transitions
  const validateStep = (step: number): boolean => {
    setFormError('')
    if (step === 1) {
      if (!draft.name.trim()) {
        setFormError(t('Vui lòng nhập tên chi nhánh (tối thiểu 2 ký tự).', 'Enter facility name.'))
        return false
      }
      if (!draft.code.trim()) {
        setFormError(t('Vui lòng nhập mã chi nhánh.', 'Enter facility code.'))
        return false
      }
      const existing = facilities.find(
        (f) => (f.code || '').toUpperCase() === draft.code.trim().toUpperCase() && f.id !== editingFacility?.id
      )
      if (existing) {
        setFormError(t(`Mã chi nhánh "${draft.code.trim().toUpperCase()}" đã tồn tại. Vui lòng chọn mã khác.`, 'Facility code exists.'))
        return false
      }
      if (draft.contactPhone.trim() && !/^[0-9+() -]{8,20}$/.test(draft.contactPhone.trim())) {
        setFormError(t('Số điện thoại liên hệ không đúng định dạng (8-20 ký tự số).', 'Invalid phone number format.'))
        return false
      }
      if (draft.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) {
        setFormError(t('Email không đúng định dạng.', 'Invalid email format.'))
        return false
      }
    } else if (step === 2) {
      if (!draft.address.trim()) {
        setFormError(t('Vui lòng nhập địa chỉ đầy đủ của chi nhánh.', 'Full address is required.'))
        return false
      }
      const lat = draft.latitude.trim() === '' ? null : Number(draft.latitude)
      const lng = draft.longitude.trim() === '' ? null : Number(draft.longitude)
      if ((lat === null) !== (lng === null)) {
        setFormError(t('Cần cung cấp cả vĩ độ và kinh độ, hoặc để trống cả hai.', 'Provide both latitude and longitude, or leave both empty.'))
        return false
      }
      if (lat !== null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) {
        setFormError(t('Vĩ độ (Latitude) phải nằm trong khoảng từ -90 đến 90.', 'Latitude must be between -90 and 90.'))
        return false
      }
      if (lng !== null && (!Number.isFinite(lng) || lng < -180 || lng > 180)) {
        setFormError(t('Kinh độ (Longitude) phải nằm trong khoảng từ -180 đến 180.', 'Longitude must be between -180 and 180.'))
        return false
      }
    } else if (step === 3) {
      const fls = draft.layout.floors || []
      if (fls.length === 0) {
        setFormError(t('Cần cấu hình ít nhất 1 tầng cho cơ sở.', 'At least 1 floor is required.'))
        return false
      }
      for (let i = 0; i < fls.length; i++) {
        const fl = fls[i]
        if (!fl.name || !fl.name.trim()) {
          setFormError(t(`Vui lòng nhập tên cho tầng thứ ${i + 1}.`, `Please enter a name for floor ${i + 1}.`))
          return false
        }
        if (fl.totalArea && fl.totalArea.trim()) {
          const areaNum = Number(fl.totalArea.trim())
          if (isNaN(areaNum) || areaNum <= 0) {
            setFormError(
              t(`Diện tích của "${fl.name}" phải là số dương (m²).`, `Area of "${fl.name}" must be a positive number.`)
            )
            return false
          }
        }
      }
    }
    return true
  }

  const handleNextStep = () => {
    if (validateStep(activeStep)) {
      setActiveStep((cur) => Math.min(4, cur + 1) as 1 | 2 | 3 | 4)
    }
  }

  const handlePrevStep = () => {
    setFormError('')
    setActiveStep((cur) => Math.max(1, cur - 1) as 1 | 2 | 3 | 4)
  }

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError('')
    setNotice('')

    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) {
      return
    }

    const latitude = draft.latitude.trim() === '' ? null : Number(draft.latitude)
    const longitude = draft.longitude.trim() === '' ? null : Number(draft.longitude)

    setIsSaving(true)
    try {
      const payload = {
        name: draft.name.trim(),
        code: draft.code.trim().toUpperCase(),
        address: draft.address.trim(),
        city: draft.city.trim(),
        contactPhone: draft.contactPhone.trim(),
        email: draft.email.trim(),
        description: draft.description.trim(),
        status: draft.status,
        latitude,
        longitude,
        layoutConfig: JSON.stringify(syncLegacyLayoutFields(draft.layout)),
        ...(editingFacility ? { clearCoordinates: latitude === null && longitude === null } : {}),
      }

      if (editingFacility) {
        await facilityService.updateFacility(editingFacility.id, payload)
      } else {
        await facilityService.createFacility(payload)
      }
      await refreshFacilities()
      setNotice(
        editingFacility
          ? t('Đã cập nhật cấu hình chi nhánh thành công.', 'Branch configuration updated.')
          : t('Đã tạo chi nhánh mới thành công.', 'New branch created.')
      )
      setIsFormOpen(false)
      setEditingFacility(null)
    } catch (error) {
      setFormError(getRequestError(error))
    } finally {
      setIsSaving(false)
    }
  }

  const hasCoordinates = draft.latitude.trim() !== '' && draft.longitude.trim() !== ''
  const latNum = Number(draft.latitude)
  const lngNum = Number(draft.longitude)

  return (
    <div className="space-y-6">
      {/* Sub-tab Navigation Bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
        <button
          type="button"
          onClick={() => handleTabChange('branches')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shadow-xs ${
            configTab === 'branches'
              ? 'bg-cyan-700 text-white shadow-cyan-700/20'
              : 'bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">domain</span>
          <span>{t('1. Thông tin & Mặt bằng chi nhánh')}</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('policies')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shadow-xs ${
            configTab === 'policies'
              ? 'bg-cyan-700 text-white shadow-cyan-700/20'
              : 'bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">policy</span>
          <span>{t('2. Chính Sách Vận Hành Cơ Sở')}</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('pricing')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shadow-xs ${
            configTab === 'pricing'
              ? 'bg-cyan-700 text-white shadow-cyan-700/20'
              : 'bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">tune</span>
          <span>{t('3. Quy Tắc Kinh Doanh & Giá Động')}</span>
        </button>
      </div>

      {configTab === 'branches' && (
        <div className="space-y-5">
          <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-slate-700 dark:bg-slate-900">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {t('Cấu hình chi nhánh & cơ sở', 'Branch configuration')}
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {t(
                  'Quản lý thông tin chi nhánh, chuẩn hóa địa chỉ, vị trí GPS và cấu hình phân khu sơ đồ mặt bằng.',
                  'Manage branch details, address normalization, GPS coordinates, and floor layout zones.'
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canManage && (
                <button
                  type="button"
                  onClick={startCreate}
                  className="inline-flex items-center gap-2 rounded-xl bg-cyan-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-cyan-800 cursor-pointer shadow-sm shadow-cyan-700/20 transition-all active:scale-95"
                >
                  <span className="material-symbols-outlined text-[18px]">add_business</span>
                  {t('Thêm chi nhánh mới', 'Add new branch')}
                </button>
              )}
            </div>
          </section>

          {notice && (
            <div
              role="status"
              className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200 animate-in fade-in"
            >
              <span className="material-symbols-outlined text-[18px] text-emerald-600">check_circle</span>
              <span>{notice}</span>
            </div>
          )}

          {/* MULTI-SECTION BRANCH CONFIGURATION MODAL / PANEL */}
          {canManage && isFormOpen && (
            <section className="rounded-2xl border border-cyan-200 bg-white p-6 shadow-md dark:border-cyan-900 dark:bg-slate-900">
              <header className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
                <div>
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-cyan-50 px-3 py-1 text-xs font-bold text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300">
                    <span className="material-symbols-outlined text-[15px]">settings</span>
                    <span>{editingFacility ? t('Cập nhật cơ sở', 'Edit Facility') : t('Thiết lập cơ sở mới', 'New Facility Wizard')}</span>
                  </div>
                  <h3 className="mt-2 text-lg font-bold text-slate-900 dark:text-slate-100">
                    {editingFacility ? `${t('Chỉnh sửa chi nhánh', 'Edit Branch')}: ${editingFacility.name}` : t('Quy trình cấu hình chi nhánh Boxora', 'Boxora Branch Configuration')}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {t(
                      'Hoàn tất 4 bước để đảm bảo thông tin chi nhánh, tọa độ địa lý và sơ đồ vận hành chuẩn xác trước khi lưu.',
                      'Complete all 4 sections to ensure branch profile, GPS location, and layout consistency.'
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  disabled={isSaving}
                  aria-label={t('Đóng', 'Close')}
                  className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </header>

              {/* Wizard Steps Header */}
              <div className="my-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { step: 1, label: t('A. Thông tin chi nhánh', 'A. Branch Info'), icon: 'info' },
                  { step: 2, label: t('B. Địa chỉ & GPS', 'B. Address & GPS'), icon: 'pin_drop' },
                  { step: 3, label: t('C. Sơ đồ mặt bằng', 'C. Floor Layout'), icon: 'floor' },
                  { step: 4, label: t('D. Xác nhận & Lưu', 'D. Review & Save'), icon: 'verified' },
                ].map((s) => {
                  const isCurrent = activeStep === s.step
                  const isCompleted = activeStep > s.step
                  return (
                    <button
                      key={s.step}
                      type="button"
                      onClick={() => {
                        if (s.step < activeStep || validateStep(activeStep)) {
                          setActiveStep(s.step as 1 | 2 | 3 | 4)
                        }
                      }}
                      className={`flex items-center gap-2 rounded-xl border p-2.5 text-left text-xs font-bold transition-all cursor-pointer ${
                        isCurrent
                          ? 'border-cyan-600 bg-cyan-50/70 text-cyan-800 shadow-xs dark:border-cyan-500 dark:bg-cyan-950/40 dark:text-cyan-200'
                          : isCompleted
                          ? 'border-emerald-200 bg-emerald-50/40 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-300'
                          : 'border-slate-200 bg-slate-50/50 text-slate-500 dark:border-slate-800 dark:bg-slate-800/40'
                      }`}
                    >
                      <div
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                          isCurrent
                            ? 'bg-cyan-700 text-white'
                            : isCompleted
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {isCompleted ? <span className="material-symbols-outlined text-[13px]">check</span> : s.step}
                      </div>
                      <span className="truncate">{s.label}</span>
                    </button>
                  )
                })}
              </div>

              {formError && (
                <div
                  role="alert"
                  className="mb-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200 animate-in fade-in"
                >
                  <span className="material-symbols-outlined text-[18px] text-rose-600">error</span>
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleSave} className="space-y-6">
                {/* SECTION A: THÔNG TIN CHI NHÁNH */}
                {activeStep === 1 && (
                  <div className="space-y-4 animate-in fade-in">
                    <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4 dark:border-slate-800 dark:bg-slate-800/30">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-cyan-600">domain</span>
                        {t('Thông tin pháp lý & nhận diện chi nhánh', 'Branch Details')}
                      </h4>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {t(
                          'Mã chi nhánh là định danh duy nhất trên toàn hệ thống và không thể thay đổi tùy tiện sau khi đã có hợp đồng hay kho phát sinh.',
                          'Branch code is unique across Boxora and references contracts and units.'
                        )}
                      </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          {t('Tên chi nhánh', 'Branch name')} *
                        </label>
                        <input
                          required
                          maxLength={150}
                          value={draft.name}
                          onChange={(e) => setDraft((c) => ({ ...c, name: e.target.value }))}
                          placeholder="Boxora Thảo Điền Hub"
                          className={`${inputClassName} mt-1.5`}
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            {t('Mã chi nhánh', 'Branch code')} *
                          </label>
                          {!editingFacility && (
                            <button
                              type="button"
                              onClick={handleAutoGenerateCode}
                              className="text-[11px] font-bold text-cyan-700 hover:underline dark:text-cyan-400 cursor-pointer"
                            >
                              {t('Tự sinh mã', 'Auto generate')}
                            </button>
                          )}
                        </div>
                        <input
                          required
                          maxLength={30}
                          value={draft.code}
                          onChange={(e) => setDraft((c) => ({ ...c, code: e.target.value.toUpperCase().replace(/\s+/g, '-') }))}
                          placeholder="BX-HCM-05"
                          className={`${inputClassName} mt-1.5 font-mono uppercase font-bold`}
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          {t('Tỉnh / Thành phố', 'Province / City')} *
                        </label>
                        <select
                          value={draft.city}
                          onChange={(e) => setDraft((c) => ({ ...c, city: e.target.value }))}
                          className={`${inputClassName} mt-1.5`}
                        >
                          {VIETNAM_PROVINCES.map((p) => (
                            <option key={p.code} value={p.name}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          {t('Điện thoại liên hệ', 'Contact phone')}
                        </label>
                        <input
                          maxLength={20}
                          value={draft.contactPhone}
                          onChange={(e) => setDraft((c) => ({ ...c, contactPhone: e.target.value }))}
                          placeholder="028 3822 9999"
                          className={`${inputClassName} mt-1.5`}
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          {t('Email chi nhánh', 'Email')}
                        </label>
                        <input
                          type="email"
                          maxLength={150}
                          value={draft.email}
                          onChange={(e) => setDraft((c) => ({ ...c, email: e.target.value }))}
                          placeholder="thaodien@boxora.vn"
                          className={`${inputClassName} mt-1.5`}
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          {t('Trạng thái vận hành', 'Operating status')}
                        </label>
                        <select
                          value={draft.status}
                          onChange={(e) => setDraft((c) => ({ ...c, status: e.target.value as FacilityDraft['status'] }))}
                          className={`${inputClassName} mt-1.5 font-semibold`}
                        >
                          <option value="ACTIVE">{t('Đang hoạt động (ACTIVE)', 'Active')}</option>
                          <option value="INACTIVE">{t('Tạm ngưng vận hành (INACTIVE)', 'Inactive')}</option>
                          <option value="MAINTENANCE">{t('Đang bảo trì cơ sở (MAINTENANCE)', 'Maintenance')}</option>
                        </select>
                      </div>

                      <div className="sm:col-span-2 lg:col-span-3">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          {t('Mô tả & Ghi chú vận hành', 'Operational Notes')}
                        </label>
                        <textarea
                          rows={2}
                          value={draft.description}
                          onChange={(e) => setDraft((c) => ({ ...c, description: e.target.value }))}
                          placeholder="Cơ sở gần trục giao thông chính, trạm sạc xe điện, tiếp nhận container 40ft..."
                          className={`${inputClassName} mt-1.5 resize-y`}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* SECTION B: ĐỊA CHỈ & GPS */}
                {activeStep === 2 && (
                  <div className="space-y-4 animate-in fade-in">
                    <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4 dark:border-slate-800 dark:bg-slate-800/30">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px] text-cyan-600">location_on</span>
                            {t('Chuẩn hóa địa chỉ & Tọa độ GPS', 'Standardized Address & GPS')}
                          </h4>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {t(
                              'Hệ thống tự động tra cứu tọa độ qua dịch vụ bản đồ (OpenStreetMap Photon), hỗ trợ gợi ý và xử lý dự phòng số nhà.',
                              'Automated geocoding with fallback to street level and autocomplete suggestions.'
                            )}
                          </p>
                        </div>

                        {/* Status pill for location verification */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-slate-500">{t('Trạng thái vị trí:', 'Status:')}</span>
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-bold border ${
                              draft.geoSource === 'EXACT'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300'
                                : draft.geoSource === 'APPROXIMATE'
                                ? 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300'
                                : draft.geoSource === 'MANUAL'
                                ? 'bg-blue-50 text-blue-800 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300'
                                : 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400'
                            }`}
                          >
                            {draft.geoSource === 'EXACT' && `✓ ${t('Chính xác số nhà', 'Exact')}`}
                            {draft.geoSource === 'APPROXIMATE' && `≈ ${t('Gần đúng theo trục đường', 'Street Approx')}`}
                            {draft.geoSource === 'MANUAL' && `✎ ${t('Nhập thủ công', 'Manual')}`}
                            {draft.geoSource === 'UNVERIFIED' && `? ${t('Chưa xác minh', 'Unverified')}`}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* LocationPickerMap (ganhmuusinh style with Google Maps Vietnamese tiles, search, and pin) */}
                    <LocationPickerMap
                      latitude={draft.latitude.trim() !== '' ? Number(draft.latitude) : null}
                      longitude={draft.longitude.trim() !== '' ? Number(draft.longitude) : null}
                      address={draft.address}
                      onChange={(lat, lng) => {
                        setDraft((c) => ({
                          ...c,
                          latitude: String(lat),
                          longitude: String(lng),
                          geoSource: 'EXACT',
                          geoConfidenceNote: 'Đã ghim vị trí trên bản đồ',
                        }))
                      }}
                      onAddressSelect={(selectedAddr) => {
                        setDraft((c) => ({
                          ...c,
                          address: selectedAddr,
                        }))
                      }}
                      onClear={() => {
                        setDraft((c) => ({
                          ...c,
                          latitude: '',
                          longitude: '',
                          geoSource: 'UNVERIFIED',
                          geoConfidenceNote: '',
                        }))
                      }}
                    />

                    {/* Address & Coordinate inputs */}
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <div className="sm:col-span-2 lg:col-span-1">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          {t('Địa chỉ cơ sở hiển thị', 'Facility address')} *
                        </label>
                        <input
                          required
                          maxLength={255}
                          value={draft.address}
                          onChange={(e) => setDraft((c) => ({ ...c, address: e.target.value }))}
                          placeholder="21 Võ Trường Toản, Phường Thảo Điền, TP. Thủ Đức"
                          className={`${inputClassName} mt-1.5`}
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            {t('Vĩ độ (Latitude)', 'Latitude')}
                          </label>
                          {draft.latitude && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              {Number(draft.latitude).toFixed(6)}
                            </span>
                          )}
                        </div>
                        <input
                          type="number"
                          min="-90"
                          max="90"
                          step="any"
                          value={draft.latitude}
                          onChange={(e) => handleManualCoordinateChange('latitude', e.target.value)}
                          placeholder="Ví dụ: 10.776900"
                          className={`${inputClassName} mt-1.5 font-mono`}
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            {t('Kinh độ (Longitude)', 'Longitude')}
                          </label>
                          {draft.longitude && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              {Number(draft.longitude).toFixed(6)}
                            </span>
                          )}
                        </div>
                        <input
                          type="number"
                          min="-180"
                          max="180"
                          step="any"
                          value={draft.longitude}
                          onChange={(e) => handleManualCoordinateChange('longitude', e.target.value)}
                          placeholder="Ví dụ: 106.695300"
                          className={`${inputClassName} mt-1.5 font-mono`}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* SECTION C: SƠ ĐỒ MẶT BẰNG */}
                {activeStep === 3 && (
                  <div className="space-y-5 animate-in fade-in">
                    {/* Header Banner */}
                    <div className="flex flex-col gap-3 rounded-2xl border border-cyan-100 bg-gradient-to-r from-cyan-50/70 via-white to-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-cyan-900/50 dark:from-cyan-950/30 dark:via-slate-800 dark:to-slate-800/60 shadow-xs">
                      <div>
                        <h4 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100">
                          <span className="material-symbols-outlined text-[20px] text-cyan-700 dark:text-cyan-400">apartment</span>
                          <span>{t('Cấu trúc mặt bằng', 'Floor Layout Structure')}</span>
                        </h4>
                        <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                          {t('Thiết lập theo cấu trúc thực tế của chi nhánh', 'Configured according to the actual structure of the branch')}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-cyan-200 bg-cyan-100/80 px-3 py-1 text-xs font-bold text-cyan-800 sm:self-center dark:border-cyan-800 dark:bg-cyan-900/60 dark:text-cyan-200">
                        <span className="material-symbols-outlined text-[15px]">tune</span>
                        <span>{t('Có thể tùy chỉnh', 'Customizable')}</span>
                      </span>
                    </div>

                    {/* Tiêu đề sơ đồ mặt bằng */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900 shadow-xs">
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                        {t('Tiêu đề sơ đồ mặt bằng', 'Layout title')}
                      </label>
                      <div className="relative mt-2">
                        <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px] text-slate-400">
                          title
                        </span>
                        <input
                          value={draft.layout.title}
                          onChange={(e) => updateLayoutTitle(e.target.value)}
                          placeholder="Sơ đồ mặt bằng cơ sở Vinhomes"
                          className={`${inputClassName} pl-10 font-semibold`}
                        />
                      </div>
                    </div>

                    {/* Danh sách tầng */}
                    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900 shadow-xs">
                      {/* Floor bar header */}
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5 dark:border-slate-800">
                        <div>
                          <h5 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
                            <span className="material-symbols-outlined text-[18px] text-cyan-600">layers</span>
                            <span>{t('Danh sách tầng', 'Floor List')}</span>
                          </h5>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {floors.length} {t('tầng đã cấu hình', 'configured floors')}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={handleAddFloor}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-200 bg-cyan-50 px-3.5 py-2 text-xs font-bold text-cyan-700 shadow-2xs transition hover:bg-cyan-100 cursor-pointer dark:border-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300"
                        >
                          <span className="material-symbols-outlined text-[16px]">add</span>
                          <span>{t('Thêm tầng', 'Add Floor')}</span>
                        </button>
                      </div>

                      {/* Floor Selector Tabs */}
                      <div className="flex items-center gap-2 overflow-x-auto pb-1">
                        {floors.map((floor, idx) => {
                          const isCurrent = idx === selectedFloorIndex
                          return (
                            <button
                              key={floor.id || idx}
                              type="button"
                              onClick={() => setSelectedFloorIndex(idx)}
                              className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                                isCurrent
                                  ? 'border-cyan-600 bg-cyan-700 text-white shadow-sm shadow-cyan-700/20'
                                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                              }`}
                            >
                              <span>{floor.name || `Tầng ${idx + 1}`}</span>
                              {isCurrent && (
                                <span className="rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-semibold text-white">
                                  {t('Đang cấu hình', 'Configuring')}
                                </span>
                              )}
                            </button>
                          )
                        })}
                      </div>

                      {/* Active Floor Editor */}
                      {activeFloor && (
                        <div className="space-y-5 rounded-xl border border-slate-200/90 bg-slate-50/60 p-4 sm:p-5 dark:border-slate-700/80 dark:bg-slate-800/40">
                          {/* Floor Sub-header with Delete */}
                          <div className="flex items-center justify-between border-b border-slate-200/80 pb-3 dark:border-slate-700">
                            <div className="flex items-center gap-2">
                              <span className="material-symbols-outlined text-[18px] text-cyan-600">settings_suggest</span>
                              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                                {t('Cấu hình', 'Settings')}: {activeFloor.name || `Tầng ${selectedFloorIndex + 1}`}
                              </span>
                            </div>

                            {floors.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveFloor(selectedFloorIndex)}
                                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40 transition cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[16px]">delete</span>
                                <span>{t('Xóa tầng', 'Delete Floor')}</span>
                              </button>
                            )}
                          </div>

                          {/* Tên tầng & Diện tích tổng */}
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                {t('Tên tầng', 'Floor name')} *
                              </label>
                              <input
                                value={activeFloor.name}
                                onChange={(e) => handleUpdateFloor(selectedFloorIndex, { name: e.target.value })}
                                placeholder="Tầng trệt"
                                className={`${inputClassName} mt-1`}
                              />
                            </div>

                            <div>
                              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                {t('Diện tích tổng (m²)', 'Total Area (m²)')}
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={activeFloor.totalArea || ''}
                                onChange={(e) => handleUpdateFloor(selectedFloorIndex, { totalArea: e.target.value })}
                                placeholder="Nhập diện tích"
                                className={`${inputClassName} mt-1`}
                              />
                            </div>
                          </div>

                          {/* Điểm vận hành */}
                          <div className="space-y-3 border-t border-slate-200/80 pt-3 dark:border-slate-700">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <h6 className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100">
                                  <span className="material-symbols-outlined text-[16px] text-amber-600">navigation</span>
                                  <span>{t('Điểm vận hành', 'Operational Points')}</span>
                                </h6>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                  {t('Mỗi tầng có thể có số điểm vận hành khác nhau.', 'Each floor can have a different number of operational points.')}
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleAddOperationPoint(selectedFloorIndex)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-cyan-700 shadow-2xs hover:bg-slate-50 cursor-pointer transition dark:border-slate-700 dark:bg-slate-800 dark:text-cyan-300"
                              >
                                <span className="material-symbols-outlined text-[15px]">add</span>
                                <span>{t('Thêm điểm vận hành', 'Add Operation Point')}</span>
                              </button>
                            </div>

                            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                              {activeFloor.operationPoints.map((op, opIdx) => (
                                <div
                                  key={op.id || opIdx}
                                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-2xs dark:border-slate-700 dark:bg-slate-800"
                                >
                                  <span className="material-symbols-outlined shrink-0 text-[16px] text-slate-400">
                                    place
                                  </span>
                                  <input
                                    value={op.name}
                                    onChange={(e) => handleUpdateOperationPoint(selectedFloorIndex, opIdx, e.target.value)}
                                    placeholder="Khu nhận / xuất hàng..."
                                    className="w-full bg-transparent text-xs font-medium text-slate-900 outline-none dark:text-slate-100"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveOperationPoint(selectedFloorIndex, opIdx)}
                                    className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition cursor-pointer dark:hover:bg-rose-950/30 dark:hover:text-rose-400"
                                    title={t('Xóa điểm vận hành', 'Delete point')}
                                  >
                                    <span className="material-symbols-outlined text-[16px]">close</span>
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Phân khu chức năng */}
                          <div className="space-y-3 border-t border-slate-200/80 pt-3 dark:border-slate-700">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <h6 className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100">
                                  <span className="material-symbols-outlined text-[16px] text-indigo-600">grid_view</span>
                                  <span>{t('Phân khu chức năng', 'Functional Zones')}</span>
                                </h6>
                                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                  {activeFloor.zones.length} {t('phân khu', 'zones')}
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleAddZone(selectedFloorIndex)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-indigo-700 shadow-2xs hover:bg-slate-50 cursor-pointer transition dark:border-slate-700 dark:bg-slate-800 dark:text-indigo-300"
                              >
                                <span className="material-symbols-outlined text-[15px]">add</span>
                                <span>{t('Thêm phân khu', 'Add Zone')}</span>
                              </button>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                              {activeFloor.zones.map((zone, zIdx) => (
                                <div
                                  key={zone.id || zIdx}
                                  className="space-y-2 rounded-xl border border-indigo-100 bg-white p-3 shadow-2xs dark:border-indigo-900/50 dark:bg-slate-800"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                                      <span className="material-symbols-outlined text-[14px]">view_comfy</span>
                                      <span>Phân khu {zone.code}</span>
                                    </span>

                                    {activeFloor.zones.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveZone(selectedFloorIndex, zIdx)}
                                        className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition cursor-pointer dark:hover:bg-rose-950/30 dark:hover:text-rose-400"
                                        title={t('Xóa phân khu', 'Delete zone')}
                                      >
                                        <span className="material-symbols-outlined text-[15px]">delete</span>
                                      </button>
                                    )}
                                  </div>

                                  <div>
                                    <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                      {t('Tên phân khu:', 'Zone Name:')}
                                    </label>
                                    <input
                                      value={zone.name}
                                      onChange={(e) => handleUpdateZone(selectedFloorIndex, zIdx, { name: e.target.value })}
                                      placeholder={`Khu lưu trữ ${zone.code}`}
                                      className={`${inputClassName} mt-1 py-1.5 text-xs font-medium`}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Xem trước sơ đồ mặt bằng */}
                    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900 shadow-xs">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[20px] text-cyan-600">visibility</span>
                          <h5 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            {t('Xem trước sơ đồ mặt bằng', 'Floor Plan Preview')}
                          </h5>
                        </div>
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                          {draft.layout.title || 'Sơ đồ mặt bằng cơ sở'}
                        </span>
                      </div>

                      {/* Schematic Visual Box */}
                      <div className="rounded-xl border border-slate-200/90 bg-gradient-to-b from-slate-50/70 via-slate-50/30 to-white p-4 sm:p-5 dark:border-slate-800 dark:from-slate-800/50 dark:via-slate-800/20 dark:to-slate-900">
                        {/* Floor Header & Area */}
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-700">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-700 text-white shadow-xs">
                              <span className="material-symbols-outlined text-[20px]">domain</span>
                            </div>
                            <div>
                              <h6 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                {activeFloor?.name || 'Tầng trệt'}
                              </h6>
                              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                {floors.length > 1 ? `Tầng ${selectedFloorIndex + 1} / ${floors.length} tầng` : 'Mặt bằng cơ sở'}
                              </span>
                            </div>
                          </div>

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold border ${
                              activeFloor?.totalArea && Number(activeFloor.totalArea) > 0
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                                : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                            }`}
                          >
                            {activeFloor?.totalArea && Number(activeFloor.totalArea) > 0
                              ? `${activeFloor.totalArea} m²`
                              : t('Chưa định diện tích', 'Area not set')}
                          </span>
                        </div>

                        {/* Schematic layout items */}
                        <div className="mt-4 space-y-3">
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {/* Operational Point 1 (e.g. Khu nhận / xuất hàng) */}
                            {activeFloor?.operationPoints?.[0] && (
                              <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50/50 p-3.5 text-amber-900 shadow-2xs dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">
                                  <span className="material-symbols-outlined text-[18px]">local_shipping</span>
                                </div>
                                <div className="min-w-0">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                                    {t('Điểm vận hành', 'Operation Point')}
                                  </span>
                                  <p className="truncate text-xs font-bold">
                                    {activeFloor.operationPoints[0].name || 'Khu nhận / xuất hàng'}
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* Functional Zones */}
                            {activeFloor?.zones.map((zone) => (
                              <div
                                key={zone.id}
                                className="flex items-center gap-2.5 rounded-xl border border-indigo-200 bg-indigo-50/50 p-3.5 text-indigo-900 shadow-2xs dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-200"
                              >
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300">
                                  <span className="material-symbols-outlined text-[18px]">warehouse</span>
                                </div>
                                <div className="min-w-0">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                                    Phân khu {zone.code}
                                  </span>
                                  <p className="truncate text-xs font-bold">
                                    {zone.name || `Khu lưu trữ ${zone.code}`}
                                  </p>
                                </div>
                              </div>
                            ))}

                            {/* Remaining Operational Points (e.g. Hành lang chính, Lối thoát hiểm) */}
                            {activeFloor?.operationPoints?.slice(1).map((op, idx) => {
                              const isExit =
                                op.name.toLowerCase().includes('thoát') ||
                                op.name.toLowerCase().includes('exit')
                              return (
                                <div
                                  key={op.id || idx}
                                  className={`flex items-center gap-2.5 rounded-xl border p-3.5 shadow-2xs ${
                                    isExit
                                      ? 'border-rose-200 bg-rose-50/50 text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200'
                                      : 'border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                                  }`}
                                >
                                  <div
                                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                                      isExit
                                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300'
                                        : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                                    }`}
                                  >
                                    <span className="material-symbols-outlined text-[18px]">
                                      {isExit ? 'emergency' : 'alt_route'}
                                    </span>
                                  </div>
                                  <div className="min-w-0">
                                    <span
                                      className={`text-[10px] font-bold uppercase tracking-wider ${
                                        isExit
                                          ? 'text-rose-600 dark:text-rose-400'
                                          : 'text-slate-500 dark:text-slate-400'
                                      }`}
                                    >
                                      {t('Điểm vận hành', 'Operation Point')}
                                    </span>
                                    <p className="truncate text-xs font-bold">{op.name}</p>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* SECTION D: XÁC NHẬN VÀ LƯU */}
                {activeStep === 4 && (
                  <div className="space-y-4 animate-in fade-in">
                    <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4 dark:border-slate-800 dark:bg-slate-800/30">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-emerald-600">fact_check</span>
                        {t('Bản tóm tắt cấu hình chi nhánh trước khi ghi nhận', 'Branch Configuration Summary')}
                      </h4>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {t(
                          'Kiểm tra lại toàn bộ dữ liệu trước khi lưu vào hệ thống cơ sở dữ liệu.',
                          'Verify branch details, coordinates, and layout before saving.'
                        )}
                      </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2 dark:border-slate-700 dark:bg-slate-800">
                        <div className="text-xs font-bold text-slate-900 dark:text-slate-100 border-b pb-1 dark:border-slate-700">
                          {t('1. Hồ sơ chi nhánh', 'Branch Details')}
                        </div>
                        <div className="text-xs space-y-1.5 text-slate-600 dark:text-slate-300">
                          <p><span className="text-slate-400">{t('Tên:', 'Name:')}</span> <strong className="text-slate-900 dark:text-slate-100">{draft.name}</strong></p>
                          <p><span className="text-slate-400">{t('Mã:', 'Code:')}</span> <span className="font-mono font-bold text-cyan-700 dark:text-cyan-400">{draft.code}</span></p>
                          <p><span className="text-slate-400">{t('Thành phố:', 'City:')}</span> {draft.city}</p>
                          <p><span className="text-slate-400">{t('Điện thoại:', 'Phone:')}</span> {draft.contactPhone || '—'}</p>
                          <p><span className="text-slate-400">{t('Email:', 'Email:')}</span> {draft.email || '—'}</p>
                          <p><span className="text-slate-400">{t('Trạng thái:', 'Status:')}</span> <span className="font-bold text-emerald-700">{draft.status}</span></p>
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2 dark:border-slate-700 dark:bg-slate-800">
                        <div className="text-xs font-bold text-slate-900 dark:text-slate-100 border-b pb-1 dark:border-slate-700">
                          {t('2. Định vị địa lý & Tọa độ', 'Geolocation & Coordinates')}
                        </div>
                        <div className="text-xs space-y-1.5 text-slate-600 dark:text-slate-300">
                          <p><span className="text-slate-400">{t('Địa chỉ:', 'Address:')}</span> {draft.address}</p>
                          <p>
                            <span className="text-slate-400">{t('Tọa độ:', 'GPS:')}</span>{' '}
                            {hasCoordinates ? (
                              <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                                {Number(draft.latitude).toFixed(6)}, {Number(draft.longitude).toFixed(6)}
                              </span>
                            ) : (
                              <span className="text-amber-600">{t('Chưa thiết lập tọa độ', 'No coordinates')}</span>
                            )}
                          </p>
                          <p>
                            <span className="text-slate-400">{t('Nguồn vị trí:', 'Source:')}</span>{' '}
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {draft.geoSource} {draft.geoConfidenceNote ? `(${draft.geoConfidenceNote})` : ''}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-white p-4 space-y-3 dark:border-slate-700 dark:bg-slate-800">
                        <div className="flex items-center justify-between border-b pb-2 dark:border-slate-700">
                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                            {t('3. Sơ đồ mặt bằng & phân khu', 'Floor Layout & Zones')}
                          </span>
                          <span className="text-[11px] font-medium text-slate-500">
                            {draft.layout.title || 'Sơ đồ mặt bằng cơ sở'}
                          </span>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-xs text-slate-600 dark:text-slate-300">
                          {(draft.layout.floors || []).map((fl, fIdx) => (
                            <div
                              key={fl.id || fIdx}
                              className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 space-y-1.5 dark:border-slate-700/60 dark:bg-slate-800/60"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-slate-900 dark:text-slate-100">{fl.name}</span>
                                <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-700 dark:bg-slate-700 dark:text-slate-300 font-medium">
                                  {fl.totalArea && Number(fl.totalArea) > 0 ? `${fl.totalArea} m²` : 'Chưa định diện tích'}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                <span className="font-semibold text-slate-700 dark:text-slate-300">{t('Điểm vận hành:', 'Ops:')}</span>{' '}
                                {fl.operationPoints.length > 0 ? fl.operationPoints.map((op) => op.name).join(', ') : 'Chưa có'}
                              </p>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                <span className="font-semibold text-slate-700 dark:text-slate-300">{t('Phân khu:', 'Zones:')}</span>{' '}
                                {fl.zones.length > 0 ? fl.zones.map((z) => `${z.code} (${z.name})`).join(', ') : 'Chưa có'}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Footer Controls: Back, Next, Save, Cancel */}
                <footer className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-between dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    disabled={isSaving}
                    className="rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    {t('Hủy bỏ', 'Cancel')}
                  </button>

                  <div className="flex items-center gap-2">
                    {activeStep > 1 && (
                      <button
                        type="button"
                        onClick={handlePrevStep}
                        disabled={isSaving}
                        className="rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        ← {t('Quay lại', 'Back')}
                      </button>
                    )}

                    {activeStep < 4 ? (
                      <button
                        type="button"
                        onClick={handleNextStep}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-700 px-5 py-2.5 text-xs font-bold text-white hover:bg-cyan-800 cursor-pointer shadow-xs transition"
                      >
                        <span>{t('Tiếp theo', 'Next')}</span>
                        <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={isSaving || isGeocoding}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-700 px-6 py-2.5 text-xs font-bold text-white hover:bg-cyan-800 disabled:opacity-50 cursor-pointer shadow-md shadow-cyan-700/20 transition active:scale-95"
                      >
                        {isSaving && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
                        {isSaving ? t('Đang lưu dữ liệu...', 'Saving...') : t('Xác nhận & Lưu chi nhánh', 'Save Branch')}
                      </button>
                    )}
                  </div>
                </footer>
              </form>
            </section>
          )}

          {/* FACILITY LIST CARDS */}
          {facilities.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-900">
              <span className="material-symbols-outlined text-4xl text-slate-300">domain_disabled</span>
              <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                {t('Chưa có chi nhánh nào.', 'No branches have been added yet.')}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {facilities.map((facility) => {
                const layout = parseFacilityLayoutConfig(facility.layoutConfig)
                const hasFacilityCoordinates = facility.latitude != null && facility.longitude != null
                return (
                  <article
                    key={facility.id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-700 dark:bg-slate-900 flex flex-col justify-between transition hover:shadow-sm"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="truncate text-base font-bold text-slate-900 dark:text-slate-100">
                              {facility.name}
                            </h3>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                                facility.status === 'ACTIVE'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300'
                                  : facility.status === 'MAINTENANCE'
                                  ? 'bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300'
                                  : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400'
                              }`}
                            >
                              {facility.status}
                            </span>
                          </div>
                          <span className="mt-1 inline-flex rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {facility.code}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => togglePolicy(facility)}
                            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                              expandedPolicyFacilityId === facility.id
                                ? 'border-cyan-600 bg-cyan-50 text-cyan-800 dark:border-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300'
                                : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
                            }`}
                            title={t('Xem chính sách vận hành của chi nhánh', 'View branch operating policy')}
                          >
                            <span className="material-symbols-outlined text-[15px] text-cyan-600 dark:text-cyan-400">policy</span>
                            <span>{expandedPolicyFacilityId === facility.id ? t('Đóng', 'Close') : t('Chính sách', 'Policy')}</span>
                          </button>
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => startEdit(facility)}
                              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[15px]">edit</span>
                              {t('Sửa', 'Edit')}
                            </button>
                          )}
                        </div>
                      </div>

                      <p className="mt-3 text-xs text-slate-600 dark:text-slate-400">
                        {facility.address}
                        {facility.city ? `, ${facility.city}` : ''}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                        <span
                          className={`rounded-full px-2.5 py-1 font-semibold ${
                            hasFacilityCoordinates
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                              : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                          }`}
                        >
                          {hasFacilityCoordinates
                            ? `${Number(facility.latitude).toFixed(5)}, ${Number(facility.longitude).toFixed(5)}`
                            : t('Chưa có tọa độ GPS', 'GPS not set')}
                        </span>
                        <span className="rounded-full bg-cyan-50 px-2.5 py-1 font-semibold text-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-200">
                          {layout.floors && layout.floors.length > 0
                            ? layout.floors.map((fl) => fl.name).join(' · ')
                            : `${layout.floor1Name} · ${layout.floor2Name}`}
                        </span>
                      </div>

                      {hasFacilityCoordinates && (
                        <a
                          className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-cyan-700 hover:underline dark:text-cyan-300"
                          target="_blank"
                          rel="noreferrer"
                          href={`https://www.openstreetmap.org/?mlat=${facility.latitude}&mlon=${facility.longitude}#map=17/${facility.latitude}/${facility.longitude}`}
                        >
                          <span className="material-symbols-outlined text-[14px]">map</span>
                          {t('Xem vị trí trên bản đồ OpenStreetMap', 'View location on map')}
                        </a>
                      )}

                      {/* DISPLAY POLICY IN CARD */}
                      {expandedPolicyFacilityId === facility.id && (
                        <div className="mt-3.5 space-y-2.5 rounded-xl border border-cyan-200/80 bg-gradient-to-br from-cyan-50/40 via-white to-slate-50/60 p-3 shadow-2xs dark:border-cyan-900/50 dark:from-cyan-950/20 dark:via-slate-900 dark:to-slate-900">
                          <div className="flex items-center justify-between border-b border-cyan-100 pb-2 dark:border-cyan-900/50">
                            <div className="flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-[17px] text-cyan-700 dark:text-cyan-400">verified</span>
                              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                                {t('Chính sách vận hành chi nhánh', 'Branch Operating Policy')}
                              </span>
                            </div>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                                facilityPoliciesMap[facility.id]?.isActive === false
                                  ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-900'
                                  : facilityPoliciesMap[facility.id]
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900'
                                  : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                              }`}
                            >
                              {facilityPoliciesMap[facility.id]
                                ? facilityPoliciesMap[facility.id].isActive === false
                                  ? t('Ngừng áp dụng', 'Inactive')
                                  : t('Đang áp dụng', 'Active')
                                : t('Chưa xác minh', 'Unverified')}
                            </span>
                          </div>

                          {loadingPolicyFacilityId === facility.id ? (
                            <div className="flex items-center justify-center py-4 text-xs text-slate-500 dark:text-slate-400">
                              <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent" />
                              {t('Đang tải chính sách...', 'Loading policy...')}
                            </div>
                          ) : facilityPolicyErrors[facility.id] === 'missing' ? (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                              {t('Chưa có chính sách được lưu cho cơ sở này. Hãy kiểm tra mục Chính sách vận hành.', 'No saved policy was found.')}
                            </div>
                          ) : facilityPolicyErrors[facility.id] === 'error' ? (
                            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
                              {t('Không tải được chính sách đã lưu. Hãy thử lại.', 'Could not load policy.')}
                            </div>
                          ) : facilityPoliciesMap[facility.id] ? (
                            (() => {
                              const pol = facilityPoliciesMap[facility.id]
                              const depositPct = pol.depositPercentage ?? pol.depositPercent
                              const minMonths = pol.minimumRentalMonths
                              const renewalDays = pol.renewalWindowDays
                              const cancelFullHours = pol.cancellationFullRefundHours
                              const cancelPartHours = pol.cancellationPartialRefundHours
                              const cancelPartPct = pol.cancellationPartialRefundPercent
                              const noticeDays = pol.returnNoticeDays
                              const slaDays = pol.depositRefundSlaDays
                              const lateFee = pol.dailyLateFee ?? pol.lateFeePerDay
                              const graceDays = pol.overdueGraceDays ?? pol.gracePeriodDays
                              const lockDays = pol.overdueAccessDisableDays
                              const sealDays = pol.overdueSealingDays

                              return (
                                <div className="space-y-2 text-xs">
                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="rounded-lg border border-slate-200/80 bg-white p-2.5 shadow-2xs dark:border-slate-800 dark:bg-slate-800/80">
                                      <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                                        {t('Tiền cọc & Thuê min', 'Deposit & Min Term')}
                                      </div>
                                      <div className="mt-0.5 font-bold text-slate-900 dark:text-slate-100">
                                        {depositPct == null ? '—' : `${depositPct}%`} · {minMonths == null ? '—' : `${minMonths} ${t('tháng', 'mo')}`}
                                      </div>
                                    </div>
                                    <div className="rounded-lg border border-slate-200/80 bg-white p-2.5 shadow-2xs dark:border-slate-800 dark:bg-slate-800/80">
                                      <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                                        {t('Hủy trước check-in', 'Cancellation')}
                                      </div>
                                      <div className="mt-0.5 font-bold text-emerald-700 dark:text-emerald-400">
                                        100% (&ge;{cancelFullHours ?? '—'}h) · {cancelPartPct == null ? '—' : `${cancelPartPct}%`} (&ge;{cancelPartHours ?? '—'}h)
                                      </div>
                                    </div>
                                    <div className="rounded-lg border border-slate-200/80 bg-white p-2.5 shadow-2xs dark:border-slate-800 dark:bg-slate-800/80">
                                      <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                                        {t('Gia hạn & Hoàn cọc', 'Renewal & SLA')}
                                      </div>
                                      <div className="mt-0.5 font-bold text-cyan-800 dark:text-cyan-300">
                                        {renewalDays == null ? '—' : `Trước ${renewalDays}d`} · SLA {slaDays == null ? '—' : `${slaDays}d`}
                                      </div>
                                    </div>
                                    <div className="rounded-lg border border-slate-200/80 bg-white p-2.5 shadow-2xs dark:border-slate-800 dark:bg-slate-800/80">
                                      <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                                        {t('Quá hạn & Khóa kho', 'Overdue & Lockout')}
                                      </div>
                                      <div className="mt-0.5 font-bold text-rose-700 dark:text-rose-400">
                                        {lateFee == null ? '—' : `${Number(lateFee).toLocaleString('vi-VN')} đ/d`} · {lockDays == null ? '—' : `Khóa D+${lockDays}`}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between pt-1 text-[11px]">
                                    <span className="text-slate-500 dark:text-slate-400">
                                      {t('Ân hạn', 'Grace')}: {graceDays == null ? '—' : `${graceDays}d`} · {t('Niêm phong', 'Seal')}: {sealDays == null ? '—' : `D+${sealDays}`}
                                      {noticeDays != null && noticeDays > 0 ? ` · Báo trước: ${noticeDays}d` : ''}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setModalPolicyFacility(facility)}
                                      className="inline-flex items-center gap-1 font-bold text-cyan-700 hover:text-cyan-800 hover:underline dark:text-cyan-400 cursor-pointer"
                                    >
                                      <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                                      <span>{t('Xem chi tiết quy chuẩn', 'Full details')}</span>
                                    </button>
                                  </div>
                                </div>
                              )
                            })()
                          ) : null}
                        </div>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          )}

          {modalPolicyFacility && (
            <FacilityPolicyViewModal
              isOpen={Boolean(modalPolicyFacility)}
              onClose={() => setModalPolicyFacility(null)}
              facilityId={modalPolicyFacility.id}
              facilityName={modalPolicyFacility.name}
              canEdit={canManage}
            />
          )}
        </div>
      )}

      {/* 2. CHÍNH SÁCH VẬN HÀNH CƠ SỞ */}
      {configTab === 'policies' && <FacilityOperatingPoliciesPanel facilities={facilities} />}

      {/* 3. CẤU HÌNH QUY TẮC KINH DOANH & GIÁ ĐỘNG */}
      {configTab === 'pricing' && <DynamicPricingMatrixPanel facilities={facilities} />}
    </div>
  )
}
