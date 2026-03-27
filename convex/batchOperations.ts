import { v } from 'convex/values'
import { internalMutation, mutation, query } from './_generated/server'
import { getAuthUserId, requireAuthUserId } from './lib/auth'

export const updateBatchProgress = internalMutation({
  args: {
    operationId: v.id('batchOperations'),
    processed: v.number(),
  },
  handler: async (ctx, args) => {
    const op = await ctx.db.get(args.operationId)
    if (!op || op.status !== 'processing') return

    await ctx.db.patch(args.operationId, { processed: args.processed })
  },
})

export const completeBatchOperation = internalMutation({
  args: {
    operationId: v.id('batchOperations'),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const op = await ctx.db.get(args.operationId)
    if (!op) return

    if (args.error) {
      await ctx.db.patch(args.operationId, {
        status: 'error',
        error: args.error,
      })
    } else {
      await ctx.db.patch(args.operationId, {
        status: 'complete',
        processed: op.total,
      })
    }
  },
})

export const getActiveBatchOperation = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null

    const member = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!member) return null

    // First check for a processing operation
    const processing = await ctx.db
      .query('batchOperations')
      .withIndex('by_workspaceId_status', (q) =>
        q.eq('workspaceId', member.workspaceId).eq('status', 'processing'),
      )
      .first()
    if (processing) return processing

    // Then check for a recently completed one (client needs to see the final state)
    const complete = await ctx.db
      .query('batchOperations')
      .withIndex('by_workspaceId_status', (q) =>
        q.eq('workspaceId', member.workspaceId).eq('status', 'complete'),
      )
      .first()
    if (complete) return complete

    // Finally check for errors
    return await ctx.db
      .query('batchOperations')
      .withIndex('by_workspaceId_status', (q) =>
        q.eq('workspaceId', member.workspaceId).eq('status', 'error'),
      )
      .first()
  },
})

export const deleteBatchOperation = mutation({
  args: {
    operationId: v.id('batchOperations'),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx)

    const op = await ctx.db.get(args.operationId)
    if (!op) return

    // Verify workspace membership
    const member = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!member || member.workspaceId !== op.workspaceId) return

    await ctx.db.delete(args.operationId)
  },
})

export const purgeExpiredOperations = internalMutation({
  handler: async (ctx) => {
    const now = Date.now()
    const expired = await ctx.db
      .query('batchOperations')
      .withIndex('by_retainUntil', (q) => q.lt('retainUntil', now))
      .collect()

    for (const op of expired) {
      await ctx.db.delete(op._id)
    }

    return { deleted: expired.length }
  },
})
