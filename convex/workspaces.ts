import { mutation, query } from './_generated/server'
import { internal } from './_generated/api'
import { getAuthUserId, requireAuthUserId } from './lib/auth'

export const ensureWorkspace = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx)

    const existing = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()

    if (existing) {
      return existing.workspaceId
    }

    const workspaceId = await ctx.db.insert('workspaces', {
      name: 'My Workspace',
      createdBy: userId,
    })

    await ctx.db.insert('workspaceMembers', {
      workspaceId,
      userId,
      role: 'owner',
    })

    await ctx.db.insert('profiles', {
      workspaceId,
      name: 'Personal',
      icon: 'User',
    })

    await ctx.scheduler.runAfter(0, internal.categories.seedDefaultCategories, {
      workspaceId,
    })

    return workspaceId
  },
})

export const getMyWorkspace = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null

    const member = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()

    if (!member) return null

    return await ctx.db.get('workspaces', member.workspaceId)
  },
})
