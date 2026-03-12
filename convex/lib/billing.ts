import { components } from '../_generated/api'
import type { QueryCtx } from '../_generated/server'

export interface SubscriptionStatus {
  isActive: boolean
  isTrial: boolean
  trialEndsAt: number | null
  renewsAt: number | null
  seats: number
  interval: 'monthly' | 'yearly' | null
  amount: number | null
  currency: string | null
  subscriptionId: string | null
  cancelAtPeriodEnd: boolean
}

const NO_SUBSCRIPTION: SubscriptionStatus = {
  isActive: false,
  isTrial: false,
  trialEndsAt: null,
  renewsAt: null,
  seats: 0,
  interval: null,
  amount: null,
  currency: null,
  subscriptionId: null,
  cancelAtPeriodEnd: false,
}

export async function getWorkspaceSubscription(
  ctx: QueryCtx,
  ownerUserId: string,
): Promise<SubscriptionStatus> {
  const subscriptions = await ctx.runQuery(
    components.stripe.public.listSubscriptionsByUserId,
    { userId: ownerUserId },
  )

  // Find the first active or trialing subscription
  const subscription = subscriptions.find(
    (s: { status: string }) =>
      s.status === 'active' || s.status === 'trialing',
  )

  if (!subscription) {
    return NO_SUBSCRIPTION
  }

  const isTrial = subscription.status === 'trialing'
  const isActive = true

  const trialEndsAt =
    isTrial && subscription.trialEnd
      ? new Date(subscription.trialEnd * 1000).getTime()
      : null

  const renewsAt = subscription.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd * 1000).getTime()
    : null

  // Determine interval from the price's recurring interval
  const interval: 'monthly' | 'yearly' | null =
    subscription.interval === 'month'
      ? 'monthly'
      : subscription.interval === 'year'
        ? 'yearly'
        : null

  return {
    isActive,
    isTrial,
    trialEndsAt,
    renewsAt,
    seats: subscription.quantity ?? 1,
    interval,
    amount: subscription.amount ?? null,
    currency: subscription.currency ?? null,
    subscriptionId: subscription.stripeSubscriptionId ?? null,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd ?? false,
  }
}
