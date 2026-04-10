import { AlertTriangle } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '~/components/reui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Skeleton } from '~/components/ui/skeleton'
import { useMoney } from '~/hooks/use-money'
import type { CategoryInfo } from '~/lib/categories'
import type { SpendingAnomaly } from '~/lib/financial-analytics'

interface AnomalyHighlightsCardProps {
  anomalies: Array<SpendingAnomaly>
  categories: Array<CategoryInfo>
  currency: string
  isLoading: boolean
  onCategoryClick?: (categoryKey: string) => void
}

export function AnomalyHighlightsCard({
  anomalies,
  categories,
  currency,
  isLoading,
  onCategoryClick,
}: AnomalyHighlightsCardProps) {
  const { t } = useTranslation()
  const { format } = useMoney()

  const fmt = React.useCallback(
    (value: number) => format(value, currency, { maximumFractionDigits: 0 }),
    [format, currency],
  )

  const categoryMap = React.useMemo(
    () => new Map(categories.map((c) => [c.key, c])),
    [categories],
  )

  return (
    <Card className="@container/card flex h-full flex-col">
      <CardHeader className="flex-row items-center gap-2">
        <AlertTriangle className="size-4 text-warning" />
        <CardTitle>{t('insights.anomalies')}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        {isLoading ? (
          <Skeleton className="h-full min-h-[200px] w-full" />
        ) : anomalies.length === 0 ? (
          <div className="flex h-full min-h-[200px] items-center justify-center text-sm text-muted-foreground">
            {t('insights.noAnomalies')}
          </div>
        ) : (
          <div className="space-y-2">
            {anomalies.map((anomaly) => {
              const catInfo = categoryMap.get(anomaly.categoryKey)
              const label = catInfo?.label ?? anomaly.categoryKey
              const Wrapper = onCategoryClick ? 'button' : 'div'

              return (
                <Wrapper
                  key={anomaly.categoryKey}
                  {...(onCategoryClick
                    ? {
                        type: 'button' as const,
                        onClick: () => onCategoryClick(anomaly.categoryKey),
                      }
                    : {})}
                  className={`flex w-full items-start gap-3 rounded-lg border border-warning/20 bg-warning/5 p-3 text-left ${
                    onCategoryClick ? 'cursor-pointer hover:bg-warning/10' : ''
                  }`}
                >
                  {catInfo && (
                    <div
                      className="mt-0.5 size-3 shrink-0 rounded-sm"
                      style={{ backgroundColor: catInfo.color }}
                    />
                  )}
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{label}</span>
                      <Badge variant="warning-light" size="sm" radius="full">
                        {anomaly.ratio.toFixed(1)}x
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('insights.anomalyDescription', {
                        current: fmt(anomaly.currentMonthSpend),
                        average: fmt(anomaly.averageSpend),
                      })}
                    </p>
                  </div>
                </Wrapper>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
