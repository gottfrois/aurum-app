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
      <Badge variant="outline">
        <Icon className="size-3" />
        <Money value={0} currency={currency} />
      </Badge>
    )
  }

  const formattedPercentage = `${sign}${pnl.percentage.toFixed(1)}%`

  return (
    <Badge variant={pnl.isPositive ? 'success-light' : 'destructive-light'}>
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
