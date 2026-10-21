import React, { useState } from 'react'
import { ArrowLeft, ArrowRight, CheckCheck } from 'lucide-react'
import { Badge, Button, Checkbox, Field, Textarea, cn, useToast } from '@/components/ui'
import { getApiErrorMessage } from '@/lib/apiError'
import { handoverService } from '@/services/handoverService'
import { EvidencePhotoSlot } from '../../components/EvidencePhotoSlot'
import {
  CHECKIN_CHECKLIST,
  EVIDENCE_SLOTS,
  collectPhotos,
  countPassed,
  describeChecklist,
  toChecklistPayload,
  type ChecklistState,
  type EvidencePhotos,
  type EvidenceSlotKey,
} from '../checklist'

interface InspectionChecklistStepProps {
  bookingId: string
  unitCode: string
  checklist: ChecklistState
  photos: EvidencePhotos
  notes: string
  onChecklistChange: (patch: Partial<ChecklistState>) => void
  onPhotoChange: (slot: EvidenceSlotKey, value: string | undefined) => void
  onNotesChange: (value: string) => void
  onBack: () => void
  /** Inspection saved by the backend: move to the PIN step. */
  onRecorded: () => void
}

export function InspectionChecklistStep({
  bookingId,
  unitCode,
  checklist,
  photos,
  notes,
  onChecklistChange,
  onPhotoChange,
  onNotesChange,
  onBack,
  onRecorded,
}: InspectionChecklistStepProps) {
  const toast = useToast()
  const [isSaving, setIsSaving] = useState(false)

  const passed = countPassed(checklist)
  const total = CHECKIN_CHECKLIST.length
  const photoCount = collectPhotos(photos).length
  const missingItems = total - passed
  const missingPhotos = EVIDENCE_SLOTS.length - photoCount
  const canContinue = missingItems === 0 && missingPhotos === 0

  const blockingReason = !canContinue
    ? [
        missingItems > 0 ? `còn ${missingItems} tiêu chí chưa đạt` : null,
        missingPhotos > 0 ? `thiếu ${missingPhotos} ảnh hiện trạng` : null,
      ]
        .filter(Boolean)
        .join(', ')
    : ''

  const markAll = () => {
    const patch: Partial<ChecklistState> = {}
    for (const item of CHECKIN_CHECKLIST) patch[item.key] = true
    onChecklistChange(patch)
  }

  const submit = async () => {
    if (!canContinue) return
    setIsSaving(true)
    try {
      await handoverService.recordCheckInInspection({
        bookingId,
        ...toChecklistPayload(checklist),
        evidencePhotos: collectPhotos(photos),
        unitCondition: describeChecklist(checklist),
        notes: notes.trim() || undefined,
      })
      toast.success('Đã lưu nghiệm thu kho', `Kho ${unitCode || '—'} đạt ${passed}/${total} tiêu chí.`)
      onRecorded()
    } catch (err) {
      toast.error('Không lưu được nghiệm thu', getApiErrorMessage(err))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3" aria-labelledby={`checklist-${bookingId}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h4 id={`checklist-${bookingId}`} className="text-sm font-semibold text-fg">
              Tiêu chí nghiệm thu kho {unitCode || ''}
            </h4>
            <Badge tone={passed === total ? 'success' : 'neutral'} size="sm">
              <span className="tabular-nums">
                {passed}/{total}
              </span>
            </Badge>
          </div>
          <Button variant="ghost" size="sm" leftIcon={CheckCheck} onClick={markAll} disabled={passed === total}>
            Đánh dấu tất cả đạt
          </Button>
        </div>
        <ul className="flex flex-col divide-y divide-line rounded-lg border border-line">
          {CHECKIN_CHECKLIST.map((item) => (
            <li key={item.key} className={cn('px-4 py-3 transition-colors', checklist[item.key] && 'bg-success-subtle')}>
              <Checkbox
                label={item.label}
                description={item.description}
                checked={checklist[item.key]}
                onCheckedChange={(checked) => onChecklistChange({ [item.key]: checked })}
              />
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3" aria-label="Ảnh hiện trạng">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-fg">Ảnh hiện trạng bàn giao</h4>
          <span className="text-xs tabular-nums text-fg-muted">
            {photoCount}/{EVIDENCE_SLOTS.length} ảnh bắt buộc
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {EVIDENCE_SLOTS.map((slot) => (
            <EvidencePhotoSlot
              key={slot.key}
              label={slot.label}
              hint={slot.hint}
              required
              value={photos[slot.key]}
              onChange={(value) => onPhotoChange(slot.key, value)}
              bookingId={bookingId}
              disabled={isSaving}
            />
          ))}
        </div>
        <p className="text-xs text-fg-subtle">
          Ảnh được tải lên hệ thống ngay khi bạn chọn và đính kèm vào biên bản nghiệm thu. Cần ít nhất {EVIDENCE_SLOTS.length} ảnh mới bàn giao được.
        </p>
      </section>

      <Field label="Ghi chú hiện trạng" optional>
        <Textarea rows={2} value={notes} onChange={(e) => onNotesChange(e.target.value)} placeholder="Vết trầy có sẵn, phụ kiện kèm theo…" />
      </Field>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-4">
        <Button variant="ghost" leftIcon={ArrowLeft} onClick={onBack} disabled={isSaving} className="mr-auto">
          Quay lại
        </Button>
        {blockingReason ? <p className="text-sm text-fg-muted">Chưa thể tiếp tục: {blockingReason}.</p> : null}
        <Button rightIcon={ArrowRight} disabled={!canContinue} loading={isSaving} onClick={submit}>
          Lưu nghiệm thu
        </Button>
      </div>
    </div>
  )
}
