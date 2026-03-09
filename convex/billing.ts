import { v } from 'convex/values'
import { action, internalQuery, query } from './_generated/server'
import { getAuthUserId, requireAuthUserId } from './lib/auth'
import { getWorkspaceSubscription } from './lib/billing'
import { polar } from './polar'

export const getSubscriptionStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null

    // Find the user's workspace membership
    const membership = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()

    if (!membership) return null

    // Find the workspace owner
    const ownerMembership = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_workspaceId', (q) =>
        q.eq('workspaceId', membership.workspaceId),
      )
      .filter((q) => q.eq(q.field('role'), 'owner'))
      .first()

    if (!ownerMembership) return null

    const status = await getWorkspaceSubscription(ctx, ownerMembership.userId)

    // Also return current seat usage for the UI
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

interface PolarDiscount {
  id: string
  name: string
  type: 'percentage' | 'fixed'
  amount: number
  duration: 'once' | 'repeating' | 'forever'
  duration_in_months: number | null
}

export const getDiscountDetails = action({
  args: { discountId: v.string() },
  handler: async (ctx, { discountId }) => {
    await requireAuthUserId(ctx)

    const token = process.env.POLAR_ORGANIZATION_TOKEN
    if (!token) return null

    const server = process.env.POLAR_SERVER ?? 'sandbox'
    const baseUrl =
      server === 'production'
        ? 'https://api.polar.sh'
        : 'https://sandbox-api.polar.sh'

    const res = await fetch(`${baseUrl}/v1/discounts/${discountId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) return null

    const data = (await res.json()) as PolarDiscount

    return {
      id: data.id,
      name: data.name,
      type: data.type,
      amount: data.amount,
      duration: data.duration,
      durationInMonths: data.duration_in_months,
    }
  },
})

interface PolarOrder {
  id: string
  created_at: string
  total_amount: number
  currency: string
  status: string
  product: { name: string } | null
}

interface PolarOrdersResponse {
  items: Array<PolarOrder>
}

export const listRecentOrders = action({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx)

    const customer = await polar.getCustomerByUserId(ctx, userId)
    if (!customer) return []

    const token = process.env.POLAR_ORGANIZATION_TOKEN
    if (!token) return []

    const server = process.env.POLAR_SERVER ?? 'sandbox'
    const baseUrl =
      server === 'production'
        ? 'https://api.polar.sh'
        : 'https://sandbox-api.polar.sh'

    const params = new URLSearchParams({
      customer_id: customer.id,
      limit: '3',
      sorting: '-created_at',
    })

    const res = await fetch(`${baseUrl}/v1/orders/?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) return []

    const data = (await res.json()) as PolarOrdersResponse

    return data.items.map((order) => ({
      id: order.id,
      createdAt: order.created_at,
      totalAmount: order.total_amount,
      currency: order.currency,
      status: order.status,
      productName: order.product?.name ?? 'Bunkr',
    }))
  },
})
