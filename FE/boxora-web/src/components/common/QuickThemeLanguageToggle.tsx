import React, { useEffect, useState } from 'react'
import { useLanguage } from '../../context/LanguageContext'
import { WebSettings, getWebSettings, getResolvedTheme, saveWebSettings } from '../../utils/webSettings'

interface QuickThemeLanguageToggleProps {
  className?: string
  showLanguage?: boolean
  showTheme?: boolean
}

export const QuickThemeLanguageToggle: React.FC<QuickThemeLanguageToggleProps> = ({
  className = '',
  showLanguage = true,
  showTheme = true,
}) => {
  const { language, setLanguage, t } = useLanguage()
  const [settings, setSettings] = useState<WebSettings>(getWebSettings())
  const [systemIsDark, setSystemIsDark] = useState(() => getResolvedTheme({ theme: 'system' }) === 'dark')

  useEffect(() => {
    const handleSettingsChange = (e: any) => {
      if (e.detail) setSettings(e.detail)
    }
    window.addEventListener('boxora_settings_changed', handleSettingsChange)
    return () => window.removeEventListener('boxora_settings_changed', handleSettingsChange)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const updateSystemTheme = (event: MediaQueryListEvent) => setSystemIsDark(event.matches)
    setSystemIsDark(media.matches)
    media.addEventListener?.('change', updateSystemTheme)
    return () => media.removeEventListener?.('change', updateSystemTheme)
  }, [])

  const isDark = settings.theme === 'dark' || (settings.theme === 'system' && systemIsDark)

  const handleToggleTheme = () => {
    const nextTheme = isDark ? 'light' : 'dark'
    const updated = saveWebSettings({ theme: nextTheme })
    setSettings(updated)
  }

  const handleSwitchLanguage = (lang: 'vi' | 'en') => {
    setLanguage(lang)
  }

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {/* Theme Toggle Button */}
      {showTheme && (
        <button
          type="button"
          onClick={handleToggleTheme}
          title={isDark ? t('Chuyển sang giao diện sáng', 'Switch to light theme') : t('Chuyển sang giao diện tối', 'Switch to dark theme')}
          aria-label={isDark ? t('Chuyển sang giao diện sáng', 'Switch to light theme') : t('Chuyển sang giao diện tối', 'Switch to dark theme')}
          aria-pressed={isDark}
          className="w-9 h-9 rounded-xl flex items-center justify-center border border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600 bg-white/90 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-amber-400 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 cursor-pointer"
        >
          {isDark ? (
            <span className="material-symbols-outlined text-[17px] text-amber-400">light_mode</span>
          ) : (
            <span className="material-symbols-outlined text-[17px] text-slate-600">dark_mode</span>
          )}
        </button>
      )}

      {/* Language Toggle Pill */}
      {showLanguage && (
        <div
          role="group"
          aria-label={t('Chọn ngôn ngữ', 'Select language')}
          className="flex min-h-9 items-center gap-0.5 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-800 shadow-sm text-[11px] font-bold"
        >
          <button
            type="button"
            onClick={() => handleSwitchLanguage('vi')}
            aria-pressed={language === 'vi'}
            aria-label={t('Tiếng Việt', 'Vietnamese')}
            title={t('Tiếng Việt', 'Vietnamese')}
            className={`min-w-9 px-2.5 py-1.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer ${
              language === 'vi'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            VI
          </button>
          <button
            type="button"
            onClick={() => handleSwitchLanguage('en')}
            aria-pressed={language === 'en'}
            aria-label={t('Tiếng Anh', 'English')}
            title={t('Tiếng Anh', 'English')}
            className={`min-w-9 px-2.5 py-1.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer ${
              language === 'en'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            EN
          </button>
        </div>
      )}
    </div>
  )
}

export default QuickThemeLanguageToggle

