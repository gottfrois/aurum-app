import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { getAuthUserId, requireAuthUserId } from './lib/auth'

export const list = query({
  args: { entityType: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []

    const member = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!member) return []

    const views = args.entityType
      ? await ctx.db
          .query('filterViews')
          .withIndex('by_workspaceId_entityType', (q) =>
            q
              .eq('workspaceId', member.workspaceId)
              .eq('entityType', args.entityType as string),
          )
          .collect()
      : await ctx.db
          .query('filterViews')
          .withIndex('by_workspaceId', (q) =>
            q.eq('workspaceId', member.workspaceId),
          )
          .collect()

    // Filter by visibility: show workspace views, personal views owned by user,
    // and portfolio views for portfolios the user has access to
    const userPortfolios = await ctx.db
      .query('portfolios')
      .withIndex('by_memberId', (q) => q.eq('memberId', member._id))
      .collect()
    const userPortfolioIds = new Set(userPortfolios.map((p) => p._id))

    return views.filter((view) => {
      const visibility = view.visibility ?? 'workspace'
      if (visibility === 'workspace') return true
      if (visibility === 'personal') return view.createdBy === userId
      if (visibility === 'portfolio') {
        return view.portfolioId ? userPortfolioIds.has(view.portfolioId) : false
      }
      return false
    })
  },
})

export const get = query({
  args: { viewId: v.id('filterViews') },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null

    const member = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!member) return null

    const view = await ctx.db.get(args.viewId)
    if (!view || view.workspaceId !== member.workspaceId) return null

    // Check visibility
    const visibility = view.visibility ?? 'workspace'
    if (visibility === 'personal' && view.createdBy !== userId) return null
    if (visibility === 'portfolio' && view.portfolioId) {
      const portfolio = await ctx.db.get(view.portfolioId)
      if (!portfolio || portfolio.memberId !== member._id) return null
    }

    return view
  },
})

export const create = mutation({
  args: {
    entityType: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
    filters: v.string(),
    visibility: v.optional(
      v.union(
        v.literal('personal'),
        v.literal('workspace'),
        v.literal('portfolio'),
      ),
    ),
    portfolioId: v.optional(v.id('portfolios')),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx)
    const member = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!member) throw new Error('Not a workspace member')

    return await ctx.db.insert('filterViews', {
      workspaceId: member.workspaceId,
      entityType: args.entityType,
      name: args.name,
      description: args.description,
      color: args.color,
      filters: args.filters,
      visibility: args.visibility ?? 'workspace',
      portfolioId: args.portfolioId,
      createdBy: userId,
      createdAt: Date.now(),
    })
  },
})

export const update = mutation({
  args: {
    viewId: v.id('filterViews'),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
    filters: v.optional(v.string()),
    visibility: v.optional(
      v.union(
        v.literal('personal'),
        v.literal('workspace'),
        v.literal('portfolio'),
      ),
    ),
    portfolioId: v.optional(v.id('portfolios')),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx)
    const member = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!member) throw new Error('Not a workspace member')

    const view = await ctx.db.get(args.viewId)
    if (!view || view.workspaceId !== member.workspaceId) {
      throw new Error('View not found')
    }

    const patch: Record<string, unknown> = { updatedAt: Date.now() }
    if (args.name !== undefined) patch.name = args.name
    if (args.description !== undefined) patch.description = args.description
    if (args.color !== undefined) patch.color = args.color
    if (args.filters !== undefined) patch.filters = args.filters
    if (args.visibility !== undefined) patch.visibility = args.visibility
    if (args.portfolioId !== undefined) patch.portfolioId = args.portfolioId

    await ctx.db.patch(args.viewId, patch)
  },
})

export const remove = mutation({
  args: { viewId: v.id('filterViews') },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx)
    const member = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!member) throw new Error('Not a workspace member')

    const view = await ctx.db.get(args.viewId)
    if (!view || view.workspaceId !== member.workspaceId) {
      throw new Error('View not found')
    }

    // Cascade-delete associated favorites
    const favorites = await ctx.db
      .query('filterViewFavorites')
      .withIndex('by_viewId', (q) => q.eq('viewId', args.viewId))
      .collect()
    for (const fav of favorites) {
      await ctx.db.delete(fav._id)
    }

    await ctx.db.delete(args.viewId)
  },
})
