import { Agent, listUIMessages, syncStreams } from '@convex-dev/agent'
import { vStreamArgs } from '@convex-dev/agent/validators'
import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'
import { api, components, internal } from './_generated/api'
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server'
import { chatModel } from './lib/aiModels'
import { requireAuthUserId } from './lib/auth'

// Agent instance for saveMessage (no LLM calls, just message persistence)
const chatAgent = new Agent(components.agent, {
  name: 'bunkr-assistant',
  languageModel: chatModel(),
  instructions: '',
  maxSteps: 1,
})

// --- Queries ---

export const listThreads = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx)

    const metadataRows = await ctx.db
      .query('agentThreadMetadata')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .collect()

    const threads = await Promise.all(
      metadataRows.map(async (row) => {
        const thread = await ctx.runQuery(components.agent.threads.getThread, {
          threadId: row.threadId,
        })
        return {
          threadId: row.threadId,
          title: thread?.title ?? null,
          createdAt: row.createdAt,
        }
      }),
    )

    return threads.sort((a, b) => b.createdAt - a.createdAt)
  },
})

export const getThread = query({
  args: { threadId: v.string() },
  handler: async (ctx, { threadId }) => {
    await requireAuthUserId(ctx)

    const thread = await ctx.runQuery(components.agent.threads.getThread, {
      threadId,
    })

    const metadata = await ctx.db
      .query('agentThreadMetadata')
      .withIndex('by_threadId', (q) => q.eq('threadId', threadId))
      .first()

    return {
      threadId,
      title: thread?.title ?? null,
      portfolioScope: metadata?.portfolioScope ?? null,
      portfolioId: metadata?.portfolioId ?? null,
    }
  },
})

export const listThreadMessages = query({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
    streamArgs: vStreamArgs,
  },
  handler: async (ctx, args) => {
    const { threadId, paginationOpts } = args
    const userId = await requireAuthUserId(ctx)

    // Verify thread belongs to user's workspace
    const metadata = await ctx.db
      .query('agentThreadMetadata')
      .withIndex('by_threadId', (q) => q.eq('threadId', threadId))
      .first()
    if (!metadata) throw new Error('Thread not found')

    const membership = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!membership || membership.workspaceId !== metadata.workspaceId) {
      throw new Error('Access denied')
    }

    const paginated = await listUIMessages(ctx, components.agent, {
      threadId,
      paginationOpts,
    })

    const streams = await syncStreams(ctx, components.agent, args)

    return { ...paginated, streams }
  },
})

// --- Mutations ---

export const createThread = mutation({
  args: {
    portfolioId: v.optional(v.id('portfolios')),
    portfolioScope: v.optional(
      v.union(v.literal('portfolio'), v.literal('all'), v.literal('team')),
    ),
  },
  handler: async (ctx, { portfolioId, portfolioScope }) => {
    const userId = await requireAuthUserId(ctx)

    const membership = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!membership) throw new Error('Workspace membership not found')

    const workspace = await ctx.db.get('workspaces', membership.workspaceId)
    if (!workspace?.agentEnabled) {
      throw new Error('Bunkr Agent is not enabled for this workspace')
    }

    const thread = await ctx.runMutation(
      components.agent.threads.createThread,
      { userId },
    )

    await ctx.db.insert('agentThreadMetadata', {
      workspaceId: membership.workspaceId,
      userId,
      threadId: thread._id,
      portfolioId,
      portfolioScope,
      createdAt: Date.now(),
    })

    return { threadId: thread._id }
  },
})

export const sendMessage = mutation({
  args: {
    threadId: v.string(),
    prompt: v.string(),
  },
  handler: async (ctx, { threadId, prompt }) => {
    const userId = await requireAuthUserId(ctx)

    const metadata = await ctx.db
      .query('agentThreadMetadata')
      .withIndex('by_threadId', (q) => q.eq('threadId', threadId))
      .first()
    if (!metadata) throw new Error('Thread not found')

    const membership = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!membership || membership.workspaceId !== metadata.workspaceId) {
      throw new Error('Access denied')
    }

    // Save user message (enables optimistic updates)
    const { messageId } = await chatAgent.saveMessage(ctx, {
      threadId,
      prompt,
      skipEmbeddings: true,
    })

    // Schedule async streaming response
    await ctx.scheduler.runAfter(0, api.agentChat.streamResponse, {
      threadId,
      promptMessageId: messageId,
      workspaceId: metadata.workspaceId,
    })

    // Schedule title generation
    await ctx.scheduler.runAfter(0, internal.agentChat.generateTitle, {
      threadId,
      prompt,
    })
  },
})

export const deleteThread = mutation({
  args: { threadId: v.string() },
  handler: async (ctx, { threadId }) => {
    const userId = await requireAuthUserId(ctx)

    const metadata = await ctx.db
      .query('agentThreadMetadata')
      .withIndex('by_threadId', (q) => q.eq('threadId', threadId))
      .first()
    if (!metadata) return

    const membership = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!membership || membership.workspaceId !== metadata.workspaceId) {
      throw new Error('Access denied')
    }

    await ctx.db.delete(metadata._id)

    await ctx.runMutation(components.agent.threads.deleteAllForThreadIdAsync, {
      threadId,
    })
  },
})

// --- Tool approval ---

export const submitApproval = mutation({
  args: {
    threadId: v.string(),
    approvalId: v.string(),
    approved: v.boolean(),
    reason: v.optional(v.string()),
  },
  returns: v.object({ messageId: v.string() }),
  handler: async (ctx, { threadId, approvalId, approved, reason }) => {
    const userId = await requireAuthUserId(ctx)

    const metadata = await ctx.db
      .query('agentThreadMetadata')
      .withIndex('by_threadId', (q) => q.eq('threadId', threadId))
      .first()
    if (!metadata) throw new Error('Thread not found')

    const membership = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!membership || membership.workspaceId !== metadata.workspaceId) {
      throw new Error('Access denied')
    }

    const denialReason = reason
      ? `DENIED by user. Reason: ${reason}. Do NOT proceed with the denied action. Follow the user's instruction instead.`
      : 'DENIED by user. Do NOT proceed with this action. Ask the user what they would like to do instead.'
    const { messageId } = approved
      ? await chatAgent.approveToolCall(ctx, { threadId, approvalId, reason })
      : await chatAgent.denyToolCall(ctx, {
          threadId,
          approvalId,
          reason: denialReason,
        })

    return { messageId }
  },
})

export const triggerContinuation = mutation({
  args: {
    threadId: v.string(),
    lastApprovalMessageId: v.string(),
  },
  handler: async (ctx, { threadId, lastApprovalMessageId }) => {
    const userId = await requireAuthUserId(ctx)

    const metadata = await ctx.db
      .query('agentThreadMetadata')
      .withIndex('by_threadId', (q) => q.eq('threadId', threadId))
      .first()
    if (!metadata) throw new Error('Thread not found')

    const membership = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!membership || membership.workspaceId !== metadata.workspaceId) {
      throw new Error('Access denied')
    }

    await ctx.scheduler.runAfter(0, api.agentChat.streamResponse, {
      threadId,
      promptMessageId: lastApprovalMessageId,
      workspaceId: metadata.workspaceId,
    })
  },
})

// --- Internal queries (used by agent tools) ---

export const getThreadMetadata = internalQuery({
  args: { threadId: v.string() },
  handler: async (ctx, { threadId }) => {
    return ctx.db
      .query('agentThreadMetadata')
      .withIndex('by_threadId', (q) => q.eq('threadId', threadId))
      .first()
  },
})

export const listPortfoliosByWorkspace = internalQuery({
  args: { workspaceId: v.id('workspaces') },
  handler: async (ctx, { workspaceId }) => {
    return ctx.db
      .query('portfolios')
      .withIndex('by_workspaceId', (q) => q.eq('workspaceId', workspaceId))
      .collect()
  },
})

export const listTransactionsByDateRange = internalQuery({
  args: {
    portfolioId: v.id('portfolios'),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, { portfolioId, startDate, endDate }) => {
    const results = await ctx.db
      .query('transactions')
      .withIndex('by_portfolioId_date', (q) =>
        q
          .eq('portfolioId', portfolioId)
          .gte('date', startDate)
          .lte('date', endDate),
      )
      .collect()
    return results.filter(
      (t) => !t.deleted && !t.coming && !t.excludedFromBudget,
    )
  },
})

export const listBankAccountsByPortfolios = internalQuery({
  args: {
    portfolioIds: v.array(v.id('portfolios')),
  },
  handler: async (ctx, { portfolioIds }) => {
    const results = await Promise.all(
      portfolioIds.map((portfolioId) =>
        ctx.db
          .query('bankAccounts')
          .withIndex('by_portfolioId', (q) => q.eq('portfolioId', portfolioId))
          .collect(),
      ),
    )
    return results.flat().filter((a) => !a.deleted && !a.disabled)
  },
})

export const listCategoriesByWorkspace = internalQuery({
  args: { workspaceId: v.id('workspaces') },
  handler: async (ctx, { workspaceId }) => {
    return ctx.db
      .query('transactionCategories')
      .withIndex('by_workspaceId', (q) => q.eq('workspaceId', workspaceId))
      .collect()
  },
})

export const listLabelsByWorkspace = internalQuery({
  args: { workspaceId: v.id('workspaces') },
  handler: async (ctx, { workspaceId }) => {
    return ctx.db
      .query('transactionLabels')
      .withIndex('by_workspaceId', (q) => q.eq('workspaceId', workspaceId))
      .collect()
  },
})

export const listInvestmentsByPortfolios = internalQuery({
  args: {
    portfolioIds: v.array(v.id('portfolios')),
  },
  handler: async (ctx, { portfolioIds }) => {
    const results = await Promise.all(
      portfolioIds.map((portfolioId) =>
        ctx.db
          .query('investments')
          .withIndex('by_portfolioId', (q) => q.eq('portfolioId', portfolioId))
          .collect(),
      ),
    )
    return results.flat().filter((inv) => !inv.deleted)
  },
})

export const listSnapshotsByPortfolios = internalQuery({
  args: {
    portfolioIds: v.array(v.id('portfolios')),
    startTimestamp: v.number(),
    endTimestamp: v.number(),
  },
  handler: async (ctx, { portfolioIds, startTimestamp, endTimestamp }) => {
    const results = await Promise.all(
      portfolioIds.map((portfolioId) =>
        ctx.db
          .query('balanceSnapshots')
          .withIndex('by_portfolioId_timestamp', (q) =>
            q
              .eq('portfolioId', portfolioId)
              .gte('timestamp', startTimestamp)
              .lte('timestamp', endTimestamp),
          )
          .collect(),
      ),
    )
    return results.flat()
  },
})

export const listRulesByWorkspace = internalQuery({
  args: { workspaceId: v.id('workspaces') },
  handler: async (ctx, { workspaceId }) => {
    return ctx.db
      .query('transactionRules')
      .withIndex('by_workspaceId', (q) => q.eq('workspaceId', workspaceId))
      .collect()
  },
})

export const getTransactionById = internalQuery({
  args: { transactionId: v.id('transactions') },
  handler: async (ctx, { transactionId }) => {
    return ctx.db.get(transactionId)
  },
})

export const getWorkspacePublicKey = internalQuery({
  args: { workspaceId: v.id('workspaces') },
  handler: async (ctx, { workspaceId }) => {
    const wsEnc = await ctx.db
      .query('workspaceEncryption')
      .withIndex('by_workspaceId', (q) => q.eq('workspaceId', workspaceId))
      .first()
    return wsEnc?.publicKey ?? null
  },
})

export const updateTransactionCategoriesInternal = internalMutation({
  args: {
    updates: v.array(
      v.object({
        transactionId: v.id('transactions'),
        encryptedCategories: v.string(),
      }),
    ),
  },
  handler: async (ctx, { updates }) => {
    for (const { transactionId, encryptedCategories } of updates) {
      await ctx.db.patch(transactionId, { encryptedCategories })
    }
  },
})

// --- Thread cleanup ---

export const purgeExpiredThreads = internalMutation({
  args: {
    workspaceId: v.id('workspaces'),
    retentionDays: v.number(),
  },
  handler: async (ctx, { workspaceId, retentionDays }) => {
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000
    const expired = await ctx.db
      .query('agentThreadMetadata')
      .withIndex('by_workspaceId', (q) => q.eq('workspaceId', workspaceId))
      .collect()

    let deleted = 0
    for (const meta of expired) {
      if (meta.createdAt < cutoff) {
        await ctx.db.delete(meta._id)
        await ctx.runMutation(
          components.agent.threads.deleteAllForThreadIdAsync,
          { threadId: meta.threadId },
        )
        deleted++
      }
    }
    return { deleted }
  },
})

export const purgeExpiredThreadsForAllWorkspaces = internalAction({
  args: {},
  handler: async (ctx) => {
    const workspaces = await ctx.runQuery(
      internal.agentChatQueries.listWorkspacesWithAgent,
    )
    for (const ws of workspaces) {
      await ctx.runMutation(internal.agentChatQueries.purgeExpiredThreads, {
        workspaceId: ws.workspaceId,
        retentionDays: ws.retentionDays,
      })
    }
  },
})

export const listWorkspacesWithAgent = internalQuery({
  args: {},
  handler: async (ctx) => {
    const workspaces = await ctx.db.query('workspaces').collect()

    const results: Array<{
      workspaceId: (typeof workspaces)[0]['_id']
      retentionDays: number
    }> = []

    for (const ws of workspaces) {
      if (!ws.agentEnabled) continue
      const settings = await ctx.db
        .query('agentSettings')
        .withIndex('by_workspaceId', (q) => q.eq('workspaceId', ws._id))
        .first()
      results.push({
        workspaceId: ws._id,
        retentionDays: settings?.threadRetentionDays ?? 7,
      })
    }
    return results
  },
})
