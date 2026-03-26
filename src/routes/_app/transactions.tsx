import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { ArrowLeftRight } from 'lucide-react'
import * as React from 'react'
import type { CashFlowData } from '~/components/cash-flow-chart'
import { CashFlowChart } from '~/components/cash-flow-chart'
import { CategoryPieChart } from '~/components/category-pie-chart'
import { useAIFilterListener } from '~/components/command-palette'
import { ActiveFilters, FilterActions } from '~/components/filters/filter-bar'
import { PeriodNavigator } from '~/components/period-navigator'
import { SankeyChart } from '~/components/sankey-chart'
import { SiteHeader } from '~/components/site-header'
import type { TransactionRow } from '~/components/transactions-list'
import { TransactionsList } from '~/components/transactions-list'
import { Card, CardContent, CardHeader } from '~/components/ui/card'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '~/components/ui/empty'
import { Skeleton } from '~/components/ui/skeleton'
import { useCommandDispatch } from '~/contexts/command-context'
import { usePortfolio } from '~/contexts/portfolio-context'
import { useCachedDecryptRecords } from '~/hooks/use-cached-decrypt'
import { useCommand } from '~/hooks/use-command'
import { useDateRange } from '~/hooks/use-date-range'
import { useFilters } from '~/hooks/use-filters'
import { resolveTransactionCategoryKey, useCategories } from '~/lib/categories'
import { deserializeFilters, serializeFilters } from '~/lib/filters/serialize'
import { createTransactionFilterConfig } from '~/lib/filters/transactions'
import type {
  EnumOption,
  FilterCondition,
  FilterConfig,
} from '~/lib/filters/types'
import { api } from '../../../convex/_generated/api'

type DecryptedBankAccount = NonNullable<
  NonNullable<ReturnType<typeof useQuery<typeof api.powens.listBankAccounts>>>
>[number] & {
  name?: string
  number?: string
  iban?: string
  balance?: number
  connectorName?: string
}

interface TransactionRecord {
  _id: string
  bankAccountId: string
  date: string
  rdate?: string
  vdate?: string
  wording: string
  originalWording?: string
  simplifiedWording?: string
  category?: string
  categoryParent?: string
  userCategoryKey?: string
  labelIds?: Array<string>
  excludedFromBudget?: boolean
  value: number
  originalValue?: number
  originalCurrency?: string
  type?: string
  coming: boolean
  counterparty?: string
  card?: string
  comment?: string
  customDescription?: string
  encryptedData?: string
}

const STORAGE_KEY = 'bunkr:filters:transactions'

export const Route = createFileRoute('/_app/transactions')({
  component: TransactionsPage,
  ssr: false,
})

function TransactionsPage() {
  return (
    <>
      <SiteHeader />
      <div className="flex flex-1 flex-col">
        <TransactionsContent />
      </div>
    </>
  )
}

function TransactionsContent() {
  const {
    isLoading: portfolioLoading,
    isAllPortfolios,
    isTeamView,
    allPortfolioIds,
    singlePortfolioId,
    portfolios,
  } = usePortfolio()

  const workspaceId = portfolios?.[0]?.workspaceId ?? null

  const {
    start,
    end,
    range,
    activePeriod,
    canGoNext,
    selectPeriod,
    setCustomRange,
    goPrev,
    goNext,
  } = useDateRange()
  const { categories, getCategory } = useCategories()

  const transactionsSingle = useQuery(
    api.transactions.listTransactionsByPortfolio,
    singlePortfolioId
      ? {
          portfolioId: singlePortfolioId,
          startDate: range.start,
          endDate: range.end,
        }
      : 'skip',
  )
  const transactionsAll = useQuery(
    api.transactions.listAllTransactionsByPortfolios,
    isAllPortfolios && allPortfolioIds.length > 0
      ? {
          portfolioIds: allPortfolioIds,
          startDate: range.start,
          endDate: range.end,
        }
      : 'skip',
  )
  const transactionsTeam = useQuery(
    api.team.listTeamTransactions,
    isTeamView && workspaceId
      ? {
          workspaceId,
          startDate: range.start,
          endDate: range.end,
        }
      : 'skip',
  )
  const rawTransactions = isTeamView
    ? transactionsTeam
    : isAllPortfolios
      ? transactionsAll
      : transactionsSingle
  const transactions = useCachedDecryptRecords(
    'transactions',
    rawTransactions as Array<TransactionRecord> | undefined,
  )

  const bankAccountsSingle = useQuery(
    api.powens.listBankAccounts,
    singlePortfolioId ? { portfolioId: singlePortfolioId } : 'skip',
  )
  const bankAccountsAll = useQuery(
    api.powens.listAllBankAccounts,
    isAllPortfolios && allPortfolioIds.length > 0
      ? { portfolioIds: allPortfolioIds }
      : 'skip',
  )
  const bankAccountsTeam = useQuery(
    api.team.listTeamBankAccounts,
    isTeamView && workspaceId ? { workspaceId } : 'skip',
  )
  const rawBankAccounts = isTeamView
    ? bankAccountsTeam
    : isAllPortfolios
      ? bankAccountsAll
      : bankAccountsSingle
  const bankAccounts = useCachedDecryptRecords(
    'bankAccounts',
    rawBankAccounts,
  ) as DecryptedBankAccount[] | undefined

  const labelsData = useQuery(
    api.transactionLabels.listLabels,
    workspaceId ? { workspaceId } : 'skip',
  )
  const labels = labelsData ?? []

  const accountNameMap = React.useMemo(() => {
    const map = new Map<string, string>()
    if (!bankAccounts) return map
    for (const ba of bankAccounts) {
      const label = ba.connectorName
        ? `${ba.connectorName} – ${ba.name ?? ''}`
        : (ba.name ?? '')
      map.set(ba._id, label)
    }
    return map
  }, [bankAccounts])

  const accountNumberMap = React.useMemo(() => {
    const map = new Map<string, string>()
    if (!bankAccounts) return map
    for (const ba of bankAccounts) {
      const num = ba.iban ?? ba.number
      if (num) map.set(ba._id, num)
    }
    return map
  }, [bankAccounts])

  const accountOptions = React.useMemo<Array<EnumOption>>(() => {
    if (!bankAccounts) return []
    return bankAccounts
      .filter((ba) => !ba.disabled && !ba.deleted)
      .map((ba) => ({
        value: ba._id,
        label: accountNameMap.get(ba._id) ?? ba.name ?? '',
      }))
  }, [bankAccounts, accountNameMap])

  const categoryOptions = React.useMemo<Array<EnumOption>>(
    () =>
      categories.map((c) => ({
        value: c.key,
        label: c.label,
        color: c.color,
      })),
    [categories],
  )

  const labelOptions = React.useMemo<Array<EnumOption>>(
    () =>
      labels.map((l) => ({
        value: l._id,
        label: l.name,
        color: l.color,
      })),
    [labels],
  )

  const transactionTypeOptions = React.useMemo<Array<EnumOption>>(() => {
    if (!transactions) return []
    const types = new Set(
      transactions.map((t) => t.type).filter(Boolean) as Array<string>,
    )
    return [...types].sort().map((t) => ({ value: t, label: t }))
  }, [transactions])

  const transactionConfig = React.useMemo(
    () =>
      createTransactionFilterConfig({
        accountOptions,
        categoryOptions,
        labelOptions,
        transactionTypeOptions,
      }),
    [accountOptions, categoryOptions, labelOptions, transactionTypeOptions],
  )

  const initialConditions = React.useMemo(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? deserializeFilters(stored) : []
    } catch {
      return []
    }
  }, [])

  const handleConditionsChange = React.useCallback(
    (next: Array<FilterCondition>) => {
      try {
        if (next.length > 0) {
          localStorage.setItem(STORAGE_KEY, serializeFilters(next))
        } else {
          localStorage.removeItem(STORAGE_KEY)
        }
      } catch {
        // Storage full or unavailable
      }
    },
    [],
  )

  const {
    conditions,
    filteredData: filteredTransactions,
    addCondition,
    updateCondition,
    removeCondition,
    clearAll,
    loadConditions,
    hasActiveFilters,
  } = useFilters<string, TransactionRecord>(
    transactions,
    transactionConfig as FilterConfig<string>,
    { initialConditions, onConditionsChange: handleConditionsChange },
  )

  useAIFilterListener(loadConditions)

  const { setPaletteState } = useCommandDispatch()
  useCommand('ai.filter', {
    handler: () => setPaletteState({ open: true, aiMode: true }),
  })

  const currency = 'EUR'

  const cashFlowData = React.useMemo<Array<CashFlowData>>(() => {
    if (!filteredTransactions) return []
    const monthMap = new Map<string, { income: number; expenses: number }>()
    for (const t of filteredTransactions) {
      if (t.excludedFromBudget) continue
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
        month: new Date(`${month}-01`).toLocaleDateString('fr-FR', {
          month: 'short',
          year: '2-digit',
        }),
        income: Math.round(data.income * 100) / 100,
        expenses: Math.round(data.expenses * 100) / 100,
      }))
  }, [filteredTransactions])

  const { categoryData, totalExpenses } = React.useMemo(() => {
    if (!filteredTransactions) return { categoryData: [], totalExpenses: 0 }
    const categoryTotals = new Map<string, number>()
    let expenseSum = 0
    for (const t of filteredTransactions) {
      if (t.excludedFromBudget) continue
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
  }, [filteredTransactions, getCategory])

  const sankeyData = React.useMemo(() => {
    if (!filteredTransactions) return { nodes: [], links: [] }

    let totalIncome = 0
    const categoryExpenses = new Map<string, number>()

    for (const t of filteredTransactions) {
      if (t.excludedFromBudget) continue
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
            categoryKey: key,
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
  }, [filteredTransactions, getCategory])

  const tableData = React.useMemo<Array<TransactionRow>>(() => {
    if (!filteredTransactions) return []
    return filteredTransactions.map((t) => ({
      _id: t._id,
      bankAccountId: t.bankAccountId,
      date: t.date,
      rdate: t.rdate,
      vdate: t.vdate,
      wording: t.wording,
      originalWording: t.originalWording,
      simplifiedWording: t.simplifiedWording,
      category: t.category,
      categoryParent: t.categoryParent,
      userCategoryKey: t.userCategoryKey,
      labelIds: t.labelIds,
      excludedFromBudget: t.excludedFromBudget,
      value: t.value,
      originalValue: t.originalValue,
      originalCurrency: t.originalCurrency,
      type: t.type,
      coming: t.coming,
      counterparty: t.counterparty,
      card: t.card,
      comment: t.comment,
      customDescription: t.customDescription,
      accountName: accountNameMap.get(t.bankAccountId),
      accountNumber: accountNumberMap.get(t.bankAccountId),
    }))
  }, [filteredTransactions, accountNameMap, accountNumberMap])

  if (portfolioLoading || transactions === undefined) {
    return (
      <>
        <div className="flex flex-col border-b">
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 lg:px-6">
            <Skeleton className="h-8 w-72" />
            <Skeleton className="h-8 w-24" />
          </div>
        </div>
        <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
          <div className="grid gap-4 lg:grid-cols-3 md:gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-36" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-[250px] w-full" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Skeleton className="h-4 w-28" />
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4">
                <Skeleton className="h-[200px] w-[200px] rounded-full" />
                <div className="w-full space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </div>
      </>
    )
  }

  if (transactions.length === 0 && !hasActiveFilters) {
    return (
      <>
        <div className="flex flex-col border-b">
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 lg:px-6">
            <PeriodNavigator
              start={start}
              end={end}
              activePeriod={activePeriod}
              canGoNext={canGoNext}
              onSelectPeriod={selectPeriod}
              onCustomRange={setCustomRange}
              onPrev={goPrev}
              onNext={goNext}
            />
          </div>
        </div>
        <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
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
        </div>
      </>
    )
  }

  return (
    <>
      <div className="flex flex-col border-b">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 lg:px-6">
          <PeriodNavigator
            start={start}
            end={end}
            activePeriod={activePeriod}
            canGoNext={canGoNext}
            onSelectPeriod={selectPeriod}
            onCustomRange={setCustomRange}
            onPrev={goPrev}
            onNext={goNext}
          />
          <FilterActions
            config={transactionConfig}
            conditions={conditions}
            onAdd={addCondition}
            onUpdate={updateCondition}
            onRemove={removeCondition}
            onLoadConditions={loadConditions}
            entityType="transactions"
          />
        </div>
      </div>

      {conditions.length > 0 && (
        <div className="border-b px-4 py-3 lg:px-6">
          <ActiveFilters
            config={transactionConfig}
            conditions={conditions}
            onAdd={addCondition}
            onUpdate={updateCondition}
            onRemove={removeCondition}
            onClearAll={clearAll}
            entityType="transactions"
          />
        </div>
      )}

      <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
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
            onCategoryClick={(categoryKey) => {
              addCondition({
                id: crypto.randomUUID(),
                field: 'category',
                operator: 'is_any_of',
                value: [categoryKey],
              })
            }}
          />
        </div>

        {sankeyData.nodes.length > 0 && (
          <SankeyChart
            nodes={sankeyData.nodes}
            links={sankeyData.links}
            currency={currency}
            onLabelClick={(categoryKey) => {
              addCondition({
                id: crypto.randomUUID(),
                field: 'category',
                operator: 'is_any_of',
                value: [categoryKey],
              })
            }}
          />
        )}

        <TransactionsList
          data={tableData}
          currency={currency}
          labels={labels}
          workspaceId={workspaceId ?? undefined}
        />
      </div>
    </>
  )
}
