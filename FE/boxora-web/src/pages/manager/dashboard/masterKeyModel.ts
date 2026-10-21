import type { Tone } from '@/components/ui'
import type { MasterKeyOverrideCategory, MasterKeyOverrideSeverity } from '@/services/masterKeyService'

export const MASTER_KEY_CATEGORY_LABELS: Record<MasterKeyOverrideCategory, string> = {
  LIFE_AND_SAFETY: 'An toàn tính mạng, cháy nổ, rò rỉ',
  LAW_ENFORCEMENT: 'Yêu cầu của cơ quan chức năng',
  POLICY_ENFORCEMENT: 'Xử lý vi phạm hợp đồng, niêm phong',
  TECHNICAL_INCIDENT: 'Sự cố kỹ thuật của khóa',
  SPECIAL_CIRCUMSTANCE: 'Tình huống đặc biệt khác',
}

export const MASTER_KEY_SEVERITY_META: Record<MasterKeyOverrideSeverity, { label: string; tone: Tone }> = {
  CRITICAL: { label: 'Khẩn cấp', tone: 'danger' },
  HIGH: { label: 'Cao', tone: 'warning' },
  STANDARD: { label: 'Tiêu chuẩn', tone: 'neutral' },
}

export const MASTER_KEY_CATEGORY_OPTIONS = (Object.keys(MASTER_KEY_CATEGORY_LABELS) as MasterKeyOverrideCategory[]).map((value) => ({
  value,
  label: MASTER_KEY_CATEGORY_LABELS[value],
}))

export const MASTER_KEY_SEVERITY_OPTIONS = (Object.keys(MASTER_KEY_SEVERITY_META) as MasterKeyOverrideSeverity[]).map((value) => ({
  value,
  label: MASTER_KEY_SEVERITY_META[value].label,
}))

export const masterKeyCategoryLabel = (value: string) =>
  MASTER_KEY_CATEGORY_LABELS[value as MasterKeyOverrideCategory] ?? value

export const masterKeySeverityMeta = (value: string) =>
  MASTER_KEY_SEVERITY_META[value as MasterKeyOverrideSeverity] ?? { label: value, tone: 'neutral' as Tone }
