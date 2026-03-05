import * as React from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { SiteHeader } from '~/components/site-header'
import { useProfile } from '~/contexts/profile-context'
import { Landmark, CirclePlus } from 'lucide-react'
import { AddConnectionDialog } from '~/components/add-connection-dialog'
import { Button } from '~/components/ui/button'
import {
  Card,
  CardFooter,
  CardHeader,
} from '~/components/ui/card'
import { Skeleton } from '~/components/ui/skeleton'
import { BalanceChart } from '~/components/balance-chart'
import { DashboardCard } from '~/components/dashboard-card'
import { type Period, getStartTimestamp } from '~/lib/chart-periods'
import { computePnL } from '~/lib/pnl'

export const Route = createFileRoute('/_app/')({
  component: Dashboard,
})

function Dashboard() {
  return (
    <>
      <SiteHeader />
      <div className="flex flex-1 flex-col">
        <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
          <BankAccountsSection />
        </div>
      </div>
    </>
  )
}

function BankAccountsSection() {
  const { activeProfileId, isLoading: profileLoading } = useProfile()
  const [period, setPeriod] = React.useState<Period>('1M')
  const startTimestamp = React.useMemo(() => getStartTimestamp(period), [period])
  const bankAccounts = useQuery(
    api.powens.listBankAccounts,
    activeProfileId ? { profileId: activeProfileId } : 'skip',
  )
  const snapshots = useQuery(
    api.balanceSnapshots.listSnapshotsByProfile,
    activeProfileId
      ? { profileId: activeProfileId, startTimestamp }
      : 'skip',
  )
  const [dialogOpen, setDialogOpen] = React.useState(false)

  const netWorthData = React.useMemo(() => {
    if (!snapshots) return []
    const dateMap = new Map<string, number>()
    for (const s of snapshots) {
      dateMap.set(s.date, (dateMap.get(s.date) ?? 0) + s.balance)
    }
    return [...dateMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, balance]) => ({ date, balance }))
  }, [snapshots])

  if (profileLoading || bankAccounts === undefined) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-[250px] w-full" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 *:data-[slot=card]:shadow-xs">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-8 w-24" />
              </CardHeader>
              <CardFooter>
                <Skeleton className="h-4 w-40" />
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (bankAccounts.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-12 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-muted">
            <Landmark className="size-8 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">No bank accounts yet</h3>
            <p className="text-sm text-muted-foreground">
              Connect your first bank to start tracking your finances.
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <CirclePlus className="mr-2 size-4" />
            Connect a Bank
          </Button>
        </div>
        <AddConnectionDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      </>
    )
  }

  const activeAccounts = bankAccounts.filter((a) => !a.deleted && !a.disabled)
  const totalBalance = activeAccounts.reduce((sum, a) => sum + a.balance, 0)
  const currency = activeAccounts[0]?.currency ?? 'EUR'

  return (
    <>
      <BalanceChart
        data={netWorthData}
        currency={currency}
        isLoading={snapshots === undefined}
        period={period}
        onPeriodChange={setPeriod}
        title="Net Worth"
        description={new Intl.NumberFormat('fr-FR', {
          style: 'currency',
          currency,
        }).format(totalBalance)}
      />

      <h2 className="text-lg font-semibold">Accounts</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {activeAccounts.map((account) => {
          const accountSnapshots = snapshots
            ?.filter((s) => s.bankAccountId === account._id)
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((s) => ({ balance: s.balance })) ?? []
          const accountPnl = computePnL(accountSnapshots)

          return (
            <Link key={account._id} to="/accounts/$accountId" params={{ accountId: account._id }}>
              <DashboardCard
                title={account.name}
                value={new Intl.NumberFormat('fr-FR', {
                  style: 'currency',
                  currency: account.currency,
                }).format(account.balance)}
                pnl={accountPnl}
                currency={account.currency}
                description={
                  account.iban
                    ? account.iban.replace(/(.{4})/g, '$1 ').trim()
                    : undefined
                }
                className="h-full transition-colors hover:bg-muted/50 cursor-pointer"
              />
            </Link>
          )
        })}
      </div>
    </>
  )
}
