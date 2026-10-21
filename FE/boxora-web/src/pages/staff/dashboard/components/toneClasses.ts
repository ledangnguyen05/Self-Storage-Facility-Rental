import type { Tone } from '@/constants/statusMeta'

/* Spelled out in full so Tailwind sees every class at build time. */

/** Soft tile: subtle background, tone border and tone text (unit map, swatches). */
export const TONE_TILE: Record<Tone, string> = {
  neutral: 'border-neutral-line bg-neutral-subtle text-neutral',
  info: 'border-info-line bg-info-subtle text-info',
  success: 'border-success-line bg-success-subtle text-success',
  warning: 'border-warning-line bg-warning-subtle text-warning',
  danger: 'border-danger-line bg-danger-subtle text-danger',
  accent: 'border-accent-line bg-accent-subtle text-accent-text',
}

/** Icon tile used in condition cards. */
export const TONE_ICON: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-fg-subtle',
  info: 'bg-info-subtle text-info',
  success: 'bg-success-subtle text-success',
  warning: 'bg-warning-subtle text-warning',
  danger: 'bg-danger-subtle text-danger',
  accent: 'bg-accent-subtle text-accent-text',
}

export const TONE_TEXT: Record<Tone, string> = {
  neutral: 'text-fg-muted',
  info: 'text-info',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  accent: 'text-accent-text',
}
