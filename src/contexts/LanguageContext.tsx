"use client"

import React, { createContext, useContext, useEffect, useCallback, useSyncExternalStore } from 'react'
import { en, th, type MessageKey } from '@/i18n/messages'

type Language = 'en' | 'th'

type LanguageContextType = {
  language: Language
  setLanguage: (lang: Language) => void
  /** Translate a UI key. `{name}` placeholders are filled from `vars`. Unknown keys are returned as-is. */
  t: (key: MessageKey | (string & {}), vars?: Record<string, string | number>) => string
  /** Translate a category name stored in the DB; custom categories pass through unchanged. */
  tc: (categoryName: string) => string
  /** Locale for Intl / toLocaleString */
  locale: 'th-TH' | 'en-US'
}

const translations: Record<Language, Record<string, string>> = { en, th }
const STORAGE_KEY = 'wealthness_lang'

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

// Language lives in localStorage; useSyncExternalStore keeps every reader in sync with it
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

function getLanguageSnapshot(): Language {
  let saved: string | null = null
  try { saved = localStorage.getItem(STORAGE_KEY) } catch {}
  if (saved === 'en' || saved === 'th') return saved
  // First visit: follow the browser, defaulting non-Thai browsers to English
  return navigator.language.toLowerCase().startsWith('th') ? 'th' : 'en'
}

const getServerLanguage = (): Language => 'th'

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const language = useSyncExternalStore(subscribe, getLanguageSnapshot, getServerLanguage)

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  const setLanguage = (lang: Language) => {
    try { localStorage.setItem(STORAGE_KEY, lang) } catch {}
    listeners.forEach(listener => listener())
  }

  const t = useCallback((key: string, vars?: Record<string, string | number>) => {
    let text = translations[language][key] ?? key
    if (vars) {
      for (const [name, value] of Object.entries(vars)) text = text.replaceAll(`{${name}}`, String(value))
    }
    return text
  }, [language])

  const tc = useCallback((categoryName: string) => translations[language][`category.${categoryName}`] ?? categoryName, [language])

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, tc, locale: language === 'th' ? 'th-TH' : 'en-US' }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}
