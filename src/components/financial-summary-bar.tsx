import type { LucideIcon } from 'lucide-react'
import {
  ArrowDownIcon,
  ArrowDownLeft,
  ArrowUpIcon,
  ArrowUpRight,
  Percent,
  Wallet,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '~/components/reui/badge'
import { Card, CardContent } from '~/components/ui/card'
import { Separator } from '~/components/ui/separator'
import { usePrivacy } from '~/contexts/privacy-context'

function formatCurrencyValue(value: number, currency: string) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

function computeDeltaPercent(current: number, previous: number): number | null {
  if (previous === 0) return null
  return ((current - previous) / previous) * 100
}

interface SummaryStatCardProps {
  label: string
  value: string
  subtitle?: string
  icon: LucideIcon
  deltaPercent?: number | null
  previousLabel?: string
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
                radius="full"
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
  const { isPrivate } = usePrivacy()

  const fmt = (value: number) =>
    isPrivate ? '••••••' : formatCurrencyValue(value, currency)

  const fmtPercent = (value: number) =>
    isPrivate ? '••••••' : `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`

  const prevLabel = (prevValue: number) =>
    isPrivate ? undefined : t('summary.vsPrevious', { amount: fmt(prevValue) })

  const recurringSubtitle =
    recurringTotal > 0
      ? t('summary.recurringOf', { amount: fmt(recurringTotal) })
      : previous
        ? prevLabel(previous.totalExpenses)
        : undefined

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 md:gap-6">
      <SummaryStatCard
        label={t('summary.income')}
        value={fmt(totalIncome)}
        icon={ArrowDownLeft}
        deltaPercent={
          previous
            ? computeDeltaPercent(totalIncome, previous.totalIncome)
            : null
        }
        previousLabel={previous ? prevLabel(previous.totalIncome) : undefined}
      />
      <SummaryStatCard
        label={t('summary.expenses')}
        value={fmt(totalExpenses)}
        subtitle={recurringSubtitle}
        icon={ArrowUpRight}
        deltaPercent={
          previous
            ? computeDeltaPercent(totalExpenses, previous.totalExpenses)
            : null
        }
      />
      <SummaryStatCard
        label={t('summary.available')}
        value={fmt(delta)}
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
