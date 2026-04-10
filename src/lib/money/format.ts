/**
 * Pure currency formatting helpers. No React imports, no module-level cache —
 * `Intl.NumberFormat` construction is cheap, and React-level memoization
 * (`useCallback` in `useMoney`, `useMemo` in `<Money>`) is enough.
 */

export type CurrencyDisplay = 'symbol' | 'narrowSymbol' | 'code'
export type CurrencySign = 'standard' | 'accounting'

export interface MoneyFormatOptions {
  /** BCP 47 locale, e.g. 'fr-FR' */
  locale: string
  /** ISO 4217 currency code, e.g. 'EUR' */
  currency: string
  currencyDisplay?: CurrencyDisplay
  currencySign?: CurrencySign
  notation?: Intl.NumberFormatOptions['notation']
  minimumFractionDigits?: number
  maximumFractionDigits?: number
  signDisplay?: Intl.NumberFormatOptions['signDisplay']
}

export function formatMoney(value: number, o: MoneyFormatOptions): string {
  return new Intl.NumberFormat(o.locale, {
    style: 'currency',
    currency: o.currency,
    currencyDisplay: o.currencyDisplay,
    currencySign: o.currencySign,
    notation: o.notation,
    minimumFractionDigits: o.minimumFractionDigits,
    maximumFractionDigits: o.maximumFractionDigits,
    signDisplay: o.signDisplay,
  }).format(value)
}
