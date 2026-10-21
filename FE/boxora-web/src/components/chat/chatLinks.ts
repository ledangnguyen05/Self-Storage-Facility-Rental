export type ChatLinkTarget =
  | { kind: 'internal'; to: string }
  | { kind: 'external'; href: string }
  | { kind: 'blocked' }

/**
 * Model output is untrusted. Links are allowed only when they are same-site
 * paths (`/units?...`) or plain http(s) URLs; everything else (`javascript:`,
 * `data:`, protocol-relative `//host`, backslash tricks) is dropped.
 */
export function resolveChatLink(raw: string): ChatLinkTarget {
  const url = raw.trim()
  if (!url) return { kind: 'blocked' }

  if (url.startsWith('/')) {
    if (url.startsWith('//') || url.includes('\\')) return { kind: 'blocked' }
    for (let i = 0; i < url.length; i += 1) {
      if (url.charCodeAt(i) < 0x20) return { kind: 'blocked' }
    }
    return { kind: 'internal', to: url }
  }

  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return { kind: 'external', href: parsed.href }
  } catch {
    // not a URL
  }
  return { kind: 'blocked' }
}
