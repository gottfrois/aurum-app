import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useAction } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Doc } from '../../convex/_generated/dataModel'
import { AppSidebar } from '~/components/app-sidebar'
import { SiteHeader } from '~/components/site-header'
import { SidebarInset, SidebarProvider } from '~/components/ui/sidebar'
import { useProfile } from '~/contexts/profile-context'
import {
  Link2,
  CirclePlus,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  MoreVertical,
} from 'lucide-react'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'

export const Route = createFileRoute('/connections')({
  component: ConnectionsPage,
})

function ConnectionsPage() {
  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader title="Connections" />
        <div className="flex flex-1 flex-col">
          <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
            <ConnectionsList />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

function ConnectionStateBadge({ state }: { state?: string | null }) {
  if (!state) {
    return (
      <Badge variant="default" className="gap-1">
        <CheckCircle2 className="size-3" />
        Connected
      </Badge>
    )
  }

  switch (state) {
    case 'SCARequired':
    case 'additionalInformationNeeded':
    case 'decoupled':
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertCircle className="size-3" />
          Action needed
        </Badge>
      )
    case 'validating':
      return (
        <Badge variant="secondary" className="gap-1">
          <Loader2 className="size-3 animate-spin" />
          Syncing
        </Badge>
      )
    case 'wrongpass':
    case 'bug':
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertCircle className="size-3" />
          Error
        </Badge>
      )
    default:
      return (
        <Badge variant="secondary" className="gap-1">
          {state}
        </Badge>
      )
  }
}

function ConnectionsList() {
  const { activeProfileId, isLoading: profileLoading } = useProfile()
  const connections = useQuery(
    api.powens.listConnections,
    activeProfileId ? { profileId: activeProfileId } : 'skip',
  )
  const bankAccounts = useQuery(
    api.powens.listBankAccounts,
    activeProfileId ? { profileId: activeProfileId } : 'skip',
  )
  const [dialogOpen, setDialogOpen] = React.useState(false)

  if (profileLoading || connections === undefined) {
    return (
      <>
        <Skeleton className="h-7 w-40" />
        <ItemGroup className="rounded-lg border">
          {[1, 2].map((i) => (
            <React.Fragment key={i}>
              {i > 1 && <ItemSeparator />}
              <Item>
                <Skeleton className="size-8 rounded-sm" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
                <Skeleton className="h-6 w-24" />
              </Item>
            </React.Fragment>
          ))}
        </ItemGroup>
      </>
    )
  }

  if (connections.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-12 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-muted">
            <Link2 className="size-8 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">No connections yet</h3>
            <p className="text-sm text-muted-foreground">
              Connect your bank to start syncing your financial data.
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
      <h2 className="text-lg font-semibold">
        Connections
        <span className="ml-2 text-sm font-normal text-muted-foreground">
          ({connections.length})
        </span>
      </h2>

      <ItemGroup className="rounded-lg border">
        {connections.map((connection, i) => {
          const numAccounts =
            accountCountByConnection.get(connection._id) ?? 0
          const lastSync = connection.lastSync
            ? formatRelativeDate(connection.lastSync)
            : null

          return (
            <React.Fragment key={connection._id}>
              {i > 0 && <ItemSeparator />}
              <ConnectionItem
                connection={connection}
                numAccounts={numAccounts}
                lastSync={lastSync}
              />
            </React.Fragment>
          )
        })}
      </ItemGroup>
    </>
  )
}

function ConnectionItem({
  connection,
  numAccounts,
  lastSync,
}: {
  connection: Doc<'connections'>
  numAccounts: number
  lastSync: string | null
}) {
  const { activeProfileId } = useProfile()
  const deleteConnection = useAction(api.powens.deleteConnection)
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)

  async function handleDelete() {
    if (!activeProfileId) return
    setDeleting(true)
    try {
      await deleteConnection({
        connectionId: connection._id,
        profileId: activeProfileId,
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
      <Item>
        <ItemMedia variant="icon">
          <Link2 />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>{connection.connectorName}</ItemTitle>
          <ItemDescription>
            {numAccounts} account{numAccounts !== 1 ? 's' : ''}
            {lastSync && ` · Last synced ${lastSync}`}
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <ConnectionStateBadge state={connection.state} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8">
                <MoreVertical className="size-4" />
                <span className="sr-only">More</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setConfirmOpen(true)}
              >
                <Trash2 className="size-4" />
                Disconnect
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </ItemActions>
      </Item>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect {connection.connectorName}?</DialogTitle>
            <DialogDescription>
              This will remove the connection and all associated bank accounts.
              You can reconnect later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="mr-2 size-4 animate-spin" />}
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
