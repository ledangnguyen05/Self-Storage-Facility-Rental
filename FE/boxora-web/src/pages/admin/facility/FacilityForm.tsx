import React, { useState } from 'react'
import { Locate, MapPinOff } from 'lucide-react'
import { LazyCoordinatePickerMap } from '@/components/map/LazyMaps'
import { Alert, Button, Field, Input, Modal, Select, Textarea, useToast } from '@/components/ui'
import { FACILITY_STATUS_OPTIONS } from '@/constants/statusMeta'
import { getApiErrorMessage } from '@/lib/apiError'
import { facilityService } from '@/services/facilityService'
import { geocodeAddressWithNominatim, getNominatimErrorMessage } from '@/services/nominatimGeocodingService'
import type { Facility, FacilityLayoutConfig } from '@/types'
import {
  SINGLE_LINE_LAYOUT_FIELDS,
  ZONE_DESCRIPTION_FIELDS,
  blankDraft,
  formatCoordinate,
  isOutsideVietnam,
  parseDraftCoordinates,
  toDraft,
  toFacilityPayload,
  validateDraft,
  type FacilityDraft,
  type FacilityDraftErrors,
  type FacilityStatusValue,
} from './facilityDraft'

export interface FacilityFormProps {
  /** The facility being edited, or null to create a new one. */
  facility: Facility | null
  onClose: () => void
  /** Called after the backend accepted the change, before the modal closes. */
  onSaved: () => void
}

const FORM_ID = 'facility-form'

/** Create or edit a facility: details, GPS position and floor layout. Mounted only while open. */
export function FacilityForm({ facility, onClose, onSaved }: FacilityFormProps) {
  const toast = useToast()
  const isEdit = facility !== null
  const [draft, setDraft] = useState<FacilityDraft>(() => (facility ? toDraft(facility) : blankDraft()))
  const [errors, setErrors] = useState<FacilityDraftErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isGeocoding, setIsGeocoding] = useState(false)
  /** Why the last address lookup failed. Shown in the GPS section next to the button, not in the (scrolled-away) top alert. */
  const [geocodeError, setGeocodeError] = useState<string | null>(null)
  /** What the address lookup resolved to, so the manager can compare it with the typed address. */
  const [geocodedLabel, setGeocodedLabel] = useState<string | null>(null)
  const mapPoint = parseDraftCoordinates(draft)
  const outsideVietnam = mapPoint !== null && isOutsideVietnam(mapPoint)

  const setField = <K extends Exclude<keyof FacilityDraft, 'layout'>>(key: K, value: FacilityDraft[K]) => {
    setDraft(current => ({ ...current, [key]: value }))
    setErrors(current => (current[key] ? { ...current, [key]: undefined } : current))
    if (key === 'latitude' || key === 'longitude') setGeocodedLabel(null)
    if (key === 'address' || key === 'city' || key === 'latitude' || key === 'longitude') setGeocodeError(null)
  }

  const setLayout = (key: keyof FacilityLayoutConfig, value: string) => {
    setDraft(current => ({ ...current, layout: { ...current.layout, [key]: value } }))
  }

  const lookupCoordinates = async () => {
    if (!draft.address.trim()) {
      setErrors(current => ({ ...current, address: 'Nhập địa chỉ trước khi tìm tọa độ.' }))
      return
    }
    setIsGeocoding(true)
    setGeocodeError(null)
    try {
      const result = await geocodeAddressWithNominatim([draft.address, draft.city].filter(part => part.trim()).join(', '))
      setDraft(current => ({ ...current, latitude: formatCoordinate(result.lat), longitude: formatCoordinate(result.lng) }))
      setErrors(current => ({ ...current, latitude: undefined, longitude: undefined }))
      setGeocodedLabel(result.displayName)
      toast.success('Đã tìm được tọa độ', 'Kiểm tra lại vị trí trên bản đồ trước khi lưu.')
    } catch (err) {
      setGeocodeError(getNominatimErrorMessage(err))
    } finally {
      setIsGeocoding(false)
    }
  }

  /** A click or drag on the preview map sets both fields at once. */
  const placeOnMap = (point: { lat: number; lng: number }) => {
    setDraft(current => ({ ...current, latitude: formatCoordinate(point.lat), longitude: formatCoordinate(point.lng) }))
    setErrors(current => ({ ...current, latitude: undefined, longitude: undefined }))
    setGeocodedLabel(null)
    setGeocodeError(null)
  }

  const clearCoordinates = () => {
    setDraft(current => ({ ...current, latitude: '', longitude: '' }))
    setErrors(current => ({ ...current, latitude: undefined, longitude: undefined }))
    setGeocodedLabel(null)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitError(null)
    const nextErrors = validateDraft(draft)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setIsSaving(true)
    try {
      const payload = toFacilityPayload(draft, isEdit)
      if (facility) await facilityService.updateFacility(facility.id, payload)
      else await facilityService.createFacility(payload)
      toast.success(isEdit ? 'Đã cập nhật chi nhánh' : 'Đã tạo chi nhánh mới', draft.name.trim())
      onSaved()
      onClose()
    } catch (err) {
      setSubmitError(getApiErrorMessage(err, 'Không thể lưu thông tin chi nhánh.'))
      setIsSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!isSaving}
      size="lg"
      title={isEdit ? 'Chỉnh sửa chi nhánh' : 'Tạo chi nhánh mới'}
      description="Thay đổi được lưu vào hồ sơ chi nhánh."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            Hủy
          </Button>
          <Button type="submit" form={FORM_ID} loading={isSaving} disabled={isGeocoding}>
            Lưu chi nhánh
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="flex flex-col gap-8">
        {submitError ? (
          <Alert tone="danger" title="Không thể hoàn tất">
            {submitError}
          </Alert>
        ) : null}

        <section className="flex flex-col gap-4" aria-labelledby="facility-details">
          <h3 id="facility-details" className="text-sm font-semibold text-fg">
            Thông tin chi nhánh
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Tên chi nhánh" required error={errors.name}>
              <Input maxLength={150} value={draft.name} onChange={event => setField('name', event.target.value)} />
            </Field>
            <Field label="Mã chi nhánh" required error={errors.code}>
              <Input maxLength={30} value={draft.code} placeholder="BX-HCM-01" onChange={event => setField('code', event.target.value.toUpperCase())} />
            </Field>
            <Field label="Địa chỉ đầy đủ" required error={errors.address} className="sm:col-span-2">
              <Input maxLength={255} value={draft.address} onChange={event => setField('address', event.target.value)} />
            </Field>
            <Field label="Thành phố" error={errors.city}>
              <Input maxLength={50} value={draft.city} onChange={event => setField('city', event.target.value)} />
            </Field>
            <Field label="Trạng thái" error={errors.status}>
              <Select value={draft.status} onChange={event => setField('status', event.target.value as FacilityStatusValue)} options={FACILITY_STATUS_OPTIONS} />
            </Field>
            <Field label="Điện thoại liên hệ" error={errors.contactPhone}>
              <Input type="tel" maxLength={20} value={draft.contactPhone} onChange={event => setField('contactPhone', event.target.value)} />
            </Field>
            <Field label="Email" error={errors.email}>
              <Input type="email" maxLength={150} value={draft.email} onChange={event => setField('email', event.target.value)} />
            </Field>
            <Field label="Ghi chú" optional className="sm:col-span-2">
              <Textarea rows={2} value={draft.description} onChange={event => setField('description', event.target.value)} />
            </Field>
          </div>
        </section>

        <section className="flex flex-col gap-4 border-t border-line pt-6" aria-labelledby="facility-gps">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 id="facility-gps" className="text-sm font-semibold text-fg">
                Vị trí GPS
              </h3>
              <p className="text-dense text-fg-muted">
                Tọa độ giúp khách thấy chi nhánh trên bản đồ, bấm Chỉ đường và xem cơ sở nào gần họ nhất. Chi nhánh chưa có tọa độ sẽ không hiện trên bản đồ.
              </p>
            </div>
            <Button variant="secondary" size="sm" leftIcon={Locate} loading={isGeocoding} onClick={() => void lookupCoordinates()}>
              Lấy tọa độ từ địa chỉ
            </Button>
          </div>
          {geocodeError ? (
            <Alert tone="warning" title="Chưa lấy được tọa độ" onDismiss={() => setGeocodeError(null)}>
              {geocodeError} Bạn vẫn có thể bấm lên bản đồ để đặt ghim hoặc nhập vĩ độ và kinh độ.
            </Alert>
          ) : null}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Vĩ độ" error={errors.latitude} hint="Ví dụ 10.7741300">
              <Input type="number" inputMode="decimal" min={-90} max={90} step="any" value={draft.latitude} onChange={event => setField('latitude', event.target.value)} />
            </Field>
            <Field label="Kinh độ" error={errors.longitude} hint="Ví dụ 106.7033200">
              <Input type="number" inputMode="decimal" min={-180} max={180} step="any" value={draft.longitude} onChange={event => setField('longitude', event.target.value)} />
            </Field>
          </div>
          {geocodedLabel ? (
            <p className="text-dense text-fg-muted">
              Địa chỉ tìm được: <span className="text-fg">{geocodedLabel}</span>. Nếu chưa đúng, bấm lên bản đồ hoặc kéo ghim để chỉnh.
            </p>
          ) : null}
          {outsideVietnam ? (
            <Alert tone="warning">Tọa độ này nằm ngoài lãnh thổ Việt Nam. Hãy kiểm tra lại vĩ độ và kinh độ (có thể đang bị nhập ngược).</Alert>
          ) : null}
          {mapPoint ? (
            <div className="flex flex-col gap-2">
              <LazyCoordinatePickerMap value={mapPoint} onChange={placeOnMap} />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-fg-subtle">Bấm lên bản đồ hoặc kéo ghim để đặt đúng vị trí cửa kho.</p>
                <Button variant="ghost" size="sm" leftIcon={MapPinOff} onClick={clearCoordinates}>
                  Xóa tọa độ
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <LazyCoordinatePickerMap value={null} onChange={placeOnMap} />
              <p className="text-xs text-fg-subtle">Chưa có tọa độ. Bấm lên bản đồ để đặt ghim, hoặc dùng "Lấy tọa độ từ địa chỉ".</p>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-4 border-t border-line pt-6" aria-labelledby="facility-layout">
          <div>
            <h3 id="facility-layout" className="text-sm font-semibold text-fg">
              Sơ đồ mặt bằng
            </h3>
            <p className="text-dense text-fg-muted">Tên tầng, phân khu, diện tích và các điểm vận hành hiển thị trên sơ đồ của quản lý cơ sở.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SINGLE_LINE_LAYOUT_FIELDS.map(field => (
              <Field key={field.key} label={field.label}>
                <Input value={draft.layout[field.key]} onChange={event => setLayout(field.key, event.target.value)} />
              </Field>
            ))}
            {ZONE_DESCRIPTION_FIELDS.map(field => (
              <Field key={field.key} label={field.label}>
                <Textarea rows={2} value={draft.layout[field.key]} onChange={event => setLayout(field.key, event.target.value)} />
              </Field>
            ))}
          </div>
        </section>
      </form>
    </Modal>
  )
}
