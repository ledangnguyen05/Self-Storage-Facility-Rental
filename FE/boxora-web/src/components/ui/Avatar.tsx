import React, { useState } from 'react'
import { cn } from './cn'

const avatarSizes = {
  sm: 'size-6 text-xs',
  md: 'size-8 text-xs',
  lg: 'size-10 text-sm',
} as const

export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Full name; used for the initials fallback and the image alt text. */
  name?: string | null
  src?: string | null
  size?: keyof typeof avatarSizes
}

/** Initials of the last two words: "Nguyễn Văn An" -> "VA". */
function getInitials(name?: string | null): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return words
    .slice(-2)
    .map(word => word[0])
    .join('')
    .toUpperCase()
}

export function Avatar({ name, src, size = 'md', className, ...props }: AvatarProps) {
  const [failed, setFailed] = useState(false)
  const showImage = Boolean(src) && !failed
  return (
    <span
      data-slot="avatar"
      className={cn(
        'relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-accent-subtle font-semibold text-accent-text',
        avatarSizes[size],
        className,
      )}
      {...props}
    >
      {showImage ? (
        <img src={src ?? undefined} alt={name ?? ''} className="size-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <span aria-hidden={name ? undefined : true}>{getInitials(name)}</span>
      )}
    </span>
  )
}
