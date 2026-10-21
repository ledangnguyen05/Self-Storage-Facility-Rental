import React, { useId } from 'react'
import { ChevronDown, ChevronRight, LogOut, Settings, UserRound, type LucideIcon } from 'lucide-react'
import { getRoleMeta } from '../../constants/statusMeta'
import { useLanguage } from '../../context/LanguageContext'
import { useWebSettings } from '../../hooks/useWebSettings'
import type { RoleType, User } from '../../types'
import { Avatar, Badge, Popover, Switch } from '../ui'
import { cn } from '../ui/cn'

interface UserAvatarDropdownProps {
  user: User | null
  role: RoleType | string | null
  onOpenProfile: () => void
  onOpenSettings: () => void
  onOpenLogoutConfirm: () => void
  /** Extra content under the profile header (e.g. a "go to portal" button on public pages). */
  extraActions?: React.ReactNode
}

/** Account menu: profile summary, profile/settings shortcuts, quick theme/sound/language toggles, logout. */
export const UserAvatarDropdown: React.FC<UserAvatarDropdownProps> = ({
  user,
  role,
  onOpenProfile,
  onOpenSettings,
  onOpenLogoutConfirm,
  extraActions,
}) => {
  const { language, setLanguage } = useLanguage()
  const { settings, isDark, update } = useWebSettings()
  const displayName = user?.fullName || user?.username || 'Tài khoản'
  const roleMeta = getRoleMeta(role ?? undefined)
  const languageLabelId = useId()

  const trigger = (
    <button
      type="button"
      aria-label={`Tài khoản: ${displayName}`}
      className="flex h-9 items-center gap-2 rounded-md px-1 text-left transition-colors hover:bg-surface-2 md:pr-2"
    >
      <Avatar name={displayName} src={user?.avatar} size="sm" />
      <span className="hidden min-w-0 flex-col md:flex">
        <span className="max-w-36 truncate text-sm font-medium leading-4 text-fg">{displayName}</span>
        <span className="max-w-36 truncate text-xs leading-4 text-fg-subtle">{roleMeta.label}</span>
      </span>
      <ChevronDown size={14} strokeWidth={1.75} aria-hidden="true" className="hidden text-fg-subtle md:block" />
    </button>
  )

  return (
    <Popover trigger={trigger} aria-label="Tài khoản" className="w-72 p-0">
      {({ close }) => {
        const run = (action: () => void) => () => {
          close()
          action()
        }
        return (
          <>
            <div className="flex items-start gap-3 px-4 py-3.5">
              <Avatar name={displayName} src={user?.avatar} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-fg">{displayName}</p>
                <p className="truncate text-dense text-fg-muted">{user?.email || 'Chưa cập nhật email'}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {role ? (
                    <Badge size="sm" tone={roleMeta.tone}>
                      {roleMeta.label}
                    </Badge>
                  ) : null}
                  {user?.phone ? <span className="truncate font-mono text-xs text-fg-subtle">{user.phone}</span> : null}
                </div>
              </div>
            </div>

            {extraActions ? <div className="px-4 pb-3">{extraActions}</div> : null}

            <div className="flex flex-col border-t border-line p-1">
              <MenuButton
                icon={UserRound}
                label="Tài khoản của tôi"
                hint={user?.phone ? 'Hồ sơ và đổi mật khẩu' : 'Bổ sung số điện thoại, đổi mật khẩu'}
                onClick={run(onOpenProfile)}
              />
              <MenuButton icon={Settings} label="Cài đặt giao diện & hệ thống" hint="Chủ đề, âm báo, ngôn ngữ, phiên đăng nhập" onClick={run(onOpenSettings)} />
            </div>

            <div className="flex flex-col gap-3 border-t border-line px-4 py-3">
              <p className="text-xs font-medium text-fg-subtle">Tùy chỉnh nhanh</p>
              <Switch
                size="sm"
                labelPosition="start"
                label="Giao diện tối"
                checked={isDark}
                onCheckedChange={checked => update({ theme: checked ? 'dark' : 'light' })}
              />
              <Switch
                size="sm"
                labelPosition="start"
                label="Âm báo thông báo"
                checked={settings.enableEmergencySound}
                onCheckedChange={checked => update({ enableEmergencySound: checked })}
              />
              <div className="flex items-center justify-between gap-4">
                <span id={languageLabelId} className="text-sm font-medium text-fg">
                  Ngôn ngữ
                </span>
                <div
                  role="group"
                  aria-labelledby={languageLabelId}
                  className="inline-flex items-center gap-0.5 rounded-md border border-line bg-surface-2 p-0.5"
                >
                  {(['vi', 'en'] as const).map(option => (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={language === option}
                      aria-label={option === 'vi' ? 'Tiếng Việt' : 'English'}
                      onClick={() => setLanguage(option)}
                      className={cn(
                        'h-6 min-w-8 rounded px-2 text-xs font-semibold transition-colors',
                        language === option ? 'bg-surface text-fg shadow-xs' : 'text-fg-muted hover:text-fg',
                      )}
                    >
                      {option.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-line p-1">
              <MenuButton icon={LogOut} label="Đăng xuất" tone="danger" onClick={run(onOpenLogoutConfirm)} />
            </div>
          </>
        )
      }}
    </Popover>
  )
}

function MenuButton({
  icon: Icon,
  label,
  hint,
  tone = 'default',
  onClick,
}: {
  icon: LucideIcon
  label: string
  hint?: string
  tone?: 'default' | 'danger'
  onClick: () => void
}) {
  const danger = tone === 'danger'
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors',
        danger ? 'text-danger hover:bg-danger-subtle' : 'text-fg hover:bg-surface-2',
      )}
    >
      <Icon size={16} strokeWidth={1.75} aria-hidden="true" className={cn('shrink-0', danger ? 'text-danger' : 'text-fg-subtle')} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{label}</span>
        {hint ? <span className="truncate text-xs text-fg-subtle">{hint}</span> : null}
      </span>
      {!danger ? <ChevronRight size={14} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-fg-subtle" /> : null}
    </button>
  )
}

export default UserAvatarDropdown
