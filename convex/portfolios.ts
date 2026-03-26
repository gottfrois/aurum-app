import { v } from 'convex/values'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { mutation, query } from './_generated/server'
import { getAuthUserId } from './lib/auth'
import { requireTeamPlan } from './lib/billing'

async function getCurrentMember(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx)
  if (!userId) return null
  return await ctx.db
    .query('workspaceMembers')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .first()
}

export const listPortfolios = query({
  args: {},
  handler: async (ctx) => {
    const member = await getCurrentMember(ctx)
    if (!member) return []
    return await ctx.db
      .query('portfolios')
      .withIndex('by_memberId', (q) => q.eq('memberId', member._id))
      .collect()
  },
})

export const getPortfolio = query({
  args: { portfolioId: v.id('portfolios') },
  handler: async (ctx, args) => {
    const member = await getCurrentMember(ctx)
    if (!member) return null
    return await ctx.db.get('portfolios', args.portfolioId)
  },
})

export const createPortfolio = mutation({
  args: {
    name: v.string(),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const member = await getCurrentMember(ctx)
    if (!member) throw new Error('No workspace found')
    return await ctx.db.insert('portfolios', {
      workspaceId: member.workspaceId,
      memberId: member._id,
      name: args.name,
      icon: args.icon,
      shared: false,
      shareAmounts: true,
    })
  },
})

export const updatePortfolio = mutation({
  args: {
    portfolioId: v.id('portfolios'),
    name: v.optional(v.string()),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const member = await getCurrentMember(ctx)
    if (!member) throw new Error('No workspace found')
    const { portfolioId, ...updates } = args
    await ctx.db.patch('portfolios', portfolioId, updates)
  },
})

export const deletePortfolio = mutation({
  args: { portfolioId: v.id('portfolios') },
  handler: async (ctx, args) => {
    const member = await getCurrentMember(ctx)
    if (!member) throw new Error('No workspace found')
    const portfolios = await ctx.db
      .query('portfolios')
      .withIndex('by_memberId', (q) => q.eq('memberId', member._id))
      .collect()
    if (portfolios.length <= 1) {
      throw new Error('Cannot delete the last portfolio')
    }

    // Delete all associated data using portfolioId indexes (flat, no nesting)
    const [
      connections,
      bankAccounts,
      snapshots,
      investments,
      dailyNetWorth,
      dailyCategoryBalance,
      portfolioLabels,
      portfolioCategories,
    ] = await Promise.all([
      ctx.db
        .query('connections')
        .withIndex('by_portfolioId', (q) =>
          q.eq('portfolioId', args.portfolioId),
        )
        .collect(),
      ctx.db
        .query('bankAccounts')
        .withIndex('by_portfolioId', (q) =>
          q.eq('portfolioId', args.portfolioId),
        )
        .collect(),
      ctx.db
        .query('balanceSnapshots')
        .withIndex('by_portfolioId_timestamp', (q) =>
          q.eq('portfolioId', args.portfolioId),
        )
        .collect(),
      ctx.db
        .query('investments')
        .withIndex('by_portfolioId', (q) =>
          q.eq('portfolioId', args.portfolioId),
        )
        .collect(),
      ctx.db
        .query('dailyNetWorth')
        .withIndex('by_portfolioId_timestamp', (q) =>
          q.eq('portfolioId', args.portfolioId),
        )
        .collect(),
      ctx.db
        .query('dailyCategoryBalance')
        .withIndex('by_portfolioId_timestamp', (q) =>
          q.eq('portfolioId', args.portfolioId),
        )
        .collect(),
      ctx.db
        .query('transactionLabels')
        .withIndex('by_portfolioId', (q) =>
          q.eq('portfolioId', args.portfolioId),
        )
        .collect(),
      ctx.db
        .query('transactionCategories')
        .withIndex('by_portfolioId', (q) =>
          q.eq('portfolioId', args.portfolioId),
        )
        .collect(),
    ])
    await Promise.all([
      ...snapshots.map((s) => ctx.db.delete('balanceSnapshots', s._id)),
      ...investments.map((inv) => ctx.db.delete('investments', inv._id)),
      ...bankAccounts.map((ba) => ctx.db.delete('bankAccounts', ba._id)),
      ...connections.map((c) => ctx.db.delete('connections', c._id)),
      ...dailyNetWorth.map((d) => ctx.db.delete('dailyNetWorth', d._id)),
      ...dailyCategoryBalance.map((d) =>
        ctx.db.delete('dailyCategoryBalance', d._id),
      ),
      ...portfolioLabels.map((l) => ctx.db.delete('transactionLabels', l._id)),
      ...portfolioCategories.map((c) =>
        ctx.db.delete('transactionCategories', c._id),
      ),
    ])

    await ctx.db.delete('portfolios', args.portfolioId)
  },
})

export const listPortfolioSharing = query({
  args: {},
  handler: async (ctx) => {
    const member = await getCurrentMember(ctx)
    if (!member) return []
    const portfolios = await ctx.db
      .query('portfolios')
      .withIndex('by_memberId', (q) => q.eq('memberId', member._id))
      .collect()
    return portfolios.map((p) => ({
      _id: p._id,
      name: p.name,
      icon: p.icon,
      shared: p.shared ?? false,
      shareAmounts: p.shareAmounts ?? true,
    }))
  },
})

export const updatePortfolioSharing = mutation({
  args: {
    portfolioId: v.id('portfolios'),
    shared: v.optional(v.boolean()),
    shareAmounts: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const member = await getCurrentMember(ctx)
    if (!member) throw new Error('No workspace found')

    const portfolio = await ctx.db.get('portfolios', args.portfolioId)
    if (!portfolio || portfolio.memberId !== member._id) {
      throw new Error('Portfolio not found or not owned by you')
    }

    await requireTeamPlan(ctx, member.workspaceId)

    const updates: Record<string, boolean> = {}
    if (args.shared !== undefined) updates.shared = args.shared
    if (args.shareAmounts !== undefined)
      updates.shareAmounts = args.shareAmounts
    await ctx.db.patch('portfolios', args.portfolioId, updates)
  },
})
