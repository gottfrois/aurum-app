import { v } from 'convex/values'
import { components, internal } from './_generated/api'
import { action, internalQuery, query } from './_generated/server'
import { getAuthUserId } from './lib/auth'
import { getWorkspaceSubscription } from './lib/billing'
import { stripe } from './stripe'

export const getSubscriptionStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null

    const membership = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()

    if (!membership) return null

    const ownerMembership = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_workspaceId', (q) =>
        q.eq('workspaceId', membership.workspaceId),
      )
      .filter((q) => q.eq(q.field('role'), 'owner'))
      .first()

    if (!ownerMembership) return null

    const status = await getWorkspaceSubscription(ctx, ownerMembership.userId)

    const members = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_workspaceId', (q) =>
        q.eq('workspaceId', membership.workspaceId),
      )
      .collect()

    const pendingInvitations = await ctx.db
      .query('workspaceInvitations')
      .withIndex('by_workspaceId', (q) =>
        q.eq('workspaceId', membership.workspaceId),
      )
      .filter((q) => q.eq(q.field('status'), 'pending'))
      .collect()

    return {
      ...status,
      currentSeats: members.length,
      pendingInvitations: pendingInvitations.length,
    }
  },
})

export const getOwnerSubscription = internalQuery({
  args: { ownerUserId: v.string() },
  handler: async (ctx, { ownerUserId }) => {
    return await getWorkspaceSubscription(ctx, ownerUserId)
  },
})

export const createCheckout = action({
  args: {
    interval: v.union(v.literal('monthly'), v.literal('yearly')),
  },
  handler: async (ctx, { interval }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    const customer = await stripe.getOrCreateCustomer(ctx, {
      userId: identity.subject,
      email: identity.email ?? undefined,
      name: identity.name ?? undefined,
    })

    const priceId =
      interval === 'monthly'
        ? process.env.STRIPE_MONTHLY_PRICE_ID!
        : process.env.STRIPE_YEARLY_PRICE_ID!

    const siteUrl = process.env.SITE_URL ?? 'http://localhost:3000'

    return await stripe.createCheckoutSession(ctx, {
      priceId,
      customerId: customer.customerId,
      mode: 'subscription',
      successUrl: `${siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${siteUrl}/checkout`,
      quantity: 1,
      subscriptionMetadata: {
        userId: identity.subject,
      },
    })
  },
})

export const createPortalSession = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    const membership = await ctx.runQuery(
      internal.members.getMembershipByUserId,
      { userId: identity.subject },
    )
    if (!membership || membership.role !== 'owner') {
      throw new Error('Only workspace owners can manage billing')
    }

    const customer = await stripe.getOrCreateCustomer(ctx, {
      userId: identity.subject,
      email: identity.email ?? undefined,
      name: identity.name ?? undefined,
    })

    const siteUrl = process.env.SITE_URL ?? 'http://localhost:3000'

    return await stripe.createCustomerPortalSession(ctx, {
      customerId: customer.customerId,
      returnUrl: `${siteUrl}/settings/workspace/billing`,
    })
  },
})

export const updateSeatCount = action({
  args: { seats: v.number() },
  handler: async (ctx, { seats }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    const membership = await ctx.runQuery(
      internal.members.getMembershipByUserId,
      { userId: identity.subject },
    )
    if (!membership || membership.role !== 'owner') {
      throw new Error('Only workspace owners can update seat count')
    }

    const subscriptions = await ctx.runQuery(
      components.stripe.public.listSubscriptionsByUserId,
      { userId: identity.subject },
    )

    const subscription = subscriptions.find(
      (s: { status: string }) =>
        s.status === 'active' || s.status === 'trialing',
    )

    if (!subscription?.stripeSubscriptionId) {
      throw new Error('No active subscription found')
    }

    await stripe.updateSubscriptionQuantity(ctx, {
      stripeSubscriptionId: subscription.stripeSubscriptionId,
      quantity: seats,
    })
  },
})

export const listRecentInvoices = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    const membership = await ctx.runQuery(
      internal.members.getMembershipByUserId,
      { userId: identity.subject },
    )
    if (!membership || membership.role !== 'owner') {
      throw new Error('Only workspace owners can view invoices')
    }

    const invoices = await ctx.runQuery(
      components.stripe.public.listInvoicesByUserId,
      { userId: identity.subject },
    )

    // Return the 3 most recent
    return invoices
      .slice(0, 3)
      .map(
        (invoice: {
          stripeInvoiceId?: string
          created?: number
          amountPaid?: number
          currency?: string
          status?: string
        }) => ({
          id: invoice.stripeInvoiceId ?? '',
          createdAt: invoice.created
            ? new Date(invoice.created * 1000).toISOString()
            : '',
          totalAmount: invoice.amountPaid ?? 0,
          currency: invoice.currency ?? 'eur',
          status: invoice.status ?? '',
        }),
      )
  },
})
