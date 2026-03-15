import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { getAuthUserId } from './lib/auth'

async function getCurrentMember(ctx: { db: any; auth: any }) {
  const userId = await getAuthUserId(ctx as any)
  if (!userId) return null
  return await ctx.db
    .query('workspaceMembers')
    .withIndex('by_userId', (q: any) => q.eq('userId', userId))
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
    ])

    await ctx.db.delete('portfolios', args.portfolioId)
  },
})
