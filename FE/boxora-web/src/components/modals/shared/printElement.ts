/**
 * Prints one element (and nothing else of the page) through a hidden iframe.
 *
 * The app's modals are portaled to <body>, so `window.print()` would also print
 * the page behind them. The iframe copies the page's stylesheets and the
 * element's markup, so the printout contains only the document, in the light
 * theme (the iframe's <html> has no `.dark` class).
 */

const PRINT_CSS = `
@page { size: A4; margin: 16mm; }
* { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
html, body { margin: 0; padding: 0; }
`

const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => HTML_ESCAPES[char])

export function printElement(source: HTMLElement | null, title: string): void {
  if (!source || typeof document === 'undefined') throw new Error('Không có nội dung để in.')

  const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map(node => node.outerHTML)
    .join('\n')

  const iframe = document.createElement('iframe')
  // Same-origin so the parent can call print(); no scripts can run inside it.
  iframe.setAttribute('sandbox', 'allow-same-origin allow-modals')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.tabIndex = -1
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;'

  let removed = false
  const cleanup = () => {
    if (removed) return
    removed = true
    iframe.remove()
  }

  iframe.onload = () => {
    const win = iframe.contentWindow
    if (!win) {
      cleanup()
      return
    }
    win.addEventListener('afterprint', cleanup)
    win.focus()
    win.print()
    // Browsers that do not fire afterprint: drop the iframe after a while.
    window.setTimeout(cleanup, 120_000)
  }

  iframe.srcdoc =
    `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>` +
    `${styles}<style>${PRINT_CSS}</style></head><body>${source.outerHTML}</body></html>`
  document.body.appendChild(iframe)
}
