import React, { useEffect, useState } from 'react'
import { useLanguage } from '../../context/LanguageContext'
import { WebSettings, getWebSettings, saveWebSettings } from '../../utils/webSettings'

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

  useEffect(() => {
    const handleSettingsChange = (e: any) => {
      if (e.detail) setSettings(e.detail)
    }
    window.addEventListener('boxora_settings_changed', handleSettingsChange)
    return () => window.removeEventListener('boxora_settings_changed', handleSettingsChange)
  }, [])

  const isDark = settings.theme === 'dark' || (settings.theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  const handleToggleTheme = () => {
    const nextTheme = isDark ? 'light' : 'dark'
    const updated = saveWebSettings({ theme: nextTheme })
    setSettings(updated)
  }

  const handleSwitchLanguage = (lang: 'vi' | 'en') => {
    setLanguage(lang)
    const updated = saveWebSettings({ language: lang })
    setSettings(updated)
  }

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {/* Theme Toggle Button */}
      {showTheme && (
        <button
          type="button"
          onClick={handleToggleTheme}
          title={isDark ? t('Chuyển sang giao diện sáng', 'Switch to Light Mode') : t('Chuyển sang giao diện tối', 'Switch to Dark Mode')}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          className="w-8 h-8 rounded-xl flex items-center justify-center border border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600 bg-white/80 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-700 dark:text-amber-400 shadow-2xs transition-all cursor-pointer"
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
          className="flex items-center gap-0.5 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 shadow-2xs text-[11px] font-bold"
        >
          <button
            type="button"
            onClick={() => handleSwitchLanguage('vi')}
            aria-pressed={language === 'vi'}
            className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
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
            className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
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

