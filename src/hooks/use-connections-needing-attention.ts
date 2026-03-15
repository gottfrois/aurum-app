import { useQuery } from 'convex/react'
import { usePortfolio } from '~/contexts/portfolio-context'
import { useCachedDecryptRecords } from '~/hooks/use-cached-decrypt'
import { isConnectionStateActionNeeded } from '~/lib/connection-states'
import { api } from '../../convex/_generated/api'
import type { Doc } from '../../convex/_generated/dataModel'

type DecryptedConnection = Doc<'connections'> & {
  connectorName?: string
}

interface ConnectionsNeedingAttention {
  /** Connections that need user action (re-auth, error, etc.) */
  connections: Array<DecryptedConnection>
  /** Number of connections needing attention */
  count: number
  /** Whether the data is still loading */
  isLoading: boolean
}

/**
 * Hook that returns connections needing user attention across all active portfolios.
 * Reusable across banner, sidebar badge, and inline alerts.
 */
export function useConnectionsNeedingAttention(): ConnectionsNeedingAttention {
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
  const isLoading = portfolioLoading || connections === undefined

  const problemConnections = (connections ?? []).filter((c) =>
    isConnectionStateActionNeeded(c.state),
  )

  return {
    connections: problemConnections,
    count: problemConnections.length,
    isLoading,
  }
}
