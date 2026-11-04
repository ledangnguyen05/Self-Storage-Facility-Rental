/**
 * Utility for exporting reports to Microsoft Excel (.xls XML Spreadsheet) and CSV (.csv with UTF-8 BOM)
 * Guarantees 100% Vietnamese character encoding compatibility without mojibake (lỗi font tiếng Việt).
 */

export interface ExcelCell {
  val: string | number | null | undefined
  type?: 'String' | 'Number'
  bold?: boolean
  align?: 'Left' | 'Center' | 'Right'
  style?: 'Default' | 'Title' | 'Subtitle' | 'Header' | 'Section' | 'Number' | 'BoldNumber' | 'Total'
}

export interface ExcelColumn {
  width: number
}

export function escapeXml(str: any): string {
  if (str === null || str === undefined) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function buildExcelXml(
  sheetName: string,
  columns: ExcelColumn[],
  rows: ExcelCell[][]
): string {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#1E293B"/>
  </Style>
  <Style ss:ID="Title">
   <Font ss:FontName="Segoe UI" ss:Size="14" ss:Bold="1" ss:Color="#0F172A"/>
   <Alignment ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="Subtitle">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Italic="1" ss:Color="#64748B"/>
   <Alignment ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="Section">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#0F172A"/>
   <Interior ss:Color="#E2E8F0" ss:Pattern="Solid"/>
   <Alignment ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="Header">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#0F172A" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94A3B8"/>
   </Borders>
  </Style>
  <Style ss:ID="Number">
   <NumberFormat ss:Format="#,##0"/>
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="BoldNumber">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#0F172A"/>
   <NumberFormat ss:Format="#,##0"/>
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="Total">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#0F172A"/>
   <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94A3B8"/>
    <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="2" ss:Color="#94A3B8"/>
   </Borders>
   <NumberFormat ss:Format="#,##0"/>
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="${escapeXml(sheetName || 'Báo Cáo')}">
  <Table ss:DefaultColumnWidth="100">
`

  // Add column widths
  if (columns && columns.length > 0) {
    for (const col of columns) {
      xml += `   <Column ss:Width="${col.width || 100}"/>\n`
    }
  }

  // Add rows
  for (const row of rows) {
    xml += '   <Row>\n'
    for (const cell of row) {
      const styleId = cell.style ? ` ss:StyleID="${cell.style}"` : ''
      const isNum = cell.type === 'Number' || (typeof cell.val === 'number' && !isNaN(cell.val))
      const type = isNum ? 'Number' : 'String'
      const val = isNum ? Number(cell.val || 0) : escapeXml(cell.val)
      xml += `    <Cell${styleId}><Data ss:Type="${type}">${val}</Data></Cell>\n`
    }
    xml += '   </Row>\n'
  }

  xml += `  </Table>
 </Worksheet>
</Workbook>`

  return xml
}

export function downloadFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function downloadExcel(
  filename: string,
  sheetName: string,
  columns: ExcelColumn[],
  rows: ExcelCell[][]
): void {
  const xml = buildExcelXml(sheetName, columns, rows)
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' })
  const finalFilename = filename.endsWith('.xls') ? filename : `${filename}.xls`
  downloadFile(blob, finalFilename)
}

export function downloadCsv(filename: string, csvContent: string): void {
  // Always include UTF-8 BOM \uFEFF and sep=, so Excel & WPS on Windows parse UTF-8 Vietnamese properly
  let content = csvContent.replace(/^\uFEFF/, '')
  if (!content.startsWith('sep=')) {
    content = 'sep=,\r\n' + content
  }
  const withBom = '\uFEFF' + content
  const blob = new Blob([withBom], { type: 'text/csv;charset=utf-8;' })
  const finalFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`
  downloadFile(blob, finalFilename)
}

