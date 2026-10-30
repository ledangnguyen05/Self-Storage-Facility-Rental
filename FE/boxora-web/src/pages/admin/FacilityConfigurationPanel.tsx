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
import { Facility, FacilityLayoutConfig, FacilityPolicy } from '../../types'
import { DEFAULT_FACILITY_LAYOUT_CONFIG, parseFacilityLayoutConfig } from '../../utils/facilityLayout'
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
  imageUrl?: string
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
  imageUrl: '',
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
  imageUrl: facility.imageUrl || '',
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
  // Delete facility confirm state
  const [deleteFacilityConfirm, setDeleteFacilityConfirm] = useState<Facility | null>(null)
  const [isDeletingFacility, setIsDeletingFacility] = useState(false)
  const [deleteFacilityNotice, setDeleteFacilityNotice] = useState('')

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

  const handleDeleteFacility = async () => {
    if (!deleteFacilityConfirm) return
    setIsDeletingFacility(true)
    setDeleteFacilityNotice('')
    try {
      await facilityService.deleteFacility(deleteFacilityConfirm.id)
      onFacilitiesChange(
        facilities.filter((f) => f.id !== deleteFacilityConfirm.id)
      )
      setDeleteFacilityConfirm(null)
      setNotice('Đã xóa chi nhánh thành công.')
    } catch (err: unknown) {
      const msg = getRequestError(err) || 'Không thể xóa chi nhánh này.'
      setDeleteFacilityNotice(msg)
    } finally {
      setIsDeletingFacility(false)
    }
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

  const updateLayout = (key: keyof FacilityLayoutConfig, value: string) => {
    setDraft((current) => ({ ...current, layout: { ...current.layout, [key]: value } }))
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
        setFormError(
          t(
            'Vui lòng nhập địa chỉ đầy đủ của chi nhánh (chọn một kết quả trong danh sách tìm kiếm, ghim trên bản đồ hoặc nhập vào ô "Địa chỉ cơ sở hiển thị").',
            'Full address is required.'
          )
        )
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
      const area1 = draft.layout.totalAreaFloor1.trim()
      const area2 = draft.layout.totalAreaFloor2.trim()
      if (area1 && (isNaN(Number(area1)) || Number(area1) <= 0)) {
        setFormError(t('Diện tích tầng 1 phải là số dương (m²).', 'Floor 1 area must be positive.'))
        return false
      }
      if (area2 && (isNaN(Number(area2)) || Number(area2) <= 0)) {
        setFormError(t('Diện tích tầng 2 phải là số dương (m²).', 'Floor 2 area must be positive.'))
        return false
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
        layoutConfig: JSON.stringify(draft.layout),
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
                              'Gõ địa chỉ để nhận gợi ý từ dữ liệu bản đồ thật (OpenStreetMap), bấm lên bản đồ hoặc kéo ghim để chọn vị trí — địa chỉ sẽ tự điền theo ghim.',
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
                          placeholder="10.8043499"
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
                          placeholder="106.7472609"
                          className={`${inputClassName} mt-1.5 font-mono`}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* SECTION C: SƠ ĐỒ MẶT BẰNG */}
                {activeStep === 3 && (
                  <div className="space-y-4 animate-in fade-in">
                    <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4 dark:border-slate-800 dark:bg-slate-800/30">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-cyan-600">floor</span>
                        {t('Cấu trúc tầng, phân khu & điểm vận hành', 'Floor & Zone Layout Structure')}
                      </h4>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {t(
                          'Cấu hình tên tầng, tên phân khu, diện tích m² và các điểm nhận hàng/hành lang/lối thoát hiểm. Việc cấu hình sơ đồ hoàn toàn độc lập với các kho vật lý hiện có.',
                          'Configure floor names, zones, positive area in m², loading bays, and exit doors.'
                        )}
                      </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <div className="sm:col-span-2 lg:col-span-3">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          {t('Tiêu đề sơ đồ mặt bằng', 'Layout title')}
                        </label>
                        <input
                          value={draft.layout.title}
                          onChange={(e) => updateLayout('title', e.target.value)}
                          className={`${inputClassName} mt-1.5`}
                        />
                      </div>

                      {/* Floor 1 Config */}
                      <div className="rounded-xl border border-slate-200 p-3.5 space-y-3 dark:border-slate-700">
                        <div className="flex items-center gap-2 text-xs font-bold text-cyan-800 dark:text-cyan-300">
                          <span className="material-symbols-outlined text-[16px]">layers</span>
                          <span>{t('Thiết lập Tầng 1', 'Floor 1 Settings')}</span>
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                            {t('Tên tầng 1', 'Floor 1 Name')}
                          </label>
                          <input
                            value={draft.layout.floor1Name}
                            onChange={(e) => updateLayout('floor1Name', e.target.value)}
                            className={`${inputClassName} mt-1`}
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                            {t('Diện tích tổng tầng 1 (m²)', 'Total Floor 1 Area (m²)')}
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={draft.layout.totalAreaFloor1}
                            onChange={(e) => updateLayout('totalAreaFloor1', e.target.value)}
                            placeholder="650"
                            className={`${inputClassName} mt-1`}
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                            {t('Khu nhận / xuất hàng', 'Loading Bay')}
                          </label>
                          <input
                            value={draft.layout.loadingBayFloor1}
                            onChange={(e) => updateLayout('loadingBayFloor1', e.target.value)}
                            className={`${inputClassName} mt-1`}
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                            {t('Hành lang chính', 'Main Corridor')}
                          </label>
                          <input
                            value={draft.layout.corridorNorth}
                            onChange={(e) => updateLayout('corridorNorth', e.target.value)}
                            className={`${inputClassName} mt-1`}
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                            {t('Lối thoát hiểm', 'Emergency Exit')}
                          </label>
                          <input
                            value={draft.layout.exitFloor1}
                            onChange={(e) => updateLayout('exitFloor1', e.target.value)}
                            className={`${inputClassName} mt-1`}
                          />
                        </div>
                      </div>

                      {/* Floor 2 Config */}
                      <div className="rounded-xl border border-slate-200 p-3.5 space-y-3 dark:border-slate-700">
                        <div className="flex items-center gap-2 text-xs font-bold text-cyan-800 dark:text-cyan-300">
                          <span className="material-symbols-outlined text-[16px]">layers</span>
                          <span>{t('Thiết lập Tầng 2', 'Floor 2 Settings')}</span>
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                            {t('Tên tầng 2', 'Floor 2 Name')}
                          </label>
                          <input
                            value={draft.layout.floor2Name}
                            onChange={(e) => updateLayout('floor2Name', e.target.value)}
                            className={`${inputClassName} mt-1`}
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                            {t('Diện tích tổng tầng 2 (m²)', 'Total Floor 2 Area (m²)')}
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={draft.layout.totalAreaFloor2}
                            onChange={(e) => updateLayout('totalAreaFloor2', e.target.value)}
                            placeholder="550"
                            className={`${inputClassName} mt-1`}
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                            {t('Điểm chuyển hàng / Thang hàng', 'Freight Elevator')}
                          </label>
                          <input
                            value={draft.layout.loadingBayFloor2}
                            onChange={(e) => updateLayout('loadingBayFloor2', e.target.value)}
                            className={`${inputClassName} mt-1`}
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                            {t('Hành lang điều hòa nhiệt độ', 'Climate Corridor')}
                          </label>
                          <input
                            value={draft.layout.corridorClimate}
                            onChange={(e) => updateLayout('corridorClimate', e.target.value)}
                            className={`${inputClassName} mt-1`}
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                            {t('Lối thoát hiểm', 'Emergency Exit')}
                          </label>
                          <input
                            value={draft.layout.exitFloor2}
                            onChange={(e) => updateLayout('exitFloor2', e.target.value)}
                            className={`${inputClassName} mt-1`}
                          />
                        </div>
                      </div>

                      {/* Zones Config */}
                      <div className="rounded-xl border border-slate-200 p-3.5 space-y-3 dark:border-slate-700">
                        <div className="flex items-center gap-2 text-xs font-bold text-cyan-800 dark:text-cyan-300">
                          <span className="material-symbols-outlined text-[16px]">grid_view</span>
                          <span>{t('Phân khu chức năng', 'Functional Zones')}</span>
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                            {t('Tên phân khu A', 'Zone A Name')}
                          </label>
                          <input
                            value={draft.layout.zoneAName}
                            onChange={(e) => updateLayout('zoneAName', e.target.value)}
                            className={`${inputClassName} mt-1`}
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                            {t('Tên phân khu B', 'Zone B Name')}
                          </label>
                          <input
                            value={draft.layout.zoneBName}
                            onChange={(e) => updateLayout('zoneBName', e.target.value)}
                            className={`${inputClassName} mt-1`}
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                            {t('Tên phân khu C', 'Zone C Name')}
                          </label>
                          <input
                            value={draft.layout.zoneCName}
                            onChange={(e) => updateLayout('zoneCName', e.target.value)}
                            className={`${inputClassName} mt-1`}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Floor Layout Visual Preview */}
                    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-700">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[16px] text-cyan-600">visibility</span>
                          {t('Xem trước mô hình sơ đồ mặt bằng (Preview)', 'Layout Preview')}
                        </span>
                        <span className="text-[11px] text-slate-500">{draft.layout.title}</span>
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        {/* Floor 1 Card */}
                        <div className="rounded-lg border border-cyan-100 bg-cyan-50/30 p-3 dark:border-cyan-900/50 dark:bg-cyan-950/20">
                          <div className="flex items-center justify-between text-xs font-bold text-cyan-900 dark:text-cyan-200">
                            <span>{draft.layout.floor1Name}</span>
                            <span className="text-[10px] bg-cyan-100 px-2 py-0.5 rounded text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200">
                              {draft.layout.totalAreaFloor1 ? `${draft.layout.totalAreaFloor1} m²` : 'Chưa định diện tích'}
                            </span>
                          </div>
                          <div className="mt-2 text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
                            <p>• {t('Điểm giao nhận', 'Bay')}: {draft.layout.loadingBayFloor1}</p>
                            <p>• {t('Hành lang', 'Corridor')}: {draft.layout.corridorNorth}</p>
                            <p>• {t('Lối thoát', 'Exit')}: {draft.layout.exitFloor1}</p>
                          </div>
                        </div>

                        {/* Floor 2 Card */}
                        <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
                          <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-slate-100">
                            <span>{draft.layout.floor2Name}</span>
                            <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                              {draft.layout.totalAreaFloor2 ? `${draft.layout.totalAreaFloor2} m²` : 'Chưa định diện tích'}
                            </span>
                          </div>
                          <div className="mt-2 text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
                            <p>• {t('Điểm giao nhận', 'Bay')}: {draft.layout.loadingBayFloor2}</p>
                            <p>• {t('Hành lang', 'Corridor')}: {draft.layout.corridorClimate}</p>
                            <p>• {t('Lối thoát', 'Exit')}: {draft.layout.exitFloor2}</p>
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

                      <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-white p-4 space-y-2 dark:border-slate-700 dark:bg-slate-800">
                        <div className="text-xs font-bold text-slate-900 dark:text-slate-100 border-b pb-1 dark:border-slate-700">
                          {t('3. Sơ đồ phân khu', 'Floor Layout Zones')}
                        </div>
                        <div className="grid gap-2 sm:grid-cols-3 text-xs text-slate-600 dark:text-slate-300">
                          <div>
                            <p className="font-semibold text-slate-800 dark:text-slate-200">{draft.layout.floor1Name}</p>
                            <p className="text-[11px] text-slate-500">Diện tích: {draft.layout.totalAreaFloor1 || '—'} m²</p>
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800 dark:text-slate-200">{draft.layout.floor2Name}</p>
                            <p className="text-[11px] text-slate-500">Diện tích: {draft.layout.totalAreaFloor2 || '—'} m²</p>
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800 dark:text-slate-200">Phân khu</p>
                            <p className="text-[11px] text-slate-500">
                              {draft.layout.zoneAName} · {draft.layout.zoneBName} · {draft.layout.zoneCName}
                            </p>
                          </div>
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
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => setDeleteFacilityConfirm(facility)}
                              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950/40 cursor-pointer"
                              title={t('Xóa chi nhánh', 'Delete branch')}
                            >
                              <span className="material-symbols-outlined text-[15px]">delete</span>
                              {t('Xóa', 'Delete')}
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
                          {layout.floor1Name} · {layout.floor2Name}
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
                                        {t('Hủy đơn & Hoàn cọc', 'Cancellation & Refund')}
                                      </div>
                                      <div className="mt-0.5 font-bold text-emerald-700 dark:text-emerald-400">
                                        100% (&le;{cancelFullHours ?? 24}h) · {cancelPartPct ?? 70}% ({cancelFullHours ?? 24}h-{cancelPartHours ?? 48}h) · 50% (&gt;{cancelPartHours ?? 48}h)
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

          {/* Delete Facility Confirm Modal */}
          {deleteFacilityConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-6 max-w-sm w-full mx-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/50 flex items-center justify-center">
                    <span className="material-symbols-outlined text-rose-600 text-[20px]">domain_disabled</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Xác nhận xóa chi nhánh</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Hành động này không thể hoàn tác</p>
                  </div>
                </div>
                {deleteFacilityNotice && (
                  <p className="text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/40 rounded-lg px-3 py-2 mb-3">{deleteFacilityNotice}</p>
                )}
                <p className="text-sm text-slate-700 dark:text-slate-300 mb-5">
                  Bạn có chắc muốn xóa chi nhánh <strong>{deleteFacilityConfirm.name}</strong>?
                  Chi nhánh sẽ bị xóa khỏi hệ thống cùng các kho thuộc chi nhánh. Không thể xóa nếu còn hợp đồng hoặc đơn đặt kho liên quan.
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setDeleteFacilityConfirm(null); setDeleteFacilityNotice('') }}
                    disabled={isDeletingFacility}
                    className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-all"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteFacility}
                    disabled={isDeletingFacility}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-all disabled:opacity-60"
                  >
                    {isDeletingFacility ? 'Đang xóa...' : 'Xóa chi nhánh'}
                  </button>
                </div>
              </div>
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
