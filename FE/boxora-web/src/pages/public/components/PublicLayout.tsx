import React from 'react'
import { FloatingContactWidget } from '../../../components/common/FloatingContactWidget'
import { PublicFooter } from './PublicFooter'
import { PublicHeader } from './PublicHeader'

interface PublicLayoutProps {
  children: React.ReactNode
  /** Hides the footer (e.g. on tool-like pages). Default false. */
  hideFooter?: boolean
}

/** Header, main landmark, footer and the floating contact stack for public pages. */
export function PublicLayout({ children, hideFooter = false }: PublicLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-300 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-fg focus:shadow-md"
      >
        Bỏ qua tới nội dung chính
      </a>
      <PublicHeader />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      {hideFooter ? null : <PublicFooter />}
      <FloatingContactWidget />
    </div>
  )
}

export default PublicLayout
