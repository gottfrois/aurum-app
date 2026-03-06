import * as React from 'react'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import type { Period } from '~/lib/chart-periods'
import type { ChartConfig } from '~/components/ui/chart'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '~/components/ui/chart'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import { Skeleton } from '~/components/ui/skeleton'
import { computePnL } from '~/lib/pnl'
import { downsample } from '~/lib/downsample'
import { PnLBadge } from '~/components/pnl-badge'
import { PeriodSelector } from '~/components/period-selector'
import { usePrivacy } from '~/contexts/privacy-context'

const MAX_CHART_POINTS = 300

const chartConfig = {
  balance: {
    label: 'Balance',
    color: 'var(--color-primary)',
  },
} satisfies ChartConfig

interface BalanceChartData {
  date: string
  balance: number
}

interface BalanceChartProps {
  data: Array<BalanceChartData>
  currency: string
  isLoading: boolean
  period: Period
  onPeriodChange: (period: Period) => void
  title?: string
  description?: string
}

const currencyFormatter = (currency: string) => (value: number) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)

function ChartArea({
  data,
  formatCurrency,
}: {
  data: Array<BalanceChartData>
  formatCurrency: (value: number) => string
}) {
  return (
    <ChartContainer
      config={chartConfig}
      className="aspect-auto h-[250px] w-full"
    >
      <AreaChart data={data}>
        <defs>
          <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="5%"
              stopColor="var(--color-primary)"
              stopOpacity={0.3}
            />
            <stop
              offset="95%"
              stopColor="var(--color-primary)"
              stopOpacity={0.05}
            />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={32}
          tickFormatter={(val: string) => {
            const d = new Date(val)
            return d.toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'short',
            })
          }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={formatCurrency}
          width={80}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              labelFormatter={(val: string) => {
                return new Date(val).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })
              }}
              formatter={(value) => formatCurrency(value as number)}
              indicator="dot"
            />
          }
        />
        <Area
          dataKey="balance"
          type="natural"
          stroke="var(--color-primary)"
          fill="url(#balanceFill)"
          strokeWidth={2}
        />
      </AreaChart>
    </ChartContainer>
  )
}

export function BalanceChart({
  data,
  currency,
  isLoading,
  period,
  onPeriodChange,
  title,
  description,
}: BalanceChartProps) {
  const { isPrivate } = usePrivacy()
  const formatCurrency = React.useMemo(
    () => (isPrivate ? () => '••••••' : currencyFormatter(currency)),
    [currency, isPrivate],
  )

  const chartData = React.useMemo(() => {
    console.log('[debug] BalanceChart input points:', data.length)
    const result = downsample(data, MAX_CHART_POINTS)
    console.log('[debug] BalanceChart after downsample:', result.length)
    return result
  }, [data])
  const pnl = React.useMemo(() => computePnL(data), [data])

  if (title) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description && (
            <CardDescription className="flex items-center gap-2">
              {description}
              <PnLBadge pnl={pnl} currency={currency} />
            </CardDescription>
          )}
          <CardAction>
            <PeriodSelector period={period} onPeriodChange={onPeriodChange} />
          </CardAction>
        </CardHeader>
        <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
          {isLoading ? (
            <Skeleton className="h-[250px] w-full" />
          ) : data.length < 2 ? (
            <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
              Not enough data to display a chart
            </div>
          ) : (
            <ChartArea data={chartData} formatCurrency={formatCurrency} />
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="@container/card space-y-4">
      <div className="flex items-center justify-end">
        <PeriodSelector period={period} onPeriodChange={onPeriodChange} />
      </div>

      {isLoading ? (
        <Skeleton className="h-[250px] w-full" />
      ) : data.length < 2 ? (
        <div className="flex h-[250px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
          Not enough data to display a chart
        </div>
      ) : (
        <ChartArea data={chartData} formatCurrency={formatCurrency} />
      )}
    </div>
  )
}
