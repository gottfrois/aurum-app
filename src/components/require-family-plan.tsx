import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'

export function RequireFamilyPlan({
  children,
  fallback,
}: {
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  const subscription = useQuery(api.billing.getSubscriptionStatus)

  if (subscription === undefined) return null
  if (subscription?.plan !== 'family') return fallback ?? null

  return children
}
