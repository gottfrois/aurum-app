import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import type { ChartConfig } from '~/components/ui/chart'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '~/components/ui/chart'
import { Skeleton } from '~/components/ui/skeleton'
import { usePrivacy } from '~/contexts/privacy-context'
import type { YearOverYearEntry } from '~/lib/financial-analytics'

interface YearOverYearChartProps {
  data: Array<YearOverYearEntry>
  currency: string
  isLoading: boolean
}

const MONTH_LABELS = [
  '',
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

const YEAR_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
]

const currencyFormatter = (currency: string) => (value: number) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)

export function YearOverYearChart({
  data,
  currency,
  isLoading,
}: YearOverYearChartProps) {
  const { t } = useTranslation()
  const { isPrivate } = usePrivacy()

  const formatCurrency = React.useMemo(
    () => (isPrivate ? () => '••••••' : currencyFormatter(currency)),
    [currency, isPrivate],
  )

  // Extract all years from data
  const { years, chartData, chartConfig } = React.useMemo(() => {
    const yearSet = new Set<number>()
    for (const entry of data) {
      for (const year of Object.keys(entry.years)) {
        yearSet.add(Number(year))
      }
    }
    const sortedYears = [...yearSet].sort()

    const config: ChartConfig = {}
    for (let i = 0; i < sortedYears.length; i++) {
      const year = sortedYears[i]
      config[String(year)] = {
        label: String(year),
        color: YEAR_COLORS[i % YEAR_COLORS.length],
      }
    }

    const flatData = data.map((entry) => {
      const row: Record<string, string | number> = {
        month: MONTH_LABELS[entry.month] ?? String(entry.month),
      }
      for (const year of sortedYears) {
        row[String(year)] = entry.years[year] ?? 0
      }
      return row
    })

    return { years: sortedYears, chartData: flatData, chartConfig: config }
  }, [data])

  return (
    <Card className="@container/card flex h-full flex-col">
      <CardHeader>
        <CardTitle>{t('insights.yearOverYear')}</CardTitle>
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
            <LineChart data={chartData}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
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
                  <ChartTooltipContent
                    formatter={(value, name) => (
                      <>
                        <div
                          className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                          style={{
                            backgroundColor: `var(--color-${name})`,
                          }}
                        />
                        <div className="flex flex-1 items-center justify-between gap-4 leading-none">
                          <span className="text-muted-foreground">{name}</span>
                          <span className="font-mono font-medium text-foreground tabular-nums">
                            {formatCurrency(value as number)}
                          </span>
                        </div>
                      </>
                    )}
                    indicator="dot"
                  />
                }
              />
              {years.map((year, i) => (
                <Line
                  key={year}
                  type="monotone"
                  dataKey={String(year)}
                  stroke={YEAR_COLORS[i % YEAR_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
