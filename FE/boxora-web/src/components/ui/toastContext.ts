import type React from 'react'
import { createContext, useContext } from 'react'

export type ToastTone = 'success' | 'error' | 'info' | 'warning'

export interface ToastOptions {
  /** Milliseconds before auto-dismiss. Defaults to 5000; errors stay until closed. Use Infinity to keep any toast. */
  duration?: number
  /** One inline action, e.g. Undo or Retry. */
  action?: { label: string; onClick: () => void }
}

export interface ToastRecord extends ToastOptions {
  id: string
  tone: ToastTone
  title: React.ReactNode
  description?: React.ReactNode
}

type ToastFn = (title: React.ReactNode, description?: React.ReactNode, options?: ToastOptions) => string

export interface ToastApi {
  success: ToastFn
  error: ToastFn
  info: ToastFn
  warning: ToastFn
  dismiss: (id: string) => void
}

export const ToastContext = createContext<ToastApi | null>(null)

const noop: ToastFn = () => ''

const fallbackApi: ToastApi = {
  success: noop,
  error: noop,
  info: noop,
  warning: noop,
  dismiss: () => undefined,
}

/**
 * `const toast = useToast(); toast.success('Đã lưu hợp đồng')`.
 * The returned object is stable, so it is safe in effect dependencies.
 */
export function useToast(): ToastApi {
  const api = useContext(ToastContext)
  if (!api) {
    if (import.meta.env.DEV) console.warn('useToast() is used outside <ToastProvider>; toasts are ignored.')
    return fallbackApi
  }
  return api
}
