import { addDays, formatDate, toLocalISODate } from '@/lib/format'

/** Inclusive report period as local `yyyy-MM-dd` strings. Empty strings mean "no bound". */
export interface DateRange {
  from: string
  to: string
}

export const ALL_TIME: DateRange = { from: '', to: '' }

export interface DateRangePreset {
  id: string
  label: string
  getRange: (now?: Date) => DateRange
}

export const DATE_RANGE_PRESETS: readonly DateRangePreset[] = [
  { id: 'all', label: 'Toàn bộ', getRange: () => ALL_TIME },
  {
    id: 'this-month',
    label: 'Tháng này',
    getRange: (now = new Date()) => ({
      from: toLocalISODate(new Date(now.getFullYear(), now.getMonth(), 1)),
      to: toLocalISODate(now),
    }),
  },
  {
    id: 'last-month',
    label: 'Tháng trước',
    getRange: (now = new Date()) => ({
      from: toLocalISODate(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      to: toLocalISODate(new Date(now.getFullYear(), now.getMonth(), 0)),
    }),
  },
  {
    id: 'last-7-days',
    label: '7 ngày qua',
    getRange: (now = new Date()) => ({ from: toLocalISODate(addDays(now, -7)), to: toLocalISODate(now) }),
  },
  {
    id: 'last-30-days',
    label: '30 ngày qua',
    getRange: (now = new Date()) => ({ from: toLocalISODate(addDays(now, -30)), to: toLocalISODate(now) }),
  },
  {
    id: 'this-year',
    label: 'Năm nay',
    getRange: (now = new Date()) => ({ from: toLocalISODate(new Date(now.getFullYear(), 0, 1)), to: toLocalISODate(now) }),
  },
]

export const isSameRange = (a: DateRange, b: DateRange): boolean => a.from === b.from && a.to === b.to

/** Error message for an invalid period, or null when the period can be applied. */
export function validateRange(range: DateRange): string | null {
  if (range.from && range.to && range.from > range.to) return 'Ngày bắt đầu không được sau ngày kết thúc.'
  return null
}

/**
 * Human label of the period. When only one bound is set, the period the
 * backend actually reported (`reported`) is shown instead.
 */
export function describeRange(range: DateRange, reported?: Partial<DateRange>): string {
  if (!range.from && !range.to) return 'Toàn bộ thời gian'
  if (range.from && range.to) return `${formatDate(range.from)} – ${formatDate(range.to)}`
  if (reported?.from && reported.to) return `${formatDate(reported.from)} – ${formatDate(reported.to)}`
  return range.from ? `Từ ${formatDate(range.from)}` : `Đến ${formatDate(range.to)}`
}
