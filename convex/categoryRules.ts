import { v } from 'convex/values'
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server'
import { internal } from './_generated/api'
import { getAuthUserId, requireAuthUserId } from './lib/auth'
import type { Id } from './_generated/dataModel'

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
  handler: async (ctx, args) => {
    const rule = await ctx.runQuery(internal.categoryRules.getRuleInternal, {
      ruleId: args.ruleId,
    })
    if (!rule) return

    const profiles = await ctx.runQuery(
      internal.categoryRules.getWorkspaceProfiles,
      {
        workspaceId: rule.workspaceId,
      },
    )

    for (const profile of profiles) {
      const transactions = await ctx.runQuery(
        internal.categoryRules.getUncategorizedTransactions,
        { profileId: profile._id },
      )

      const matches: Array<{
        transactionId: Id<'transactions'>
        categoryKey: string
      }> = []

      for (const txn of transactions) {
        const text = [txn.wording, txn.originalWording, txn.simplifiedWording]
          .filter(Boolean)
          .join(' ')

        let matched = false
        if (rule.matchType === 'contains') {
          matched = text.toLowerCase().includes(rule.pattern.toLowerCase())
        } else {
          try {
            matched = new RegExp(rule.pattern, 'i').test(text)
          } catch {
            // invalid regex, skip
          }
        }

        if (matched) {
          matches.push({
            transactionId: txn._id,
            categoryKey: rule.categoryKey,
          })
        }
      }

      if (matches.length > 0) {
        await ctx.runMutation(internal.categoryRules.batchSetUserCategoryKey, {
          items: matches,
        })
      }
    }
  },
})

// Internal helpers

export const getRuleInternal = internalQuery({
  args: { ruleId: v.id('categoryRules') },
  handler: async (ctx, args) => {
    return await ctx.db.get('categoryRules', args.ruleId)
  },
})

export const getWorkspaceProfiles = internalQuery({
  args: { workspaceId: v.id('workspaces') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('profiles')
      .withIndex('by_workspaceId', (q) => q.eq('workspaceId', args.workspaceId))
      .collect()
  },
})

export const getUncategorizedTransactions = internalQuery({
  args: { profileId: v.id('profiles') },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query('transactions')
      .withIndex('by_profileId', (q) => q.eq('profileId', args.profileId))
      .collect()
    return all.filter((t) => !t.deleted && !t.userCategoryKey)
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
  handler: async (ctx, args) => {
    for (const item of args.items) {
      await ctx.db.patch('transactions', item.transactionId, {
        userCategoryKey: item.categoryKey,
      })
    }
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
