import React from 'react'
import { cn } from '../../lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  helperText?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, helperText, leftIcon, rightIcon, className, id, ...props }, ref) => {
    const activeHint = helperText || hint
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

    return (
      <div className="w-full text-left">
        {label && (
          <label htmlFor={inputId} className="block text-[13px] font-medium text-[#111111] mb-1.5 tracking-tight">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3.5 text-[#8A8A8A] pointer-events-none flex items-center">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={cn(
              'w-full h-[46px] px-3.5 bg-[#FFFFFF] border rounded-[8px] text-[14px] text-[#111111] placeholder:text-[#8A8A8A] transition-all duration-150',
              'focus:outline-none focus:border-[#2457FF] focus:ring-3 focus:ring-[#EAF0FF]',
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              error ? 'border-[#D64545] focus:border-[#D64545] focus:ring-[#FDECEC]' : 'border-[#D5D5D0] hover:border-[#8A8A8A]',
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3.5 text-[#8A8A8A] flex items-center">
              {rightIcon}
            </div>
          )}
        </div>
        {error && <p className="mt-1.5 text-[12px] text-[#D64545] font-medium">{error}</p>}
        {activeHint && !error && <p className="mt-1 text-[12px] text-[#8A8A8A]">{activeHint}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'
