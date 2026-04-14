import { v } from 'convex/values'
import { internal } from './_generated/api'
import { mutation, query } from './_generated/server'
import { getAuthUserId, requireAuthUserId } from './lib/auth'

export const listLabels = query({
  args: {
    workspaceId: v.id('workspaces'),
    portfolioId: v.optional(v.id('portfolios')),
    includeAllPortfolios: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []

    const workspaceLabels = await ctx.db
      .query('transactionLabels')
      .withIndex('by_workspaceId', (q) => q.eq('workspaceId', args.workspaceId))
      .collect()

    if (args.includeAllPortfolios) {
      return workspaceLabels
    }

    if (!args.portfolioId) {
      return workspaceLabels.filter((l) => !l.portfolioId)
    }

    const portfolioLabels = workspaceLabels.filter(
      (l) => l.portfolioId === args.portfolioId,
    )
    const inherited = workspaceLabels.filter((l) => !l.portfolioId)
    return [...inherited, ...portfolioLabels]
  },
})

export const listWorkspaceLabels = query({
  args: {
    workspaceId: v.id('workspaces'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []

    const all = await ctx.db
      .query('transactionLabels')
      .withIndex('by_workspaceId', (q) => q.eq('workspaceId', args.workspaceId))
      .collect()

    return all.filter((l) => !l.portfolioId)
  },
})

export const createLabel = mutation({
  args: {
    workspaceId: v.id('workspaces'),
    portfolioId: v.optional(v.id('portfolios')),
    name: v.string(),
    description: v.optional(v.string()),
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

    if (args.portfolioId) {
      const portfolio = await ctx.db.get('portfolios', args.portfolioId)
      if (!portfolio || portfolio.workspaceId !== args.workspaceId) {
        throw new Error('Not authorized')
      }
    } else {
      const workspace = await ctx.db.get('workspaces', member.workspaceId)
      const canCreate =
        member.role === 'owner' ||
        workspace?.policies?.labelCreation === 'all_members'
      if (!canCreate) {
        throw new Error('Only workspace owners can create workspace labels')
      }
    }

    const labelId = await ctx.db.insert('transactionLabels', {
      workspaceId: args.workspaceId,
      portfolioId: args.portfolioId,
      name: args.name,
      description: args.description,
      color: args.color,
      createdAt: Date.now(),
    })
    await ctx.scheduler.runAfter(0, internal.rag.indexLabel, {
      workspaceId: args.workspaceId,
      labelId,
    })
    return labelId
  },
})

export const updateLabel = mutation({
  args: {
    labelId: v.id('transactionLabels'),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx)

    const label = await ctx.db.get('transactionLabels', args.labelId)
    if (!label) throw new Error('Label not found')

    const member = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()

    if (label.portfolioId) {
      if (!member || member.workspaceId !== label.workspaceId) {
        throw new Error('Not authorized')
      }
    } else {
      if (
        !member ||
        member.workspaceId !== label.workspaceId ||
        member.role !== 'owner'
      ) {
        throw new Error('Only workspace owners can update workspace labels')
      }
    }

    const patch: Record<string, string | undefined> = {}
    if (args.name !== undefined) patch.name = args.name
    if (args.description !== undefined) patch.description = args.description
    if (args.color !== undefined) patch.color = args.color

    await ctx.db.patch('transactionLabels', args.labelId, patch)

    if (args.name !== undefined || args.description !== undefined) {
      await ctx.scheduler.runAfter(0, internal.rag.indexLabel, {
        workspaceId: label.workspaceId,
        labelId: args.labelId,
      })
    }
  },
})

export const deleteLabel = mutation({
  args: {
    labelId: v.id('transactionLabels'),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx)

    const label = await ctx.db.get('transactionLabels', args.labelId)
    if (!label) throw new Error('Label not found')

    const member = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()

    if (label.portfolioId) {
      if (!member || member.workspaceId !== label.workspaceId) {
        throw new Error('Not authorized')
      }
    } else {
      if (
        !member ||
        member.workspaceId !== label.workspaceId ||
        member.role !== 'owner'
      ) {
        throw new Error('Only workspace owners can delete workspace labels')
      }
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

    await ctx.db.delete('transactionLabels', args.labelId)
    await ctx.scheduler.runAfter(0, internal.rag.removeEntity, {
      workspaceId: label.workspaceId,
      type: 'label',
      id: args.labelId,
    })
  },
})

export const batchDeleteLabels = mutation({
  args: {
    labelIds: v.array(v.id('transactionLabels')),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx)

    const member = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!member) throw new Error('Not authorized')

    for (const labelId of args.labelIds) {
      const label = await ctx.db.get('transactionLabels', labelId)
      if (!label || label.workspaceId !== member.workspaceId) continue

      if (!label.portfolioId && member.role !== 'owner') continue

      const portfolios = await ctx.db
        .query('portfolios')
        .withIndex('by_workspaceId', (q) =>
          q.eq('workspaceId', label.workspaceId),
        )
        .collect()

      for (const portfolio of portfolios) {
        const transactions = await ctx.db
          .query('transactions')
          .withIndex('by_portfolioId', (q) =>
            q.eq('portfolioId', portfolio._id),
          )
          .collect()

        for (const txn of transactions) {
          if (txn.labelIds?.includes(labelId)) {
            await ctx.db.patch('transactions', txn._id, {
              labelIds: txn.labelIds.filter((id) => id !== labelId),
            })
          }
        }
      }

      await ctx.db.delete('transactionLabels', labelId)
      await ctx.scheduler.runAfter(0, internal.rag.removeEntity, {
        workspaceId: label.workspaceId,
        type: 'label',
        id: labelId,
      })
    }
  },
})
