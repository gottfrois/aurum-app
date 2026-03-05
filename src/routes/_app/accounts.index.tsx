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
  Item,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemTitle,
  ItemDescription,
  ItemSeparator,
} from '~/components/ui/item'
import { Skeleton } from '~/components/ui/skeleton'
import { BalanceChart } from '~/components/balance-chart'
import { StackedBalanceChart } from '~/components/stacked-balance-chart'
import { type Period, getStartTimestamp } from '~/lib/chart-periods'
import { ACCOUNT_CATEGORIES, getCategoryKey } from '~/lib/account-categories'
import { computePnL } from '~/lib/pnl'
import { PnLBadge } from '~/components/pnl-badge'

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
  const { activeProfileId, isLoading: profileLoading } = useProfile()
  const [period, setPeriod] = React.useState<Period>('1M')
  const startTimestamp = React.useMemo(
    () => getStartTimestamp(period),
    [period],
  )
  const allBankAccounts = useQuery(
    api.powens.listBankAccounts,
    activeProfileId ? { profileId: activeProfileId } : 'skip',
  )
  const snapshots = useQuery(
    api.balanceSnapshots.listSnapshotsByProfile,
    activeProfileId ? { profileId: activeProfileId, startTimestamp } : 'skip',
  )
  const [dialogOpen, setDialogOpen] = React.useState(false)

  const bankAccounts = React.useMemo(() => {
    if (!allBankAccounts) return undefined
    const active = allBankAccounts.filter((a) => !a.deleted && !a.disabled)
    if (!categoryFilter) return active
    const cat = ACCOUNT_CATEGORIES[categoryFilter]
    if (!cat) return active
    const types = new Set(cat.types)
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

  // Build a map from bankAccountId -> categoryKey for visible accounts
  const accountCategoryMap = React.useMemo(() => {
    if (!bankAccounts) return new Map<string, string>()
    const map = new Map<string, string>()
    for (const a of bankAccounts) {
      map.set(a._id, getCategoryKey(a.type))
    }
    return map
  }, [bankAccounts])

  // Aggregate chart data across visible accounts (flat, for PnL computation)
  const chartData = React.useMemo(() => {
    if (!snapshots || !bankAccounts) return []
    const dateMap = new Map<string, number>()
    for (const s of snapshots) {
      if (accountCategoryMap.has(s.bankAccountId)) {
        dateMap.set(s.date, (dateMap.get(s.date) ?? 0) + s.balance)
      }
    }
    return [...dateMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, balance]) => ({ date, balance }))
  }, [snapshots, bankAccounts, accountCategoryMap])

  // Stacked chart data: one key per category
  const stackedChartData = React.useMemo(() => {
    if (!snapshots || !bankAccounts) return []
    const dateMap = new Map<string, Record<string, number>>()
    for (const s of snapshots) {
      const catKey = accountCategoryMap.get(s.bankAccountId)
      if (!catKey) continue
      const entry = dateMap.get(s.date) ?? {}
      entry[catKey] = (entry[catKey] ?? 0) + s.balance
      dateMap.set(s.date, entry)
    }
    const activeCategoryKeys = new Set(accountCategoryMap.values())
    return [...dateMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, values]) => {
        const row: Record<string, string | number> = { date }
        for (const key of activeCategoryKeys) {
          row[key] = values[key] ?? 0
        }
        return row
      })
  }, [snapshots, bankAccounts, accountCategoryMap])

  // Category series config for the stacked chart
  const categoryColors: Record<string, string> = {
    checking: 'var(--color-chart-1)',
    savings: 'var(--color-chart-2)',
    investments: 'var(--color-chart-3)',
    insurance: 'var(--color-chart-4)',
  }

  const activeCategorySeries = React.useMemo(() => {
    const activeKeys = new Set(accountCategoryMap.values())
    return Object.entries(ACCOUNT_CATEGORIES)
      .filter(([key]) => activeKeys.has(key))
      .map(([key, cat]) => ({
        key,
        label: cat.label,
        color: categoryColors[key] ?? 'var(--color-chart-5)',
      }))
  }, [accountCategoryMap])

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
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-12 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-muted">
            <Landmark className="size-8 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">No bank accounts yet</h3>
            <p className="text-sm text-muted-foreground">
              Connect a bank to see your accounts here.
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

  const totalBalance = bankAccounts.reduce((sum, a) => sum + a.balance, 0)
  const currency = bankAccounts[0]?.currency ?? 'EUR'
  const aggregatePnl = computePnL(chartData)

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <p className="text-3xl font-bold tabular-nums">
            {new Intl.NumberFormat('fr-FR', {
              style: 'currency',
              currency,
            }).format(totalBalance)}
          </p>
          <PnLBadge pnl={aggregatePnl} currency={currency} />
        </div>
      </div>

      {categoryFilter ? (
        <BalanceChart
          data={chartData}
          currency={currency}
          isLoading={snapshots === undefined}
          period={period}
          onPeriodChange={setPeriod}
        />
      ) : (
        <StackedBalanceChart
          data={stackedChartData}
          categories={activeCategorySeries}
          currency={currency}
          isLoading={snapshots === undefined}
          period={period}
          onPeriodChange={setPeriod}
        />
      )}

      <div className="space-y-6">
        {groupedByCategory.map(([categoryKey, accounts]) => {
          const cat = ACCOUNT_CATEGORIES[categoryKey]
          const CategoryIcon = cat?.icon ?? Landmark

          return (
            <div key={categoryKey} className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <CategoryIcon className="size-4" />
                {cat?.label ?? categoryKey}
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
                          <ItemTitle>{account.name}</ItemTitle>
                          <ItemDescription>
                            {account.iban
                              ? account.iban.replace(/(.{4})/g, '$1 ').trim()
                              : (account.number ?? '')}
                          </ItemDescription>
                        </ItemContent>
                        <span className="text-lg font-semibold tabular-nums">
                          {new Intl.NumberFormat('fr-FR', {
                            style: 'currency',
                            currency: account.currency,
                          }).format(account.balance)}
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
