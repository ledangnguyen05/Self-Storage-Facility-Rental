import {
  TICKET_CATEGORY_OPTIONS,
  TICKET_PRIORITY_OPTIONS,
  TICKET_STATUS_OPTIONS,
  type SelectOption,
} from '@/constants/statusMeta'

/** Sentinel value of every "all" filter option. */
export const ALL = 'ALL'

export const STATUS_FILTER_OPTIONS: SelectOption[] = [{ value: ALL, label: 'Tất cả trạng thái' }, ...TICKET_STATUS_OPTIONS]
export const PRIORITY_FILTER_OPTIONS: SelectOption[] = [{ value: ALL, label: 'Tất cả mức ưu tiên' }, ...TICKET_PRIORITY_OPTIONS]
export const CATEGORY_FILTER_OPTIONS: SelectOption[] = [{ value: ALL, label: 'Tất cả danh mục' }, ...TICKET_CATEGORY_OPTIONS]

export { TICKET_CATEGORY_OPTIONS, TICKET_PRIORITY_OPTIONS }

export type ContactMethod = 'PHONE' | 'EMAIL' | 'INTERNAL_CHAT' | 'OTHER'

export const CONTACT_METHOD_OPTIONS: SelectOption<ContactMethod>[] = [
  { value: 'PHONE', label: 'Gọi điện thoại' },
  { value: 'EMAIL', label: 'Gửi email' },
  { value: 'INTERNAL_CHAT', label: 'Chat nội bộ' },
  { value: 'OTHER', label: 'Trao đổi trực tiếp hoặc khác' },
]

export function getContactMethodLabel(method?: string | null): string {
  if (!method) return '—'
  return CONTACT_METHOD_OPTIONS.find(option => option.value === method.toUpperCase())?.label ?? 'Khác'
}

/** Evidence images attached to a new ticket. */
export const MAX_EVIDENCE_FILES = 3
export const MAX_EVIDENCE_SIZE_BYTES = 10 * 1024 * 1024
export const EVIDENCE_ACCEPT = 'image/jpeg,image/png,image/webp'
