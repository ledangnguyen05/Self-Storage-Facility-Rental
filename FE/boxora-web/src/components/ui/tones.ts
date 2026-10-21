/** Status tones from DESIGN_SYSTEM.md §2.3. `accent` is the brand blue, used sparingly. */
export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'
export type ToneWithAccent = Tone | 'accent'

/* Full class strings are spelled out so Tailwind can see them at build time. */

export const toneText: Record<ToneWithAccent, string> = {
  neutral: 'text-neutral',
  info: 'text-info',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  accent: 'text-accent-text',
}

export const toneSubtleBg: Record<ToneWithAccent, string> = {
  neutral: 'bg-neutral-subtle',
  info: 'bg-info-subtle',
  success: 'bg-success-subtle',
  warning: 'bg-warning-subtle',
  danger: 'bg-danger-subtle',
  accent: 'bg-accent-subtle',
}

export const toneBorder: Record<ToneWithAccent, string> = {
  neutral: 'border-neutral-line',
  info: 'border-info-line',
  success: 'border-success-line',
  warning: 'border-warning-line',
  danger: 'border-danger-line',
  accent: 'border-accent-line',
}

export const toneSolidBg: Record<ToneWithAccent, string> = {
  neutral: 'bg-neutral-solid',
  info: 'bg-info-solid',
  success: 'bg-success-solid',
  warning: 'bg-warning-solid',
  danger: 'bg-danger-solid',
  accent: 'bg-accent',
}

/** Soft surface: subtle background, tone text, tone border. */
export const toneSoft: Record<ToneWithAccent, string> = {
  neutral: 'bg-neutral-subtle text-neutral border-neutral-line',
  info: 'bg-info-subtle text-info border-info-line',
  success: 'bg-success-subtle text-success border-success-line',
  warning: 'bg-warning-subtle text-warning border-warning-line',
  danger: 'bg-danger-subtle text-danger border-danger-line',
  accent: 'bg-accent-subtle text-accent-text border-accent-line',
}
