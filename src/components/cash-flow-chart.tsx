import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import type { ChartConfig } from '~/components/ui/chart'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '~/components/ui/chart'
import { Skeleton } from '~/components/ui/skeleton'
import { useMoney } from '~/hooks/use-money'

// chartConfig labels are resolved dynamically via i18n
const chartConfig = {
  income: {
    label: 'Income',
    color: 'hsl(142 71% 45%)',
  },
  expenses: {
    label: 'Expenses',
    color: 'hsl(0 84% 60%)',
  },
} satisfies ChartConfig

export interface CashFlowData {
  month: string
  income: number
  expenses: number
}

interface CashFlowChartProps {
  data: Array<CashFlowData>
  currency: string
  isLoading: boolean
}

export function CashFlowChart({
  data,
  currency,
  isLoading,
}: CashFlowChartProps) {
  const { t } = useTranslation()
  const { format } = useMoney()
  const formatCurrency = React.useCallback(
    (value: number) => format(value, currency, { maximumFractionDigits: 0 }),
    [format, currency],
  )

  return (
    <Card className="@container/card flex h-full flex-col">
      <CardHeader>
        <CardTitle>{t('charts.cashFlow')}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 px-2 pt-4 sm:px-6 sm:pt-6">
        {isLoading ? (
          <Skeleton className="h-full min-h-[250px] w-full" />
        ) : data.length === 0 ? (
          <div className="flex h-full min-h-[250px] items-center justify-center text-sm text-muted-foreground">
            {t('charts.notEnoughData')}
          </div>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-full min-h-[250px] w-full"
          >
            <BarChart data={data}>
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
                    formatter={(value, name, item) => (
                      <>
                        <div
                          className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                          style={{
                            backgroundColor: item.payload.fill || item.color,
                          }}
                        />
                        <div className="flex flex-1 items-center justify-between gap-4 leading-none">
                          <span className="text-muted-foreground">
                            {chartConfig[name as keyof typeof chartConfig]
                              ?.label ?? name}
                          </span>
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
              <Bar
                dataKey="income"
                fill="var(--color-income)"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="expenses"
                fill="var(--color-expenses)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
