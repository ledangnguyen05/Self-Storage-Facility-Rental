/**
 * Display formatters. Every formatter is null-safe and returns EMPTY_VALUE ('—')
 * for null, undefined, empty strings and unparseable input.
 */

export const EMPTY_VALUE = '—'

/** Non-breaking space keeps "1.250.000 ₫" on one line. */
const NBSP = ' '

export type NumericInput = number | string | null | undefined
export type DateInput = Date | string | number | null | undefined

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME_ONLY = /^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/

const pad2 = (n: number) => String(n).padStart(2, '0')

/** Parses a number from number/string input. Returns null when empty or not finite. */
export function toNumber(value: NumericInput): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Parses a Date. `yyyy-MM-dd` strings (backend LocalDate) are read as LOCAL
 * midnight instead of UTC midnight. Returns null for empty or invalid input.
 */
export function parseDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value === 'string') {
    const trimmed = value.trim()
    const match = DATE_ONLY.exec(trimmed)
    if (match) {
      const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
      return Number.isNaN(d.getTime()) ? null : d
    }
    const d = new Date(trimmed)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export interface FormatNumberOptions {
  minimumFractionDigits?: number
  maximumFractionDigits?: number
}

/** `formatNumber(1250000)` → `1.250.000`; `formatNumber(3.5)` → `3,5`. */
export function formatNumber(value: NumericInput, options: FormatNumberOptions = {}): string {
  const n = toNumber(value)
  if (n === null) return EMPTY_VALUE
  const { maximumFractionDigits = 2, minimumFractionDigits = 0 } = options
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits,
    maximumFractionDigits: Math.max(minimumFractionDigits, maximumFractionDigits),
  }).format(n)
}

/** `formatCurrency(1250000)` → `1.250.000 ₫` (VND, no decimals, non-breaking space). */
export function formatCurrency(value: NumericInput): string {
  const n = toNumber(value)
  if (n === null) return EMPTY_VALUE
  return `${formatNumber(Math.round(n), { maximumFractionDigits: 0 })}${NBSP}₫`
}

export interface FormatPercentOptions {
  fractionDigits?: number
  /** Set when the input is a ratio (0.85) instead of a percentage (85). */
  isRatio?: boolean
}

/** `formatPercent(85.5, { fractionDigits: 1 })` → `85,5%`; `formatPercent(0.4, { isRatio: true })` → `40%`. */
export function formatPercent(value: NumericInput, options: FormatPercentOptions = {}): string {
  const n = toNumber(value)
  if (n === null) return EMPTY_VALUE
  const { fractionDigits = 0, isRatio = false } = options
  const pct = isRatio ? n * 100 : n
  return `${formatNumber(pct, { maximumFractionDigits: fractionDigits })}%`
}

/** `dd/MM/yyyy` */
export function formatDate(value: DateInput): string {
  const d = parseDate(value)
  if (!d) return EMPTY_VALUE
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`
}

/** `dd/MM/yyyy HH:mm` */
export function formatDateTime(value: DateInput): string {
  const d = parseDate(value)
  if (!d) return EMPTY_VALUE
  return `${formatDate(d)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/** `HH:mm`. Also accepts backend LocalTime strings such as `08:00:00`. */
export function formatTime(value: DateInput): string {
  if (typeof value === 'string') {
    const match = TIME_ONLY.exec(value.trim())
    if (match) return `${pad2(Number(match[1]))}:${match[2]}`
  }
  const d = parseDate(value)
  if (!d) return EMPTY_VALUE
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/**
 * Short Vietnamese relative time: `Vừa xong`, `5 phút trước`, `3 giờ trước`,
 * `2 ngày trước`, `2 giờ nữa`. Falls back to `formatDate` beyond 30 days.
 */
export function formatRelativeTime(value: DateInput, now: Date = new Date()): string {
  const d = parseDate(value)
  if (!d) return EMPTY_VALUE
  const diff = now.getTime() - d.getTime()
  const abs = Math.abs(diff)
  if (abs < 45_000) return 'Vừa xong'
  if (abs >= 30 * DAY) return formatDate(d)

  let amount: number
  let unit: string
  if (abs < HOUR) {
    amount = Math.max(1, Math.round(abs / MINUTE))
    unit = 'phút'
  } else if (abs < DAY) {
    amount = Math.round(abs / HOUR)
    unit = 'giờ'
  } else {
    amount = Math.round(abs / DAY)
    unit = 'ngày'
  }
  return diff >= 0 ? `${amount} ${unit} trước` : `${amount} ${unit} nữa`
}

/** LOCAL calendar date as `yyyy-MM-dd`. Returns '' for invalid input. */
export function toLocalISODate(value: DateInput): string {
  const d = parseDate(value)
  if (!d) return ''
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** Today's LOCAL date as `yyyy-MM-dd` (never derived from `toISOString()`, which is UTC). */
export function todayISO(): string {
  return toLocalISODate(new Date())
}

/**
 * Returns a new Date `days` calendar days after `value` (negative to go back).
 * Invalid input yields an Invalid Date, which every formatter renders as '—'.
 */
export function addDays(value: Date | string | number, days: number): Date {
  const base = parseDate(value)
  if (!base) return new Date(Number.NaN)
  const next = new Date(base.getTime())
  next.setDate(next.getDate() + days)
  return next
}
