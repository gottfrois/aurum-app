import { describe, expect, it } from 'vitest'
import {
  type DecryptedTransaction,
  filterTransactions,
  queryTransactions,
} from './agentPrimitivesCore'

function tx(overrides: Partial<DecryptedTransaction>): DecryptedTransaction {
  return {
    id: 'tx1',
    date: '2026-03-01',
    amount: -10,
    currency: 'EUR',
    category: 'food_and_restaurants',
    labelIds: [],
    description: 'Test',
    accountId: 'acc1',
    portfolioId: 'pf1',
    excludedFromBudget: false,
    ...overrides,
  }
}

describe('filterTransactions', () => {
  const base = [
    tx({ id: 'a', date: '2026-03-01', amount: -50, category: 'food' }),
    tx({ id: 'b', date: '2026-03-15', amount: -20, category: 'transport' }),
    tx({ id: 'c', date: '2026-04-02', amount: 3000, category: 'salary' }),
    tx({
      id: 'd',
      date: '2026-04-05',
      amount: -80,
      category: 'food',
      labelIds: ['l1'],
    }),
  ]

  it('filters by date range inclusively', () => {
    const out = filterTransactions(base, {
      dateRange: { from: '2026-03-01', to: '2026-03-31' },
    })
    expect(out.map((t) => t.id).sort()).toEqual(['a', 'b'])
  })

  it('filters by category keys (case-insensitive)', () => {
    const out = filterTransactions(base, { categoryKeys: ['Food'] })
    expect(out.map((t) => t.id).sort()).toEqual(['a', 'd'])
  })

  it('filters by labelIds (any-of)', () => {
    const out = filterTransactions(base, { labelIds: ['l1'] })
    expect(out.map((t) => t.id)).toEqual(['d'])
  })

  it('filters by sign', () => {
    const income = filterTransactions(base, { sign: 'income' })
    const expense = filterTransactions(base, { sign: 'expense' })
    expect(income.map((t) => t.id)).toEqual(['c'])
    expect(expense.map((t) => t.id).sort()).toEqual(['a', 'b', 'd'])
  })

  it('filters by amount range using abs value', () => {
    const out = filterTransactions(base, {
      amountRange: { min: 30, max: 100 },
    })
    expect(out.map((t) => t.id).sort()).toEqual(['a', 'd'])
  })

  it('filters by text search across description/wording/counterparty', () => {
    const txs = [
      tx({ id: 'x', description: 'Starbucks Lisbon' }),
      tx({ id: 'y', description: 'Uber', counterparty: 'Uber Eats' }),
      tx({ id: 'z', description: 'Rent', wording: 'ACH WELLS FARGO' }),
    ]
    expect(
      filterTransactions(txs, { textSearch: 'lisbon' }).map((t) => t.id),
    ).toEqual(['x'])
    expect(
      filterTransactions(txs, { textSearch: 'eats' }).map((t) => t.id),
    ).toEqual(['y'])
    expect(
      filterTransactions(txs, { textSearch: 'wells' }).map((t) => t.id),
    ).toEqual(['z'])
  })
})

describe('queryTransactions', () => {
  const txs = [
    tx({ id: 'a', date: '2026-03-01', amount: -50, category: 'food' }),
    tx({ id: 'b', date: '2026-03-15', amount: -20, category: 'transport' }),
    tx({ id: 'c', date: '2026-04-02', amount: 3000, category: 'salary' }),
    tx({ id: 'd', date: '2026-04-05', amount: -80, category: 'food' }),
  ]

  it('groups by category with sum aggregate', () => {
    const res = queryTransactions(
      txs,
      {},
      { groupBy: 'category', aggregate: ['sum', 'count'] },
    )
    const byKey = Object.fromEntries(res.buckets.map((b) => [b.key, b]))
    expect(byKey.food.aggregates.sum).toBe(-130)
    expect(byKey.food.aggregates.count).toBe(2)
    expect(byKey.salary.aggregates.sum).toBe(3000)
    expect(res.totals.count).toBe(4)
  })

  it('groups by month (YYYY-MM)', () => {
    const res = queryTransactions(txs, {}, { groupBy: 'month' })
    const keys = res.buckets.map((b) => b.key).sort()
    expect(keys).toEqual(['2026-03', '2026-04'])
  })

  it('returns a single null-keyed bucket when groupBy=none', () => {
    const res = queryTransactions(txs, {}, { groupBy: 'none' })
    expect(res.buckets).toHaveLength(1)
    expect(res.buckets[0].key).toBeNull()
  })

  it('respects limit and flags truncated', () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      tx({
        id: `x${i}`,
        date: `2026-03-${(i + 1).toString().padStart(2, '0')}`,
      }),
    )
    const res = queryTransactions(many, {}, { groupBy: 'day', limit: 10 })
    expect(res.buckets).toHaveLength(10)
    expect(res.truncated).toBe(true)
  })

  it('returns samples in buckets when requested', () => {
    const res = queryTransactions(
      txs,
      {},
      { groupBy: 'category', returnSamples: true, samplesPerBucket: 1 },
    )
    for (const b of res.buckets) {
      expect(b.samples?.length).toBeGreaterThan(0)
    }
  })

  it('expands per-label buckets when groupBy=label', () => {
    const labeled = [
      tx({ id: 'a', labelIds: ['l1'] }),
      tx({ id: 'b', labelIds: ['l1', 'l2'] }),
      tx({ id: 'c', labelIds: [] }),
    ]
    const res = queryTransactions(labeled, {}, { groupBy: 'label' })
    const byKey = Object.fromEntries(
      res.buckets.map((b) => [b.key, b.aggregates.count]),
    )
    expect(byKey.l1).toBe(2)
    expect(byKey.l2).toBe(1)
    expect(byKey['(none)']).toBe(1)
  })
})
