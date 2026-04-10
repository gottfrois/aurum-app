import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Money } from '~/components/ui/money'
import { ScrollArea } from '~/components/ui/scroll-area'
import { Skeleton } from '~/components/ui/skeleton'
import type { CategoryInfo } from '~/lib/categories'
import type { RecurringExpense } from '~/lib/financial-analytics'

interface RecurringExpensesCardProps {
  items: Array<RecurringExpense>
  categories: Array<CategoryInfo>
  currency: string
  isLoading: boolean
  title?: string
  onItemClick?: (payee: string) => void
}

export function RecurringExpensesCard({
  items,
  categories,
  currency,
  isLoading,
  title,
  onItemClick,
}: RecurringExpensesCardProps) {
  const { t } = useTranslation()

  const categoryMap = React.useMemo(
    () => new Map(categories.map((c) => [c.key, c])),
    [categories],
  )

  const total = React.useMemo(
    () => items.reduce((sum, item) => sum + item.monthlyAmount, 0),
    [items],
  )

  return (
    <Card className="@container/card flex h-full min-h-0 flex-col overflow-hidden">
      <CardHeader>
        <CardTitle>{title ?? t('insights.recurringExpenses')}</CardTitle>
        <span className="text-sm font-medium text-muted-foreground">
          <Money value={total} currency={currency} maximumFractionDigits={0} />
          {t('insights.perMonth')}
        </span>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        {isLoading ? (
          <Skeleton className="h-full min-h-[200px] w-full" />
        ) : items.length === 0 ? (
          <div className="flex h-full min-h-[200px] items-center justify-center text-sm text-muted-foreground">
            {t('insights.noRecurring')}
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="space-y-1">
              {items.map((item) => {
                const catInfo = categoryMap.get(item.categoryKey)
                const Wrapper = onItemClick ? 'button' : 'div'
                return (
                  <Wrapper
                    key={item.payee}
                    {...(onItemClick
                      ? {
                          type: 'button' as const,
                          onClick: () => onItemClick(item.payee),
                        }
                      : {})}
                    className={`flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-muted/50 ${onItemClick ? 'cursor-pointer' : ''}`}
                  >
                    {catInfo && (
                      <div
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: catInfo.color }}
                      />
                    )}
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium">
                        {item.payee}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {catInfo?.label ?? item.categoryKey}
                        {' · '}
                        {t('insights.monthsDetected', {
                          count: item.frequency,
                        })}
                      </span>
                    </div>
                    <Money
                      value={item.monthlyAmount}
                      currency={currency}
                      maximumFractionDigits={0}
                      className="shrink-0 font-mono text-sm font-medium tabular-nums"
                    />
                  </Wrapper>
                )
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
