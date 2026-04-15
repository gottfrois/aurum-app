import { describe, expect, it } from 'vitest'
import {
  type AccountMeta,
  bucketOf,
  capGroups,
  computeBalanceSeries,
  computeCashFlowSeries,
  groupKeyFor,
  type SeriesSnapshot,
  type SeriesTx,
} from './querySeriesCore'

function accountsMap(list: AccountMeta[]): Map<string, AccountMeta> {
  const m = new Map<string, AccountMeta>()
  for (const a of list) m.set(a.id, a)
  return m
}

describe('bucketOf', () => {
  it('returns raw date for day granularity', () => {
    expect(bucketOf('2026-03-15', 'day')).toBe('2026-03-15')
  })

  it('returns YYYY-MM for month granularity', () => {
    expect(bucketOf('2026-03-15', 'month')).toBe('2026-03')
  })

  it('snaps to ISO week start (Monday) for week granularity', () => {
    // 2026-03-15 is a Sunday -> week starts Mon 2026-03-09
    expect(bucketOf('2026-03-15', 'week')).toBe('2026-03-09')
    // 2026-03-09 is a Monday -> unchanged
    expect(bucketOf('2026-03-09', 'week')).toBe('2026-03-09')
  })
})

describe('groupKeyFor', () => {
  const acct: AccountMeta = {
    id: 'a1',
    type: 'market',
    currency: 'EUR',
    portfolioId: 'p1',
  }

  it('returns singleton key for groupBy=none', () => {
    expect(groupKeyFor(acct, 'none')).toBe('value')
  })

  it('maps market -> investments via assetClass', () => {
    expect(groupKeyFor(acct, 'assetClass')).toBe('investments')
  })

  it('returns raw type for accountType', () => {
    expect(groupKeyFor(acct, 'accountType')).toBe('market')
  })

  it('falls back to "unknown" when account is missing', () => {
    expect(groupKeyFor(undefined, 'assetClass')).toBe('unknown')
  })
})

describe('computeCashFlowSeries', () => {
  const accounts = accountsMap([
    { id: 'checking1', type: 'checking', currency: 'EUR', portfolioId: 'p1' },
    { id: 'market1', type: 'market', currency: 'EUR', portfolioId: 'p1' },
  ])

  const txs: SeriesTx[] = [
    {
      accountId: 'checking1',
      date: '2026-03-05',
      value: -40,
      excludedFromBudget: false,
    },
    {
      accountId: 'checking1',
      date: '2026-03-20',
      value: -10,
      excludedFromBudget: false,
    },
    {
      accountId: 'market1',
      date: '2026-03-15',
      value: -100,
      excludedFromBudget: false,
    },
    // income — should be skipped for spending
    {
      accountId: 'checking1',
      date: '2026-03-28',
      value: 3200,
      excludedFromBudget: false,
    },
    // excluded
    {
      accountId: 'checking1',
      date: '2026-03-29',
      value: -500,
      excludedFromBudget: true,
    },
  ]

  it('groups spending by assetClass', () => {
    const out = computeCashFlowSeries(
      txs,
      accounts,
      'spending',
      'month',
      'assetClass',
    )
    expect(out.groups.sort()).toEqual(['checking', 'investments'])
    expect(out.points).toEqual([
      { t: '2026-03', checking: 50, investments: 100 },
    ])
  })

  it('legacy shape when groupBy=none (single "value" series)', () => {
    const out = computeCashFlowSeries(
      txs,
      accounts,
      'spending',
      'month',
      'none',
    )
    expect(out.groups).toEqual(['value'])
    expect(out.points).toEqual([{ t: '2026-03', value: 150 }])
  })

  it('filters by sign (income keeps positive only)', () => {
    const out = computeCashFlowSeries(txs, accounts, 'income', 'month', 'none')
    expect(out.points).toEqual([{ t: '2026-03', value: 3200 }])
  })
})

describe('computeBalanceSeries', () => {
  const accounts = accountsMap([
    { id: 'checking1', type: 'checking', currency: 'EUR', portfolioId: 'p1' },
    { id: 'savings1', type: 'savings', currency: 'EUR', portfolioId: 'p1' },
    { id: 'market1', type: 'market', currency: 'EUR', portfolioId: 'p1' },
  ])

  const snapshots: SeriesSnapshot[] = [
    { accountId: 'checking1', date: '2026-01-31', balance: 1000 },
    { accountId: 'savings1', date: '2026-01-31', balance: 5000 },
    { accountId: 'market1', date: '2026-01-31', balance: 20000 },
    // Feb: only checking + market refresh; savings should carry 5000 forward
    { accountId: 'checking1', date: '2026-02-28', balance: 1200 },
    { accountId: 'market1', date: '2026-02-28', balance: 21000 },
  ]

  it('stacks balances by assetClass and carries forward missing accounts', () => {
    const out = computeBalanceSeries(snapshots, accounts, 'month', 'assetClass')
    expect(out.groups.sort()).toEqual(['checking', 'investments', 'savings'])
    expect(out.points).toEqual([
      { t: '2026-01', checking: 1000, investments: 20000, savings: 5000 },
      { t: '2026-02', checking: 1200, investments: 21000, savings: 5000 },
    ])
  })

  it('produces a single aggregated value when groupBy=none', () => {
    const out = computeBalanceSeries(snapshots, accounts, 'month', 'none')
    expect(out.groups).toEqual(['value'])
    expect(out.points).toEqual([
      { t: '2026-01', value: 26000 },
      { t: '2026-02', value: 27200 },
    ])
  })

  it('groups by currency', () => {
    const mixed = accountsMap([
      { id: 'a', type: 'checking', currency: 'EUR', portfolioId: 'p1' },
      { id: 'b', type: 'checking', currency: 'USD', portfolioId: 'p1' },
    ])
    const snaps: SeriesSnapshot[] = [
      { accountId: 'a', date: '2026-01-31', balance: 1000 },
      { accountId: 'b', date: '2026-01-31', balance: 500 },
    ]
    const out = computeBalanceSeries(snaps, mixed, 'month', 'currency')
    expect(out.points).toEqual([{ t: '2026-01', EUR: 1000, USD: 500 }])
  })
})

describe('capGroups', () => {
  it('is a no-op when within the cap', () => {
    const input = {
      groups: ['a', 'b'],
      points: [{ t: '2026-01', a: 10, b: 20 }],
    }
    expect(capGroups(input, 6)).toEqual(input)
  })

  it('collapses tail groups into "other" (keeps top N-1 by magnitude)', () => {
    const input = {
      groups: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
      points: [
        { t: '2026-01', a: 100, b: 90, c: 80, d: 70, e: 60, f: 50, g: 40 },
      ],
    }
    const out = capGroups(input, 3)
    // Top 2 by magnitude: a (100), b (90). Rest -> other = 80+70+60+50+40 = 300.
    expect(out.groups).toEqual(['a', 'b', 'other'])
    expect(out.points).toEqual([{ t: '2026-01', a: 100, b: 90, other: 300 }])
  })
})
