import React from 'react'
import { cn } from '../../../components/ui'

/** Page-width wrapper shared by every public section. */
export function Container({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8', className)} {...props} />
}

interface SectionProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  /** Adds a top border and the alternate surface colour. */
  tone?: 'canvas' | 'surface'
}

/** Marketing section with consistent vertical rhythm. `id` doubles as the hash-link target. */
export function Section({ tone = 'canvas', className, children, ...props }: SectionProps) {
  return (
    <section
      className={cn('scroll-mt-16 py-16 sm:py-20', tone === 'surface' ? 'border-y border-line bg-surface' : 'bg-canvas', className)}
      {...props}
    >
      <Container>{children}</Container>
    </section>
  )
}

interface SectionHeadingProps {
  title: string
  description?: string
  /** Small label above the title (sentence case). */
  eyebrow?: string
  align?: 'left' | 'center'
  id?: string
  className?: string
}

export function SectionHeading({ title, description, eyebrow, align = 'left', id, className }: SectionHeadingProps) {
  return (
    <div className={cn('max-w-2xl', align === 'center' && 'mx-auto text-center', className)}>
      {eyebrow ? <p className="mb-2 text-sm font-medium text-accent-text">{eyebrow}</p> : null}
      <h2 id={id} className="text-3xl font-semibold tracking-tight text-fg">
        {title}
      </h2>
      {description ? <p className="mt-3 text-base text-fg-muted">{description}</p> : null}
    </div>
  )
}
