'use node'

import { Agent } from '@convex-dev/agent'
import { v } from 'convex/values'
import { components } from './_generated/api'
import { action, internalAction } from './_generated/server'
import { chatModel, titleModel } from './lib/aiModels'

// --- Agent definitions ---

const chatAgent = new Agent(components.agent, {
  name: 'bunkr-assistant',
  languageModel: chatModel(),
  instructions: `You are Bunkr, a personal finance assistant. You help users understand their finances, spending patterns, net worth, and investments.

Be concise and helpful. Format currency amounts with the appropriate symbol. If you don't have access to specific data yet, say so clearly rather than making up numbers.

You are currently in an early beta — you can have general conversations about personal finance, but you don't yet have access to the user's actual financial data. That capability is coming soon.`,
  maxSteps: 1,
})

const titleAgent = new Agent(components.agent, {
  name: 'bunkr-title',
  languageModel: titleModel(),
  instructions: `Generate a very short title (maximum 5 words) that categorizes the user's message.

Rules:
- Keep the title to 5 words or less
- DO NOT use quotes or colons
- DO NOT use markdown formatting
- DO NOT use emojis
- Return ONLY the title text, nothing else`,
  maxSteps: 1,
})

// --- Actions (require Node.js for LLM calls) ---

export const streamResponse = action({
  args: {
    threadId: v.string(),
    promptMessageId: v.string(),
  },
  handler: async (ctx, { threadId, promptMessageId }) => {
    const { thread } = await chatAgent.continueThread(ctx, { threadId })

    const result = await thread.streamText(
      { promptMessageId },
      { saveStreamDeltas: { chunking: 'word', throttleMs: 100 } },
    )

    await result.consumeStream()
  },
})

export const generateTitle = internalAction({
  args: {
    threadId: v.string(),
    prompt: v.string(),
  },
  handler: async (ctx, { threadId, prompt }) => {
    const { thread } = await titleAgent.continueThread(ctx, { threadId })

    // Only generate title if thread doesn't already have one
    const existing = await thread.getMetadata()
    if (existing.title) return

    const { text } = await thread.generateText(
      { prompt },
      { storageOptions: { saveMessages: 'none' } },
    )

    await thread.updateMetadata({ title: text.trim() })
  },
})
