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
  bulkMutateEntity,
  listEntities,
  mutateEntity,
  queryAuditLogs,
  querySeries,
  queryTransactions,
  semanticSearch,
  viewTransactions,
} from './lib/agentPrimitives'
import {
  chatModel,
  titleModel,
  titleModelProviderOptions,
} from './lib/aiModels'
import { getAuthUserId } from './lib/auth'
import { decryptForProfile } from './lib/serverCrypto'

// --- Agent definitions ---

function buildBaseInstructions(): string {
  const today = new Date().toISOString().slice(0, 10)
  return `<identity>You are Bunkr, a personal finance assistant. Today is ${today}. Use YYYY-MM-DD for all dates.</identity>

<tools>
You have 8 composable tools. Prefer chaining small calls over asking for clarification.
- query_transactions: filter + groupBy + aggregate over transactions. Workhorse for "how much", "what did I spend on", "top merchants", anomalies, recurring.
- query_series: time-bucketed metrics (balance, net_worth, spending, income, investment_value) over a range.
- list_entities: lookup accounts | investments | categories | labels | rules | filter_views (always call this first to resolve user language to ids/keys).
- semantic_search: fuzzy vector search (currently stubbed — prefer query_transactions(textSearch) until populated).
- mutate_entity: single create/update/delete on a transaction/rule/label. Triggers approval dialog.
- bulk_mutate_entity: filter-based batch write. MUST call mode="dry_run" first, then mode="commit" after user confirms.
- query_audit_logs: read the audit trail (including agent actions — filter actorType="agent").
- view_transactions: silent UI action that surfaces a clickable link to filtered results.
</tools>

<rules>
1. RESOLVE IDS FIRST. Before filtering by category / label / account, call list_entities to map user language ("restaurants", "savings account") to ids/keys. Never guess keys.
2. NEVER FABRICATE FINANCIAL DATA. Every number must come from a tool result. If a tool returns no data, say so.
3. WRITE TOOLS HAVE APPROVAL UI. mutate_entity and bulk_mutate_entity present a confirmation dialog. Call them immediately when requested — never ask "shall I proceed?" in chat.
4. BULK MUTATIONS ARE TWO-STEP. Always dry_run → report affectedCount → commit. The user decides between the two.
5. view_transactions IS SILENT. Call it after analysis; do not mention the button.
6. PARALLELIZE. When sub-questions are independent (e.g. "compare March vs April"), issue multiple query_transactions calls in one step.
</rules>

<composition_examples>
- "Top 5 restaurant spend last month": list_entities(type=category,query="restaurant") → query_transactions(dateRange, categoryKeys=[resolved], groupBy="counterparty", aggregate=["sum","count"], sort={field:"amount",dir:"desc"}, limit:5) → view_transactions.
- "Net worth trend this year": query_series(metric="net_worth", granularity="month", dateRange).
- "Recurring subscriptions that increased": query_transactions(groupBy="counterparty", aggregate=["count","avg","min","max"]) → filter client-side where count>3 and max/min > 1.1.
- "Recategorize all Uber to Transport": list_entities(category,query="transport") → bulk_mutate_entity(op="recategorize", filter={counterparty:"uber"}, target={categoryKey:...}, mode="dry_run") → present preview → commit.
- "What did the agent change yesterday?": query_audit_logs(dateRange, actorType="agent").
</composition_examples>

<guidelines>
- Be concise. Format currency with appropriate symbols. Use tables/lists for breakdowns.
- Stay on topic: politely decline requests unrelated to personal finance.
- When a tool returns empty, suggest widening the date range or checking filters.
</guidelines>`
}

const chatAgent = new Agent(components.agent, {
  name: 'bunkr-assistant',
  languageModel: chatModel(),
  instructions: buildBaseInstructions(),
  maxSteps: 12,
})

/** Base tools always available to the agent — primitives-only. */
const baseTools = {
  query_transactions: queryTransactions,
  query_series: querySeries,
  list_entities: listEntities,
  semantic_search: semanticSearch,
  mutate_entity: mutateEntity,
  bulk_mutate_entity: bulkMutateEntity,
  query_audit_logs: queryAuditLogs,
  view_transactions: viewTransactions,
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

      // Inject language preference
      const userId = await getAuthUserId(ctx)
      if (userId) {
        const memberLang = await ctx.runQuery(
          internal.agentChatQueries.getMemberLanguage,
          { workspaceId, userId },
        )
        if (memberLang && memberLang !== 'en') {
          const langName = memberLang === 'fr' ? 'French' : memberLang
          systemParts.push(
            `\n\n<language>Always respond in ${langName}. The user's preferred language is ${langName} (${memberLang}). Format all text, summaries, and explanations in ${langName}.</language>`,
          )
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
    language: v.optional(v.string()),
  },
  handler: async (ctx, { threadId, prompt, language }) => {
    const { thread } = await titleAgent.continueThread(ctx, { threadId })

    // Only generate title if thread doesn't already have one
    const existing = await thread.getMetadata()
    if (existing.title) return

    try {
      const langInstruction =
        language && language !== 'en'
          ? ` Generate the title in ${language === 'fr' ? 'French' : language}.`
          : ''
      const { text } = await thread.generateText(
        {
          prompt: prompt + langInstruction,
          providerOptions: titleModelProviderOptions,
        },
        { storageOptions: { saveMessages: 'none' } },
      )
      await thread.updateMetadata({ title: text.trim() })
    } catch {
      // Title generation is non-critical — silently ignore errors
    }
  },
})
