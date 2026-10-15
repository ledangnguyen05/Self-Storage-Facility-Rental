import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { facilityService } from '../../services/facilityService'
import { getNominatimErrorMessage, geocodeAddressWithNominatim } from '../../services/nominatimGeocodingService'
import { Facility, FacilityLayoutConfig } from '../../types'
import { DEFAULT_FACILITY_LAYOUT_CONFIG, parseFacilityLayoutConfig } from '../../utils/facilityLayout'

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
  layout: FacilityLayoutConfig
}

const blankDraft = (): FacilityDraft => ({
  name: '',
  code: '',
  address: '',
  city: '',
  contactPhone: '',
  email: '',
  description: '',
  status: 'ACTIVE',
  latitude: '',
  longitude: '',
  layout: { ...DEFAULT_FACILITY_LAYOUT_CONFIG },
})

const inputClassName = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/15 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'

const toDraft = (facility: Facility): FacilityDraft => ({
  name: facility.name || '',
  code: facility.code || '',
  address: facility.address || '',
  city: facility.city || '',
  contactPhone: facility.contactPhone || '',
  email: facility.email || '',
  description: facility.description || '',
  status: facility.status === 'INACTIVE' || facility.status === 'MAINTENANCE' ? facility.status : 'ACTIVE',
  latitude: facility.latitude == null ? '' : String(facility.latitude),
  longitude: facility.longitude == null ? '' : String(facility.longitude),
  layout: parseFacilityLayoutConfig(facility.layoutConfig),
})

const textLayoutFields: Array<{ key: keyof FacilityLayoutConfig; label: string }> = [
  { key: 'title', label: 'Tên sơ đồ' },
  { key: 'floor1Name', label: 'Tên tầng 1' },
  { key: 'floor2Name', label: 'Tên tầng 2' },
  { key: 'zoneAName', label: 'Tên phân khu A' },
  { key: 'zoneBName', label: 'Tên phân khu B' },
  { key: 'zoneCName', label: 'Tên phân khu C' },
  { key: 'loadingBayFloor1', label: 'Điểm nhận hàng tầng 1' },
  { key: 'corridorNorth', label: 'Hành lang tầng 1' },
  { key: 'exitFloor1', label: 'Lối thoát tầng 1' },
  { key: 'loadingBayFloor2', label: 'Điểm nhận hàng tầng 2' },
  { key: 'corridorClimate', label: 'Hành lang tầng 2' },
  { key: 'exitFloor2', label: 'Lối thoát tầng 2' },
  { key: 'totalAreaFloor1', label: 'Diện tích tầng 1' },
  { key: 'totalAreaFloor2', label: 'Diện tích tầng 2' },
]

const layoutFieldEnglishLabels: Record<keyof FacilityLayoutConfig, string> = {
  title: 'Layout title',
  floor1Name: 'Floor 1 name',
  floor2Name: 'Floor 2 name',
  zoneAName: 'Zone A name',
  zoneADesc: 'Zone A description',
  zoneBName: 'Zone B name',
  zoneBDesc: 'Zone B description',
  zoneCName: 'Zone C name',
  zoneCDesc: 'Zone C description',
  loadingBayFloor1: 'Floor 1 loading area',
  corridorNorth: 'Floor 1 corridor',
  exitFloor1: 'Floor 1 exit',
  loadingBayFloor2: 'Floor 2 loading area',
  corridorClimate: 'Floor 2 corridor',
  exitFloor2: 'Floor 2 exit',
  totalAreaFloor1: 'Floor 1 total area',
  totalAreaFloor2: 'Floor 2 total area',
}

const getRequestError = (error: unknown) => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response
    if (response?.data?.message) return response.data.message
  }
  return error instanceof Error ? error.message : 'Không thể lưu thông tin chi nhánh.'
}

export const FacilityConfigurationPanel: React.FC<FacilityConfigurationPanelProps> = ({ facilities, onFacilitiesChange }) => {
  const { role } = useAuth()
  const canManage = role === 'BUSINESS_MANAGER'
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [editingFacility, setEditingFacility] = useState<Facility | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [draft, setDraft] = useState<FacilityDraft>(blankDraft)
  const [isSaving, setIsSaving] = useState(false)
  const [isGeocoding, setIsGeocoding] = useState(false)
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')

  const refreshFacilities = async () => {
    const result = await facilityService.getFacilities({ size: 100 })
    const facilityList = Array.isArray(result?.content) ? result.content : []
    onFacilitiesChange(facilityList)
  }

  const startCreate = () => {
    setEditingFacility(null)
    setDraft(blankDraft())
    setFormError('')
    setNotice('')
    setIsFormOpen(true)
  }

  const startEdit = (facility: Facility) => {
    setEditingFacility(facility)
    setDraft(toDraft(facility))
    setFormError('')
    setNotice('')
    setIsFormOpen(true)
  }

  const updateLayout = (key: keyof FacilityLayoutConfig, value: string) => {
    setDraft(current => ({ ...current, layout: { ...current.layout, [key]: value } }))
  }

  const lookupCoordinates = async () => {
    if (!draft.address.trim()) {
      setFormError(t('Nhập địa chỉ trước khi tìm tọa độ.', 'Enter an address before looking up coordinates.'))
      return
    }
    setIsGeocoding(true)
    setFormError('')
    try {
      const result = await geocodeAddressWithNominatim(`${draft.address}, ${draft.city}`)
      setDraft(current => ({ ...current, latitude: String(result.lat), longitude: String(result.lng) }))
      setNotice(t('Đã tìm được tọa độ cho địa chỉ này.', 'Coordinates found for this address.'))
    } catch (error) {
      setFormError(t(getNominatimErrorMessage(error), 'Could not find coordinates. Check the address and try again.'))
    } finally {
      setIsGeocoding(false)
    }
  }

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError('')
    setNotice('')

    const latitude = draft.latitude.trim() === '' ? null : Number(draft.latitude)
    const longitude = draft.longitude.trim() === '' ? null : Number(draft.longitude)
    if ((latitude === null) !== (longitude === null)) {
      setFormError(t('Cần nhập cả vĩ độ và kinh độ, hoặc để trống cả hai.', 'Enter both latitude and longitude, or leave both empty.'))
      return
    }
    if (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) {
      setFormError(t('Vĩ độ phải nằm trong khoảng -90 đến 90.', 'Latitude must be between -90 and 90.'))
      return
    }
    if (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) {
      setFormError(t('Kinh độ phải nằm trong khoảng -180 đến 180.', 'Longitude must be between -180 and 180.'))
      return
    }

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
      setNotice(editingFacility
        ? t('Đã cập nhật cấu hình chi nhánh.', 'Branch configuration updated.')
        : t('Đã tạo chi nhánh mới.', 'New branch created.'))
      setIsFormOpen(false)
      setEditingFacility(null)
    } catch (error) {
      setFormError(getRequestError(error))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-slate-700 dark:bg-slate-900">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{t('Cấu hình chi nhánh', 'Branch configuration')}</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('Quản lý thông tin, vị trí GPS và sơ đồ mặt bằng của từng cơ sở.', 'Manage branch details, GPS location, and floor layout.')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => navigate('/portal/business-manager')} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer">
            <span className="material-symbols-outlined text-[18px]">tune</span>
            {t('Chính sách & bảng giá', 'Policies & pricing')}
          </button>
          {canManage ? (
            <button type="button" onClick={startCreate} className="inline-flex items-center gap-2 rounded-lg bg-cyan-700 px-3.5 py-2.5 text-xs font-bold text-white hover:bg-cyan-800 cursor-pointer">
              <span className="material-symbols-outlined text-[18px]">add_business</span>
              {t('Thêm chi nhánh', 'Add branch')}
            </button>
          ) : (
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <span className="material-symbols-outlined text-[16px] text-slate-500">lock</span>
              <span>{t('Chỉ xem (Chỉ Business Operations Manager được phép thêm chi nhánh)', 'Read-only (Only Business Operations Manager can add branches)')}</span>
            </div>
          )}
        </div>
      </section>

      {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">{notice}</p>}

      {canManage && isFormOpen && (
        <section className="rounded-2xl border border-cyan-200 bg-white p-5 shadow-sm dark:border-cyan-900 dark:bg-slate-900">
          <form onSubmit={handleSave} className="space-y-6">
            <header className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{editingFacility ? t('Chỉnh sửa chi nhánh', 'Edit branch') : t('Tạo chi nhánh mới', 'Create a new branch')}</h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('Các thay đổi được lưu vào hồ sơ chi nhánh.', 'Changes are saved to the branch record.')}</p>
              </div>
              <button type="button" onClick={() => setIsFormOpen(false)} disabled={isSaving} aria-label={t('Đóng', 'Close')} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800">
                <span className="material-symbols-outlined">close</span>
              </button>
            </header>

            {formError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">{formError}</p>}

            <div>
              <h4 className="mb-3 text-sm font-bold text-slate-800 dark:text-slate-200">{t('Thông tin chi nhánh', 'Branch details')}</h4>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t('Tên chi nhánh', 'Branch name')} *
                  <input required maxLength={150} value={draft.name} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} className={`${inputClassName} mt-1.5`} />
                </label>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t('Mã chi nhánh', 'Branch code')} *
                  <input required maxLength={30} value={draft.code} onChange={event => setDraft(current => ({ ...current, code: event.target.value.toUpperCase() }))} placeholder="BX-HCM-01" className={`${inputClassName} mt-1.5`} />
                </label>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t('Thành phố', 'City')}
                  <input maxLength={50} value={draft.city} onChange={event => setDraft(current => ({ ...current, city: event.target.value }))} className={`${inputClassName} mt-1.5`} />
                </label>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 sm:col-span-2 lg:col-span-3">{t('Địa chỉ đầy đủ', 'Full address')} *
                  <input required maxLength={255} value={draft.address} onChange={event => setDraft(current => ({ ...current, address: event.target.value }))} className={`${inputClassName} mt-1.5`} />
                </label>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t('Điện thoại liên hệ', 'Contact phone')}
                  <input maxLength={20} value={draft.contactPhone} onChange={event => setDraft(current => ({ ...current, contactPhone: event.target.value }))} className={`${inputClassName} mt-1.5`} />
                </label>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t('Email', 'Email')}
                  <input type="email" maxLength={150} value={draft.email} onChange={event => setDraft(current => ({ ...current, email: event.target.value }))} className={`${inputClassName} mt-1.5`} />
                </label>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t('Trạng thái chi nhánh', 'Branch status')}
                  <select value={draft.status} onChange={event => setDraft(current => ({ ...current, status: event.target.value as FacilityDraft['status'] }))} className={`${inputClassName} mt-1.5`}>
                    <option value="ACTIVE">{t('Đang hoạt động', 'Active')}</option>
                    <option value="INACTIVE">{t('Tạm ngưng', 'Inactive')}</option>
                    <option value="MAINTENANCE">{t('Đang bảo trì', 'Under maintenance')}</option>
                  </select>
                </label>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 sm:col-span-2 lg:col-span-3">{t('Ghi chú', 'Description')}
                  <textarea rows={2} value={draft.description} onChange={event => setDraft(current => ({ ...current, description: event.target.value }))} className={`${inputClassName} mt-1.5 resize-y`} />
                </label>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">{t('Vị trí GPS', 'GPS location')}</h4>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('Nhập tọa độ hoặc tìm từ địa chỉ để chi nhánh xuất hiện đúng vị trí.', 'Enter coordinates or look them up from the address so the branch appears in the right location.')}</p>
                </div>
                <button type="button" onClick={() => void lookupCoordinates()} disabled={isGeocoding} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-bold text-cyan-800 hover:bg-cyan-100 disabled:opacity-50 dark:border-cyan-900 dark:bg-cyan-950/50 dark:text-cyan-200">
                  <span className={`material-symbols-outlined text-[17px] ${isGeocoding ? 'animate-spin' : ''}`}>{isGeocoding ? 'progress_activity' : 'my_location'}</span>
                  {isGeocoding ? t('Đang tìm...', 'Searching...') : t('Tìm tọa độ từ địa chỉ', 'Look up address coordinates')}
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t('Vĩ độ (Latitude)', 'Latitude')}
                  <input type="number" min="-90" max="90" step="any" value={draft.latitude} onChange={event => setDraft(current => ({ ...current, latitude: event.target.value }))} className={`${inputClassName} mt-1.5 font-mono`} />
                </label>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t('Kinh độ (Longitude)', 'Longitude')}
                  <input type="number" min="-180" max="180" step="any" value={draft.longitude} onChange={event => setDraft(current => ({ ...current, longitude: event.target.value }))} className={`${inputClassName} mt-1.5 font-mono`} />
                </label>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <div className="mb-4">
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">{t('Sơ đồ mặt bằng', 'Floor layout')}</h4>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('Cấu hình tên tầng, phân khu, diện tích và các điểm vận hành hiển thị trên sơ đồ quản lý.', 'Configure floor and zone names, areas, and operational points shown on the manager layout.')}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {textLayoutFields.map(field => (
                  <label key={field.key} className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t(field.label, layoutFieldEnglishLabels[field.key])}
                    <input value={draft.layout[field.key]} onChange={event => updateLayout(field.key, event.target.value)} className={`${inputClassName} mt-1.5`} />
                  </label>
                ))}
                {([
                  ['zoneADesc', 'Mô tả phân khu A'],
                  ['zoneBDesc', 'Mô tả phân khu B'],
                  ['zoneCDesc', 'Mô tả phân khu C'],
                ] as Array<[keyof FacilityLayoutConfig, string]>).map(([key, label]) => (
                  <label key={key} className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t(label, layoutFieldEnglishLabels[key])}
                    <textarea rows={2} value={draft.layout[key]} onChange={event => updateLayout(key, event.target.value)} className={`${inputClassName} mt-1.5 resize-y`} />
                  </label>
                ))}
              </div>
            </div>

            <footer className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end dark:border-slate-800">
              <button type="button" onClick={() => setIsFormOpen(false)} disabled={isSaving} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">{t('Hủy', 'Cancel')}</button>
              <button type="submit" disabled={isSaving || isGeocoding} className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-cyan-800 disabled:opacity-50">
                {isSaving && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
                {isSaving ? t('Đang lưu...', 'Saving...') : t('Lưu cấu hình', 'Save configuration')}
              </button>
            </footer>
          </form>
        </section>
      )}

      {facilities.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-900">
          <span className="material-symbols-outlined text-4xl text-slate-300">domain_disabled</span>
          <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-200">{t('Chưa có chi nhánh nào.', 'No branches have been added yet.')}</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {facilities.map(facility => {
            const layout = parseFacilityLayoutConfig(facility.layoutConfig)
            const hasCoordinates = facility.latitude != null && facility.longitude != null
            return (
              <article key={facility.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">{facility.name}</h3>
                    <span className="mt-1 inline-flex rounded bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{facility.code}</span>
                  </div>
                  {canManage && (
                    <button type="button" onClick={() => startEdit(facility)} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer">
                      <span className="material-symbols-outlined text-[15px]">edit</span>
                      {t('Chỉnh sửa', 'Edit')}
                    </button>
                  )}
                </div>
                <p className="mt-3 text-xs text-slate-600 dark:text-slate-400">{facility.address}{facility.city ? `, ${facility.city}` : ''}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                  <span className={`rounded-full px-2.5 py-1 font-semibold ${hasCoordinates ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'}`}>
                    {hasCoordinates ? `${Number(facility.latitude).toFixed(5)}, ${Number(facility.longitude).toFixed(5)}` : t('Chưa có tọa độ GPS', 'GPS not set')}
                  </span>
                  <span className="rounded-full bg-cyan-50 px-2.5 py-1 font-semibold text-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-200">{layout.floor1Name} · {layout.floor2Name}</span>
                </div>
                {hasCoordinates && (
                  <a className="mt-3 inline-flex text-xs font-semibold text-cyan-700 hover:underline dark:text-cyan-300" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${facility.latitude}&mlon=${facility.longitude}#map=17/${facility.latitude}/${facility.longitude}`}>
                    {t('Xem vị trí trên bản đồ', 'View location on map')}
                  </a>
                )}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
