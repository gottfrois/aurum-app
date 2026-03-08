import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
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
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Skeleton } from '~/components/ui/skeleton'
import { BalanceChart } from '~/components/balance-chart'
import { getStartTimestamp } from '~/lib/chart-periods'
import { fillMissingDates } from '~/lib/fill-missing-dates'
import { AllocationChart, CATEGORY_COLORS } from '~/components/allocation-chart'
import { ACCOUNT_CATEGORIES, getCategoryKey } from '~/lib/account-categories'
import { useFormatCurrency } from '~/contexts/privacy-context'
import { useCachedDecryptRecords } from '~/hooks/use-cached-decrypt'
import { WinnersLosers } from '~/components/winners-losers'

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
    profiles,
  } = useProfile()
  const workspaceId = profiles?.[0]?.workspaceId ?? null
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
  const bankAccounts = useCachedDecryptRecords('bankAccounts', rawBankAccounts)

  const netWorthSingle = useQuery(
    api.balanceSnapshots.listDailyNetWorth,
    singleProfileId ? { profileId: singleProfileId, startTimestamp } : 'skip',
  )
  const netWorthAll = useQuery(
    api.balanceSnapshots.listAllDailyNetWorth,
    isAllProfiles && workspaceId ? { workspaceId, startTimestamp } : 'skip',
  )
  const dailyNetWorth = isAllProfiles ? netWorthAll : netWorthSingle

  const investmentsSingle = useQuery(
    api.investments.listInvestmentsByProfile,
    singleProfileId ? { profileId: singleProfileId } : 'skip',
  )
  const investmentsAll = useQuery(
    api.investments.listAllInvestmentsByProfiles,
    isAllProfiles && allProfileIds.length > 0
      ? { profileIds: allProfileIds }
      : 'skip',
  )
  const rawInvestments = isAllProfiles ? investmentsAll : investmentsSingle
  const investments = useCachedDecryptRecords('investments', rawInvestments)

  const formatCurrency = useFormatCurrency()
  const [dialogOpen, setDialogOpen] = React.useState(false)

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
              <CardContent>
                <Skeleton className="h-4 w-40" />
              </CardContent>
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
            isLoading={dailyNetWorth === undefined}
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

      {investments && investments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Winners & Losers</CardTitle>
          </CardHeader>
          <CardContent>
            <WinnersLosers investments={investments} currency={currency} />
          </CardContent>
        </Card>
      )}
    </>
  )
}
