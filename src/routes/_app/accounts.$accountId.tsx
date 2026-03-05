import * as React from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { SiteHeader } from '~/components/site-header'
import { BalanceChart } from '~/components/balance-chart'
import { Skeleton } from '~/components/ui/skeleton'
import { ArrowLeft } from 'lucide-react'
import { type Period, getStartTimestamp } from '~/lib/chart-periods'
import { fillMissingDates } from '~/lib/fill-missing-dates'

export const Route = createFileRoute('/_app/accounts/$accountId')({
  component: AccountDetailPage,
})

function AccountDetailPage() {
  const { accountId } = Route.useParams()
  const [period, setPeriod] = React.useState<Period>('1M')
  const startTimestamp = React.useMemo(() => getStartTimestamp(period), [period])

  const bankAccount = useQuery(api.powens.getBankAccount, {
    bankAccountId: accountId as Id<'bankAccounts'>,
  })

  const snapshots = useQuery(api.balanceSnapshots.listSnapshots, {
    bankAccountId: accountId as Id<'bankAccounts'>,
    startTimestamp,
  })

  const isLoading = bankAccount === undefined || snapshots === undefined

  const chartData = React.useMemo(() => {
    if (!snapshots) return []
    return fillMissingDates(
      snapshots.map((s) => ({ date: s.date, balance: s.balance })),
    )
  }, [snapshots])

  return (
    <>
      <SiteHeader title={bankAccount?.connectorName ?? bankAccount?.name ?? 'Account'} />
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
            <BalanceChart
              data={chartData}
              currency={bankAccount.currency}
              isLoading={false}
              period={period}
              onPeriodChange={setPeriod}
              title={bankAccount.connectorName ?? bankAccount.name}
              description={new Intl.NumberFormat('fr-FR', {
                style: 'currency',
                currency: bankAccount.currency,
              }).format(bankAccount.balance)}
            />
          )}
        </div>
      </div>
    </>
  )
}
