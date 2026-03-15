import { v } from 'convex/values'
import { internal } from './_generated/api'
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server'
import { getAuthUserId, requireAuthUserId } from './lib/auth'

export const listRules = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []

    const member = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!member) return []

    return await ctx.db
      .query('categoryRules')
      .withIndex('by_workspaceId', (q) =>
        q.eq('workspaceId', member.workspaceId),
      )
      .collect()
  },
})

export const createRule = mutation({
  args: {
    pattern: v.string(),
    matchType: v.union(v.literal('contains'), v.literal('regex')),
    categoryKey: v.string(),
    applyRetroactively: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx)
    const member = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!member) throw new Error('Not a workspace member')

    const ruleId = await ctx.db.insert('categoryRules', {
      workspaceId: member.workspaceId,
      pattern: args.pattern,
      matchType: args.matchType,
      categoryKey: args.categoryKey,
      createdBy: userId,
      createdAt: Date.now(),
    })

    if (args.applyRetroactively) {
      await ctx.scheduler.runAfter(
        0,
        internal.categoryRules.applyRuleToExisting,
        {
          ruleId,
        },
      )
    }

    return ruleId
  },
})

export const updateRule = mutation({
  args: {
    ruleId: v.id('categoryRules'),
    pattern: v.optional(v.string()),
    matchType: v.optional(v.union(v.literal('contains'), v.literal('regex'))),
    categoryKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx)
    const member = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!member) throw new Error('Not a workspace member')

    const rule = await ctx.db.get('categoryRules', args.ruleId)
    if (!rule || rule.workspaceId !== member.workspaceId) {
      throw new Error('Rule not found')
    }

    const patch: Record<string, string> = {}
    if (args.pattern !== undefined) patch.pattern = args.pattern
    if (args.matchType !== undefined) patch.matchType = args.matchType
    if (args.categoryKey !== undefined) patch.categoryKey = args.categoryKey

    await ctx.db.patch('categoryRules', args.ruleId, patch)
  },
})

export const deleteRule = mutation({
  args: { ruleId: v.id('categoryRules') },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx)
    const member = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!member) throw new Error('Not a workspace member')

    const rule = await ctx.db.get('categoryRules', args.ruleId)
    if (!rule || rule.workspaceId !== member.workspaceId) {
      throw new Error('Rule not found')
    }

    await ctx.db.delete('categoryRules', args.ruleId)
  },
})

export const applyRuleToExisting = internalAction({
  args: { ruleId: v.id('categoryRules') },
  handler: async (_ctx, _args) => {
    // Category rule matching cannot work server-side because transaction text fields
    // (wording, originalWording, simplifiedWording) are now encrypted and the server
    // cannot decrypt them. This needs to move to client-side matching.
    // No-op for now.
  },
})

// Internal helpers

export const getRuleInternal = internalQuery({
  args: { ruleId: v.id('categoryRules') },
  handler: async (ctx, args) => {
    return await ctx.db.get('categoryRules', args.ruleId)
  },
})

export const getWorkspacePortfolios = internalQuery({
  args: { workspaceId: v.id('workspaces') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('portfolios')
      .withIndex('by_workspaceId', (q) => q.eq('workspaceId', args.workspaceId))
      .collect()
  },
})

export const getUncategorizedTransactions = internalQuery({
  args: { portfolioId: v.id('portfolios') },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query('transactions')
      .withIndex('by_portfolioId', (q) => q.eq('portfolioId', args.portfolioId))
      .collect()
    // userCategoryKey is now inside encryptedCategories — server cannot filter by it
    return all.filter((t) => !t.deleted)
  },
})

export const batchSetUserCategoryKey = internalMutation({
  args: {
    items: v.array(
      v.object({
        transactionId: v.id('transactions'),
        categoryKey: v.string(),
      }),
    ),
  },
  handler: async (_ctx, _args) => {
    // userCategoryKey is now inside encryptedCategories — server cannot set it.
    // Category assignment needs to move to client-side.
    // No-op for now.
  },
})

export const listRulesForWorkspace = internalQuery({
  args: { workspaceId: v.id('workspaces') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('categoryRules')
      .withIndex('by_workspaceId', (q) => q.eq('workspaceId', args.workspaceId))
      .collect()
  },
})
