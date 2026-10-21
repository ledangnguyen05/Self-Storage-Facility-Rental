import React from 'react'
import { cn } from './cn'
import { renderIcon, type IconProp } from './icon'
import { toneBorder, toneSoft, toneSolidBg, toneText, type ToneWithAccent } from './tones'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: ToneWithAccent
  variant?: 'soft' | 'outline' | 'solid'
  size?: 'sm' | 'md'
  /** Leading status dot. */
  dot?: boolean
  icon?: IconProp
}

/** Non-interactive status label. Always carries text; colour is never the only signal. */
export function Badge({ tone = 'neutral', variant = 'soft', size = 'md', dot = false, icon, className, children, ...props }: BadgeProps) {
  const variantClasses =
    variant === 'solid'
      ? cn(toneSolidBg[tone], 'border-transparent text-on-accent')
      : variant === 'outline'
        ? cn('bg-transparent', toneBorder[tone], toneText[tone])
        : toneSoft[tone]

  return (
    <span
      data-slot="badge"
      className={cn(
        'inline-flex max-w-full shrink-0 select-none items-center gap-1 whitespace-nowrap rounded-md border font-medium',
        size === 'sm' ? 'h-5 px-1.5 text-xs' : 'h-6 px-2 text-xs',
        variantClasses,
        className,
      )}
      {...props}
    >
      {dot ? (
        <span
          aria-hidden="true"
          className={cn('size-1.5 shrink-0 rounded-full', variant === 'solid' ? 'bg-on-accent' : toneSolidBg[tone])}
        />
      ) : null}
      {renderIcon(icon, { size: 12, className: 'shrink-0' })}
      <span className="truncate">{children}</span>
    </span>
  )
}
