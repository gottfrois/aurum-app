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

export const listAccounts = query({
  args: {},
  handler: async (ctx) => {
    const workspaceId = await getUserWorkspaceId(ctx)
    if (!workspaceId) return []
    return await ctx.db
      .query('accounts')
      .withIndex('by_workspaceId', (q) => q.eq('workspaceId', workspaceId))
      .collect()
  },
})

export const getAccount = query({
  args: { accountId: v.id('accounts') },
  handler: async (ctx, args) => {
    const workspaceId = await getUserWorkspaceId(ctx)
    if (!workspaceId) return null
    return await ctx.db.get(args.accountId)
  },
})

export const createAccount = mutation({
  args: {
    name: v.string(),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const workspaceId = await getUserWorkspaceId(ctx)
    if (!workspaceId) throw new Error('No workspace found')
    return await ctx.db.insert('accounts', {
      workspaceId,
      name: args.name,
      icon: args.icon,
    })
  },
})

export const updateAccount = mutation({
  args: {
    accountId: v.id('accounts'),
    name: v.optional(v.string()),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const workspaceId = await getUserWorkspaceId(ctx)
    if (!workspaceId) throw new Error('No workspace found')
    const { accountId, ...updates } = args
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined),
    )
    await ctx.db.patch(accountId, filtered)
  },
})

export const deleteAccount = mutation({
  args: { accountId: v.id('accounts') },
  handler: async (ctx, args) => {
    const workspaceId = await getUserWorkspaceId(ctx)
    if (!workspaceId) throw new Error('No workspace found')
    const accounts = await ctx.db
      .query('accounts')
      .withIndex('by_workspaceId', (q) => q.eq('workspaceId', workspaceId))
      .collect()
    if (accounts.length <= 1) {
      throw new Error('Cannot delete the last account')
    }
    await ctx.db.delete(args.accountId)
  },
})
