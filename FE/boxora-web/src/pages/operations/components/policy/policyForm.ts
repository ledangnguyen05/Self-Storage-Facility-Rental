import { BOOKING_HOLD_DEFAULTS, type FacilityPolicyValues, type ResolvedFacilityPolicy } from '@/utils/facilityPolicyDefaults'

/** Every numeric field of the form: the policy numbers plus the two booking-hold rules. */
export type PolicyNumberKey = Exclude<keyof FacilityPolicyValues, 'isActive'> | 'holdGraceHours' | 'maxHoldDays'

export interface PolicyFieldDef {
  key: PolicyNumberKey
  /** Label including the unit, e.g. "Tỷ lệ tiền cọc (%)". */
  label: string
  min: number
  max: number
  step: number
  hint: string
  /** Shown under the hint for rules the system does not enforce yet, so the manager is not misled. */
  note?: string
}

export interface PolicySectionDef {
  id: string
  title: string
  description: string
  fields: readonly PolicyFieldDef[]
}

/** The groups of the facility policy form. Labels describe what the backend field really does. */
export const POLICY_SECTIONS: readonly PolicySectionDef[] = [
  {
    id: 'deposit',
    title: 'Tiền cọc và thời hạn thuê',
    description: 'Áp dụng khi khách đặt kho và khi mở gia hạn hợp đồng.',
    fields: [
      { key: 'depositPercentage', label: 'Tỷ lệ tiền cọc (%)', min: 0, max: 100, step: 5, hint: 'Phần trăm tiền thuê tháng đầu khách phải cọc.' },
      { key: 'minimumRentalMonths', label: 'Thuê tối thiểu (tháng)', min: 1, max: 36, step: 1, hint: 'Hợp đồng ngắn nhất được chấp nhận.' },
      { key: 'renewalWindowDays', label: 'Mở gia hạn trước hạn (ngày)', min: 0, max: 365, step: 1, hint: 'Khách được gia hạn trước ngày hết hạn tối đa số ngày này.' },
    ],
  },
  {
    id: 'hold',
    title: 'Giữ chỗ',
    description: 'Áp dụng cho kho đã đặt nhưng khách chưa nhận.',
    fields: [
      { key: 'holdGraceHours', label: 'Gia hạn sau giờ hẹn nhận kho (giờ)', min: 0, max: 168, step: 1, hint: 'Quá giờ hẹn cộng số giờ này mà khách chưa nhận kho, đơn tự hết hạn và kho được mở lại cho người khác.' },
      { key: 'maxHoldDays', label: 'Giữ chỗ tối đa (ngày)', min: 1, max: 90, step: 1, hint: 'Một đơn giữ chỗ không kéo dài quá số ngày này kể từ lúc khách đặt.' },
    ],
  },
  {
    id: 'cancellation',
    title: 'Hủy đặt kho và hoàn cọc',
    description: 'Mốc thời gian tính từ giờ hẹn nhận kho.',
    fields: [
      { key: 'cancellationFullRefundHours', label: 'Hủy hoàn 100% trước (giờ)', min: 0, max: 720, step: 1, hint: 'Hủy sớm hơn mốc này được hoàn toàn bộ tiền cọc.' },
      { key: 'cancellationPartialRefundHours', label: 'Hủy hoàn một phần trước (giờ)', min: 0, max: 720, step: 1, hint: 'Hủy sớm hơn mốc này được hoàn một phần.' },
      { key: 'cancellationPartialRefundPercent', label: 'Tỷ lệ hoàn một phần (%)', min: 0, max: 100, step: 5, hint: 'Phần trăm tiền cọc hoàn lại ở mốc thứ hai.' },
    ],
  },
  {
    id: 'return',
    title: 'Trả kho và hoàn cọc',
    description: 'Quy định khi khách kết thúc hợp đồng.',
    fields: [
      { key: 'returnNoticeDays', label: 'Báo trước khi trả kho (ngày)', min: 0, max: 365, step: 1, hint: 'Khách gửi yêu cầu trả kho trước tối thiểu số ngày này.' },
      { key: 'depositRefundSlaDays', label: 'SLA hoàn cọc (ngày)', min: 0, max: 365, step: 1, hint: 'Thời gian tối đa để chuyển tiền hoàn cọc sau nghiệm thu.' },
    ],
  },
  {
    id: 'overdue',
    title: 'Quá hạn và niêm phong',
    description: 'Các mốc xử lý khi khách chậm thanh toán.',
    fields: [
      { key: 'dailyLateFee', label: 'Phí quá hạn mỗi ngày (₫)', min: 0, max: 100_000_000, step: 5000, hint: 'Cộng dồn vào hóa đơn kế tiếp.' },
      { key: 'overdueGraceDays', label: 'Ân hạn quá hạn (ngày)', min: 0, max: 365, step: 1, hint: 'Chưa tính phí phạt trong số ngày này.' },
      { key: 'overdueAccessDisableDays', label: 'Khóa PIN ra vào sau (ngày)', min: 0, max: 365, step: 1, hint: 'Thu hồi mã PIN ra vào của khách khi quá hạn từng ấy ngày.' },
      { key: 'overdueSealingDays', label: 'Niêm phong kho sau (ngày)', min: 0, max: 365, step: 1, hint: 'Mốc đủ điều kiện làm thủ tục niêm phong.' },
    ],
  },
]

const NUMBER_FIELDS = POLICY_SECTIONS.flatMap(section => section.fields)

export interface PolicyFormState {
  facilityId: string
  isActive: boolean
  /** Raw input text, so a field can be cleared while typing. */
  values: Record<PolicyNumberKey, string>
}

export type PolicyFormErrors = Partial<Record<PolicyNumberKey | 'facilityId', string>>

/** Initial form state from a resolved policy (existing values merged with the backend defaults). */
export function toPolicyFormState(policy: ResolvedFacilityPolicy, facilityId: string): PolicyFormState {
  const valueOf = (key: PolicyNumberKey): number =>
    key === 'holdGraceHours'
      ? (policy.holdGraceHours ?? BOOKING_HOLD_DEFAULTS.holdGraceHours)
      : key === 'maxHoldDays'
        ? (policy.maxHoldDays ?? BOOKING_HOLD_DEFAULTS.maxHoldDays)
        : policy[key]
  const values = Object.fromEntries(NUMBER_FIELDS.map(field => [field.key, String(valueOf(field.key))])) as Record<PolicyNumberKey, string>
  return { facilityId, isActive: policy.isActive, values }
}

export function validatePolicyForm(state: PolicyFormState, needsFacility: boolean): PolicyFormErrors {
  const errors: PolicyFormErrors = {}
  if (needsFacility && !state.facilityId) errors.facilityId = 'Chọn cơ sở áp dụng chính sách.'

  for (const field of NUMBER_FIELDS) {
    const raw = state.values[field.key].trim()
    const value = Number(raw)
    if (raw === '' || !Number.isFinite(value)) errors[field.key] = 'Nhập một số hợp lệ.'
    else if (value < field.min || value > field.max) errors[field.key] = `Giá trị từ ${field.min} đến ${field.max}.`
    else if (field.step === 1 && !Number.isInteger(value)) errors[field.key] = 'Nhập số nguyên.'
  }

  if (!errors.cancellationFullRefundHours && !errors.cancellationPartialRefundHours) {
    if (Number(state.values.cancellationFullRefundHours) < Number(state.values.cancellationPartialRefundHours)) {
      errors.cancellationPartialRefundHours = 'Phải nhỏ hơn hoặc bằng mốc hoàn 100%.'
    }
  }

  // The overdue milestones must increase: grace period, then PIN lock, then sealing (same rule as the backend).
  if (!errors.overdueGraceDays && !errors.overdueAccessDisableDays && Number(state.values.overdueAccessDisableDays) < Number(state.values.overdueGraceDays)) {
    errors.overdueAccessDisableDays = 'Phải lớn hơn hoặc bằng số ngày ân hạn.'
  }
  if (!errors.overdueAccessDisableDays && !errors.overdueSealingDays && Number(state.values.overdueSealingDays) < Number(state.values.overdueAccessDisableDays)) {
    errors.overdueSealingDays = 'Phải lớn hơn hoặc bằng mốc khóa PIN.'
  }
  return errors
}

/** Numeric payload shared by the create and update requests. */
export function toPolicyPayload(state: PolicyFormState): Record<PolicyNumberKey, number> & { isActive: boolean } {
  const numbers = Object.fromEntries(NUMBER_FIELDS.map(field => [field.key, Number(state.values[field.key])])) as Record<PolicyNumberKey, number>
  return { ...numbers, isActive: state.isActive }
}
