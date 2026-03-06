import * as React from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { Landmark } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import type { Period } from '~/lib/chart-periods'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '~/components/ui/empty'
import { SiteHeader } from '~/components/site-header'
import { useProfile } from '~/contexts/profile-context'
import { AddConnectionDialog } from '~/components/add-connection-dialog'
import { Button } from '~/components/ui/button'
import { Card, CardFooter, CardHeader } from '~/components/ui/card'
import { Skeleton } from '~/components/ui/skeleton'
import { BalanceChart } from '~/components/balance-chart'
import { DashboardCard } from '~/components/dashboard-card'
import { getStartTimestamp } from '~/lib/chart-periods'
import { computePnL } from '~/lib/pnl'
import { fillMissingDates } from '~/lib/fill-missing-dates'
import { AllocationChart, CATEGORY_COLORS } from '~/components/allocation-chart'
import { ACCOUNT_CATEGORIES, getCategoryKey } from '~/lib/account-categories'
import { useFormatCurrency } from '~/contexts/privacy-context'
import { useDecryptRecords } from '~/contexts/encryption-context'

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
  const {
    isLoading: profileLoading,
    isAllProfiles,
    allProfileIds,
    singleProfileId,
  } = useProfile()
  const [period, setPeriod] = React.useState<Period>('1M')
  const startTimestamp = React.useMemo(
    () => getStartTimestamp(period),
    [period],
  )

  const bankAccountsSingle = useQuery(
    api.powens.listBankAccounts,
    singleProfileId ? { profileId: singleProfileId } : 'skip',
  )
  const bankAccountsAll = useQuery(
    api.powens.listAllBankAccounts,
    isAllProfiles && allProfileIds.length > 0
      ? { profileIds: allProfileIds }
      : 'skip',
  )
  const rawBankAccounts = isAllProfiles ? bankAccountsAll : bankAccountsSingle
  const bankAccounts = useDecryptRecords(rawBankAccounts)

  const snapshotsSingle = useQuery(
    api.balanceSnapshots.listSnapshotsByProfile,
    singleProfileId ? { profileId: singleProfileId, startTimestamp } : 'skip',
  )
  const snapshotsAll = useQuery(
    api.balanceSnapshots.listAllSnapshotsByProfiles,
    isAllProfiles && allProfileIds.length > 0
      ? { profileIds: allProfileIds, startTimestamp }
      : 'skip',
  )
  const rawSnapshots = isAllProfiles ? snapshotsAll : snapshotsSingle
  const snapshots = useDecryptRecords(rawSnapshots)

  const formatCurrency = useFormatCurrency()
  const [dialogOpen, setDialogOpen] = React.useState(false)

  const activeAccounts = React.useMemo(
    () => bankAccounts?.filter((a) => !a.deleted && !a.disabled) ?? [],
    [bankAccounts],
  )

  const netWorthData = React.useMemo(() => {
    if (!snapshots) return []
    const dateMap = new Map<string, number>()
    for (const s of snapshots) {
      dateMap.set(s.date, (dateMap.get(s.date) ?? 0) + s.balance)
    }
    const sorted = [...dateMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, balance]) => ({ date, balance }))
    return fillMissingDates(sorted)
  }, [snapshots])

  const allocationData = React.useMemo(() => {
    const categoryTotals = new Map<string, number>()
    for (const a of activeAccounts) {
      const key = getCategoryKey(a.type)
      categoryTotals.set(key, (categoryTotals.get(key) ?? 0) + a.balance)
    }
    return Object.entries(ACCOUNT_CATEGORIES)
      .filter(([key]) => categoryTotals.has(key))
      .map(([key, cat]) => ({
        key,
        label: cat.label,
        value: categoryTotals.get(key) ?? 0,
        color: CATEGORY_COLORS[key] ?? 'var(--color-chart-5)',
      }))
  }, [activeAccounts])

  if (profileLoading || bankAccounts === undefined) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-[250px] w-full" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Landmark />
            </EmptyMedia>
            <EmptyTitle>No Accounts Yet</EmptyTitle>
            <EmptyDescription>
              You haven&apos;t connected any financial accounts yet. Get started
              by adding your first connection.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setDialogOpen(true)}>Add Connection</Button>
          </EmptyContent>
        </Empty>
        <AddConnectionDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      </>
    )
  }

  const totalBalance = activeAccounts.reduce((sum, a) => sum + a.balance, 0)
  const currency = activeAccounts[0]?.currency ?? 'EUR'

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-3 md:gap-6">
        <div className="lg:col-span-2">
          <BalanceChart
            data={netWorthData}
            currency={currency}
            isLoading={snapshots === undefined}
            period={period}
            onPeriodChange={setPeriod}
            title="Net Worth"
            description={formatCurrency(totalBalance, currency)}
          />
        </div>
        <AllocationChart
          data={allocationData}
          currency={currency}
          total={totalBalance}
        />
      </div>

      <h2 className="text-lg font-semibold">Accounts</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {activeAccounts.map((account) => {
          const accountSnapshots =
            snapshots
              ?.filter((s) => s.bankAccountId === account._id)
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((s) => ({ balance: s.balance })) ?? []
          const accountPnl = computePnL(accountSnapshots)

          return (
            <Link
              key={account._id}
              to="/accounts/$accountId"
              params={{ accountId: account._id }}
            >
              <DashboardCard
                title={account.connectorName ?? account.name}
                value={formatCurrency(account.balance, account.currency)}
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
