import * as React from 'react'
import { useMoneyPreferences } from '~/contexts/money-preferences-context'
import { MASKED } from '~/lib/money/constants'
import { formatMoney, type MoneyFormatOptions } from '~/lib/money/format'

export interface UseMoneyResult {
  /**
   * Format a monetary value. Returns the masked placeholder when privacy
   * mode is enabled. Per-call options override the user preferences.
   */
  format: (
    value: number,
    currency: string,
    opts?: Partial<MoneyFormatOptions>,
  ) => string
  isPrivate: boolean
  locale: string
}

export function useMoney(): UseMoneyResult {
  const { numberLocale, currencyDisplay, currencySign, isPrivate } =
    useMoneyPreferences()

  const format = React.useCallback(
    (
      value: number,
      currency: string,
      opts?: Partial<MoneyFormatOptions>,
    ): string => {
      if (isPrivate) return MASKED
      return formatMoney(value, {
        locale: opts?.locale ?? numberLocale,
        currency: opts?.currency ?? currency,
        currencyDisplay: opts?.currencyDisplay ?? currencyDisplay,
        currencySign: opts?.currencySign ?? currencySign,
        notation: opts?.notation,
        minimumFractionDigits: opts?.minimumFractionDigits,
        maximumFractionDigits: opts?.maximumFractionDigits,
        signDisplay: opts?.signDisplay,
      })
    },
    [numberLocale, currencyDisplay, currencySign, isPrivate],
  )

  return {
    format,
    isPrivate,
    locale: numberLocale,
  }
}
