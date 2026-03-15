import { v } from 'convex/values'
import { query } from './_generated/server'
import { getAuthUserId } from './lib/auth'

export const listInvestments = query({
  args: { bankAccountId: v.id('bankAccounts') },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []
    return (
      await ctx.db
        .query('investments')
        .withIndex('by_bankAccountId', (q) =>
          q.eq('bankAccountId', args.bankAccountId),
        )
        .collect()
    ).filter((inv) => !inv.deleted)
  },
})

export const listInvestmentsByPortfolio = query({
  args: { portfolioId: v.id('portfolios') },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []
    return (
      await ctx.db
        .query('investments')
        .withIndex('by_portfolioId', (q) =>
          q.eq('portfolioId', args.portfolioId),
        )
        .collect()
    ).filter((inv) => !inv.deleted)
  },
})

export const listAllInvestmentsByPortfolios = query({
  args: { portfolioIds: v.array(v.id('portfolios')) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []
    const results = await Promise.all(
      args.portfolioIds.map((portfolioId) =>
        ctx.db
          .query('investments')
          .withIndex('by_portfolioId', (q) => q.eq('portfolioId', portfolioId))
          .collect(),
      ),
    )
    return results.flat().filter((inv) => !inv.deleted)
  },
})
