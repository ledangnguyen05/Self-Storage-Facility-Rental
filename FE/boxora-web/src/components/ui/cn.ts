import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * tailwind-merge that knows the Boxora theme tokens.
 * Without this, `text-dense` (a font size) is treated as a text colour and
 * `cn('text-dense', 'text-fg-muted')` silently drops one of the two classes.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['dense'],
      container: [
        'content',
        'dialog-sm',
        'dialog-md',
        'dialog-lg',
        'dialog-xl',
        'drawer-sm',
        'drawer-md',
        'drawer-lg',
      ],
      animate: ['overlay-in', 'dialog-in', 'popover-in', 'drawer-in', 'drawer-in-left', 'toast-in', 'skeleton'],
    },
  },
})

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
