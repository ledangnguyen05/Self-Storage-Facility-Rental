import React from 'react'
import { Moon, Sun } from 'lucide-react'
import { useLanguage } from '../../context/LanguageContext'
import { useWebSettings } from '../../hooks/useWebSettings'
import { IconButton } from '../ui/Button'
import { cn } from '../ui/cn'

interface QuickThemeLanguageToggleProps {
  className?: string
  showLanguage?: boolean
  showTheme?: boolean
}

const LANGUAGES = [
  { value: 'vi', label: 'VI', name: 'Tiếng Việt' },
  { value: 'en', label: 'EN', name: 'English' },
] as const

/** Theme switch (sun/moon) and a VI/EN toggle. Used in public headers and the portal topbar. */
export const QuickThemeLanguageToggle: React.FC<QuickThemeLanguageToggleProps> = ({
  className = '',
  showLanguage = true,
  showTheme = true,
}) => {
  const { language, setLanguage } = useLanguage()
  const { isDark, toggleTheme } = useWebSettings()
  const themeLabel = isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {showTheme ? (
        <IconButton icon={isDark ? Sun : Moon} aria-label={themeLabel} aria-pressed={isDark} tooltip={themeLabel} onClick={toggleTheme} />
      ) : null}

      {showLanguage ? (
        <div
          role="group"
          aria-label="Chọn ngôn ngữ"
          className="inline-flex h-8 items-center gap-0.5 rounded-md border border-line bg-surface-2 p-0.5"
        >
          {LANGUAGES.map(option => {
            const active = language === option.value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setLanguage(option.value)}
                aria-pressed={active}
                aria-label={option.name}
                title={option.name}
                className={cn(
                  'h-6 min-w-8 rounded px-2 text-xs font-semibold transition-colors',
                  active ? 'bg-surface text-fg shadow-xs' : 'text-fg-muted hover:text-fg',
                )}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

export default QuickThemeLanguageToggle
