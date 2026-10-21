import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react'
import { cn } from './cn'
import { Portal } from './Portal'
import { ToastContext, type ToastApi, type ToastOptions, type ToastRecord, type ToastTone } from './toastContext'

const DEFAULT_DURATION = 5000
const MAX_TOASTS = 4

const toneIcon: Record<ToastTone, { icon: typeof Info; className: string }> = {
  success: { icon: CircleCheck, className: 'text-success' },
  error: { icon: CircleAlert, className: 'text-danger' },
  warning: { icon: TriangleAlert, className: 'text-warning' },
  info: { icon: Info, className: 'text-info' },
}

let toastCounter = 0

/** Mount once near the root (main.tsx). Renders the bottom-right toast stack. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts(current => current.filter(toast => toast.id !== id))
  }, [])

  const push = useCallback(
    (tone: ToastTone) =>
      (title: React.ReactNode, description?: React.ReactNode, options: ToastOptions = {}) => {
        toastCounter += 1
        const id = `toast-${toastCounter}`
        setToasts(current => [...current, { id, tone, title, description, ...options }].slice(-MAX_TOASTS))
        return id
      },
    [],
  )

  const api = useMemo<ToastApi>(
    () => ({
      success: push('success'),
      error: push('error'),
      info: push('info'),
      warning: push('warning'),
      dismiss,
    }),
    [push, dismiss],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <Portal>
        <div
          role="region"
          aria-label="Thông báo"
          aria-live="polite"
          aria-relevant="additions"
          className="pointer-events-none fixed inset-x-4 bottom-4 z-400 flex flex-col items-stretch gap-2 sm:left-auto sm:w-96"
        >
          {toasts.map(toast => (
            <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
          ))}
        </div>
      </Portal>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onDismiss }: { toast: ToastRecord; onDismiss: (id: string) => void }) {
  const duration = toast.duration ?? (toast.tone === 'error' ? Infinity : DEFAULT_DURATION)
  const [paused, setPaused] = useState(false)
  const remaining = useRef(duration)
  const startedAt = useRef(0)
  const { icon: Icon, className: iconClass } = toneIcon[toast.tone]

  useEffect(() => {
    if (paused || !Number.isFinite(remaining.current)) return
    startedAt.current = Date.now()
    const timer = window.setTimeout(() => onDismiss(toast.id), remaining.current)
    return () => {
      window.clearTimeout(timer)
      remaining.current -= Date.now() - startedAt.current
    }
  }, [paused, onDismiss, toast.id])

  return (
    <div
      role={toast.tone === 'error' ? 'alert' : 'status'}
      data-slot="toast"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="pointer-events-auto flex w-full items-start gap-3 rounded-xl border border-line bg-overlay p-3.5 text-fg shadow-lg animate-toast-in"
    >
      <Icon size={18} strokeWidth={1.75} aria-hidden="true" className={cn('mt-px shrink-0', iconClass)} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-fg">{toast.title}</p>
        {toast.description ? <div className="mt-0.5 text-dense text-fg-muted">{toast.description}</div> : null}
        {toast.action ? (
          <button
            type="button"
            onClick={() => {
              toast.action?.onClick()
              onDismiss(toast.id)
            }}
            className="mt-2 rounded-sm text-sm font-medium text-accent-text hover:underline"
          >
            {toast.action.label}
          </button>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Đóng thông báo"
        className="-m-1 flex size-6 shrink-0 items-center justify-center rounded text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg"
      >
        <X size={14} strokeWidth={1.75} aria-hidden="true" />
      </button>
    </div>
  )
}
