/** Minimal client-side JWT payload decoding (no signature verification: display/routing only). */

export interface JwtPayload {
  sub?: string
  role?: string
  type?: string
  exp?: number
  iat?: number
  [claim: string]: unknown
}

export function decodeJwtPayload(token: string | null | undefined): JwtPayload | null {
  if (!token) return null
  try {
    const part = token.split('.')[1]
    if (!part) return null
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
    const binary = atob(padded)
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
    const json = new TextDecoder().decode(bytes)
    const payload: unknown = JSON.parse(json)
    return payload && typeof payload === 'object' ? (payload as JwtPayload) : null
  } catch {
    return null
  }
}

/** `role` claim of an access token, if present. */
export function getJwtRole(token: string | null | undefined): string | null {
  const role = decodeJwtPayload(token)?.role
  return typeof role === 'string' && role.trim() ? role.trim() : null
}
