export interface WebSettings {
  theme: 'light' | 'dark' | 'system'
  fontSize: 'normal' | 'large'
  enableNotifications: boolean
  enableEmergencySound: boolean
  soundVolume: number
  language: 'vi' | 'en'
  rememberSession: boolean
}

const STORAGE_KEY = 'boxora_web_settings'

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
      language: 'vi',
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
      window.dispatchEvent(new CustomEvent('boxora_settings_changed', { detail: syncedSettings }))
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
    window.dispatchEvent(new CustomEvent('boxora_settings_changed', { detail: updated }))
  }

  return updated
}

export const playEmergencySoundPreview = (volume: number = 80) => {
  if (typeof window === 'undefined') return
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, audioCtx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.3)
    gain.gain.setValueAtTime((volume / 100) * 0.3, audioCtx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3)
    osc.connect(gain)
    gain.connect(audioCtx.destination)
    osc.start()
    osc.stop(audioCtx.currentTime + 0.3)
  } catch (e) {
    console.warn('Web Audio API not supported or blocked:', e)
  }
}

