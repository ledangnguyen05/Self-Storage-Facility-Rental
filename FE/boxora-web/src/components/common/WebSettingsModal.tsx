import React, { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { useLanguage } from '../../context/LanguageContext'
import {
  WebSettings,
  DEFAULT_WEB_SETTINGS,
  getWebSettings,
  saveWebSettings,
} from '../../utils/webSettings'

interface WebSettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export const WebSettingsModal: React.FC<WebSettingsModalProps> = ({ isOpen, onClose }) => {
  const { language, setLanguage, t } = useLanguage()
  const [settings, setSettings] = useState<WebSettings>(getWebSettings())
  const [savedSuccess, setSavedSuccess] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setSettings(getWebSettings())
      setSavedSuccess(false)
    }
  }, [isOpen])

  const handleUpdate = <K extends keyof WebSettings>(key: K, value: WebSettings[K]) => {
    const updated = { ...settings, [key]: value }
    setSettings(updated)
    if (key === 'language') {
      setLanguage(value as 'vi' | 'en')
    } else {
      saveWebSettings({ [key]: value })
    }
  }

  const handleReset = () => {
    setSettings(DEFAULT_WEB_SETTINGS)
    saveWebSettings(DEFAULT_WEB_SETTINGS)
    setSavedSuccess(true)
    setTimeout(() => setSavedSuccess(false), 2000)
  }

  const handleSaveAndClose = () => {
    if (settings.language !== language) {
      setLanguage(settings.language)
    } else {
      saveWebSettings(settings)
    }
    setSavedSuccess(true)
    setTimeout(() => {
      setSavedSuccess(false)
      onClose()
    }, 400)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="md">
      <div className="flex flex-col gap-5 text-left">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200/60 flex items-center justify-center text-blue-600">
              <span className="material-symbols-outlined text-[22px]">settings</span>
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">{t('Cài đặt giao diện & hệ thống')}</h3>
              <p className="text-xs text-slate-500">{t('Tùy chỉnh trải nghiệm làm việc theo nhu cầu cá nhân')}</p>
            </div>
          </div>
          {savedSuccess && (
            <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold flex items-center gap-1 animate-in fade-in">
              <span className="material-symbols-outlined text-[16px]">check_circle</span>
              <span>{t('Đã lưu')}</span>
            </span>
          )}
        </div>

        {/* Content sections */}
        <div className="flex flex-col gap-4 max-h-[60vh] overflow-y-auto pr-1">
          {/* Section 1: Giao diện (Theme) */}
          <div className="rounded-xl border border-slate-200/80 p-3.5 bg-white space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-slate-500">palette</span>
                <span className="text-xs font-bold text-slate-900">{t('Giao diện (Chủ đề màu sắc)')}</span>
              </div>
              <span className="text-[11px] font-medium text-slate-500">
                {settings.theme === 'dark' ? t('Tối') : settings.theme === 'system' ? t('Tự động') : t('Sáng')}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1">
              {[
                { id: 'light', label: t('Sáng'), desc: t('Giao diện trắng tiêu chuẩn'), icon: 'light_mode' },
                { id: 'dark', label: t('Tối'), desc: t('Dịu mắt ban đêm'), icon: 'dark_mode' },
                { id: 'system', label: t('Tự động'), desc: t('Theo hệ điều hành'), icon: 'contrast' },
              ].map(item => {
                const isActive = settings.theme === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleUpdate('theme', item.id as any)}
                    aria-pressed={isActive}
                    className={`flex min-h-[92px] flex-col items-center justify-center gap-1.5 p-3 rounded-xl border text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer ${
                      isActive
                        ? 'border-blue-600 bg-blue-50/70 text-blue-900 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                    <span className="text-xs font-bold">{item.label}</span>
                    <span className="text-[10px] text-slate-500 leading-tight">{item.desc}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Section 2: Cỡ chữ & Hiển thị */}
          <div className="rounded-xl border border-slate-200/80 p-3.5 bg-white space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-slate-500">format_size</span>
                <span className="text-xs font-bold text-slate-900">{t('Kích thước phông chữ')}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              {[
                { id: 'normal', label: t('Tiêu chuẩn (100%)'), desc: t('Tối ưu sơ đồ & bảng dữ liệu'), icon: 'density_medium' },
                { id: 'large', label: t('Dễ đọc (+10%)'), desc: t('Cỡ chữ lớn hơn cho màn hình xa'), icon: 'density_small' },
              ].map(item => {
                const isActive = settings.fontSize === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleUpdate('fontSize', item.id as any)}
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isActive
                        ? 'border-blue-600 bg-blue-50/70 text-blue-900 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px] mt-0.5">{item.icon}</span>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold">{item.label}</span>
                      <span className="text-[10px] text-slate-500">{item.desc}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Section 3: Ngôn ngữ & Vùng */}
          <div className="rounded-xl border border-slate-200/80 p-3.5 bg-white space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-slate-500">translate</span>
                <span className="text-xs font-bold text-slate-900">{t('Ngôn ngữ hiển thị')}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              {[
                { id: 'vi', label: t('Tiếng Việt'), desc: t('Ngôn ngữ mặc định hệ thống') },
                { id: 'en', label: t('English'), desc: t('Global English interface') },
              ].map(item => {
                const isActive = settings.language === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleUpdate('language', item.id as any)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isActive
                        ? 'border-blue-600 bg-blue-50/70 text-blue-900 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div>
                      <p className="text-xs font-bold">{item.label}</p>
                      <p className="text-[10px] text-slate-500">{item.desc}</p>
                    </div>
                    {isActive && (
                      <span className="material-symbols-outlined text-[18px] text-blue-600">check</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Section 4: Phiên đăng nhập */}
          <div className="rounded-xl border border-slate-200/80 p-3.5 bg-white flex items-center justify-between">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-slate-500">lock_reset</span>
                <span className="text-xs font-bold text-slate-900">{t('Ghi nhớ phiên đăng nhập an toàn')}</span>
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5">{t('Duy trì trạng thái làm việc khi đóng trình duyệt')}</span>
            </div>
            <button
              type="button"
              onClick={() => handleUpdate('rememberSession', !settings.rememberSession)}
              className={`w-10 h-6 rounded-full p-0.5 transition-colors cursor-pointer ${
                settings.rememberSession ? 'bg-blue-600' : 'bg-slate-300'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                  settings.rememberSession ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Footer actions */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={handleReset}
            className="text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors cursor-pointer flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[15px]">refresh</span>
            <span>{t('Khôi phục mặc định')}</span>
          </button>
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              {t('Đóng')}
            </Button>
            <Button type="button" variant="primary" size="sm" onClick={handleSaveAndClose}>
              {t('Lưu & Áp dụng')}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
export default WebSettingsModal
