import type { GenericDatabaseWriter, PaginationResult } from 'convex/server'
import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'
import type { DataModel, Doc, Id } from './_generated/dataModel'
import { internalMutation, query } from './_generated/server'
import { getAuthUserId } from './lib/auth'

// 90 days in milliseconds
export const AUDIT_LOG_RETENTION_MS = 90 * 24 * 60 * 60 * 1000

/** Direct db.insert helper for use inside mutations/internalMutations */
export async function insertAuditLogDirect(
  db: GenericDatabaseWriter<DataModel>,
  entry: {
    workspaceId: Id<'workspaces'>
    workspaceName: string
    portfolioId?: Id<'portfolios'>
    portfolioName?: string
    actorType: 'user' | 'system'
    actorId?: string
    actorName?: string
    actorAvatarUrl?: string
    event: string
    resourceType?: string
    resourceId?: string
    resourceName?: string
    metadata: string
  },
) {
  const now = Date.now()
  await db.insert('auditLogs', {
    timestamp: now,
    retainUntil: now + AUDIT_LOG_RETENTION_MS,
    workspaceId: entry.workspaceId,
    workspaceName: entry.workspaceName,
    portfolioId: entry.portfolioId,
    portfolioName: entry.portfolioName,
    actorType: entry.actorType,
    actorId: entry.actorId,
    actorName: entry.actorName,
    actorAvatarUrl: entry.actorAvatarUrl,
    event: entry.event,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId,
    resourceName: entry.resourceName,
    metadata: entry.metadata,
  })
}

// Discriminated union of all audit log metadata payloads
export type AuditMetadata =
  | {
      type: 'transaction.labels_updated'
      data: {
        transactionId: string
        previousLabelIds: string[]
        newLabelIds: string[]
        labelCount: number
        addedLabelNames?: string[]
        removedLabelNames?: string[]
      }
    }
  | {
      type: 'transaction.labels_batch_updated'
      data: {
        affectedCount: number
        addLabelIds?: string[]
        removeLabelIds?: string[]
      }
    }
  | {
      type: 'transaction.excluded_from_budget'
      data: { transactionId: string; previousValue: boolean; newValue: true }
    }
  | {
      type: 'transaction.included_in_budget'
      data: { transactionId: string; previousValue: boolean; newValue: false }
    }
  | {
      type: 'transaction.exclusion_batch_updated'
      data: { affectedCount: number; excludedFromBudget: boolean }
    }
  | {
      type: 'transaction.description_updated'
      data: { transactionId: string; hadPreviousDescription: boolean }
    }
  | {
      type: 'transaction.description_batch_updated'
      data: { affectedCount: number }
    }
  | {
      type: 'transaction.category_updated'
      data: {
        transactionId: string
        categoryKey?: string
        categoryLabel?: string
        previousCategoryKey?: string
        previousCategoryLabel?: string
      }
    }
  | {
      type: 'transaction.category_batch_updated'
      data: { affectedCount: number }
    }
  | {
      type: 'rule.created'
      data: {
        ruleId: string
        pattern: string
        matchType: 'contains' | 'regex'
        categoryKey?: string
        excludeFromBudget?: boolean
        labelCount?: number
      }
    }
  | {
      type: 'rule.updated'
      data: {
        ruleId: string
        pattern: string
        changedFields: string[]
        changes?: Record<string, { from: unknown; to: unknown }>
      }
    }
  | { type: 'rule.toggled'; data: { ruleId: string; enabled: boolean } }
  | { type: 'rule.deleted'; data: { ruleId: string; pattern: string } }
  | { type: 'rule.batch_deleted'; data: { ruleIds: string[]; count: number } }
  | { type: 'rule.reordered'; data: { count: number } }
  | {
      type: 'workspace.renamed'
      data: { previousName: string; newName: string }
    }
  | { type: 'workspace.member_invited'; data: { invitedEmail: string } }
  | { type: 'workspace.member_removed'; data: { removedUserId: string } }
  | {
      type: 'workspace.member_permissions_updated'
      data: {
        memberId: string
        permissions: {
          canViewTeamDashboard: boolean
          canViewMemberBreakdown: boolean
        }
      }
    }
  | { type: 'workspace.invitation_revoked'; data: { invitedEmail: string } }
  | {
      type: 'transaction.synced'
      data: {
        bankAccountId: string
        portfolioId: string
        created: number
        updated: number
      }
    }
  | {
      type: 'transaction.rule_applied'
      data: {
        transactionId: string
        ruleId: string
        rulePattern: string
        appliedActions: string[]
      }
    }
  | {
      type: 'connection.synced'
      data: {
        connectionId: string
        powensConnectionId: number
        portfolioId: string
      }
    }
  | {
      type: 'connection.state_changed'
      data: { connectionId: string; previousState?: string; newState: string }
    }

export const insertAuditLog = internalMutation({
  args: {
    workspaceId: v.id('workspaces'),
    workspaceName: v.string(),
    portfolioId: v.optional(v.id('portfolios')),
    portfolioName: v.optional(v.string()),
    actorType: v.union(v.literal('user'), v.literal('system')),
    actorId: v.optional(v.string()),
    actorName: v.optional(v.string()),
    actorAvatarUrl: v.optional(v.string()),
    event: v.string(),
    resourceType: v.optional(v.string()),
    resourceId: v.optional(v.string()),
    resourceName: v.optional(v.string()),
    metadata: v.string(),
    retainUntil: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('auditLogs', {
      timestamp: Date.now(),
      retainUntil: args.retainUntil ?? Date.now() + AUDIT_LOG_RETENTION_MS,
      workspaceId: args.workspaceId,
      workspaceName: args.workspaceName,
      portfolioId: args.portfolioId,
      portfolioName: args.portfolioName,
      actorType: args.actorType,
      actorId: args.actorId,
      actorName: args.actorName,
      actorAvatarUrl: args.actorAvatarUrl,
      event: args.event,
      resourceType: args.resourceType,
      resourceId: args.resourceId,
      resourceName: args.resourceName,
      metadata: args.metadata,
    })
  },
})

export const listByTransactionPublic = query({
  args: {
    transactionId: v.id('transactions'),
    portfolioId: v.id('portfolios'),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const emptyPage = {
      page: [],
      isDone: true,
      continueCursor: '',
    } as PaginationResult<Doc<'auditLogs'>>

    const userId = await getAuthUserId(ctx)
    if (!userId) return emptyPage

    // Verify the caller owns the portfolio/workspace
    const portfolio = await ctx.db.get(args.portfolioId)
    if (!portfolio) return emptyPage

    const member = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!member || member.workspaceId !== portfolio.workspaceId)
      return emptyPage

    return await ctx.db
      .query('auditLogs')
      .withIndex('by_resourceId_timestamp', (q) =>
        q.eq('resourceId', args.transactionId),
      )
      .order('desc')
      .paginate(args.paginationOpts)
  },
})

export const listByWorkspace = query({
  args: {
    workspaceId: v.id('workspaces'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []

    // Verify membership
    const member = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!member || member.workspaceId !== args.workspaceId) return []

    return await ctx.db
      .query('auditLogs')
      .withIndex('by_workspaceId_timestamp', (q) =>
        q.eq('workspaceId', args.workspaceId),
      )
      .order('desc')
      .take(args.limit ?? 100)
  },
})

export const insertRuleApplicationLogs = internalMutation({
  args: {
    workspaceId: v.id('workspaces'),
    workspaceName: v.string(),
    portfolioId: v.optional(v.id('portfolios')),
    portfolioName: v.optional(v.string()),
    entries: v.array(
      v.object({
        transactionId: v.string(),
        ruleId: v.string(),
        rulePattern: v.string(),
        appliedActions: v.array(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    for (const entry of args.entries) {
      await insertAuditLogDirect(ctx.db, {
        workspaceId: args.workspaceId,
        workspaceName: args.workspaceName,
        portfolioId: args.portfolioId,
        portfolioName: args.portfolioName,
        actorType: 'system',
        event: 'transaction.rule_applied',
        resourceType: 'transaction',
        resourceId: entry.transactionId,
        metadata: JSON.stringify({
          transactionId: entry.transactionId,
          ruleId: entry.ruleId,
          rulePattern: entry.rulePattern,
          appliedActions: entry.appliedActions,
        }),
      })
    }
  },
})

export const purgeExpiredLogs = internalMutation({
  handler: async (ctx) => {
    const now = Date.now()
    const expired = await ctx.db
      .query('auditLogs')
      .withIndex('by_retainUntil', (q) => q.lt('retainUntil', now))
      .collect()

    for (const log of expired) {
      await ctx.db.delete(log._id)
    }

    return { deleted: expired.length }
  },
})
