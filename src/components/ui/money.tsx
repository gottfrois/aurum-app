import * as React from 'react'
import { AnimatedNumber } from '~/components/ui/animated-number'
import { useMoney } from '~/hooks/use-money'
import { MASKED } from '~/lib/money/constants'
import {
  type CurrencyDisplay,
  type CurrencySign,
  formatMoney,
  type MoneyFormatOptions,
} from '~/lib/money/format'
import { cn } from '~/lib/utils'

export interface MoneyProps {
  value: number
  /** ISO 4217 currency code, e.g. 'EUR'. Required — comes from per-account data. */
  currency: string
  /** Override the resolved preference */
  locale?: string
  currencyDisplay?: CurrencyDisplay
  currencySign?: CurrencySign
  notation?: 'standard' | 'compact'
  minimumFractionDigits?: number
  maximumFractionDigits?: number
  signDisplay?: Intl.NumberFormatOptions['signDisplay']
  /** Animate value transitions using a spring. Default: false */
  animate?: boolean
  mass?: number
  stiffness?: number
  damping?: number
  className?: string
  /** Override the masked placeholder ('••••••') */
  maskedPlaceholder?: string
}

export function Money({
  value,
  currency,
  locale: localeOverride,
  currencyDisplay: displayOverride,
  currencySign: signOverride,
  notation,
  minimumFractionDigits,
  maximumFractionDigits,
  signDisplay,
  animate = false,
  mass,
  stiffness,
  damping,
  className,
  maskedPlaceholder,
}: MoneyProps) {
  const { isPrivate, locale: resolvedLocale } = useMoney()

  const locale = localeOverride ?? resolvedLocale

  // Build the format options once per render input
  const formatOptions = React.useMemo<MoneyFormatOptions>(
    () => ({
      locale,
      currency,
      currencyDisplay: displayOverride,
      currencySign: signOverride,
      notation,
      minimumFractionDigits,
      maximumFractionDigits,
      signDisplay,
    }),
    [
      locale,
      currency,
      displayOverride,
      signOverride,
      notation,
      minimumFractionDigits,
      maximumFractionDigits,
      signDisplay,
    ],
  )

  // Memoized formatter for AnimatedNumber
  const formatFn = React.useCallback(
    (n: number) => formatMoney(n, formatOptions),
    [formatOptions],
  )

  // Privacy mode: never animate, just show the placeholder
  if (isPrivate) {
    return <span className={className}>{maskedPlaceholder ?? MASKED}</span>
  }

  // Non-finite values: render an em-dash
  if (!Number.isFinite(value)) {
    return <span className={className}>—</span>
  }

  if (animate) {
    return (
      <span className={cn(className)}>
        <AnimatedNumber
          // Reset the spring when currency or locale changes — animating
          // across units would be misleading
          key={`${currency}-${locale}`}
          value={value}
          format={formatFn}
          mass={mass}
          stiffness={stiffness}
          damping={damping}
        />
      </span>
    )
  }

  return <span className={className}>{formatMoney(value, formatOptions)}</span>
}

/** Convenience: <Money animate /> */
export function AnimatedMoney(props: Omit<MoneyProps, 'animate'>) {
  return <Money {...props} animate />
}
