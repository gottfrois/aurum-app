import { TrendingDown, TrendingUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useFormatCurrency, usePrivacy } from '~/contexts/privacy-context'
import { cn } from '~/lib/utils'

interface Investment {
  _id: string
  label: string
  code?: string
  valuation: number
  diff?: number
  diffPercent?: number
  currency?: string
}

const pctFmt = new Intl.NumberFormat('fr-FR', {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const MASKED = '••••••'

function InvestmentRow({
  inv,
  currency,
}: {
  inv: Investment
  currency: string
}) {
  const { isPrivate } = usePrivacy()
  const formatCurrency = useFormatCurrency()
  const isPositive = (inv.diff ?? 0) >= 0

  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{inv.label}</p>
        {inv.code && (
          <p className="text-xs text-muted-foreground">{inv.code}</p>
        )}
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-medium">
          {formatCurrency(inv.valuation, currency)}
        </p>
        {inv.diff != null && (
          <p
            className={cn(
              'text-xs',
              isPositive ? 'text-success' : 'text-destructive',
            )}
          >
            {isPrivate ? (
              MASKED
            ) : (
              <>
                {isPositive ? '+' : ''}
                {formatCurrency(inv.diff, currency)}
                {inv.diffPercent != null && (
                  <span className="ml-1">
                    ({isPositive ? '+' : ''}
                    {pctFmt.format(inv.diffPercent / 100)})
                  </span>
                )}
              </>
            )}
          </p>
        )}
      </div>
    </div>
  )
}

export function WinnersLosers({
  investments,
  currency,
}: {
  investments: Array<Investment>
  currency: string
}) {
  const { t } = useTranslation()
  const withPnl = investments.filter(
    (inv) => inv.diffPercent != null && inv.diffPercent !== 0,
  )

  const sorted = [...withPnl].sort(
    (a, b) => (b.diffPercent ?? 0) - (a.diffPercent ?? 0),
  )

  const winners = sorted.filter((inv) => (inv.diffPercent ?? 0) > 0).slice(0, 5)
  const losers = sorted
    .filter((inv) => (inv.diffPercent ?? 0) < 0)
    .reverse()
    .slice(0, 5)

  if (winners.length === 0 && losers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t('charts.noPerformanceData')}
      </p>
    )
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-success">
          <TrendingUp className="size-4" />
          {t('charts.topWinners')}
        </div>
        {winners.length > 0 ? (
          <div className="divide-y">
            {winners.map((inv) => (
              <InvestmentRow key={inv._id} inv={inv} currency={currency} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t('charts.noWinners')}
          </p>
        )}
      </div>
      <div>
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-destructive">
          <TrendingDown className="size-4" />
          {t('charts.topLosers')}
        </div>
        {losers.length > 0 ? (
          <div className="divide-y">
            {losers.map((inv) => (
              <InvestmentRow key={inv._id} inv={inv} currency={currency} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t('charts.noLosers')}
          </p>
        )}
      </div>
    </div>
  )
}
