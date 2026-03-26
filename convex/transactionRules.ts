import { v } from 'convex/values'
import { internalQuery, mutation, query } from './_generated/server'
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

    const rules = await ctx.db
      .query('transactionRules')
      .withIndex('by_workspaceId', (q) =>
        q.eq('workspaceId', member.workspaceId),
      )
      .collect()
    return rules.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  },
})

export const createRule = mutation({
  args: {
    pattern: v.string(),
    matchType: v.union(v.literal('contains'), v.literal('regex')),
    categoryKey: v.optional(v.string()),
    excludeFromBudget: v.optional(v.boolean()),
    labelIds: v.optional(v.array(v.id('transactionLabels'))),
    customDescription: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx)
    const member = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!member || member.role !== 'owner') {
      throw new Error('Only workspace owners can create rules')
    }

    if (
      !args.categoryKey &&
      !args.excludeFromBudget &&
      !args.customDescription &&
      (!args.labelIds || args.labelIds.length === 0)
    ) {
      throw new Error('At least one action is required')
    }

    const existingRules = await ctx.db
      .query('transactionRules')
      .withIndex('by_workspaceId', (q) =>
        q.eq('workspaceId', member.workspaceId),
      )
      .collect()
    const maxOrder = existingRules.reduce(
      (max, r) => Math.max(max, r.sortOrder ?? 0),
      0,
    )

    return await ctx.db.insert('transactionRules', {
      workspaceId: member.workspaceId,
      pattern: args.pattern,
      matchType: args.matchType,
      categoryKey: args.categoryKey,
      excludeFromBudget: args.excludeFromBudget,
      labelIds: args.labelIds,
      customDescription: args.customDescription,
      enabled: true,
      sortOrder: existingRules.length === 0 ? 0 : maxOrder + 1,
      createdBy: userId,
      createdAt: Date.now(),
    })
  },
})

export const updateRule = mutation({
  args: {
    ruleId: v.id('transactionRules'),
    pattern: v.optional(v.string()),
    matchType: v.optional(v.union(v.literal('contains'), v.literal('regex'))),
    categoryKey: v.optional(v.string()),
    excludeFromBudget: v.optional(v.boolean()),
    labelIds: v.optional(v.array(v.id('transactionLabels'))),
    customDescription: v.optional(v.string()),
    enabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx)
    const member = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!member || member.role !== 'owner') {
      throw new Error('Only workspace owners can update rules')
    }

    const rule = await ctx.db.get(args.ruleId)
    if (!rule || rule.workspaceId !== member.workspaceId) {
      throw new Error('Rule not found')
    }

    await ctx.db.patch(args.ruleId, {
      ...(args.pattern !== undefined && { pattern: args.pattern }),
      ...(args.matchType !== undefined && { matchType: args.matchType }),
      ...(args.categoryKey !== undefined && {
        categoryKey: args.categoryKey || undefined,
      }),
      ...(args.excludeFromBudget !== undefined && {
        excludeFromBudget: args.excludeFromBudget || undefined,
      }),
      ...(args.labelIds !== undefined && {
        labelIds: args.labelIds.length > 0 ? args.labelIds : undefined,
      }),
      ...(args.customDescription !== undefined && {
        customDescription: args.customDescription || undefined,
      }),
      ...(args.enabled !== undefined && { enabled: args.enabled }),
    })
  },
})

export const toggleRule = mutation({
  args: {
    ruleId: v.id('transactionRules'),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx)
    const member = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!member || member.role !== 'owner') {
      throw new Error('Only workspace owners can toggle rules')
    }

    const rule = await ctx.db.get(args.ruleId)
    if (!rule || rule.workspaceId !== member.workspaceId) {
      throw new Error('Rule not found')
    }

    await ctx.db.patch(args.ruleId, { enabled: args.enabled })
  },
})

export const deleteRule = mutation({
  args: { ruleId: v.id('transactionRules') },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx)
    const member = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!member || member.role !== 'owner') {
      throw new Error('Only workspace owners can delete rules')
    }

    const rule = await ctx.db.get(args.ruleId)
    if (!rule || rule.workspaceId !== member.workspaceId) {
      throw new Error('Rule not found')
    }

    await ctx.db.delete(args.ruleId)
  },
})

export const batchDeleteRules = mutation({
  args: { ruleIds: v.array(v.id('transactionRules')) },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx)
    const member = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!member || member.role !== 'owner') {
      throw new Error('Only workspace owners can delete rules')
    }

    for (const ruleId of args.ruleIds) {
      const rule = await ctx.db.get(ruleId)
      if (rule && rule.workspaceId === member.workspaceId) {
        await ctx.db.delete(ruleId)
      }
    }
  },
})

export const reorderRules = mutation({
  args: { orderedRuleIds: v.array(v.id('transactionRules')) },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx)
    const member = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!member || member.role !== 'owner') {
      throw new Error('Only workspace owners can reorder rules')
    }

    for (let i = 0; i < args.orderedRuleIds.length; i++) {
      const rule = await ctx.db.get(args.orderedRuleIds[i])
      if (!rule || rule.workspaceId !== member.workspaceId) {
        throw new Error('Rule not found')
      }
      await ctx.db.patch(args.orderedRuleIds[i], { sortOrder: i })
    }
  },
})

// Internal helpers

export const listRulesForWorkspace = internalQuery({
  args: { workspaceId: v.id('workspaces') },
  handler: async (ctx, args) => {
    const rules = await ctx.db
      .query('transactionRules')
      .withIndex('by_workspaceId', (q) => q.eq('workspaceId', args.workspaceId))
      .collect()
    return rules.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  },
})
