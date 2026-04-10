import type { CurrencyDisplay, CurrencySign } from '~/lib/money/format'

export const MASKED = '••••••'

/** Used as fallback when no per-account currency is available. */
export const FALLBACK_CURRENCY = 'EUR'

export const SUPPORTED_CURRENCY_DISPLAYS: ReadonlyArray<CurrencyDisplay> = [
  'symbol',
  'narrowSymbol',
  'code',
]

export const SUPPORTED_CURRENCY_SIGNS: ReadonlyArray<CurrencySign> = [
  'standard',
  'accounting',
]
