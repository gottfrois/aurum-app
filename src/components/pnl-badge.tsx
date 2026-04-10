import { TrendingDown, TrendingUp } from 'lucide-react'
import { Badge } from '~/components/ui/badge'
import { Money } from '~/components/ui/money'
import { useMoney } from '~/hooks/use-money'
import type { PnL } from '~/lib/pnl'

interface PnLBadgeProps {
  pnl: PnL | null
  currency: string
}

export function PnLBadge({ pnl, currency }: PnLBadgeProps) {
  const { isPrivate } = useMoney()

  if (!pnl) return null

  const Icon = pnl.isPositive ? TrendingUp : TrendingDown
  const sign = pnl.isPositive ? '+' : ''

  if (isPrivate) {
    return (
      <Badge variant="outline" className="text-muted-foreground border-muted">
        <Icon className="size-3" />
        <Money value={0} currency={currency} />
      </Badge>
    )
  }

  const formattedPercentage = `${sign}${pnl.percentage.toFixed(1)}%`

  return (
    <Badge
      variant="outline"
      className={
        pnl.isPositive
          ? 'text-success border-success/30'
          : 'text-destructive border-destructive/30'
      }
    >
      <Icon className="size-3" />
      {sign}
      <Money
        value={Math.abs(pnl.absolute)}
        currency={currency}
        maximumFractionDigits={0}
        signDisplay="never"
      />{' '}
      ({formattedPercentage})
    </Badge>
  )
}
