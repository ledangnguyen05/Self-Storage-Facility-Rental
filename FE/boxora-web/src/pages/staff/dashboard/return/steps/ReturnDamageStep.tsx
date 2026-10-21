import React from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Badge, Button, Field, Select, Textarea } from '@/components/ui'
import { EvidencePhotoSlot } from '../../components/EvidencePhotoSlot'
import type { ReturnInspectionForm } from '../../hooks/useReturnInspection'
import { RETURN_ITEMS, RETURN_PHOTO_SLOTS, collectReturnPhotos, isInspectionComplete, isItemPassed } from '../returnInspection'

interface ReturnDamageStepProps {
  bookingId: string
  form: ReturnInspectionForm
  onBack: () => void
  onNext: () => void
}

export function ReturnDamageStep({ bookingId, form, onBack, onNext }: ReturnDamageStepProps) {
  const assessed = RETURN_ITEMS.filter((item) => form.inspection[item.key]).length
  const issues = RETURN_ITEMS.filter((item) => form.inspection[item.key] && !isItemPassed(item.key, form.inspection[item.key])).length
  const photoCount = collectReturnPhotos(form.photos).length
  const missingItems = RETURN_ITEMS.length - assessed
  const missingPhotos = RETURN_PHOTO_SLOTS.length - photoCount
  const canContinue = isInspectionComplete(form.inspection) && missingPhotos === 0

  const blockingReason = [
    missingItems > 0 ? `còn ${missingItems} hạng mục chưa đánh giá` : null,
    missingPhotos > 0 ? `thiếu ${missingPhotos} ảnh hiện trạng` : null,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3" aria-label="Hạng mục nghiệm thu">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-fg">Hạng mục kiểm tra hiện trường</h4>
          {issues > 0 ? (
            <Badge tone="warning" size="sm">
              {issues} hạng mục chưa đạt
            </Badge>
          ) : null}
        </div>
        <ul className="flex flex-col divide-y divide-line rounded-lg border border-line">
          {RETURN_ITEMS.map((item) => {
            const value = form.inspection[item.key]
            const passed = isItemPassed(item.key, value)
            return (
              <li key={item.key} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-fg">{item.label}</span>
                  {value ? (
                    <Badge tone={passed ? 'success' : 'warning'} size="sm">
                      {passed ? 'Đạt' : 'Chưa đạt'}
                    </Badge>
                  ) : null}
                </div>
                <Select
                  size="sm"
                  aria-label={item.label}
                  className="sm:w-64"
                  value={value}
                  placeholder="Chọn tình trạng"
                  onChange={(e) => form.setItem(item.key, e.target.value)}
                  options={[...(item.options as ReadonlyArray<{ value: string; label: string }>)]}
                />
              </li>
            )
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-3" aria-label="Ảnh hiện trạng trả kho">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-fg">Ảnh hiện trạng</h4>
          <span className="text-xs tabular-nums text-fg-muted">
            {photoCount}/{RETURN_PHOTO_SLOTS.length} ảnh bắt buộc
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {RETURN_PHOTO_SLOTS.map((slot) => (
            <EvidencePhotoSlot
              key={slot.key}
              label={slot.label}
              hint={slot.hint}
              required
              value={form.photos[slot.key]}
              onChange={(value) => form.setPhoto(slot.key, value)}
              bookingId={bookingId}
            />
          ))}
        </div>
      </section>

      <Field label="Ghi chú hiện trường" optional>
        <Textarea rows={2} value={form.notes} onChange={(e) => form.setNotes(e.target.value)} placeholder="Mô tả hư hại, đồ khách để lại…" />
      </Field>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-4">
        <Button variant="ghost" leftIcon={ArrowLeft} onClick={onBack} className="mr-auto">
          Quay lại
        </Button>
        {blockingReason ? <p className="text-sm text-fg-muted">Chưa thể tiếp tục: {blockingReason}.</p> : null}
        <Button rightIcon={ArrowRight} disabled={!canContinue} onClick={onNext}>
          Tiếp tục khấu trừ
        </Button>
      </div>
    </div>
  )
}
