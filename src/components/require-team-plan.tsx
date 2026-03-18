import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'

export function RequireTeamPlan({
  children,
  fallback,
}: {
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  const subscription = useQuery(api.billing.getSubscriptionStatus)

  if (subscription === undefined) return null
  if (subscription?.plan !== 'team') return fallback ?? null

  return children
}
