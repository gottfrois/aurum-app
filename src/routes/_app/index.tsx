import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { Landmark } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { AllocationChart, CATEGORY_COLORS } from '~/components/allocation-chart'
import { BalanceChart } from '~/components/balance-chart'
import { SiteHeader } from '~/components/site-header'
import { TeamBreakdown } from '~/components/team-breakdown'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
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
import { WinnersLosers } from '~/components/winners-losers'
import { useCommandRegistry } from '~/contexts/command-context'
import { usePortfolio } from '~/contexts/portfolio-context'
import { useFormatCurrency } from '~/contexts/privacy-context'
import { useAggregatedBalances } from '~/hooks/use-aggregated-balances'
import { useCachedDecryptRecords } from '~/hooks/use-cached-decrypt'
import {
  ACCOUNT_CATEGORIES,
  getAccountCategoryLabel,
  getCategoryKey,
} from '~/lib/account-categories'
import type { Period } from '~/lib/chart-periods'
import { getStartTimestamp } from '~/lib/chart-periods'
import { fillMissingDates } from '~/lib/fill-missing-dates'
import { api } from '../../../convex/_generated/api'

type DecryptedBankAccount = NonNullable<
  NonNullable<ReturnType<typeof useQuery<typeof api.powens.listBankAccounts>>>
>[number] & {
  name?: string
  balance: number
  connectorName?: string
}

interface DecryptedInvestment {
  _id: string
  label: string
  code?: string
  valuation: number
  diff?: number
  diffPercent?: number
  currency?: string
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
          <BankAccountsSection />
        </div>
      </div>
    </>
  )
}

function BankAccountsSection() {
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
  const [period, setPeriod] = React.useState<Period>('1M')
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

  const investmentsSingle = useQuery(
    api.investments.listInvestmentsByPortfolio,
    singlePortfolioId ? { portfolioId: singlePortfolioId } : 'skip',
  )
  const investmentsAll = useQuery(
    api.investments.listAllInvestmentsByPortfolios,
    isAllPortfolios && allPortfolioIds.length > 0
      ? { portfolioIds: allPortfolioIds }
      : 'skip',
  )
  const investmentsTeam = useQuery(
    api.team.listTeamInvestments,
    isTeamView && workspaceId ? { workspaceId } : 'skip',
  )
  const rawInvestments = isTeamView
    ? investmentsTeam
    : isAllPortfolios
      ? investmentsAll
      : investmentsSingle
  const investments = useCachedDecryptRecords('investments', rawInvestments) as
    | DecryptedInvestment[]
    | undefined

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
            <div className="w-full space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
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
    <>
      <div className="grid gap-4 lg:grid-cols-3 md:gap-6">
        <div className="lg:col-span-2">
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

      {isTeamView && workspaceId && <TeamBreakdown workspaceId={workspaceId} />}

      {investments && investments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.winnersLosers')}</CardTitle>
          </CardHeader>
          <CardContent>
            <WinnersLosers investments={investments} currency={currency} />
          </CardContent>
        </Card>
      )}
    </>
  )
}
