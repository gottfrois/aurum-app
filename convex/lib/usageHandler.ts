import type { UsageHandler } from '@convex-dev/agent'
import type { LanguageModel, LanguageModelUsage, ProviderMetadata } from 'ai'
import { internal } from '../_generated/api'
import type { Id } from '../_generated/dataModel'
import type { ActionCtx } from '../_generated/server'

type UsageHandlerCtx = Parameters<UsageHandler>[0]

/**
 * Map AI-SDK v5 `LanguageModelUsage` (`inputTokens`/`outputTokens`) onto the
 * `vUsage` validator shape (`promptTokens`/`completionTokens`). Mirrors the
 * same translation `@convex-dev/agent` itself uses internally for the
 * validator, applied here so our standalone `aiUsage` table stays consistent.
 */
function serializeUsage(usage: LanguageModelUsage) {
  return {
    promptTokens: usage.inputTokens ?? 0,
    completionTokens: usage.outputTokens ?? 0,
    totalTokens: usage.totalTokens ?? 0,
    reasoningTokens: usage.reasoningTokens,
    cachedInputTokens: usage.cachedInputTokens,
  }
}

/**
 * Build a provider-agnostic `UsageHandler` for `@convex-dev/agent`.
 *
 * Fires once per LLM call made through an `Agent`. Stamps `createdAt`,
 * resolves the optional workspaceId from the threadId via the caller-supplied
 * resolver, and hands off to `internal.aiUsage.insertUsage`. We deliberately
 * do NOT branch on provider — `usage` and `providerMetadata` are stored raw so
 * queries can surface whichever cache fields each provider populates.
 *
 * Wrapped in try/catch: a usage-write failure must never break a chat response.
 */
export function buildUsageHandler(
  resolveWorkspaceId: (
    ctx: UsageHandlerCtx,
    threadId: string | undefined,
  ) => Promise<Id<'workspaces'> | undefined>,
): UsageHandler {
  return async (ctx, args) => {
    try {
      const workspaceId = await resolveWorkspaceId(ctx, args.threadId)
      await ctx.runMutation(internal.aiUsage.insertUsage, {
        userId: args.userId,
        workspaceId,
        threadId: args.threadId,
        agentName: args.agentName,
        model: args.model,
        provider: args.provider,
        usage: serializeUsage(args.usage),
        providerMetadata: args.providerMetadata,
        createdAt: Date.now(),
      })
    } catch (error) {
      console.error('[usageHandler] failed to record ai usage', error)
    }
  }
}

/**
 * Record usage for a raw `generateObject` / `generateText` AI-SDK call that
 * bypasses `@convex-dev/agent` (e.g. the filter parser). Mirror of the agent
 * path — same table, same provider-neutral shape.
 *
 * Pass the model instance itself (not hardcoded strings) so `model` and
 * `provider` are read off `.modelId` / `.provider` at call time. This keeps
 * the usage row honest when we swap providers in `lib/aiModels.ts`.
 */
export async function trackGenerateObjectUsage(
  ctx: ActionCtx,
  {
    result,
    model,
    userId,
    workspaceId,
    threadId,
    agentName,
  }: {
    result: {
      usage: LanguageModelUsage
      providerMetadata: ProviderMetadata | undefined
    }
    model: LanguageModel
    userId?: string
    workspaceId?: Id<'workspaces'>
    threadId?: string
    agentName: string
  },
): Promise<void> {
  try {
    const { modelId, provider } =
      typeof model === 'string'
        ? parseModelString(model)
        : { modelId: model.modelId, provider: model.provider }

    await ctx.runMutation(internal.aiUsage.insertUsage, {
      userId,
      workspaceId,
      threadId,
      agentName,
      model: modelId,
      provider,
      usage: serializeUsage(result.usage),
      providerMetadata: result.providerMetadata,
      createdAt: Date.now(),
    })
  } catch (error) {
    console.error('[trackGenerateObjectUsage] failed to record ai usage', error)
  }
}

/** AI-SDK also accepts `"provider/model"` strings for `model`. Mirror that. */
function parseModelString(model: string): {
  modelId: string
  provider: string
} {
  const slash = model.indexOf('/')
  if (slash === -1) return { modelId: model, provider: 'unknown' }
  return {
    provider: model.slice(0, slash),
    modelId: model.slice(slash + 1),
  }
}
