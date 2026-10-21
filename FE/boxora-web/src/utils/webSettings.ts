import { APP_EVENTS, STORAGE_KEYS } from '../constants/storageKeys'

export interface WebSettings {
  theme: 'light' | 'dark' | 'system'
  fontSize: 'normal' | 'large'
  enableNotifications: boolean
  enableEmergencySound: boolean
  soundVolume: number
  language: 'vi' | 'en'
  rememberSession: boolean
}

const STORAGE_KEY = STORAGE_KEYS.webSettings

export const DEFAULT_WEB_SETTINGS: WebSettings = {
  theme: 'light',
  fontSize: 'normal',
  enableNotifications: true,
  enableEmergencySound: true,
  soundVolume: 80,
  language: 'vi',
  rememberSession: true,
}

export const getWebSettings = (): WebSettings => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_WEB_SETTINGS
    const parsed = JSON.parse(raw) as Partial<WebSettings> | null
    if (!parsed || typeof parsed !== 'object') return DEFAULT_WEB_SETTINGS
    return {
      ...DEFAULT_WEB_SETTINGS,
      ...parsed,
      theme: parsed.theme === 'dark' || parsed.theme === 'system' ? parsed.theme : 'light',
      fontSize: parsed.fontSize === 'large' ? 'large' : 'normal',
      language: parsed.language === 'en' ? 'en' : 'vi',
    }
  } catch (e) {
    console.warn('Failed to parse web settings from localStorage:', e)
    return DEFAULT_WEB_SETTINGS
  }
}

export const getResolvedTheme = (settings: Pick<WebSettings, 'theme'> = getWebSettings()): 'light' | 'dark' => {
  if (settings.theme === 'dark') return 'dark'
  if (settings.theme === 'system' && typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  return 'light'
}

let systemThemeMediaQuery: MediaQueryList | null = null
let storageSyncAttached = false

const handleSystemThemeChange = (event: MediaQueryListEvent) => {
  const root = document.documentElement
  if (root.dataset.themeMode === 'system') {
    root.classList.toggle('dark', event.matches)
  }
}

export const applyWebSettingsToDOM = (settings: WebSettings) => {
  if (typeof document === 'undefined') return

  const root = document.documentElement

  // Theme
  root.dataset.themeMode = settings.theme
  root.classList.toggle('dark', getResolvedTheme(settings) === 'dark')

  if (typeof window !== 'undefined' && !systemThemeMediaQuery && window.matchMedia) {
    systemThemeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    if (systemThemeMediaQuery.addEventListener) {
      systemThemeMediaQuery.addEventListener('change', handleSystemThemeChange)
    } else {
      systemThemeMediaQuery.addListener?.(handleSystemThemeChange)
    }
  }

  if (typeof window !== 'undefined' && !storageSyncAttached) {
    window.addEventListener('storage', (event) => {
      if (event.key !== STORAGE_KEY) return
      const syncedSettings = getWebSettings()
      applyWebSettingsToDOM(syncedSettings)
      window.dispatchEvent(new CustomEvent(APP_EVENTS.settingsChanged, { detail: syncedSettings }))
    })
    storageSyncAttached = true
  }

  // Font Size
  if (settings.fontSize === 'large') {
    root.classList.add('font-large-comfort')
  } else {
    root.classList.remove('font-large-comfort')
  }

  // Language attribute
  root.setAttribute('lang', settings.language)
}

export const saveWebSettings = (newSettings: Partial<WebSettings>): WebSettings => {
  const current = getWebSettings()
  const updated = { ...current, ...newSettings }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch (e) {
    console.warn('Failed to save web settings to localStorage:', e)
  }
  applyWebSettingsToDOM(updated)

  // Dispatch custom event for real-time reactivity
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(APP_EVENTS.settingsChanged, { detail: updated }))
  }

  return updated
}

/**
 * Short two-tone alert (Web Audio, no asset needed). Used by the settings "Nghe thử" button and when a
 * new notification arrives while "Âm báo khi có thông báo mới" is on. Browsers only allow audio after the
 * user has interacted with the page once; before that the call is silently ignored.
 */
export const playAlertSound = (volume: number = 80) => {
  if (typeof window === 'undefined') return
  try {
    const AudioCtor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtor) return
    const audioCtx = new AudioCtor()
    void audioCtx.resume?.()
    const peak = Math.min(Math.max(volume, 0), 100) / 100 * 0.3
    const beep = (frequency: number, startAt: number) => {
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(frequency, audioCtx.currentTime + startAt)
      gain.gain.setValueAtTime(Math.max(peak, 0.001), audioCtx.currentTime + startAt)
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + startAt + 0.25)
      osc.connect(gain)
      gain.connect(audioCtx.destination)
      osc.start(audioCtx.currentTime + startAt)
      osc.stop(audioCtx.currentTime + startAt + 0.25)
    }
    beep(880, 0)
    beep(660, 0.3)
    window.setTimeout(() => void audioCtx.close?.(), 1000)
  } catch (e) {
    console.warn('Web Audio API not supported or blocked:', e)
  }
}

/** @deprecated Use playAlertSound. Kept so older imports keep working. */
export const playEmergencySoundPreview = playAlertSound

export type BrowserNotificationPermission = 'unsupported' | 'default' | 'granted' | 'denied'

/** Current state of the browser's Notification permission for this site. */
export const getBrowserNotificationPermission = (): BrowserNotificationPermission => {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission
}

/** Asks the browser for permission (must be called from a user gesture, e.g. flipping the switch). */
export const requestBrowserNotificationPermission = async (): Promise<BrowserNotificationPermission> => {
  if (getBrowserNotificationPermission() === 'unsupported') return 'unsupported'
  try {
    return await Notification.requestPermission()
  } catch {
    return getBrowserNotificationPermission()
  }
}

/** Shows an operating-system notification; returns false when it cannot (unsupported or not granted). */
export const showBrowserNotification = (title: string, body?: string, tag?: string): boolean => {
  if (getBrowserNotificationPermission() !== 'granted') return false
  try {
    new Notification(title, { body, tag, icon: '/favicon.svg' })
    return true
  } catch (e) {
    console.warn('Browser notification failed:', e)
    return false
  }
}
