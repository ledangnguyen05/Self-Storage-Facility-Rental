import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Scrolls to the element named by the URL hash (`/#faq`). React Router does not
 * do this on its own, and header links on other pages navigate to `/#section`.
 */
export function useHashScroll(): void {
  // `key` changes on every navigation, so clicking the same hash link twice scrolls twice.
  const { hash, pathname, key } = useLocation()

  useEffect(() => {
    if (!hash) return undefined
    const id = decodeURIComponent(hash.slice(1))
    // Wait one frame so lazy sections have been laid out.
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start',
      })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [hash, pathname, key])
}
