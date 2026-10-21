import React from 'react'
import type { LucideIcon } from 'lucide-react'

/**
 * An icon slot accepts either a lucide component (`icon={Inbox}`), which the
 * primitive sizes for you, or a ready element (`icon={<Inbox size={20} />}`).
 */
export type IconProp = LucideIcon | React.ReactElement

const isComponentType = (value: unknown): value is LucideIcon =>
  typeof value === 'function' || (typeof value === 'object' && value !== null && '$$typeof' in value && !React.isValidElement(value))

export function renderIcon(icon: IconProp | null | undefined, options: { size?: number; className?: string } = {}) {
  if (!icon) return null
  if (React.isValidElement(icon)) return icon
  if (isComponentType(icon)) {
    const Icon = icon
    return <Icon size={options.size ?? 16} strokeWidth={1.75} aria-hidden="true" className={options.className} />
  }
  return null
}
