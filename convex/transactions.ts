import { v } from 'convex/values'
import { query } from './_generated/server'
import { getAuthUserId } from './lib/auth'

export const listTransactionsByProfile = query({
  args: {
    profileId: v.id('profiles'),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []

    const results = await ctx.db
      .query('transactions')
      .withIndex('by_profileId_date', (q) =>
        q
          .eq('profileId', args.profileId)
          .gte('date', args.startDate)
          .lte('date', args.endDate),
      )
      .collect()

    return results.filter((t) => !t.deleted)
  },
})

export const listAllTransactions = query({
  args: {
    profileIds: v.array(v.id('profiles')),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []

    const results = await Promise.all(
      args.profileIds.map((profileId) =>
        ctx.db
          .query('transactions')
          .withIndex('by_profileId', (q) => q.eq('profileId', profileId))
          .collect(),
      ),
    )

    return results.flat().filter((t) => !t.deleted)
  },
})

export const listAllTransactionsByProfiles = query({
  args: {
    profileIds: v.array(v.id('profiles')),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []

    const results = await Promise.all(
      args.profileIds.map((profileId) =>
        ctx.db
          .query('transactions')
          .withIndex('by_profileId_date', (q) =>
            q
              .eq('profileId', profileId)
              .gte('date', args.startDate)
              .lte('date', args.endDate),
          )
          .collect(),
      ),
    )

    return results.flat().filter((t) => !t.deleted)
  },
})
