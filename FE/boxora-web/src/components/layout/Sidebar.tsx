import React, { useId } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { BrandLogo } from '../common/BrandLogo'
import { Tooltip } from '../ui'
import { cn } from '../ui/cn'
import { isNavItemActive, type NavItem, type NavSection } from './navigation'

interface SidebarNavProps {
  sections: NavSection[]
  collapsed?: boolean
  /** Called after a link is followed (closes the mobile drawer). */
  onNavigate?: () => void
  className?: string
}

/** Grouped navigation list shared by the desktop sidebar and the mobile drawer. */
export function SidebarNav({ sections, collapsed = false, onNavigate, className }: SidebarNavProps) {
  const location = useLocation()
  const baseId = useId()

  return (
    <nav aria-label="Điều hướng chính" className={cn('flex-1 overflow-y-auto py-3', collapsed ? 'px-2' : 'px-3', className)}>
      {sections.map((section, index) => {
        const headingId = `${baseId}-${section.id}`
        const showLabel = Boolean(section.label) && !collapsed
        return (
          <div key={section.id} className={cn(index > 0 && (showLabel ? 'mt-5' : 'mt-3'))}>
            {showLabel ? (
              <p id={headingId} className="mb-1 px-2 text-xs font-medium text-fg-subtle">
                {section.label}
              </p>
            ) : index > 0 ? (
              <div aria-hidden="true" className="mx-2 mb-3 h-px bg-line" />
            ) : null}
            <ul aria-labelledby={showLabel ? headingId : undefined} aria-label={showLabel ? undefined : section.label} className="flex flex-col gap-0.5">
              {section.items.map(item => (
                <li key={item.id} className={cn(collapsed && 'flex justify-center')}>
                  <SidebarLink
                    item={item}
                    active={isNavItemActive(item, location)}
                    collapsed={collapsed}
                    onNavigate={onNavigate}
                  />
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </nav>
  )
}

function SidebarLink({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: NavItem
  active: boolean
  collapsed: boolean
  onNavigate?: () => void
}) {
  const Icon = item.icon
  const link = (
    <Link
      to={item.to}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={cn(
        'group flex h-8 items-center gap-2.5 rounded-md text-sm font-medium transition-colors',
        collapsed ? 'w-10 justify-center' : 'px-2',
        active ? 'bg-accent-subtle text-accent-text' : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
      )}
    >
      <Icon
        size={16}
        strokeWidth={1.75}
        aria-hidden="true"
        className={cn('shrink-0', active ? 'text-accent-text' : 'text-fg-subtle group-hover:text-fg')}
      />
      {!collapsed ? <span className="truncate">{item.label}</span> : null}
    </Link>
  )

  if (!collapsed) return link
  return (
    <Tooltip content={item.label} side="right">
      {link}
    </Tooltip>
  )
}

interface SidebarProps {
  sections: NavSection[]
  collapsed: boolean
  onToggleCollapsed: () => void
}

/** Desktop sidebar: 240px, collapsible to a 56px icon rail. Hidden below lg (the drawer takes over). */
export function Sidebar({ sections, collapsed, onToggleCollapsed }: SidebarProps) {
  const toggleLabel = collapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose

  return (
    <aside
      data-slot="sidebar"
      className={cn(
        'fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-line bg-surface transition-[width] duration-200 lg:flex',
        collapsed ? 'w-14' : 'w-60',
      )}
    >
      <div className={cn('flex h-14 shrink-0 items-center border-b border-line', collapsed ? 'justify-center px-2' : 'px-4')}>
        <BrandLogo size="sm" showText={false} imgClassName={collapsed ? 'h-6' : 'h-8'} />
      </div>

      <SidebarNav sections={sections} collapsed={collapsed} />

      <div className={cn('shrink-0 border-t border-line p-2', collapsed && 'flex justify-center')}>
        <Tooltip content={toggleLabel} side="right" disabled={!collapsed} className={collapsed ? undefined : 'flex w-full'}>
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={toggleLabel}
            aria-expanded={!collapsed}
            className={cn(
              'flex h-8 items-center gap-2.5 rounded-md text-sm font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg',
              collapsed ? 'w-10 justify-center' : 'w-full px-2',
            )}
          >
            <ToggleIcon size={16} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-fg-subtle" />
            {!collapsed ? <span>Thu gọn</span> : null}
          </button>
        </Tooltip>
      </div>
    </aside>
  )
}
