import { useCallback, useEffect, useRef, useState } from 'react'
import { resolveSignedUrl, signUploadUrl, toUploadPath } from '@/services/fileService'

export type SignedUrlPhase = 'idle' | 'loading' | 'ready' | 'denied' | 'missing' | 'error'

export interface SignedUrlState {
  /** Link to put in `src` / `href`; null until `phase` is `ready`. */
  src: string | null
  phase: SignedUrlPhase
  /** Asks the API for a new link (a link that stopped working, for example after the computer slept). */
  refresh: () => void
}

interface Entry {
  url: string | null | undefined
  src: string | null
  phase: SignedUrlPhase
}

/** A link is renewed this long before the server stops accepting it. */
const RENEW_BEFORE_MS = 90_000
const MIN_RENEW_DELAY_MS = 30_000

/**
 * Turns a stored upload path (`/uploads/handover/….jpg`) into a short-lived signed link the browser can load.
 * The link is renewed in the background while the component stays mounted. Values that are not upload paths (an old
 * external url) pass through unchanged, and an empty value stays idle.
 */
export function useSignedUrl(url: string | null | undefined): SignedUrlState {
  const [entry, setEntry] = useState<Entry>({ url, src: null, phase: 'idle' })
  const [renewal, setRenewal] = useState(0)
  const forceNext = useRef(false)

  useEffect(() => {
    const value = url?.trim()
    if (!value) return

    let cancelled = false
    let timer: number | undefined
    const path = toUploadPath(value)
    if (!path) {
      // Not something we host (legacy external link): nothing to sign.
      setEntry({ url, src: value, phase: 'ready' })
      return
    }

    setEntry(current => (current.url === url && current.src ? current : { url, src: null, phase: 'loading' }))
    const force = forceNext.current
    forceNext.current = false
    signUploadUrl(path, { force })
      .then(file => {
        if (cancelled) return
        if (file.status === 'OK' && file.signedUrl) {
          setEntry({ url, src: resolveSignedUrl(file.signedUrl), phase: 'ready' })
          if (file.expiresAt !== undefined) {
            const delay = Math.max(MIN_RENEW_DELAY_MS, file.expiresAt - Date.now() - RENEW_BEFORE_MS)
            timer = window.setTimeout(() => {
              forceNext.current = true
              setRenewal(count => count + 1)
            }, delay)
          }
        } else {
          setEntry({ url, src: null, phase: file.status === 'FORBIDDEN' ? 'denied' : file.status === 'NOT_FOUND' ? 'missing' : 'error' })
        }
      })
      .catch(() => {
        if (!cancelled) setEntry({ url, src: null, phase: 'error' })
      })

    return () => {
      cancelled = true
      if (timer !== undefined) window.clearTimeout(timer)
    }
    // `renewal` re-runs the effect when the background timer fires or refresh() is called.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, renewal])

  const refresh = useCallback(() => {
    forceNext.current = true
    setRenewal(count => count + 1)
  }, [])

  const hasUrl = Boolean(url?.trim())
  if (!hasUrl) return { src: null, phase: 'idle', refresh }
  if (entry.url !== url) return { src: null, phase: 'loading', refresh }
  return { src: entry.src, phase: entry.phase, refresh }
}
