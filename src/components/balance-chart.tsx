import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { PeriodSelector } from '~/components/period-selector'
import { PnLBadge } from '~/components/pnl-badge'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import type { ChartConfig } from '~/components/ui/chart'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '~/components/ui/chart'
import { Skeleton } from '~/components/ui/skeleton'
import { useMoney } from '~/hooks/use-money'
import type { Period } from '~/lib/chart-periods'
import { downsample } from '~/lib/downsample'
import { computePnL } from '~/lib/pnl'

const MAX_CHART_POINTS = 300

// chartConfig label is resolved dynamically via i18n in the component
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
      className="aspect-auto h-full min-h-[250px] w-full"
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
          domain={['dataMin', 'dataMax']}
          padding={{ top: 20, bottom: 20 }}
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
          type="monotone"
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
  const { t } = useTranslation()
  const { format } = useMoney()
  const formatCurrency = React.useCallback(
    (value: number) => format(value, currency, { maximumFractionDigits: 0 }),
    [format, currency],
  )

  const chartData = React.useMemo(
    () => downsample(data, MAX_CHART_POINTS),
    [data],
  )
  const pnl = React.useMemo(() => computePnL(data), [data])

  if (title) {
    return (
      <Card className="@container/card flex h-full min-h-[380px] flex-col">
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
        <CardContent className="flex min-h-0 flex-1 flex-col px-2 pt-4 sm:px-6 sm:pt-6">
          {isLoading ? (
            <Skeleton className="h-full min-h-[250px] w-full" />
          ) : data.length < 2 ? (
            <div className="flex h-full min-h-[250px] items-center justify-center text-sm text-muted-foreground">
              {t('charts.notEnoughData')}
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
          {t('charts.notEnoughData')}
        </div>
      ) : (
        <ChartArea data={chartData} formatCurrency={formatCurrency} />
      )}
    </div>
  )
}
