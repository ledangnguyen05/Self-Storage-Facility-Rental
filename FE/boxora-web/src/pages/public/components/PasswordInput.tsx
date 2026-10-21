import React, { useState } from 'react'
import { Eye, EyeOff, Lock } from 'lucide-react'
import { IconButton, Input, cn, type InputProps } from '../../../components/ui'

type PasswordInputProps = Omit<InputProps, 'type' | 'leftIcon' | 'rightIcon'>

/**
 * Password field with a lock icon and a show/hide toggle (the primitive `Input`
 * only has non-interactive icon slots).
 */
export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(
  { className, inputClassName, size = 'lg', ...props },
  ref,
) {
  const [visible, setVisible] = useState(false)
  return (
    <div className={cn('relative w-full', className)}>
      <Input
        ref={ref}
        type={visible ? 'text' : 'password'}
        size={size}
        leftIcon={Lock}
        // Edge draws its own reveal / clear button inside password fields; hide it so only the toggle below shows.
        inputClassName={cn('pr-10 [&::-ms-clear]:hidden [&::-ms-reveal]:hidden', inputClassName)}
        {...props}
      />
      <IconButton
        icon={visible ? EyeOff : Eye}
        size="sm"
        aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
        aria-pressed={visible}
        className="absolute right-1.5 top-1/2 -translate-y-1/2"
        onClick={() => setVisible(value => !value)}
      />
    </div>
  )
})
