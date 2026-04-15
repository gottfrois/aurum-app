'use node'

import { generateObject } from 'ai'
import { v } from 'convex/values'
import { parseAIFilterResponse } from '../src/lib/filters/ai/parse'
import type { SerializableField } from '../src/lib/filters/ai/prompt'
import { buildSystemPrompt } from '../src/lib/filters/ai/prompt'
import { aiFilterSchema } from '../src/lib/filters/ai/schema'
import { action } from './_generated/server'
import { filterModel } from './lib/aiModels'
import { requireAuthUserId } from './lib/auth'

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
    await requireAuthUserId(ctx)

    const trimmedQuery = query.slice(0, 500)

    // `today` lives in the user prompt (not the system prompt) so the system
    // prompt stays byte-stable across requests sharing the same fields
    // schema — lets Gemini's implicit prompt cache actually hit.
    const today = new Date().toISOString().slice(0, 10)
    const systemPrompt = buildSystemPrompt(fields as Array<SerializableField>)
    const userPrompt = `Today: ${today}\n\n${trimmedQuery}`

    const { object } = await generateObject({
      model: filterModel(),
      system: systemPrompt,
      prompt: userPrompt,
      schema: aiFilterSchema,
      maxOutputTokens: 1024,
    })

    return parseAIFilterResponse(object, fields as Array<SerializableField>)
  },
})
