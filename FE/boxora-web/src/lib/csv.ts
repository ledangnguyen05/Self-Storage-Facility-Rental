/** RFC 4180 CSV helpers. Output starts with a UTF-8 BOM so Excel reads Vietnamese correctly. */

export interface CsvColumn<T> {
  /** Header cell text. */
  header: string
  /** Property name, or a function returning the cell value for a row. */
  accessor: keyof T | ((row: T, index: number) => unknown)
}

const BOM = '﻿'
const LINE_BREAK = '\r\n'

function toCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString()
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/** Neutralises spreadsheet formulas (`=`, `+`, `-`, `@`) in text cells; plain numbers are kept. */
function guardFormula(text: string): string {
  if (!/^[=+\-@\t\r]/.test(text)) return text
  return /^[+-]?\d+([.,]\d+)?$/.test(text) ? text : `'${text}`
}

/** Quotes a cell when it contains a comma, quote, CR or LF; doubles embedded quotes. */
export function escapeCsvCell(value: unknown): string {
  const text = typeof value === 'number' ? toCell(value) : guardFormula(toCell(value))
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/**
 * Builds a CSV string (BOM + header row + data rows, CRLF line endings).
 * `toCsv(rows, [{ header: 'Mã', accessor: 'code' }, { header: 'Số tiền', accessor: r => r.amount }])`
 */
export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const header = columns.map((c) => escapeCsvCell(c.header)).join(',')
  const body = rows.map((row, index) =>
    columns
      .map((c) => {
        const raw = typeof c.accessor === 'function' ? c.accessor(row, index) : row[c.accessor]
        return escapeCsvCell(raw)
      })
      .join(',')
  )
  return BOM + [header, ...body].join(LINE_BREAK)
}

/** Triggers a browser download of `csv` as `filename` and revokes the object URL afterwards. */
export function downloadCsv(filename: string, csv: string): void {
  const name = filename.toLowerCase().endsWith('.csv') ? filename : `${filename}.csv`
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.rel = 'noopener'
  link.style.display = 'none'
  document.body.appendChild(link)
  try {
    link.click()
  } finally {
    link.remove()
    // Revoke on the next tick so the download has started in every browser.
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }
}
