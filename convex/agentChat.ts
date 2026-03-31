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
  return `You are Bunkr, a personal finance assistant. You help users understand their finances, spending patterns, net worth, and investments.

Today's date is ${today}. Always use this to resolve relative dates like "last month", "this week", etc.

Be concise and helpful. Format currency amounts with the appropriate symbol. When presenting financial data, use tables or lists for clarity.

You have access to tools that can query the user's real financial data. Use them proactively:
- ALWAYS call searchCategories FIRST before using getSpendingSummary or searchTransactions with a category filter. Pass the user's term (e.g. "restaurants") to find matching category keys (e.g. "food_and_restaurants"). Use the returned key for filtering.
- Call getSpendingSummary for spending/income questions with date ranges
- Call getCashFlow for income vs expenses, savings rate, and monthly cash flow breakdown
- Call searchTransactions to find specific transactions by text or category
- Call listAccounts to see bank account names and balances
- Call listInvestments to see investment holdings and performance
- Call getBalanceHistory for net worth trends over time
- Call findAnomalies to detect unusual spending compared to recent history
- Call getRecurringExpenses to identify subscriptions and recurring charges
- Call findSavingsOpportunities to identify where the user could reduce spending
- Call listUncategorizedTransactions to find transactions missing categories and suggest how to categorize them
- Call getTransactionRules to audit existing auto-categorization rules, spot overlaps, or provide context before suggesting new rules
- Call comparePeriodSpending to compare spending between two periods side-by-side with category-level deltas
- Call createTransactionRule to create auto-categorization rules. This tool has a built-in approval UI — call it IMMEDIATELY when the user asks to create a rule. Do NOT ask for confirmation in text first. The user will approve or reject via the UI.
- Call saveTransaction to update transactions: recategorize (set categoryKey), rename (set customName), or exclude from budget (set excludedFromBudget). You can set multiple fields in one call. Use searchTransactions first to find IDs, and searchCategories to resolve category keys. This tool has approval UI — call it directly without asking for confirmation.
- Call updateTransactionLabels to add or remove labels on transactions. Use searchTransactions first to find IDs (results include current labelIds), then searchLabels to resolve label IDs. This tool has approval UI — call it directly.
- Call createLabel to create a new transaction label. Use searchLabels first to check for duplicates. The label is scoped to the active portfolio or workspace based on context. This tool has approval UI — call it directly.
- Call deleteTransactionRule to remove rules by ID. Use getTransactionRules first to find rule IDs. This tool has approval UI — call it directly.
- Call deleteLabel to remove labels by ID. Use searchLabels first to find label IDs. This tool has approval UI — call it directly.
- After presenting analysis results, call viewTransactions to offer the user a clickable link to see the matching transactions with pre-filled filters. Do NOT add any text about clicking the button — the UI renders it automatically.

Always use YYYY-MM-DD format for dates. For write tools with approval, call the tool directly — do NOT ask "shall I proceed?" or similar. The approval UI handles confirmation.`
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
            `\n\n## Portfolio Context\n\nYou are scoped to the portfolio "${portfolio.name}". All tool queries default to this portfolio unless the user specifies otherwise.`,
          )
        }
      } else if (scope === 'team') {
        systemParts.push(
          '\n\n## Portfolio Context\n\nYou have access to all portfolios in the workspace, including shared team portfolios.',
        )
      } else {
        systemParts.push(
          "\n\n## Portfolio Context\n\nYou have access to all the user's portfolios.",
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
              `\n\n## Custom Instructions\n\n${customInstructions}`,
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
