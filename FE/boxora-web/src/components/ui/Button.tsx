import React from 'react'
import { cn } from '../../lib/utils'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'text'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
  icon?: React.ReactNode
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  className,
  children,
  disabled,
  ...props
}) => {
  const baseClasses =
    'inline-flex items-center justify-center font-medium rounded-[8px] btn-tactile focus:outline-none transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none select-none'

  const sizeClasses = {
    sm: 'h-[36px] px-3 text-[13px] gap-1.5',
    md: 'h-[44px] px-5 text-[14px] gap-2',
    lg: 'h-[50px] px-6 text-[15px] gap-2.5',
  }

  const variantClasses = {
    primary: 'bg-[#111111] text-[#FFFFFF] hover:bg-[#222222] border border-[#111111] shadow-subtle',
    secondary: 'bg-[#FFFFFF] text-[#111111] border border-[#D5D5D0] hover:bg-[#F2F2EF] hover:border-[#111111]',
    ghost: 'bg-transparent text-[#111111] hover:bg-[#F2F2EF]',
    danger: 'bg-[#D64545] text-white hover:bg-[#C0392B]',
    text: 'bg-transparent text-[#2457FF] hover:underline p-0 h-auto font-medium',
  }

  return (
    <button
      className={cn(baseClasses, sizeClasses[size], variantClasses[variant], className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        icon && <span className="shrink-0">{icon}</span>
      )}
      <span>{children}</span>
    </button>
  )
}
