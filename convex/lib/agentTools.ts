'use node'

import { createTool } from '@convex-dev/agent'
import { z } from 'zod'
import { internal } from '../_generated/api'
import type { Id } from '../_generated/dataModel'
import type { ActionCtx } from '../_generated/server'
import { getWorkspaceDecryptionKey } from './agentDecrypt'
import { decryptFieldGroups, decryptForProfile } from './serverCrypto'

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

export const getSpendingSummary = createTool({
  title: 'Get Spending Summary',
  description:
    'Get a summary of spending and income for a date range, optionally filtered by category. Returns totals and a breakdown by category. Always call listCategories first to know available category keys.',
  inputSchema: z.object({
    startDate: z
      .string()
      .describe('Start date in YYYY-MM-DD format (inclusive)'),
    endDate: z.string().describe('End date in YYYY-MM-DD format (inclusive)'),
    categoryFilter: z
      .string()
      .optional()
      .describe(
        'EXACT category key from listCategories (e.g. "food_and_restaurants"). You MUST call listCategories first to get valid keys. Do NOT guess category names.',
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
        'EXACT category key from listCategories. You MUST call listCategories first.',
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
      date: string
      description: string
      amount: number
      category: string
      currency: string
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
        date: tx.date,
        description:
          (decrypted.customDescription as string) ||
          (decrypted.simplifiedWording as string) ||
          (decrypted.wording as string) ||
          'Unknown',
        amount: Math.round((Number(decrypted.value) || 0) * 100) / 100,
        category: resolvedKey,
        currency: tx.originalCurrency ?? 'EUR',
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

    const matches = input.query
      ? scopedCategories.filter(
          (c: { key: string; label: string; parentKey?: string }) => {
            const q = input.query!.toLowerCase()
            const key = c.key.toLowerCase()
            const label = c.label.toLowerCase()
            return (
              key.includes(q) ||
              q.includes(key) ||
              label.includes(q) ||
              q.includes(label)
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

    const matches = input.query
      ? scopedLabels.filter((l: { name: string; description?: string }) => {
          const q = input.query!.toLowerCase()
          const name = l.name.toLowerCase()
          const desc = (l.description ?? '').toLowerCase()
          return name.includes(q) || q.includes(name) || desc.includes(q)
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
      byAccount.get(accountId)!.push({
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
