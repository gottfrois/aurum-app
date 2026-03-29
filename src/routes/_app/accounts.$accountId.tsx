import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { ListFilter } from 'lucide-react'
import * as React from 'react'
import { AllocationChart } from '~/components/allocation-chart'
import { BalanceChart } from '~/components/balance-chart'
import type { Investment } from '~/components/holdings-table'
import { HoldingsTable } from '~/components/holdings-table'
import { type FilterOption, Filters } from '~/components/reui/filters'
import { SiteHeader } from '~/components/site-header'
import type { TransactionRow } from '~/components/transactions-list'
import { TransactionsList } from '~/components/transactions-list'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Skeleton } from '~/components/ui/skeleton'
import { usePortfolio } from '~/contexts/portfolio-context'
import { useFormatCurrency } from '~/contexts/privacy-context'
import {
  useCachedDecryptRecord,
  useCachedDecryptRecords,
} from '~/hooks/use-cached-decrypt'
import { useFilters } from '~/hooks/use-filters'
import { isInvestmentAccount } from '~/lib/account-categories'
import { useCategories } from '~/lib/categories'
import type { Period } from '~/lib/chart-periods'
import { getStartTimestamp } from '~/lib/chart-periods'
import { fillMissingDates } from '~/lib/fill-missing-dates'
import { createTransactionFilterFields } from '~/lib/filters/transactions'
import { toReUIFields } from '~/lib/filters/types'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'

type DecryptedBankAccount = NonNullable<
  ReturnType<typeof useQuery<typeof api.powens.getBankAccount>>
> & {
  name?: string
  balance?: number
  connectorName?: string
  customName?: string
}

interface TransactionRecord {
  _id: string
  bankAccountId: string
  portfolioId: string
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

export const Route = createFileRoute('/_app/accounts/$accountId')({
  component: AccountDetailPage,
})

const CHART_COLORS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
]

function AccountDetailPage() {
  const { accountId } = Route.useParams()
  const [period, setPeriod] = React.useState<Period>('1M')
  const startTimestamp = React.useMemo(
    () => getStartTimestamp(period),
    [period],
  )

  const { portfolios } = usePortfolio()
  const workspaceId = portfolios?.[0]?.workspaceId ?? null
  const { categories } = useCategories()

  const rawBankAccount = useQuery(api.powens.getBankAccount, {
    bankAccountId: accountId as Id<'bankAccounts'>,
  })
  const bankAccount = useCachedDecryptRecord('bankAccounts', rawBankAccount) as
    | DecryptedBankAccount
    | undefined
    | null

  const rawSnapshots = useQuery(api.balanceSnapshots.listSnapshots, {
    bankAccountId: accountId as Id<'bankAccounts'>,
    startTimestamp,
  })
  const snapshots = useCachedDecryptRecords('balanceSnapshots', rawSnapshots) as
    | Array<{
        _id: string
        date: string
        balance: number
        encryptedData?: string
      }>
    | undefined

  const isInvestment = isInvestmentAccount(bankAccount?.type ?? undefined)

  const rawInvestments = useQuery(
    api.investments.listInvestments,
    isInvestment ? { bankAccountId: accountId as Id<'bankAccounts'> } : 'skip',
  )
  const investments = useCachedDecryptRecords('investments', rawInvestments) as
    | Investment[]
    | undefined

  const rawTransactions = useQuery(
    api.transactions.listTransactionsByBankAccount,
    { bankAccountId: accountId as Id<'bankAccounts'> },
  )
  const transactions = useCachedDecryptRecords(
    'transactions',
    rawTransactions as Array<TransactionRecord> | undefined,
  )

  const labelsData = useQuery(
    api.transactionLabels.listLabels,
    workspaceId
      ? {
          workspaceId,
          portfolioId: bankAccount?.portfolioId as Id<'portfolios'> | undefined,
        }
      : 'skip',
  )
  const labels = labelsData ?? []

  const formatCurrency = useFormatCurrency()

  const isLoading = bankAccount === undefined || snapshots === undefined

  const categoryOptions = React.useMemo<Array<FilterOption<string>>>(
    () =>
      categories.map((c) => ({
        value: c.key,
        label: c.label,
      })),
    [categories],
  )

  const labelOptions = React.useMemo<Array<FilterOption<string>>>(
    () =>
      labels.map((l) => ({
        value: l._id,
        label: l.name,
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
        accountOptions: [],
        categoryOptions,
        labelOptions,
        transactionTypeOptions,
        excludeFields: ['account'],
      }),
    [categoryOptions, labelOptions, transactionTypeOptions],
  )

  const reuiFields = React.useMemo(
    () => toReUIFields(fieldDescriptors),
    [fieldDescriptors],
  )

  const {
    filters,
    setFilters,
    filteredData: filteredTransactions,
  } = useFilters<TransactionRecord>(transactions, fieldDescriptors)

  const tableData = React.useMemo<Array<TransactionRow>>(() => {
    if (!filteredTransactions) return []
    return filteredTransactions.map((t) => ({
      _id: t._id,
      bankAccountId: t.bankAccountId,
      portfolioId: t.portfolioId,
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
    }))
  }, [filteredTransactions])

  const holdingsAllocation = React.useMemo(() => {
    if (!investments || investments.length === 0) return []
    return investments
      .filter((inv) => inv.valuation > 0)
      .sort((a, b) => b.valuation - a.valuation)
      .map((inv, i) => ({
        key: inv._id,
        label: inv.label,
        value: inv.valuation,
        color: CHART_COLORS[i % CHART_COLORS.length],
      }))
  }, [investments])

  const holdingsTotal = React.useMemo(
    () => holdingsAllocation.reduce((sum, h) => sum + h.value, 0),
    [holdingsAllocation],
  )

  const showAllocationChart = isInvestment && holdingsAllocation.length >= 2

  const chartData = React.useMemo(() => {
    if (!snapshots) return []
    return fillMissingDates(
      snapshots.map((s) => ({ date: s.date, balance: s.balance })),
    )
  }, [snapshots])

  return (
    <>
      <SiteHeader
        breadcrumbs={[
          { label: 'Accounts', href: '/accounts' },
          {
            label:
              bankAccount?.customName ??
              bankAccount?.connectorName ??
              bankAccount?.name ??
              'Account',
          },
        ]}
      />
      <div className="flex flex-1 flex-col">
        <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
          {isLoading ? (
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
          ) : bankAccount === null ? (
            <div className="text-center text-muted-foreground py-12">
              Account not found.
            </div>
          ) : (
            <>
              <div
                className={
                  showAllocationChart
                    ? 'grid gap-4 lg:grid-cols-3 md:gap-6'
                    : undefined
                }
              >
                <div
                  className={showAllocationChart ? 'lg:col-span-2' : undefined}
                >
                  <BalanceChart
                    data={chartData}
                    currency={bankAccount.currency}
                    isLoading={false}
                    period={period}
                    onPeriodChange={setPeriod}
                    title={
                      bankAccount.customName ??
                      bankAccount.connectorName ??
                      bankAccount.name
                    }
                    description={formatCurrency(
                      bankAccount.balance ?? 0,
                      bankAccount.currency,
                    )}
                  />
                </div>
                {showAllocationChart && (
                  <AllocationChart
                    data={holdingsAllocation}
                    currency={bankAccount.currency}
                    total={holdingsTotal}
                  />
                )}
              </div>

              {isInvestment && investments && investments.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Holdings</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <HoldingsTable investments={investments} />
                  </CardContent>
                </Card>
              )}

              <TransactionsList
                data={tableData}
                currency={bankAccount.currency ?? 'EUR'}
                labels={labels}
                workspaceId={workspaceId ?? undefined}
                filterActions={
                  <Filters
                    filters={filters}
                    fields={reuiFields}
                    onChange={setFilters}
                    size="sm"
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full"
                      >
                        <ListFilter />
                      </Button>
                    }
                  />
                }
                activeFilters={
                  filters.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Filters
                        filters={filters}
                        fields={reuiFields}
                        onChange={setFilters}
                      />
                      <div className="ml-auto">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setFilters([])}
                        >
                          Clear
                        </Button>
                      </div>
                    </div>
                  ) : undefined
                }
              />
            </>
          )}
        </div>
      </div>
    </>
  )
}
