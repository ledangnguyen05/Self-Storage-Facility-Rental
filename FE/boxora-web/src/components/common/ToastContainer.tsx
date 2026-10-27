import React, { useEffect, useState, useCallback } from 'react'
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react'
import type { ToastEventDetail, ToastType } from '../../utils/toast'

interface ActiveToast extends ToastEventDetail {
  createdAt: number
}

const getToastStyles = (type: ToastType) => {
  switch (type) {
    case 'success':
      return {
        bg: 'bg-slate-900/95 dark:bg-slate-900/95 border-emerald-500/40 text-emerald-100',
        icon: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />,
        progress: 'bg-emerald-500',
        badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
        defaultTitle: 'Thành công',
      }
    case 'error':
      return {
        bg: 'bg-slate-900/95 dark:bg-slate-900/95 border-rose-500/40 text-rose-100',
        icon: <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />,
        progress: 'bg-rose-500',
        badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
        defaultTitle: 'Đã có lỗi xảy ra',
      }
    case 'warning':
      return {
        bg: 'bg-slate-900/95 dark:bg-slate-900/95 border-amber-500/40 text-amber-100',
        icon: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />,
        progress: 'bg-amber-500',
        badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
        defaultTitle: 'Lưu ý',
      }
    case 'info':
    default:
      return {
        bg: 'bg-slate-900/95 dark:bg-slate-900/95 border-blue-500/40 text-blue-100',
        icon: <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />,
        progress: 'bg-blue-500',
        badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
        defaultTitle: 'Thông báo',
      }
  }
}

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ActiveToast[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  useEffect(() => {
    const handleToastEvent = (e: Event) => {
      const customEvent = e as CustomEvent<ToastEventDetail>
      if (!customEvent.detail) return

      const newToast: ActiveToast = {
        ...customEvent.detail,
        createdAt: Date.now(),
      }

      setToasts((prev) => [newToast, ...prev].slice(0, 5)) // Keep maximum 5 concurrent toasts

      if (newToast.duration && newToast.duration > 0) {
        setTimeout(() => {
          removeToast(newToast.id)
        }, newToast.duration)
      }
    }

    window.addEventListener('boxora:toast', handleToastEvent)
    return () => {
      window.removeEventListener('boxora:toast', handleToastEvent)
    }
  }, [removeToast])

  if (toasts.length === 0) return null

  return (
    <div
      aria-live="polite"
      className="fixed top-5 right-5 z-[99999] flex flex-col gap-3 max-w-sm w-full pointer-events-none px-4 sm:px-0"
    >
      {toasts.map((toast) => {
        const style = getToastStyles(toast.type)
        return (
          <div
            key={toast.id}
            role="alert"
            className={`pointer-events-auto relative overflow-hidden rounded-2xl border p-4 shadow-2xl backdrop-blur-md transition-all duration-300 animate-in slide-in-from-top-3 fade-in ${style.bg}`}
          >
            <div className="flex items-start gap-3">
              {style.icon}
              <div className="flex-1 min-w-0 pr-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-white tracking-wide">
                    {toast.title || style.defaultTitle}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-slate-200 whitespace-pre-line font-medium break-words">
                  {toast.message}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                aria-label="Đóng thông báo"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Subtle duration progress bar */}
            {toast.duration && toast.duration > 0 && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10 overflow-hidden">
                <div
                  className={`h-full ${style.progress} opacity-70`}
                  style={{
                    animation: `boxora-toast-progress ${toast.duration}ms linear forwards`,
                  }}
                />
              </div>
            )}
          </div>
        )
      })}

      <style>{`
        @keyframes boxora-toast-progress {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
      `}</style>
    </div>
  )
}
