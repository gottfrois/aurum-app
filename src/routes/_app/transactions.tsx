import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { ArrowLeftRight } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import type { CashFlowData } from '~/components/cash-flow-chart'
import type { TransactionRow } from '~/components/transactions-list'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '~/components/ui/empty'
import { SiteHeader } from '~/components/site-header'
import { useProfile } from '~/contexts/profile-context'
import { Skeleton } from '~/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { CashFlowChart } from '~/components/cash-flow-chart'
import { CategoryPieChart } from '~/components/category-pie-chart'
import { SankeyChart } from '~/components/sankey-chart'
import { TransactionsList } from '~/components/transactions-list'
import { useCachedDecryptRecords } from '~/hooks/use-cached-decrypt'
import {
  TransactionPeriodSelector,
  useTransactionPeriod,
} from '~/components/transaction-period-selector'
import { resolveTransactionCategoryKey, useCategories } from '~/lib/categories'

interface TransactionRecord {
  _id: string
  date: string
  wording: string
  category?: string
  categoryParent?: string
  userCategoryKey?: string
  value: number
  type?: string
  coming: boolean
  encryptedData?: string
}

export const Route = createFileRoute('/_app/transactions')({
  component: TransactionsPage,
  ssr: false,
})

function TransactionsPage() {
  return (
    <>
      <SiteHeader />
      <div className="flex flex-1 flex-col">
        <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
          <TransactionsContent />
        </div>
      </div>
    </>
  )
}

function TransactionsContent() {
  const {
    isLoading: profileLoading,
    isAllProfiles,
    allProfileIds,
    singleProfileId,
  } = useProfile()

  const period = useTransactionPeriod()
  const { getCategory } = useCategories()

  const transactionsSingle = useQuery(
    api.transactions.listTransactionsByProfile,
    singleProfileId
      ? {
          profileId: singleProfileId,
          startDate: period.range.start,
          endDate: period.range.end,
        }
      : 'skip',
  )
  const transactionsAll = useQuery(
    api.transactions.listAllTransactionsByProfiles,
    isAllProfiles && allProfileIds.length > 0
      ? {
          profileIds: allProfileIds,
          startDate: period.range.start,
          endDate: period.range.end,
        }
      : 'skip',
  )
  const rawTransactions = isAllProfiles ? transactionsAll : transactionsSingle
  const transactions = useCachedDecryptRecords(
    'transactions',
    rawTransactions as Array<TransactionRecord> | undefined,
  )

  const currency = 'EUR'

  const cashFlowData = React.useMemo<Array<CashFlowData>>(() => {
    if (!transactions) return []
    const monthMap = new Map<string, { income: number; expenses: number }>()
    for (const t of transactions) {
      const month = t.date.slice(0, 7) // YYYY-MM
      const entry = monthMap.get(month) ?? { income: 0, expenses: 0 }
      if (t.value > 0) {
        entry.income += t.value
      } else {
        entry.expenses += Math.abs(t.value)
      }
      monthMap.set(month, entry)
    }
    return [...monthMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month: new Date(month + '-01').toLocaleDateString('fr-FR', {
          month: 'short',
          year: '2-digit',
        }),
        income: Math.round(data.income * 100) / 100,
        expenses: Math.round(data.expenses * 100) / 100,
      }))
  }, [transactions])

  const { categoryData, totalExpenses } = React.useMemo(() => {
    if (!transactions) return { categoryData: [], totalExpenses: 0 }
    const categoryTotals = new Map<string, number>()
    let expenseSum = 0
    for (const t of transactions) {
      if (t.value >= 0) continue
      const key = resolveTransactionCategoryKey(t)
      categoryTotals.set(
        key,
        (categoryTotals.get(key) ?? 0) + Math.abs(t.value),
      )
      expenseSum += Math.abs(t.value)
    }
    const data = [...categoryTotals.entries()]
      .sort(([, a], [, b]) => b - a)
      .map(([key, value]) => {
        const cat = getCategory(key)
        return {
          key,
          label: cat.label,
          value: Math.round(value * 100) / 100,
          color: cat.color,
        }
      })
    return {
      categoryData: data,
      totalExpenses: Math.round(expenseSum * 100) / 100,
    }
  }, [transactions, getCategory])

  const sankeyData = React.useMemo(() => {
    if (!transactions) return { nodes: [], links: [] }

    let totalIncome = 0
    const categoryExpenses = new Map<string, number>()

    for (const t of transactions) {
      if (t.value > 0) {
        totalIncome += t.value
      } else {
        const key = resolveTransactionCategoryKey(t)
        categoryExpenses.set(
          key,
          (categoryExpenses.get(key) ?? 0) + Math.abs(t.value),
        )
      }
    }

    if (totalIncome === 0 || categoryExpenses.size === 0) {
      return { nodes: [], links: [] }
    }

    const nodes = [
      { name: 'Income', color: 'hsl(142 71% 45%)' },
      ...[...categoryExpenses.entries()]
        .sort(([, a], [, b]) => b - a)
        .map(([key]) => {
          const cat = getCategory(key)
          return {
            name: cat.label,
            color: cat.color,
          }
        }),
    ]

    const sortedEntries = [...categoryExpenses.entries()].sort(
      ([, a], [, b]) => b - a,
    )

    const links = sortedEntries.map(([key, value], i) => {
      const cat = getCategory(key)
      return {
        source: 0,
        target: i + 1,
        value: Math.round(value * 100) / 100,
        stroke: cat.color,
      }
    })

    return { nodes, links }
  }, [transactions, getCategory])

  const tableData = React.useMemo<Array<TransactionRow>>(() => {
    if (!transactions) return []
    return transactions.map((t) => ({
      _id: t._id,
      date: t.date,
      wording: t.wording,
      category: t.category,
      categoryParent: t.categoryParent,
      userCategoryKey: t.userCategoryKey,
      value: t.value,
      type: t.type,
      coming: t.coming,
    }))
  }, [transactions])

  if (profileLoading || transactions === undefined) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-[250px] w-full" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-[300px] w-full" />
          <Skeleton className="h-[300px] w-full" />
        </div>
      </div>
    )
  }

  if (transactions.length === 0) {
    return (
      <>
        <TransactionPeriodSelector
          periodType={period.periodType}
          range={period.range}
          onPeriodTypeChange={period.onPeriodTypeChange}
          onNavigate={period.onNavigate}
          onCustomRangeChange={period.onCustomRangeChange}
          canGoNext={period.canGoNext}
        />
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ArrowLeftRight />
            </EmptyMedia>
            <EmptyTitle>No Transactions</EmptyTitle>
            <EmptyDescription>
              No transactions found for this period. Try selecting a different
              date range.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </>
    )
  }

  return (
    <>
      <TransactionPeriodSelector
        periodType={period.periodType}
        range={period.range}
        onPeriodTypeChange={period.onPeriodTypeChange}
        onNavigate={period.onNavigate}
        onCustomRangeChange={period.onCustomRangeChange}
        canGoNext={period.canGoNext}
      />

      <div className="grid gap-4 lg:grid-cols-3 md:gap-6">
        <div className="lg:col-span-2">
          <CashFlowChart
            data={cashFlowData}
            currency={currency}
            isLoading={false}
          />
        </div>
        <CategoryPieChart
          data={categoryData}
          currency={currency}
          total={totalExpenses}
        />
      </div>

      {sankeyData.nodes.length > 0 && (
        <SankeyChart
          nodes={sankeyData.nodes}
          links={sankeyData.links}
          currency={currency}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <TransactionsList data={tableData} currency={currency} />
        </CardContent>
      </Card>
    </>
  )
}
