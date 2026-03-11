'use node'

import { google } from '@ai-sdk/google'
import { generateObject } from 'ai'
import { v } from 'convex/values'
import { action } from './_generated/server'
import { requireAuthUserId } from './lib/auth'
import { aiFilterSchema } from '../src/lib/filters/ai/schema'
import { buildSystemPrompt } from '../src/lib/filters/ai/prompt'
import { parseAIFilterResponse } from '../src/lib/filters/ai/parse'
import type { SerializableField } from '../src/lib/filters/ai/prompt'

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

    const today = new Date().toISOString().slice(0, 10)
    const systemPrompt = buildSystemPrompt(
      fields as Array<SerializableField>,
      today,
    )

    const { object } = await generateObject({
      model: google('gemini-2.5-flash'),
      system: systemPrompt,
      prompt: query,
      schema: aiFilterSchema,
    })

    return parseAIFilterResponse(object, fields as Array<SerializableField>)
  },
})
