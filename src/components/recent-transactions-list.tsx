import type { ColumnDef } from '@tanstack/react-table'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { DataTable } from '~/components/data-table'
import { Button } from '~/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import { Skeleton } from '~/components/ui/skeleton'
import { usePrivacy } from '~/contexts/privacy-context'
import { cn } from '~/lib/utils'

const SKELETON_KEYS = ['s1', 's2', 's3', 's4', 's5'] as const

export interface RecentTransactionEntry {
  _id: string
  date: string
  description: string
  value: number
  categoryLabel: string
  categoryColor: string
}

interface RecentTransactionsListProps {
  transactions: Array<RecentTransactionEntry> | undefined
  currency: string
  limit?: number
  viewAllHref?: string
}

function formatCurrencyValue(value: number, currency: string) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function RecentTransactionsList({
  transactions,
  currency,
  limit = 15,
  viewAllHref = '/cash-flow',
}: RecentTransactionsListProps) {
  const { t } = useTranslation()
  const { isPrivate } = usePrivacy()

  const recent = React.useMemo(() => {
    if (!transactions) return undefined
    return transactions.slice(0, limit)
  }, [transactions, limit])

  const fmt = React.useCallback(
    (value: number) =>
      isPrivate ? '••••••' : formatCurrencyValue(value, currency),
    [isPrivate, currency],
  )

  const columns = React.useMemo<Array<ColumnDef<RecentTransactionEntry>>>(
    () => [
      {
        accessorKey: 'date',
        header: 'Date',
        cell: ({ getValue }) => formatDate(getValue<string>()),
      },
      {
        accessorKey: 'description',
        header: t('transactions.headerDescription'),
        cell: ({ row }) => (
          <div className="flex max-w-[150px] items-center gap-2 sm:max-w-[200px] md:max-w-[300px] lg:max-w-[400px]">
            <span className="truncate">{row.original.description}</span>
          </div>
        ),
      },
      {
        accessorKey: 'categoryLabel',
        header: t('transactions.headerCategory'),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <div
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: row.original.categoryColor }}
            />
            <span>{row.original.categoryLabel}</span>
          </div>
        ),
      },
      {
        accessorKey: 'value',
        header: t('transactions.headerAmount'),
        cell: ({ getValue }) => {
          const value = getValue<number>()
          return (
            <span
              className={cn(
                'font-mono font-medium tabular-nums',
                value > 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400',
              )}
            >
              {value > 0 ? '+' : ''}
              {fmt(value)}
            </span>
          )
        },
      },
    ],
    [t, fmt],
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('dashboard.recentTransactions')}</CardTitle>
        <CardAction>
          <Button variant="link" size="sm" asChild>
            <a href={viewAllHref}>{t('dashboard.viewAll')}</a>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {recent === undefined ? (
          <div className="space-y-3">
            {SKELETON_KEYS.map((key) => (
              <Skeleton key={key} className="h-10 w-full" />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <div className="flex h-[100px] items-center justify-center text-sm text-muted-foreground">
            {t('dashboard.noRecentTransactions')}
          </div>
        ) : (
          <DataTable columns={columns} data={recent} />
        )}
      </CardContent>
    </Card>
  )
}
