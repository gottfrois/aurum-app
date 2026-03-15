import { v } from 'convex/values'
import {
  internalAction,
  internalMutation,
  mutation,
  query,
} from './_generated/server'
import { internal } from './_generated/api'
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

export const updateTransactionLabels = mutation({
  args: {
    transactionId: v.id('transactions'),
    labelIds: v.array(v.id('labels')),
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
      labelIds: args.labelIds,
    })
  },
})

export const batchUpdateTransactionLabels = mutation({
  args: {
    transactionIds: v.array(v.id('transactions')),
    addLabelIds: v.optional(v.array(v.id('labels'))),
    removeLabelIds: v.optional(v.array(v.id('labels'))),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx)

    const member = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!member) throw new Error('Not authorized')

    await ctx.scheduler.runAfter(
      0,
      internal.transactions.batchUpdateLabelsAsync,
      {
        transactionIds: args.transactionIds,
        addLabelIds: args.addLabelIds,
        removeLabelIds: args.removeLabelIds,
      },
    )
  },
})

const BATCH_CHUNK_SIZE = 100

export const batchUpdateLabelsAsync = internalAction({
  args: {
    transactionIds: v.array(v.id('transactions')),
    addLabelIds: v.optional(v.array(v.id('labels'))),
    removeLabelIds: v.optional(v.array(v.id('labels'))),
  },
  handler: async (ctx, args) => {
    for (let i = 0; i < args.transactionIds.length; i += BATCH_CHUNK_SIZE) {
      const chunk = args.transactionIds.slice(i, i + BATCH_CHUNK_SIZE)
      await ctx.runMutation(internal.transactions.batchUpdateLabelsChunk, {
        transactionIds: chunk,
        addLabelIds: args.addLabelIds,
        removeLabelIds: args.removeLabelIds,
      })
    }
  },
})

export const batchUpdateLabelsChunk = internalMutation({
  args: {
    transactionIds: v.array(v.id('transactions')),
    addLabelIds: v.optional(v.array(v.id('labels'))),
    removeLabelIds: v.optional(v.array(v.id('labels'))),
  },
  handler: async (ctx, args) => {
    for (const transactionId of args.transactionIds) {
      const transaction = await ctx.db.get('transactions', transactionId)
      if (!transaction) continue

      const existing = transaction.labelIds ?? []
      let updated = [...existing]

      if (args.addLabelIds) {
        for (const labelId of args.addLabelIds) {
          if (!updated.includes(labelId)) {
            updated.push(labelId)
          }
        }
      }

      if (args.removeLabelIds) {
        updated = updated.filter((id) => !args.removeLabelIds!.includes(id))
      }

      await ctx.db.patch('transactions', transactionId, { labelIds: updated })
    }
  },
})

export const getTransactionVolume = query({
  args: {
    profileId: v.id('profiles'),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []

    const txs = await ctx.db
      .query('transactions')
      .withIndex('by_profileId_date', (q) =>
        q
          .eq('profileId', args.profileId)
          .gte('date', args.startDate)
          .lte('date', args.endDate),
      )
      .collect()

    const counts = new Map<string, number>()
    for (const t of txs) {
      if (t.deleted) continue
      const day = t.date.slice(0, 10)
      counts.set(day, (counts.get(day) ?? 0) + 1)
    }
    return [...counts.entries()]
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
  },
})

export const getTransactionVolumeAllProfiles = query({
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

    const counts = new Map<string, number>()
    for (const t of results.flat()) {
      if (t.deleted) continue
      const day = t.date.slice(0, 10)
      counts.set(day, (counts.get(day) ?? 0) + 1)
    }
    return [...counts.entries()]
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
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
