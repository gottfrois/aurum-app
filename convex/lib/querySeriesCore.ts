/**
 * Pure (no-I/O) helpers for the query_series primitive.
 *
 * Kept separate from agentPrimitives.ts so the bucketing / grouping /
 * carry-forward logic can be unit-tested without Convex + encryption.
 */

import { getCategoryKey } from './accountCategories'

export type Granularity = 'day' | 'week' | 'month'

export type SeriesGroupBy =
  | 'none'
  | 'account'
  | 'accountType'
  | 'assetClass'
  | 'currency'
  | 'portfolio'

export interface AccountMeta {
  id: string
  type?: string
  currency: string
  portfolioId: string
}

export interface SeriesTx {
  accountId: string
  date: string // YYYY-MM-DD
  value: number // signed: negative = expense, positive = income
  excludedFromBudget: boolean
}

export interface SeriesSnapshot {
  accountId: string
  date: string // YYYY-MM-DD
  balance: number
}

export interface SeriesRow {
  t: string
  [group: string]: string | number
}

export interface GroupedSeries {
  groups: string[]
  points: SeriesRow[]
}

export const SINGLE_SERIES_KEY = 'value'
export const OTHER_GROUP_KEY = 'other'
export const UNKNOWN_GROUP_KEY = 'unknown'

export function bucketOf(date: string, granularity: Granularity): string {
  if (granularity === 'day') return date
  if (granularity === 'month') return date.slice(0, 7)
  // week — ISO week start (Monday)
  const d = new Date(`${date}T00:00:00Z`)
  const day = d.getUTCDay()
  const offset = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}

export function groupKeyFor(
  acct: AccountMeta | undefined,
  groupBy: SeriesGroupBy,
): string {
  if (groupBy === 'none') return SINGLE_SERIES_KEY
  if (!acct) return UNKNOWN_GROUP_KEY
  switch (groupBy) {
    case 'account':
      return acct.id
    case 'accountType':
      return acct.type || UNKNOWN_GROUP_KEY
    case 'assetClass':
      return getCategoryKey(acct.type)
    case 'currency':
      return acct.currency || UNKNOWN_GROUP_KEY
    case 'portfolio':
      return acct.portfolioId
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Bucket and group spending / income transactions.
 *
 * `metric='spending'` keeps negative amounts; `'income'` keeps positive.
 * Values are summed as absolute numbers per (bucket, group).
 */
export function computeCashFlowSeries(
  txs: SeriesTx[],
  accounts: Map<string, AccountMeta>,
  metric: 'spending' | 'income',
  granularity: Granularity,
  groupBy: SeriesGroupBy,
): GroupedSeries {
  // bucket -> groupKey -> sum
  const buckets = new Map<string, Map<string, number>>()
  const groupsSet = new Set<string>()

  for (const tx of txs) {
    if (tx.excludedFromBudget) continue
    const v = Number(tx.value) || 0
    if (metric === 'spending' && v >= 0) continue
    if (metric === 'income' && v <= 0) continue
    const bk = bucketOf(tx.date, granularity)
    const gk = groupKeyFor(accounts.get(tx.accountId), groupBy)
    groupsSet.add(gk)
    const inner = buckets.get(bk) ?? new Map<string, number>()
    inner.set(gk, (inner.get(gk) ?? 0) + Math.abs(v))
    buckets.set(bk, inner)
  }

  const sortedBuckets = [...buckets.keys()].sort()
  const groups = [...groupsSet].sort()
  const points: SeriesRow[] = sortedBuckets.map((b) => {
    const inner = buckets.get(b) ?? new Map<string, number>()
    const row: SeriesRow = { t: b }
    for (const g of groups) row[g] = round2(inner.get(g) ?? 0)
    return row
  })
  return { groups, points }
}

/**
 * Bucket and group balance / net-worth snapshots.
 *
 * Semantics match the legacy handler:
 *  - take the last snapshot per (account, bucket)
 *  - carry forward the last known balance per account across buckets
 *  - sum into `groupKeyFor(account, groupBy)` at each bucket
 *
 * Every row includes every group (filled with 0 when missing) so multi-series
 * charts render cleanly.
 */
export function computeBalanceSeries(
  snapshots: SeriesSnapshot[],
  accounts: Map<string, AccountMeta>,
  granularity: Granularity,
  groupBy: SeriesGroupBy,
): GroupedSeries {
  const perAccount = new Map<
    string,
    Array<{ bucket: string; date: string; balance: number }>
  >()
  for (const snap of snapshots) {
    const bucket = bucketOf(snap.date, granularity)
    const arr = perAccount.get(snap.accountId) ?? []
    arr.push({ bucket, date: snap.date, balance: snap.balance })
    perAccount.set(snap.accountId, arr)
  }

  // bucket -> account -> last balance in that bucket
  const lastPerBucket = new Map<string, Map<string, number>>()
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
  const groupsSet = new Set<string>()
  const rawRows: Array<{ t: string; perGroup: Map<string, number> }> = []

  for (const b of allBuckets) {
    const byAcct = lastPerBucket.get(b)
    if (byAcct) for (const [acct, bal] of byAcct) carry.set(acct, bal)
    const perGroup = new Map<string, number>()
    for (const [acct, bal] of carry) {
      const gk = groupKeyFor(accounts.get(acct), groupBy)
      groupsSet.add(gk)
      perGroup.set(gk, (perGroup.get(gk) ?? 0) + bal)
    }
    rawRows.push({ t: b, perGroup })
  }

  const groups = [...groupsSet].sort()
  const points: SeriesRow[] = rawRows.map(({ t, perGroup }) => {
    const row: SeriesRow = { t }
    for (const g of groups) row[g] = round2(perGroup.get(g) ?? 0)
    return row
  })
  return { groups, points }
}

/**
 * Chart rendering caps at 6 series. When there are too many groups,
 * keep the top (max-1) by total |magnitude| across the whole series and
 * collapse the rest into a synthetic `other` group so users still see the tail.
 */
export function capGroups(input: GroupedSeries, max: number): GroupedSeries {
  if (input.groups.length <= max) return input
  const totals = new Map<string, number>()
  for (const g of input.groups) totals.set(g, 0)
  for (const row of input.points) {
    for (const g of input.groups) {
      totals.set(g, (totals.get(g) ?? 0) + Math.abs(Number(row[g] ?? 0)))
    }
  }
  const sorted = input.groups
    .slice()
    .sort((a, b) => (totals.get(b) ?? 0) - (totals.get(a) ?? 0))
  const keep = new Set(sorted.slice(0, max - 1))
  const points: SeriesRow[] = input.points.map((row) => {
    const newRow: SeriesRow = { t: row.t }
    let other = 0
    for (const g of input.groups) {
      const v = Number(row[g] ?? 0)
      if (keep.has(g)) newRow[g] = v
      else other += v
    }
    newRow[OTHER_GROUP_KEY] = round2(other)
    return newRow
  })
  const keptOrdered = sorted.slice(0, max - 1)
  return { groups: [...keptOrdered, OTHER_GROUP_KEY], points }
}
