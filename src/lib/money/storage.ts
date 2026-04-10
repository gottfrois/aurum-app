import type { CurrencyDisplay, CurrencySign } from '~/lib/money/format'

export const MONEY_PREFS_STORAGE_KEY = 'bunkr:money-prefs'

export interface StoredMoneyPrefs {
  numberLocaleMode: 'auto' | string
  currencyDisplay: CurrencyDisplay
  currencySign: CurrencySign
  isPrivate: boolean
  /** Schema version, bump on breaking changes */
  _v?: number
}

const DEFAULT: StoredMoneyPrefs = {
  numberLocaleMode: 'auto',
  currencyDisplay: 'symbol',
  currencySign: 'standard',
  isPrivate: false,
  _v: 1,
}

export function loadMoneyPrefs(): StoredMoneyPrefs {
  if (typeof window === 'undefined') return DEFAULT
  try {
    const raw = window.localStorage.getItem(MONEY_PREFS_STORAGE_KEY)
    if (!raw) return DEFAULT
    const parsed = JSON.parse(raw) as Partial<StoredMoneyPrefs>
    return {
      numberLocaleMode: parsed.numberLocaleMode ?? DEFAULT.numberLocaleMode,
      currencyDisplay: parsed.currencyDisplay ?? DEFAULT.currencyDisplay,
      currencySign: parsed.currencySign ?? DEFAULT.currencySign,
      isPrivate: parsed.isPrivate ?? DEFAULT.isPrivate,
      _v: parsed._v ?? DEFAULT._v,
    }
  } catch {
    return DEFAULT
  }
}

export function saveMoneyPrefs(prefs: StoredMoneyPrefs): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(MONEY_PREFS_STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // Storage full or unavailable
  }
}
