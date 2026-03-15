import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { getAuthUserId, requireAuthUserId } from './lib/auth'

export const listLabels = query({
  args: {
    workspaceId: v.id('workspaces'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []

    return ctx.db
      .query('labels')
      .withIndex('by_workspaceId', (q) => q.eq('workspaceId', args.workspaceId))
      .collect()
  },
})

export const createLabel = mutation({
  args: {
    workspaceId: v.id('workspaces'),
    name: v.string(),
    color: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx)

    const member = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!member || member.workspaceId !== args.workspaceId) {
      throw new Error('Not authorized')
    }

    return ctx.db.insert('labels', {
      workspaceId: args.workspaceId,
      name: args.name,
      color: args.color,
      createdAt: Date.now(),
    })
  },
})

export const updateLabel = mutation({
  args: {
    labelId: v.id('labels'),
    name: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx)

    const label = await ctx.db.get('labels', args.labelId)
    if (!label) throw new Error('Label not found')

    const member = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!member || member.workspaceId !== label.workspaceId) {
      throw new Error('Not authorized')
    }

    const patch: Record<string, string> = {}
    if (args.name !== undefined) patch.name = args.name
    if (args.color !== undefined) patch.color = args.color

    await ctx.db.patch('labels', args.labelId, patch)
  },
})

export const deleteLabel = mutation({
  args: {
    labelId: v.id('labels'),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx)

    const label = await ctx.db.get('labels', args.labelId)
    if (!label) throw new Error('Label not found')

    const member = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!member || member.workspaceId !== label.workspaceId) {
      throw new Error('Not authorized')
    }

    // Remove this label from all transactions that reference it
    const portfolios = await ctx.db
      .query('portfolios')
      .withIndex('by_workspaceId', (q) =>
        q.eq('workspaceId', label.workspaceId),
      )
      .collect()

    for (const portfolio of portfolios) {
      const transactions = await ctx.db
        .query('transactions')
        .withIndex('by_portfolioId', (q) => q.eq('portfolioId', portfolio._id))
        .collect()

      for (const txn of transactions) {
        if (txn.labelIds?.includes(args.labelId)) {
          await ctx.db.patch('transactions', txn._id, {
            labelIds: txn.labelIds.filter((id) => id !== args.labelId),
          })
        }
      }
    }

    await ctx.db.delete('labels', args.labelId)
  },
})
