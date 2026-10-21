import type { CheckInInspectionPayload, HandoverPrerequisites } from '@/services/handoverService'

/** The five on-site checks recorded at check-in, in display order. */
export const CHECKIN_CHECKLIST = [
  {
    key: 'doorRoll',
    field: 'doorConditionPassed',
    label: 'Cửa cuốn và then chốt',
    description: 'Đóng mở êm, then cài chắc chắn, khóa an toàn không kẹt.',
  },
  {
    key: 'cleanliness',
    field: 'cleanlinessPassed',
    label: 'Vệ sinh và độ ẩm',
    description: 'Sàn sạch, khô ráo, không rác tồn đọng hay mùi ẩm mốc.',
  },
  {
    key: 'lighting',
    field: 'smartLockPassed',
    label: 'Khóa điện tử và đèn báo',
    description: 'Bàn phím hiển thị rõ, chốt cơ nhả trơn tru.',
  },
  {
    key: 'fireSafety',
    field: 'sensorPassed',
    label: 'Báo khói và cảm biến nhiệt ẩm',
    description: 'Đầu phun và cảm biến không bị che khuất, tín hiệu bình thường.',
  },
  {
    key: 'sealPlate',
    field: 'wallStructurePassed',
    label: 'Tường vách và tem niêm phong',
    description: 'Biển số kho rõ ràng, vách không bong tróc, nứt vỡ.',
  },
] as const satisfies ReadonlyArray<{
  key: string
  field: keyof CheckInInspectionPayload
  label: string
  description: string
}>

export type ChecklistKey = (typeof CHECKIN_CHECKLIST)[number]['key']
export type ChecklistState = Record<ChecklistKey, boolean>

export const CHECKLIST_KEYS: ChecklistKey[] = CHECKIN_CHECKLIST.map((item) => item.key)

export const EMPTY_CHECKLIST: ChecklistState = {
  doorRoll: false,
  cleanliness: false,
  lighting: false,
  fireSafety: false,
  sealPlate: false,
}

export function countPassed(checklist: ChecklistState): number {
  return CHECKLIST_KEYS.filter((key) => checklist[key]).length
}

export function isChecklistComplete(checklist: ChecklistState): boolean {
  return countPassed(checklist) === CHECKLIST_KEYS.length
}

type ChecklistPayload = Pick<
  CheckInInspectionPayload,
  'doorConditionPassed' | 'cleanlinessPassed' | 'smartLockPassed' | 'sensorPassed' | 'wallStructurePassed'
>

export function toChecklistPayload(checklist: ChecklistState): ChecklistPayload {
  const payload = {} as ChecklistPayload
  for (const item of CHECKIN_CHECKLIST) payload[item.field] = Boolean(checklist[item.key])
  return payload
}

export function describeChecklist(checklist: ChecklistState): string {
  return `${countPassed(checklist)}/${CHECKLIST_KEYS.length} tiêu chí nghiệm thu đạt`
}

/** The two evidence photos required before the PIN can be issued. */
export const EVIDENCE_SLOTS = [
  { key: 'door', label: 'Cửa ngoài và biển số kho', hint: 'Chụp rõ cửa cuốn và biển số kho.' },
  { key: 'interior', label: 'Sàn và vách bên trong', hint: 'Chụp toàn cảnh sàn và vách trong kho.' },
] as const

export type EvidenceSlotKey = (typeof EVIDENCE_SLOTS)[number]['key']
export type EvidencePhotos = Partial<Record<EvidenceSlotKey, string>>

export function collectPhotos(photos: EvidencePhotos): string[] {
  return EVIDENCE_SLOTS.map((slot) => photos[slot.key]).filter((photo): photo is string => Boolean(photo))
}

/** BR-RULE-005: the backend decides; all four conditions plus `eligibleForInspection`. */
export function isCheckInReady(prerequisites: HandoverPrerequisites | null | undefined): boolean {
  if (!prerequisites) return false
  return Boolean(
    prerequisites.depositSatisfied &&
      prerequisites.firstMonthRentSatisfied &&
      prerequisites.contractSigned &&
      prerequisites.identityVerified &&
      prerequisites.eligibleForInspection,
  )
}

export const ID_CARD_TYPE_OPTIONS = [
  { value: 'CCCD', label: 'Căn cước công dân' },
  { value: 'PASSPORT', label: 'Hộ chiếu' },
]

export function getIdCardTypeLabel(value: string | null | undefined): string {
  const option = ID_CARD_TYPE_OPTIONS.find((item) => item.value === String(value ?? '').toUpperCase())
  return option?.label ?? (value ? String(value) : '—')
}

/**
 * Same rule as the backend (`IdentityDocuments`): a CCCD has 9 (old CMND) or 12 digits, a passport 6–12 letters
 * and digits with at least one digit (Vietnamese passports look like B1234567). A 10-digit phone number is no ID.
 */
export function isValidIdNumber(type: string | null | undefined, value: string): boolean {
  const text = value.trim()
  if (String(type ?? '').toUpperCase() === 'PASSPORT') return /^(?=.*[0-9])[A-Za-z0-9]{6,12}$/.test(text)
  return /^([0-9]{9}|[0-9]{12})$/.test(text)
}

/** Printed documents and receipts show only the last four characters of an ID number (`••••••••3891`). */
export function maskIdNumber(value: string | null | undefined): string {
  const text = (value ?? '').trim()
  if (!text) return '—'
  if (text.length <= 4) return '•'.repeat(text.length)
  return `${'•'.repeat(text.length - 4)}${text.slice(-4)}`
}

export function getIdNumberHint(type: string | null | undefined): string {
  return String(type ?? '').toUpperCase() === 'PASSPORT'
    ? 'Hộ chiếu gồm 6–12 ký tự chữ và số, có ít nhất một chữ số (ví dụ B1234567).'
    : 'CCCD gồm 12 chữ số (CMND cũ gồm 9 chữ số).'
}

export function getSigningMethodLabel(method: string | null | undefined): string {
  const value = String(method ?? '').toUpperCase()
  if (value === 'PAPER' || value === 'IN_PERSON') return 'Ký giấy tại quầy'
  if (value) return 'Ký điện tử'
  return '—'
}
