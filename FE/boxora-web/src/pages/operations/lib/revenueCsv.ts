import { downloadCsv, escapeCsvCell, toCsv, type CsvColumn } from '@/lib/csv'
import { formatDateTime, todayISO } from '@/lib/format'
import type { RevenueReport } from '@/types'
import { describeRange, type DateRange } from './dateRange'

type RevenueRow = NonNullable<RevenueReport['byFacility']>[number]

/**
 * Money columns add up: net revenue = collected - refunded, and collected = rent + deposit + renewal + other charges.
 * Online booking payments are already split into deposit and first rent by the server.
 */
const COLUMNS: CsvColumn<RevenueRow>[] = [
  { header: 'Cơ sở', accessor: row => row.facilityName ?? 'Chưa gắn với cơ sở' },
  { header: 'Doanh thu thực thu (VND)', accessor: 'totalRevenue' },
  { header: 'Tổng đã thu (VND)', accessor: 'collectedAmount' },
  { header: 'Đã hoàn khách (VND)', accessor: 'refundedAmount' },
  { header: 'Tiền thuê (VND)', accessor: 'rentalFeeRevenue' },
  { header: 'Gia hạn (VND)', accessor: 'renewalFeeRevenue' },
  { header: 'Tiền cọc (VND)', accessor: 'depositRevenue' },
  { header: 'Phí khác (VND)', accessor: 'extraChargeRevenue' },
  { header: 'Hoàn tiền đang chờ (VND)', accessor: 'pendingRefundAmount' },
  { header: 'Số thanh toán', accessor: 'paymentCount' },
]

/** What the exported file covers: shown in its name and in the lines above the table. */
export interface RevenueCsvScope {
  /** Facility the report is limited to; undefined means the whole system. */
  facilityName?: string
  /** Period picked on the page (empty bounds = no limit). */
  range: DateRange
  /** Period the server reported, used when only one bound was picked. */
  reported?: Partial<DateRange>
}

const LINE_BREAK = '\r\n'
const BOM = '\uFEFF'

/** `Boxora District 7` -> `boxora-district-7`; used only for file names. */
export function toFileSlug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** `boxora-doanh-thu_toan-he-thong_2026-01-01_2026-10-21.csv` (extension added by the downloader). */
export function revenueCsvFileName(scope: RevenueCsvScope, today: string = todayISO()): string {
  const facility = scope.facilityName ? toFileSlug(scope.facilityName) || 'co-so' : 'toan-he-thong'
  const { from, to } = scope.range
  const period =
    from && to ? `${from}_${to}` : from ? `tu-${from}_den-${today}` : to ? `den-${to}` : `toan-bo-thoi-gian_den-${today}`
  return `boxora-doanh-thu_${facility}_${period}`
}

/** CSV text: a few lines naming the report, scope and period, a blank line, then the per-facility table. */
export function buildRevenueCsv(rows: readonly RevenueRow[], scope: RevenueCsvScope, now: Date = new Date()): string {
  const meta = [
    ['Báo cáo', 'Doanh thu thực thu theo cơ sở'],
    ['Phạm vi', scope.facilityName ?? 'Toàn hệ thống'],
    ['Kỳ báo cáo', describeRange(scope.range, scope.reported)],
    ['Thời điểm xuất', formatDateTime(now)],
    ['Đơn vị tiền', 'VND (đồng)'],
  ]
    .map(cells => cells.map(escapeCsvCell).join(','))
    .join(LINE_BREAK)
  // toCsv starts with a BOM: keep a single one at the very top of the file.
  const table = toCsv(rows, COLUMNS).replace(BOM, '')
  return `${BOM}${meta}${LINE_BREAK}${LINE_BREAK}${table}`
}

/** Downloads the per-facility revenue of the current report as CSV. */
export function exportRevenueCsv(rows: readonly RevenueRow[], scope: RevenueCsvScope): void {
  downloadCsv(revenueCsvFileName(scope), buildRevenueCsv(rows, scope))
}
