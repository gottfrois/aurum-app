import * as React from 'react'
import { useTranslation } from 'react-i18next'
import type { TooltipProps } from 'recharts'
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
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
} from '~/components/ui/chart'
import { Skeleton } from '~/components/ui/skeleton'
import { usePrivacy } from '~/contexts/privacy-context'
import type { Period } from '~/lib/chart-periods'
import { downsampleRecords } from '~/lib/downsample'
import type { PnL } from '~/lib/pnl'

const MAX_CHART_POINTS = 300

interface CategorySeries {
  key: string
  label: string
  color: string
}

interface StackedBalanceChartProps {
  data: Array<Record<string, string | number>>
  categories: Array<CategorySeries>
  currency: string
  isLoading: boolean
  period: Period
  onPeriodChange: (period: Period) => void
  title?: string
  description?: string
  pnl?: PnL | null
}

const currencyFormatter = (currency: string) => (value: number) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)

function StackedTooltipContent({
  active,
  payload,
  label,
  formatCurrency,
  categories,
}: TooltipProps<number, string> & {
  formatCurrency: (value: number) => string
  categories: Array<CategorySeries>
}) {
  const labelMap = React.useMemo(() => {
    const map = new Map<string, string>()
    for (const cat of categories) {
      map.set(cat.key, cat.label)
    }
    return map
  }, [categories])
  const { t } = useTranslation()
  if (!active || !payload?.length) return null

  const total = payload.reduce((sum, entry) => sum + (entry.value ?? 0), 0)

  return (
    <div className="grid min-w-32 items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium">
        {new Date(label as string).toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}
      </div>
      <div className="grid gap-1.5">
        {payload
          .filter((entry) => entry.type !== 'none')
          .map((entry) => (
            <div key={entry.dataKey} className="flex items-center gap-2">
              <div
                className="size-2.5 shrink-0 rounded-[2px]"
                style={{ backgroundColor: entry.color }}
              />
              <div className="flex flex-1 items-center justify-between gap-4">
                <span className="text-muted-foreground">
                  {labelMap.get(entry.dataKey as string) ?? entry.name}
                </span>
                <span className="font-mono font-medium tabular-nums">
                  {formatCurrency(entry.value ?? 0)}
                </span>
              </div>
            </div>
          ))}
        <div className="flex items-center justify-between gap-4 border-t pt-1.5 font-medium">
          <span>{t('charts.total')}</span>
          <span className="font-mono tabular-nums">
            {formatCurrency(total)}
          </span>
        </div>
      </div>
    </div>
  )
}

function ChartContent({
  data,
  categories,
  formatCurrency,
  chartConfig,
  isLoading,
}: {
  data: Array<Record<string, string | number>>
  categories: Array<CategorySeries>
  formatCurrency: (value: number) => string
  chartConfig: ChartConfig
  isLoading: boolean
}) {
  const { t } = useTranslation()
  if (isLoading) {
    return <Skeleton className="h-full min-h-[250px] w-full" />
  }

  if (data.length < 2) {
    return (
      <div className="flex h-full min-h-[250px] items-center justify-center text-sm text-muted-foreground">
        {t('charts.notEnoughData')}
      </div>
    )
  }

  return (
    <ChartContainer
      config={chartConfig}
      className="aspect-auto h-full min-h-[250px] w-full"
    >
      <AreaChart data={data} stackOffset="none">
        <defs>
          {categories.map((cat) => (
            <linearGradient
              key={cat.key}
              id={`fill-${cat.key}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="5%" stopColor={cat.color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={cat.color} stopOpacity={0.05} />
            </linearGradient>
          ))}
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
          content={
            <StackedTooltipContent
              formatCurrency={formatCurrency}
              categories={categories}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        {categories.map((cat) => (
          <Area
            key={cat.key}
            dataKey={cat.key}
            type="monotone"
            stackId="1"
            stroke={cat.color}
            fill={`url(#fill-${cat.key})`}
            strokeWidth={2}
          />
        ))}
      </AreaChart>
    </ChartContainer>
  )
}

export function StackedBalanceChart({
  data,
  categories,
  currency,
  isLoading,
  period,
  onPeriodChange,
  title,
  description,
  pnl,
}: StackedBalanceChartProps) {
  const { isPrivate } = usePrivacy()
  const formatCurrency = React.useMemo(
    () => (isPrivate ? () => '••••••' : currencyFormatter(currency)),
    [currency, isPrivate],
  )

  const chartData = React.useMemo(
    () => downsampleRecords(data, MAX_CHART_POINTS),
    [data],
  )

  const chartConfig = React.useMemo(() => {
    const config: ChartConfig = {}
    for (const cat of categories) {
      config[cat.key] = { label: cat.label, color: cat.color }
    }
    return config
  }, [categories])

  if (title) {
    return (
      <Card className="@container/card flex h-full flex-col">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description && (
            <CardDescription className="flex items-center gap-2">
              {description}
              <PnLBadge pnl={pnl ?? null} currency={currency} />
            </CardDescription>
          )}
          <CardAction>
            <PeriodSelector period={period} onPeriodChange={onPeriodChange} />
          </CardAction>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col px-2 pt-4 sm:px-6 sm:pt-6">
          <ChartContent
            data={chartData}
            categories={categories}
            formatCurrency={formatCurrency}
            chartConfig={chartConfig}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="@container/card space-y-4">
      <div className="flex items-center justify-end">
        <PeriodSelector period={period} onPeriodChange={onPeriodChange} />
      </div>
      <ChartContent
        data={data}
        categories={categories}
        formatCurrency={formatCurrency}
        chartConfig={chartConfig}
        isLoading={isLoading}
      />
    </div>
  )
}
