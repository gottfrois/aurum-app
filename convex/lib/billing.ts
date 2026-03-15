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
    (s) => s.status === 'active' || s.status === 'trialing',
  )

  if (!subscription) {
    return NO_SUBSCRIPTION
  }

  const isTrial = subscription.status === 'trialing'
  const isActive = true

  // During trial, currentPeriodEnd is the trial end date
  const trialEndsAt = isTrial ? subscription.currentPeriodEnd * 1000 : null

  const renewsAt = subscription.currentPeriodEnd * 1000

  // Determine interval by comparing priceId against configured prices
  const monthlyPriceId = process.env.STRIPE_MONTHLY_PRICE_ID
  const interval: 'monthly' | 'yearly' | null =
    subscription.priceId === monthlyPriceId ? 'monthly' : 'yearly'

  return {
    isActive,
    isTrial,
    trialEndsAt,
    renewsAt,
    seats: subscription.quantity ?? 1,
    interval,
    amount: null,
    currency: null,
    subscriptionId: subscription.stripeSubscriptionId,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
  }
}
