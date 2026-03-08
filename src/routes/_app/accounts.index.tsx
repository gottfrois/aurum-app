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
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from '~/components/ui/item'
import { Skeleton } from '~/components/ui/skeleton'
import { BalanceChart } from '~/components/balance-chart'
import { StackedBalanceChart } from '~/components/stacked-balance-chart'
import { getStartTimestamp } from '~/lib/chart-periods'
import { ACCOUNT_CATEGORIES, getCategoryKey } from '~/lib/account-categories'
import { computePnL } from '~/lib/pnl'
import {
  fillMissingDates,
  fillMissingDatesStacked,
} from '~/lib/fill-missing-dates'
import { useFormatCurrency } from '~/contexts/privacy-context'
import { useCachedDecryptRecords } from '~/hooks/use-cached-decrypt'

export const Route = createFileRoute('/_app/accounts/')({
  component: AccountsPage,
  validateSearch: (search: Record<string, unknown>): { type?: string } => ({
    type: typeof search.type === 'string' ? search.type : undefined,
  }),
})

function AccountsPage() {
  const { type } = Route.useSearch()
  const category = type ? ACCOUNT_CATEGORIES[type] : undefined
  const title = category ? category.label : 'Accounts'

  return (
    <>
      <SiteHeader title={title} />
      <div className="flex flex-1 flex-col">
        <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
          <BankAccountsList categoryFilter={type} />
        </div>
      </div>
    </>
  )
}

function BankAccountsList({ categoryFilter }: { categoryFilter?: string }) {
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

  const allBankAccountsSingle = useQuery(
    api.powens.listBankAccounts,
    singleProfileId ? { profileId: singleProfileId } : 'skip',
  )
  const allBankAccountsAll = useQuery(
    api.powens.listAllBankAccounts,
    isAllProfiles && allProfileIds.length > 0
      ? { profileIds: allProfileIds }
      : 'skip',
  )
  const rawAllBankAccounts = isAllProfiles
    ? allBankAccountsAll
    : allBankAccountsSingle
  const allBankAccounts = useCachedDecryptRecords(
    'bankAccounts',
    rawAllBankAccounts,
  )

  const categoryBalanceSingle = useQuery(
    api.balanceSnapshots.listDailyCategoryBalance,
    singleProfileId ? { profileId: singleProfileId, startTimestamp } : 'skip',
  )
  const categoryBalanceAll = useQuery(
    api.balanceSnapshots.listAllDailyCategoryBalance,
    isAllProfiles && workspaceId ? { workspaceId, startTimestamp } : 'skip',
  )
  const categoryBalances = isAllProfiles
    ? categoryBalanceAll
    : categoryBalanceSingle
  const formatCurrency = useFormatCurrency()
  const [dialogOpen, setDialogOpen] = React.useState(false)

  const bankAccounts = React.useMemo(() => {
    if (!allBankAccounts) return undefined
    const active = allBankAccounts.filter((a) => !a.deleted && !a.disabled)
    if (!categoryFilter) return active
    const types = new Set(ACCOUNT_CATEGORIES[categoryFilter].types)
    return active.filter((a) => types.has(a.type ?? ''))
  }, [allBankAccounts, categoryFilter])

  // Group accounts by category
  const groupedByCategory = React.useMemo(() => {
    if (!bankAccounts) return []
    const map = new Map<string, typeof bankAccounts>()
    for (const acct of bankAccounts) {
      const key = getCategoryKey(acct.type)
      const list = map.get(key) ?? []
      list.push(acct)
      map.set(key, list)
    }
    // Sort by ACCOUNT_CATEGORIES order
    const order = Object.keys(ACCOUNT_CATEGORIES)
    return [...map.entries()].sort(
      ([a], [b]) => order.indexOf(a) - order.indexOf(b),
    )
  }, [bankAccounts])

  // Set of active category keys based on visible bank accounts
  const activeCategoryKeys = React.useMemo(() => {
    if (!bankAccounts) return new Set<string>()
    return new Set(bankAccounts.map((a) => getCategoryKey(a.type)))
  }, [bankAccounts])

  // Filter category balances to only include visible categories
  const filteredCategoryBalances = React.useMemo(() => {
    if (!categoryBalances) return undefined
    if (!categoryFilter) return categoryBalances
    return categoryBalances.filter((s) => s.category === categoryFilter)
  }, [categoryBalances, categoryFilter])

  // Aggregate chart data across visible categories (flat, for PnL computation)
  const chartData = React.useMemo(() => {
    if (!filteredCategoryBalances) return []
    const dateMap = new Map<string, number>()
    for (const s of filteredCategoryBalances) {
      if (activeCategoryKeys.has(s.category)) {
        dateMap.set(s.date, (dateMap.get(s.date) ?? 0) + s.balance)
      }
    }
    const sorted = [...dateMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, balance]) => ({ date, balance }))
    return fillMissingDates(sorted)
  }, [filteredCategoryBalances, activeCategoryKeys])

  // Stacked chart data: one key per category
  const stackedChartData = React.useMemo(() => {
    if (!filteredCategoryBalances) return []
    const dateMap = new Map<string, Record<string, number>>()
    for (const s of filteredCategoryBalances) {
      if (!activeCategoryKeys.has(s.category)) continue
      const entry = dateMap.get(s.date) ?? {}
      entry[s.category] = (entry[s.category] ?? 0) + s.balance
      dateMap.set(s.date, entry)
    }
    const sorted = [...dateMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, values]) => {
        const row: Record<string, string | number> = { date }
        for (const key of activeCategoryKeys) {
          row[key] = values[key] ?? 0
        }
        return row
      })
    return fillMissingDatesStacked(sorted)
  }, [filteredCategoryBalances, activeCategoryKeys])

  // Category series config for the stacked chart
  const categoryColors: Record<string, string> = {
    checking: 'var(--color-chart-1)',
    savings: 'var(--color-chart-2)',
    investments: 'var(--color-chart-3)',
    insurance: 'var(--color-chart-4)',
  }

  const activeCategorySeries = React.useMemo(() => {
    return Object.entries(ACCOUNT_CATEGORIES)
      .filter(([key]) => activeCategoryKeys.has(key))
      .map(([key, cat]) => ({
        key,
        label: cat.label,
        color: categoryColors[key] ?? 'var(--color-chart-5)',
      }))
  }, [activeCategoryKeys])

  if (profileLoading || bankAccounts === undefined) {
    return (
      <>
        <Skeleton className="h-[250px] w-full" />
        <Skeleton className="h-7 w-40" />
        <ItemGroup className="rounded-lg border">
          {[1, 2, 3].map((i) => (
            <React.Fragment key={i}>
              {i > 1 && <ItemSeparator />}
              <Item>
                <Skeleton className="size-8 rounded-sm" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-6 w-20" />
              </Item>
            </React.Fragment>
          ))}
        </ItemGroup>
      </>
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
              by adding a connection.
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

  const totalBalance = bankAccounts.reduce((sum, a) => sum + a.balance, 0)
  const currency = bankAccounts[0]?.currency ?? 'EUR'
  const aggregatePnl = computePnL(chartData)

  const formattedTotal = formatCurrency(totalBalance, currency)

  return (
    <>
      {categoryFilter ? (
        <BalanceChart
          data={chartData}
          currency={currency}
          isLoading={categoryBalances === undefined}
          period={period}
          onPeriodChange={setPeriod}
          title={
            categoryFilter && ACCOUNT_CATEGORIES[categoryFilter].label
              ? ACCOUNT_CATEGORIES[categoryFilter].label
              : 'Accounts'
          }
          description={formattedTotal}
        />
      ) : (
        <StackedBalanceChart
          data={stackedChartData}
          categories={activeCategorySeries}
          currency={currency}
          isLoading={categoryBalances === undefined}
          period={period}
          onPeriodChange={setPeriod}
          title="Accounts"
          description={formattedTotal}
          pnl={aggregatePnl}
        />
      )}

      <div className="space-y-6">
        {groupedByCategory.map(([categoryKey, accounts]) => {
          const cat = ACCOUNT_CATEGORIES[categoryKey]
          const CategoryIcon = cat.icon

          return (
            <div key={categoryKey} className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <CategoryIcon className="size-4" />
                {cat.label}
                <span>({accounts.length})</span>
              </h3>
              <ItemGroup className="rounded-lg border">
                {accounts.map((account, i) => (
                  <React.Fragment key={account._id}>
                    {i > 0 && <ItemSeparator />}
                    <Link
                      to="/accounts/$accountId"
                      params={{ accountId: account._id }}
                    >
                      <Item className="cursor-pointer hover:bg-muted/50">
                        <ItemMedia variant="icon">
                          <Landmark />
                        </ItemMedia>
                        <ItemContent>
                          <ItemTitle>
                            {account.connectorName ?? account.name}
                          </ItemTitle>
                          <ItemDescription>
                            {account.iban
                              ? account.iban.replace(/(.{4})/g, '$1 ').trim()
                              : (account.number ?? '')}
                          </ItemDescription>
                        </ItemContent>
                        <span className="text-lg font-semibold tabular-nums">
                          {formatCurrency(account.balance, account.currency)}
                        </span>
                      </Item>
                    </Link>
                  </React.Fragment>
                ))}
              </ItemGroup>
            </div>
          )
        })}
      </div>
    </>
  )
}
