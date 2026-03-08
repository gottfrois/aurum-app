import * as React from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { ArrowLeft } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import type { Period } from '~/lib/chart-periods'
import { SiteHeader } from '~/components/site-header'
import { BalanceChart } from '~/components/balance-chart'
import { HoldingsTable } from '~/components/holdings-table'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Skeleton } from '~/components/ui/skeleton'
import { getStartTimestamp } from '~/lib/chart-periods'
import { fillMissingDates } from '~/lib/fill-missing-dates'
import { isInvestmentAccount } from '~/lib/account-categories'
import { useFormatCurrency } from '~/contexts/privacy-context'
import {
  useCachedDecryptRecord,
  useCachedDecryptRecords,
} from '~/hooks/use-cached-decrypt'

export const Route = createFileRoute('/_app/accounts/$accountId')({
  component: AccountDetailPage,
})

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
  const bankAccount = useCachedDecryptRecord('bankAccounts', rawBankAccount)

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
  const investments = useCachedDecryptRecords('investments', rawInvestments)

  const formatCurrency = useFormatCurrency()

  const isLoading = bankAccount === undefined || snapshots === undefined

  const chartData = React.useMemo(() => {
    if (!snapshots) return []
    return fillMissingDates(
      snapshots.map((s) => ({ date: s.date, balance: s.balance })),
    )
  }, [snapshots])

  return (
    <>
      <SiteHeader
        title={bankAccount?.connectorName ?? bankAccount?.name ?? 'Account'}
      />
      <div className="flex flex-1 flex-col">
        <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
          <Link
            to="/accounts"
            search={{}}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground w-fit"
          >
            <ArrowLeft className="size-4" />
            Back to accounts
          </Link>

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
              <BalanceChart
                data={chartData}
                currency={bankAccount.currency}
                isLoading={false}
                period={period}
                onPeriodChange={setPeriod}
                title={bankAccount.connectorName ?? bankAccount.name}
                description={formatCurrency(
                  bankAccount.balance,
                  bankAccount.currency,
                )}
              />

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
