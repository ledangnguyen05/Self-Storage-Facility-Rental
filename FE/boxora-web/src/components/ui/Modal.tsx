import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { cn } from '../../lib/utils'

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  description?: string
  children: React.ReactNode
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = 'md',
}) => {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.body.style.overflow = 'unset'
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  const maxWidthClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-3xl',
    '2xl': 'max-w-5xl',
  }

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-0"
            onClick={onClose}
          />

          {/* Dialog Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              'relative w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl z-10 overflow-hidden text-left my-auto',
              maxWidthClasses[maxWidth]
            )}
          >
            {/* Header */}
            {(title || description) && (
              <div className="flex items-start justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50">
                <div className="pr-6">
                  {title && (
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight font-sans">
                      {title}
                    </h3>
                  )}
                  {description && (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      {description}
                    </p>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                  aria-label="Đóng cửa sổ"
                >
                  <X size={18} />
                </button>
              </div>
            )}

            {/* Content */}
            <div className="p-6 max-h-[calc(85vh-80px)] overflow-y-auto">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )

  if (!mounted || typeof document === 'undefined') {
    return null
  }

  return createPortal(modalContent, document.body)
}
