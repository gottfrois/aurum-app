import { v } from 'convex/values'
import { internal } from './_generated/api'
import {
  internalAction,
  internalMutation,
  mutation,
  query,
} from './_generated/server'
import { getAuthUserId, requireAuthUserId } from './lib/auth'

export const listTransactionsByPortfolio = query({
  args: {
    portfolioId: v.id('portfolios'),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []

    const results = await ctx.db
      .query('transactions')
      .withIndex('by_portfolioId_date', (q) =>
        q
          .eq('portfolioId', args.portfolioId)
          .gte('date', args.startDate)
          .lte('date', args.endDate),
      )
      .collect()

    return results.filter((t) => !t.deleted)
  },
})

export const listAllTransactions = query({
  args: {
    portfolioIds: v.array(v.id('portfolios')),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []

    const results = await Promise.all(
      args.portfolioIds.map((portfolioId) =>
        ctx.db
          .query('transactions')
          .withIndex('by_portfolioId', (q) => q.eq('portfolioId', portfolioId))
          .collect(),
      ),
    )

    return results.flat().filter((t) => !t.deleted)
  },
})

export const listAllTransactionsByPortfolios = query({
  args: {
    portfolioIds: v.array(v.id('portfolios')),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []

    const results = await Promise.all(
      args.portfolioIds.map((portfolioId) =>
        ctx.db
          .query('transactions')
          .withIndex('by_portfolioId_date', (q) =>
            q
              .eq('portfolioId', portfolioId)
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

    const portfolio = await ctx.db.get('portfolios', transaction.portfolioId)
    if (!portfolio) throw new Error('Portfolio not found')

    const member = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!member || member.workspaceId !== portfolio.workspaceId) {
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
        updated = updated.filter((id) => !args.removeLabelIds?.includes(id))
      }

      await ctx.db.patch('transactions', transactionId, { labelIds: updated })
    }
  },
})

export const getTransactionVolume = query({
  args: {
    portfolioId: v.id('portfolios'),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []

    const txs = await ctx.db
      .query('transactions')
      .withIndex('by_portfolioId_date', (q) =>
        q
          .eq('portfolioId', args.portfolioId)
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

export const getTransactionVolumeAllPortfolios = query({
  args: {
    portfolioIds: v.array(v.id('portfolios')),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []

    const results = await Promise.all(
      args.portfolioIds.map((portfolioId) =>
        ctx.db
          .query('transactions')
          .withIndex('by_portfolioId_date', (q) =>
            q
              .eq('portfolioId', portfolioId)
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
    encryptedCategories: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx)

    const transaction = await ctx.db.get('transactions', args.transactionId)
    if (!transaction) throw new Error('Transaction not found')

    const portfolio = await ctx.db.get('portfolios', transaction.portfolioId)
    if (!portfolio) throw new Error('Portfolio not found')

    const member = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!member || member.workspaceId !== portfolio.workspaceId) {
      throw new Error('Not authorized')
    }

    // userCategoryKey is now inside encryptedCategories — client must re-encrypt
    // the entire categories blob with the updated key
    await ctx.db.patch('transactions', args.transactionId, {
      encryptedCategories: args.encryptedCategories,
    })
  },
})
