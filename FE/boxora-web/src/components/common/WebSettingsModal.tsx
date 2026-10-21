import React, { useId, useState } from 'react'
import { Bell, Languages, Monitor, Moon, Palette, Play, RotateCcw, Sun, Type, Volume2, type LucideIcon } from 'lucide-react'
import { useLanguage } from '../../context/LanguageContext'
import { useWebSettings } from '../../hooks/useWebSettings'
import {
  getBrowserNotificationPermission,
  playAlertSound,
  requestBrowserNotificationPermission,
  showBrowserNotification,
  type BrowserNotificationPermission,
  type WebSettings,
} from '../../utils/webSettings'
import { Button, Modal, Switch, useToast } from '../ui'
import { cn } from '../ui/cn'

interface WebSettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

interface ChoiceOption<T extends string> {
  value: T
  label: string
  description: string
  icon?: LucideIcon
}

const THEME_OPTIONS: ChoiceOption<WebSettings['theme']>[] = [
  { value: 'light', label: 'Sáng', description: 'Giao diện trắng tiêu chuẩn', icon: Sun },
  { value: 'dark', label: 'Tối', description: 'Dịu mắt ban đêm', icon: Moon },
  { value: 'system', label: 'Tự động', description: 'Theo hệ điều hành', icon: Monitor },
]

const FONT_OPTIONS: ChoiceOption<WebSettings['fontSize']>[] = [
  { value: 'normal', label: 'Tiêu chuẩn (100%)', description: 'Tối ưu sơ đồ & bảng dữ liệu' },
  { value: 'large', label: 'Dễ đọc (+10%)', description: 'Cỡ chữ lớn hơn cho màn hình xa' },
]

const NOTIFICATION_PERMISSION_HINT: Record<BrowserNotificationPermission, string> = {
  unsupported: 'Trình duyệt này không hỗ trợ thông báo trên màn hình.',
  denied: 'Bạn đã chặn thông báo cho trang này. Hãy cho phép lại trong cài đặt của trình duyệt.',
  default: 'Hiện thông báo trên màn hình máy khi có thông báo mới. Trình duyệt sẽ hỏi quyền khi bạn bật.',
  granted: 'Hiện thông báo trên màn hình máy khi có thông báo mới, kể cả khi bạn đang ở tab khác.',
}

const LANGUAGE_OPTIONS: ChoiceOption<WebSettings['language']>[] = [
  { value: 'vi', label: 'Tiếng Việt', description: 'Ngôn ngữ mặc định hệ thống' },
  { value: 'en', label: 'English', description: 'Global English interface' },
]

/** Appearance, sound, language and session preferences. Changes apply immediately. */
export const WebSettingsModal: React.FC<WebSettingsModalProps> = ({ isOpen, onClose }) => {
  const { language, setLanguage } = useLanguage()
  const { settings, update, reset } = useWebSettings()
  const toast = useToast()
  const [permission, setPermission] = useState<BrowserNotificationPermission>(getBrowserNotificationPermission)

  /** Turning browser notifications on asks the browser for permission and only stays on when it is granted. */
  const handleBrowserNotifications = async (checked: boolean) => {
    if (!checked) {
      update({ enableNotifications: false })
      return
    }
    const result = await requestBrowserNotificationPermission()
    setPermission(result)
    if (result === 'granted') {
      update({ enableNotifications: true })
      toast.success('Đã bật thông báo của trình duyệt')
    } else {
      update({ enableNotifications: false })
      toast.warning('Chưa bật được thông báo', NOTIFICATION_PERMISSION_HINT[result])
    }
  }

  const sendTestNotification = () => {
    const shown = showBrowserNotification('Thông báo thử từ Boxora', 'Bạn sẽ nhận thông báo như thế này khi có thông tin mới.', 'boxora-test')
    if (!shown) toast.warning('Không hiện được thông báo', NOTIFICATION_PERMISSION_HINT[getBrowserNotificationPermission()])
  }

  const handleReset = () => {
    reset()
    toast.success('Đã khôi phục cài đặt mặc định')
  }

  const handleSaveAndClose = () => {
    if (settings.language !== language) setLanguage(settings.language)
    else update(settings)
    toast.success('Đã lưu cài đặt')
    onClose()
  }

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="md"
      title="Cài đặt giao diện & hệ thống"
      description="Tùy chỉnh trải nghiệm làm việc theo nhu cầu cá nhân."
      footer={
        <>
          <Button variant="ghost" leftIcon={RotateCcw} onClick={handleReset} className="mr-auto">
            Khôi phục mặc định
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Đóng
          </Button>
          <Button onClick={handleSaveAndClose}>Lưu & áp dụng</Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <ChoiceGroup
          icon={Palette}
          legend="Giao diện"
          options={THEME_OPTIONS}
          value={settings.theme}
          onChange={theme => update({ theme })}
          columns={3}
        />

        <ChoiceGroup
          icon={Type}
          legend="Kích thước phông chữ"
          options={FONT_OPTIONS}
          value={settings.fontSize}
          onChange={fontSize => update({ fontSize })}
          columns={2}
        />

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <SectionTitle icon={Volume2}>Âm báo và thông báo</SectionTitle>
            <Button variant="ghost" size="sm" leftIcon={Play} onClick={() => playAlertSound(settings.soundVolume)}>
              Nghe thử
            </Button>
          </div>
          <div className="flex flex-col gap-4 rounded-lg border border-line p-4">
            <Switch
              labelPosition="start"
              label="Âm báo khi có thông báo mới"
              description="Phát âm báo ngắn khi Boxora gửi thông báo mới cho tài khoản của bạn (mã PIN, hoàn tiền, nhắc gia hạn…)"
              checked={settings.enableEmergencySound}
              onCheckedChange={checked => update({ enableEmergencySound: checked })}
            />
            {settings.enableEmergencySound ? <VolumeSlider value={settings.soundVolume} onChange={soundVolume => update({ soundVolume })} /> : null}
            <Switch
              labelPosition="start"
              label="Thông báo của trình duyệt"
              description={NOTIFICATION_PERMISSION_HINT[permission]}
              checked={settings.enableNotifications && permission === 'granted'}
              disabled={permission === 'unsupported' || permission === 'denied'}
              onCheckedChange={checked => void handleBrowserNotifications(checked)}
            />
            {settings.enableNotifications && permission === 'granted' ? (
              <div>
                <Button variant="secondary" size="sm" leftIcon={Bell} onClick={sendTestNotification}>
                  Gửi thông báo thử
                </Button>
              </div>
            ) : null}
          </div>
        </section>

        <ChoiceGroup
          icon={Languages}
          legend="Ngôn ngữ hiển thị"
          options={LANGUAGE_OPTIONS}
          value={settings.language}
          onChange={lang => setLanguage(lang)}
          columns={2}
        />

        <div className="rounded-lg border border-line p-4">
          <Switch
            labelPosition="start"
            label="Ghi nhớ phiên đăng nhập"
            description="Giữ bạn đăng nhập khi đóng trình duyệt. Tắt để tự đăng xuất khi đóng tab, nên tắt trên máy dùng chung"
            checked={settings.rememberSession}
            onCheckedChange={checked => update({ rememberSession: checked })}
          />
        </div>
      </div>
    </Modal>
  )
}

function SectionTitle({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2 text-sm font-semibold text-fg">
      <Icon size={16} strokeWidth={1.75} aria-hidden="true" className="text-fg-subtle" />
      {children}
    </span>
  )
}

function ChoiceGroup<T extends string>({
  icon,
  legend,
  options,
  value,
  onChange,
  columns,
}: {
  icon: LucideIcon
  legend: string
  options: ChoiceOption<T>[]
  value: T
  onChange: (value: T) => void
  columns: 2 | 3
}) {
  const name = useId()
  return (
    <fieldset className="min-w-0">
      <legend className="mb-3">
        <SectionTitle icon={icon}>{legend}</SectionTitle>
      </legend>
      <div className={cn('grid gap-2', columns === 3 ? 'grid-cols-3' : 'grid-cols-1 sm:grid-cols-2')}>
        {options.map(option => {
          const checked = option.value === value
          const Icon = option.icon
          return (
            <label
              key={option.value}
              className={cn(
                'flex cursor-pointer gap-2.5 rounded-lg border p-3 transition-colors',
                'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring',
                Icon ? 'flex-col items-center text-center' : 'items-start',
                checked ? 'border-accent bg-accent-subtle' : 'border-line hover:border-line-strong hover:bg-surface-2',
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              {Icon ? (
                <Icon size={20} strokeWidth={1.75} aria-hidden="true" className={checked ? 'text-accent-text' : 'text-fg-subtle'} />
              ) : null}
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className={cn('text-sm font-medium', checked ? 'text-accent-text' : 'text-fg')}>{option.label}</span>
                <span className="text-xs text-fg-muted">{option.description}</span>
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

function VolumeSlider({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const id = useId()
  return (
    <div className="flex items-center gap-3">
      <label htmlFor={id} className="shrink-0 text-dense text-fg-muted">
        Âm lượng còi
      </label>
      <input
        id={id}
        type="range"
        min={10}
        max={100}
        value={value}
        data-slot="range"
        onChange={event => onChange(Number(event.target.value))}
        className="h-1.5 w-full cursor-pointer accent-accent"
      />
      <span className="w-10 shrink-0 text-right font-mono text-dense tabular-nums text-fg">{value}%</span>
    </div>
  )
}

export default WebSettingsModal
