import { PLAN_SEATS, polar } from '../polar'
import type { QueryCtx } from '../_generated/server'

export type PlanTier = 'solo' | 'team' | 'family'

export interface SubscriptionStatus {
  isActive: boolean
  isTrial: boolean
  trialEndsAt: number | null
  renewsAt: number | null
  seats: number
  tier: PlanTier | null
  interval: 'monthly' | 'yearly' | null
  productKey: string | null
  discountId: string | null
  amount: number | null
  currency: string | null
}

const NO_SUBSCRIPTION: SubscriptionStatus = {
  isActive: false,
  isTrial: false,
  trialEndsAt: null,
  renewsAt: null,
  seats: 0,
  tier: null,
  interval: null,
  productKey: null,
  discountId: null,
  amount: null,
  currency: null,
}

function getTierFromProductKey(productKey: string): PlanTier | null {
  if (productKey.startsWith('solo')) return 'solo'
  if (productKey.startsWith('team')) return 'team'
  if (productKey.startsWith('family')) return 'family'
  return null
}

function getIntervalFromProductKey(
  productKey: string,
): 'monthly' | 'yearly' | null {
  if (productKey.endsWith('Monthly')) return 'monthly'
  if (productKey.endsWith('Yearly')) return 'yearly'
  return null
}

export async function getWorkspaceSubscription(
  ctx: QueryCtx,
  ownerUserId: string,
): Promise<SubscriptionStatus> {
  const subscription = await polar.getCurrentSubscription(ctx, {
    userId: ownerUserId,
  })

  if (!subscription) {
    return NO_SUBSCRIPTION
  }

  const isTrial = subscription.status === 'trialing'
  const isActive =
    subscription.status === 'active' || subscription.status === 'trialing'

  const trialEndStr = isTrial
    ? (subscription.trialEnd ?? subscription.currentPeriodEnd ?? null)
    : null
  const trialEndsAt = trialEndStr ? new Date(trialEndStr).getTime() : null

  const periodEndStr = subscription.currentPeriodEnd ?? null
  const renewsAt = periodEndStr ? new Date(periodEndStr).getTime() : null

  const productKey = subscription.productKey ?? ''
  const seats = PLAN_SEATS[productKey] ?? 1

  return {
    isActive,
    isTrial,
    trialEndsAt,
    renewsAt,
    seats,
    tier: getTierFromProductKey(productKey),
    interval: getIntervalFromProductKey(productKey),
    productKey,
    discountId: subscription.discountId ?? null,
    amount: subscription.amount ?? null,
    currency: subscription.currency ?? null,
  }
}
