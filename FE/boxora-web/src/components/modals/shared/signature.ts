/**
 * Signature helpers shared by the signing modal and the contract document.
 * Signatures are only ever rendered through <img src="data:...">, never as markup,
 * so stored content can not run script.
 */

/** Used only when the CSS token can not be read (matches --bx-accent). */
const INK_FALLBACK = 'rgb(8 102 245)'

/** Signature ink: the accent token, readable on light and dark surfaces and in print. */
export function readSignatureInk(): string {
  if (typeof document === 'undefined') return INK_FALLBACK
  const value = getComputedStyle(document.documentElement).getPropertyValue('--bx-accent').trim()
  return value && /^[a-z0-9(),.%\s/#-]+$/i.test(value) ? value : INK_FALLBACK
}

const SAFE_IMAGE_DATA_URL = /^data:image\/(png|jpe?g|webp|gif|svg\+xml)[;,]/i
const HTTP_URL = /^https?:\/\//i

/**
 * Turns stored signature data into a value that is safe for <img src>.
 * Accepts image data URLs, http(s) URLs, and raw SVG (encoded into a data URL).
 * Returns null when there is no usable signature.
 */
export function toSignatureImageSrc(data: string | null | undefined): string | null {
  if (typeof data !== 'string') return null
  const value = data.trim()
  if (!value) return null
  if (SAFE_IMAGE_DATA_URL.test(value) || HTTP_URL.test(value)) return value
  if (/^<svg[\s>]/i.test(value)) return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(value)}`
  return null
}

const XML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, char => XML_ESCAPES[char])
}

export const SIGNATURE_NAME_MAX_LENGTH = 60

/** Name as it will be rendered: control characters removed, spaces collapsed, length limited. */
export function normalizeSignatureName(name: string): string {
  // eslint-disable-next-line no-control-regex
  return name.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, SIGNATURE_NAME_MAX_LENGTH)
}

/** SVG signature that renders the typed name in a script-style italic. The name is XML-escaped. */
export function buildTypedSignatureDataUrl(name: string, ink: string = readSignatureInk()): string | null {
  const text = normalizeSignatureName(name)
  if (!text) return null
  const width = 480
  const height = 120
  const fontSize = Math.max(24, Math.min(56, Math.floor((width - 40) / (text.length * 0.5))))
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">` +
    `<text x="${width / 2}" y="${height / 2}" text-anchor="middle" dominant-baseline="central" ` +
    `font-family="'Segoe Script','Brush Script MT','Snell Roundhand','Lucida Handwriting',cursive" ` +
    `font-style="italic" font-size="${fontSize}" fill="${escapeXml(ink)}">${escapeXml(text)}</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
