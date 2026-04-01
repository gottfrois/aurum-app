'use node'

import { anthropic } from '@ai-sdk/anthropic'
import { Agent } from '@convex-dev/agent'
import { v } from 'convex/values'
import { components, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import type { ActionCtx } from './_generated/server'
import { action, internalAction } from './_generated/server'
import { getWorkspaceDecryptionKey } from './lib/agentDecrypt'
import {
  comparePeriodSpending,
  createLabel,
  createTransactionRule,
  deleteLabel,
  deleteTransactionRule,
  findAnomalies,
  findSavingsOpportunities,
  getBalanceHistory,
  getCashFlow,
  getRecurringExpenses,
  getSpendingSummary,
  getTransactionRules,
  listAccounts,
  listInvestments,
  listUncategorizedTransactions,
  saveTransaction,
  searchCategories,
  searchLabels,
  searchTransactions,
  updateTransactionLabels,
  viewTransactions,
} from './lib/agentTools'
import {
  chatModel,
  titleModel,
  titleModelProviderOptions,
} from './lib/aiModels'
import { decryptForProfile } from './lib/serverCrypto'

// --- Agent definitions ---

function buildBaseInstructions(): string {
  const today = new Date().toISOString().slice(0, 10)
  return `<identity>You are Bunkr, a personal finance assistant. Today is ${today}. Use YYYY-MM-DD for all dates.</identity>

<rules>
1. CATEGORY RESOLUTION IS MANDATORY. Before any tool call that accepts a category filter, call searchCategories first to resolve the user's term (e.g. "restaurants") to a system key (e.g. "food_and_restaurants"). Never pass user-language terms directly.
2. NEVER FABRICATE FINANCIAL DATA. Every number must come from a tool result. If a tool returns no data or an error, say so clearly.
3. WRITE TOOLS HAVE APPROVAL UI. Tools that modify data (saveTransaction, createTransactionRule, deleteTransactionRule, updateTransactionLabels, createLabel, deleteLabel) present a confirmation dialog to the user. Call them immediately when requested — never ask "shall I proceed?" in text.
4. viewTransactions IS A SILENT UI ACTION. After analysis, call viewTransactions to generate a clickable link. Do not add any text about clicking or viewing the button — the UI renders it automatically.
</rules>

<guidelines>
- Be concise. Format currency with the appropriate symbol. Use tables or lists for financial breakdowns.
- Stay on topic: politely decline requests unrelated to personal finance.
- When tools return empty results, suggest checking the date range, category, or filters.
- Prefer fewer tool calls when possible.
</guidelines>

<workflows>
- Spending/income: searchCategories (if category filter needed) → getSpendingSummary or getCashFlow → viewTransactions
- Find transactions: searchCategories (if needed) → searchTransactions → viewTransactions
- Modify transactions: searchTransactions (get IDs) → searchCategories (resolve keys) → saveTransaction
- Label operations: searchLabels (find/verify IDs) → updateTransactionLabels, createLabel, or deleteLabel
- Rule management: getTransactionRules (audit existing) → createTransactionRule or deleteTransactionRule
- Data cleanup: listUncategorizedTransactions → suggest rules via createTransactionRule
</workflows>`
}

const chatAgent = new Agent(components.agent, {
  name: 'bunkr-assistant',
  languageModel: chatModel(),
  instructions: buildBaseInstructions(),
  maxSteps: 12,
})

/** Base tools always available to the agent. */
const baseTools = {
  getSpendingSummary,
  getCashFlow,
  getBalanceHistory,
  findAnomalies,
  findSavingsOpportunities,
  getRecurringExpenses,
  listUncategorizedTransactions,
  getTransactionRules,
  comparePeriodSpending,
  createLabel,
  createTransactionRule,
  deleteLabel,
  deleteTransactionRule,
  saveTransaction,
  updateTransactionLabels,
  searchTransactions,
  viewTransactions,
  searchCategories,
  searchLabels,
  listAccounts,
  listInvestments,
}

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
    // Build system prompt with portfolio context and custom instructions
    const systemParts: string[] = [buildBaseInstructions()]
    let webSearchEnabled = false

    if (workspaceId) {
      // Add portfolio context
      const threadMeta = await ctx.runQuery(
        internal.agentChatQueries.getThreadMetadata,
        { threadId },
      )
      const scope = threadMeta?.portfolioScope ?? 'all'
      if (scope === 'portfolio' && threadMeta?.portfolioId) {
        const portfolios = await ctx.runQuery(
          internal.agentChatQueries.listPortfoliosByWorkspace,
          { workspaceId },
        )
        const portfolio = portfolios.find(
          (p: { _id: string; name: string }) =>
            p._id === threadMeta.portfolioId,
        )
        if (portfolio) {
          systemParts.push(
            `\n\n<context>Portfolio scope: "${portfolio.name}" only. Tool queries default to this portfolio unless the user specifies otherwise.</context>`,
          )
        }
      } else if (scope === 'team') {
        systemParts.push(
          '\n\n<context>Portfolio scope: all workspace portfolios, including shared team portfolios.</context>',
        )
      } else {
        systemParts.push(
          "\n\n<context>Portfolio scope: all user's portfolios.</context>",
        )
      }

      // Load agent settings for custom instructions and web search
      const settings = await ctx.runQuery(
        internal.agent.getAgentSettingsInternal,
        { workspaceId },
      )
      webSearchEnabled = settings?.webSearchEnabled === true
      if (settings?.encryptedInstructions) {
        try {
          const customInstructions = await decryptInstructions(
            ctx,
            workspaceId,
            settings.encryptedInstructions,
          )
          if (customInstructions) {
            systemParts.push(
              `\n\n<custom_instructions>${customInstructions}</custom_instructions>`,
            )
          }
        } catch {
          // If decryption fails, skip custom instructions
        }
      }
    }

    const system = systemParts.length > 1 ? systemParts.join('') : undefined

    const { thread } = await chatAgent.continueThread(ctx, { threadId })

    const tools = webSearchEnabled
      ? {
          ...baseTools,
          web_search: anthropic.tools.webSearch_20250305({ maxUses: 5 }),
        }
      : baseTools

    try {
      const result = await thread.streamText(
        {
          promptMessageId,
          ...(system ? { system } : {}),
          tools: tools as typeof baseTools,
        },
        { saveStreamDeltas: { chunking: 'word', throttleMs: 100 } },
      )

      await result.consumeStream()
    } catch (error) {
      // Save an error message so the UI displays it instead of hanging
      const errorMsg =
        error instanceof Error ? error.message : 'An unexpected error occurred'
      const isOverloaded =
        errorMsg.includes('overloaded') ||
        errorMsg.includes('529') ||
        errorMsg.includes('rate')
      const userFacingMessage = isOverloaded
        ? 'The AI model is currently overloaded. Please try again in a moment.'
        : 'Something went wrong while generating a response. Please try again.'
      await ctx.runMutation(components.agent.messages.addMessages, {
        threadId,
        messages: [
          {
            message: {
              role: 'assistant' as const,
              content: userFacingMessage,
            },
            error: errorMsg,
          },
        ],
      })
    }
  },
})

/** Decrypt custom instructions using the shared agent key chain. */
async function decryptInstructions(
  ctx: ActionCtx,
  workspaceId: Id<'workspaces'>,
  encryptedInstructions: string,
): Promise<string | null> {
  const wsKey = await getWorkspaceDecryptionKey(ctx, workspaceId)
  if (!wsKey) return null

  const data = await decryptForProfile(
    encryptedInstructions,
    wsKey,
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

    try {
      const { text } = await thread.generateText(
        { prompt, providerOptions: titleModelProviderOptions },
        { storageOptions: { saveMessages: 'none' } },
      )
      await thread.updateMetadata({ title: text.trim() })
    } catch {
      // Title generation is non-critical — silently ignore errors
    }
  },
})
