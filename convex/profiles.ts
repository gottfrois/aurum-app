import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { getAuthUserId } from './lib/auth'

async function getUserWorkspaceId(ctx: { db: any; auth: any }) {
  const userId = await getAuthUserId(ctx as any)
  if (!userId) return null
  const member = await ctx.db
    .query('workspaceMembers')
    .withIndex('by_userId', (q: any) => q.eq('userId', userId))
    .first()
  if (!member) return null
  return member.workspaceId
}

export const listProfiles = query({
  args: {},
  handler: async (ctx) => {
    const workspaceId = await getUserWorkspaceId(ctx)
    if (!workspaceId) return []
    return await ctx.db
      .query('profiles')
      .withIndex('by_workspaceId', (q) => q.eq('workspaceId', workspaceId))
      .collect()
  },
})

export const getProfile = query({
  args: { profileId: v.id('profiles') },
  handler: async (ctx, args) => {
    const workspaceId = await getUserWorkspaceId(ctx)
    if (!workspaceId) return null
    return await ctx.db.get(args.profileId)
  },
})

export const createProfile = mutation({
  args: {
    name: v.string(),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const workspaceId = await getUserWorkspaceId(ctx)
    if (!workspaceId) throw new Error('No workspace found')
    return await ctx.db.insert('profiles', {
      workspaceId,
      name: args.name,
      icon: args.icon,
    })
  },
})

export const updateProfile = mutation({
  args: {
    profileId: v.id('profiles'),
    name: v.optional(v.string()),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const workspaceId = await getUserWorkspaceId(ctx)
    if (!workspaceId) throw new Error('No workspace found')
    const { profileId, ...updates } = args
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined),
    )
    await ctx.db.patch(profileId, filtered)
  },
})

export const deleteProfile = mutation({
  args: { profileId: v.id('profiles') },
  handler: async (ctx, args) => {
    const workspaceId = await getUserWorkspaceId(ctx)
    if (!workspaceId) throw new Error('No workspace found')
    const profiles = await ctx.db
      .query('profiles')
      .withIndex('by_workspaceId', (q) => q.eq('workspaceId', workspaceId))
      .collect()
    if (profiles.length <= 1) {
      throw new Error('Cannot delete the last profile')
    }

    // Delete all associated data using profileId indexes (flat, no nesting)
    const [connections, bankAccounts, snapshots] = await Promise.all([
      ctx.db
        .query('connections')
        .withIndex('by_profileId', (q) => q.eq('profileId', args.profileId))
        .collect(),
      ctx.db
        .query('bankAccounts')
        .withIndex('by_profileId', (q) => q.eq('profileId', args.profileId))
        .collect(),
      ctx.db
        .query('balanceSnapshots')
        .withIndex('by_profileId_timestamp', (q) =>
          q.eq('profileId', args.profileId),
        )
        .collect(),
    ])
    await Promise.all([
      ...snapshots.map((s) => ctx.db.delete(s._id)),
      ...bankAccounts.map((ba) => ctx.db.delete(ba._id)),
      ...connections.map((c) => ctx.db.delete(c._id)),
    ])

    await ctx.db.delete(args.profileId)
  },
})
