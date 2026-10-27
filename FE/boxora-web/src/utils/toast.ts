export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastOptions {
  title?: string
  duration?: number
}

export interface ToastEventDetail {
  id: string
  message: string
  type: ToastType
  title?: string
  duration?: number
}

class ToastEmitter {
  show(message: string, type: ToastType = 'info', options?: ToastOptions) {
    if (typeof window === 'undefined') return
    const id = 'toast_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)
    window.dispatchEvent(
      new CustomEvent<ToastEventDetail>('boxora:toast', {
        detail: {
          id,
          message,
          type,
          title: options?.title,
          duration: options?.duration ?? 4500,
        },
      })
    )
  }

  success(message: string, options?: ToastOptions) {
    this.show(message, 'success', options)
  }

  error(message: string, options?: ToastOptions) {
    this.show(message, 'error', options)
  }

  warning(message: string, options?: ToastOptions) {
    this.show(message, 'warning', options)
  }

  info(message: string, options?: ToastOptions) {
    this.show(message, 'info', options)
  }
}

export const toast = new ToastEmitter()
