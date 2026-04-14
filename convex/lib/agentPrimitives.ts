'use node'

/**
 * Primitive tools for Bunkr's Convex agent.
 *
 * Seven composable primitives (see plans/goofy-fluttering-rabin.md):
 *   1. query_transactions    — workhorse for structured tx questions
 *   2. query_series          — time-bucketed metrics (balance / cash flow)
 *   3. list_entities         — lookup for accounts, investments, taxonomy
 *   4. semantic_search       — RAG-backed fuzzy search over workspace taxonomy
 *   5. mutate_entity         — single write tool, type+action discriminator
 *   6. bulk_mutate_entity    — batched write with dry-run / commit
 *   7. query_audit_logs      — audit history (inc. agent-driven changes)
 */

import { createTool } from '@convex-dev/agent'
import { z } from 'zod'
import { internal } from '../_generated/api'
import type { Id } from '../_generated/dataModel'
import type { ActionCtx } from '../_generated/server'
import { getWorkspaceDecryptionKey } from './agentDecrypt'
import type {
  Aggregate,
  DecryptedTransaction,
  GroupBy,
  QueryTransactionsFilters,
  QueryTransactionsOptions,
  SortField,
} from './agentPrimitivesCore'
import { queryTransactions as runQueryTransactions } from './agentPrimitivesCore'
import {
  decryptFieldGroups,
  decryptForProfile,
  encryptForProfile,
} from './serverCrypto'

// --- Shared types for internal query results ------------------------------

interface RawTransaction {
  _id: string
  date: string
  bankAccountId: string
  portfolioId: string
  originalCurrency?: string
  encryptedDetails: string
  encryptedFinancials: string
  encryptedCategories: string
  labelIds?: string[]
  excludedFromBudget?: boolean
}

// --- Thread context ---------------------------------------------------------

type PortfolioScope = 'portfolio' | 'all' | 'team'

interface ThreadContext {
  workspaceId: Id<'workspaces'>
  portfolioId: Id<'portfolios'> | null
  portfolioScope: PortfolioScope
}

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
 * Write an audit log entry with actorType='agent' and the current thread id,
 * so the audit trail captures every agent-driven mutation. Fire-and-forget —
 * audit failures should not block the tool result returned to the model.
 */
async function writeAgentAuditLog(
  ctx: ActionCtx & { threadId?: string; userId?: string },
  workspaceId: Id<'workspaces'>,
  event: string,
  metadata: Record<string, unknown>,
  opts?: {
    portfolioId?: Id<'portfolios'>
    resourceType?: string
    resourceId?: string
    resourceName?: string
  },
): Promise<void> {
  if (!ctx.threadId) return
  try {
    await ctx.runMutation(internal.auditLog.writeAgentAuditLog, {
      workspaceId,
      agentThreadId: ctx.threadId,
      actorUserId: ctx.userId,
      event,
      metadata: JSON.stringify(metadata),
      ...(opts?.portfolioId ? { portfolioId: opts.portfolioId } : {}),
      ...(opts?.resourceType ? { resourceType: opts.resourceType } : {}),
      ...(opts?.resourceId ? { resourceId: opts.resourceId } : {}),
      ...(opts?.resourceName ? { resourceName: opts.resourceName } : {}),
    })
  } catch {
    // swallow — agent output should not be blocked on audit failures
  }
}

async function resolvePortfolioIds(
  ctx: ActionCtx,
  threadCtx: ThreadContext,
  explicit?: string[] | string,
): Promise<Array<Id<'portfolios'>>> {
  if (typeof explicit === 'string') {
    return [explicit as Id<'portfolios'>]
  }
  if (Array.isArray(explicit) && explicit.length > 0) {
    return explicit.map((id) => id as Id<'portfolios'>)
  }
  if (threadCtx.portfolioScope === 'portfolio' && threadCtx.portfolioId) {
    return [threadCtx.portfolioId]
  }
  const portfolios = await ctx.runQuery(
    internal.agentChatQueries.listPortfoliosByWorkspace,
    { workspaceId: threadCtx.workspaceId },
  )
  return portfolios.map((p: { _id: Id<'portfolios'> }) => p._id)
}

// --- Shared zod fragments ---------------------------------------------------

const DateRange = z.object({
  from: z.string().describe('Inclusive start date YYYY-MM-DD'),
  to: z.string().describe('Inclusive end date YYYY-MM-DD'),
})

const AmountRange = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
  currency: z.string().optional(),
})

const AggregateEnum = z.enum([
  'sum',
  'count',
  'avg',
  'min',
  'max',
  'p50',
  'p95',
])
const GroupByEnum = z.enum([
  'none',
  'category',
  'counterparty',
  'month',
  'week',
  'day',
  'label',
  'account',
])

// ============================================================================
// 1. query_transactions
// ============================================================================

export const queryTransactions = createTool({
  title: 'Query Transactions',
  description: [
    'The workhorse for every structured question about transactions. Filter, group, and aggregate.',
    '',
    'Filters (all optional, all AND-ed): dateRange, accountIds, portfolioIds, categoryKeys, labelIds,',
    'counterparty (substring), textSearch (description/wording/counterparty), amountRange (|amount|),',
    'excludedFromBudget, sign ("income" | "expense").',
    '',
    'Shape: groupBy (none|category|counterparty|month|week|day|label|account), aggregate (sum/count/avg/min/max/p50/p95),',
    'sort by date|amount|count, limit (default 50, max 500), returnSamples + samplesPerBucket (default 5).',
    '',
    'Composition examples:',
    '- "Spend on restaurants last month" → categoryKeys=["food_and_restaurants"], dateRange, aggregate=["sum"].',
    '- "Cash flow by month" → groupBy="month", aggregate=["sum"] (call twice with sign=income and sign=expense, or split client-side on samples).',
    '- "Biggest one-off expenses >500€" → sign="expense", amountRange.min=500, sort={field:"amount",dir:"desc"}, returnSamples=true.',
    '- "Uncategorized" → categoryKeys=["uncategorized"], groupBy="none", returnSamples=true.',
    '',
    'Always resolve category keys via list_entities(type="category") before using categoryKeys.',
  ].join('\n'),
  inputSchema: z.object({
    dateRange: DateRange.optional(),
    accountIds: z.array(z.string()).optional(),
    portfolioIds: z.array(z.string()).optional(),
    categoryKeys: z.array(z.string()).optional(),
    labelIds: z.array(z.string()).optional(),
    counterparty: z.string().optional(),
    textSearch: z.string().optional(),
    amountRange: AmountRange.optional(),
    excludedFromBudget: z.boolean().optional(),
    sign: z.enum(['income', 'expense']).optional(),
    groupBy: GroupByEnum.optional(),
    aggregate: z.array(AggregateEnum).optional(),
    sort: z
      .object({
        field: z.enum(['date', 'amount', 'count']),
        dir: z.enum(['asc', 'desc']),
      })
      .optional(),
    limit: z.number().optional(),
    returnSamples: z.boolean().optional(),
    samplesPerBucket: z.number().optional(),
  }),
  execute: async (ctx, input) => {
    const threadCtx = await resolveContext(ctx)
    const wsKey = await getWorkspaceDecryptionKey(ctx, threadCtx.workspaceId)
    if (!wsKey) return { error: 'Unable to access encrypted data' }

    const portfolioIds = await resolvePortfolioIds(
      ctx,
      threadCtx,
      input.portfolioIds,
    )

    // Widen the date range if absent to "all time" — schema stores ISO dates.
    const from = input.dateRange?.from ?? '1900-01-01'
    const to = input.dateRange?.to ?? '2999-12-31'

    const raw: RawTransaction[] = (
      await Promise.all(
        portfolioIds.map((pid) =>
          ctx.runQuery(
            internal.agentChatQueries.listTransactionsByDateRangeAll,
            { portfolioId: pid, startDate: from, endDate: to },
          ),
        ),
      )
    ).flat() as RawTransaction[]

    // Decrypt into the shape the core expects.
    const decrypted: DecryptedTransaction[] = await Promise.all(
      raw.map(async (tx: RawTransaction) => {
        const data = await decryptFieldGroups(
          {
            encryptedDetails: tx.encryptedDetails,
            encryptedFinancials: tx.encryptedFinancials,
            encryptedCategories: tx.encryptedCategories,
          },
          wsKey,
          tx._id,
        )
        const resolvedCategory = (
          (data.userCategoryKey as string) ||
          (data.categoryParent as string) ||
          (data.category as string) ||
          'others'
        ).toLowerCase()
        const description =
          (data.customDescription as string) ||
          (data.simplifiedWording as string) ||
          (data.wording as string) ||
          ''
        return {
          id: tx._id,
          date: tx.date,
          amount: Number(data.value) || 0,
          currency: tx.originalCurrency ?? 'EUR',
          category: resolvedCategory,
          categoryRaw: (data.category as string) || undefined,
          categoryParent: (data.categoryParent as string) || undefined,
          labelIds: ((tx.labelIds as string[] | undefined) ?? []).map(String),
          counterparty: (data.counterparty as string) || undefined,
          description,
          wording: (data.wording as string) || undefined,
          accountId: String(tx.bankAccountId),
          portfolioId: String(tx.portfolioId),
          excludedFromBudget: Boolean(tx.excludedFromBudget),
        }
      }),
    )

    const filters: QueryTransactionsFilters = {
      dateRange: input.dateRange,
      accountIds: input.accountIds,
      portfolioIds: input.portfolioIds,
      categoryKeys: input.categoryKeys,
      labelIds: input.labelIds,
      counterparty: input.counterparty,
      textSearch: input.textSearch,
      amountRange: input.amountRange,
      excludedFromBudget: input.excludedFromBudget,
      sign: input.sign,
    }
    const options: QueryTransactionsOptions = {
      groupBy: input.groupBy as GroupBy | undefined,
      aggregate: input.aggregate as Aggregate[] | undefined,
      sort: input.sort as { field: SortField; dir: 'asc' | 'desc' } | undefined,
      limit: input.limit,
      returnSamples: input.returnSamples,
      samplesPerBucket: input.samplesPerBucket,
    }

    return runQueryTransactions(decrypted, filters, options)
  },
})

// ============================================================================
// 2. query_series
// ============================================================================

export const querySeries = createTool({
  title: 'Query Series',
  description: [
    'Time-bucketed metrics over a range. One of:',
    '- balance | net_worth: sum of balance snapshots per bucket (latest point per account per bucket).',
    '- spending | income: absolute sum of transaction amounts (expense = negative, income = positive).',
    '- investment_value: sum of investment valuations (point-in-time — uses snapshot date).',
    '',
    'Use for "net worth over time", "monthly spending trend", etc.',
    'For cross-category comparisons within a range use query_transactions instead.',
  ].join('\n'),
  inputSchema: z.object({
    metric: z.enum([
      'balance',
      'net_worth',
      'spending',
      'income',
      'investment_value',
    ]),
    granularity: z.enum(['day', 'week', 'month']),
    dateRange: DateRange,
    portfolioIds: z.array(z.string()).optional(),
  }),
  execute: async (ctx, input) => {
    const threadCtx = await resolveContext(ctx)
    const wsKey = await getWorkspaceDecryptionKey(ctx, threadCtx.workspaceId)
    if (!wsKey) return { error: 'Unable to access encrypted data' }

    const portfolioIds = await resolvePortfolioIds(
      ctx,
      threadCtx,
      input.portfolioIds,
    )

    const bucketOf = (date: string): string => {
      if (input.granularity === 'day') return date
      if (input.granularity === 'month') return date.slice(0, 7)
      // week — ISO week start (Monday)
      const d = new Date(`${date}T00:00:00Z`)
      const day = d.getUTCDay()
      const offset = day === 0 ? -6 : 1 - day
      d.setUTCDate(d.getUTCDate() + offset)
      return d.toISOString().slice(0, 10)
    }

    if (input.metric === 'spending' || input.metric === 'income') {
      const raw = (
        await Promise.all(
          portfolioIds.map((pid) =>
            ctx.runQuery(
              internal.agentChatQueries.listTransactionsByDateRangeAll,
              {
                portfolioId: pid,
                startDate: input.dateRange.from,
                endDate: input.dateRange.to,
              },
            ),
          ),
        )
      ).flat()

      const buckets = new Map<string, number>()
      for (const tx of raw) {
        if (tx.excludedFromBudget) continue
        const fin = await decryptForProfile(
          tx.encryptedFinancials,
          wsKey,
          tx._id,
          'encryptedFinancials',
        )
        const v = Number(fin.value) || 0
        if (input.metric === 'spending' && v >= 0) continue
        if (input.metric === 'income' && v <= 0) continue
        const key = bucketOf(tx.date)
        buckets.set(key, (buckets.get(key) ?? 0) + Math.abs(v))
      }

      const points = [...buckets.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([t, v]) => ({ t, value: Math.round(v * 100) / 100 }))

      return { metric: input.metric, points, currency: 'EUR' }
    }

    // balance / net_worth / investment_value — from snapshots
    const startTs = new Date(input.dateRange.from).getTime()
    const endTs = new Date(input.dateRange.to).getTime() + 86400000
    const snapshots = await ctx.runQuery(
      internal.agentChatQueries.listSnapshotsByPortfolios,
      { portfolioIds, startTimestamp: startTs, endTimestamp: endTs },
    )

    // Per (account, bucket) take last snapshot, then sum across accounts per bucket
    // (with carry-forward of last known balance per account).
    const perAccount = new Map<
      string,
      Array<{ bucket: string; date: string; balance: number }>
    >()
    for (const snap of snapshots) {
      if (!snap.encryptedData) continue
      const data = await decryptForProfile(
        snap.encryptedData,
        wsKey,
        snap._id as string,
      )
      const bucket = bucketOf(snap.date)
      const entry = {
        bucket,
        date: snap.date,
        balance: Number(data.balance) || 0,
      }
      const acct = String(snap.bankAccountId)
      const arr = perAccount.get(acct) ?? []
      arr.push(entry)
      perAccount.set(acct, arr)
    }

    // Collapse to last entry per (account, bucket).
    const lastPerBucket = new Map<string, Map<string, number>>() // bucket -> account -> balance
    for (const [acct, entries] of perAccount) {
      entries.sort((a, b) => a.date.localeCompare(b.date))
      const byBucket = new Map<string, number>()
      for (const e of entries) byBucket.set(e.bucket, e.balance)
      for (const [bucket, bal] of byBucket) {
        if (!lastPerBucket.has(bucket)) lastPerBucket.set(bucket, new Map())
        lastPerBucket.get(bucket)?.set(acct, bal)
      }
    }

    const allBuckets = [...lastPerBucket.keys()].sort()
    const carry = new Map<string, number>()
    const points: Array<{ t: string; value: number }> = []
    for (const b of allBuckets) {
      const byAcct = lastPerBucket.get(b)
      if (byAcct) for (const [acct, bal] of byAcct) carry.set(acct, bal)
      let total = 0
      for (const v of carry.values()) total += v
      points.push({ t: b, value: Math.round(total * 100) / 100 })
    }

    return { metric: input.metric, points, currency: 'EUR' }
  },
})

// ============================================================================
// 3. list_entities
// ============================================================================

export const listEntities = createTool({
  title: 'List Entities',
  description: [
    'Lookup for taxonomy and account-like entities. One call per type.',
    'Types: account | investment | category | label | rule | filter_view.',
    'Pass query to fuzzy-match on names; omit to list all.',
    'Always call this first when resolving user language ("restaurants") to ids/keys.',
  ].join('\n'),
  inputSchema: z.object({
    type: z.enum([
      'account',
      'investment',
      'category',
      'label',
      'rule',
      'filter_view',
    ]),
    query: z.string().optional(),
    portfolioIds: z.array(z.string()).optional(),
  }),
  execute: async (ctx, input): Promise<unknown> => {
    const threadCtx = await resolveContext(ctx)
    const needle = input.query?.toLowerCase()

    const match = (hay: string) => !needle || hay.toLowerCase().includes(needle)

    if (input.type === 'account') {
      const wsKey = await getWorkspaceDecryptionKey(ctx, threadCtx.workspaceId)
      if (!wsKey) return { error: 'Unable to access encrypted data' }
      const portfolioIds = await resolvePortfolioIds(
        ctx,
        threadCtx,
        input.portfolioIds,
      )
      const accounts = (await ctx.runQuery(
        internal.agentChatQueries.listBankAccountsByPortfolios,
        { portfolioIds },
      )) as Array<{
        _id: string
        encryptedIdentity?: string
        encryptedCustomName?: string
        encryptedBalance?: string
        type?: string
        currency?: string
        portfolioId: string
      }>
      const items = await Promise.all(
        accounts.map(
          async (a: {
            _id: string
            encryptedIdentity?: string
            encryptedCustomName?: string
            encryptedBalance?: string
            type?: string
            currency?: string
            portfolioId: string
          }) => {
            const ident = a.encryptedIdentity
              ? await decryptForProfile(
                  a.encryptedIdentity,
                  wsKey,
                  a._id,
                  'encryptedIdentity',
                )
              : {}
            const custom = a.encryptedCustomName
              ? await decryptForProfile(
                  a.encryptedCustomName,
                  wsKey,
                  a._id,
                  'encryptedCustomName',
                )
              : {}
            const bal = a.encryptedBalance
              ? await decryptForProfile(
                  a.encryptedBalance,
                  wsKey,
                  a._id,
                  'encryptedBalance',
                )
              : {}
            const displayName =
              (custom.customName as string) ||
              (ident.name as string) ||
              'Unknown'
            return {
              id: a._id,
              displayName,
              type: a.type ?? 'checking',
              currency: a.currency ?? 'EUR',
              balance: Math.round((Number(bal.balance) || 0) * 100) / 100,
              portfolioId: a.portfolioId,
            }
          },
        ),
      )
      return items.filter((i) => match(i.displayName))
    }

    if (input.type === 'investment') {
      const wsKey = await getWorkspaceDecryptionKey(ctx, threadCtx.workspaceId)
      if (!wsKey) return { error: 'Unable to access encrypted data' }
      const portfolioIds = await resolvePortfolioIds(
        ctx,
        threadCtx,
        input.portfolioIds,
      )
      const invs = (await ctx.runQuery(
        internal.agentChatQueries.listInvestmentsByPortfolios,
        { portfolioIds },
      )) as Array<{
        _id: string
        encryptedIdentity: string
        encryptedValuation: string
        originalCurrency?: string
        bankAccountId: string
      }>
      const items = await Promise.all(
        invs.map(
          async (inv: {
            _id: string
            encryptedIdentity: string
            encryptedValuation: string
            originalCurrency?: string
            bankAccountId: string
          }) => {
            const id = await decryptForProfile(
              inv.encryptedIdentity,
              wsKey,
              inv._id,
              'encryptedIdentity',
            )
            const val = await decryptForProfile(
              inv.encryptedValuation,
              wsKey,
              inv._id,
              'encryptedValuation',
            )
            return {
              id: inv._id,
              displayName:
                (id.label as string) || (id.code as string) || 'Unknown',
              code: (id.code as string) || '',
              valuation: Math.round((Number(val.valuation) || 0) * 100) / 100,
              currency: inv.originalCurrency ?? 'EUR',
              accountId: inv.bankAccountId,
            }
          },
        ),
      )
      return items.filter((i) => match(`${i.displayName} ${i.code}`))
    }

    if (input.type === 'category') {
      const cats = (await ctx.runQuery(
        internal.agentChatQueries.listCategoriesByWorkspace,
        { workspaceId: threadCtx.workspaceId },
      )) as Array<{
        key: string
        label: string
        parentKey?: string
        color?: string
      }>
      return cats
        .filter(
          (c: {
            key: string
            label: string
            parentKey?: string
            color?: string
          }) => match(`${c.key} ${c.label}`),
        )
        .map(
          (c: {
            key: string
            label: string
            parentKey?: string
            color?: string
          }) => ({
            id: c.key,
            displayName: c.label,
            key: c.key,
            parentKey: c.parentKey ?? null,
            color: c.color ?? null,
          }),
        )
    }

    if (input.type === 'label') {
      const labels = (await ctx.runQuery(
        internal.agentChatQueries.listLabelsByWorkspace,
        { workspaceId: threadCtx.workspaceId },
      )) as Array<{
        _id: string
        name: string
        color: string
        portfolioId?: string
      }>
      return labels
        .filter((l: { name: string }) => match(l.name))
        .map(
          (l: {
            _id: string
            name: string
            color: string
            portfolioId?: string
          }) => ({
            id: l._id,
            displayName: l.name,
            color: l.color,
            portfolioId: l.portfolioId ?? null,
          }),
        )
    }

    if (input.type === 'rule') {
      const rules = (await ctx.runQuery(
        internal.agentChatQueries.listRulesByWorkspace,
        { workspaceId: threadCtx.workspaceId },
      )) as Array<{
        _id: string
        pattern: string
        matchType: string
        categoryKey?: string
        labelIds?: string[]
        customDescription?: string
        excludeFromBudget?: boolean
        enabled?: boolean
      }>
      return rules
        .filter((r: { pattern: string }) => match(r.pattern))
        .map(
          (r: {
            _id: string
            pattern: string
            matchType: string
            categoryKey?: string
            labelIds?: string[]
            customDescription?: string
            excludeFromBudget?: boolean
            enabled?: boolean
          }) => ({
            id: r._id,
            displayName: r.pattern,
            matchType: r.matchType,
            categoryKey: r.categoryKey ?? null,
            labelIds: r.labelIds ?? [],
            customDescription: r.customDescription ?? null,
            excludeFromBudget: r.excludeFromBudget ?? false,
            enabled: r.enabled ?? true,
          }),
        )
    }

    if (input.type === 'filter_view') {
      const views = (await ctx.runQuery(
        internal.agentChatQueries.listFilterViewsByWorkspace,
        { workspaceId: threadCtx.workspaceId },
      )) as Array<{
        _id: string
        name: string
        entityType: string
        description?: string
        portfolioId?: string
      }>
      return views
        .filter((v: { name: string }) => match(v.name))
        .map(
          (v: {
            _id: string
            name: string
            entityType: string
            description?: string
            portfolioId?: string
          }) => ({
            id: v._id,
            displayName: v.name,
            entityType: v.entityType,
            description: v.description ?? null,
            portfolioId: v.portfolioId ?? null,
          }),
        )
    }

    return []
  },
})

// ============================================================================
// 4. semantic_search — RAG-backed fuzzy vector search
// ============================================================================

export const semanticSearch = createTool({
  title: 'Semantic Search',
  description: [
    'Fuzzy vector search over workspace taxonomy (categories, labels, rules).',
    'Use when the user phrasing is fuzzy ("the label I use for subscriptions", "the rule that recategorizes Uber") and you want to resolve it to an existing entity id/key.',
    'Follow up with query_transactions or list_entities for structured details.',
    'Transaction descriptions are end-to-end encrypted and not indexed here — for fuzzy transaction text, prefer query_transactions(textSearch).',
  ].join('\n'),
  inputSchema: z.object({
    query: z.string(),
    types: z.array(z.enum(['category', 'label', 'rule'])).optional(),
    limit: z.number().optional(),
  }),
  execute: async (ctx, input) => {
    const threadCtx = await resolveContext(ctx)
    const results = (await ctx.runAction(internal.rag.searchWorkspace, {
      workspaceId: threadCtx.workspaceId,
      query: input.query,
      types: input.types,
      limit: input.limit ?? 10,
    })) as Array<{
      type: string
      id: string | null
      score: number
      snippet: string
      preview: Record<string, unknown>
    }>
    return { results }
  },
})

// ============================================================================
// 5. mutate_entity
// ============================================================================

const MutatePayload = z.record(z.string(), z.unknown())

export const mutateEntity = createTool({
  title: 'Mutate Entity',
  description: [
    'Create, update, or delete a single entity. All write operations go through this tool and trigger an approval dialog.',
    '',
    'Supported (type, action, payload shape):',
    '- ("transaction", "update", { ids: string[], categoryKey?, customName?, excludedFromBudget? })',
    '- ("transaction", "update_labels", { ids: string[], addLabelIds?: string[], removeLabelIds?: string[] })',
    '- ("rule", "create", { pattern, matchType: "contains"|"regex", categoryKey?, labelIds?, customDescription?, excludeFromBudget? })',
    '- ("rule", "delete", { ids: string[] })',
    '- ("label", "create", { name, description?, color?, scope?: "portfolio"|"workspace" })',
    '- ("label", "delete", { ids: string[] })',
    '',
    'Resolve category keys and label ids first via list_entities.',
  ].join('\n'),
  needsApproval: true,
  inputSchema: z.object({
    type: z.enum(['transaction', 'rule', 'label']),
    action: z.enum(['create', 'update', 'update_labels', 'delete']),
    payload: MutatePayload,
  }),
  execute: async (ctx, input) => {
    const threadCtx = await resolveContext(ctx)
    const userId = ctx.userId ?? 'agent'
    const p = input.payload as Record<string, unknown>

    try {
      // transaction.update — category / customName / excludedFromBudget
      if (input.type === 'transaction' && input.action === 'update') {
        const ids = (p.ids as string[] | undefined) ?? []
        if (!ids.length) return { error: 'ids is required' }
        const categoryKey = p.categoryKey as string | undefined
        const customName = p.customName as string | undefined
        const excludedFromBudget = p.excludedFromBudget as boolean | undefined
        if (
          categoryKey === undefined &&
          customName === undefined &&
          excludedFromBudget === undefined
        ) {
          return {
            error:
              'Provide at least one of categoryKey, customName, excludedFromBudget',
          }
        }

        const needsEncryption =
          categoryKey !== undefined || customName !== undefined
        let wsKey: Uint8Array | null = null
        let publicKey: string | null = null
        if (needsEncryption) {
          wsKey = await getWorkspaceDecryptionKey(ctx, threadCtx.workspaceId)
          if (!wsKey) return { error: 'Unable to access encrypted data' }
          publicKey = (await ctx.runQuery(
            internal.agentChatQueries.getWorkspacePublicKey,
            { workspaceId: threadCtx.workspaceId },
          )) as string | null
          if (!publicKey)
            return { error: 'Workspace encryption not configured' }
        }

        const updates: Array<{
          transactionId: Id<'transactions'>
          encryptedCategories?: string
          encryptedDetails?: string
          excludedFromBudget?: boolean
        }> = []
        for (const txId of ids) {
          const tx = await ctx.runQuery(
            internal.agentChatQueries.getTransactionById,
            { transactionId: txId as Id<'transactions'> },
          )
          if (!tx) continue
          const u: (typeof updates)[number] = {
            transactionId: txId as Id<'transactions'>,
          }
          if (categoryKey !== undefined && wsKey && publicKey) {
            const cats = await decryptForProfile(
              tx.encryptedCategories,
              wsKey,
              txId,
              'encryptedCategories',
            )
            cats.userCategoryKey = categoryKey
            u.encryptedCategories = await encryptForProfile(
              cats,
              publicKey,
              txId,
              'encryptedCategories',
            )
          }
          if (customName !== undefined && wsKey && publicKey) {
            const details = await decryptForProfile(
              tx.encryptedDetails,
              wsKey,
              txId,
              'encryptedDetails',
            )
            details.customDescription = customName
            u.encryptedDetails = await encryptForProfile(
              details,
              publicKey,
              txId,
              'encryptedDetails',
            )
          }
          if (excludedFromBudget !== undefined) {
            u.excludedFromBudget = excludedFromBudget
          }
          updates.push(u)
        }
        if (!updates.length) {
          return { error: 'No valid transactions found' }
        }
        await ctx.runMutation(
          internal.agentChatQueries.saveTransactionInternal,
          { updates },
        )
        // One audit log per field kind actually changed, mirroring the
        // events user-facing paths emit.
        if (categoryKey !== undefined) {
          await writeAgentAuditLog(
            ctx,
            threadCtx.workspaceId,
            'transaction.category_batch_updated',
            { affectedCount: updates.length, categoryKey },
            { resourceType: 'transaction' },
          )
        }
        if (customName !== undefined) {
          await writeAgentAuditLog(
            ctx,
            threadCtx.workspaceId,
            'transaction.description_batch_updated',
            { affectedCount: updates.length },
            { resourceType: 'transaction' },
          )
        }
        if (excludedFromBudget !== undefined) {
          await writeAgentAuditLog(
            ctx,
            threadCtx.workspaceId,
            'transaction.exclusion_batch_updated',
            { affectedCount: updates.length, excludedFromBudget },
            { resourceType: 'transaction' },
          )
        }
        return { updated: updates.length }
      }

      // transaction.update_labels
      if (input.type === 'transaction' && input.action === 'update_labels') {
        const ids = (p.ids as string[] | undefined) ?? []
        const addSet = new Set((p.addLabelIds as string[] | undefined) ?? [])
        const removeSet = new Set(
          (p.removeLabelIds as string[] | undefined) ?? [],
        )
        if (!ids.length || (!addSet.size && !removeSet.size)) {
          return {
            error:
              'Provide ids and at least one of addLabelIds / removeLabelIds',
          }
        }
        const updates: Array<{
          transactionId: Id<'transactions'>
          labelIds: Id<'transactionLabels'>[]
        }> = []
        for (const txId of ids) {
          const tx = await ctx.runQuery(
            internal.agentChatQueries.getTransactionById,
            { transactionId: txId as Id<'transactions'> },
          )
          if (!tx) continue
          const current = new Set((tx.labelIds as string[] | undefined) ?? [])
          for (const a of addSet) current.add(a)
          for (const r of removeSet) current.delete(r)
          updates.push({
            transactionId: txId as Id<'transactions'>,
            labelIds: [...current] as Id<'transactionLabels'>[],
          })
        }
        if (!updates.length) return { error: 'No valid transactions found' }
        await ctx.runMutation(
          internal.agentChatQueries.updateTransactionLabelsInternal,
          { updates },
        )
        await writeAgentAuditLog(
          ctx,
          threadCtx.workspaceId,
          'transaction.labels_batch_updated',
          {
            affectedCount: updates.length,
            addLabelIds: [...addSet],
            removeLabelIds: [...removeSet],
          },
          { resourceType: 'transaction' },
        )
        return { updated: updates.length }
      }

      // rule.create
      if (input.type === 'rule' && input.action === 'create') {
        const pattern = String(p.pattern ?? '')
        const matchType = (p.matchType as 'contains' | 'regex') ?? 'contains'
        const categoryKey = p.categoryKey as string | undefined
        const excludeFromBudget = p.excludeFromBudget as boolean | undefined
        const labelIds = p.labelIds as Id<'transactionLabels'>[] | undefined
        const ruleId = (await ctx.runMutation(
          internal.transactionRules.createRuleInternal,
          {
            workspaceId: threadCtx.workspaceId,
            createdBy: userId,
            pattern,
            matchType,
            categoryKey,
            excludeFromBudget,
            labelIds,
            customDescription: p.customDescription as string | undefined,
          },
        )) as string
        await writeAgentAuditLog(
          ctx,
          threadCtx.workspaceId,
          'rule.created',
          {
            ruleId,
            pattern,
            matchType,
            categoryKey,
            excludeFromBudget,
            labelCount: labelIds?.length ?? 0,
          },
          { resourceType: 'rule', resourceId: ruleId },
        )
        return { ruleId }
      }

      // rule.delete
      if (input.type === 'rule' && input.action === 'delete') {
        const ids = (p.ids as string[] | undefined) ?? []
        if (!ids.length) return { error: 'ids is required' }
        await ctx.runMutation(
          internal.agentChatQueries.deleteTransactionRulesInternal,
          { ruleIds: ids as Id<'transactionRules'>[] },
        )
        await writeAgentAuditLog(
          ctx,
          threadCtx.workspaceId,
          'rule.batch_deleted',
          { ruleIds: ids, count: ids.length },
          { resourceType: 'rule' },
        )
        return { deleted: ids.length }
      }

      // label.create
      if (input.type === 'label' && input.action === 'create') {
        const scope =
          (p.scope as 'portfolio' | 'workspace' | undefined) ??
          (threadCtx.portfolioScope === 'portfolio' && threadCtx.portfolioId
            ? 'portfolio'
            : 'workspace')
        const portfolioId = scope === 'portfolio' ? threadCtx.portfolioId : null
        const rawName = String(p.name ?? '')
        const name = rawName.charAt(0).toUpperCase() + rawName.slice(1)
        const labelId = (await ctx.runMutation(
          internal.agentChatQueries.createLabelInternal,
          {
            workspaceId: threadCtx.workspaceId,
            name,
            description: p.description as string | undefined,
            color: (p.color as string | undefined) ?? '#6366f1',
            ...(portfolioId ? { portfolioId } : {}),
          },
        )) as string
        await writeAgentAuditLog(
          ctx,
          threadCtx.workspaceId,
          'label.created',
          { labelId, name, scope },
          {
            resourceType: 'label',
            resourceId: labelId,
            resourceName: name,
            ...(portfolioId ? { portfolioId } : {}),
          },
        )
        return { labelId }
      }

      // label.delete
      if (input.type === 'label' && input.action === 'delete') {
        const ids = (p.ids as string[] | undefined) ?? []
        if (!ids.length) return { error: 'ids is required' }
        await ctx.runMutation(internal.agentChatQueries.deleteLabelsInternal, {
          labelIds: ids as Id<'transactionLabels'>[],
        })
        await writeAgentAuditLog(
          ctx,
          threadCtx.workspaceId,
          'label.batch_deleted',
          { labelIds: ids, count: ids.length },
          { resourceType: 'label' },
        )
        return { deleted: ids.length }
      }

      return {
        error: `Unsupported (type, action): (${input.type}, ${input.action})`,
      }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Mutation failed',
      }
    }
  },
})

// ============================================================================
// 6. bulk_mutate_entity
// ============================================================================

export const bulkMutateEntity = createTool({
  title: 'Bulk Mutate Entity',
  description: [
    'Preview and apply a write across many transactions selected by a filter.',
    'ALWAYS call with mode="dry_run" first so the user can see the affected count and sample ids;',
    'then call again with mode="commit" to apply. The dry_run call is read-only and does not require user approval; only commit calls prompt the user.',
    '',
    'Operations:',
    '- "recategorize" (target.categoryKey required)',
    '- "relabel" (target.addLabelIds and/or target.removeLabelIds)',
    '- "exclude_from_budget" (target.excluded=true)',
    '- "include_in_budget" (target.excluded=false)',
    '',
    'Filter shape matches query_transactions filters.',
  ].join('\n'),
  // dry_run is a read-only preview — skip approval for it and only prompt
  // the user on commit. This avoids showing a confusing approval card for
  // the LLM's own preview step before it asks the user to go ahead.
  needsApproval: (_ctx, input) =>
    (input as { mode?: string }).mode === 'commit',
  inputSchema: z.object({
    operation: z.enum([
      'recategorize',
      'relabel',
      'exclude_from_budget',
      'include_in_budget',
    ]),
    filter: z.object({
      dateRange: DateRange.optional(),
      accountIds: z.array(z.string()).optional(),
      portfolioIds: z.array(z.string()).optional(),
      categoryKeys: z.array(z.string()).optional(),
      labelIds: z.array(z.string()).optional(),
      counterparty: z.string().optional(),
      textSearch: z.string().optional(),
      amountRange: AmountRange.optional(),
      sign: z.enum(['income', 'expense']).optional(),
      excludedFromBudget: z.boolean().optional(),
    }),
    target: z.object({
      categoryKey: z.string().optional(),
      addLabelIds: z.array(z.string()).optional(),
      removeLabelIds: z.array(z.string()).optional(),
      excluded: z.boolean().optional(),
    }),
    mode: z.enum(['dry_run', 'commit']),
  }),
  execute: async (ctx, input) => {
    const threadCtx = await resolveContext(ctx)
    const wsKey = await getWorkspaceDecryptionKey(ctx, threadCtx.workspaceId)
    if (!wsKey) return { error: 'Unable to access encrypted data' }

    const portfolioIds = await resolvePortfolioIds(
      ctx,
      threadCtx,
      input.filter.portfolioIds,
    )
    const from = input.filter.dateRange?.from ?? '1900-01-01'
    const to = input.filter.dateRange?.to ?? '2999-12-31'
    const raw: RawTransaction[] = (
      await Promise.all(
        portfolioIds.map((pid) =>
          ctx.runQuery(
            internal.agentChatQueries.listTransactionsByDateRangeAll,
            { portfolioId: pid, startDate: from, endDate: to },
          ),
        ),
      )
    ).flat() as RawTransaction[]

    // Decrypt + filter using the same shape as query_transactions.
    const decrypted: Array<DecryptedTransaction & { _raw: RawTransaction }> =
      await Promise.all(
        raw.map(async (tx: RawTransaction) => {
          const data = await decryptFieldGroups(
            {
              encryptedDetails: tx.encryptedDetails,
              encryptedFinancials: tx.encryptedFinancials,
              encryptedCategories: tx.encryptedCategories,
            },
            wsKey,
            tx._id,
          )
          const resolved = (
            (data.userCategoryKey as string) ||
            (data.categoryParent as string) ||
            (data.category as string) ||
            'others'
          ).toLowerCase()
          return {
            id: tx._id,
            date: tx.date,
            amount: Number(data.value) || 0,
            currency: tx.originalCurrency ?? 'EUR',
            category: resolved,
            categoryRaw: (data.category as string) || undefined,
            categoryParent: (data.categoryParent as string) || undefined,
            labelIds: ((tx.labelIds as string[] | undefined) ?? []).map(String),
            counterparty: (data.counterparty as string) || undefined,
            description:
              (data.customDescription as string) ||
              (data.simplifiedWording as string) ||
              (data.wording as string) ||
              '',
            wording: (data.wording as string) || undefined,
            accountId: String(tx.bankAccountId),
            portfolioId: String(tx.portfolioId),
            excludedFromBudget: Boolean(tx.excludedFromBudget),
            _raw: tx,
          }
        }),
      )

    const { filterTransactions } = await import('./agentPrimitivesCore')
    const matched = filterTransactions(decrypted, input.filter) as Array<
      DecryptedTransaction & { _raw: RawTransaction }
    >

    if (input.mode === 'dry_run') {
      return {
        affectedCount: matched.length,
        sampleIds: matched.slice(0, 10).map((m) => m.id),
      }
    }

    // commit — delegate to the single-entity paths for consistency
    if (input.operation === 'recategorize') {
      if (!input.target.categoryKey)
        return { error: 'target.categoryKey is required' }
      const publicKey = (await ctx.runQuery(
        internal.agentChatQueries.getWorkspacePublicKey,
        { workspaceId: threadCtx.workspaceId },
      )) as string | null
      if (!publicKey) return { error: 'Workspace encryption not configured' }
      const updates: Array<{
        transactionId: Id<'transactions'>
        encryptedCategories: string
      }> = []
      for (const m of matched) {
        const cats = await decryptForProfile(
          m._raw.encryptedCategories,
          wsKey,
          m.id,
          'encryptedCategories',
        )
        cats.userCategoryKey = input.target.categoryKey
        updates.push({
          transactionId: m.id as Id<'transactions'>,
          encryptedCategories: await encryptForProfile(
            cats,
            publicKey,
            m.id,
            'encryptedCategories',
          ),
        })
      }
      await ctx.runMutation(internal.agentChatQueries.saveTransactionInternal, {
        updates,
      })
      await writeAgentAuditLog(
        ctx,
        threadCtx.workspaceId,
        'transaction.category_batch_updated',
        {
          affectedCount: updates.length,
          categoryKey: input.target.categoryKey,
        },
        { resourceType: 'transaction' },
      )
      return { affectedCount: updates.length, committed: true }
    }

    if (input.operation === 'relabel') {
      const addSet = new Set(input.target.addLabelIds ?? [])
      const removeSet = new Set(input.target.removeLabelIds ?? [])
      if (!addSet.size && !removeSet.size) {
        return { error: 'Provide addLabelIds or removeLabelIds' }
      }
      const updates = matched.map((m) => {
        const cur = new Set(m.labelIds)
        for (const a of addSet) cur.add(a)
        for (const r of removeSet) cur.delete(r)
        return {
          transactionId: m.id as Id<'transactions'>,
          labelIds: [...cur] as Id<'transactionLabels'>[],
        }
      })
      await ctx.runMutation(
        internal.agentChatQueries.updateTransactionLabelsInternal,
        { updates },
      )
      await writeAgentAuditLog(
        ctx,
        threadCtx.workspaceId,
        'transaction.labels_batch_updated',
        {
          affectedCount: updates.length,
          addLabelIds: [...addSet],
          removeLabelIds: [...removeSet],
        },
        { resourceType: 'transaction' },
      )
      return { affectedCount: updates.length, committed: true }
    }

    if (
      input.operation === 'exclude_from_budget' ||
      input.operation === 'include_in_budget'
    ) {
      const excluded = input.operation === 'exclude_from_budget'
      const updates = matched.map((m) => ({
        transactionId: m.id as Id<'transactions'>,
        excludedFromBudget: excluded,
      }))
      await ctx.runMutation(internal.agentChatQueries.saveTransactionInternal, {
        updates,
      })
      await writeAgentAuditLog(
        ctx,
        threadCtx.workspaceId,
        'transaction.exclusion_batch_updated',
        { affectedCount: updates.length, excludedFromBudget: excluded },
        { resourceType: 'transaction' },
      )
      return { affectedCount: updates.length, committed: true }
    }

    return { error: `Unsupported operation: ${input.operation}` }
  },
})

// ============================================================================
// view_transactions (UI action — silent link generator, not a read primitive)
// ============================================================================

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

// ============================================================================
// 7. query_audit_logs
// ============================================================================

export const queryAuditLogs = createTool({
  title: 'Query Audit Logs',
  description: [
    'Read the audit trail. Answers "what changed yesterday", "did the agent touch rent?", "who categorized this".',
    'actorType filter: "user" | "system" | "agent".',
    'Date range uses ms epoch timestamps; prefer dateRange in YYYY-MM-DD for convenience.',
  ].join('\n'),
  inputSchema: z.object({
    dateRange: DateRange.optional(),
    actorType: z.enum(['user', 'system', 'agent']).optional(),
    eventTypes: z.array(z.string()).optional(),
    resourceType: z.string().optional(),
    resourceId: z.string().optional(),
    limit: z.number().optional(),
  }),
  execute: async (ctx, input): Promise<unknown> => {
    const threadCtx = await resolveContext(ctx)
    const fromTs = input.dateRange
      ? new Date(input.dateRange.from).getTime()
      : undefined
    const toTs = input.dateRange
      ? new Date(input.dateRange.to).getTime() + 86400000
      : undefined

    const logs = (await ctx.runQuery(
      internal.agentChatQueries.listAuditLogsByWorkspace,
      {
        workspaceId: threadCtx.workspaceId,
        fromTs,
        toTs,
        actorType: input.actorType,
        eventTypes: input.eventTypes,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        limit: input.limit,
      },
    )) as Array<{
      _id: string
      timestamp: number
      event: string
      actorType: string
      actorName?: string
      resourceType?: string
      resourceId?: string
      metadata: string
      agentThreadId?: string
    }>

    return {
      logs: logs.map(
        (l: {
          _id: string
          timestamp: number
          event: string
          actorType: string
          actorName?: string
          resourceType?: string
          resourceId?: string
          metadata: string
          agentThreadId?: string
        }) => ({
          id: l._id,
          timestamp: l.timestamp,
          event: l.event,
          actorType: l.actorType,
          actorName: l.actorName ?? null,
          resourceType: l.resourceType ?? null,
          resourceId: l.resourceId ?? null,
          metadata: l.metadata,
          agentThreadId: l.agentThreadId ?? null,
        }),
      ),
    }
  },
})
