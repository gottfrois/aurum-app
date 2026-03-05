import * as React from 'react'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import type { TooltipProps } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '~/components/ui/chart'
import { ToggleGroup, ToggleGroupItem } from '~/components/ui/toggle-group'
import { Skeleton } from '~/components/ui/skeleton'
import { PERIODS, type Period } from '~/lib/chart-periods'

interface CategorySeries {
  key: string
  label: string
  color: string
}

interface StackedBalanceChartProps {
  data: Record<string, string | number>[]
  categories: CategorySeries[]
  currency: string
  isLoading: boolean
  period: Period
  onPeriodChange: (period: Period) => void
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
  categories: CategorySeries[]
}) {
  const labelMap = React.useMemo(() => {
    const map = new Map<string, string>()
    for (const cat of categories) {
      map.set(cat.key, cat.label)
    }
    return map
  }, [categories])
  if (!active || !payload?.length) return null

  const total = payload.reduce((sum, entry) => sum + (entry.value ?? 0), 0)

  return (
    <div className="grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
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
                <span className="text-muted-foreground">{labelMap.get(entry.dataKey as string) ?? entry.name}</span>
                <span className="font-mono font-medium tabular-nums">
                  {formatCurrency(entry.value ?? 0)}
                </span>
              </div>
            </div>
          ))}
        <div className="flex items-center justify-between gap-4 border-t pt-1.5 font-medium">
          <span>Total</span>
          <span className="font-mono tabular-nums">
            {formatCurrency(total)}
          </span>
        </div>
      </div>
    </div>
  )
}

export function StackedBalanceChart({
  data,
  categories,
  currency,
  isLoading,
  period,
  onPeriodChange,
}: StackedBalanceChartProps) {
  const formatCurrency = React.useMemo(
    () => currencyFormatter(currency),
    [currency],
  )

  const chartConfig = React.useMemo(() => {
    const config: ChartConfig = {}
    for (const cat of categories) {
      config[cat.key] = { label: cat.label, color: cat.color }
    }
    return config
  }, [categories])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={period}
          onValueChange={(val) => {
            if (val) onPeriodChange(val as Period)
          }}
        >
          {PERIODS.map((p) => (
            <ToggleGroupItem key={p} value={p}>
              {p}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {isLoading ? (
        <Skeleton className="h-[250px] w-full" />
      ) : data.length < 2 ? (
        <div className="flex h-[250px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
          Not enough data to display a chart
        </div>
      ) : (
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
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
                  <stop
                    offset="5%"
                    stopColor={cat.color}
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor={cat.color}
                    stopOpacity={0.05}
                  />
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
              content={<StackedTooltipContent formatCurrency={formatCurrency} categories={categories} />}
            />
            <ChartLegend content={<ChartLegendContent />} />
            {categories.map((cat) => (
              <Area
                key={cat.key}
                dataKey={cat.key}
                type="natural"
                stackId="1"
                stroke={cat.color}
                fill={`url(#fill-${cat.key})`}
                strokeWidth={2}
              />
            ))}
          </AreaChart>
        </ChartContainer>
      )}
    </div>
  )
}
