import React, { useEffect, useRef, useState } from 'react'
import { User, RoleType } from '../../types'
import { useLanguage } from '../../context/LanguageContext'
import {
  WebSettings,
  getResolvedTheme,
  getWebSettings,
  saveWebSettings,
} from '../../utils/webSettings'

interface UserAvatarDropdownProps {
  user: User | null
  role: RoleType | string | null
  onOpenProfile: () => void
  onOpenSettings: () => void
  onOpenLogoutConfirm: () => void
  extraActions?: React.ReactNode
}

export const UserAvatarDropdown: React.FC<UserAvatarDropdownProps> = ({
  user,
  role,
  onOpenProfile,
  onOpenSettings,
  onOpenLogoutConfirm,
  extraActions,
}) => {
  const { language, setLanguage, t } = useLanguage()
  const [isOpen, setIsOpen] = useState(false)
  const [webSettings, setWebSettings] = useState<WebSettings>(getWebSettings())
  const [systemIsDark, setSystemIsDark] = useState(() => getResolvedTheme({ theme: 'system' }) === 'dark')
  const isDark = webSettings.theme === 'dark' || (webSettings.theme === 'system' && systemIsDark)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const updateSystemTheme = (event: MediaQueryListEvent) => setSystemIsDark(event.matches)
    setSystemIsDark(media.matches)
    media.addEventListener?.('change', updateSystemTheme)
    return () => media.removeEventListener?.('change', updateSystemTheme)
  }, [])

  // Listen for outside click to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  // Sync settings when custom event fires
  useEffect(() => {
    const handleSettingsChange = (e: any) => {
      if (e.detail) setWebSettings(e.detail)
    }
    window.addEventListener('boxora_settings_changed', handleSettingsChange)
    return () => {
      window.removeEventListener('boxora_settings_changed', handleSettingsChange)
    }
  }, [])

  const handleToggleDark = () => {
    const nextTheme = isDark ? 'light' : 'dark'
    const updated = saveWebSettings({ theme: nextTheme })
    setWebSettings(updated)
  }

  const handleSwitchLanguage = (lang: 'vi' | 'en') => {
    setLanguage(lang)
  }

  const userInitials = user?.fullName
    ? user.fullName
        .split(' ')
        .map(n => n[0])
        .slice(-2)
        .join('')
        .toUpperCase()
    : user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : 'US'

  const getRoleStyle = (r: string | null | undefined) => {
    switch (r) {
      case 'ADMIN':
        return 'bg-rose-50 text-rose-700 border-rose-200'
      case 'BUSINESS_MANAGER':
        return 'bg-purple-50 text-purple-700 border-purple-200'
      case 'FACILITY_MANAGER':
        return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'STAFF':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200'
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200'
    }
  }

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Avatar Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={`flex items-center gap-2 p-1 sm:px-2.5 sm:py-1.5 rounded-xl transition-all cursor-pointer border ${
          isOpen
            ? 'bg-slate-100 border-slate-300 shadow-xs'
            : 'border-transparent hover:border-slate-200 hover:bg-slate-50'
        }`}
        aria-expanded={isOpen}
        aria-haspopup="true"
        title={t('Cài đặt web & hệ thống')}
      >
        <div className="relative">
          <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs shadow-xs ring-2 ring-white">
            {userInitials}
          </div>
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
        </div>

        <div className="hidden md:flex flex-col text-left">
          <span className="text-xs font-bold text-slate-900 leading-tight max-w-[130px] truncate">
            {user?.fullName || user?.username || t('Tài khoản')}
          </span>
          <span className="text-[10px] text-slate-500 font-mono leading-tight">
            {role || 'USER'}
          </span>
        </div>

        <span
          className={`material-symbols-outlined text-[18px] text-slate-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-blue-600' : ''
          }`}
        >
          expand_more
        </span>
      </button>

      {/* Dropdown Menu Popover */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 p-3.5 animate-in fade-in slide-in-from-top-2 duration-150 flex flex-col gap-3">
          {/* User Profile Card */}
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white flex items-center justify-center font-bold text-sm shadow-sm shrink-0">
              {userInitials}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-slate-900 truncate">
                {user?.fullName || user?.username || t('Người dùng')}
              </span>
              <span className="text-[11px] text-slate-500 truncate">
                {user?.email || t('Chưa cập nhật email')}
              </span>
              <div className="flex items-center gap-1.5 mt-1">
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border ${getRoleStyle(
                    role
                  )}`}
                >
                  {role || 'USER'}
                </span>
                {user?.phone && (
                  <span className="text-[10px] text-slate-400 font-mono truncate">
                    {user.phone}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Extra Actions slot (e.g. portal navigation button if needed) */}
          {extraActions}

          {/* Main Action Items */}
          <div className="flex flex-col gap-1">
            {/* Account and security */}
            <button
              type="button"
              onClick={() => {
                setIsOpen(false)
                onOpenProfile()
              }}
              className="w-full flex items-center gap-3 p-2 rounded-xl text-left hover:bg-slate-50 transition-colors cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <span className="material-symbols-outlined text-[18px]">account_circle</span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                  {t('Tài khoản & Bảo mật')}
                </span>
                <span className="text-[10px] text-slate-500">
                  {t('Hồ sơ cá nhân và mật khẩu')}
                </span>
              </div>
              <span className="material-symbols-outlined text-[16px] text-slate-400 ml-auto group-hover:translate-x-0.5 transition-transform">
                chevron_right
              </span>
            </button>

            {/* Cài đặt web */}
            <button
              type="button"
              onClick={() => {
                setIsOpen(false)
                onOpenSettings()
              }}
              className="w-full flex items-center gap-3 p-2 rounded-xl text-left hover:bg-slate-50 transition-colors cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                <span className="material-symbols-outlined text-[18px]">settings</span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-slate-900 group-hover:text-purple-600 transition-colors">
                  {t('Cài đặt web & hệ thống')}
                </span>
                <span className="text-[10px] text-slate-500">
                  {t('Chủ đề, phông chữ, ngôn ngữ')}
                </span>
              </div>
              <span className="material-symbols-outlined text-[16px] text-slate-400 ml-auto group-hover:translate-x-0.5 transition-transform">
                chevron_right
              </span>
            </button>
          </div>

          {/* Quick Settings Toggles */}
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex flex-col gap-2 text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {t('Tùy chỉnh nhanh')}
            </span>

            {/* Dark Mode toggle */}
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-700 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px] text-slate-500">
                  {isDark ? 'dark_mode' : 'light_mode'}
                </span>
                {t('Giao diện tối')}
              </span>
              <button
                type="button"
                onClick={handleToggleDark}
                role="switch"
                aria-checked={isDark}
                aria-label={t('Giao diện tối')}
                className={`w-10 h-6 rounded-full p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 cursor-pointer ${
                  isDark ? 'bg-blue-600' : 'bg-slate-300'
                }`}
                title={isDark ? t('Chuyển sang giao diện sáng') : t('Chuyển sang giao diện tối')}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                    isDark ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Language switch */}
            <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
              <span className="text-[11px] font-medium text-slate-700 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px] text-slate-500">language</span>
                {t('Ngôn ngữ')}
              </span>
              <div className="flex items-center gap-1 bg-slate-200/70 p-0.5 rounded-lg text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => handleSwitchLanguage('vi')}
                  aria-pressed={language === 'vi'}
                  aria-label={t('Tiếng Việt', 'Vietnamese')}
                  title={t('Tiếng Việt', 'Vietnamese')}
                  className={`min-w-9 px-2 py-1 rounded cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    language === 'vi'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
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
                  className={`min-w-9 px-2 py-1 rounded cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    language === 'en'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  EN
                </button>
              </div>
            </div>
          </div>

          {/* Logout Action */}
          <div className="pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false)
                onOpenLogoutConfirm()
              }}
              className="w-full flex items-center gap-2.5 p-2 rounded-xl text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-colors cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 group-hover:bg-rose-600 group-hover:text-white transition-colors">
                <span className="material-symbols-outlined text-[18px]">logout</span>
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs font-bold leading-tight">{t('Đăng xuất')}</span>
                <span className="text-[10px] text-rose-500/80">{t('Kết thúc phiên làm việc')}</span>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
export default UserAvatarDropdown

