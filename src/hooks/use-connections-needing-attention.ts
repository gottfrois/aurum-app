import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Doc } from '../../convex/_generated/dataModel'
import { useProfile } from '~/contexts/profile-context'
import { isConnectionStateActionNeeded } from '~/lib/connection-states'

interface ConnectionsNeedingAttention {
  /** Connections that need user action (re-auth, error, etc.) */
  connections: Array<Doc<'connections'>>
  /** Number of connections needing attention */
  count: number
  /** Whether the data is still loading */
  isLoading: boolean
}

/**
 * Hook that returns connections needing user attention across all active profiles.
 * Reusable across banner, sidebar badge, and inline alerts.
 */
export function useConnectionsNeedingAttention(): ConnectionsNeedingAttention {
  const {
    isLoading: profileLoading,
    isAllProfiles,
    allProfileIds,
    singleProfileId,
  } = useProfile()

  const connectionsSingle = useQuery(
    api.powens.listConnections,
    singleProfileId ? { profileId: singleProfileId } : 'skip',
  )
  const connectionsAll = useQuery(
    api.powens.listAllConnections,
    isAllProfiles && allProfileIds.length > 0
      ? { profileIds: allProfileIds }
      : 'skip',
  )

  const rawConnections = isAllProfiles ? connectionsAll : connectionsSingle
  const isLoading = profileLoading || rawConnections === undefined

  const problemConnections = (rawConnections ?? []).filter((c) =>
    isConnectionStateActionNeeded(c.state),
  )

  return {
    connections: problemConnections,
    count: problemConnections.length,
    isLoading,
  }
}
