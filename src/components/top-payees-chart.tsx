import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import type { ChartConfig } from '~/components/ui/chart'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '~/components/ui/chart'
import { Skeleton } from '~/components/ui/skeleton'
import { usePrivacy } from '~/contexts/privacy-context'
import type { CategoryInfo } from '~/lib/categories'
import type { TopPayee } from '~/lib/financial-analytics'

interface TopPayeesChartProps {
  data: Array<TopPayee>
  categories: Array<CategoryInfo>
  currency: string
  isLoading: boolean
}

const currencyFormatter = (currency: string) => (value: number) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)

export function TopPayeesChart({
  data,
  categories,
  currency,
  isLoading,
}: TopPayeesChartProps) {
  const { t } = useTranslation()
  const { isPrivate } = usePrivacy()

  const formatCurrency = React.useMemo(
    () => (isPrivate ? () => '••••••' : currencyFormatter(currency)),
    [currency, isPrivate],
  )

  const categoryMap = React.useMemo(
    () => new Map(categories.map((c) => [c.key, c])),
    [categories],
  )

  const chartConfig = React.useMemo(() => {
    const config: ChartConfig = {}
    for (const payee of data) {
      const catInfo = categoryMap.get(payee.categoryKey)
      config[payee.payee] = {
        label: payee.payee,
        color: catInfo?.color ?? 'var(--chart-1)',
      }
    }
    return config
  }, [data, categoryMap])

  return (
    <Card className="@container/card flex h-full flex-col">
      <CardHeader>
        <CardTitle>{t('insights.topPayees')}</CardTitle>
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
            <BarChart data={data} layout="vertical">
              <CartesianGrid horizontal={false} />
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                tickFormatter={formatCurrency}
              />
              <YAxis
                type="category"
                dataKey="payee"
                tickLine={false}
                axisLine={false}
                width={120}
                tick={{ fontSize: 12 }}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, _name, item) => {
                      const payee = item.payload as TopPayee
                      const catInfo = categoryMap.get(payee.categoryKey)
                      return (
                        <>
                          <div
                            className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                            style={{
                              backgroundColor:
                                catInfo?.color ?? 'var(--chart-1)',
                            }}
                          />
                          <div className="flex flex-1 flex-col gap-0.5 leading-none">
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-muted-foreground">
                                {t('charts.amount')}
                              </span>
                              <span className="font-mono font-medium text-foreground tabular-nums">
                                {formatCurrency(value as number)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-muted-foreground">
                                {t('insights.transactions')}
                              </span>
                              <span className="font-mono font-medium text-foreground tabular-nums">
                                {payee.transactionCount}
                              </span>
                            </div>
                          </div>
                        </>
                      )
                    }}
                    indicator="dot"
                  />
                }
              />
              <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                {data.map((payee) => {
                  const catInfo = categoryMap.get(payee.categoryKey)
                  return (
                    <Cell
                      key={payee.payee}
                      fill={catInfo?.color ?? 'var(--chart-1)'}
                    />
                  )
                })}
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
