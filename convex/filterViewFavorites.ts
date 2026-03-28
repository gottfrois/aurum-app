import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { getAuthUserId, requireAuthUserId } from './lib/auth'

const MAX_FAVORITES = 5

export const list = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []

    const member = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!member) return []

    const favorites = await ctx.db
      .query('filterViewFavorites')
      .withIndex('by_workspaceId_userId', (q) =>
        q.eq('workspaceId', member.workspaceId).eq('userId', userId),
      )
      .collect()

    // Join with view data and sort by sortOrder
    const results = await Promise.all(
      favorites.map(async (fav) => {
        const view = await ctx.db.get(fav.viewId)
        if (!view) return null
        return { ...fav, view }
      }),
    )

    return results
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  },
})

export const toggle = mutation({
  args: { viewId: v.id('filterViews') },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx)
    const member = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!member) throw new Error('Not a workspace member')

    // Check view exists and is accessible
    const view = await ctx.db.get(args.viewId)
    if (!view || view.workspaceId !== member.workspaceId) {
      throw new Error('View not found')
    }

    // Check if already favorited
    const existing = await ctx.db
      .query('filterViewFavorites')
      .withIndex('by_workspaceId_userId', (q) =>
        q.eq('workspaceId', member.workspaceId).eq('userId', userId),
      )
      .collect()

    const existingFav = existing.find((f) => f.viewId === args.viewId)
    if (existingFav) {
      await ctx.db.delete(existingFav._id)
      return { favorited: false }
    }

    if (existing.length >= MAX_FAVORITES) {
      throw new ConvexError(
        `You can only have up to ${MAX_FAVORITES} favorites. Remove one to add another.`,
      )
    }

    const maxOrder = existing.reduce((max, f) => Math.max(max, f.sortOrder), 0)

    await ctx.db.insert('filterViewFavorites', {
      workspaceId: member.workspaceId,
      userId,
      viewId: args.viewId,
      sortOrder: maxOrder + 1,
      createdAt: Date.now(),
    })

    return { favorited: true }
  },
})

export const reorder = mutation({
  args: {
    items: v.array(
      v.object({
        favoriteId: v.id('filterViewFavorites'),
        sortOrder: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx)

    for (const item of args.items) {
      const fav = await ctx.db.get(item.favoriteId)
      if (!fav || fav.userId !== userId) continue
      await ctx.db.patch(item.favoriteId, { sortOrder: item.sortOrder })
    }
  },
})
