import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { Link2 } from 'lucide-react'
import {
  ItemCard,
  ItemCardHeader,
  ItemCardHeaderContent,
  ItemCardHeaderTitle,
  ItemCardItem,
  ItemCardItemContent,
  ItemCardItemDescription,
  ItemCardItems,
  ItemCardItemTitle,
} from '~/components/item-card'
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
import type { Doc, Id } from '../../../convex/_generated/dataModel'

type DecryptedConnection = Doc<'connections'> & {
  connectorName?: string
}

export const Route = createFileRoute(
  '/_settings/settings/portfolios/$id/connections',
)({
  component: PortfolioConnectionsPage,
})

function PortfolioConnectionsPage() {
  const { id } = Route.useParams()
  const portfolioId = id as Id<'portfolios'>
  const rawConnections = useQuery(api.powens.listConnections, { portfolioId })
  const connections = useCachedDecryptRecords('connections', rawConnections) as
    | DecryptedConnection[]
    | undefined

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-10 py-16">
      <PageHeader
        title="Connections"
        description="Bank connections linked to this portfolio."
      />
      <div className="mt-8 space-y-6">
        <ConnectionsList connections={connections} />
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

function ConnectionsList({
  connections,
}: {
  connections: DecryptedConnection[] | undefined
}) {
  if (connections === undefined) {
    return <Skeleton className="h-48 w-full rounded-lg" />
  }

  if (connections.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Link2 />
          </EmptyMedia>
          <EmptyTitle>No Connections</EmptyTitle>
          <EmptyDescription>
            This portfolio has no connections yet.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <ItemCard>
      <ItemCardHeader>
        <ItemCardHeaderContent>
          <ItemCardHeaderTitle>
            {connections.length}{' '}
            {connections.length === 1 ? 'connection' : 'connections'}
          </ItemCardHeaderTitle>
        </ItemCardHeaderContent>
      </ItemCardHeader>
      <ItemCardItems>
        {connections.map((connection) => {
          const { label, dotColor } = getConnectionState(connection.state)
          return (
            <ItemCardItem key={connection._id}>
              <ItemCardItemContent>
                <ItemCardItemTitle>
                  {connection.connectorName ??
                    `Connection #${connection.powensConnectionId}`}
                </ItemCardItemTitle>
                <ItemCardItemDescription>
                  <div className="flex items-center gap-1.5">
                    <span className={`size-2 rounded-full ${dotColor}`} />
                    {label}
                  </div>
                </ItemCardItemDescription>
              </ItemCardItemContent>
            </ItemCardItem>
          )
        })}
      </ItemCardItems>
    </ItemCard>
  )
}
