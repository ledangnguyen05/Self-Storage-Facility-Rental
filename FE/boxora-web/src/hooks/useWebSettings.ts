import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { APP_EVENTS } from '../constants/storageKeys'
import {
  DEFAULT_WEB_SETTINGS,
  getWebSettings,
  saveWebSettings,
  type WebSettings,
} from '../utils/webSettings'

const DARK_QUERY = '(prefers-color-scheme: dark)'

function subscribeSystemTheme(onChange: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => undefined
  const media = window.matchMedia(DARK_QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

const getSystemPrefersDark = () =>
  typeof window !== 'undefined' && Boolean(window.matchMedia?.(DARK_QUERY).matches)

export interface UseWebSettingsResult {
  settings: WebSettings
  /** Theme actually applied ('system' resolved against the OS preference). */
  resolvedTheme: 'light' | 'dark'
  isDark: boolean
  /** Saves a partial update, applies it to the DOM and notifies every subscriber. */
  update: (patch: Partial<WebSettings>) => WebSettings
  setTheme: (theme: WebSettings['theme']) => void
  /** Flips between light and dark (leaves 'system' mode). */
  toggleTheme: () => void
  /** Restores DEFAULT_WEB_SETTINGS. */
  reset: () => WebSettings
}

/**
 * Live view of the persisted web settings (theme, font size, sound, language…).
 * Stays in sync across components and tabs through the settings-changed event.
 * Language changes should go through `useLanguage().setLanguage`, which also persists.
 */
export function useWebSettings(): UseWebSettingsResult {
  const [settings, setSettings] = useState<WebSettings>(getWebSettings)
  const systemPrefersDark = useSyncExternalStore(subscribeSystemTheme, getSystemPrefersDark, () => false)

  useEffect(() => {
    const onSettingsChanged = (event: Event) => {
      const detail = (event as CustomEvent<WebSettings | undefined>).detail
      setSettings(detail ?? getWebSettings())
    }
    window.addEventListener(APP_EVENTS.settingsChanged, onSettingsChanged)
    return () => window.removeEventListener(APP_EVENTS.settingsChanged, onSettingsChanged)
  }, [])

  const resolvedTheme: 'light' | 'dark' =
    settings.theme === 'dark' || (settings.theme === 'system' && systemPrefersDark) ? 'dark' : 'light'

  const update = useCallback((patch: Partial<WebSettings>) => {
    const next = saveWebSettings(patch)
    setSettings(next)
    return next
  }, [])

  const setTheme = useCallback((theme: WebSettings['theme']) => {
    update({ theme })
  }, [update])

  const toggleTheme = useCallback(() => {
    update({ theme: resolvedTheme === 'dark' ? 'light' : 'dark' })
  }, [update, resolvedTheme])

  const reset = useCallback(() => update(DEFAULT_WEB_SETTINGS), [update])

  return { settings, resolvedTheme, isDark: resolvedTheme === 'dark', update, setTheme, toggleTheme, reset }
}
