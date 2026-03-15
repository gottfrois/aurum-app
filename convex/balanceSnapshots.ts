import { v } from 'convex/values'
import { query } from './_generated/server'
import { getAuthUserId } from './lib/auth'

export const listSnapshots = query({
  args: {
    bankAccountId: v.id('bankAccounts'),
    startTimestamp: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []
    return await ctx.db
      .query('balanceSnapshots')
      .withIndex('by_bankAccountId_timestamp', (q) =>
        q
          .eq('bankAccountId', args.bankAccountId)
          .gte('timestamp', args.startTimestamp),
      )
      .collect()
  },
})

export const listSnapshotsByPortfolio = query({
  args: {
    portfolioId: v.id('portfolios'),
    startTimestamp: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []
    return await ctx.db
      .query('balanceSnapshots')
      .withIndex('by_portfolioId_timestamp', (q) =>
        q
          .eq('portfolioId', args.portfolioId)
          .gte('timestamp', args.startTimestamp),
      )
      .collect()
  },
})

export const listAllSnapshotsByPortfolios = query({
  args: {
    portfolioIds: v.array(v.id('portfolios')),
    startTimestamp: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []
    const results = await Promise.all(
      args.portfolioIds.map((portfolioId) =>
        ctx.db
          .query('balanceSnapshots')
          .withIndex('by_portfolioId_timestamp', (q) =>
            q
              .eq('portfolioId', portfolioId)
              .gte('timestamp', args.startTimestamp),
          )
          .collect(),
      ),
    )
    return results.flat()
  },
})

export const listDailyNetWorth = query({
  args: {
    portfolioId: v.id('portfolios'),
    startTimestamp: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []
    return await ctx.db
      .query('dailyNetWorth')
      .withIndex('by_portfolioId_timestamp', (q) =>
        q
          .eq('portfolioId', args.portfolioId)
          .gte('timestamp', args.startTimestamp),
      )
      .collect()
  },
})

export const listAllDailyNetWorth = query({
  args: {
    workspaceId: v.id('workspaces'),
    startTimestamp: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []
    return await ctx.db
      .query('dailyNetWorth')
      .withIndex('by_workspaceId_timestamp', (q) =>
        q
          .eq('workspaceId', args.workspaceId)
          .gte('timestamp', args.startTimestamp),
      )
      .collect()
  },
})

export const listDailyCategoryBalance = query({
  args: {
    portfolioId: v.id('portfolios'),
    startTimestamp: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []
    return await ctx.db
      .query('dailyCategoryBalance')
      .withIndex('by_portfolioId_timestamp', (q) =>
        q
          .eq('portfolioId', args.portfolioId)
          .gte('timestamp', args.startTimestamp),
      )
      .collect()
  },
})

export const listAllDailyCategoryBalance = query({
  args: {
    workspaceId: v.id('workspaces'),
    startTimestamp: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []
    return await ctx.db
      .query('dailyCategoryBalance')
      .withIndex('by_workspaceId_timestamp', (q) =>
        q
          .eq('workspaceId', args.workspaceId)
          .gte('timestamp', args.startTimestamp),
      )
      .collect()
  },
})
