import type { LucideIcon } from 'lucide-react'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  Percent,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import type * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '~/components/ui/badge'
import { Card, CardContent } from '~/components/ui/card'
import { Money } from '~/components/ui/money'
import { Separator } from '~/components/ui/separator'
import { useMoney } from '~/hooks/use-money'
import { MASKED } from '~/lib/money/constants'

function computeDeltaPercent(current: number, previous: number): number | null {
  if (previous === 0) return null
  return ((current - previous) / previous) * 100
}

interface SummaryStatCardProps {
  label: string
  value: React.ReactNode
  subtitle?: React.ReactNode
  icon: LucideIcon
  deltaPercent?: number | null
  previousLabel?: React.ReactNode
}

function SummaryStatCard({
  label,
  value,
  subtitle,
  icon: Icon,
  deltaPercent,
  previousLabel,
}: SummaryStatCardProps) {
  const hasDelta = deltaPercent != null && Number.isFinite(deltaPercent)
  const isPositive = hasDelta && deltaPercent > 0
  const isNegative = hasDelta && deltaPercent < 0

  return (
    <Card className="@container/card">
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-muted-foreground">{label}</h3>
        </div>
        <div className="space-y-2.5">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl font-semibold tabular-nums tracking-tight text-foreground @[200px]/card:text-3xl">
              {value}
            </span>
            {hasDelta && (
              <Badge
                variant={
                  isPositive
                    ? 'success-light'
                    : isNegative
                      ? 'destructive-light'
                      : 'outline'
                }
              >
                {isPositive ? (
                  <ArrowUpIcon />
                ) : isNegative ? (
                  <ArrowDownIcon />
                ) : null}
                {isPositive ? '+' : ''}
                {deltaPercent.toFixed(1)}%
              </Badge>
            )}
          </div>
          <Separator />
          <div className="text-xs text-muted-foreground">
            {subtitle ?? previousLabel ?? '\u00A0'}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface PreviousSummary {
  totalIncome: number
  totalExpenses: number
  delta: number
  savingsRate: number
  recurringTotal: number
}

export interface FinancialSummaryBarProps {
  totalIncome: number
  totalExpenses: number
  delta: number
  savingsRate: number
  recurringTotal: number
  previous?: PreviousSummary
  currency: string
}

export function FinancialSummaryBar({
  totalIncome,
  totalExpenses,
  delta,
  savingsRate,
  recurringTotal,
  previous,
  currency,
}: FinancialSummaryBarProps) {
  const { t } = useTranslation()
  const { format, isPrivate } = useMoney()

  const fmtMoney = (value: number) =>
    format(value, currency, { maximumFractionDigits: 0 })

  const fmtPercent = (value: number) =>
    isPrivate ? MASKED : `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`

  const prevLabel = (prevValue: number) =>
    isPrivate
      ? undefined
      : t('summary.vsPrevious', { amount: fmtMoney(prevValue) })

  const recurringSubtitle =
    recurringTotal > 0
      ? t('summary.recurringOf', { amount: fmtMoney(recurringTotal) })
      : previous
        ? prevLabel(previous.totalExpenses)
        : undefined

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 md:gap-6">
      <SummaryStatCard
        label={t('summary.income')}
        value={
          <Money
            value={totalIncome}
            currency={currency}
            maximumFractionDigits={0}
            animate
          />
        }
        icon={TrendingUp}
        deltaPercent={
          previous
            ? computeDeltaPercent(totalIncome, previous.totalIncome)
            : null
        }
        previousLabel={previous ? prevLabel(previous.totalIncome) : undefined}
      />
      <SummaryStatCard
        label={t('summary.expenses')}
        value={
          <Money
            value={totalExpenses}
            currency={currency}
            maximumFractionDigits={0}
            animate
          />
        }
        subtitle={recurringSubtitle}
        icon={TrendingDown}
        deltaPercent={
          previous
            ? computeDeltaPercent(totalExpenses, previous.totalExpenses)
            : null
        }
      />
      <SummaryStatCard
        label={t('summary.available')}
        value={
          <Money
            value={delta}
            currency={currency}
            maximumFractionDigits={0}
            animate
          />
        }
        icon={Wallet}
        deltaPercent={
          previous ? computeDeltaPercent(delta, previous.delta) : null
        }
        previousLabel={previous ? prevLabel(previous.delta) : undefined}
      />
      <SummaryStatCard
        label={t('summary.savingsRate')}
        value={fmtPercent(savingsRate)}
        icon={Percent}
        deltaPercent={
          previous
            ? computeDeltaPercent(savingsRate, previous.savingsRate)
            : null
        }
        previousLabel={
          previous
            ? isPrivate
              ? undefined
              : t('summary.vsPrevious', {
                  amount: fmtPercent(previous.savingsRate),
                })
            : undefined
        }
      />
    </div>
  )
}
