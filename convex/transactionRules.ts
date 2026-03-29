import { v } from 'convex/values'
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server'
import { insertAuditLogDirect } from './auditLog'
import { getActorInfo, getAuthUserId, requireAuthUserId } from './lib/auth'

export const listRules = query({
  args: {
    portfolioId: v.optional(v.id('portfolios')),
  },
  handler: async (ctx, args) => {
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

    if (args.portfolioId) {
      // Portfolio view: portfolio-specific rules first, then inherited workspace rules
      const portfolioRules = rules
        .filter((r) => r.portfolioId === args.portfolioId)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      const workspaceRules = rules
        .filter((r) => !r.portfolioId)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      return [...portfolioRules, ...workspaceRules]
    }

    // Workspace view: only workspace-global rules
    return rules
      .filter((r) => !r.portfolioId)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
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
    portfolioId: v.optional(v.id('portfolios')),
    accountIds: v.optional(v.array(v.id('bankAccounts'))),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx)
    const member = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!member) {
      throw new Error('Not authorized')
    }
    if (!args.portfolioId && member.role !== 'owner') {
      throw new Error('Only workspace owners can create workspace rules')
    }

    if (
      !args.categoryKey &&
      !args.excludeFromBudget &&
      !args.customDescription &&
      (!args.labelIds || args.labelIds.length === 0)
    ) {
      throw new Error('At least one action is required')
    }

    // Validate portfolio belongs to workspace
    if (args.portfolioId) {
      const portfolio = await ctx.db.get(args.portfolioId)
      if (!portfolio) {
        throw new Error('Portfolio not found')
      }
      // Portfolio must belong to a member of this workspace
      const portfolioMember = await ctx.db.get(portfolio.memberId)
      if (
        !portfolioMember ||
        portfolioMember.workspaceId !== member.workspaceId
      ) {
        throw new Error('Portfolio does not belong to this workspace')
      }
    }

    // Validate accountIds belong to the correct scope
    if (args.accountIds && args.accountIds.length > 0) {
      for (const accountId of args.accountIds) {
        const account = await ctx.db.get(accountId)
        if (!account) {
          throw new Error('Bank account not found')
        }
        if (args.portfolioId && account.portfolioId !== args.portfolioId) {
          throw new Error(
            'Bank account does not belong to the specified portfolio',
          )
        }
      }
    }

    // Compute sortOrder within the same scope
    const allRules = await ctx.db
      .query('transactionRules')
      .withIndex('by_workspaceId', (q) =>
        q.eq('workspaceId', member.workspaceId),
      )
      .collect()
    const scopeRules = allRules.filter((r) =>
      args.portfolioId ? r.portfolioId === args.portfolioId : !r.portfolioId,
    )
    const maxOrder = scopeRules.reduce(
      (max, r) => Math.max(max, r.sortOrder ?? 0),
      0,
    )

    const ruleId = await ctx.db.insert('transactionRules', {
      workspaceId: member.workspaceId,
      portfolioId: args.portfolioId,
      accountIds:
        args.accountIds && args.accountIds.length > 0
          ? args.accountIds
          : undefined,
      pattern: args.pattern,
      matchType: args.matchType,
      categoryKey: args.categoryKey,
      excludeFromBudget: args.excludeFromBudget,
      labelIds: args.labelIds,
      customDescription: args.customDescription,
      enabled: true,
      sortOrder: scopeRules.length === 0 ? 0 : maxOrder + 1,
      createdBy: userId,
      createdAt: Date.now(),
    })

    const workspace = await ctx.db.get('workspaces', member.workspaceId)
    const identity = await ctx.auth.getUserIdentity()
    await insertAuditLogDirect(ctx.db, {
      workspaceId: member.workspaceId,
      workspaceName: workspace?.name ?? '',
      actorType: 'user',
      ...getActorInfo(identity),
      event: 'rule.created',
      resourceType: 'rule',
      resourceId: ruleId,
      metadata: JSON.stringify({
        ruleId,
        pattern: args.pattern,
        matchType: args.matchType,
        categoryKey: args.categoryKey,
        excludeFromBudget: args.excludeFromBudget,
        labelCount: args.labelIds?.length ?? 0,
        portfolioId: args.portfolioId,
        accountIds: args.accountIds,
      }),
    })

    return ruleId
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
    accountIds: v.optional(v.array(v.id('bankAccounts'))),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx)
    const member = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!member) {
      throw new Error('Not authorized')
    }

    const rule = await ctx.db.get(args.ruleId)
    if (!rule || rule.workspaceId !== member.workspaceId) {
      throw new Error('Rule not found')
    }
    if (!rule.portfolioId && member.role !== 'owner') {
      throw new Error('Only workspace owners can update workspace rules')
    }

    // Validate accountIds belong to the correct scope
    if (args.accountIds !== undefined && args.accountIds.length > 0) {
      for (const accountId of args.accountIds) {
        const account = await ctx.db.get(accountId)
        if (!account) {
          throw new Error('Bank account not found')
        }
        if (rule.portfolioId && account.portfolioId !== rule.portfolioId) {
          throw new Error('Bank account does not belong to the rule portfolio')
        }
      }
    }

    const changedFields: string[] = []
    if (args.pattern !== undefined && args.pattern !== rule.pattern)
      changedFields.push('pattern')
    if (args.matchType !== undefined && args.matchType !== rule.matchType)
      changedFields.push('matchType')
    if (args.categoryKey !== undefined && args.categoryKey !== rule.categoryKey)
      changedFields.push('categoryKey')
    if (
      args.excludeFromBudget !== undefined &&
      args.excludeFromBudget !== rule.excludeFromBudget
    )
      changedFields.push('excludeFromBudget')
    if (
      args.labelIds !== undefined &&
      JSON.stringify(args.labelIds) !== JSON.stringify(rule.labelIds)
    )
      changedFields.push('labelIds')
    if (
      args.customDescription !== undefined &&
      args.customDescription !== rule.customDescription
    )
      changedFields.push('customDescription')
    if (args.enabled !== undefined && args.enabled !== rule.enabled)
      changedFields.push('enabled')
    if (
      args.accountIds !== undefined &&
      JSON.stringify(args.accountIds) !== JSON.stringify(rule.accountIds)
    )
      changedFields.push('accountIds')

    // Skip if nothing actually changed
    if (changedFields.length === 0) return

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
      ...(args.accountIds !== undefined && {
        accountIds: args.accountIds.length > 0 ? args.accountIds : undefined,
      }),
    })

    const workspace = await ctx.db.get('workspaces', member.workspaceId)
    const identity = await ctx.auth.getUserIdentity()
    await insertAuditLogDirect(ctx.db, {
      workspaceId: member.workspaceId,
      workspaceName: workspace?.name ?? '',
      actorType: 'user',
      ...getActorInfo(identity),
      event: 'rule.updated',
      resourceType: 'rule',
      resourceId: args.ruleId,
      metadata: JSON.stringify({
        ruleId: args.ruleId,
        pattern: args.pattern ?? rule.pattern,
        changedFields,
        changes: Object.fromEntries(
          changedFields.map((field) => [
            field,
            {
              from: rule[field as keyof typeof rule],
              to: args[field as keyof typeof args],
            },
          ]),
        ),
      }),
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
    if (!member) {
      throw new Error('Not authorized')
    }

    const rule = await ctx.db.get(args.ruleId)
    if (!rule || rule.workspaceId !== member.workspaceId) {
      throw new Error('Rule not found')
    }
    if (!rule.portfolioId && member.role !== 'owner') {
      throw new Error('Only workspace owners can toggle workspace rules')
    }

    await ctx.db.patch(args.ruleId, { enabled: args.enabled })

    const workspace = await ctx.db.get('workspaces', member.workspaceId)
    const identity = await ctx.auth.getUserIdentity()
    await insertAuditLogDirect(ctx.db, {
      workspaceId: member.workspaceId,
      workspaceName: workspace?.name ?? '',
      actorType: 'user',
      ...getActorInfo(identity),
      event: 'rule.toggled',
      resourceType: 'rule',
      resourceId: args.ruleId,
      metadata: JSON.stringify({
        ruleId: args.ruleId,
        pattern: rule.pattern,
        enabled: args.enabled,
      }),
    })
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
    if (!member) {
      throw new Error('Not authorized')
    }

    const rule = await ctx.db.get(args.ruleId)
    if (!rule || rule.workspaceId !== member.workspaceId) {
      throw new Error('Rule not found')
    }
    if (!rule.portfolioId && member.role !== 'owner') {
      throw new Error('Only workspace owners can delete workspace rules')
    }

    await ctx.db.delete(args.ruleId)

    const workspace = await ctx.db.get('workspaces', member.workspaceId)
    const identity = await ctx.auth.getUserIdentity()
    await insertAuditLogDirect(ctx.db, {
      workspaceId: member.workspaceId,
      workspaceName: workspace?.name ?? '',
      actorType: 'user',
      ...getActorInfo(identity),
      event: 'rule.deleted',
      resourceType: 'rule',
      resourceId: args.ruleId,
      metadata: JSON.stringify({
        ruleId: args.ruleId,
        pattern: rule.pattern,
      }),
    })
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
    if (!member) {
      throw new Error('Not authorized')
    }

    let deletedCount = 0
    for (const ruleId of args.ruleIds) {
      const rule = await ctx.db.get(ruleId)
      if (rule && rule.workspaceId === member.workspaceId) {
        if (!rule.portfolioId && member.role !== 'owner') {
          throw new Error('Only workspace owners can delete workspace rules')
        }
        await ctx.db.delete(ruleId)
        deletedCount++
      }
    }

    if (deletedCount > 0) {
      const workspace = await ctx.db.get('workspaces', member.workspaceId)
      const identity = await ctx.auth.getUserIdentity()
      await insertAuditLogDirect(ctx.db, {
        workspaceId: member.workspaceId,
        workspaceName: workspace?.name ?? '',
        actorType: 'user',
        ...getActorInfo(identity),
        event: 'rule.batch_deleted',
        resourceType: 'rule',
        metadata: JSON.stringify({
          ruleIds: args.ruleIds,
          count: deletedCount,
        }),
      })
    }
  },
})

export const reorderRules = mutation({
  args: {
    orderedRuleIds: v.array(v.id('transactionRules')),
    portfolioId: v.optional(v.id('portfolios')),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx)
    const member = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!member) {
      throw new Error('Not authorized')
    }
    if (!args.portfolioId && member.role !== 'owner') {
      throw new Error('Only workspace owners can reorder workspace rules')
    }

    for (let i = 0; i < args.orderedRuleIds.length; i++) {
      const rule = await ctx.db.get(args.orderedRuleIds[i])
      if (!rule || rule.workspaceId !== member.workspaceId) {
        throw new Error('Rule not found')
      }
      // Only reorder rules within the same scope
      const ruleInScope = args.portfolioId
        ? rule.portfolioId === args.portfolioId
        : !rule.portfolioId
      if (!ruleInScope) {
        throw new Error('Rule does not belong to the specified scope')
      }
      await ctx.db.patch(args.orderedRuleIds[i], { sortOrder: i })
    }

    const workspace = await ctx.db.get('workspaces', member.workspaceId)
    const identity = await ctx.auth.getUserIdentity()
    await insertAuditLogDirect(ctx.db, {
      workspaceId: member.workspaceId,
      workspaceName: workspace?.name ?? '',
      actorType: 'user',
      ...getActorInfo(identity),
      event: 'rule.reordered',
      resourceType: 'rule',
      metadata: JSON.stringify({
        count: args.orderedRuleIds.length,
      }),
    })
  },
})

// Internal helpers

export const incrementImpactedCount = internalMutation({
  args: {
    ruleId: v.id('transactionRules'),
    count: v.number(),
  },
  handler: async (ctx, args) => {
    const rule = await ctx.db.get(args.ruleId)
    if (!rule) return
    await ctx.db.patch(args.ruleId, {
      impactedTransactionCount:
        (rule.impactedTransactionCount ?? 0) + args.count,
    })
  },
})

export const recordRuleApplication = mutation({
  args: {
    ruleId: v.id('transactionRules'),
    rulePattern: v.string(),
    transactionIds: v.array(v.id('transactions')),
    appliedActions: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx)
    const member = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!member) throw new Error('Not a workspace member')

    const rule = await ctx.db.get(args.ruleId)
    if (!rule || rule.workspaceId !== member.workspaceId) {
      throw new Error('Rule not found')
    }

    const workspace = await ctx.db.get('workspaces', member.workspaceId)

    for (const transactionId of args.transactionIds) {
      await insertAuditLogDirect(ctx.db, {
        workspaceId: member.workspaceId,
        workspaceName: workspace?.name ?? '',
        actorType: 'system',
        event: 'transaction.rule_applied',
        resourceType: 'transaction',
        resourceId: transactionId,
        metadata: JSON.stringify({
          transactionId,
          ruleId: args.ruleId,
          rulePattern: args.rulePattern,
          appliedActions: args.appliedActions,
        }),
      })
    }

    await ctx.db.patch(args.ruleId, {
      impactedTransactionCount:
        (rule.impactedTransactionCount ?? 0) + args.transactionIds.length,
    })
  },
})

export const listRulesForWorkspace = internalQuery({
  args: {
    workspaceId: v.id('workspaces'),
    portfolioId: v.optional(v.id('portfolios')),
  },
  handler: async (ctx, args) => {
    const rules = await ctx.db
      .query('transactionRules')
      .withIndex('by_workspaceId', (q) => q.eq('workspaceId', args.workspaceId))
      .collect()

    if (args.portfolioId) {
      // Portfolio-specific rules first, then workspace-global rules
      const portfolioRules = rules
        .filter((r) => r.portfolioId === args.portfolioId)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      const workspaceRules = rules
        .filter((r) => !r.portfolioId)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      return [...portfolioRules, ...workspaceRules]
    }

    return rules
      .filter((r) => !r.portfolioId)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  },
})
