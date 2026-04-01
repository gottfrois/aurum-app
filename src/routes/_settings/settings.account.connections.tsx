import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAction, useQuery } from 'convex/react'
import { ChevronDown, Link2, Loader2 } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
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
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '~/components/ui/empty'
import { PageHeader } from '~/components/ui/page-header'
import { Skeleton } from '~/components/ui/skeleton'
import { useCachedDecryptRecords } from '~/hooks/use-cached-decrypt'
import { api } from '../../../convex/_generated/api'
import type { Doc } from '../../../convex/_generated/dataModel'

type DecryptedConnection = Doc<'connections'> & {
  connectorName?: string
}

export const Route = createFileRoute('/_settings/settings/account/connections')(
  {
    component: ConnectionsPage,
  },
)

function ConnectionsPage() {
  const { t } = useTranslation()
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-10 py-16">
      <PageHeader
        title={t('settings.connections.title')}
        description={t('settings.connections.description')}
      />
      <div className="mt-8 space-y-6">
        <ConnectionsList />
      </div>
    </div>
  )
}

function getConnectionState(
  state: string | null | undefined,
  t: (key: string) => string,
): {
  label: string
  dotColor: string
} {
  switch (state) {
    case null:
    case undefined:
    case 'SyncDone':
      return {
        label: t('settings.connections.statusConnected'),
        dotColor: 'bg-emerald-500',
      }
    case 'SCARequired':
    case 'additionalInformationNeeded':
    case 'decoupled':
    case 'webauthRequired':
      return {
        label: t('settings.connections.statusActionNeeded'),
        dotColor: 'bg-amber-500',
      }
    case 'validating':
      return {
        label: t('settings.connections.statusSyncing'),
        dotColor: 'bg-blue-500',
      }
    case 'wrongpass':
    case 'bug':
      return {
        label: t('settings.connections.statusError'),
        dotColor: 'bg-destructive',
      }
    case 'rateLimiting':
      return {
        label: t('settings.connections.statusRateLimited'),
        dotColor: 'bg-amber-500',
      }
    default:
      return {
        label: t('settings.connections.statusUnknown'),
        dotColor: 'bg-muted-foreground',
      }
  }
}

function ConnectionsList() {
  const { t } = useTranslation()
  const portfolios = useQuery(api.portfolios.listPortfolios)
  const portfolioIds = React.useMemo(
    () => portfolios?.map((p) => p._id) ?? [],
    [portfolios],
  )

  const rawConnections = useQuery(
    api.powens.listAllConnections,
    portfolioIds.length > 0 ? { portfolioIds } : 'skip',
  )
  const connections = useCachedDecryptRecords('connections', rawConnections) as
    | DecryptedConnection[]
    | undefined

  const bankAccounts = useQuery(
    api.powens.listAllBankAccounts,
    portfolioIds.length > 0 ? { portfolioIds } : 'skip',
  )

  if (portfolios === undefined || connections === undefined) {
    return <Skeleton className="h-48 w-full rounded-lg" />
  }

  if (connections.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Link2 />
          </EmptyMedia>
          <EmptyTitle>{t('settings.connections.empty')}</EmptyTitle>
          <EmptyDescription>
            {t('settings.connections.emptyDescription')}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
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
    <ItemCard>
      <ItemCardHeader>
        <ItemCardHeaderContent>
          <ItemCardHeaderTitle>
            {t('settings.connections.connection', {
              count: connections.length,
            })}
          </ItemCardHeaderTitle>
        </ItemCardHeaderContent>
      </ItemCardHeader>
      <ItemCardItems>
        {connections.map((connection) => {
          const numAccounts = accountCountByConnection.get(connection._id) ?? 0
          const lastSync = connection.lastSync
            ? formatRelativeDate(connection.lastSync, t)
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
  const { t } = useTranslation()
  const navigate = useNavigate()
  const deleteConnection = useAction(api.powens.deleteConnection)
  const generateManageUrl = useAction(api.powens.generateManageUrl)
  const syncConnection = useAction(api.powens.syncConnection)
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  const [editing, setEditing] = React.useState(false)
  const [syncing, setSyncing] = React.useState(false)

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
            {t('settings.connections.account', { count: numAccounts })}
            {lastSync && ` · Last synced ${lastSync}`}
          </ItemCardItemDescription>
        </ItemCardItemContent>
        <ItemCardItemAction>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={syncing}>
                {syncing ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {t('settings.connections.statusSyncing')}
                  </>
                ) : (
                  <>
                    <span
                      className={`size-2 shrink-0 rounded-full ${getConnectionState(connection.state, t).dotColor}`}
                    />
                    {getConnectionState(connection.state, t).label}
                    <ChevronDown className="size-4 text-muted-foreground" />
                  </>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={async () => {
                  setSyncing(true)
                  try {
                    await syncConnection({
                      connectionId: connection._id,
                      portfolioId: connection.portfolioId,
                    })
                  } catch (err) {
                    console.error('Failed to sync connection:', err)
                    toast.error(t('toast.failedSyncConnection'))
                  } finally {
                    setSyncing(false)
                  }
                }}
              >
                {t('settings.connections.sync')}
              </DropdownMenuItem>
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
                {editing && <Loader2 className="size-4 animate-spin" />}
                {t('settings.connections.manage')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  navigate({
                    to: '/settings/portfolios/$id/connections',
                    params: { id: connection.portfolioId },
                  })
                }
              >
                {t('settings.connections.renameAccounts')}
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setConfirmOpen(true)}
              >
                {t('settings.connections.disconnect')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </ItemCardItemAction>
      </ItemCardItem>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('settings.connections.disconnectConfirm', {
          name: connection.connectorName,
        })}
        description={t('settings.connections.disconnectDescription')}
        confirmValue={connection.connectorName}
        confirmLabel={t('settings.connections.disconnect')}
        loading={deleting}
        onConfirm={handleDelete}
      />
    </>
  )
}

function formatRelativeDate(
  dateStr: string,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  const date = new Date(dateStr.replace(' ', 'T'))
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return t('settings.connections.justNow')
  if (diffMins < 60)
    return t('settings.connections.minutesAgo', { count: diffMins })
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24)
    return t('settings.connections.hoursAgo', { count: diffHours })
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7)
    return t('settings.connections.daysAgo', { count: diffDays })
  return date.toLocaleDateString('fr-FR')
}
