import { getPaymentMethodMeta, getPaymentTypeMeta } from '@/constants/statusMeta'
import { formatNumber } from '@/lib/format'
import type { PaymentChannelReport, RevenueStreamKey, RevenueTrend } from '@/types'

/* ---------------------------------------------------------------- revenue by month */

/** Order and colour slot of each revenue stream (colour = chart-N token). */
export const REVENUE_STREAMS: readonly RevenueStreamKey[] = ['RENTAL_FEE', 'BOOKING_PAYMENT', 'DEPOSIT', 'RENEWAL_FEE', 'EXTRA_CHARGE']
export type RevenueStream = RevenueStreamKey

export const getRevenueStreamLabel = (stream: RevenueStream): string => getPaymentTypeMeta(stream).label

export interface ChartMonth {
  monthKey: string
  /** `T03/26` */
  label: string
  /** Money collected in the month (the bar height). */
  total: number
  /** Money refunded to customers in the month. */
  refunded: number
  byStream: Record<RevenueStream, number>
}

const emptyStreams = (): Record<RevenueStream, number> => ({
  RENTAL_FEE: 0,
  BOOKING_PAYMENT: 0,
  DEPOSIT: 0,
  RENEWAL_FEE: 0,
  EXTRA_CHARGE: 0,
})

/**
 * Server months (already cut to the selected period) as chart columns.
 * With no start date ("Toàn bộ thời gian") the series begins at the first month that collected money: earlier
 * months that only hold refunds are not drawn, but their refunds stay in the trend totals.
 */
export function toChartMonths(trend: RevenueTrend | undefined): ChartMonth[] {
  const serverMonths = trend?.months ?? []
  const firstCollected = serverMonths.findIndex(month => month.collectedAmount > 0)
  const visible = !trend?.fromDate && firstCollected > 0 ? serverMonths.slice(firstCollected) : serverMonths
  return visible.map(month => {
    const [year = '', monthNumber = ''] = month.month.split('-')
    return {
      monthKey: month.month,
      label: `T${monthNumber}/${year.slice(2)}`,
      total: month.collectedAmount,
      refunded: month.refundedAmount,
      byStream: { ...emptyStreams(), ...month.collectedByType },
    }
  })
}

/** `1,5 tỷ`, `12,5 tr`, `850 k`. */
export function formatCompactVnd(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) return `${formatNumber(value / 1_000_000_000, { maximumFractionDigits: 1 })} tỷ`
  if (abs >= 1_000_000) return `${formatNumber(value / 1_000_000, { maximumFractionDigits: 1 })} tr`
  if (abs >= 1_000) return `${formatNumber(value / 1_000, { maximumFractionDigits: 0 })} k`
  return formatNumber(value)
}

/* ---------------------------------------------------------------- payment channels */

/** Stable colour slot per channel, so a channel keeps its colour when the filter changes. */
const CHANNEL_ORDER = ['VNPAY', 'BANK_TRANSFER', 'MOMO', 'CASH', 'ONLINE', 'OTHER'] as const
type ChannelKey = (typeof CHANNEL_ORDER)[number]

export interface ChannelSlice {
  key: ChannelKey
  label: string
  count: number
  amount: number
  /** Index into the chart palette. */
  colorIndex: number
}

const toChannel = (method: string | undefined): ChannelKey => {
  const key = (method ?? '').toUpperCase()
  return (CHANNEL_ORDER as readonly string[]).includes(key) ? (key as ChannelKey) : 'OTHER'
}

/** Channels of the selected period (largest first). Methods the chart has no slot for are merged into "Khác". */
export function toChannelSlices(report: PaymentChannelReport | undefined): ChannelSlice[] {
  const slices = new Map<ChannelKey, ChannelSlice>()
  for (const channel of report?.channels ?? []) {
    const key = toChannel(channel.method)
    const slice = slices.get(key) ?? {
      key,
      label: key === 'OTHER' ? 'Khác' : getPaymentMethodMeta(key).label,
      count: 0,
      amount: 0,
      colorIndex: CHANNEL_ORDER.indexOf(key),
    }
    slice.count += channel.count
    slice.amount += channel.amount
    slices.set(key, slice)
  }
  return [...slices.values()].sort((a, b) => b.count - a.count)
}
