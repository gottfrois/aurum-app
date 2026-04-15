import { vProviderMetadata, vUsage } from '@convex-dev/agent/validators'
import { v } from 'convex/values'
import { internalMutation, query } from './_generated/server'
import { getAuthUserId } from './lib/auth'

/**
 * Internal sink for every LLM call made through the agent or a raw AI-SDK
 * helper. Never call this directly from clients — callers should go through
 * `buildUsageHandler` (agent path) or `trackGenerateObjectUsage` (raw path),
 * both in `lib/usageHandler.ts`.
 */
export const insertUsage = internalMutation({
  args: {
    userId: v.optional(v.string()),
    workspaceId: v.optional(v.id('workspaces')),
    threadId: v.optional(v.string()),
    agentName: v.optional(v.string()),
    model: v.string(),
    provider: v.string(),
    usage: vUsage,
    providerMetadata: v.optional(vProviderMetadata),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('aiUsage', args)
  },
})

/**
 * Totals for a workspace over an ad-hoc `[from, to)` ms window, plus a
 * breakdown by provider / model / agentName. Provider-agnostic — `cachedInputTokens`
 * is the AI-SDK v5 cross-provider cache field.
 */
export const getWorkspaceUsage = query({
  args: {
    workspaceId: v.id('workspaces'),
    from: v.number(),
    to: v.number(),
  },
  handler: async (ctx, { workspaceId, from, to }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null

    const member = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!member || member.workspaceId !== workspaceId) return null

    const rows = await ctx.db
      .query('aiUsage')
      .withIndex('by_workspace_createdAt', (q) =>
        q
          .eq('workspaceId', workspaceId)
          .gte('createdAt', from)
          .lt('createdAt', to),
      )
      .collect()

    return summarizeRows(rows)
  },
})

/** Totals for a single thread. Auth via the thread's workspace membership. */
export const getThreadUsage = query({
  args: { threadId: v.string() },
  handler: async (ctx, { threadId }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null

    const meta = await ctx.db
      .query('agentThreadMetadata')
      .withIndex('by_threadId', (q) => q.eq('threadId', threadId))
      .first()
    if (!meta) return null

    const member = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!member || member.workspaceId !== meta.workspaceId) return null

    const rows = await ctx.db
      .query('aiUsage')
      .withIndex('by_threadId', (q) => q.eq('threadId', threadId))
      .collect()

    return summarizeRows(rows)
  },
})

/**
 * Provider-agnostic cache metrics for a workspace window. A call is counted
 * as a hit when `usage.cachedInputTokens > 0` — Anthropic, OpenAI and Gemini
 * all populate that field when their respective caches serve part of the
 * prompt. Deeper per-provider detail (e.g. Anthropic write/read split,
 * OpenAI prefix size, Gemini implicit count) stays raw in `providerMetadata`;
 * this query does not interpret it.
 */
export const getCacheStats = query({
  args: {
    workspaceId: v.id('workspaces'),
    from: v.number(),
    to: v.number(),
  },
  handler: async (ctx, { workspaceId, from, to }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null

    const member = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!member || member.workspaceId !== workspaceId) return null

    const rows = await ctx.db
      .query('aiUsage')
      .withIndex('by_workspace_createdAt', (q) =>
        q
          .eq('workspaceId', workspaceId)
          .gte('createdAt', from)
          .lt('createdAt', to),
      )
      .collect()

    let totalCalls = 0
    let cacheHits = 0
    let totalCachedInputTokens = 0
    const byProvider: Record<
      string,
      {
        calls: number
        cacheHits: number
        cachedInputTokens: number
      }
    > = {}

    for (const row of rows) {
      totalCalls += 1
      const cached = row.usage.cachedInputTokens ?? 0
      if (cached > 0) cacheHits += 1
      totalCachedInputTokens += cached

      let bucket = byProvider[row.provider]
      if (!bucket) {
        bucket = { calls: 0, cacheHits: 0, cachedInputTokens: 0 }
        byProvider[row.provider] = bucket
      }
      bucket.calls += 1
      if (cached > 0) bucket.cacheHits += 1
      bucket.cachedInputTokens += cached
    }

    return {
      totalCalls,
      cacheHits,
      cacheMisses: totalCalls - cacheHits,
      hitRate: totalCalls === 0 ? 0 : cacheHits / totalCalls,
      totalCachedInputTokens,
      byProvider,
    }
  },
})

type Row = {
  provider: string
  model: string
  agentName?: string
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
    reasoningTokens?: number
    cachedInputTokens?: number
  }
}

function summarizeRows(rows: Array<Row>) {
  let promptTokens = 0
  let completionTokens = 0
  let totalTokens = 0
  let reasoningTokens = 0
  let cachedInputTokens = 0

  const byProvider: Record<string, number> = {}
  const byModel: Record<string, number> = {}
  const byAgent: Record<string, number> = {}

  for (const row of rows) {
    promptTokens += row.usage.promptTokens
    completionTokens += row.usage.completionTokens
    totalTokens += row.usage.totalTokens
    reasoningTokens += row.usage.reasoningTokens ?? 0
    cachedInputTokens += row.usage.cachedInputTokens ?? 0

    byProvider[row.provider] =
      (byProvider[row.provider] ?? 0) + row.usage.totalTokens
    byModel[row.model] = (byModel[row.model] ?? 0) + row.usage.totalTokens
    if (row.agentName) {
      byAgent[row.agentName] =
        (byAgent[row.agentName] ?? 0) + row.usage.totalTokens
    }
  }

  return {
    totalCalls: rows.length,
    promptTokens,
    completionTokens,
    totalTokens,
    reasoningTokens,
    cachedInputTokens,
    byProvider,
    byModel,
    byAgent,
  }
}
