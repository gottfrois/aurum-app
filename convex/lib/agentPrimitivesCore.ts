/**
 * Pure (no-I/O) helpers powering the query_transactions primitive.
 *
 * Kept separate from agentPrimitives.ts so the filter/groupBy/aggregate
 * logic can be unit-tested without the Convex/Node runtime or encryption.
 */

// ---------- Input shapes -----------------------------------------------------

export interface DecryptedTransaction {
  id: string
  date: string // YYYY-MM-DD
  amount: number // signed: positive = income, negative = expense
  currency: string
  category: string // resolved category key (user > parent > raw > 'others')
  categoryRaw?: string
  categoryParent?: string
  labelIds: string[]
  counterparty?: string
  description: string
  wording?: string
  accountId: string
  portfolioId: string
  excludedFromBudget: boolean
  isRecurring?: boolean
}

export type GroupBy =
  | 'none'
  | 'category'
  | 'counterparty'
  | 'month'
  | 'week'
  | 'day'
  | 'label'
  | 'account'

export type Aggregate = 'sum' | 'count' | 'avg' | 'min' | 'max' | 'p50' | 'p95'

export type SortField = 'date' | 'amount' | 'count'

export interface QueryTransactionsFilters {
  dateRange?: { from: string; to: string }
  accountIds?: string[]
  portfolioIds?: string[]
  categoryKeys?: string[]
  labelIds?: string[]
  counterparty?: string
  textSearch?: string
  amountRange?: { min?: number; max?: number; currency?: string }
  excludedFromBudget?: boolean
  isRecurring?: boolean
  sign?: 'income' | 'expense'
}

export interface QueryTransactionsOptions {
  groupBy?: GroupBy
  aggregate?: Aggregate[]
  sort?: { field: SortField; dir: 'asc' | 'desc' }
  limit?: number
  returnSamples?: boolean
  samplesPerBucket?: number
}

export interface TransactionPreview {
  id: string
  date: string
  amount: number
  currency: string
  category: string
  counterparty?: string
  description: string
}

export interface Bucket {
  key: string | null
  label: string
  aggregates: Record<string, number>
  samples?: TransactionPreview[]
}

export interface QueryTransactionsResult {
  buckets: Bucket[]
  totals: Record<string, number>
  truncated: boolean
}

// ---------- Filter -----------------------------------------------------------

export function filterTransactions(
  txs: DecryptedTransaction[],
  filters: QueryTransactionsFilters,
): DecryptedTransaction[] {
  return txs.filter((tx) => {
    if (filters.dateRange) {
      if (tx.date < filters.dateRange.from) return false
      if (tx.date > filters.dateRange.to) return false
    }
    if (
      filters.accountIds?.length &&
      !filters.accountIds.includes(tx.accountId)
    )
      return false
    if (
      filters.portfolioIds?.length &&
      !filters.portfolioIds.includes(tx.portfolioId)
    )
      return false
    if (filters.categoryKeys?.length) {
      const keys = filters.categoryKeys.map((k) => k.toLowerCase())
      const matches =
        keys.includes(tx.category.toLowerCase()) ||
        (tx.categoryRaw && keys.includes(tx.categoryRaw.toLowerCase())) ||
        (tx.categoryParent && keys.includes(tx.categoryParent.toLowerCase()))
      if (!matches) return false
    }
    if (filters.labelIds?.length) {
      const hasAny = tx.labelIds.some((id) => filters.labelIds?.includes(id))
      if (!hasAny) return false
    }
    if (filters.counterparty) {
      const needle = filters.counterparty.toLowerCase()
      if (!(tx.counterparty ?? '').toLowerCase().includes(needle)) return false
    }
    if (filters.textSearch) {
      const needle = filters.textSearch.toLowerCase()
      const haystack = [tx.description, tx.wording, tx.counterparty]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(needle)) return false
    }
    if (filters.amountRange) {
      const { min, max, currency } = filters.amountRange
      if (currency && tx.currency !== currency) return false
      const abs = Math.abs(tx.amount)
      if (min !== undefined && abs < min) return false
      if (max !== undefined && abs > max) return false
    }
    if (
      filters.excludedFromBudget !== undefined &&
      tx.excludedFromBudget !== filters.excludedFromBudget
    )
      return false
    if (
      filters.isRecurring !== undefined &&
      (tx.isRecurring ?? false) !== filters.isRecurring
    )
      return false
    if (filters.sign === 'income' && tx.amount <= 0) return false
    if (filters.sign === 'expense' && tx.amount >= 0) return false
    return true
  })
}

// ---------- Group + aggregate ------------------------------------------------

function bucketKey(tx: DecryptedTransaction, groupBy: GroupBy): string | null {
  switch (groupBy) {
    case 'none':
      return null
    case 'category':
      return tx.category
    case 'counterparty':
      return tx.counterparty ?? '(unknown)'
    case 'month':
      return tx.date.slice(0, 7)
    case 'week':
      return isoWeekStart(tx.date)
    case 'day':
      return tx.date
    case 'account':
      return tx.accountId
    case 'label':
      return tx.labelIds[0] ?? '(none)'
  }
}

function isoWeekStart(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`)
  const day = d.getUTCDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + mondayOffset)
  return d.toISOString().slice(0, 10)
}

function expandLabelBuckets(
  txs: DecryptedTransaction[],
): Array<{ key: string; tx: DecryptedTransaction }> {
  // Each transaction contributes once per label (or '(none)' if no labels).
  const out: Array<{ key: string; tx: DecryptedTransaction }> = []
  for (const tx of txs) {
    if (tx.labelIds.length === 0) {
      out.push({ key: '(none)', tx })
      continue
    }
    for (const labelId of tx.labelIds) {
      out.push({ key: labelId, tx })
    }
  }
  return out
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))
  return sorted[idx]
}

function computeAggregates(
  txs: DecryptedTransaction[],
  aggregates: Aggregate[],
): Record<string, number> {
  const amounts = txs.map((t) => t.amount)
  const sortedAbs = [...amounts].map((a) => Math.abs(a)).sort((a, b) => a - b)
  const out: Record<string, number> = {}
  for (const agg of aggregates) {
    switch (agg) {
      case 'sum':
        out.sum = round2(amounts.reduce((acc, n) => acc + n, 0))
        break
      case 'count':
        out.count = txs.length
        break
      case 'avg':
        out.avg =
          amounts.length > 0
            ? round2(amounts.reduce((acc, n) => acc + n, 0) / amounts.length)
            : 0
        break
      case 'min':
        out.min = amounts.length > 0 ? Math.min(...amounts) : 0
        break
      case 'max':
        out.max = amounts.length > 0 ? Math.max(...amounts) : 0
        break
      case 'p50':
        out.p50 = round2(percentile(sortedAbs, 0.5))
        break
      case 'p95':
        out.p95 = round2(percentile(sortedAbs, 0.95))
        break
    }
  }
  return out
}

// ---------- Public entrypoint -----------------------------------------------

export function queryTransactions(
  txs: DecryptedTransaction[],
  filters: QueryTransactionsFilters,
  options: QueryTransactionsOptions = {},
): QueryTransactionsResult {
  const filtered = filterTransactions(txs, filters)
  const groupBy = options.groupBy ?? 'none'
  const aggregates: Aggregate[] = options.aggregate?.length
    ? options.aggregate
    : ['sum', 'count']
  const limit = Math.min(options.limit ?? 50, 500)
  const samplesPerBucket = Math.max(1, options.samplesPerBucket ?? 5)

  // Totals are always across the unbucketed filtered set.
  const totals = computeAggregates(filtered, aggregates)

  // Build groups.
  const groups = new Map<string | null, DecryptedTransaction[]>()
  if (groupBy === 'label') {
    for (const { key, tx } of expandLabelBuckets(filtered)) {
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)?.push(tx)
    }
  } else if (groupBy === 'none') {
    groups.set(null, filtered)
  } else {
    for (const tx of filtered) {
      const key = bucketKey(tx, groupBy)
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)?.push(tx)
    }
  }

  let buckets: Bucket[] = [...groups.entries()].map(([key, list]) => ({
    key,
    label: key ?? 'all',
    aggregates: computeAggregates(list, aggregates),
    samples: options.returnSamples
      ? pickSamples(list, samplesPerBucket, options.sort)
      : undefined,
  }))

  // Sort buckets.
  const sortField = options.sort?.field ?? 'count'
  const sortDir = options.sort?.dir ?? 'desc'
  buckets.sort((a, b) => {
    const av = bucketSortValue(a, sortField)
    const bv = bucketSortValue(b, sortField)
    return sortDir === 'asc' ? av - bv : bv - av
  })

  const truncated = buckets.length > limit
  if (truncated) buckets = buckets.slice(0, limit)

  return { buckets, totals, truncated }
}

function bucketSortValue(b: Bucket, field: SortField): number {
  if (field === 'date') return b.key ? Date.parse(b.key) || 0 : 0
  if (field === 'amount') return Math.abs(b.aggregates.sum ?? 0)
  return b.aggregates.count ?? 0
}

function pickSamples(
  txs: DecryptedTransaction[],
  n: number,
  sort?: { field: SortField; dir: 'asc' | 'desc' },
): TransactionPreview[] {
  const field = sort?.field ?? 'amount'
  const dir = sort?.dir ?? 'desc'
  const sorted = [...txs].sort((a, b) => {
    if (field === 'date') {
      return dir === 'asc'
        ? a.date.localeCompare(b.date)
        : b.date.localeCompare(a.date)
    }
    // amount / count (count not meaningful per-tx, default to amount)
    const av = Math.abs(a.amount)
    const bv = Math.abs(b.amount)
    return dir === 'asc' ? av - bv : bv - av
  })
  return sorted.slice(0, n).map((tx) => ({
    id: tx.id,
    date: tx.date,
    amount: round2(tx.amount),
    currency: tx.currency,
    category: tx.category,
    counterparty: tx.counterparty,
    description: tx.description,
  }))
}
