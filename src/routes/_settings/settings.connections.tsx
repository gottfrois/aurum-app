import { createFileRoute } from '@tanstack/react-router'
import { useAction, useQuery } from 'convex/react'
import { ChevronDown, Link2, Loader2, Pencil, Trash2 } from 'lucide-react'
import * as React from 'react'
import { AddConnectionDialog } from '~/components/add-connection-dialog'
import { ConfirmDialog } from '~/components/confirm-dialog'
import {
  ItemCard,
  ItemCardHeader,
  ItemCardHeaderContent,
  ItemCardHeaderTitle,
  ItemCardItem,
  ItemCardItemAction,
  ItemCardItemContent,
  ItemCardItemDescription,
  ItemCardItems,
  ItemCardItemTitle,
} from '~/components/item-card'
import { Button } from '~/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '~/components/ui/empty'
import { Skeleton } from '~/components/ui/skeleton'
import { usePortfolio } from '~/contexts/portfolio-context'
import { useCachedDecryptRecords } from '~/hooks/use-cached-decrypt'
import { api } from '../../../convex/_generated/api'
import type { Doc } from '../../../convex/_generated/dataModel'

type DecryptedConnection = Doc<'connections'> & {
  connectorName?: string
}

export const Route = createFileRoute('/_settings/settings/connections')({
  component: ConnectionsPage,
})

function ConnectionsPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-10 py-16">
      <header>
        <h1 className="text-3xl font-semibold">Connections</h1>
      </header>
      <div className="mt-8 space-y-6">
        <ConnectionsList />
      </div>
    </div>
  )
}

function getConnectionState(state?: string | null): {
  label: string
  dotColor: string
} {
  switch (state) {
    case null:
    case undefined:
    case 'SyncDone':
      return { label: 'Connected', dotColor: 'bg-emerald-500' }
    case 'SCARequired':
    case 'additionalInformationNeeded':
    case 'decoupled':
    case 'webauthRequired':
      return { label: 'Action needed', dotColor: 'bg-amber-500' }
    case 'validating':
      return { label: 'Syncing', dotColor: 'bg-blue-500' }
    case 'wrongpass':
    case 'bug':
      return { label: 'Error', dotColor: 'bg-destructive' }
    case 'rateLimiting':
      return { label: 'Rate limited', dotColor: 'bg-amber-500' }
    default:
      return { label: 'Unknown', dotColor: 'bg-muted-foreground' }
  }
}

function ConnectionsList() {
  const {
    isLoading: portfolioLoading,
    isAllPortfolios,
    allPortfolioIds,
    singlePortfolioId,
  } = usePortfolio()

  const connectionsSingle = useQuery(
    api.powens.listConnections,
    singlePortfolioId ? { portfolioId: singlePortfolioId } : 'skip',
  )
  const connectionsAll = useQuery(
    api.powens.listAllConnections,
    isAllPortfolios && allPortfolioIds.length > 0
      ? { portfolioIds: allPortfolioIds }
      : 'skip',
  )
  const rawConnections = isAllPortfolios ? connectionsAll : connectionsSingle
  const connections = useCachedDecryptRecords('connections', rawConnections) as
    | DecryptedConnection[]
    | undefined

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
  const bankAccounts = isAllPortfolios ? bankAccountsAll : bankAccountsSingle
  const [dialogOpen, setDialogOpen] = React.useState(false)

  if (portfolioLoading || connections === undefined) {
    return <Skeleton className="h-48 w-full rounded-lg" />
  }

  if (connections.length === 0) {
    return (
      <>
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Link2 />
            </EmptyMedia>
            <EmptyTitle>No Connections Yet</EmptyTitle>
            <EmptyDescription>
              You haven&apos;t added any connections yet. Get started by
              connecting your first financial institution.
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

  // Count bank accounts per connection
  const accountCountByConnection = new Map<string, number>()
  for (const ba of bankAccounts ?? []) {
    if (!ba.deleted) {
      const count = accountCountByConnection.get(ba.connectionId) ?? 0
      accountCountByConnection.set(ba.connectionId, count + 1)
    }
  }

  return (
    <>
      <ItemCard>
        <ItemCardHeader>
          <ItemCardHeaderContent>
            <ItemCardHeaderTitle>
              {connections.length}{' '}
              {connections.length === 1 ? 'connection' : 'connections'}
            </ItemCardHeaderTitle>
          </ItemCardHeaderContent>
          <Button onClick={() => setDialogOpen(true)} size="sm">
            Add Connection
          </Button>
        </ItemCardHeader>
        <ItemCardItems>
          {connections.map((connection) => {
            const numAccounts =
              accountCountByConnection.get(connection._id) ?? 0
            const lastSync = connection.lastSync
              ? formatRelativeDate(connection.lastSync)
              : null

            return (
              <ConnectionItem
                key={connection._id}
                connection={connection}
                numAccounts={numAccounts}
                lastSync={lastSync}
              />
            )
          })}
        </ItemCardItems>
      </ItemCard>
      <AddConnectionDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  )
}

function ConnectionItem({
  connection,
  numAccounts,
  lastSync,
}: {
  connection: DecryptedConnection
  numAccounts: number
  lastSync: string | null
}) {
  const deleteConnection = useAction(api.powens.deleteConnection)
  const generateManageUrl = useAction(api.powens.generateManageUrl)
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  const [editing, setEditing] = React.useState(false)

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteConnection({
        connectionId: connection._id,
        portfolioId: connection.portfolioId,
      })
      setConfirmOpen(false)
    } catch (err) {
      console.error('Failed to delete connection:', err)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <ItemCardItem>
        <ItemCardItemContent>
          <ItemCardItemTitle>{connection.connectorName}</ItemCardItemTitle>
          <ItemCardItemDescription>
            {numAccounts} account{numAccounts !== 1 ? 's' : ''}
            {lastSync && ` · Last synced ${lastSync}`}
          </ItemCardItemDescription>
        </ItemCardItemContent>
        <ItemCardItemAction>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent">
                <span
                  className={`size-2 shrink-0 rounded-full ${getConnectionState(connection.state).dotColor}`}
                />
                {getConnectionState(connection.state).label}
                <ChevronDown className="size-3 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                disabled={editing}
                onClick={async () => {
                  setEditing(true)
                  try {
                    const url = await generateManageUrl({
                      connectionId: connection._id,
                      portfolioId: connection.portfolioId,
                    })
                    window.location.href = url
                  } catch (err) {
                    console.error('Failed to generate manage URL:', err)
                    setEditing(false)
                  }
                }}
              >
                {editing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Pencil className="size-4" />
                )}
                Manage
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setConfirmOpen(true)}
              >
                <Trash2 className="size-4" />
                Disconnect
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </ItemCardItemAction>
      </ItemCardItem>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Disconnect ${connection.connectorName}?`}
        description="This will remove the connection and all associated bank accounts. You can reconnect later."
        confirmValue={connection.connectorName}
        confirmLabel="Disconnect"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </>
  )
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr.replace(' ', 'T'))
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('fr-FR')
}
