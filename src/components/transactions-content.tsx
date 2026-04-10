import { useMutation, useQuery } from 'convex/react'
import { addDays, differenceInDays, format, parseISO } from 'date-fns'
import { ArrowLeftRight, Plus, Sparkles } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { CashFlowChart } from '~/components/cash-flow-chart'
import { CategoryBreakdownChart } from '~/components/category-breakdown-chart'
import {
  useAIFilterListener,
  useRegisterFilterFields,
} from '~/components/command-palette'
import { ConfirmDialog } from '~/components/confirm-dialog'
import { FinancialSummaryBar } from '~/components/financial-summary-bar'
import {
  ManualTransactionDialog,
  useManualTransactionDialog,
} from '~/components/manual-transaction-dialog'
import { FilterRow, PageToolbar, PeriodRow } from '~/components/page-toolbar'
import { RecurringExpensesCard } from '~/components/recurring-expenses-card'
import {
  createFilter,
  type Filter,
  type FilterOption,
} from '~/components/reui/filters'
import { SankeyChart } from '~/components/sankey-chart'
import type { TransactionRow } from '~/components/transactions-list'
import { TransactionsList } from '~/components/transactions-list'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader } from '~/components/ui/card'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '~/components/ui/empty'
import { Skeleton } from '~/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { useCommandDispatch } from '~/contexts/command-context'
import { usePortfolio } from '~/contexts/portfolio-context'
import { useCachedDecryptRecords } from '~/hooks/use-cached-decrypt'
import { useCommand } from '~/hooks/use-command'

import { useDateRange } from '~/hooks/use-date-range'
import { useFilterI18n } from '~/hooks/use-filter-i18n'
import { useFilters } from '~/hooks/use-filters'
import { useTransactions } from '~/hooks/use-transactions'
import {
  computeCashFlowData,
  computeCategoryBreakdown,
  computeSankeyData,
} from '~/lib/cash-flow'
import { useCategories } from '~/lib/categories'
import { createTransactionFilterFields } from '~/lib/filters/transactions'
import { toReUIFields, toSerializableFields } from '~/lib/filters/types'
import type { InsightTransaction } from '~/lib/financial-analytics'
import { detectRecurringExpenses } from '~/lib/financial-analytics'
import {
  computeFinancialSummary,
  type TransactionRecord,
} from '~/lib/financial-summary'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'

type DecryptedBankAccount = NonNullable<
  NonNullable<ReturnType<typeof useQuery<typeof api.powens.listBankAccounts>>>
>[number] & {
  name?: string
  number?: string
  iban?: string
  balance?: number
  connectorName?: string
  customName?: string
}

export type CashFlowTab = 'all' | 'expenses' | 'income'

export interface TransactionsContentProps {
  initialFilters?: Array<Filter>
  onFiltersChange?: (filters: Array<Filter>) => void
  onSaveView?: () => void
  tab?: CashFlowTab
  onTabChange?: (tab: CashFlowTab) => void
  /** Slot rendered in the active filters bar area */
  filtersSlot?: (props: {
    filters: Array<Filter>
    hasChanges: boolean
  }) => React.ReactNode
}

export function TransactionsContent({
  initialFilters: externalInitialFilters,
  onFiltersChange,
  onSaveView,
  tab = 'all',
  onTabChange,
  filtersSlot,
}: TransactionsContentProps) {
  const { t } = useTranslation()
  const filterI18n = useFilterI18n()
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

  const { transactions } = useTransactions({
    range,
    cacheKey: 'transactions',
  })

  // Previous period range for comparison
  const previousRange = React.useMemo(() => {
    const s = parseISO(range.start)
    const e = parseISO(range.end)
    const days = differenceInDays(e, s)
    const prevEnd = addDays(s, -1)
    const prevStart = addDays(prevEnd, -days)
    return {
      start: format(prevStart, 'yyyy-MM-dd'),
      end: format(prevEnd, 'yyyy-MM-dd'),
    }
  }, [range])

  const { transactions: previousTransactions } = useTransactions({
    range: previousRange,
    cacheKey: 'previousTransactions',
  })

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
    workspaceId
      ? {
          workspaceId,
          portfolioId: singlePortfolioId ?? undefined,
          includeAllPortfolios:
            isAllPortfolios || isTeamView ? true : undefined,
        }
      : 'skip',
  )
  const labels = labelsData ?? []

  const accountNameMap = React.useMemo(() => {
    const map = new Map<string, string>()
    if (!bankAccounts) return map
    for (const ba of bankAccounts) {
      const label = ba.customName
        ? ba.customName
        : ba.connectorName
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

  const accountOptions = React.useMemo<Array<FilterOption<string>>>(() => {
    if (!bankAccounts) return []
    return bankAccounts
      .filter((ba) => !ba.disabled && !ba.deleted)
      .map((ba) => ({
        value: ba._id,
        label: accountNameMap.get(ba._id) ?? ba.name ?? '',
      }))
  }, [bankAccounts, accountNameMap])

  const categoryOptions = React.useMemo<Array<FilterOption<string>>>(
    () =>
      categories.map((c) => ({
        value: c.key,
        label: c.label,
        icon: (
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: c.color }}
          />
        ),
      })),
    [categories],
  )

  const labelOptions = React.useMemo<Array<FilterOption<string>>>(
    () =>
      labels.map((l) => ({
        value: l._id,
        label: l.name,
        icon: (
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: l.color }}
          />
        ),
      })),
    [labels],
  )

  const transactionTypeOptions = React.useMemo<
    Array<FilterOption<string>>
  >(() => {
    if (!transactions) return []
    const types = new Set(
      transactions.map((t) => t.type).filter(Boolean) as Array<string>,
    )
    return [...types].sort().map((t) => ({ value: t, label: t }))
  }, [transactions])

  const fieldDescriptors = React.useMemo(
    () =>
      createTransactionFilterFields({
        accountOptions,
        categoryOptions,
        labelOptions,
        transactionTypeOptions,
        t,
        excludeFields: tab !== 'all' ? ['flow'] : undefined,
      }),
    [
      accountOptions,
      categoryOptions,
      labelOptions,
      transactionTypeOptions,
      t,
      tab,
    ],
  )

  const reuiFields = React.useMemo(
    () => toReUIFields(fieldDescriptors),
    [fieldDescriptors],
  )

  const serializableFields = React.useMemo(
    () => toSerializableFields(fieldDescriptors),
    [fieldDescriptors],
  )
  useRegisterFilterFields(serializableFields)

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally mount-only
  const stableInitialFilters = React.useMemo(
    () => externalInitialFilters ?? [],
    [],
  )

  // Pre-filter transactions by tab (flow direction) before applying user filters
  const tabFilteredTransactions = React.useMemo(() => {
    if (!transactions) return transactions
    if (tab === 'expenses') return transactions.filter((t) => t.value < 0)
    if (tab === 'income') return transactions.filter((t) => t.value > 0)
    return transactions
  }, [transactions, tab])

  const {
    filters,
    setFilters,
    filteredData: filteredTransactions,
    hasActiveFilters,
  } = useFilters<TransactionRecord>(tabFilteredTransactions, fieldDescriptors, {
    initialFilters: stableInitialFilters,
    onFiltersChange,
  })

  const loadFilters = React.useCallback(
    (newFilters: Array<Filter>) => setFilters(newFilters),
    [setFilters],
  )

  useAIFilterListener(loadFilters)

  const { setPaletteState } = useCommandDispatch()

  // Manual transaction dialog
  const manualTxDialog = useManualTransactionDialog()
  const deleteManual = useMutation(api.transactions.deleteManualTransaction)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = React.useState<string | null>(
    null,
  )
  const [deleteLoading, setDeleteLoading] = React.useState(false)

  const manualAccountOptions = React.useMemo(
    () =>
      accountOptions.map((a) => ({
        id: a.value,
        label: a.label,
        portfolioId: singlePortfolioId ?? allPortfolioIds[0] ?? '',
      })),
    [accountOptions, singlePortfolioId, allPortfolioIds],
  )

  const handleDeleteManual = React.useCallback(
    async (transactionId: string) => {
      setDeleteConfirmId(transactionId)
      setDeleteConfirmOpen(true)
    },
    [],
  )

  const confirmDelete = React.useCallback(async () => {
    if (!deleteConfirmId) return
    setDeleteLoading(true)
    try {
      await deleteManual({
        transactionId: deleteConfirmId as Id<'transactions'>,
      })
      setDeleteConfirmOpen(false)
      setDeleteConfirmId(null)
      toast.success(t('toast.manualTransactionDeleted'))
    } catch {
      toast.error(t('toast.failedDeleteManualTransaction'))
    } finally {
      setDeleteLoading(false)
    }
  }, [deleteConfirmId, deleteManual, t])

  useCommand('transaction.create', {
    handler: manualTxDialog.openCreate,
  })

  const currency = 'EUR'

  const financialSummary = React.useMemo(
    () => computeFinancialSummary(filteredTransactions),
    [filteredTransactions],
  )

  const previousSummary = React.useMemo(
    () => computeFinancialSummary(previousTransactions),
    [previousTransactions],
  )

  const cashFlowData = React.useMemo(
    () => computeCashFlowData(filteredTransactions),
    [filteredTransactions],
  )

  const sankeyData = React.useMemo(
    () => computeSankeyData(filteredTransactions, getCategory),
    [filteredTransactions, getCategory],
  )

  const expenseBreakdown = React.useMemo(
    () =>
      computeCategoryBreakdown(filteredTransactions, getCategory, 'expense'),
    [filteredTransactions, getCategory],
  )

  const incomeBreakdown = React.useMemo(
    () => computeCategoryBreakdown(filteredTransactions, getCategory, 'income'),
    [filteredTransactions, getCategory],
  )

  const recurringForTab = React.useMemo(() => {
    if (tab === 'all') return []
    if (!tabFilteredTransactions) return []
    const insightTxns: Array<InsightTransaction> = tabFilteredTransactions.map(
      (t) => ({
        _id: t._id,
        date: t.date,
        value: t.value,
        wording: t.wording,
        simplifiedWording: t.simplifiedWording,
        counterparty: t.counterparty,
        userCategoryKey: t.userCategoryKey,
        categoryParent: t.categoryParent,
        category: t.category,
        excludedFromBudget: t.excludedFromBudget,
      }),
    )
    return detectRecurringExpenses(
      insightTxns,
      tab === 'income' ? 'income' : 'expense',
    )
  }, [tabFilteredTransactions, tab])

  const tableData = React.useMemo<Array<TransactionRow>>(() => {
    if (!filteredTransactions) return []
    return filteredTransactions.map((t) => ({
      _id: t._id,
      bankAccountId: t.bankAccountId,
      portfolioId: t.portfolioId,
      source: t.source,
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
      counterparty:
        typeof t.counterparty === 'object' && t.counterparty !== null
          ? (((t.counterparty as Record<string, unknown>).label as string) ??
            undefined)
          : t.counterparty,
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
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 md:gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="flex flex-col gap-4">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-28" />
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-3 md:gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <Skeleton className="h-4 w-24" />
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
        <PageToolbar>
          <PeriodRow
            start={start}
            end={end}
            activePeriod={activePeriod}
            canGoNext={canGoNext}
            onSelectPeriod={selectPeriod}
            onCustomRange={setCustomRange}
            onPrev={goPrev}
            onNext={goNext}
          />
        </PageToolbar>
        <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ArrowLeftRight />
              </EmptyMedia>
              <EmptyTitle>{t('transactions.noTransactions')}</EmptyTitle>
              <EmptyDescription>
                {t('transactions.noTransactionsDescription')}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      </>
    )
  }

  return (
    <>
      <PageToolbar>
        <PeriodRow
          start={start}
          end={end}
          activePeriod={activePeriod}
          canGoNext={canGoNext}
          onSelectPeriod={selectPeriod}
          onCustomRange={setCustomRange}
          onPrev={goPrev}
          onNext={goNext}
        >
          <Button
            variant="outline"
            size="sm"
            onClick={manualTxDialog.openCreate}
          >
            <Plus />
            {t('transactions.addTransaction')}
          </Button>
        </PeriodRow>
        <FilterRow
          filters={filters}
          fields={reuiFields}
          onChange={setFilters}
          enableShortcut
          i18n={filterI18n}
          menuHeader={
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
              onClick={() => setPaletteState({ open: true, aiMode: true })}
            >
              <Sparkles className="size-4 text-muted-foreground" />
              {t('filters.askAi')}
            </button>
          }
          footer={filtersSlot?.({ filters, hasChanges: false })}
        >
          {onSaveView && filters.length > 0 && (
            <Button variant="ghost" size="sm" onClick={onSaveView}>
              Save view
            </Button>
          )}
        </FilterRow>
        <div className="border-t px-4 py-2.5 lg:px-6">
          <Tabs
            value={tab}
            onValueChange={(value) => onTabChange?.(value as CashFlowTab)}
          >
            <TabsList>
              <TabsTrigger value="all">{t('cashFlow.tabAll')}</TabsTrigger>
              <TabsTrigger value="expenses">
                {t('cashFlow.tabExpenses')}
              </TabsTrigger>
              <TabsTrigger value="income">
                {t('cashFlow.tabIncome')}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </PageToolbar>

      <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
        <FinancialSummaryBar
          totalIncome={financialSummary.totalIncome}
          totalExpenses={financialSummary.totalExpenses}
          delta={financialSummary.delta}
          savingsRate={financialSummary.savingsRate}
          recurringTotal={financialSummary.recurringTotal}
          previous={previousSummary}
          currency={currency}
        />

        {tab === 'all' &&
          (sankeyData.nodes.length > 0 ? (
            <SankeyChart
              nodes={sankeyData.nodes}
              links={sankeyData.links}
              currency={currency}
              onLabelClick={(categoryKey) => {
                setFilters((prev) => [
                  ...prev,
                  createFilter('category', 'is_any_of', [categoryKey]),
                ])
              }}
            />
          ) : (
            <CashFlowChart
              data={cashFlowData}
              currency={currency}
              isLoading={false}
            />
          ))}

        {tab === 'expenses' && (
          <div className="grid gap-4 md:grid-cols-2 md:gap-6">
            <CategoryBreakdownChart
              data={expenseBreakdown.categoryData}
              currency={currency}
              total={expenseBreakdown.total}
              title={t('spending.byCategory')}
              onCategoryClick={(categoryKey) => {
                setFilters((prev) => [
                  ...prev,
                  createFilter('category', 'is_any_of', [categoryKey]),
                ])
              }}
            />
            <div className="relative">
              <div className="md:absolute md:inset-0">
                <RecurringExpensesCard
                  items={recurringForTab}
                  categories={categories}
                  currency={currency}
                  isLoading={false}
                  onItemClick={(payee) => {
                    setFilters((prev) => [
                      ...prev,
                      createFilter('wording', 'contains', [payee]),
                    ])
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {tab === 'income' && (
          <div className="grid gap-4 md:grid-cols-2 md:gap-6">
            <CategoryBreakdownChart
              data={incomeBreakdown.categoryData}
              currency={currency}
              total={incomeBreakdown.total}
              title={t('income.byCategory')}
              onCategoryClick={(categoryKey) => {
                setFilters((prev) => [
                  ...prev,
                  createFilter('category', 'is_any_of', [categoryKey]),
                ])
              }}
            />
            <div className="relative">
              <div className="md:absolute md:inset-0">
                <RecurringExpensesCard
                  items={recurringForTab}
                  categories={categories}
                  currency={currency}
                  isLoading={false}
                  title={t('income.recurringIncome')}
                  onItemClick={(payee) => {
                    setFilters((prev) => [
                      ...prev,
                      createFilter('wording', 'contains', [payee]),
                    ])
                  }}
                />
              </div>
            </div>
          </div>
        )}

        <TransactionsList
          data={tableData}
          currency={currency}
          labels={labels}
          workspaceId={workspaceId ?? undefined}
          onEditManualTransaction={manualTxDialog.openEdit}
          onDeleteManualTransaction={handleDeleteManual}
        />
      </div>

      {singlePortfolioId && (
        <ManualTransactionDialog
          open={manualTxDialog.open}
          onOpenChange={manualTxDialog.setOpen}
          mode={manualTxDialog.mode}
          portfolioId={singlePortfolioId}
          accounts={manualAccountOptions}
          labels={labels}
          transaction={manualTxDialog.editTransaction}
        />
      )}

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title={t('dialogs.deleteManualTransaction.title')}
        description={t('dialogs.deleteManualTransaction.description')}
        confirmLabel={t('common.delete')}
        loading={deleteLoading}
        onConfirm={confirmDelete}
      />
    </>
  )
}
