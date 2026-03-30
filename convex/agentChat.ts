'use node'

import { Agent } from '@convex-dev/agent'
import { v } from 'convex/values'
import { components, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import type { ActionCtx } from './_generated/server'
import { action, internalAction } from './_generated/server'
import { chatModel, titleModel } from './lib/aiModels'
import {
  decryptAgentPrivateKey,
  decryptForProfile,
  decryptKeySlot,
  jwkToPrivateKeyBytes,
} from './lib/serverCrypto'

// --- Agent definitions ---

const BASE_INSTRUCTIONS = `You are Bunkr, a personal finance assistant. You help users understand their finances, spending patterns, net worth, and investments.

Be concise and helpful. Format currency amounts with the appropriate symbol. If you don't have access to specific data yet, say so clearly rather than making up numbers.

You are currently in an early beta — you can have general conversations about personal finance, but you don't yet have access to the user's actual financial data. That capability is coming soon.`

const chatAgent = new Agent(components.agent, {
  name: 'bunkr-assistant',
  languageModel: chatModel(),
  instructions: BASE_INSTRUCTIONS,
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
    workspaceId: v.optional(v.id('workspaces')),
  },
  handler: async (ctx, { threadId, promptMessageId, workspaceId }) => {
    // Build system prompt with optional custom instructions
    let system: string | undefined
    if (workspaceId) {
      const settings = await ctx.runQuery(
        internal.agent.getAgentSettingsInternal,
        { workspaceId },
      )
      if (settings?.encryptedInstructions) {
        try {
          const customInstructions = await decryptInstructions(
            ctx,
            workspaceId,
            settings.encryptedInstructions,
          )
          if (customInstructions) {
            system = `${BASE_INSTRUCTIONS}\n\n## Custom Instructions\n\n${customInstructions}`
          }
        } catch {
          // If decryption fails, use base instructions only
        }
      }
    }

    const { thread } = await chatAgent.continueThread(ctx, { threadId })

    const result = await thread.streamText(
      { promptMessageId, ...(system ? { system } : {}) },
      { saveStreamDeltas: { chunking: 'word', throttleMs: 100 } },
    )

    await result.consumeStream()
  },
})

/** Decrypt custom instructions using the agent key chain. */
async function decryptInstructions(
  ctx: ActionCtx,
  workspaceId: Id<'workspaces'>,
  encryptedInstructions: string,
): Promise<string | null> {
  const agentId = `bunkr-agent:${workspaceId}`
  const secret = process.env.AGENT_KEY_SECRET
  if (!secret) return null

  const agentKey = await ctx.runQuery(internal.agent.getAgentEncryptionKey, {
    agentUserId: agentId,
  })
  if (!agentKey) return null

  const agentPrivateKeyBytes = decryptAgentPrivateKey(
    agentKey.encryptedPrivateKey,
    secret,
    agentKey.publicKey,
  )

  const keySlot = await ctx.runQuery(internal.agent.getAgentKeySlot, {
    workspaceId,
    agentUserId: agentId,
  })
  if (!keySlot) return null

  const wsPrivateKeyJwk = await decryptKeySlot(
    keySlot.encryptedPrivateKey,
    agentPrivateKeyBytes,
  )
  const wsPrivateKeyBytes = jwkToPrivateKeyBytes(wsPrivateKeyJwk)

  const data = await decryptForProfile(
    encryptedInstructions,
    wsPrivateKeyBytes,
    'agent-instructions',
  )

  return (data.instructions as string) ?? null
}

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
