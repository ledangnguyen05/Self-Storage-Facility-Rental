import React, { useRef } from 'react'
import {
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion'

/**
 * Shared motion primitives for the BOXORA homepage (v2).
 * Everything animates with transform / opacity / clip-path only (no layout shift)
 * and degrades to a static render when the user prefers reduced motion.
 */

export const EASE_OUT = [0.22, 1, 0.36, 1] as const

/* ------------------------------------------------------------------ */
/* Reveal — generic scroll-in (fade + rise / slide)                    */
/* ------------------------------------------------------------------ */
interface RevealProps {
  children: React.ReactNode
  delay?: number
  y?: number
  x?: number
  className?: string
  as?: 'div' | 'li' | 'p' | 'span' | 'article' | 'section'
  once?: boolean
}

export const Reveal: React.FC<RevealProps> = ({
  children,
  delay = 0,
  y = 28,
  x = 0,
  className,
  as = 'div',
  once = true,
}) => {
  const reduce = useReducedMotion()
  const Tag = motion[as] as typeof motion.div
  if (reduce) return <Tag className={className}>{children}</Tag>
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y, x }}
      whileInView={{ opacity: 1, y: 0, x: 0 }}
      viewport={{ once, margin: '0px 0px -12% 0px' }}
      transition={{ duration: 0.9, delay, ease: EASE_OUT }}
    >
      {children}
    </Tag>
  )
}

/* ------------------------------------------------------------------ */
/* LineReveal — headline revealed line by line from a clipped mask     */
/* ------------------------------------------------------------------ */
interface LineRevealProps {
  lines: React.ReactNode[]
  className?: string
  lineClassName?: string
  delay?: number
  stagger?: number
  /** animate on mount instead of on scroll (hero) */
  immediate?: boolean
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'div'
}

export const LineReveal: React.FC<LineRevealProps> = ({
  lines,
  className,
  lineClassName,
  delay = 0,
  stagger = 0.11,
  immediate = false,
  as = 'h2',
}) => {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLElement | null>(null)
  const inView = useInView(ref, { once: true, margin: '0px 0px -10% 0px' })
  const run = immediate || inView
  const Tag = as as 'div'
  return (
    <Tag ref={ref as React.Ref<HTMLDivElement>} className={className}>
      {lines.map((line, i) => (
        <span key={i} className="block overflow-hidden pb-[0.12em] -mb-[0.12em]">
          <motion.span
            className={`block will-change-transform ${lineClassName || ''}`}
            initial={reduce ? false : { y: '110%' }}
            animate={reduce ? undefined : run ? { y: '0%' } : { y: '110%' }}
            transition={{ duration: 1, delay: delay + i * stagger, ease: EASE_OUT }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </Tag>
  )
}

/* ------------------------------------------------------------------ */
/* MaskImage — clip-path reveal + inner parallax                       */
/* ------------------------------------------------------------------ */
interface MaskImageProps {
  src: string
  alt: string
  className?: string
  imgClassName?: string
  /** direction the mask opens from */
  from?: 'bottom' | 'left' | 'right' | 'top'
  /** parallax travel in px (inner image moves against the scroll) */
  parallax?: number
  delay?: number
  sizes?: string
  eager?: boolean
}

const CLIP_START: Record<NonNullable<MaskImageProps['from']>, string> = {
  bottom: 'inset(100% 0% 0% 0%)',
  top: 'inset(0% 0% 100% 0%)',
  left: 'inset(0% 100% 0% 0%)',
  right: 'inset(0% 0% 0% 100%)',
}

export const MaskImage: React.FC<MaskImageProps> = ({
  src,
  alt,
  className,
  imgClassName,
  from = 'bottom',
  parallax = 40,
  delay = 0,
  eager = false,
}) => {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement | null>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], [parallax, -parallax])
  return (
    <motion.div
      ref={ref}
      className={`relative overflow-hidden ${className || ''}`}
      initial={reduce ? false : { clipPath: CLIP_START[from] }}
      whileInView={reduce ? undefined : { clipPath: 'inset(0% 0% 0% 0%)' }}
      viewport={{ once: true, margin: '0px 0px -10% 0px' }}
      transition={{ duration: 1.25, delay, ease: EASE_OUT }}
    >
      <motion.img
        src={src}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        className={`absolute inset-0 h-full w-full object-cover will-change-transform ${imgClassName || ''}`}
        style={reduce ? undefined : { y, scale: 1.18 }}
      />
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/* Parallax helpers                                                    */
/* ------------------------------------------------------------------ */
export function useParallax(
  ref: React.RefObject<HTMLElement | null>,
  distance = 80,
  smooth = true
): MotionValue<number> {
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const raw = useTransform(scrollYProgress, [0, 1], [distance, -distance])
  const spring = useSpring(raw, { stiffness: 90, damping: 24, mass: 0.4 })
  return smooth ? spring : raw
}

/** Scroll progress (0 → 1) while a tall sticky section crosses the viewport. */
export function useSectionProgress(ref: React.RefObject<HTMLElement | null>) {
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  return scrollYProgress
}

/* ------------------------------------------------------------------ */
/* Eyebrow — "01 / Label" section marker                               */
/* ------------------------------------------------------------------ */
export const Eyebrow: React.FC<{ index: string; label: string; className?: string }> = ({
  index,
  label,
  className,
}) => (
  <div
    className={`flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-700 dark:text-cyan-300 ${className || ''}`}
  >
    <span className="tabular-nums text-slate-400 dark:text-slate-500">{index}</span>
    <span aria-hidden className="h-px w-8 bg-sky-600/40 dark:bg-cyan-300/40" />
    <span>{label}</span>
  </div>
)

/* ------------------------------------------------------------------ */
/* CtaButton — button with arrow micro-interaction                     */
/* ------------------------------------------------------------------ */
interface CtaButtonProps {
  children: React.ReactNode
  onClick?: () => void
  href?: string
  variant?: 'solid' | 'ghost'
  className?: string
}

export const CtaButton: React.FC<CtaButtonProps> = ({
  children,
  onClick,
  href,
  variant = 'solid',
  className,
}) => {
  const base =
    'group relative inline-flex items-center gap-3 rounded-full px-6 py-3.5 text-sm font-semibold tracking-tight transition-[background,color,box-shadow,transform] duration-300 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 cursor-pointer'
  const styles =
    variant === 'solid'
      ? 'bg-slate-950 text-white hover:bg-sky-700 dark:bg-white dark:text-slate-950 dark:hover:bg-cyan-200'
      : 'text-slate-900 ring-1 ring-slate-300 hover:ring-slate-900 dark:text-white dark:ring-slate-600 dark:hover:ring-white'
  const inner = (
    <>
      <span>{children}</span>
      <span
        aria-hidden
        className="inline-block translate-x-0 transition-transform duration-300 group-hover:translate-x-1"
      >
        →
      </span>
    </>
  )
  if (href) {
    return (
      <a href={href} className={`${base} ${styles} ${className || ''}`}>
        {inner}
      </a>
    )
  }
  return (
    <button type="button" onClick={onClick} className={`${base} ${styles} ${className || ''}`}>
      {inner}
    </button>
  )
}

/** Wrapper keeping all home sections on the same grid. */
export const Container: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <div className={`mx-auto w-full max-w-[1320px] px-5 sm:px-8 lg:px-12 ${className || ''}`}>
    {children}
  </div>
)

