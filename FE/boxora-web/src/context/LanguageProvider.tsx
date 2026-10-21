import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { APP_EVENTS } from '../constants/storageKeys'
import { getWebSettings, saveWebSettings, type WebSettings } from '../utils/webSettings'
import { DomTranslator } from './i18n/domTranslator'
import type { Translator } from './i18n/translator'
import { LanguageContext, type Language } from './languageStore'

let translatorPromise: Promise<Translator> | null = null

/** Loads the English dictionary on first use; Vietnamese sessions never download it. */
const loadEnglishTranslator = () => {
  translatorPromise ??= import('./i18n/runtime').then(module => module.englishTranslator)
  return translatorPromise
}

// Start downloading the dictionary early when the stored language is English.
if (typeof window !== 'undefined' && getWebSettings().language === 'en') {
  void loadEnglishTranslator()
}

/**
 * Owns the UI language. English is applied by `DomTranslator`, which rewrites a rendered text node or attribute only
 * when its whole text is a known phrase; unknown text and content data stay as written.
 */
export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => getWebSettings().language || 'vi')
  const [translator, setTranslator] = useState<Translator | null>(null)
  // A page that opens in English waits for the dictionary once, so Vietnamese never flashes before it is translated.
  // Switching language later never unmounts the app: the page just translates as soon as the dictionary arrives.
  const [awaitingDictionary, setAwaitingDictionary] = useState(() => language === 'en')

  useEffect(() => {
    if (language !== 'en') return
    let cancelled = false
    loadEnglishTranslator()
      .then(loaded => {
        if (cancelled) return
        setTranslator(loaded)
        setAwaitingDictionary(false)
      })
      .catch(error => {
        console.warn('Failed to load the English dictionary:', error)
        if (!cancelled) setAwaitingDictionary(false)
      })
    return () => {
      cancelled = true
    }
  }, [language])

  // Layout effect: translate the committed DOM before the browser paints it.
  useLayoutEffect(() => {
    if (language !== 'en' || !translator || typeof document === 'undefined') return
    const dom = new DomTranslator(translator)
    dom.start()
    return () => dom.stop()
  }, [language, translator])

  // Language changed elsewhere (settings modal, another tab).
  useEffect(() => {
    const handleSettingsChange = (event: Event) => {
      const next = (event as CustomEvent<Partial<WebSettings> | undefined>).detail?.language
      if (next && next !== language) setLanguageState(next)
    }
    window.addEventListener(APP_EVENTS.settingsChanged, handleSettingsChange)
    return () => window.removeEventListener(APP_EVENTS.settingsChanged, handleSettingsChange)
  }, [language])

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next)
    saveWebSettings({ language: next })
  }, [])

  const activeTranslator = language === 'en' ? translator : null
  const t = useCallback(
    (key: string, fallback?: string): string => {
      if (!key) return ''
      const translated = activeTranslator?.translate(key)
      return translated ?? fallback ?? key
    },
    [activeTranslator],
  )

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t])

  return <LanguageContext.Provider value={value}>{awaitingDictionary && language === 'en' ? null : children}</LanguageContext.Provider>
}
