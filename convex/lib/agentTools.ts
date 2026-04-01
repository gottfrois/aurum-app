'use node'

import { createTool } from '@convex-dev/agent'
import { z } from 'zod'
import { internal } from '../_generated/api'
import type { Id } from '../_generated/dataModel'
import type { ActionCtx } from '../_generated/server'
import { getWorkspaceDecryptionKey } from './agentDecrypt'
import {
  decryptFieldGroups,
  decryptForProfile,
  encryptForProfile,
} from './serverCrypto'

// --- Helpers ---

type PortfolioScope = 'portfolio' | 'all' | 'team'

interface ThreadContext {
  workspaceId: Id<'workspaces'>
  portfolioId: Id<'portfolios'> | null
  portfolioScope: PortfolioScope
}

/** Resolve workspace and portfolio context from thread metadata. */
async function resolveContext(
  ctx: ActionCtx & { threadId?: string },
): Promise<ThreadContext> {
  if (!ctx.threadId) throw new Error('No threadId in tool context')

  const metadata = await ctx.runQuery(
    internal.agentChatQueries.getThreadMetadata,
    { threadId: ctx.threadId },
  )
  if (!metadata) throw new Error('Thread metadata not found')

  return {
    workspaceId: metadata.workspaceId,
    portfolioId: metadata.portfolioId ?? null,
    portfolioScope: (metadata.portfolioScope as PortfolioScope) ?? 'all',
  }
}

/**
 * Resolve portfolio IDs based on scope:
 * - 'portfolio' → single portfolio
 * - 'all' → all user's portfolios (via workspace membership)
 * - 'team' → all portfolios in workspace (including shared)
 */
async function resolvePortfolioIds(
  ctx: ActionCtx,
  threadCtx: ThreadContext,
  explicitPortfolioId?: string,
): Promise<Array<Id<'portfolios'>>> {
  if (explicitPortfolioId) {
    return [explicitPortfolioId as Id<'portfolios'>]
  }
  if (threadCtx.portfolioScope === 'portfolio' && threadCtx.portfolioId) {
    return [threadCtx.portfolioId]
  }
  // Both 'all' and 'team' fetch all workspace portfolios
  // (listPortfoliosByWorkspace returns all portfolios in the workspace)
  const portfolios = await ctx.runQuery(
    internal.agentChatQueries.listPortfoliosByWorkspace,
    { workspaceId: threadCtx.workspaceId },
  )
  return portfolios.map((p: { _id: Id<'portfolios'> }) => p._id)
}

// --- Tools ---

export const viewTransactions = createTool({
  title: 'View Transactions',
  description:
    'Generate a link the user can click to view matching transactions in the transaction listing with pre-filled filters and date range. Call this AFTER presenting analysis results to let the user explore the underlying data. Returns filter conditions that the UI renders as a clickable button.',
  inputSchema: z.object({
    startDate: z
      .string()
      .optional()
      .describe(
        'Start date in YYYY-MM-DD format for the period selector. If omitted, keeps current period.',
      ),
    endDate: z
      .string()
      .optional()
      .describe(
        'End date in YYYY-MM-DD format for the period selector. If omitted, keeps current period.',
      ),
    filters: z
      .array(
        z.object({
          field: z
            .string()
            .describe(
              'Filter field: "category", "amount", "flow", "wording", "counterparty", "labels". Do NOT use "date" — use startDate/endDate instead.',
            ),
          operator: z
            .string()
            .describe(
              'Operator: "is_any_of", "between", "gt", "lt", "contains", "is"',
            ),
          values: z
            .array(z.unknown())
            .describe(
              'Filter values. For category "is_any_of": ["category_key"]. For flow: ["income"] or ["expense"]. For amount: [number].',
            ),
        }),
      )
      .describe(
        'Array of filter conditions. Do NOT include date filters — use startDate/endDate params instead.',
      ),
    label: z
      .string()
      .optional()
      .describe(
        'Human-readable label for the button (e.g. "View restaurant expenses", "See March transactions").',
      ),
  }),
  execute: async (_ctx, input) => {
    // This tool doesn't query data — it returns filter conditions + date range
    // that the UI renders as a clickable "View transactions" button
    return {
      type: 'transaction_filters' as const,
      filters: input.filters
        .filter((f) => f.field !== 'date')
        .map((f, i) => ({
          id: `agent-filter-${i}`,
          field: f.field,
          operator: f.operator,
          values: f.values,
        })),
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      label: input.label ?? 'View transactions',
    }
  },
})

export const getSpendingSummary = createTool({
  title: 'Get Spending Summary',
  description:
    'Get a summary of spending and income for a date range, optionally filtered by category. Returns totals and a breakdown by category. Always call searchCategories first to know available category keys.',
  inputSchema: z.object({
    startDate: z
      .string()
      .describe('Start date in YYYY-MM-DD format (inclusive)'),
    endDate: z.string().describe('End date in YYYY-MM-DD format (inclusive)'),
    categoryFilter: z
      .string()
      .optional()
      .describe(
        'EXACT category key from searchCategories (e.g. "food_and_restaurants"). You MUST call searchCategories first to get valid keys. Do NOT guess category names.',
      ),
    portfolioId: z
      .string()
      .optional()
      .describe(
        'Specific portfolio ID to query. If omitted, uses the active portfolio context or all portfolios.',
      ),
  }),
  execute: async (ctx, input) => {
    const threadCtx = await resolveContext(ctx)
    const wsKey = await getWorkspaceDecryptionKey(ctx, threadCtx.workspaceId)
    if (!wsKey) return { error: 'Unable to access encrypted data' }

    const portfolioIds = await resolvePortfolioIds(
      ctx,
      threadCtx,
      input.portfolioId,
    )
    // Load workspace categories for label resolution
    const wsCategories = await ctx.runQuery(
      internal.agentChatQueries.listCategoriesByWorkspace,
      { workspaceId: threadCtx.workspaceId },
    )
    const categoryLabelMap = new Map<string, string>(
      wsCategories.map((c: { key: string; label: string }) => [c.key, c.label]),
    )

    // Query transactions across portfolios
    const allTransactions = await Promise.all(
      portfolioIds.map((pid) =>
        ctx.runQuery(internal.agentChatQueries.listTransactionsByDateRange, {
          portfolioId: pid,
          startDate: input.startDate,
          endDate: input.endDate,
        }),
      ),
    )
    const transactions = allTransactions.flat()

    // Decrypt and aggregate
    let totalSpending = 0
    let totalIncome = 0
    let transactionCount = 0
    const byCategory: Record<
      string,
      { key: string; label: string; amount: number; count: number }
    > = {}

    for (const tx of transactions) {
      const financials = await decryptForProfile(
        tx.encryptedFinancials,
        wsKey,
        tx._id,
        'encryptedFinancials',
      )
      const categories = await decryptForProfile(
        tx.encryptedCategories,
        wsKey,
        tx._id,
        'encryptedCategories',
      )

      const value = Number(financials.value) || 0

      // Resolve category key: userCategoryKey > categoryParent > category > 'others'
      // This matches the client-side resolution in src/lib/categories.ts
      const resolvedKey = (
        (categories.userCategoryKey as string) ||
        (categories.categoryParent as string) ||
        (categories.category as string) ||
        'others'
      ).toLowerCase()

      // Apply category filter — exact match on resolved key, raw category, or parent
      if (input.categoryFilter) {
        const filter = input.categoryFilter.toLowerCase()
        const rawCategory = (
          (categories.category as string) || ''
        ).toLowerCase()
        const rawParent = (
          (categories.categoryParent as string) || ''
        ).toLowerCase()
        if (
          resolvedKey !== filter &&
          rawCategory !== filter &&
          rawParent !== filter
        ) {
          continue
        }
      }

      transactionCount++
      if (value < 0) {
        totalSpending += value
      } else {
        totalIncome += value
      }

      if (!byCategory[resolvedKey]) {
        byCategory[resolvedKey] = {
          key: resolvedKey,
          label: categoryLabelMap.get(resolvedKey) ?? resolvedKey,
          amount: 0,
          count: 0,
        }
      }
      byCategory[resolvedKey].amount += value
      byCategory[resolvedKey].count++
    }

    // Sort by absolute amount descending
    const categorySummary = Object.values(byCategory).sort(
      (a, b) => Math.abs(b.amount) - Math.abs(a.amount),
    )

    return {
      startDate: input.startDate,
      endDate: input.endDate,
      totalSpending: Math.round(totalSpending * 100) / 100,
      totalIncome: Math.round(totalIncome * 100) / 100,
      transactionCount,
      byCategory: categorySummary.map((c) => ({
        ...c,
        amount: Math.round(c.amount * 100) / 100,
      })),
    }
  },
})

export const searchTransactions = createTool({
  title: 'Search Transactions',
  description:
    'Search for individual transactions by text query and/or category within a date range. Returns up to 20 matching transactions with details.',
  inputSchema: z.object({
    startDate: z
      .string()
      .describe('Start date in YYYY-MM-DD format (inclusive)'),
    endDate: z.string().describe('End date in YYYY-MM-DD format (inclusive)'),
    query: z
      .string()
      .optional()
      .describe(
        'Text to search for in transaction descriptions, counterparties, and wordings. Case-insensitive.',
      ),
    categoryFilter: z
      .string()
      .optional()
      .describe(
        'EXACT category key from searchCategories. You MUST call searchCategories first.',
      ),
    portfolioId: z
      .string()
      .optional()
      .describe(
        'Specific portfolio ID. If omitted, uses active portfolio context or all.',
      ),
    limit: z
      .number()
      .optional()
      .default(20)
      .describe('Max number of transactions to return (default 20, max 50).'),
  }),
  execute: async (ctx, input) => {
    const threadCtx = await resolveContext(ctx)
    const wsKey = await getWorkspaceDecryptionKey(ctx, threadCtx.workspaceId)
    if (!wsKey) return { error: 'Unable to access encrypted data' }

    const portfolioIds = await resolvePortfolioIds(
      ctx,
      threadCtx,
      input.portfolioId,
    )

    const allTransactions = await Promise.all(
      portfolioIds.map((pid) =>
        ctx.runQuery(internal.agentChatQueries.listTransactionsByDateRange, {
          portfolioId: pid,
          startDate: input.startDate,
          endDate: input.endDate,
        }),
      ),
    )
    const transactions = allTransactions.flat()

    const maxResults = Math.min(input.limit ?? 20, 50)
    const results: Array<{
      id: string
      date: string
      description: string
      amount: number
      category: string
      currency: string
      labelIds: string[]
    }> = []

    for (const tx of transactions) {
      if (results.length >= maxResults) break

      const decrypted = await decryptFieldGroups(
        {
          encryptedDetails: tx.encryptedDetails,
          encryptedFinancials: tx.encryptedFinancials,
          encryptedCategories: tx.encryptedCategories,
        },
        wsKey,
        tx._id,
      )

      // Resolve category key: userCategoryKey > categoryParent > category > 'others'
      const resolvedKey = (
        (decrypted.userCategoryKey as string) ||
        (decrypted.categoryParent as string) ||
        (decrypted.category as string) ||
        'others'
      ).toLowerCase()

      // Apply category filter — exact match on resolved key, raw category, or parent
      if (input.categoryFilter) {
        const filter = input.categoryFilter.toLowerCase()
        const rawCategory = ((decrypted.category as string) || '').toLowerCase()
        const rawParent = (
          (decrypted.categoryParent as string) || ''
        ).toLowerCase()
        if (
          resolvedKey !== filter &&
          rawCategory !== filter &&
          rawParent !== filter
        ) {
          continue
        }
      }

      // Apply text search
      if (input.query) {
        const q = input.query.toLowerCase()
        const searchable = [
          decrypted.wording,
          decrypted.originalWording,
          decrypted.simplifiedWording,
          decrypted.counterparty,
          decrypted.customDescription,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!searchable.includes(q)) continue
      }

      results.push({
        id: tx._id,
        date: tx.date,
        description:
          (decrypted.customDescription as string) ||
          (decrypted.simplifiedWording as string) ||
          (decrypted.wording as string) ||
          'Unknown',
        amount: Math.round((Number(decrypted.value) || 0) * 100) / 100,
        category: resolvedKey,
        currency: tx.originalCurrency ?? 'EUR',
        labelIds: (tx.labelIds as string[] | undefined) ?? [],
      })
    }

    return {
      transactions: results,
      totalMatched: results.length,
      query: input.query ?? null,
    }
  },
})

export const searchCategories = createTool({
  title: 'Search Categories',
  description:
    'Search for transaction categories by name, or list all categories when no query is provided. You MUST call this before using categoryFilter in getSpendingSummary or searchTransactions to find the correct category key. Categories are workspace-wide resources.',
  inputSchema: z.object({
    query: z
      .string()
      .optional()
      .describe(
        'Optional search term to match against category labels and keys (e.g. "restaurant", "transport"). Omit to list all categories.',
      ),
  }),
  execute: async (
    ctx,
    input,
  ): Promise<{
    categories: Array<{ key: string; label: string; parentKey: string | null }>
  }> => {
    const threadCtx = await resolveContext(ctx)

    const allCategories = await ctx.runQuery(
      internal.agentChatQueries.listCategoriesByWorkspace,
      { workspaceId: threadCtx.workspaceId },
    )

    // Filter by portfolio scope: workspace-level categories + active portfolio's categories
    const scopedCategories = allCategories.filter(
      (c: { portfolioId?: string }) => {
        if (!c.portfolioId) return true // workspace-level
        if (threadCtx.portfolioScope === 'portfolio' && threadCtx.portfolioId) {
          return c.portfolioId === threadCtx.portfolioId
        }
        // 'all' and 'team' scopes see all categories
        return true
      },
    )

    const queryLower = input.query?.toLowerCase()
    const matches = queryLower
      ? scopedCategories.filter(
          (c: { key: string; label: string; parentKey?: string }) => {
            const key = c.key.toLowerCase()
            const label = c.label.toLowerCase()
            return (
              key.includes(queryLower) ||
              queryLower.includes(key) ||
              label.includes(queryLower) ||
              queryLower.includes(label)
            )
          },
        )
      : scopedCategories

    return {
      categories: matches.map(
        (c: { key: string; label: string; parentKey?: string }) => ({
          key: c.key,
          label: c.label,
          parentKey: c.parentKey ?? null,
        }),
      ),
    }
  },
})

export const searchLabels = createTool({
  title: 'Search Labels',
  description:
    'Search for transaction labels by name, or list all labels when no query is provided. Returns labels with their IDs. Labels are workspace-wide resources.',
  inputSchema: z.object({
    query: z
      .string()
      .optional()
      .describe(
        'Optional search term to filter labels by name (e.g. "commute", "vacation"). Omit to list all labels.',
      ),
  }),
  execute: async (
    ctx,
    input,
  ): Promise<{
    labels: Array<{
      id: string
      name: string
      color: string
      description: string | null
    }>
  }> => {
    const threadCtx = await resolveContext(ctx)

    const allLabels = await ctx.runQuery(
      internal.agentChatQueries.listLabelsByWorkspace,
      { workspaceId: threadCtx.workspaceId },
    )

    // Filter by portfolio scope: workspace-level labels + active portfolio's labels
    const scopedLabels = allLabels.filter((l: { portfolioId?: string }) => {
      if (!l.portfolioId) return true // workspace-level
      if (threadCtx.portfolioScope === 'portfolio' && threadCtx.portfolioId) {
        return l.portfolioId === threadCtx.portfolioId
      }
      return true
    })

    const labelQueryLower = input.query?.toLowerCase()
    const matches = labelQueryLower
      ? scopedLabels.filter((l: { name: string; description?: string }) => {
          const name = l.name.toLowerCase()
          const desc = (l.description ?? '').toLowerCase()
          return (
            name.includes(labelQueryLower) ||
            labelQueryLower.includes(name) ||
            desc.includes(labelQueryLower)
          )
        })
      : scopedLabels

    return {
      labels: matches.map(
        (l: {
          _id: string
          name: string
          color: string
          description?: string
        }) => ({
          id: l._id,
          name: l.name,
          color: l.color,
          description: l.description ?? null,
        }),
      ),
    }
  },
})

export const listAccounts = createTool({
  title: 'List Bank Accounts',
  description:
    'List all bank accounts with their names, balances, and currencies. Optionally scoped to a specific portfolio.',
  inputSchema: z.object({
    portfolioId: z
      .string()
      .optional()
      .describe(
        'Specific portfolio ID. If omitted, uses active portfolio context or all.',
      ),
  }),
  execute: async (
    ctx,
    input,
  ): Promise<
    | {
        accounts: Array<{
          id: string
          name: string
          balance: number
          currency: string
          type: string
        }>
      }
    | { error: string }
  > => {
    const threadCtx = await resolveContext(ctx)
    const wsKey = await getWorkspaceDecryptionKey(ctx, threadCtx.workspaceId)
    if (!wsKey) return { error: 'Unable to access encrypted data' }

    const portfolioIds = await resolvePortfolioIds(
      ctx,
      threadCtx,
      input.portfolioId,
    )

    const accounts = await ctx.runQuery(
      internal.agentChatQueries.listBankAccountsByPortfolios,
      { portfolioIds },
    )

    const results = await Promise.all(
      accounts.map(
        async (account: {
          _id: string
          encryptedIdentity?: string
          encryptedBalance?: string
          encryptedCustomName?: string
          currency?: string
          type?: string
        }) => {
          const identity = account.encryptedIdentity
            ? await decryptForProfile(
                account.encryptedIdentity,
                wsKey,
                account._id,
                'encryptedIdentity',
              )
            : {}
          const balance = account.encryptedBalance
            ? await decryptForProfile(
                account.encryptedBalance,
                wsKey,
                account._id,
                'encryptedBalance',
              )
            : {}
          const customName = account.encryptedCustomName
            ? await decryptForProfile(
                account.encryptedCustomName,
                wsKey,
                account._id,
                'encryptedCustomName',
              )
            : {}

          return {
            id: account._id,
            name:
              (customName.customName as string) ||
              (identity.name as string) ||
              'Unknown Account',
            balance: Math.round((Number(balance.balance) || 0) * 100) / 100,
            currency: account.currency ?? 'EUR',
            type: account.type ?? 'checking',
          }
        },
      ),
    )

    return { accounts: results }
  },
})

export const getCashFlow = createTool({
  title: 'Get Cash Flow',
  description:
    'Get income vs expenses summary for a date range, broken down by month. Returns totals, net cash flow, savings rate, and monthly breakdown. Useful for understanding spending habits and savings trends.',
  inputSchema: z.object({
    startDate: z
      .string()
      .describe('Start date in YYYY-MM-DD format (inclusive)'),
    endDate: z.string().describe('End date in YYYY-MM-DD format (inclusive)'),
    portfolioId: z
      .string()
      .optional()
      .describe(
        'Specific portfolio ID. If omitted, uses active portfolio context or all.',
      ),
  }),
  execute: async (
    ctx,
    input,
  ): Promise<
    | {
        startDate: string
        endDate: string
        totalIncome: number
        totalExpenses: number
        netCashFlow: number
        savingsRate: number
        transactionCount: number
        byMonth: Array<{
          month: string
          income: number
          expenses: number
          net: number
        }>
      }
    | { error: string }
  > => {
    const threadCtx = await resolveContext(ctx)
    const wsKey = await getWorkspaceDecryptionKey(ctx, threadCtx.workspaceId)
    if (!wsKey) return { error: 'Unable to access encrypted data' }

    const portfolioIds = await resolvePortfolioIds(
      ctx,
      threadCtx,
      input.portfolioId,
    )

    const allTransactions = await Promise.all(
      portfolioIds.map((pid) =>
        ctx.runQuery(internal.agentChatQueries.listTransactionsByDateRange, {
          portfolioId: pid,
          startDate: input.startDate,
          endDate: input.endDate,
        }),
      ),
    )
    const transactions = allTransactions.flat()

    let totalIncome = 0
    let totalExpenses = 0
    const byMonth: Record<string, { income: number; expenses: number }> = {}

    for (const tx of transactions) {
      const financials = await decryptForProfile(
        tx.encryptedFinancials,
        wsKey,
        tx._id,
        'encryptedFinancials',
      )

      const value = Number(financials.value) || 0
      const month = tx.date.slice(0, 7)

      if (!byMonth[month]) {
        byMonth[month] = { income: 0, expenses: 0 }
      }

      if (value >= 0) {
        totalIncome += value
        byMonth[month].income += value
      } else {
        totalExpenses += value
        byMonth[month].expenses += value
      }
    }

    const netCashFlow = totalIncome + totalExpenses
    const savingsRate =
      totalIncome > 0
        ? Math.round((netCashFlow / totalIncome) * 10000) / 100
        : 0

    // Sort months chronologically
    const monthlyBreakdown = Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        income: Math.round(data.income * 100) / 100,
        expenses: Math.round(data.expenses * 100) / 100,
        net: Math.round((data.income + data.expenses) * 100) / 100,
      }))

    return {
      startDate: input.startDate,
      endDate: input.endDate,
      totalIncome: Math.round(totalIncome * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      netCashFlow: Math.round(netCashFlow * 100) / 100,
      savingsRate,
      transactionCount: transactions.length,
      byMonth: monthlyBreakdown,
    }
  },
})

export const listInvestments = createTool({
  title: 'List Investments',
  description:
    'List investment holdings with performance data. Returns top holdings by valuation with totals. Only queries investment accounts (market, PEA, PEE).',
  inputSchema: z.object({
    portfolioId: z
      .string()
      .optional()
      .describe(
        'Specific portfolio ID. If omitted, uses active portfolio context or all.',
      ),
    limit: z
      .number()
      .optional()
      .default(15)
      .describe(
        'Max number of holdings to return, sorted by valuation (default 15).',
      ),
  }),
  execute: async (
    ctx,
    input,
  ): Promise<
    | {
        holdings: Array<{
          label: string
          code: string
          valuation: number
          currency: string
          diff: number
          diffPercent: number
          accountName: string
        }>
        totalValuation: number
        totalCount: number
      }
    | { error: string }
  > => {
    const threadCtx = await resolveContext(ctx)
    const wsKey = await getWorkspaceDecryptionKey(ctx, threadCtx.workspaceId)
    if (!wsKey) return { error: 'Unable to access encrypted data' }

    const portfolioIds = await resolvePortfolioIds(
      ctx,
      threadCtx,
      input.portfolioId,
    )

    const investments = await ctx.runQuery(
      internal.agentChatQueries.listInvestmentsByPortfolios,
      { portfolioIds },
    )

    // Decrypt all investments
    const decrypted = await Promise.all(
      investments.map(
        async (inv: {
          _id: string
          bankAccountId: string
          encryptedIdentity: string
          encryptedValuation: string
          originalCurrency?: string
        }) => {
          const identity = await decryptForProfile(
            inv.encryptedIdentity,
            wsKey,
            inv._id,
            'encryptedIdentity',
          )
          const valuation = await decryptForProfile(
            inv.encryptedValuation,
            wsKey,
            inv._id,
            'encryptedValuation',
          )
          return {
            label:
              (identity.label as string) ||
              (identity.code as string) ||
              'Unknown',
            code: (identity.code as string) || '',
            valuation: Number(valuation.valuation) || 0,
            currency: inv.originalCurrency ?? 'EUR',
            diff: Number(valuation.diff) || 0,
            diffPercent: Number(valuation.diffPercent) || 0,
            bankAccountId: inv.bankAccountId,
          }
        },
      ),
    )

    // Sort by valuation descending, take top N
    const sorted = decrypted.sort((a, b) => b.valuation - a.valuation)
    const totalValuation = sorted.reduce((sum, h) => sum + h.valuation, 0)
    const maxResults = Math.min(input.limit ?? 15, 50)
    const top = sorted.slice(0, maxResults)

    return {
      holdings: top.map((h) => ({
        label: h.label,
        code: h.code,
        valuation: Math.round(h.valuation * 100) / 100,
        currency: h.currency,
        diff: Math.round(h.diff * 100) / 100,
        diffPercent: Math.round(h.diffPercent * 100) / 100,
        accountName: '',
      })),
      totalValuation: Math.round(totalValuation * 100) / 100,
      totalCount: decrypted.length,
    }
  },
})

export const getBalanceHistory = createTool({
  title: 'Get Balance History',
  description:
    'Get net worth / balance trend over a time period. Returns aggregated data points (weekly for ranges up to 3 months, monthly for longer). Useful for tracking net worth evolution.',
  inputSchema: z.object({
    startDate: z
      .string()
      .describe('Start date in YYYY-MM-DD format (inclusive)'),
    endDate: z.string().describe('End date in YYYY-MM-DD format (inclusive)'),
    portfolioId: z
      .string()
      .optional()
      .describe(
        'Specific portfolio ID. If omitted, uses active portfolio context or all.',
      ),
  }),
  execute: async (
    ctx,
    input,
  ): Promise<
    | {
        startDate: string
        endDate: string
        startBalance: number
        endBalance: number
        change: number
        changePercent: number
        dataPoints: Array<{ date: string; balance: number }>
      }
    | { error: string }
  > => {
    const threadCtx = await resolveContext(ctx)
    const wsKey = await getWorkspaceDecryptionKey(ctx, threadCtx.workspaceId)
    if (!wsKey) return { error: 'Unable to access encrypted data' }

    const portfolioIds = await resolvePortfolioIds(
      ctx,
      threadCtx,
      input.portfolioId,
    )

    const startTimestamp = new Date(input.startDate).getTime()
    const endTimestamp = new Date(input.endDate).getTime() + 86400000 // inclusive end

    const snapshots = await ctx.runQuery(
      internal.agentChatQueries.listSnapshotsByPortfolios,
      { portfolioIds, startTimestamp, endTimestamp },
    )

    // Decrypt all snapshots, grouped by account
    const byAccount = new Map<
      string,
      Array<{ date: string; balance: number }>
    >()
    for (const snap of snapshots) {
      if (!snap.encryptedData) continue
      const data = await decryptForProfile(
        snap.encryptedData,
        wsKey,
        snap._id as string,
      )
      const accountId = snap.bankAccountId as string
      if (!byAccount.has(accountId)) {
        byAccount.set(accountId, [])
      }
      byAccount.get(accountId)?.push({
        date: snap.date,
        balance: Number(data.balance) || 0,
      })
    }

    // Sort each account's snapshots chronologically
    for (const entries of byAccount.values()) {
      entries.sort((a, b) => a.date.localeCompare(b.date))
    }

    // Collect all unique dates
    const allDates = new Set<string>()
    for (const entries of byAccount.values()) {
      for (const e of entries) {
        allDates.add(e.date)
      }
    }
    const sortedDates = [...allDates].sort()

    // For each date, carry forward last known balance per account and sum
    const sorted: Array<{ date: string; balance: number }> = []
    const lastKnown = new Map<string, number>()
    for (const date of sortedDates) {
      for (const [accountId, entries] of byAccount) {
        const entry = entries.find((e) => e.date === date)
        if (entry) {
          lastKnown.set(accountId, entry.balance)
        }
      }
      let total = 0
      for (const bal of lastKnown.values()) {
        total += bal
      }
      sorted.push({ date, balance: total })
    }

    if (sorted.length === 0) {
      return {
        startDate: input.startDate,
        endDate: input.endDate,
        startBalance: 0,
        endBalance: 0,
        change: 0,
        changePercent: 0,
        dataPoints: [],
      }
    }

    // Smart bucketing: weekly for <=3 months, monthly for longer
    const daySpan = (endTimestamp - startTimestamp) / (1000 * 60 * 60 * 24)
    const useMonthly = daySpan > 93

    const bucketed: Array<{ date: string; balance: number }> = []
    if (useMonthly) {
      // Take last data point per month
      const byMonth = new Map<string, { date: string; balance: number }>()
      for (const point of sorted) {
        const month = point.date.slice(0, 7)
        byMonth.set(month, point)
      }
      bucketed.push(
        ...[...byMonth.values()].sort((a, b) => a.date.localeCompare(b.date)),
      )
    } else {
      // Take last data point per week (ISO week start = Monday)
      const byWeek = new Map<string, { date: string; balance: number }>()
      for (const point of sorted) {
        const d = new Date(point.date)
        const day = d.getDay()
        const mondayOffset = day === 0 ? -6 : 1 - day
        const monday = new Date(d)
        monday.setDate(d.getDate() + mondayOffset)
        const weekKey = monday.toISOString().slice(0, 10)
        byWeek.set(weekKey, point)
      }
      bucketed.push(
        ...[...byWeek.values()].sort((a, b) => a.date.localeCompare(b.date)),
      )
    }

    const startBalance = bucketed[0].balance
    const endBalance = bucketed[bucketed.length - 1].balance
    const change = endBalance - startBalance
    const changePercent =
      startBalance !== 0
        ? Math.round((change / Math.abs(startBalance)) * 10000) / 100
        : 0

    return {
      startDate: input.startDate,
      endDate: input.endDate,
      startBalance: Math.round(startBalance * 100) / 100,
      endBalance: Math.round(endBalance * 100) / 100,
      change: Math.round(change * 100) / 100,
      changePercent,
      dataPoints: bucketed.map((p) => ({
        date: p.date,
        balance: Math.round(p.balance * 100) / 100,
      })),
    }
  },
})

export const findAnomalies = createTool({
  title: 'Find Anomalies',
  description:
    'Detect unusual spending patterns by comparing a target month against the previous 3 months average per category. Flags categories where spending deviates significantly from the baseline. Also flags individual large transactions.',
  inputSchema: z.object({
    month: z
      .string()
      .describe('Target month in YYYY-MM format to analyze (e.g. "2026-03").'),
    threshold: z
      .number()
      .optional()
      .default(50)
      .describe(
        'Percentage above average to flag as anomaly (default 50, meaning 50% above average).',
      ),
    portfolioId: z
      .string()
      .optional()
      .describe(
        'Specific portfolio ID. If omitted, uses active portfolio context or all.',
      ),
  }),
  execute: async (
    ctx,
    input,
  ): Promise<
    | {
        month: string
        baselineMonths: string[]
        categoryAnomalies: Array<{
          category: string
          label: string
          currentAmount: number
          averageAmount: number
          percentAbove: number
        }>
        largeTransactions: Array<{
          date: string
          description: string
          amount: number
          category: string
        }>
      }
    | { error: string }
  > => {
    const threadCtx = await resolveContext(ctx)
    const wsKey = await getWorkspaceDecryptionKey(ctx, threadCtx.workspaceId)
    if (!wsKey) return { error: 'Unable to access encrypted data' }

    const portfolioIds = await resolvePortfolioIds(
      ctx,
      threadCtx,
      input.portfolioId,
    )

    // Load workspace categories for label resolution
    const wsCategories = await ctx.runQuery(
      internal.agentChatQueries.listCategoriesByWorkspace,
      { workspaceId: threadCtx.workspaceId },
    )
    const categoryLabelMap = new Map<string, string>(
      wsCategories.map((c: { key: string; label: string }) => [c.key, c.label]),
    )

    // Target month date range
    const targetYear = Number.parseInt(input.month.slice(0, 4), 10)
    const targetMonth = Number.parseInt(input.month.slice(5, 7), 10)
    const targetEndDate = new Date(targetYear, targetMonth, 0)
    const targetEnd = targetEndDate.toISOString().slice(0, 10)

    // Baseline: 3 months before target
    const baselineMonths: string[] = []
    for (let i = 1; i <= 3; i++) {
      const d = new Date(targetYear, targetMonth - 1 - i, 1)
      baselineMonths.push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      )
    }
    const baselineStart = `${baselineMonths[baselineMonths.length - 1]}-01`

    // Query all transactions for baseline + target period
    const allTransactions = await Promise.all(
      portfolioIds.map((pid) =>
        ctx.runQuery(internal.agentChatQueries.listTransactionsByDateRange, {
          portfolioId: pid,
          startDate: baselineStart,
          endDate: targetEnd,
        }),
      ),
    )
    const transactions = allTransactions.flat()

    // Decrypt and bucket by month + category
    const spendingByMonthCategory = new Map<string, Map<string, number>>()
    const targetTransactions: Array<{
      date: string
      description: string
      amount: number
      category: string
    }> = []

    for (const tx of transactions) {
      const financials = await decryptForProfile(
        tx.encryptedFinancials,
        wsKey,
        tx._id,
        'encryptedFinancials',
      )
      const categories = await decryptForProfile(
        tx.encryptedCategories,
        wsKey,
        tx._id,
        'encryptedCategories',
      )

      const value = Number(financials.value) || 0
      if (value >= 0) continue // Only analyze expenses

      const resolvedKey = (
        (categories.userCategoryKey as string) ||
        (categories.categoryParent as string) ||
        (categories.category as string) ||
        'others'
      ).toLowerCase()

      const txMonth = tx.date.slice(0, 7)

      if (!spendingByMonthCategory.has(txMonth)) {
        spendingByMonthCategory.set(txMonth, new Map())
      }
      const monthMap = spendingByMonthCategory.get(txMonth)!
      monthMap.set(resolvedKey, (monthMap.get(resolvedKey) ?? 0) + value)

      // Collect target month transactions for large transaction detection
      if (txMonth === input.month) {
        const details = await decryptForProfile(
          tx.encryptedDetails,
          wsKey,
          tx._id,
          'encryptedDetails',
        )
        targetTransactions.push({
          date: tx.date,
          description:
            (details.customDescription as string) ||
            (details.simplifiedWording as string) ||
            (details.wording as string) ||
            'Unknown',
          amount: Math.round(value * 100) / 100,
          category: resolvedKey,
        })
      }
    }

    // Calculate baseline averages per category
    const baselineAvg = new Map<string, number>()
    const allCategories = new Set<string>()
    for (const month of baselineMonths) {
      const monthMap = spendingByMonthCategory.get(month)
      if (!monthMap) continue
      for (const [cat, amount] of monthMap) {
        allCategories.add(cat)
        baselineAvg.set(cat, (baselineAvg.get(cat) ?? 0) + amount)
      }
    }
    const baselineMonthCount = baselineMonths.filter((m) =>
      spendingByMonthCategory.has(m),
    ).length
    if (baselineMonthCount > 0) {
      for (const [cat, total] of baselineAvg) {
        baselineAvg.set(cat, total / baselineMonthCount)
      }
    }

    // Compare target month against baseline
    const targetMap = spendingByMonthCategory.get(input.month) ?? new Map()
    const thresholdPct = input.threshold ?? 50
    const categoryAnomalies: Array<{
      category: string
      label: string
      currentAmount: number
      averageAmount: number
      percentAbove: number
    }> = []

    for (const cat of allCategories) {
      const current = Math.abs(targetMap.get(cat) ?? 0)
      const avg = Math.abs(baselineAvg.get(cat) ?? 0)
      if (avg === 0) {
        // New category spending — flag if significant
        if (current > 50) {
          categoryAnomalies.push({
            category: cat,
            label: categoryLabelMap.get(cat) ?? cat,
            currentAmount: Math.round(current * 100) / 100,
            averageAmount: 0,
            percentAbove: 100,
          })
        }
        continue
      }
      const percentAbove = ((current - avg) / avg) * 100
      if (percentAbove >= thresholdPct) {
        categoryAnomalies.push({
          category: cat,
          label: categoryLabelMap.get(cat) ?? cat,
          currentAmount: Math.round(current * 100) / 100,
          averageAmount: Math.round(avg * 100) / 100,
          percentAbove: Math.round(percentAbove),
        })
      }
    }

    // Sort anomalies by percent above descending
    categoryAnomalies.sort((a, b) => b.percentAbove - a.percentAbove)

    // Find large individual transactions (top 5 by absolute amount)
    const largeTransactions = targetTransactions
      .sort((a, b) => a.amount - b.amount) // most negative first
      .slice(0, 5)

    return {
      month: input.month,
      baselineMonths: baselineMonths.reverse(),
      categoryAnomalies,
      largeTransactions,
    }
  },
})

export const getRecurringExpenses = createTool({
  title: 'Get Recurring Expenses',
  description:
    'Identify recurring expenses (subscriptions, rent, memberships) by analyzing transaction patterns over several months. Groups transactions by counterparty/description that appear consistently.',
  inputSchema: z.object({
    months: z
      .number()
      .optional()
      .default(3)
      .describe(
        'Number of months to scan for recurring patterns (default 3, max 6).',
      ),
    portfolioId: z
      .string()
      .optional()
      .describe(
        'Specific portfolio ID. If omitted, uses active portfolio context or all.',
      ),
  }),
  execute: async (
    ctx,
    input,
  ): Promise<
    | {
        scanPeriod: { startDate: string; endDate: string; months: number }
        recurring: Array<{
          description: string
          averageAmount: number
          currency: string
          frequency: string
          occurrences: number
          lastDate: string
          category: string
        }>
        totalMonthly: number
      }
    | { error: string }
  > => {
    const threadCtx = await resolveContext(ctx)
    const wsKey = await getWorkspaceDecryptionKey(ctx, threadCtx.workspaceId)
    if (!wsKey) return { error: 'Unable to access encrypted data' }

    const portfolioIds = await resolvePortfolioIds(
      ctx,
      threadCtx,
      input.portfolioId,
    )

    const scanMonths = Math.min(input.months ?? 3, 6)
    const now = new Date()
    const endDate = now.toISOString().slice(0, 10)
    const startDate = new Date(
      now.getFullYear(),
      now.getMonth() - scanMonths,
      1,
    )
      .toISOString()
      .slice(0, 10)

    const allTransactions = await Promise.all(
      portfolioIds.map((pid) =>
        ctx.runQuery(internal.agentChatQueries.listTransactionsByDateRange, {
          portfolioId: pid,
          startDate,
          endDate,
        }),
      ),
    )
    const transactions = allTransactions.flat()

    // Decrypt and group by normalized counterparty/description
    const groups = new Map<
      string,
      Array<{
        date: string
        amount: number
        month: string
        category: string
        rawDescription: string
      }>
    >()

    for (const tx of transactions) {
      const financials = await decryptForProfile(
        tx.encryptedFinancials,
        wsKey,
        tx._id,
        'encryptedFinancials',
      )
      const value = Number(financials.value) || 0
      if (value >= 0) continue // Only expenses

      const details = await decryptForProfile(
        tx.encryptedDetails,
        wsKey,
        tx._id,
        'encryptedDetails',
      )
      const categories = await decryptForProfile(
        tx.encryptedCategories,
        wsKey,
        tx._id,
        'encryptedCategories',
      )

      const description =
        (details.simplifiedWording as string) ||
        (details.counterparty as string) ||
        (details.wording as string) ||
        ''
      if (!description) continue

      // Normalize: lowercase, trim, collapse whitespace
      const key = description.toLowerCase().trim().replace(/\s+/g, ' ')

      const category = (
        (categories.userCategoryKey as string) ||
        (categories.categoryParent as string) ||
        (categories.category as string) ||
        'others'
      ).toLowerCase()

      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key)?.push({
        date: tx.date,
        amount: value,
        month: tx.date.slice(0, 7),
        category,
        rawDescription: description,
      })
    }

    // Identify recurring: appears in at least 2 distinct months
    const recurring: Array<{
      description: string
      averageAmount: number
      currency: string
      frequency: string
      occurrences: number
      lastDate: string
      category: string
    }> = []

    for (const [, entries] of groups) {
      const distinctMonths = new Set(entries.map((e) => e.month))
      if (distinctMonths.size < 2) continue

      const totalAmount = entries.reduce((sum, e) => sum + e.amount, 0)
      const avgAmount = totalAmount / distinctMonths.size

      // Determine frequency
      let frequency: string
      if (distinctMonths.size >= scanMonths) {
        frequency = 'monthly'
      } else if (distinctMonths.size >= scanMonths / 2) {
        frequency = 'bi-monthly'
      } else {
        frequency = 'occasional'
      }

      const sorted = entries.sort((a, b) => b.date.localeCompare(a.date))

      recurring.push({
        description: sorted[0].rawDescription,
        averageAmount: Math.round(Math.abs(avgAmount) * 100) / 100,
        currency: 'EUR',
        frequency,
        occurrences: entries.length,
        lastDate: sorted[0].date,
        category: sorted[0].category,
      })
    }

    // Sort by average amount descending
    recurring.sort((a, b) => b.averageAmount - a.averageAmount)

    // Cap at 20 results
    const top = recurring.slice(0, 20)

    const totalMonthly = top
      .filter((r) => r.frequency === 'monthly')
      .reduce((sum, r) => sum + r.averageAmount, 0)

    return {
      scanPeriod: { startDate, endDate, months: scanMonths },
      recurring: top,
      totalMonthly: Math.round(totalMonthly * 100) / 100,
    }
  },
})

export const findSavingsOpportunities = createTool({
  title: 'Find Savings Opportunities',
  description:
    'Identify where the user could reduce spending by analyzing category trends over recent months. Highlights categories with growing spending, new recurring expenses, and discretionary categories with high spend.',
  inputSchema: z.object({
    months: z
      .number()
      .optional()
      .default(3)
      .describe('Number of months to analyze (default 3, max 6).'),
    portfolioId: z
      .string()
      .optional()
      .describe(
        'Specific portfolio ID. If omitted, uses active portfolio context or all.',
      ),
  }),
  execute: async (
    ctx,
    input,
  ): Promise<
    | {
        period: { startDate: string; endDate: string; months: number }
        opportunities: Array<{
          category: string
          label: string
          type: 'growing' | 'high_discretionary' | 'new_expense'
          reason: string
          currentMonthly: number
          previousMonthly: number
          potentialSavings: number
        }>
        recurringIncreases: Array<{
          description: string
          previousAmount: number
          currentAmount: number
          increase: number
        }>
        summary: {
          totalDiscretionary: number
          totalGrowth: number
          estimatedMonthlySavings: number
        }
      }
    | { error: string }
  > => {
    const threadCtx = await resolveContext(ctx)
    const wsKey = await getWorkspaceDecryptionKey(ctx, threadCtx.workspaceId)
    if (!wsKey) return { error: 'Unable to access encrypted data' }

    const portfolioIds = await resolvePortfolioIds(
      ctx,
      threadCtx,
      input.portfolioId,
    )

    // Load workspace categories for label resolution
    const wsCategories = await ctx.runQuery(
      internal.agentChatQueries.listCategoriesByWorkspace,
      { workspaceId: threadCtx.workspaceId },
    )
    const categoryLabelMap = new Map<string, string>(
      wsCategories.map((c: { key: string; label: string }) => [c.key, c.label]),
    )

    const scanMonths = Math.min(input.months ?? 3, 6)
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const endDate = now.toISOString().slice(0, 10)
    const startDate = new Date(
      now.getFullYear(),
      now.getMonth() - scanMonths,
      1,
    )
      .toISOString()
      .slice(0, 10)

    const allTransactions = await Promise.all(
      portfolioIds.map((pid) =>
        ctx.runQuery(internal.agentChatQueries.listTransactionsByDateRange, {
          portfolioId: pid,
          startDate,
          endDate,
        }),
      ),
    )
    const transactions = allTransactions.flat()

    // Decrypt and bucket spending by month + category
    // Also track recurring expenses by counterparty
    const spendingByMonthCategory = new Map<string, Map<string, number>>()
    const recurringByCounterparty = new Map<
      string,
      Map<string, { amount: number; description: string }>
    >()

    for (const tx of transactions) {
      const financials = await decryptForProfile(
        tx.encryptedFinancials,
        wsKey,
        tx._id,
        'encryptedFinancials',
      )
      const value = Number(financials.value) || 0
      if (value >= 0) continue

      const categories = await decryptForProfile(
        tx.encryptedCategories,
        wsKey,
        tx._id,
        'encryptedCategories',
      )
      const details = await decryptForProfile(
        tx.encryptedDetails,
        wsKey,
        tx._id,
        'encryptedDetails',
      )

      const resolvedKey = (
        (categories.userCategoryKey as string) ||
        (categories.categoryParent as string) ||
        (categories.category as string) ||
        'others'
      ).toLowerCase()

      const txMonth = tx.date.slice(0, 7)

      // Category spending by month
      if (!spendingByMonthCategory.has(txMonth)) {
        spendingByMonthCategory.set(txMonth, new Map())
      }
      const monthMap = spendingByMonthCategory.get(txMonth)!
      monthMap.set(resolvedKey, (monthMap.get(resolvedKey) ?? 0) + value)

      // Recurring tracking by counterparty
      const counterparty = (
        (details.simplifiedWording as string) ||
        (details.counterparty as string) ||
        ''
      )
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')
      if (counterparty) {
        if (!recurringByCounterparty.has(counterparty)) {
          recurringByCounterparty.set(counterparty, new Map())
        }
        recurringByCounterparty.get(counterparty)?.set(txMonth, {
          amount: Math.abs(value),
          description:
            (details.simplifiedWording as string) ||
            (details.counterparty as string) ||
            '',
        })
      }
    }

    // Build sorted months list
    const months = [...spendingByMonthCategory.keys()].sort()
    const recentMonth = months[months.length - 1] ?? currentMonth
    const olderMonths = months.slice(0, -1)

    // Discretionary categories (non-essential)
    const essentialCategories = new Set([
      'housing',
      'taxes_and_admin',
      'banks_and_insurance',
      'loans',
      'healthcare',
    ])

    // Analyze category trends
    const opportunities: Array<{
      category: string
      label: string
      type: 'growing' | 'high_discretionary' | 'new_expense'
      reason: string
      currentMonthly: number
      previousMonthly: number
      potentialSavings: number
    }> = []

    const allCategories = new Set<string>()
    for (const monthMap of spendingByMonthCategory.values()) {
      for (const cat of monthMap.keys()) {
        allCategories.add(cat)
      }
    }

    let totalDiscretionary = 0
    let totalGrowth = 0

    for (const cat of allCategories) {
      const recentSpend = Math.abs(
        spendingByMonthCategory.get(recentMonth)?.get(cat) ?? 0,
      )

      // Calculate average of older months
      let olderTotal = 0
      let olderCount = 0
      for (const m of olderMonths) {
        const val = spendingByMonthCategory.get(m)?.get(cat)
        if (val !== undefined) {
          olderTotal += Math.abs(val)
          olderCount++
        }
      }
      const olderAvg = olderCount > 0 ? olderTotal / olderCount : 0
      const label = categoryLabelMap.get(cat) ?? cat
      const isDiscretionary = !essentialCategories.has(cat)

      // Growing category (spending increased 30%+ vs average)
      if (olderAvg > 0 && recentSpend > olderAvg * 1.3) {
        const growth = recentSpend - olderAvg
        totalGrowth += growth
        opportunities.push({
          category: cat,
          label,
          type: 'growing',
          reason: `Up ${Math.round(((recentSpend - olderAvg) / olderAvg) * 100)}% vs previous months average`,
          currentMonthly: Math.round(recentSpend * 100) / 100,
          previousMonthly: Math.round(olderAvg * 100) / 100,
          potentialSavings: Math.round(growth * 100) / 100,
        })
      }

      // New expense (no history, significant amount)
      if (olderAvg === 0 && recentSpend > 30) {
        opportunities.push({
          category: cat,
          label,
          type: 'new_expense',
          reason: 'New spending category with no prior history',
          currentMonthly: Math.round(recentSpend * 100) / 100,
          previousMonthly: 0,
          potentialSavings: Math.round(recentSpend * 100) / 100,
        })
      }

      // High discretionary (non-essential with significant spend)
      if (isDiscretionary && recentSpend > 100) {
        totalDiscretionary += recentSpend
        // Only flag if not already flagged as growing
        if (!(olderAvg > 0 && recentSpend > olderAvg * 1.3)) {
          opportunities.push({
            category: cat,
            label,
            type: 'high_discretionary',
            reason: `Discretionary spending of €${Math.round(recentSpend)} this month`,
            currentMonthly: Math.round(recentSpend * 100) / 100,
            previousMonthly: Math.round(olderAvg * 100) / 100,
            potentialSavings: Math.round(recentSpend * 0.2 * 100) / 100, // estimate 20% reducible
          })
        }
      }
    }

    // Sort by potential savings descending
    opportunities.sort((a, b) => b.potentialSavings - a.potentialSavings)

    // Find recurring expenses that increased
    const recurringIncreases: Array<{
      description: string
      previousAmount: number
      currentAmount: number
      increase: number
    }> = []

    for (const [, monthData] of recurringByCounterparty) {
      if (monthData.size < 2) continue
      const recent = monthData.get(recentMonth)
      if (!recent) continue

      let olderSum = 0
      let olderCnt = 0
      for (const [m, data] of monthData) {
        if (m !== recentMonth) {
          olderSum += data.amount
          olderCnt++
        }
      }
      if (olderCnt === 0) continue
      const olderAvg = olderSum / olderCnt

      if (recent.amount > olderAvg * 1.15 && recent.amount - olderAvg > 5) {
        recurringIncreases.push({
          description: recent.description,
          previousAmount: Math.round(olderAvg * 100) / 100,
          currentAmount: Math.round(recent.amount * 100) / 100,
          increase: Math.round((recent.amount - olderAvg) * 100) / 100,
        })
      }
    }

    recurringIncreases.sort((a, b) => b.increase - a.increase)

    const estimatedMonthlySavings = opportunities.reduce(
      (sum, o) => sum + o.potentialSavings,
      0,
    )

    return {
      period: { startDate, endDate, months: scanMonths },
      opportunities: opportunities.slice(0, 10),
      recurringIncreases: recurringIncreases.slice(0, 5),
      summary: {
        totalDiscretionary: Math.round(totalDiscretionary * 100) / 100,
        totalGrowth: Math.round(totalGrowth * 100) / 100,
        estimatedMonthlySavings:
          Math.round(estimatedMonthlySavings * 100) / 100,
      },
    }
  },
})

export const listUncategorizedTransactions = createTool({
  title: 'List Uncategorized Transactions',
  description:
    'Find transactions that are missing a user-assigned category within a date range. Returns transactions grouped by similar description patterns to help batch-categorize them. Useful for "help me clean up my data" workflows.',
  inputSchema: z.object({
    startDate: z
      .string()
      .describe('Start date in YYYY-MM-DD format (inclusive)'),
    endDate: z.string().describe('End date in YYYY-MM-DD format (inclusive)'),
    portfolioId: z
      .string()
      .optional()
      .describe(
        'Specific portfolio ID. If omitted, uses active portfolio context or all.',
      ),
    limit: z
      .number()
      .optional()
      .default(30)
      .describe('Max number of transactions to return (default 30, max 50).'),
  }),
  execute: async (
    ctx,
    input,
  ): Promise<
    | {
        uncategorized: Array<{
          date: string
          description: string
          counterparty: string
          amount: number
          currency: string
          currentCategory: string
        }>
        totalUncategorized: number
        patterns: Array<{
          description: string
          count: number
          totalAmount: number
          suggestedCategory: string
        }>
      }
    | { error: string }
  > => {
    const threadCtx = await resolveContext(ctx)
    const wsKey = await getWorkspaceDecryptionKey(ctx, threadCtx.workspaceId)
    if (!wsKey) return { error: 'Unable to access encrypted data' }

    const portfolioIds = await resolvePortfolioIds(
      ctx,
      threadCtx,
      input.portfolioId,
    )

    const allTransactions = await Promise.all(
      portfolioIds.map((pid) =>
        ctx.runQuery(internal.agentChatQueries.listTransactionsByDateRange, {
          portfolioId: pid,
          startDate: input.startDate,
          endDate: input.endDate,
        }),
      ),
    )
    const transactions = allTransactions.flat()

    // Decrypt and find uncategorized transactions
    const uncategorized: Array<{
      date: string
      description: string
      counterparty: string
      amount: number
      currency: string
      currentCategory: string
    }> = []

    // Track patterns by normalized description
    const patternMap = new Map<
      string,
      {
        description: string
        count: number
        totalAmount: number
        parentCategory: string
      }
    >()

    for (const tx of transactions) {
      const decrypted = await decryptFieldGroups(
        {
          encryptedDetails: tx.encryptedDetails,
          encryptedFinancials: tx.encryptedFinancials,
          encryptedCategories: tx.encryptedCategories,
        },
        wsKey,
        tx._id,
      )

      // A transaction is "uncategorized" if it has no user-assigned category
      const userCategoryKey = decrypted.userCategoryKey as string | undefined
      if (userCategoryKey) continue

      // Also check if the Powens auto-category resolved to "others" or is empty
      const rawCategory = (decrypted.category as string) || ''
      const rawParent = (decrypted.categoryParent as string) || ''
      const resolvedKey = (rawParent || rawCategory || 'others').toLowerCase()

      // Consider it uncategorized if it falls into "others" or has no category
      if (resolvedKey !== 'others' && rawCategory) continue

      const description =
        (decrypted.simplifiedWording as string) ||
        (decrypted.wording as string) ||
        'Unknown'
      const counterparty = (decrypted.counterparty as string) || ''
      const amount = Number(decrypted.value) || 0

      // Track pattern by normalized counterparty or description
      const patternKey = (counterparty || description)
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')

      if (patternKey) {
        const existing = patternMap.get(patternKey)
        if (existing) {
          existing.count++
          existing.totalAmount += amount
        } else {
          patternMap.set(patternKey, {
            description: counterparty || description,
            count: 1,
            totalAmount: amount,
            parentCategory: resolvedKey,
          })
        }
      }

      if (uncategorized.length < Math.min(input.limit ?? 30, 50)) {
        uncategorized.push({
          date: tx.date,
          description,
          counterparty,
          amount: Math.round(amount * 100) / 100,
          currency: tx.originalCurrency ?? 'EUR',
          currentCategory: resolvedKey,
        })
      }
    }

    // Sort patterns by count descending — most frequent first
    const patterns = [...patternMap.values()]
      .filter((p) => p.count >= 2)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((p) => ({
        description: p.description,
        count: p.count,
        totalAmount: Math.round(Math.abs(p.totalAmount) * 100) / 100,
        suggestedCategory:
          'Suggest a category based on the description pattern',
      }))

    return {
      uncategorized,
      totalUncategorized:
        uncategorized.length >= Math.min(input.limit ?? 30, 50)
          ? -1 // indicates there are more
          : uncategorized.length,
      patterns,
    }
  },
})

export const getTransactionRules = createTool({
  title: 'Get Transaction Rules',
  description:
    'List all auto-categorization and labeling rules in the workspace. Returns rule patterns, match types, assigned categories/labels, and impact counts. Useful for auditing rules, spotting overlaps or conflicts, and providing context before suggesting new rules.',
  inputSchema: z.object({
    portfolioId: z
      .string()
      .optional()
      .describe(
        'Specific portfolio ID to filter rules. If omitted, returns all workspace rules.',
      ),
  }),
  execute: async (
    ctx,
    input,
  ): Promise<{
    rules: Array<{
      id: string
      pattern: string
      matchType: 'contains' | 'regex'
      categoryKey: string | null
      categoryLabel: string | null
      labels: string[]
      customDescription: string | null
      excludeFromBudget: boolean
      enabled: boolean
      impactedTransactions: number
      sortOrder: number
    }>
    totalRules: number
  }> => {
    const threadCtx = await resolveContext(ctx)

    const allRules = await ctx.runQuery(
      internal.agentChatQueries.listRulesByWorkspace,
      { workspaceId: threadCtx.workspaceId },
    )

    // Load categories and labels for name resolution
    const wsCategories = await ctx.runQuery(
      internal.agentChatQueries.listCategoriesByWorkspace,
      { workspaceId: threadCtx.workspaceId },
    )
    const categoryLabelMap = new Map<string, string>(
      wsCategories.map((c: { key: string; label: string }) => [c.key, c.label]),
    )

    const wsLabels = await ctx.runQuery(
      internal.agentChatQueries.listLabelsByWorkspace,
      { workspaceId: threadCtx.workspaceId },
    )
    const labelNameMap = new Map<string, string>(
      wsLabels.map((l: { _id: string; name: string }) => [l._id, l.name]),
    )

    // Filter by portfolio if specified
    const filtered = allRules.filter(
      (r: { portfolioId?: string; enabled?: boolean }) => {
        if (input.portfolioId) {
          return !r.portfolioId || r.portfolioId === input.portfolioId
        }
        return true
      },
    )

    // Sort by sortOrder
    const sorted = filtered.sort(
      (
        a: { sortOrder?: number; createdAt: number },
        b: { sortOrder?: number; createdAt: number },
      ) => (a.sortOrder ?? a.createdAt) - (b.sortOrder ?? b.createdAt),
    )

    const rules = sorted.map(
      (r: {
        _id: string
        pattern: string
        matchType: 'contains' | 'regex'
        categoryKey?: string
        labelIds?: string[]
        customDescription?: string
        excludeFromBudget?: boolean
        enabled?: boolean
        impactedTransactionCount?: number
        sortOrder?: number
        createdAt: number
      }) => ({
        id: r._id,
        pattern: r.pattern,
        matchType: r.matchType,
        categoryKey: r.categoryKey ?? null,
        categoryLabel: r.categoryKey
          ? (categoryLabelMap.get(r.categoryKey) ?? r.categoryKey)
          : null,
        labels: (r.labelIds ?? [])
          .map((id: string) => labelNameMap.get(id) ?? id)
          .filter(Boolean),
        customDescription: r.customDescription ?? null,
        excludeFromBudget: r.excludeFromBudget ?? false,
        enabled: r.enabled !== false,
        impactedTransactions: r.impactedTransactionCount ?? 0,
        sortOrder: r.sortOrder ?? 0,
      }),
    )

    return {
      rules,
      totalRules: rules.length,
    }
  },
})

export const comparePeriodSpending = createTool({
  title: 'Compare Period Spending',
  description:
    'Compare spending between two arbitrary periods side-by-side, aligned by category with deltas. Returns pre-computed differences so the LLM can focus on narrative insight rather than data wrangling.',
  inputSchema: z.object({
    period1Start: z.string().describe('Period 1 start date (YYYY-MM-DD)'),
    period1End: z.string().describe('Period 1 end date (YYYY-MM-DD)'),
    period2Start: z.string().describe('Period 2 start date (YYYY-MM-DD)'),
    period2End: z.string().describe('Period 2 end date (YYYY-MM-DD)'),
    portfolioId: z
      .string()
      .optional()
      .describe(
        'Specific portfolio ID. If omitted, uses active portfolio context or all.',
      ),
  }),
  execute: async (
    ctx,
    input,
  ): Promise<
    | {
        period1: { start: string; end: string; total: number; count: number }
        period2: { start: string; end: string; total: number; count: number }
        totalDelta: number
        totalDeltaPercent: number
        byCategory: Array<{
          category: string
          label: string
          period1Amount: number
          period2Amount: number
          delta: number
          deltaPercent: number
        }>
        newInPeriod2: Array<{ category: string; label: string; amount: number }>
        goneInPeriod2: Array<{
          category: string
          label: string
          amount: number
        }>
      }
    | { error: string }
  > => {
    const threadCtx = await resolveContext(ctx)
    const wsKeyOrNull = await getWorkspaceDecryptionKey(
      ctx,
      threadCtx.workspaceId,
    )
    if (!wsKeyOrNull) return { error: 'Unable to access encrypted data' }
    const wsKey = wsKeyOrNull

    const portfolioIds = await resolvePortfolioIds(
      ctx,
      threadCtx,
      input.portfolioId,
    )

    // Load categories for label resolution
    const wsCategories = await ctx.runQuery(
      internal.agentChatQueries.listCategoriesByWorkspace,
      { workspaceId: threadCtx.workspaceId },
    )
    const categoryLabelMap = new Map<string, string>(
      wsCategories.map((c: { key: string; label: string }) => [c.key, c.label]),
    )

    // Helper: aggregate spending by category for a date range
    async function aggregatePeriod(startDate: string, endDate: string) {
      const allTx = await Promise.all(
        portfolioIds.map((pid) =>
          ctx.runQuery(internal.agentChatQueries.listTransactionsByDateRange, {
            portfolioId: pid,
            startDate,
            endDate,
          }),
        ),
      )
      const transactions = allTx.flat()

      let total = 0
      const byCategory = new Map<string, number>()

      for (const tx of transactions) {
        const financials = await decryptForProfile(
          tx.encryptedFinancials,
          wsKey,
          tx._id,
          'encryptedFinancials',
        )
        const categories = await decryptForProfile(
          tx.encryptedCategories,
          wsKey,
          tx._id,
          'encryptedCategories',
        )

        const value = Number(financials.value) || 0
        if (value >= 0) continue // expenses only

        const resolvedKey = (
          (categories.userCategoryKey as string) ||
          (categories.categoryParent as string) ||
          (categories.category as string) ||
          'others'
        ).toLowerCase()

        total += value
        byCategory.set(resolvedKey, (byCategory.get(resolvedKey) ?? 0) + value)
      }

      return { total, count: transactions.length, byCategory }
    }

    const p1 = await aggregatePeriod(input.period1Start, input.period1End)
    const p2 = await aggregatePeriod(input.period2Start, input.period2End)

    // Align categories across both periods
    const allCategories = new Set([
      ...p1.byCategory.keys(),
      ...p2.byCategory.keys(),
    ])

    const byCategory: Array<{
      category: string
      label: string
      period1Amount: number
      period2Amount: number
      delta: number
      deltaPercent: number
    }> = []
    const newInPeriod2: Array<{
      category: string
      label: string
      amount: number
    }> = []
    const goneInPeriod2: Array<{
      category: string
      label: string
      amount: number
    }> = []

    for (const cat of allCategories) {
      const p1Amount = Math.abs(p1.byCategory.get(cat) ?? 0)
      const p2Amount = Math.abs(p2.byCategory.get(cat) ?? 0)
      const label = categoryLabelMap.get(cat) ?? cat

      if (p1Amount === 0 && p2Amount > 0) {
        newInPeriod2.push({
          category: cat,
          label,
          amount: Math.round(p2Amount * 100) / 100,
        })
        continue
      }
      if (p1Amount > 0 && p2Amount === 0) {
        goneInPeriod2.push({
          category: cat,
          label,
          amount: Math.round(p1Amount * 100) / 100,
        })
        continue
      }

      const delta = p2Amount - p1Amount
      const deltaPercent =
        p1Amount > 0 ? Math.round((delta / p1Amount) * 10000) / 100 : 0

      byCategory.push({
        category: cat,
        label,
        period1Amount: Math.round(p1Amount * 100) / 100,
        period2Amount: Math.round(p2Amount * 100) / 100,
        delta: Math.round(delta * 100) / 100,
        deltaPercent,
      })
    }

    // Sort by absolute delta descending
    byCategory.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

    const totalP1 = Math.abs(p1.total)
    const totalP2 = Math.abs(p2.total)
    const totalDelta = totalP2 - totalP1
    const totalDeltaPercent =
      totalP1 > 0 ? Math.round((totalDelta / totalP1) * 10000) / 100 : 0

    return {
      period1: {
        start: input.period1Start,
        end: input.period1End,
        total: Math.round(totalP1 * 100) / 100,
        count: p1.count,
      },
      period2: {
        start: input.period2Start,
        end: input.period2End,
        total: Math.round(totalP2 * 100) / 100,
        count: p2.count,
      },
      totalDelta: Math.round(totalDelta * 100) / 100,
      totalDeltaPercent,
      byCategory,
      newInPeriod2,
      goneInPeriod2,
    }
  },
})

export const createTransactionRule = createTool({
  title: 'Create Transaction Rule',
  description:
    'Create an auto-categorization or labeling rule. When a transaction matches the pattern, it will automatically be categorized, labeled, or have a custom description applied. ALWAYS call searchCategories first to resolve the correct category key. ALWAYS call getTransactionRules first to check for existing rules that might overlap.',
  needsApproval: true,
  inputSchema: z.object({
    pattern: z
      .string()
      .describe(
        'Text pattern to match against transaction descriptions (e.g. "Netflix", "UBER").',
      ),
    matchType: z
      .enum(['contains', 'regex'])
      .describe(
        '"contains" for simple text matching, "regex" for advanced patterns.',
      ),
    categoryKey: z
      .string()
      .optional()
      .describe(
        'Category key to auto-assign (from searchCategories). At least one action is required.',
      ),
    labelIds: z
      .array(z.string())
      .optional()
      .describe('Label IDs to auto-apply (from searchLabels).'),
    customDescription: z
      .string()
      .optional()
      .describe('Custom description to set on matching transactions.'),
    excludeFromBudget: z
      .boolean()
      .optional()
      .describe('Whether to exclude matching transactions from budget.'),
  }),
  execute: async (
    ctx,
    input,
  ): Promise<{ ruleId: string; summary: string } | { error: string }> => {
    const threadCtx = await resolveContext(ctx)
    const userId = ctx.userId ?? 'agent'

    try {
      const ruleId = (await ctx.runMutation(
        internal.transactionRules.createRuleInternal,
        {
          workspaceId: threadCtx.workspaceId,
          createdBy: userId,
          pattern: input.pattern,
          matchType: input.matchType,
          categoryKey: input.categoryKey,
          excludeFromBudget: input.excludeFromBudget,
          customDescription: input.customDescription,
        },
      )) as string

      const actions: string[] = []
      if (input.categoryKey)
        actions.push(`categorize as "${input.categoryKey}"`)
      if (input.customDescription)
        actions.push(`set description "${input.customDescription}"`)
      if (input.excludeFromBudget) actions.push('exclude from budget')

      return {
        ruleId,
        summary: `Rule created: when transaction ${input.matchType === 'contains' ? 'contains' : 'matches'} "${input.pattern}" → ${actions.join(', ')}. This rule applies to newly synced transactions only — existing transactions are not retroactively updated.`,
      }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Failed to create rule',
      }
    }
  },
})

export const saveTransaction = createTool({
  title: 'Save Transaction',
  description:
    'Update one or more transactions by their IDs. Supports changing category, custom name, and budget exclusion in a single call. Use searchTransactions first to find IDs, and searchCategories to resolve category keys. This tool has approval UI — call it directly without asking for confirmation.',
  needsApproval: true,
  inputSchema: z.object({
    transactionIds: z
      .array(z.string())
      .min(1)
      .describe('Transaction IDs to update (from searchTransactions results).'),
    categoryKey: z
      .string()
      .optional()
      .describe(
        'New category key to assign (from searchCategories). Call searchCategories first to resolve the correct key.',
      ),
    customName: z
      .string()
      .optional()
      .describe(
        'Custom display name for the transaction(s). Replaces the bank-provided description with a user-friendly name.',
      ),
    excludedFromBudget: z
      .boolean()
      .optional()
      .describe(
        'true to exclude from budget calculations, false to re-include. Useful for internal transfers, reimbursements, or one-off transactions.',
      ),
  }),
  execute: async (
    ctx,
    input,
  ): Promise<{ updated: number; summary: string } | { error: string }> => {
    if (
      input.categoryKey === undefined &&
      input.customName === undefined &&
      input.excludedFromBudget === undefined
    ) {
      return {
        error:
          'Provide at least one field to update: categoryKey, customName, or excludedFromBudget',
      }
    }

    const threadCtx = await resolveContext(ctx)

    // Only need encryption keys if updating encrypted fields
    const needsEncryption =
      input.categoryKey !== undefined || input.customName !== undefined
    let wsKey: Uint8Array | null = null
    let publicKey: string | null = null

    if (needsEncryption) {
      wsKey = await getWorkspaceDecryptionKey(ctx, threadCtx.workspaceId)
      if (!wsKey) return { error: 'Unable to access encrypted data' }

      publicKey = (await ctx.runQuery(
        internal.agentChatQueries.getWorkspacePublicKey,
        { workspaceId: threadCtx.workspaceId },
      )) as string | null
      if (!publicKey) return { error: 'Workspace encryption not configured' }
    }

    try {
      const updates: Array<{
        transactionId: Id<'transactions'>
        encryptedCategories?: string
        encryptedDetails?: string
        excludedFromBudget?: boolean
      }> = []

      for (const txId of input.transactionIds) {
        const tx = await ctx.runQuery(
          internal.agentChatQueries.getTransactionById,
          { transactionId: txId as Id<'transactions'> },
        )
        if (!tx) continue

        const update: (typeof updates)[number] = {
          transactionId: txId as Id<'transactions'>,
        }

        // Update category (encrypted field)
        if (input.categoryKey !== undefined && wsKey && publicKey) {
          const categories = await decryptForProfile(
            tx.encryptedCategories,
            wsKey,
            txId,
            'encryptedCategories',
          )
          categories.userCategoryKey = input.categoryKey
          update.encryptedCategories = await encryptForProfile(
            categories,
            publicKey,
            txId,
            'encryptedCategories',
          )
        }

        // Update custom name (encrypted field inside encryptedDetails)
        if (input.customName !== undefined && wsKey && publicKey) {
          const details = await decryptForProfile(
            tx.encryptedDetails,
            wsKey,
            txId,
            'encryptedDetails',
          )
          details.customDescription = input.customName
          update.encryptedDetails = await encryptForProfile(
            details,
            publicKey,
            txId,
            'encryptedDetails',
          )
        }

        // Update budget exclusion (plain field)
        if (input.excludedFromBudget !== undefined) {
          update.excludedFromBudget = input.excludedFromBudget
        }

        updates.push(update)
      }

      if (updates.length === 0) {
        return { error: 'No valid transactions found for the given IDs' }
      }

      await ctx.runMutation(internal.agentChatQueries.saveTransactionInternal, {
        updates,
      })

      // Build summary of what changed
      const parts: string[] = []
      if (input.categoryKey !== undefined)
        parts.push(`category → "${input.categoryKey}"`)
      if (input.customName !== undefined)
        parts.push(`name → "${input.customName}"`)
      if (input.excludedFromBudget !== undefined)
        parts.push(
          input.excludedFromBudget
            ? 'excluded from budget'
            : 're-included in budget',
        )

      return {
        updated: updates.length,
        summary: `Updated ${updates.length} transaction${updates.length > 1 ? 's' : ''}: ${parts.join(', ')}.`,
      }
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to update transactions',
      }
    }
  },
})

export const updateTransactionLabels = createTool({
  title: 'Update Transaction Labels',
  description:
    'Add or remove labels on one or more transactions by their IDs. Use searchTransactions first to find the transaction IDs (results include current labelIds), then searchLabels to resolve the correct label IDs. Enables batch labeling like "tag all July restaurant transactions as vacation".',
  needsApproval: true,
  inputSchema: z.object({
    transactionIds: z
      .array(z.string())
      .min(1)
      .describe('Transaction IDs to update (from searchTransactions results).'),
    addLabelIds: z
      .array(z.string())
      .optional()
      .describe('Label IDs to add (from searchLabels). Merged with existing.'),
    removeLabelIds: z
      .array(z.string())
      .optional()
      .describe('Label IDs to remove. Omit to keep all existing labels.'),
  }),
  execute: async (
    ctx,
    input,
  ): Promise<{ updated: number; summary: string } | { error: string }> => {
    if (!input.addLabelIds?.length && !input.removeLabelIds?.length) {
      return { error: 'Provide at least one of addLabelIds or removeLabelIds' }
    }

    // Validate thread context (ensures valid workspace scope)
    await resolveContext(ctx)

    try {
      const addSet = new Set(input.addLabelIds ?? [])
      const removeSet = new Set(input.removeLabelIds ?? [])

      const updates: Array<{
        transactionId: Id<'transactions'>
        labelIds: Id<'transactionLabels'>[]
      }> = []

      for (const txId of input.transactionIds) {
        const tx = await ctx.runQuery(
          internal.agentChatQueries.getTransactionById,
          { transactionId: txId as Id<'transactions'> },
        )
        if (!tx) continue

        const current = new Set((tx.labelIds as string[] | undefined) ?? [])

        // Add new labels
        for (const id of addSet) current.add(id)
        // Remove specified labels
        for (const id of removeSet) current.delete(id)

        updates.push({
          transactionId: txId as Id<'transactions'>,
          labelIds: [...current] as Id<'transactionLabels'>[],
        })
      }

      if (updates.length === 0) {
        return { error: 'No valid transactions found for the given IDs' }
      }

      await ctx.runMutation(
        internal.agentChatQueries.updateTransactionLabelsInternal,
        { updates },
      )

      const parts: string[] = []
      if (input.addLabelIds?.length)
        parts.push(`added ${input.addLabelIds.length} label(s)`)
      if (input.removeLabelIds?.length)
        parts.push(`removed ${input.removeLabelIds.length} label(s)`)

      return {
        updated: updates.length,
        summary: `Updated ${updates.length} transaction${updates.length > 1 ? 's' : ''}: ${parts.join(', ')}.`,
      }
    } catch (error) {
      return {
        error:
          error instanceof Error ? error.message : 'Failed to update labels',
      }
    }
  },
})

export const createLabel = createTool({
  title: 'Create Label',
  description:
    'Create a new transaction label. Use searchLabels first to check if a similar label already exists. The label is scoped based on the active portfolio context: if a specific portfolio is selected it is created for that portfolio, otherwise it is created at workspace level. The user can override this by saying "workspace label" or "for my portfolio".',
  needsApproval: true,
  inputSchema: z.object({
    name: z
      .string()
      .describe('Label name (e.g. "tax deductible", "vacation").'),
    description: z
      .string()
      .optional()
      .describe('Optional description of what this label is for.'),
    color: z
      .string()
      .optional()
      .describe(
        'Hex color for the label (e.g. "#10b981"). If omitted, a default is chosen.',
      ),
    scope: z
      .enum(['portfolio', 'workspace'])
      .optional()
      .describe(
        'Where to create the label. Defaults to "portfolio" when a specific portfolio is active, otherwise "workspace". User can override explicitly.',
      ),
  }),
  execute: async (
    ctx,
    input,
  ): Promise<{ labelId: string; summary: string } | { error: string }> => {
    const threadCtx = await resolveContext(ctx)

    // Resolve scope: explicit override > thread context > workspace default
    const effectiveScope =
      input.scope ??
      (threadCtx.portfolioScope === 'portfolio' && threadCtx.portfolioId
        ? 'portfolio'
        : 'workspace')

    const portfolioId =
      effectiveScope === 'portfolio' ? threadCtx.portfolioId : null

    const color = input.color ?? '#6366f1'
    const name = input.name.charAt(0).toUpperCase() + input.name.slice(1)

    try {
      const labelId = (await ctx.runMutation(
        internal.agentChatQueries.createLabelInternal,
        {
          workspaceId: threadCtx.workspaceId,
          name,
          description: input.description,
          color,
          ...(portfolioId ? { portfolioId } : {}),
        },
      )) as string

      const scopeLabel = portfolioId ? 'portfolio' : 'workspace'
      return {
        labelId,
        summary: `Label "${name}" created at ${scopeLabel} level.`,
      }
    } catch (error) {
      return {
        error:
          error instanceof Error ? error.message : 'Failed to create label',
      }
    }
  },
})

export const deleteTransactionRule = createTool({
  title: 'Delete Transaction Rule',
  description:
    'Delete one or more auto-categorization or labeling rules. Use getTransactionRules first to find the rule IDs. Removing a rule does not undo its past effects on already-categorized transactions.',
  needsApproval: true,
  inputSchema: z.object({
    ruleIds: z
      .array(z.string())
      .min(1)
      .describe('Rule IDs to delete (from getTransactionRules results).'),
  }),
  execute: async (
    ctx,
    input,
  ): Promise<{ deleted: number; summary: string } | { error: string }> => {
    await resolveContext(ctx)

    try {
      await ctx.runMutation(
        internal.agentChatQueries.deleteTransactionRulesInternal,
        {
          ruleIds: input.ruleIds as Id<'transactionRules'>[],
        },
      )

      return {
        deleted: input.ruleIds.length,
        summary: `Deleted ${input.ruleIds.length} rule${input.ruleIds.length !== 1 ? 's' : ''}. Previously categorized transactions are not affected.`,
      }
    } catch (error) {
      return {
        error:
          error instanceof Error ? error.message : 'Failed to delete rules',
      }
    }
  },
})

export const deleteLabel = createTool({
  title: 'Delete Label',
  description:
    'Delete one or more transaction labels by their IDs. Use searchLabels first to find the label IDs. Removing a label also removes it from any transactions that have it.',
  needsApproval: true,
  inputSchema: z.object({
    labelIds: z
      .array(z.string())
      .min(1)
      .describe('Label IDs to delete (from searchLabels results).'),
  }),
  execute: async (
    ctx,
    input,
  ): Promise<{ deleted: number; summary: string } | { error: string }> => {
    await resolveContext(ctx)

    try {
      await ctx.runMutation(internal.agentChatQueries.deleteLabelsInternal, {
        labelIds: input.labelIds as Id<'transactionLabels'>[],
      })

      return {
        deleted: input.labelIds.length,
        summary: `Deleted ${input.labelIds.length} label${input.labelIds.length !== 1 ? 's' : ''}.`,
      }
    } catch (error) {
      return {
        error:
          error instanceof Error ? error.message : 'Failed to delete labels',
      }
    }
  },
})
