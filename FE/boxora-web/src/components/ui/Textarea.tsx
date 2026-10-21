import React from 'react'
import { cn } from './cn'
import { controlClasses, type ControlSize } from './controlStyles'
import { useFieldControl } from './fieldContext'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  size?: ControlSize
  invalid?: boolean
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { size = 'md', invalid, className, rows = 3, ...props },
  ref,
) {
  const { invalid: isInvalid, controlProps } = useFieldControl({ ...props, invalid })
  return (
    <textarea
      ref={ref}
      rows={rows}
      data-slot="textarea"
      {...props}
      {...controlProps}
      className={cn(controlClasses({ size, invalid: isInvalid, multiline: true }), 'min-h-16 resize-y leading-5', className)}
    />
  )
})
