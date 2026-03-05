import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
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
  ItemActions,
  ItemSeparator,
} from '~/components/ui/item'
import { Skeleton } from '~/components/ui/skeleton'
import { Badge } from '~/components/ui/badge'
import type { Id } from '../../../convex/_generated/dataModel'

export const Route = createFileRoute('/_app/accounts')({
  component: AccountsPage,
})

function AccountsPage() {
  return (
    <>
      <SiteHeader title="Accounts" />
      <div className="flex flex-1 flex-col">
        <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
          <BankAccountsList />
        </div>
      </div>
    </>
  )
}

function BankAccountsList() {
  const { activeProfileId, isLoading: profileLoading } = useProfile()
  const bankAccounts = useQuery(
    api.powens.listBankAccounts,
    activeProfileId ? { profileId: activeProfileId } : 'skip',
  )
  const connections = useQuery(
    api.powens.listConnections,
    activeProfileId ? { profileId: activeProfileId } : 'skip',
  )
  const [dialogOpen, setDialogOpen] = React.useState(false)

  if (profileLoading || bankAccounts === undefined) {
    return (
      <>
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

  const connectionMap = new Map(
    (connections ?? []).map((c) => [c._id, c]),
  )

  // Group bank accounts by connection
  const grouped = new Map<Id<'connections'>, typeof bankAccounts>()
  for (const acct of bankAccounts.filter((a) => !a.deleted)) {
    const list = grouped.get(acct.connectionId) ?? []
    list.push(acct)
    grouped.set(acct.connectionId, list)
  }

  return (
    <>
      <h2 className="text-lg font-semibold">
        Bank Accounts
        <span className="ml-2 text-sm font-normal text-muted-foreground">
          ({bankAccounts.filter((a) => !a.deleted && !a.disabled).length})
        </span>
      </h2>

      <div className="space-y-6">
        {[...grouped.entries()].map(([connectionId, accounts]) => {
          const connection = connectionMap.get(connectionId)
          return (
            <div key={connectionId} className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">
                {connection?.connectorName ?? 'Unknown Bank'}
              </h3>
              <ItemGroup className="rounded-lg border">
                {accounts.map((account, i) => (
                  <React.Fragment key={account._id}>
                    {i > 0 && <ItemSeparator />}
                    <Item>
                      <ItemMedia variant="icon">
                        <Landmark />
                      </ItemMedia>
                      <ItemContent>
                        <ItemTitle>{account.name}</ItemTitle>
                        <ItemDescription>
                          {account.iban
                            ? account.iban.replace(/(.{4})/g, '$1 ').trim()
                            : account.number ?? ''}
                        </ItemDescription>
                      </ItemContent>
                      <ItemActions>
                        {account.disabled && (
                          <Badge variant="secondary">Disabled</Badge>
                        )}
                        <Badge variant="outline" className="uppercase">
                          {account.type ?? 'unknown'}
                        </Badge>
                        <span className="text-lg font-semibold tabular-nums">
                          {new Intl.NumberFormat('fr-FR', {
                            style: 'currency',
                            currency: account.currency,
                          }).format(account.balance)}
                        </span>
                      </ItemActions>
                    </Item>
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
