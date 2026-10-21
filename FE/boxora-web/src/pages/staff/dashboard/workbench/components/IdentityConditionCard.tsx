import React, { useState } from 'react'
import { IdCard, ShieldCheck } from 'lucide-react'
import { Button, Checkbox, DescriptionList, Field, Input, Select, useToast } from '@/components/ui'
import { getApiErrorMessage } from '@/lib/apiError'
import { formatDateTime } from '@/lib/format'
import { handoverService, type HandoverPrerequisites } from '@/services/handoverService'
import { ID_CARD_TYPE_OPTIONS, getIdCardTypeLabel, getIdNumberHint, isValidIdNumber, maskIdNumber } from '../checklist'
import { ConditionCard } from './ConditionCard'

interface IdentityConditionCardProps {
  bookingId: string
  prerequisites: HandoverPrerequisites
  onVerified: (next: HandoverPrerequisites) => void
}

/**
 * Condition 4: original ID document checked at the desk. The form state lives
 * here and the step is keyed by booking, so nothing (including "original seen")
 * carries over to the next customer.
 */
export function IdentityConditionCard({ bookingId, prerequisites, onVerified }: IdentityConditionCardProps) {
  const toast = useToast()
  const verified = Boolean(prerequisites.identityVerified)
  const [idType, setIdType] = useState(
    ID_CARD_TYPE_OPTIONS.some((option) => option.value === prerequisites.idCardType) ? String(prerequisites.idCardType) : 'CCCD',
  )
  // Starts empty: the backend only returns a number once staff verified one, never the customer's phone.
  const [idNumber, setIdNumber] = useState(prerequisites.idCardNumber ?? '')
  const [originalSeen, setOriginalSeen] = useState(false)
  const [errors, setErrors] = useState<{ number?: string; seen?: string }>({})
  const [isSaving, setIsSaving] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const nextErrors: { number?: string; seen?: string } = {}
    if (!isValidIdNumber(idType, idNumber)) nextErrors.number = getIdNumberHint(idType)
    if (!originalSeen) nextErrors.seen = 'Xác nhận đã xem giấy tờ gốc trước khi lưu.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setIsSaving(true)
    try {
      const updated = await handoverService.verifyIdentity(bookingId, {
        idCardType: idType,
        idCardNumber: idType === 'PASSPORT' ? idNumber.trim().toUpperCase() : idNumber.trim(),
        notes: 'Nhân viên đã đối chiếu giấy tờ tùy thân gốc tại quầy.',
      })
      if (updated) onVerified(updated)
      toast.success('Đã đối chiếu giấy tờ', getIdCardTypeLabel(idType))
    } catch (err) {
      toast.error('Không lưu được đối chiếu giấy tờ', getApiErrorMessage(err))
    } finally {
      setIsSaving(false)
    }
  }

  const formId = `identity-form-${bookingId}`

  return (
    <ConditionCard
      index={4}
      title="Giấy tờ tùy thân gốc"
      description="Đối chiếu căn cước hoặc hộ chiếu bản gốc của khách."
      icon={IdCard}
      status={verified ? { label: 'Đã đối chiếu', tone: 'success' } : { label: 'Chưa đối chiếu', tone: 'warning' }}
      actions={
        verified ? null : (
          <Button type="submit" form={formId} size="sm" leftIcon={ShieldCheck} loading={isSaving}>
            Xác nhận đối chiếu
          </Button>
        )
      }
    >
      {verified ? (
        <DescriptionList
          columns={1}
          layout="inline"
          items={[
            { label: 'Loại giấy tờ', value: getIdCardTypeLabel(prerequisites.idCardType) },
            { label: 'Số giấy tờ', value: maskIdNumber(prerequisites.idCardNumber), mono: true },
            { label: 'Người đối chiếu', value: prerequisites.identityVerifiedByName || '—' },
            { label: 'Thời điểm', value: formatDateTime(prerequisites.identityVerifiedAt) },
          ]}
        />
      ) : (
        <form id={formId} onSubmit={submit} className="flex flex-col gap-3" noValidate>
          <div className="grid gap-3">
            <Field label="Loại giấy tờ">
              <Select
                value={idType}
                onChange={(e) => {
                  setIdType(e.target.value)
                  setErrors((current) => ({ ...current, number: undefined }))
                }}
                options={ID_CARD_TYPE_OPTIONS}
              />
            </Field>
            <Field label="Số giấy tờ" required error={errors.number} hint={errors.number ? undefined : getIdNumberHint(idType)}>
              <Input
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
                inputMode={idType === 'PASSPORT' ? 'text' : 'numeric'}
                autoComplete="off"
                autoCapitalize={idType === 'PASSPORT' ? 'characters' : 'off'}
                className="font-mono"
              />
            </Field>
          </div>
          <div className="flex flex-col gap-1">
            <Checkbox
              label="Tôi đã xem và đối chiếu giấy tờ gốc của khách tại quầy"
              checked={originalSeen}
              onCheckedChange={(checked) => {
                setOriginalSeen(checked)
                if (checked) setErrors((current) => ({ ...current, seen: undefined }))
              }}
            />
            {errors.seen ? <p className="text-xs text-danger">{errors.seen}</p> : null}
          </div>
        </form>
      )}
    </ConditionCard>
  )
}
