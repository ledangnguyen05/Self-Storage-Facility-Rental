import { formatCurrency, formatDate, formatDateTime, formatNumber } from '@/lib/format'
import type { SealingRecordResponse } from '@/services/sealingService'

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Quản trị viên',
  BUSINESS_MANAGER: 'Quản lý kinh doanh',
  FACILITY_MANAGER: 'Quản lý cơ sở',
  STAFF: 'Nhân viên cơ sở',
}

export const roleLabel = (role?: string) => (role ? (ROLE_LABELS[role] ?? role) : '—')

const escapeHtml = (value: unknown): string =>
  String(value ?? '—')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const text = (value: string | number | null | undefined) => (value === null || value === undefined || value === '' ? '—' : value)

/** Rows of the protocol, shared by the on-screen view and the printed document. */
export function protocolSections(record: SealingRecordResponse) {
  return [
    {
      title: 'Thông tin biên bản',
      rows: [
        ['Số biên bản', text(record.protocolNumber)],
        ['Số tem niêm phong', text(record.sealTagNumber)],
        ['Thời điểm niêm phong', formatDateTime(record.sealedAt)],
        ['Trạng thái', record.status === 'SEALED' ? 'Đang niêm phong' : record.status === 'UNSEALED' ? 'Đã gỡ niêm phong' : text(record.status)],
      ],
    },
    {
      title: 'Cơ sở và kho',
      rows: [
        ['Cơ sở', text(record.facilityName)],
        ['Địa chỉ', text(record.facilityAddress)],
        ['Điện thoại cơ sở', text(record.facilityPhone)],
        ['Mã kho', text(record.unitCode)],
      ],
    },
    {
      title: 'Bên thuê và hợp đồng',
      rows: [
        ['Khách thuê', text(record.customerName)],
        ['Điện thoại', text(record.customerPhone)],
        ['Email', text(record.customerEmail)],
        ['Mã hợp đồng', text(record.contractCode)],
        ['Thời hạn hợp đồng', record.contractEndDate ? `${formatDate(record.contractStartDate)} – ${formatDate(record.contractEndDate)}` : '—'],
      ],
    },
    {
      title: 'Căn cứ niêm phong',
      rows: [
        ['Số ngày quá hạn', record.overdueDays !== undefined && record.overdueDays !== null ? `${formatNumber(record.overdueDays)} ngày` : '—'],
        ['Tổng nợ tại thời điểm niêm phong', formatCurrency(record.totalDebtAmount)],
        ['Lý do', text(record.reason)],
        ['Tình trạng hàng hóa', text(record.inventorySummary)],
        ['Ghi chú', text(record.notes)],
      ],
    },
    {
      title: 'Người thực hiện',
      rows: [
        ['Người lập biên bản', `${text(record.sealedByName)} (${roleLabel(record.sealedByRole)})`],
        ['Người chứng kiến', `${text(record.witnessName)} (${roleLabel(record.witnessRole)})`],
      ],
    },
    ...(record.status === 'UNSEALED'
      ? [
          {
            title: 'Gỡ niêm phong',
            rows: [
              ['Thời điểm gỡ', formatDateTime(record.unsealedAt)],
              ['Người thực hiện', text(record.unsealedByName)],
              ['Lý do', text(record.unsealReason)],
            ],
          },
        ]
      : []),
  ] as { title: string; rows: [string, string | number][] }[]
}

/**
 * Prints only the protocol: the document is rendered into a hidden iframe (all values escaped) and the iframe
 * is printed, so the dashboard around it never reaches the printer.
 */
export function printSealingProtocol(record: SealingRecordResponse): boolean {
  const sections = protocolSections(record)
    .map(
      (section) => `
      <h2>${escapeHtml(section.title)}</h2>
      <table>${section.rows.map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join('')}</table>`,
    )
    .join('')

  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8" />
    <title>Biên bản niêm phong ${escapeHtml(record.protocolNumber)}</title>
    <style>
      @page { size: A4; margin: 16mm; }
      body { font-family: Arial, Helvetica, sans-serif; color: #101828; font-size: 12pt; line-height: 1.5; }
      h1 { font-size: 16pt; text-align: center; margin: 0 0 4px; }
      .sub { text-align: center; margin: 0 0 16px; color: #475467; }
      h2 { font-size: 12pt; margin: 16px 0 6px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #D0D5DD; padding: 6px 8px; text-align: left; vertical-align: top; }
      th { width: 38%; font-weight: 600; background: #F2F4F7; }
      .signatures { display: flex; justify-content: space-between; margin-top: 36px; text-align: center; }
      .signatures div { width: 30%; }
      .signatures p { margin: 0 0 64px; font-weight: 600; }
    </style></head><body>
    <h1>BIÊN BẢN NIÊM PHONG KHO</h1>
    <p class="sub">Số ${escapeHtml(record.protocolNumber)} · lập lúc ${escapeHtml(formatDateTime(record.sealedAt))}</p>
    ${sections}
    <div class="signatures">
      <div><p>Người lập biên bản</p>${escapeHtml(record.sealedByName)}</div>
      <div><p>Người chứng kiến</p>${escapeHtml(record.witnessName)}</div>
      <div><p>Đại diện bên thuê</p>${escapeHtml(record.customerName)}</div>
    </div>
    </body></html>`

  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.position = 'fixed'
  frame.style.width = '0'
  frame.style.height = '0'
  frame.style.border = '0'
  frame.style.right = '0'
  frame.style.bottom = '0'
  document.body.appendChild(frame)
  const doc = frame.contentDocument
  const win = frame.contentWindow
  if (!doc || !win) {
    frame.remove()
    return false
  }
  doc.open()
  doc.write(html)
  doc.close()
  const cleanup = () => window.setTimeout(() => frame.remove(), 500)
  win.addEventListener('afterprint', cleanup, { once: true })
  window.setTimeout(() => {
    win.focus()
    win.print()
    // Some browsers never fire afterprint inside an iframe.
    window.setTimeout(() => frame.remove(), 60_000)
  }, 50)
  return true
}
