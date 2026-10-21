import React, { useState } from 'react'
import { Alert, Button, Field, Input, Modal, Select, Switch } from '@/components/ui'
import { getApiErrorMessage } from '@/lib/apiError'
import { facilityPolicyService } from '@/services/facilityPolicyService'
import type { Facility, FacilityPolicy } from '@/types'
import { resolvePolicy } from '@/utils/facilityPolicyDefaults'
import {
  POLICY_SECTIONS,
  toPolicyFormState,
  toPolicyPayload,
  validatePolicyForm,
  type PolicyFormErrors,
  type PolicyFormState,
  type PolicyNumberKey,
} from './policy/policyForm'

export interface FacilityPolicyModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (policy: FacilityPolicy, isNew: boolean) => void
  /** Facility the policy belongs to. When omitted (create mode) the user picks one from `availableFacilities`. */
  facility: Facility | null
  existingPolicy: FacilityPolicy | null
  availableFacilities?: Facility[]
}

const FORM_ID = 'facility-policy-form'

/** Create or edit a facility policy. The dialog is mounted only while open, so the form starts fresh each time. */
export const FacilityPolicyModal: React.FC<FacilityPolicyModalProps> = ({ isOpen, ...props }) =>
  isOpen ? <FacilityPolicyDialog {...props} /> : null

function FacilityPolicyDialog({ onClose, onSuccess, facility, existingPolicy, availableFacilities = [] }: Omit<FacilityPolicyModalProps, 'isOpen'>) {
  const isEdit = Boolean(existingPolicy?.id)
  const needsFacilityChoice = !facility && !isEdit

  const [form, setForm] = useState<PolicyFormState>(() => {
    // Never pre-pick a facility when there is a choice: pressing "Tạo chính sách" right away must not create a policy for a
    // branch the manager did not choose. A single candidate is the only exception (there is nothing to choose between).
    const facilityId = existingPolicy?.facilityId || facility?.id || (availableFacilities.length === 1 ? availableFacilities[0].id : '')
    return toPolicyFormState(resolvePolicy(existingPolicy, facilityId), facilityId)
  })
  const [errors, setErrors] = useState<PolicyFormErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const targetFacility =
    facility ?? availableFacilities.find(item => item.id === form.facilityId) ?? null
  const targetName = targetFacility?.name ?? existingPolicy?.facilityName ?? 'Cơ sở'

  const setValue = (key: PolicyNumberKey, value: string) => {
    setForm(current => ({ ...current, values: { ...current.values, [key]: value } }))
    setErrors(current => (current[key] ? { ...current, [key]: undefined } : current))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitError(null)
    const nextErrors = validatePolicyForm(form, needsFacilityChoice)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setIsSubmitting(true)
    try {
      const payload = toPolicyPayload(form)
      if (isEdit && existingPolicy) {
        onSuccess(await facilityPolicyService.update(existingPolicy.id, payload), false)
      } else {
        onSuccess(await facilityPolicyService.create({ ...payload, facilityId: form.facilityId }), true)
      }
      onClose()
    } catch (err) {
      setSubmitError(getApiErrorMessage(err, isEdit ? 'Không thể cập nhật chính sách cơ sở.' : 'Không thể tạo chính sách cơ sở.'))
      setIsSubmitting(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!isSubmitting}
      size="lg"
      title={isEdit ? 'Chỉnh sửa chính sách cơ sở' : 'Tạo chính sách cơ sở'}
      description={needsFacilityChoice && !targetFacility ? 'Chọn cơ sở sẽ áp dụng chính sách riêng.' : targetName}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button type="submit" form={FORM_ID} loading={isSubmitting}>
            {isEdit ? 'Lưu thay đổi' : 'Tạo chính sách'}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
        {submitError ? (
          <Alert tone="danger" title="Không thể lưu chính sách">
            {submitError}
          </Alert>
        ) : null}

        <Switch
          labelPosition="start"
          label="Áp dụng chính sách"
          description="Khi tắt, cơ sở dùng giá trị mặc định của hệ thống."
          checked={form.isActive}
          onCheckedChange={isActive => setForm(current => ({ ...current, isActive }))}
        />

        {needsFacilityChoice ? (
          <Field label="Cơ sở áp dụng" required error={errors.facilityId}>
            <Select
              value={form.facilityId}
              placeholder="Chọn cơ sở"
              onChange={event => {
                setForm(current => ({ ...current, facilityId: event.target.value }))
                setErrors(current => ({ ...current, facilityId: undefined }))
              }}
              options={availableFacilities.map(item => ({ value: item.id, label: item.code ? `${item.name} (${item.code})` : item.name }))}
            />
          </Field>
        ) : null}

        {POLICY_SECTIONS.map(section => (
          <fieldset key={section.id} className="flex min-w-0 flex-col gap-3 border-t border-line pt-5 first-of-type:border-t-0 first-of-type:pt-0">
            <legend className="sr-only">{section.title}</legend>
            <div>
              <h3 className="text-sm font-semibold text-fg">{section.title}</h3>
              <p className="text-dense text-fg-muted">{section.description}</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {section.fields.map(field => (
                <Field key={field.key} label={field.label} hint={field.note ? `${field.hint} ${field.note}` : field.hint} error={errors[field.key]} required>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    value={form.values[field.key]}
                    onChange={event => setValue(field.key, event.target.value)}
                  />
                </Field>
              ))}
            </div>
          </fieldset>
        ))}
      </form>
    </Modal>
  )
}
