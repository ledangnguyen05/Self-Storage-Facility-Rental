import React from 'react'
import { createPortal } from 'react-dom'

/** Renders children into document.body (internal helper for overlays). */
export function Portal({ children }: { children: React.ReactNode }) {
  if (typeof document === 'undefined') return null
  return createPortal(children, document.body)
}
