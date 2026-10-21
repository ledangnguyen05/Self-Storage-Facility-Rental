import React from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { cn } from './cn'

export interface BreadcrumbItem {
  label: React.ReactNode
  /** Router path. The last item is the current page and is never a link. */
  to?: string
}

export interface BreadcrumbsProps extends React.HTMLAttributes<HTMLElement> {
  items: BreadcrumbItem[]
}

export function Breadcrumbs({ items, className, ...props }: BreadcrumbsProps) {
  if (items.length === 0) return null
  return (
    <nav aria-label="Breadcrumb" className={cn('min-w-0', className)} {...props}>
      <ol className="flex min-w-0 flex-wrap items-center gap-1 text-dense text-fg-muted">
        {items.map((item, index) => {
          const last = index === items.length - 1
          return (
            <li key={index} className="flex min-w-0 items-center gap-1">
              {item.to && !last ? (
                <Link to={item.to} className="truncate rounded-sm transition-colors hover:text-fg">
                  {item.label}
                </Link>
              ) : (
                <span className={cn('truncate', last && 'font-medium text-fg')} aria-current={last ? 'page' : undefined}>
                  {item.label}
                </span>
              )}
              {!last ? <ChevronRight size={14} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-fg-subtle" /> : null}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export interface PageHeaderProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  title: React.ReactNode
  description?: React.ReactNode
  /** Right-aligned buttons. One primary action per view. */
  actions?: React.ReactNode
  breadcrumbs?: BreadcrumbItem[]
  /** Inline metadata after the title (badges, status). */
  meta?: React.ReactNode
  /** Tabs or filters rendered under the header. */
  children?: React.ReactNode
}

/** One per page: breadcrumbs, title, description, actions, then optional tabs/filters. */
export function PageHeader({ title, description, actions, breadcrumbs, meta, children, className, ...props }: PageHeaderProps) {
  return (
    <header data-slot="page-header" className={cn('flex flex-col gap-4', className)} {...props}>
      {breadcrumbs && breadcrumbs.length > 0 ? <Breadcrumbs items={breadcrumbs} /> : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-fg">{title}</h1>
            {meta}
          </div>
          {description ? <p className="mt-1 max-w-3xl text-sm text-fg-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </header>
  )
}
