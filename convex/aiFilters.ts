'use node'

import { generateObject } from 'ai'
import { v } from 'convex/values'
import { parseAIFilterResponse } from '../src/lib/filters/ai/parse'
import type { SerializableField } from '../src/lib/filters/ai/prompt'
import { buildSystemPrompt } from '../src/lib/filters/ai/prompt'
import { aiFilterSchema } from '../src/lib/filters/ai/schema'
import { internal } from './_generated/api'
import { action } from './_generated/server'
import { filterModel } from './lib/aiModels'
import { requireAuthUserId } from './lib/auth'
import { trackGenerateObjectUsage } from './lib/usageHandler'

export const askAI = action({
  args: {
    query: v.string(),
    fields: v.array(
      v.object({
        name: v.string(),
        label: v.string(),
        valueType: v.union(
          v.literal('string'),
          v.literal('number'),
          v.literal('date'),
          v.literal('enum'),
          v.literal('boolean'),
        ),
        operators: v.array(v.string()),
        enumOptions: v.optional(
          v.array(v.object({ value: v.string(), label: v.string() })),
        ),
      }),
    ),
  },
  handler: async (ctx, { query, fields }) => {
    const userId = await requireAuthUserId(ctx)

    const trimmedQuery = query.slice(0, 500)

    // `today` lives in the user prompt (not the system prompt) so the system
    // prompt stays byte-stable across requests sharing the same fields
    // schema — lets Gemini's implicit prompt cache actually hit.
    const today = new Date().toISOString().slice(0, 10)
    const systemPrompt = buildSystemPrompt(fields as Array<SerializableField>)
    const userPrompt = `Today: ${today}\n\n${trimmedQuery}`

    // Resolve the model instance once so we pass the same object to both the
    // LLM call and the usage tracker. The tracker reads model + provider off
    // `.modelId` / `.provider`, so swapping `filterModel()` in `aiModels.ts`
    // automatically updates the usage rows — no hardcoded strings to forget.
    const model = filterModel()

    const result = await generateObject({
      model,
      system: systemPrompt,
      prompt: userPrompt,
      schema: aiFilterSchema,
      maxOutputTokens: 1024,
    })

    // Fire-and-forget usage tracking. Resolve the caller's workspace so the
    // row shows up in the workspace's aggregate. Errors are swallowed inside
    // `trackGenerateObjectUsage`, so filter responses never wait on this.
    const membership = await ctx.runQuery(
      internal.agentChatQueries.getMembershipForUser,
      { userId },
    )
    await trackGenerateObjectUsage(ctx, {
      result,
      model,
      userId,
      workspaceId: membership?.workspaceId,
      agentName: 'bunkr-ai-filter',
    })

    return parseAIFilterResponse(
      result.object,
      fields as Array<SerializableField>,
    )
  },
})
