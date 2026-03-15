import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import * as React from 'react'
import { AllocationChart } from '~/components/allocation-chart'
import { BalanceChart } from '~/components/balance-chart'
import type { Investment } from '~/components/holdings-table'
import { HoldingsTable } from '~/components/holdings-table'
import { SiteHeader } from '~/components/site-header'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Skeleton } from '~/components/ui/skeleton'
import { useFormatCurrency } from '~/contexts/privacy-context'
import {
  useCachedDecryptRecord,
  useCachedDecryptRecords,
} from '~/hooks/use-cached-decrypt'
import { isInvestmentAccount } from '~/lib/account-categories'
import type { Period } from '~/lib/chart-periods'
import { getStartTimestamp } from '~/lib/chart-periods'
import { fillMissingDates } from '~/lib/fill-missing-dates'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'

type DecryptedBankAccount = NonNullable<
  ReturnType<typeof useQuery<typeof api.powens.getBankAccount>>
> & {
  name?: string
  balance?: number
  connectorName?: string
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
  const snapshots = useCachedDecryptRecords('balanceSnapshots', rawSnapshots)

  const isInvestment = isInvestmentAccount(bankAccount?.type ?? undefined)

  const rawInvestments = useQuery(
    api.investments.listInvestments,
    isInvestment ? { bankAccountId: accountId as Id<'bankAccounts'> } : 'skip',
  )
  const investments = useCachedDecryptRecords('investments', rawInvestments) as
    | Investment[]
    | undefined

  const formatCurrency = useFormatCurrency()

  const isLoading = bankAccount === undefined || snapshots === undefined

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
            label: bankAccount?.connectorName ?? bankAccount?.name ?? 'Account',
          },
        ]}
      />
      <div className="flex flex-1 flex-col">
        <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-[250px] w-full" />
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
                    title={bankAccount.connectorName ?? bankAccount.name}
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
            </>
          )}
        </div>
      </div>
    </>
  )
}
