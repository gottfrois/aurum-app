import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import {
  internalAction,
  internalMutation,
  mutation,
  query,
} from './_generated/server'
import { insertAuditLogDirect } from './auditLog'
import { getActorInfo, getAuthUserId, requireAuthUserId } from './lib/auth'

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

export const listTransactionPage = query({
  args: {
    portfolioId: v.id('portfolios'),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) {
      return { page: [], isDone: true, continueCursor: '' }
    }

    return await ctx.db
      .query('transactions')
      .withIndex('by_portfolioId', (q) => q.eq('portfolioId', args.portfolioId))
      .filter((q) => q.eq(q.field('deleted'), false))
      .paginate(args.paginationOpts)
  },
})

export const countAllTransactions = query({
  args: {
    portfolioIds: v.array(v.id('portfolios')),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return 0

    let total = 0
    for (const portfolioId of args.portfolioIds) {
      const txns = await ctx.db
        .query('transactions')
        .withIndex('by_portfolioId', (q) => q.eq('portfolioId', portfolioId))
        .filter((q) => q.eq(q.field('deleted'), false))
        .collect()
      total += txns.length
    }
    return total
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

export const listTransactionsByBankAccount = query({
  args: {
    bankAccountId: v.id('bankAccounts'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []

    const results = await ctx.db
      .query('transactions')
      .withIndex('by_bankAccountId', (q) =>
        q.eq('bankAccountId', args.bankAccountId),
      )
      .collect()

    return results.filter((t) => !t.deleted)
  },
})

export const updateTransactionLabels = mutation({
  args: {
    transactionId: v.id('transactions'),
    labelIds: v.array(v.id('transactionLabels')),
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

    const previousLabelIds = transaction.labelIds ?? []

    await ctx.db.patch('transactions', args.transactionId, {
      labelIds: args.labelIds,
    })

    // Resolve label names for audit metadata
    const addedIds = args.labelIds.filter(
      (id) => !previousLabelIds.includes(id),
    )
    const removedIds = previousLabelIds.filter(
      (id) => !args.labelIds.includes(id),
    )

    // Skip audit log if nothing actually changed
    if (addedIds.length === 0 && removedIds.length === 0) return

    const addedLabels = await Promise.all(addedIds.map((id) => ctx.db.get(id)))
    const removedLabels = await Promise.all(
      removedIds.map((id) => ctx.db.get(id)),
    )

    const workspace = await ctx.db.get('workspaces', portfolio.workspaceId)
    const identity = await ctx.auth.getUserIdentity()
    await insertAuditLogDirect(ctx.db, {
      workspaceId: portfolio.workspaceId,
      workspaceName: workspace?.name ?? '',
      portfolioId: transaction.portfolioId,
      portfolioName: portfolio.name,
      actorType: 'user',
      ...getActorInfo(identity),
      event: 'transaction.labels_updated',
      resourceType: 'transaction',
      resourceId: args.transactionId,
      metadata: JSON.stringify({
        transactionId: args.transactionId,
        previousLabelIds,
        newLabelIds: args.labelIds,
        labelCount: args.labelIds.length,
        addedLabels: addedLabels
          .filter((l) => l != null)
          .map((l) => ({ name: l.name, color: l.color })),
        removedLabels: removedLabels
          .filter((l) => l != null)
          .map((l) => ({ name: l.name, color: l.color })),
      }),
    })
  },
})

export const batchUpdateTransactionLabels = mutation({
  args: {
    transactionIds: v.array(v.id('transactions')),
    addLabelIds: v.optional(v.array(v.id('transactionLabels'))),
    removeLabelIds: v.optional(v.array(v.id('transactionLabels'))),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx)

    const member = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!member) throw new Error('Not authorized')

    const identity = await ctx.auth.getUserIdentity()

    const now = Date.now()
    const operationId = await ctx.db.insert('batchOperations', {
      workspaceId: member.workspaceId,
      userId,
      type: 'labels',
      status: 'processing',
      total: args.transactionIds.length,
      processed: 0,
      label: 'batch.labels.updating',
      retainUntil: now + BATCH_OPERATION_RETENTION_MS,
      createdAt: now,
    })

    await ctx.scheduler.runAfter(
      0,
      internal.transactions.batchUpdateLabelsAsync,
      {
        transactionIds: args.transactionIds,
        addLabelIds: args.addLabelIds,
        removeLabelIds: args.removeLabelIds,
        workspaceId: member.workspaceId,
        operationId,
        ...getActorInfo(identity),
      },
    )
  },
})

const BATCH_CHUNK_SIZE = 100
const BATCH_OPERATION_RETENTION_MS = 5 * 60 * 1000 // 5 minutes

export const batchUpdateLabelsAsync = internalAction({
  args: {
    transactionIds: v.array(v.id('transactions')),
    addLabelIds: v.optional(v.array(v.id('transactionLabels'))),
    removeLabelIds: v.optional(v.array(v.id('transactionLabels'))),
    workspaceId: v.id('workspaces'),
    operationId: v.id('batchOperations'),
    actorId: v.optional(v.string()),
    actorName: v.optional(v.string()),
    actorAvatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      for (let i = 0; i < args.transactionIds.length; i += BATCH_CHUNK_SIZE) {
        const chunk = args.transactionIds.slice(i, i + BATCH_CHUNK_SIZE)
        await ctx.runMutation(internal.transactions.batchUpdateLabelsChunk, {
          transactionIds: chunk,
          addLabelIds: args.addLabelIds,
          removeLabelIds: args.removeLabelIds,
          workspaceId: args.workspaceId,
          actorId: args.actorId,
          actorName: args.actorName,
          actorAvatarUrl: args.actorAvatarUrl,
        })
        await ctx.runMutation(internal.batchOperations.updateBatchProgress, {
          operationId: args.operationId,
          processed: Math.min(i + BATCH_CHUNK_SIZE, args.transactionIds.length),
        })
      }
      await ctx.runMutation(internal.batchOperations.completeBatchOperation, {
        operationId: args.operationId,
      })
    } catch (e) {
      await ctx.runMutation(internal.batchOperations.completeBatchOperation, {
        operationId: args.operationId,
        error: e instanceof Error ? e.message : 'Batch operation failed',
      })
    }
  },
})

export const batchUpdateLabelsChunk = internalMutation({
  args: {
    transactionIds: v.array(v.id('transactions')),
    addLabelIds: v.optional(v.array(v.id('transactionLabels'))),
    removeLabelIds: v.optional(v.array(v.id('transactionLabels'))),
    workspaceId: v.id('workspaces'),
    actorId: v.optional(v.string()),
    actorName: v.optional(v.string()),
    actorAvatarUrl: v.optional(v.string()),
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

    const workspace = await ctx.db.get('workspaces', args.workspaceId)
    await insertAuditLogDirect(ctx.db, {
      workspaceId: args.workspaceId,
      workspaceName: workspace?.name ?? '',
      actorType: 'user',
      actorId: args.actorId,
      actorName: args.actorName,
      actorAvatarUrl: args.actorAvatarUrl,
      event: 'transaction.labels_batch_updated',
      resourceType: 'transaction',
      metadata: JSON.stringify({
        affectedCount: args.transactionIds.length,
        addLabelIds: args.addLabelIds,
        removeLabelIds: args.removeLabelIds,
      }),
    })
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

export const updateTransactionExclusion = mutation({
  args: {
    transactionId: v.id('transactions'),
    excludedFromBudget: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx)

    const transaction = await ctx.db.get(args.transactionId)
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

    const previousValue = transaction.excludedFromBudget ?? false

    // Skip if nothing actually changed
    if (previousValue === args.excludedFromBudget) return

    await ctx.db.patch(args.transactionId, {
      excludedFromBudget: args.excludedFromBudget,
    })

    const workspace = await ctx.db.get('workspaces', portfolio.workspaceId)
    const identity = await ctx.auth.getUserIdentity()
    const eventName = args.excludedFromBudget
      ? 'transaction.excluded_from_budget'
      : 'transaction.included_in_budget'
    await insertAuditLogDirect(ctx.db, {
      workspaceId: portfolio.workspaceId,
      workspaceName: workspace?.name ?? '',
      portfolioId: transaction.portfolioId,
      portfolioName: portfolio.name,
      actorType: 'user',
      ...getActorInfo(identity),
      event: eventName,
      resourceType: 'transaction',
      resourceId: args.transactionId,
      metadata: JSON.stringify({
        transactionId: args.transactionId,
        previousValue,
        newValue: args.excludedFromBudget,
      }),
    })
  },
})

export const batchUpdateTransactionExclusion = mutation({
  args: {
    transactionIds: v.array(v.id('transactions')),
    excludedFromBudget: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx)

    const member = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!member) throw new Error('Not authorized')

    const identity = await ctx.auth.getUserIdentity()

    const now = Date.now()
    const operationId = await ctx.db.insert('batchOperations', {
      workspaceId: member.workspaceId,
      userId,
      type: 'exclusion',
      status: 'processing',
      total: args.transactionIds.length,
      processed: 0,
      label: args.excludedFromBudget
        ? 'batch.exclusion.excluding'
        : 'batch.exclusion.including',
      retainUntil: now + BATCH_OPERATION_RETENTION_MS,
      createdAt: now,
    })

    await ctx.scheduler.runAfter(
      0,
      internal.transactions.batchUpdateExclusionAsync,
      {
        transactionIds: args.transactionIds,
        excludedFromBudget: args.excludedFromBudget,
        workspaceId: member.workspaceId,
        operationId,
        ...getActorInfo(identity),
      },
    )
  },
})

export const batchUpdateExclusionAsync = internalAction({
  args: {
    transactionIds: v.array(v.id('transactions')),
    excludedFromBudget: v.boolean(),
    workspaceId: v.id('workspaces'),
    operationId: v.id('batchOperations'),
    actorId: v.optional(v.string()),
    actorName: v.optional(v.string()),
    actorAvatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      for (let i = 0; i < args.transactionIds.length; i += BATCH_CHUNK_SIZE) {
        const chunk = args.transactionIds.slice(i, i + BATCH_CHUNK_SIZE)
        await ctx.runMutation(internal.transactions.batchUpdateExclusionChunk, {
          transactionIds: chunk,
          excludedFromBudget: args.excludedFromBudget,
          workspaceId: args.workspaceId,
          actorId: args.actorId,
          actorName: args.actorName,
          actorAvatarUrl: args.actorAvatarUrl,
        })
        await ctx.runMutation(internal.batchOperations.updateBatchProgress, {
          operationId: args.operationId,
          processed: Math.min(i + BATCH_CHUNK_SIZE, args.transactionIds.length),
        })
      }
      await ctx.runMutation(internal.batchOperations.completeBatchOperation, {
        operationId: args.operationId,
      })
    } catch (e) {
      await ctx.runMutation(internal.batchOperations.completeBatchOperation, {
        operationId: args.operationId,
        error: e instanceof Error ? e.message : 'Batch operation failed',
      })
    }
  },
})

export const batchUpdateExclusionChunk = internalMutation({
  args: {
    transactionIds: v.array(v.id('transactions')),
    excludedFromBudget: v.boolean(),
    workspaceId: v.id('workspaces'),
    actorId: v.optional(v.string()),
    actorName: v.optional(v.string()),
    actorAvatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    for (const transactionId of args.transactionIds) {
      const transaction = await ctx.db.get(transactionId)
      if (!transaction) continue
      await ctx.db.patch(transactionId, {
        excludedFromBudget: args.excludedFromBudget,
      })
    }

    const workspace = await ctx.db.get('workspaces', args.workspaceId)
    await insertAuditLogDirect(ctx.db, {
      workspaceId: args.workspaceId,
      workspaceName: workspace?.name ?? '',
      actorType: 'user',
      actorId: args.actorId,
      actorName: args.actorName,
      actorAvatarUrl: args.actorAvatarUrl,
      event: 'transaction.exclusion_batch_updated',
      resourceType: 'transaction',
      metadata: JSON.stringify({
        affectedCount: args.transactionIds.length,
        excludedFromBudget: args.excludedFromBudget,
      }),
    })
  },
})

export const batchUpdateTransactionCategories = mutation({
  args: {
    items: v.array(
      v.object({
        transactionId: v.id('transactions'),
        encryptedCategories: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx)

    const member = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!member) throw new Error('Not authorized')

    let updateCount = 0
    for (const item of args.items) {
      const transaction = await ctx.db.get('transactions', item.transactionId)
      if (!transaction) continue

      const portfolio = await ctx.db.get('portfolios', transaction.portfolioId)
      if (!portfolio || portfolio.workspaceId !== member.workspaceId) continue

      await ctx.db.patch('transactions', item.transactionId, {
        encryptedCategories: item.encryptedCategories,
      })
      updateCount++
    }

    if (updateCount > 0) {
      const workspace = await ctx.db.get('workspaces', member.workspaceId)
      const identity = await ctx.auth.getUserIdentity()
      await insertAuditLogDirect(ctx.db, {
        workspaceId: member.workspaceId,
        workspaceName: workspace?.name ?? '',
        actorType: 'user',
        ...getActorInfo(identity),
        event: 'transaction.category_batch_updated',
        resourceType: 'transaction',
        metadata: JSON.stringify({
          affectedCount: updateCount,
        }),
      })
    }
  },
})

export const updateTransactionDetails = mutation({
  args: {
    transactionId: v.id('transactions'),
    encryptedDetails: v.string(),
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

    const previousEncryptedDetails = transaction.encryptedDetails

    await ctx.db.patch('transactions', args.transactionId, {
      encryptedDetails: args.encryptedDetails,
    })

    const workspace = await ctx.db.get('workspaces', portfolio.workspaceId)
    const identity = await ctx.auth.getUserIdentity()
    await insertAuditLogDirect(ctx.db, {
      workspaceId: portfolio.workspaceId,
      workspaceName: workspace?.name ?? '',
      portfolioId: transaction.portfolioId,
      portfolioName: portfolio.name,
      actorType: 'user',
      ...getActorInfo(identity),
      event: 'transaction.description_updated',
      resourceType: 'transaction',
      resourceId: args.transactionId,
      metadata: JSON.stringify({
        transactionId: args.transactionId,
        hadPreviousDescription:
          previousEncryptedDetails !== args.encryptedDetails,
      }),
    })
  },
})

export const batchUpdateTransactionDetails = mutation({
  args: {
    items: v.array(
      v.object({
        transactionId: v.id('transactions'),
        encryptedDetails: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx)

    const member = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!member) throw new Error('Not authorized')

    let updateCount = 0
    for (const item of args.items) {
      const transaction = await ctx.db.get('transactions', item.transactionId)
      if (!transaction) continue

      const portfolio = await ctx.db.get('portfolios', transaction.portfolioId)
      if (!portfolio || portfolio.workspaceId !== member.workspaceId) continue

      await ctx.db.patch('transactions', item.transactionId, {
        encryptedDetails: item.encryptedDetails,
      })
      updateCount++
    }

    if (updateCount > 0) {
      const workspace = await ctx.db.get('workspaces', member.workspaceId)
      const identity = await ctx.auth.getUserIdentity()
      await insertAuditLogDirect(ctx.db, {
        workspaceId: member.workspaceId,
        workspaceName: workspace?.name ?? '',
        actorType: 'user',
        ...getActorInfo(identity),
        event: 'transaction.description_batch_updated',
        resourceType: 'transaction',
        metadata: JSON.stringify({
          affectedCount: updateCount,
        }),
      })
    }
  },
})

export const updateTransactionCategory = mutation({
  args: {
    transactionId: v.id('transactions'),
    encryptedCategories: v.string(),
    categoryKey: v.optional(v.string()),
    categoryLabel: v.optional(v.string()),
    categoryColor: v.optional(v.string()),
    previousCategoryKey: v.optional(v.string()),
    previousCategoryLabel: v.optional(v.string()),
    previousCategoryColor: v.optional(v.string()),
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

    // Skip if selecting the same category
    if (args.categoryKey && args.categoryKey === args.previousCategoryKey)
      return

    // userCategoryKey is now inside encryptedCategories — client must re-encrypt
    // the entire categories blob with the updated key
    await ctx.db.patch('transactions', args.transactionId, {
      encryptedCategories: args.encryptedCategories,
    })

    const workspace = await ctx.db.get('workspaces', portfolio.workspaceId)
    const identity = await ctx.auth.getUserIdentity()
    await insertAuditLogDirect(ctx.db, {
      workspaceId: portfolio.workspaceId,
      workspaceName: workspace?.name ?? '',
      portfolioId: transaction.portfolioId,
      portfolioName: portfolio.name,
      actorType: 'user',
      ...getActorInfo(identity),
      event: 'transaction.category_updated',
      resourceType: 'transaction',
      resourceId: args.transactionId,
      metadata: JSON.stringify({
        transactionId: args.transactionId,
        categoryKey: args.categoryKey,
        categoryLabel: args.categoryLabel,
        categoryColor: args.categoryColor,
        previousCategoryKey: args.previousCategoryKey,
        previousCategoryLabel: args.previousCategoryLabel,
        previousCategoryColor: args.previousCategoryColor,
      }),
    })
  },
})

export const batchUpdateTransactionCategory = mutation({
  args: {
    updates: v.array(
      v.object({
        transactionId: v.id('transactions'),
        encryptedCategories: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx)

    const member = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!member) throw new Error('Not authorized')

    const identity = await ctx.auth.getUserIdentity()

    const now = Date.now()
    const operationId = await ctx.db.insert('batchOperations', {
      workspaceId: member.workspaceId,
      userId,
      type: 'category',
      status: 'processing',
      total: args.updates.length,
      processed: 0,
      label: 'batch.category.updating',
      retainUntil: now + BATCH_OPERATION_RETENTION_MS,
      createdAt: now,
    })

    await ctx.scheduler.runAfter(
      0,
      internal.transactions.batchUpdateCategoryAsync,
      {
        updates: args.updates,
        workspaceId: member.workspaceId,
        operationId,
        ...getActorInfo(identity),
      },
    )
  },
})

export const batchUpdateCategoryAsync = internalAction({
  args: {
    updates: v.array(
      v.object({
        transactionId: v.id('transactions'),
        encryptedCategories: v.string(),
      }),
    ),
    workspaceId: v.id('workspaces'),
    operationId: v.id('batchOperations'),
    actorId: v.optional(v.string()),
    actorName: v.optional(v.string()),
    actorAvatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      for (let i = 0; i < args.updates.length; i += BATCH_CHUNK_SIZE) {
        const chunk = args.updates.slice(i, i + BATCH_CHUNK_SIZE)
        await ctx.runMutation(internal.transactions.batchUpdateCategoryChunk, {
          updates: chunk,
          workspaceId: args.workspaceId,
          actorId: args.actorId,
          actorName: args.actorName,
          actorAvatarUrl: args.actorAvatarUrl,
        })
        await ctx.runMutation(internal.batchOperations.updateBatchProgress, {
          operationId: args.operationId,
          processed: Math.min(i + BATCH_CHUNK_SIZE, args.updates.length),
        })
      }
      await ctx.runMutation(internal.batchOperations.completeBatchOperation, {
        operationId: args.operationId,
      })
    } catch (e) {
      await ctx.runMutation(internal.batchOperations.completeBatchOperation, {
        operationId: args.operationId,
        error: e instanceof Error ? e.message : 'Batch operation failed',
      })
    }
  },
})

export const batchUpdateCategoryChunk = internalMutation({
  args: {
    updates: v.array(
      v.object({
        transactionId: v.id('transactions'),
        encryptedCategories: v.string(),
      }),
    ),
    workspaceId: v.id('workspaces'),
    actorId: v.optional(v.string()),
    actorName: v.optional(v.string()),
    actorAvatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    for (const update of args.updates) {
      const transaction = await ctx.db.get('transactions', update.transactionId)
      if (!transaction) continue

      await ctx.db.patch('transactions', update.transactionId, {
        encryptedCategories: update.encryptedCategories,
      })
    }

    const workspace = await ctx.db.get('workspaces', args.workspaceId)
    await insertAuditLogDirect(ctx.db, {
      workspaceId: args.workspaceId,
      workspaceName: workspace?.name ?? '',
      actorType: 'user',
      actorId: args.actorId,
      actorName: args.actorName,
      actorAvatarUrl: args.actorAvatarUrl,
      event: 'transaction.category_batch_updated',
      resourceType: 'transaction',
      metadata: JSON.stringify({
        affectedCount: args.updates.length,
      }),
    })
  },
})

// ---------------------------------------------------------------------------
// Manual transaction mutations
// ---------------------------------------------------------------------------

export const createManualTransaction = mutation({
  args: {
    bankAccountId: v.id('bankAccounts'),
    portfolioId: v.id('portfolios'),
    date: v.string(),
    encryptedDetails: v.string(),
    encryptedFinancials: v.string(),
    encryptedCategories: v.string(),
    excludedFromBudget: v.optional(v.boolean()),
    labelIds: v.optional(v.array(v.id('transactionLabels'))),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx)

    const portfolio = await ctx.db.get('portfolios', args.portfolioId)
    if (!portfolio) throw new Error('Portfolio not found')

    const member = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!member || member.workspaceId !== portfolio.workspaceId) {
      throw new Error('Not authorized')
    }

    const bankAccount = await ctx.db.get('bankAccounts', args.bankAccountId)
    if (!bankAccount || bankAccount.portfolioId !== args.portfolioId) {
      throw new Error('Bank account not found or does not belong to portfolio')
    }

    const transactionId = await ctx.db.insert('transactions', {
      bankAccountId: args.bankAccountId,
      portfolioId: args.portfolioId,
      source: 'manual',
      date: args.date,
      coming: false,
      active: true,
      deleted: false,
      encryptedDetails: args.encryptedDetails,
      encryptedFinancials: args.encryptedFinancials,
      encryptedCategories: args.encryptedCategories,
      excludedFromBudget: args.excludedFromBudget,
      labelIds: args.labelIds,
    })

    const workspace = await ctx.db.get('workspaces', portfolio.workspaceId)
    const identity = await ctx.auth.getUserIdentity()
    await insertAuditLogDirect(ctx.db, {
      workspaceId: portfolio.workspaceId,
      workspaceName: workspace?.name ?? '',
      portfolioId: args.portfolioId,
      portfolioName: portfolio.name,
      actorType: 'user',
      ...getActorInfo(identity),
      event: 'transaction.manual_created',
      resourceType: 'transaction',
      resourceId: transactionId,
      metadata: JSON.stringify({
        transactionId,
        bankAccountId: args.bankAccountId,
        portfolioId: args.portfolioId,
      }),
    })

    return transactionId
  },
})

export const updateManualTransaction = mutation({
  args: {
    transactionId: v.id('transactions'),
    date: v.optional(v.string()),
    bankAccountId: v.optional(v.id('bankAccounts')),
    encryptedDetails: v.optional(v.string()),
    encryptedFinancials: v.optional(v.string()),
    encryptedCategories: v.optional(v.string()),
    excludedFromBudget: v.optional(v.boolean()),
    labelIds: v.optional(v.array(v.id('transactionLabels'))),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx)

    const transaction = await ctx.db.get('transactions', args.transactionId)
    if (!transaction) throw new Error('Transaction not found')
    if (transaction.source !== 'manual') {
      throw new Error('Only manual transactions can be edited')
    }

    const portfolio = await ctx.db.get('portfolios', transaction.portfolioId)
    if (!portfolio) throw new Error('Portfolio not found')

    const member = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!member || member.workspaceId !== portfolio.workspaceId) {
      throw new Error('Not authorized')
    }

    // If changing bank account, verify the new one is accessible
    if (
      args.bankAccountId &&
      args.bankAccountId !== transaction.bankAccountId
    ) {
      const newAccount = await ctx.db.get('bankAccounts', args.bankAccountId)
      if (!newAccount) throw new Error('Bank account not found')
      const newPortfolio = await ctx.db.get(
        'portfolios',
        newAccount.portfolioId,
      )
      if (!newPortfolio || newPortfolio.workspaceId !== portfolio.workspaceId) {
        throw new Error('Bank account not accessible')
      }
    }

    const patch: Record<string, unknown> = {}
    if (args.date !== undefined) patch.date = args.date
    if (args.bankAccountId !== undefined)
      patch.bankAccountId = args.bankAccountId
    if (args.encryptedDetails !== undefined)
      patch.encryptedDetails = args.encryptedDetails
    if (args.encryptedFinancials !== undefined)
      patch.encryptedFinancials = args.encryptedFinancials
    if (args.encryptedCategories !== undefined)
      patch.encryptedCategories = args.encryptedCategories
    if (args.excludedFromBudget !== undefined)
      patch.excludedFromBudget = args.excludedFromBudget
    if (args.labelIds !== undefined) patch.labelIds = args.labelIds

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch('transactions', args.transactionId, patch)
    }

    const workspace = await ctx.db.get('workspaces', portfolio.workspaceId)
    const identity = await ctx.auth.getUserIdentity()
    await insertAuditLogDirect(ctx.db, {
      workspaceId: portfolio.workspaceId,
      workspaceName: workspace?.name ?? '',
      portfolioId: transaction.portfolioId,
      portfolioName: portfolio.name,
      actorType: 'user',
      ...getActorInfo(identity),
      event: 'transaction.manual_updated',
      resourceType: 'transaction',
      resourceId: args.transactionId,
      metadata: JSON.stringify({
        transactionId: args.transactionId,
      }),
    })
  },
})

export const deleteManualTransaction = mutation({
  args: {
    transactionId: v.id('transactions'),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx)

    const transaction = await ctx.db.get('transactions', args.transactionId)
    if (!transaction) throw new Error('Transaction not found')
    if (transaction.source !== 'manual') {
      throw new Error('Only manual transactions can be deleted')
    }

    const portfolio = await ctx.db.get('portfolios', transaction.portfolioId)
    if (!portfolio) throw new Error('Portfolio not found')

    const member = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!member || member.workspaceId !== portfolio.workspaceId) {
      throw new Error('Not authorized')
    }

    // Audit log before soft-delete
    const workspace = await ctx.db.get('workspaces', portfolio.workspaceId)
    const identity = await ctx.auth.getUserIdentity()
    await insertAuditLogDirect(ctx.db, {
      workspaceId: portfolio.workspaceId,
      workspaceName: workspace?.name ?? '',
      portfolioId: transaction.portfolioId,
      portfolioName: portfolio.name,
      actorType: 'user',
      ...getActorInfo(identity),
      event: 'transaction.manual_deleted',
      resourceType: 'transaction',
      resourceId: args.transactionId,
      metadata: JSON.stringify({
        transactionId: args.transactionId,
        bankAccountId: transaction.bankAccountId,
      }),
    })

    await ctx.db.patch('transactions', args.transactionId, { deleted: true })
  },
})
