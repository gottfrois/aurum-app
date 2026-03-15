import { TrendingDown, TrendingUp } from 'lucide-react'
import { PnLBadge } from '~/components/pnl-badge'
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import type { PnL } from '~/lib/pnl'

interface DashboardCardProps {
  title: string
  value: string
  pnl: PnL | null
  currency: string
  description?: string
  className?: string
}

export function DashboardCard({
  title,
  value,
  pnl,
  currency,
  description,
  className,
}: DashboardCardProps) {
  const Icon = pnl?.isPositive ? TrendingUp : TrendingDown

  return (
    <Card className={`@container/card ${className ?? ''}`}>
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
          {value}
        </CardTitle>
        <CardAction>
          <PnLBadge pnl={pnl} currency={currency} />
        </CardAction>
      </CardHeader>
      <CardFooter className="flex-col items-start gap-1.5 text-sm">
        {pnl && (
          <div className="line-clamp-1 flex gap-2 font-medium">
            {pnl.isPositive ? 'Trending up' : 'Trending down'} this period
            <Icon className="size-4" />
          </div>
        )}
        <div className="text-muted-foreground">{description ?? '\u00A0'}</div>
      </CardFooter>
    </Card>
  )
}
