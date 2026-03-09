import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { getAuthUserId, requireAuthUserId } from './lib/auth'

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

export const updateTransactionCategory = mutation({
  args: {
    transactionId: v.id('transactions'),
    categoryKey: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx)

    const transaction = await ctx.db.get('transactions', args.transactionId)
    if (!transaction) throw new Error('Transaction not found')

    const profile = await ctx.db.get('profiles', transaction.profileId)
    if (!profile) throw new Error('Profile not found')

    const member = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!member || member.workspaceId !== profile.workspaceId) {
      throw new Error('Not authorized')
    }

    await ctx.db.patch('transactions', args.transactionId, {
      userCategoryKey: args.categoryKey,
    })
  },
})
