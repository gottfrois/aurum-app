import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { Landmark } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { AllocationChart, CATEGORY_COLORS } from '~/components/allocation-chart'
import { BalanceChart } from '~/components/balance-chart'
import { CategoryBreakdownChart } from '~/components/category-breakdown-chart'
import { FinancialSummaryBar } from '~/components/financial-summary-bar'
import { MonthlyPaceChart } from '~/components/monthly-pace-chart'
import { RecurringExpensesCard } from '~/components/recurring-expenses-card'
import { SiteHeader } from '~/components/site-header'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader } from '~/components/ui/card'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '~/components/ui/empty'
import { Kbd } from '~/components/ui/kbd'
import { Skeleton } from '~/components/ui/skeleton'
import { useCommandRegistry } from '~/contexts/command-context'
import { usePortfolio } from '~/contexts/portfolio-context'
import { useFormatCurrency } from '~/contexts/privacy-context'
import { useAggregatedBalances } from '~/hooks/use-aggregated-balances'
import { useCachedDecryptRecords } from '~/hooks/use-cached-decrypt'
import { useDateRange } from '~/hooks/use-date-range'
import { useTransactions } from '~/hooks/use-transactions'
import {
  ACCOUNT_CATEGORIES,
  getAccountCategoryLabel,
  getCategoryKey,
} from '~/lib/account-categories'
import { computeCategoryBreakdown } from '~/lib/cash-flow'
import { useCategories } from '~/lib/categories'
import type { Period } from '~/lib/chart-periods'
import { getStartTimestamp } from '~/lib/chart-periods'
import { fillMissingDates } from '~/lib/fill-missing-dates'
import type { InsightTransaction } from '~/lib/financial-analytics'
import {
  computeMonthlyPace,
  detectRecurringExpenses,
} from '~/lib/financial-analytics'
import { computeFinancialSummary } from '~/lib/financial-summary'
import { api } from '../../../convex/_generated/api'

type DecryptedBankAccount = NonNullable<
  NonNullable<ReturnType<typeof useQuery<typeof api.powens.listBankAccounts>>>
>[number] & {
  name?: string
  balance: number
  connectorName?: string
}

export const Route = createFileRoute('/_app/')({
  component: Dashboard,
})

function Dashboard() {
  return (
    <>
      <SiteHeader />
      <div className="flex flex-1 flex-col">
        <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
          <DashboardNetWorthAndAllocation />
          <DashboardFinancialSummary />
          <DashboardMonthlyPace />
          <DashboardExpensesAndRecurring />
        </div>
      </div>
    </>
  )
}

// ─── Section 1 & 2: Net Worth + Allocation ────────────────

function DashboardNetWorthAndAllocation() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const {
    isLoading: portfolioLoading,
    isAllPortfolios,
    isTeamView,
    allPortfolioIds,
    singlePortfolioId,
    portfolios,
  } = usePortfolio()
  const workspaceId = portfolios?.[0]?.workspaceId ?? null
  const [period, setPeriod] = React.useState<Period>('1Y')
  const startTimestamp = React.useMemo(
    () => getStartTimestamp(period),
    [period],
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

  const snapshotsSingle = useQuery(
    api.balanceSnapshots.listSnapshotsByPortfolio,
    singlePortfolioId
      ? { portfolioId: singlePortfolioId, startTimestamp }
      : 'skip',
  )
  const snapshotsAll = useQuery(
    api.balanceSnapshots.listAllSnapshotsByPortfolios,
    isAllPortfolios && allPortfolioIds.length > 0
      ? { portfolioIds: allPortfolioIds, startTimestamp }
      : 'skip',
  )
  const snapshotsTeam = useQuery(
    api.team.listTeamBalanceSnapshots,
    isTeamView && workspaceId ? { workspaceId, startTimestamp } : 'skip',
  )
  const rawSnapshots = isTeamView
    ? snapshotsTeam
    : isAllPortfolios
      ? snapshotsAll
      : snapshotsSingle
  const decryptedSnapshots = useCachedDecryptRecords(
    'balanceSnapshots',
    rawSnapshots,
  ) as
    | Array<{
        _id: string
        bankAccountId: string
        portfolioId: string
        date: string
        timestamp: number
        currency: string
        balance: number
      }>
    | undefined

  const { dailyNetWorth } = useAggregatedBalances(
    decryptedSnapshots,
    bankAccounts,
  )

  const formatCurrency = useFormatCurrency()
  const { commands } = useCommandRegistry()
  const addConnectionCommand = commands.find((c) => c.id === 'connection.add')

  const activeAccounts = React.useMemo(
    () => bankAccounts?.filter((a) => !a.deleted && !a.disabled) ?? [],
    [bankAccounts],
  )

  const netWorthData = React.useMemo(() => {
    if (!dailyNetWorth) return []
    const dateMap = new Map<string, number>()
    for (const s of dailyNetWorth) {
      dateMap.set(s.date, (dateMap.get(s.date) ?? 0) + s.balance)
    }
    const sorted = [...dateMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, balance]) => ({ date, balance }))
    return fillMissingDates(sorted)
  }, [dailyNetWorth])

  const allocationData = React.useMemo(() => {
    const categoryTotals = new Map<string, number>()
    for (const a of activeAccounts) {
      const key = getCategoryKey(a.type)
      categoryTotals.set(key, (categoryTotals.get(key) ?? 0) + a.balance)
    }
    return Object.entries(ACCOUNT_CATEGORIES)
      .filter(([key]) => categoryTotals.has(key))
      .map(([key]) => ({
        key,
        label: getAccountCategoryLabel(key, t),
        value: categoryTotals.get(key) ?? 0,
        color: CATEGORY_COLORS[key] ?? 'var(--color-chart-5)',
      }))
  }, [activeAccounts, t])

  if (portfolioLoading || bankAccounts === undefined) {
    return (
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
          </CardContent>
        </Card>
      </div>
    )
  }

  if (bankAccounts.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Landmark />
          </EmptyMedia>
          <EmptyTitle>{t('dashboard.emptyTitle')}</EmptyTitle>
          <EmptyDescription>{t('dashboard.emptyDescription')}</EmptyDescription>
        </EmptyHeader>
        {!isTeamView && (
          <EmptyContent>
            <Button onClick={() => addConnectionCommand?.handler()}>
              {t('button.addConnection')} <Kbd>C</Kbd>
            </Button>
          </EmptyContent>
        )}
      </Empty>
    )
  }

  const totalBalance = activeAccounts.reduce((sum, a) => sum + a.balance, 0)
  const currency = activeAccounts[0]?.currency ?? 'EUR'

  return (
    <div className="grid gap-4 lg:grid-cols-3 md:gap-6">
      <div className="h-full lg:col-span-2">
        <BalanceChart
          data={netWorthData}
          currency={currency}
          isLoading={decryptedSnapshots === undefined}
          period={period}
          onPeriodChange={setPeriod}
          title={t('dashboard.netWorth')}
          description={formatCurrency(totalBalance, currency)}
        />
      </div>
      <AllocationChart
        data={allocationData}
        currency={currency}
        total={totalBalance}
        onCategoryClick={(categoryKey) => {
          navigate({ to: '/accounts', search: { type: categoryKey } })
        }}
      />
    </div>
  )
}

// ─── Section 3: Financial Summary ─────────────────────────

function DashboardFinancialSummary() {
  const { range } = useDateRange({
    storageKey: 'bunkr:period:dashboard:summary',
    defaultPeriod: '1M',
  })

  const { transactions } = useTransactions({
    range,
    cacheKey: 'dashboardTransactions',
  })

  const previousRange = React.useMemo(() => {
    const s = new Date(range.start)
    const e = new Date(range.end)
    const days = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24))
    const prevEnd = new Date(s)
    prevEnd.setDate(prevEnd.getDate() - 1)
    const prevStart = new Date(prevEnd)
    prevStart.setDate(prevStart.getDate() - days)
    return {
      start: prevStart.toISOString().slice(0, 10),
      end: prevEnd.toISOString().slice(0, 10),
    }
  }, [range])

  const { transactions: previousTransactions } = useTransactions({
    range: previousRange,
    cacheKey: 'dashboardPreviousTransactions',
  })

  const summary = React.useMemo(
    () => computeFinancialSummary(transactions),
    [transactions],
  )
  const previousSummary = React.useMemo(
    () => computeFinancialSummary(previousTransactions),
    [previousTransactions],
  )

  const currency = 'EUR'

  return (
    <FinancialSummaryBar
      totalIncome={summary.totalIncome}
      totalExpenses={summary.totalExpenses}
      delta={summary.delta}
      savingsRate={summary.savingsRate}
      recurringTotal={summary.recurringTotal}
      previous={previousSummary}
      currency={currency}
    />
  )
}

// ─── Section 4: Monthly Pace ──────────────────────────────

function DashboardMonthlyPace() {
  const today = React.useMemo(() => new Date(), [])
  const currentMonthRange = React.useMemo(() => {
    const year = today.getFullYear()
    const month = today.getMonth()
    // Fetch 2 months back (current + previous for comparison)
    const start = new Date(year, month - 1, 1)
    const end = today
    return {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    }
  }, [today])

  const { transactions, isLoading } = useTransactions({
    range: currentMonthRange,
    cacheKey: 'dashboardPaceTransactions',
  })

  const insightTxns = React.useMemo<Array<InsightTransaction>>(() => {
    if (!transactions) return []
    return transactions.map((t) => ({
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
    }))
  }, [transactions])

  const pace = React.useMemo(
    () => computeMonthlyPace(insightTxns, today),
    [insightTxns, today],
  )

  return (
    <MonthlyPaceChart
      data={pace.data}
      currentTotal={pace.currentTotal}
      projectedTotal={pace.projectedTotal}
      previousTotal={pace.previousTotal}
      dailyRate={pace.dailyRate}
      currency="EUR"
      isLoading={isLoading}
      spentHref="/cash-flow"
    />
  )
}

// ─── Section 5: Expenses & Recurring ──────────────────────

function DashboardExpensesAndRecurring() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { isLoading: portfolioLoading } = usePortfolio()
  const { categories, getCategory } = useCategories()

  // 6-month lookback for both category breakdown and recurring detection
  const recurringRange = React.useMemo(() => {
    const end = new Date()
    const start = new Date()
    start.setMonth(start.getMonth() - 6)
    return {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    }
  }, [])

  const { transactions, isLoading: txnsLoading } = useTransactions({
    range: recurringRange,
    cacheKey: 'dashboardExpenseTransactions',
  })

  const { categoryData, total } = React.useMemo(
    () => computeCategoryBreakdown(transactions, getCategory, 'expense'),
    [transactions, getCategory],
  )

  const recurringExpenses = React.useMemo(() => {
    if (!transactions) return []
    const insightTxns: Array<InsightTransaction> = transactions.map((t) => ({
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
    }))
    return detectRecurringExpenses(insightTxns)
  }, [transactions])

  return (
    <div className="grid gap-4 md:grid-cols-2 md:gap-6">
      <CategoryBreakdownChart
        data={categoryData}
        currency="EUR"
        total={total}
        title={t('spending.byCategory')}
        onCategoryClick={() => {
          navigate({ to: '/cash-flow', search: {} })
        }}
      />
      <div className="relative">
        <div className="md:absolute md:inset-0">
          <RecurringExpensesCard
            items={recurringExpenses}
            categories={categories}
            currency="EUR"
            isLoading={portfolioLoading || txnsLoading}
          />
        </div>
      </div>
    </div>
  )
}
