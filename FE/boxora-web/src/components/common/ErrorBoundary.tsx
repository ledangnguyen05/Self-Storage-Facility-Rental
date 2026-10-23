import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallbackTitle?: string
  fallbackMessage?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by Boxora ErrorBoundary:', error, errorInfo)
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  private handleReload = () => {
    window.location.reload()
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] flex items-center justify-center p-6 bg-slate-50 text-slate-800">
          <div className="max-w-md w-full bg-white p-6 rounded-2xl border border-slate-200 shadow-xl text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[32px]">warning</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">
                {this.props.fallbackTitle || 'Đã xảy ra sự cố hiển thị'}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {this.props.fallbackMessage ||
                  'Giao diện gặp sự cố tạm thời khi xử lý dữ liệu. Vui lòng bấm thử lại hoặc làm mới trang để tiếp tục.'}
              </p>
            </div>

            {this.state.error && (
              <div className="text-left bg-slate-100 p-2.5 rounded-lg text-[11px] font-mono text-slate-700 overflow-x-auto max-h-24">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Thử lại
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-sm"
              >
                Làm mới trang
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
