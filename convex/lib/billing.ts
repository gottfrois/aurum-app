import { components } from '../_generated/api'
import type { Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { PLANS, type PlanKey } from '../stripe'

export interface SubscriptionStatus {
  isActive: boolean
  isTrial: boolean
  trialEndsAt: number | null
  renewsAt: number | null
  plan: PlanKey | null
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
  plan: null,
  seats: 0,
  interval: null,
  amount: null,
  currency: null,
  subscriptionId: null,
  cancelAtPeriodEnd: false,
}

/** Map Stripe price IDs (from env) to plan + interval */
function resolvePriceId(priceId: string): {
  plan: PlanKey
  interval: 'monthly' | 'yearly'
} | null {
  const priceMap: Record<
    string,
    { plan: PlanKey; interval: 'monthly' | 'yearly' }
  > = {
    [process.env.STRIPE_SOLO_MONTHLY_PRICE_ID ?? '']: {
      plan: 'solo',
      interval: 'monthly',
    },
    [process.env.STRIPE_SOLO_YEARLY_PRICE_ID ?? '']: {
      plan: 'solo',
      interval: 'yearly',
    },
    [process.env.STRIPE_DUO_MONTHLY_PRICE_ID ?? '']: {
      plan: 'duo',
      interval: 'monthly',
    },
    [process.env.STRIPE_DUO_YEARLY_PRICE_ID ?? '']: {
      plan: 'duo',
      interval: 'yearly',
    },
    [process.env.STRIPE_TEAM_MONTHLY_PRICE_ID ?? '']: {
      plan: 'team',
      interval: 'monthly',
    },
    [process.env.STRIPE_TEAM_YEARLY_PRICE_ID ?? '']: {
      plan: 'team',
      interval: 'yearly',
    },
  }
  return priceMap[priceId] ?? null
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
    // Dev override: set DEV_PLAN_OVERRIDE=team in Convex env to bypass Stripe
    const devPlan = process.env.DEV_PLAN_OVERRIDE as PlanKey | undefined
    if (devPlan && devPlan in PLANS) {
      return {
        isActive: true,
        isTrial: false,
        trialEndsAt: null,
        renewsAt: null,
        plan: devPlan,
        seats: PLANS[devPlan].seats,
        interval: 'monthly',
        amount: null,
        currency: null,
        subscriptionId: null,
        cancelAtPeriodEnd: false,
      }
    }
    return NO_SUBSCRIPTION
  }

  const isTrial = subscription.status === 'trialing'
  const trialEndsAt = isTrial ? subscription.currentPeriodEnd * 1000 : null
  const renewsAt = subscription.currentPeriodEnd * 1000

  const resolved = resolvePriceId(subscription.priceId)
  const plan = resolved?.plan ?? 'solo'
  const interval = resolved?.interval ?? 'monthly'

  return {
    isActive: true,
    isTrial,
    trialEndsAt,
    renewsAt,
    plan,
    seats: PLANS[plan].seats,
    interval,
    amount: null,
    currency: null,
    subscriptionId: subscription.stripeSubscriptionId,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
  }
}

/** Verify that the workspace has an active Team plan. Throws if not. */
export async function requireTeamPlan(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<'workspaces'>,
): Promise<void> {
  const owner = await ctx.db
    .query('workspaceMembers')
    .withIndex('by_workspaceId', (q) => q.eq('workspaceId', workspaceId))
    .filter((q) => q.eq(q.field('role'), 'owner'))
    .first()
  if (!owner) throw new Error('Workspace owner not found')
  const subscription = await getWorkspaceSubscription(
    ctx as QueryCtx,
    owner.userId,
  )
  if (subscription.plan !== 'team') {
    throw new Error('Team plan required')
  }
}
