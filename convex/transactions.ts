import { v } from 'convex/values'
import { query } from './_generated/server'
import { getAuthUserId } from './lib/auth'

export const listTransactionsByProfile = query({
  args: {
    profileId: v.id('profiles'),
    startTimestamp: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []

    const q = ctx.db
      .query('transactions')
      .withIndex('by_profileId_date', (qb) =>
        qb.eq('profileId', args.profileId),
      )

    const results = await q.collect()

    let filtered = results.filter((t) => !t.deleted)

    if (args.startTimestamp) {
      const startDate = new Date(args.startTimestamp).toISOString().slice(0, 10)
      filtered = filtered.filter((t) => t.date >= startDate)
    }

    return filtered
  },
})

export const listAllTransactionsByProfiles = query({
  args: {
    profileIds: v.array(v.id('profiles')),
    startTimestamp: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []

    const results = await Promise.all(
      args.profileIds.map((profileId) =>
        ctx.db
          .query('transactions')
          .withIndex('by_profileId_date', (q) => q.eq('profileId', profileId))
          .collect(),
      ),
    )

    let filtered = results.flat().filter((t) => !t.deleted)

    if (args.startTimestamp) {
      const startDate = new Date(args.startTimestamp).toISOString().slice(0, 10)
      filtered = filtered.filter((t) => t.date >= startDate)
    }

    return filtered
  },
})
