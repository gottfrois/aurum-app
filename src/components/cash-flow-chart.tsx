import * as React from 'react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import type { ChartConfig } from '~/components/ui/chart'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '~/components/ui/chart'
import { Skeleton } from '~/components/ui/skeleton'
import { usePrivacy } from '~/contexts/privacy-context'

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

const currencyFormatter = (currency: string) => (value: number) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)

export function CashFlowChart({
  data,
  currency,
  isLoading,
}: CashFlowChartProps) {
  const { isPrivate } = usePrivacy()
  const formatCurrency = React.useMemo(
    () => (isPrivate ? () => '••••••' : currencyFormatter(currency)),
    [currency, isPrivate],
  )

  return (
    <Card className="@container/card flex h-full flex-col">
      <CardHeader>
        <CardTitle>Cash Flow</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 px-2 pt-4 sm:px-6 sm:pt-6">
        {isLoading ? (
          <Skeleton className="h-full min-h-[250px] w-full" />
        ) : data.length === 0 ? (
          <div className="flex h-full min-h-[250px] items-center justify-center text-sm text-muted-foreground">
            Not enough data to display a chart
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
                    formatter={(value) => formatCurrency(value as number)}
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
