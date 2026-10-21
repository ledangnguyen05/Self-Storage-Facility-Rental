import React from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

interface ErrorBoundaryProps {
  children: React.ReactNode
  /** When this value changes (e.g. the route pathname) the boundary resets itself. */
  resetKey?: unknown
  /** Custom fallback. Receives the error and a `retry` callback. */
  fallback?: (props: { error: Error; retry: () => void }) => React.ReactNode
  onError?: (error: Error, info: React.ErrorInfo) => void
}

interface ErrorBoundaryState {
  error: Error | null
  resetKey: unknown
}

/** A lazy chunk that no longer exists (new deploy) can only be recovered by a full reload. */
function isChunkLoadError(error: Error): boolean {
  return /dynamically imported module|Importing a module script failed|Loading chunk|ChunkLoadError/i.test(
    `${error.name} ${error.message}`
  )
}

/**
 * Catches render errors below it and shows a neutral fallback with a retry
 * button. Deliberately uses plain elements so the fallback never depends on
 * the components that may have crashed.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { error: null, resetKey: props.resetKey }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error }
  }

  /** A new `resetKey` (e.g. navigation) clears the error. */
  static getDerivedStateFromProps(props: ErrorBoundaryProps, state: ErrorBoundaryState): Partial<ErrorBoundaryState> | null {
    if (props.resetKey !== state.resetKey) return { error: null, resetKey: props.resetKey }
    return null
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Unhandled UI error:', error, info.componentStack)
    this.props.onError?.(error, info)
  }

  retry = (): void => {
    const { error } = this.state
    if (error && isChunkLoadError(error)) {
      window.location.reload()
      return
    }
    this.setState({ error: null })
  }

  render(): React.ReactNode {
    const { error } = this.state
    if (!error) return this.props.children
    if (this.props.fallback) return this.props.fallback({ error, retry: this.retry })

    const chunkError = isChunkLoadError(error)
    return (
      <div role="alert" className="flex min-h-[60vh] w-full items-center justify-center bg-canvas px-4 py-12">
        <div className="w-full max-w-md rounded-lg border border-line bg-surface p-6 text-center">
          <span className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-danger-subtle text-danger">
            <AlertTriangle size={20} strokeWidth={1.75} aria-hidden />
          </span>
          <h2 className="text-base font-semibold text-fg">
            {chunkError ? 'Đã có phiên bản mới' : 'Trang này gặp sự cố'}
          </h2>
          <p className="mt-1 text-sm text-fg-muted">
            {chunkError
              ? 'Vui lòng tải lại trang để dùng phiên bản mới nhất.'
              : 'Đã có lỗi khi hiển thị nội dung. Bạn có thể thử lại hoặc quay về trang chủ.'}
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={this.retry}
              className="inline-flex h-8 items-center gap-2 rounded-md bg-accent px-3 text-sm font-medium text-on-accent shadow-xs hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <RotateCcw size={16} strokeWidth={1.75} aria-hidden />
              {chunkError ? 'Tải lại trang' : 'Thử lại'}
            </button>
            <a
              href="/"
              className="inline-flex h-8 items-center rounded-md border border-line-strong bg-surface px-3 text-sm font-medium text-fg shadow-xs hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Về trang chủ
            </a>
          </div>
        </div>
      </div>
    )
  }
}

export default ErrorBoundary
