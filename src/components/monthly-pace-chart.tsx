import * as React from 'react'
import { useTranslation } from 'react-i18next'
import type { TooltipProps } from 'recharts'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from 'recharts'
import { Badge } from '~/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import type { ChartConfig } from '~/components/ui/chart'
import { ChartContainer, ChartTooltip } from '~/components/ui/chart'
import { Skeleton } from '~/components/ui/skeleton'
import { useMoney } from '~/hooks/use-money'
import type { DailyPaceEntry } from '~/lib/financial-analytics'

export interface MonthlyPaceChartProps {
  data: Array<DailyPaceEntry>
  currentTotal: number
  projectedTotal: number
  previousTotal: number
  dailyRate: number
  currency: string
  isLoading: boolean
  spentHref?: string
}

const chartConfig = {
  actual: {
    label: 'This month',
    color: 'var(--chart-1)',
  },
  projected: {
    label: 'Projected',
    color: 'var(--chart-1)',
  },
  previousMonth: {
    label: 'Last month',
    color: 'var(--muted-foreground)',
  },
} satisfies ChartConfig

function PaceTooltipContent({
  active,
  payload,
  label,
  formatCurrency,
}: TooltipProps<number, string> & {
  formatCurrency: (value: number) => string
}) {
  const { t } = useTranslation()
  if (!active || !payload?.length) return null

  const entries = payload.filter((e) => e.value != null)

  return (
    <div className="grid min-w-32 items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium">
        {t('insights.dayLabel', { day: label })}
      </div>
      <div className="grid gap-1">
        {entries.map((entry) => {
          const isProjected = entry.dataKey === 'projected'
          const isPrevious = entry.dataKey === 'previousMonth'
          return (
            <div key={entry.dataKey} className="flex items-center gap-2">
              <div
                className="size-2.5 shrink-0 rounded-[2px]"
                style={{
                  backgroundColor: entry.color,
                  opacity: isProjected || isPrevious ? 0.5 : 1,
                }}
              />
              <div className="flex flex-1 items-center justify-between gap-4">
                <span className="text-muted-foreground">
                  {chartConfig[entry.dataKey as keyof typeof chartConfig]
                    ?.label ?? entry.dataKey}
                </span>
                <span className="font-mono font-medium tabular-nums">
                  {formatCurrency(entry.value ?? 0)}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function MonthlyPaceChart({
  data,
  currentTotal,
  projectedTotal,
  previousTotal,
  dailyRate,
  currency,
  isLoading,
  spentHref,
}: MonthlyPaceChartProps) {
  const { t } = useTranslation()
  const { format } = useMoney()

  const formatCurrency = React.useCallback(
    (value: number) => format(value, currency, { maximumFractionDigits: 0 }),
    [format, currency],
  )

  const deltaPercent = React.useMemo(() => {
    if (previousTotal === 0) return null
    return ((projectedTotal - previousTotal) / previousTotal) * 100
  }, [projectedTotal, previousTotal])

  return (
    <Card className="@container/card flex h-full flex-col">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>{t('insights.monthlyPace')}</CardTitle>
          {deltaPercent != null && Number.isFinite(deltaPercent) && (
            <Badge
              variant={
                deltaPercent > 5
                  ? 'destructive-light'
                  : deltaPercent < -5
                    ? 'success-light'
                    : 'outline'
              }
            >
              {deltaPercent > 0 ? '+' : ''}
              {deltaPercent.toFixed(0)}% {t('insights.vsLastMonth')}
            </Badge>
          )}
        </div>
        <CardDescription className="flex items-center gap-4">
          {spentHref ? (
            <a href={spentHref} className="underline-offset-4 hover:underline">
              {t('insights.spent')} {formatCurrency(currentTotal)}
            </a>
          ) : (
            <span>
              {t('insights.spent')} {formatCurrency(currentTotal)}
            </span>
          )}
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">
            {t('insights.projectedTo')} {formatCurrency(projectedTotal)}
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">
            {formatCurrency(dailyRate)}/{t('insights.day')}
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 px-2 pt-4 sm:px-6 sm:pt-6">
        {isLoading ? (
          <Skeleton className="h-full min-h-[300px] w-full" />
        ) : data.length === 0 ? (
          <div className="flex h-full min-h-[300px] items-center justify-center text-sm text-muted-foreground">
            {t('charts.notEnoughData')}
          </div>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-full min-h-[300px] w-full"
          >
            <ComposedChart data={data}>
              <defs>
                <linearGradient id="fill-actual" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-actual)"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-actual)"
                    stopOpacity={0.05}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="day"
                type="number"
                domain={[1, 'dataMax']}
                ticks={Array.from({ length: data.length }, (_, i) => i + 1)}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={16}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={formatCurrency}
                width={80}
              />
              <ChartTooltip
                content={<PaceTooltipContent formatCurrency={formatCurrency} />}
              />
              {/* Actual spending - solid area */}
              <Area
                dataKey="actual"
                type="monotone"
                stroke="var(--color-actual)"
                fill="url(#fill-actual)"
                strokeWidth={2.5}
                connectNulls
              />
              {/* Previous month - rendered on top of area */}
              <Line
                dataKey="previousMonth"
                type="monotone"
                stroke="var(--color-previousMonth)"
                strokeWidth={1.5}
                strokeOpacity={0.6}
                dot={false}
                connectNulls
              />
              {/* Projected - dashed line */}
              <Line
                dataKey="projected"
                type="monotone"
                stroke="var(--color-projected)"
                strokeWidth={2}
                strokeDasharray="6 4"
                strokeOpacity={0.5}
                dot={false}
                connectNulls
              />
            </ComposedChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
