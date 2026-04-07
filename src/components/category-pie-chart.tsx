import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Cell, Label, Pie, PieChart } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import type { ChartConfig } from '~/components/ui/chart'
import { ChartContainer, ChartTooltip } from '~/components/ui/chart'
import { usePrivacy } from '~/contexts/privacy-context'
import { cn } from '~/lib/utils'

interface CategoryEntry {
  key: string
  label: string
  value: number
  color: string
}

interface CategoryPieChartProps {
  data: Array<CategoryEntry>
  currency: string
  total: number
  className?: string
  onCategoryClick?: (categoryKey: string) => void
}

function formatCurrencyValue(value: number, currency: string) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

function CategoryTooltipContent({
  active,
  payload,
  currency,
  total,
  formatCurrency,
}: {
  active?: boolean
  payload?: Array<{ payload: CategoryEntry }>
  currency: string
  total: number
  formatCurrency: (value: number, currency: string) => string
}) {
  const { t } = useTranslation()
  if (!active || !payload?.length) return null
  const entry = payload[0].payload
  const percentage = total > 0 ? ((entry.value / total) * 100).toFixed(1) : '0'

  return (
    <div className="grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="flex items-center gap-2">
        <div
          className="size-2.5 shrink-0 rounded-[2px]"
          style={{ backgroundColor: entry.color }}
        />
        <span className="font-medium">{entry.label}</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-muted-foreground">{t('charts.amount')}</span>
        <span className="font-mono font-medium tabular-nums">
          {formatCurrency(entry.value, currency)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-muted-foreground">{t('charts.share')}</span>
        <span className="font-mono font-medium tabular-nums">
          {percentage}%
        </span>
      </div>
    </div>
  )
}

function CategoryDonutLabel({ cx, cy }: { cx?: number; cy?: number }) {
  const { t } = useTranslation()
  return (
    <tspan x={cx} y={(cy ?? 0) + 20} className="fill-muted-foreground text-xs">
      {t('charts.expenses')}
    </tspan>
  )
}

export function CategoryPieChart({
  data,
  currency,
  total,
  className,
  onCategoryClick,
}: CategoryPieChartProps) {
  const { t } = useTranslation()
  const { isPrivate } = usePrivacy()

  const formatCurrency = React.useCallback(
    (value: number, cur: string) =>
      isPrivate ? '••••••' : formatCurrencyValue(value, cur),
    [isPrivate],
  )

  const chartConfig = React.useMemo(() => {
    const config: ChartConfig = {}
    for (const entry of data) {
      config[entry.key] = { label: entry.label, color: entry.color }
    }
    return config
  }, [data])

  const formattedTotal = formatCurrency(total, currency)

  if (data.length === 0) {
    return (
      <Card className={cn(className)}>
        <CardHeader>
          <CardTitle>{t('charts.expensesByCategory')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
            {t('charts.noExpenseData')}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle>{t('charts.expensesByCategory')}</CardTitle>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        <div className="flex flex-col items-center gap-4">
          <ChartContainer
            config={chartConfig}
            className="aspect-square h-[200px] shrink-0"
          >
            <PieChart>
              <ChartTooltip
                content={
                  <CategoryTooltipContent
                    currency={currency}
                    total={total}
                    formatCurrency={formatCurrency}
                  />
                }
              />
              <Pie
                data={data}
                dataKey="value"
                nameKey="label"
                isAnimationActive={false}
                innerRadius={60}
                outerRadius={85}
                strokeWidth={2}
                stroke="var(--color-background)"
              >
                {data.map((entry) => (
                  <Cell key={entry.key} fill={entry.color} />
                ))}
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                      return (
                        <text
                          x={viewBox.cx}
                          y={viewBox.cy}
                          textAnchor="middle"
                          dominantBaseline="middle"
                        >
                          <tspan
                            x={viewBox.cx}
                            y={viewBox.cy}
                            className="fill-foreground text-lg font-bold"
                          >
                            {formattedTotal}
                          </tspan>
                          <CategoryDonutLabel cx={viewBox.cx} cy={viewBox.cy} />
                        </text>
                      )
                    }
                  }}
                />
              </Pie>
            </PieChart>
          </ChartContainer>
          <div className="grid w-full gap-2 text-sm">
            {data.map((entry) => {
              const percentage =
                total > 0 ? ((entry.value / total) * 100).toFixed(1) : '0'
              return onCategoryClick ? (
                <button
                  key={entry.key}
                  type="button"
                  className="flex w-full cursor-pointer items-center gap-3"
                  onClick={() => onCategoryClick(entry.key)}
                >
                  <div
                    className="size-3 shrink-0 rounded-sm"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="flex-1 text-left font-medium hover:underline">
                    {entry.label}
                  </span>
                  <span className="font-mono tabular-nums text-muted-foreground">
                    {percentage}%
                  </span>
                  <span className="font-mono font-medium tabular-nums">
                    {formatCurrency(entry.value, currency)}
                  </span>
                </button>
              ) : (
                <div key={entry.key} className="flex items-center gap-3">
                  <div
                    className="size-3 shrink-0 rounded-sm"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="flex-1 font-medium">{entry.label}</span>
                  <span className="font-mono tabular-nums text-muted-foreground">
                    {percentage}%
                  </span>
                  <span className="font-mono font-medium tabular-nums">
                    {formatCurrency(entry.value, currency)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
