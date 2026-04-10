import * as React from 'react'
import { useTranslation } from 'react-i18next'
import type { CurrencyDisplay, CurrencySign } from '~/lib/money/format'
import { inferLocaleFromI18n } from '~/lib/money/locales'
import {
  loadMoneyPrefs,
  MONEY_PREFS_STORAGE_KEY,
  type StoredMoneyPrefs,
  saveMoneyPrefs,
} from '~/lib/money/storage'

export interface MoneyPreferences {
  /** Resolved BCP 47 locale (never literal 'auto') */
  numberLocale: string
  /** User-selected mode: 'auto' (follow i18n.language) or an explicit locale */
  numberLocaleMode: 'auto' | string
  currencyDisplay: CurrencyDisplay
  currencySign: CurrencySign
  isPrivate: boolean
}

interface MoneyPreferencesContextValue extends MoneyPreferences {
  setNumberLocale: (mode: 'auto' | string) => void
  setCurrencyDisplay: (d: CurrencyDisplay) => void
  setCurrencySign: (s: CurrencySign) => void
  togglePrivacy: () => void
  setPrivacy: (p: boolean) => void
}

const MoneyPreferencesContext =
  React.createContext<MoneyPreferencesContextValue | null>(null)

export function MoneyPreferencesProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { i18n } = useTranslation()

  // Synchronous init from localStorage to avoid first-paint flash for privacy mode
  const [stored, setStored] = React.useState<StoredMoneyPrefs>(() =>
    loadMoneyPrefs(),
  )

  // Cross-tab sync
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const onStorage = (e: StorageEvent) => {
      if (e.key !== MONEY_PREFS_STORAGE_KEY || !e.newValue) return
      try {
        const parsed = JSON.parse(e.newValue) as StoredMoneyPrefs
        setStored(parsed)
      } catch {
        // Ignore corrupted payloads
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const updateStored = React.useCallback((patch: Partial<StoredMoneyPrefs>) => {
    setStored((prev) => {
      const next = { ...prev, ...patch }
      saveMoneyPrefs(next)
      return next
    })
  }, [])

  const setNumberLocale = React.useCallback(
    (mode: 'auto' | string) => updateStored({ numberLocaleMode: mode }),
    [updateStored],
  )
  const setCurrencyDisplay = React.useCallback(
    (d: CurrencyDisplay) => updateStored({ currencyDisplay: d }),
    [updateStored],
  )
  const setCurrencySign = React.useCallback(
    (s: CurrencySign) => updateStored({ currencySign: s }),
    [updateStored],
  )
  const setPrivacy = React.useCallback(
    (p: boolean) => updateStored({ isPrivate: p }),
    [updateStored],
  )
  const togglePrivacy = React.useCallback(
    () => updateStored({ isPrivate: !stored.isPrivate }),
    [updateStored, stored.isPrivate],
  )

  // Resolve numberLocale: 'auto' → derive from i18n.language
  const numberLocale =
    stored.numberLocaleMode === 'auto'
      ? inferLocaleFromI18n(i18n.language)
      : stored.numberLocaleMode

  const value = React.useMemo<MoneyPreferencesContextValue>(
    () => ({
      numberLocale,
      numberLocaleMode: stored.numberLocaleMode,
      currencyDisplay: stored.currencyDisplay,
      currencySign: stored.currencySign,
      isPrivate: stored.isPrivate,
      setNumberLocale,
      setCurrencyDisplay,
      setCurrencySign,
      togglePrivacy,
      setPrivacy,
    }),
    [
      numberLocale,
      stored.numberLocaleMode,
      stored.currencyDisplay,
      stored.currencySign,
      stored.isPrivate,
      setNumberLocale,
      setCurrencyDisplay,
      setCurrencySign,
      togglePrivacy,
      setPrivacy,
    ],
  )

  return (
    <MoneyPreferencesContext.Provider value={value}>
      {children}
    </MoneyPreferencesContext.Provider>
  )
}

export function useMoneyPreferences(): MoneyPreferencesContextValue {
  const ctx = React.useContext(MoneyPreferencesContext)
  if (!ctx) {
    throw new Error(
      'useMoneyPreferences must be used within a MoneyPreferencesProvider',
    )
  }
  return ctx
}
