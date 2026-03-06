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
