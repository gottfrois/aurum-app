import { describe, expect, it } from 'vitest'
import {
  computeCashFlowData,
  computeCategoryBreakdown,
  computeSankeyData,
} from '../cash-flow'
import type { TransactionRecord } from '../financial-summary'

function makeTxn(
  overrides: Partial<TransactionRecord> = {},
): TransactionRecord {
  return {
    _id: `txn_${Math.random().toString(36).slice(2, 8)}`,
    bankAccountId: 'acct_1',
    portfolioId: 'port_1',
    date: '2025-03-15',
    value: -50,
    wording: 'Test',
    coming: false,
    ...overrides,
  }
}

const mockGetCategory = (key: string) => ({
  key,
  label: key.charAt(0).toUpperCase() + key.slice(1),
  color: '#888',
  builtIn: true,
})

describe('computeCashFlowData', () => {
  it('returns empty for undefined', () => {
    expect(computeCashFlowData(undefined)).toEqual([])
  })

  it('groups by month and separates income/expenses', () => {
    const txns = [
      makeTxn({ date: '2025-01-10', value: 3000 }),
      makeTxn({ date: '2025-01-15', value: -1200 }),
      makeTxn({ date: '2025-01-20', value: -800 }),
      makeTxn({ date: '2025-02-10', value: 3000 }),
      makeTxn({ date: '2025-02-15', value: -1500 }),
    ]
    const result = computeCashFlowData(txns)
    expect(result).toHaveLength(2)
    expect(result[0].income).toBe(3000)
    expect(result[0].expenses).toBe(2000)
    expect(result[1].income).toBe(3000)
    expect(result[1].expenses).toBe(1500)
  })

  it('sorts months chronologically', () => {
    const txns = [
      makeTxn({ date: '2025-03-10', value: -50 }),
      makeTxn({ date: '2025-01-10', value: -50 }),
    ]
    const result = computeCashFlowData(txns)
    // First entry should be January
    expect(result[0].expenses).toBe(50)
  })

  it('excludes budget-excluded transactions', () => {
    const txns = [
      makeTxn({ date: '2025-01-10', value: -500, excludedFromBudget: true }),
      makeTxn({ date: '2025-01-15', value: -200 }),
    ]
    const result = computeCashFlowData(txns)
    expect(result[0].expenses).toBe(200)
  })
})

describe('computeCategoryBreakdown', () => {
  it('returns empty for undefined', () => {
    const result = computeCategoryBreakdown(
      undefined,
      mockGetCategory,
      'expense',
    )
    expect(result.categoryData).toEqual([])
    expect(result.total).toBe(0)
  })

  it('aggregates expenses by category', () => {
    const txns = [
      makeTxn({ value: -100, userCategoryKey: 'groceries' }),
      makeTxn({ value: -50, userCategoryKey: 'groceries' }),
      makeTxn({ value: -200, userCategoryKey: 'transport' }),
    ]
    const result = computeCategoryBreakdown(txns, mockGetCategory, 'expense')
    expect(result.total).toBe(350)
    expect(result.categoryData).toHaveLength(2)
    expect(result.categoryData[0].key).toBe('transport') // sorted by value desc
    expect(result.categoryData[0].value).toBe(200)
    expect(result.categoryData[1].key).toBe('groceries')
    expect(result.categoryData[1].value).toBe(150)
  })

  it('filters to income only when direction is income', () => {
    const txns = [
      makeTxn({ value: 3000, userCategoryKey: 'salary' }),
      makeTxn({ value: -500, userCategoryKey: 'groceries' }),
    ]
    const result = computeCategoryBreakdown(txns, mockGetCategory, 'income')
    expect(result.categoryData).toHaveLength(1)
    expect(result.categoryData[0].key).toBe('salary')
    expect(result.total).toBe(3000)
  })

  it('includes all when direction is all', () => {
    const txns = [
      makeTxn({ value: 3000, userCategoryKey: 'salary' }),
      makeTxn({ value: -500, userCategoryKey: 'groceries' }),
    ]
    const result = computeCategoryBreakdown(txns, mockGetCategory, 'all')
    expect(result.categoryData).toHaveLength(2)
    expect(result.total).toBe(3500)
  })
})

describe('computeSankeyData', () => {
  it('returns empty for undefined', () => {
    const result = computeSankeyData(undefined, mockGetCategory)
    expect(result.nodes).toEqual([])
    expect(result.links).toEqual([])
  })

  it('returns empty when no income', () => {
    const txns = [makeTxn({ value: -500 })]
    const result = computeSankeyData(txns, mockGetCategory)
    expect(result.nodes).toEqual([])
  })

  it('builds nodes and links for income + expenses', () => {
    const txns = [
      makeTxn({ value: 3000 }),
      makeTxn({ value: -1000, userCategoryKey: 'groceries' }),
      makeTxn({ value: -500, userCategoryKey: 'transport' }),
    ]
    const result = computeSankeyData(txns, mockGetCategory)
    // Nodes: Income, Intermediate, Groceries, Transport, Savings
    expect(result.nodes.length).toBeGreaterThanOrEqual(4)
    expect(result.nodes[0].name).toBe('Income')
    // Links: Income→Intermediate, Intermediate→Groceries, Intermediate→Transport, Intermediate→Savings
    expect(result.links.length).toBeGreaterThanOrEqual(3)
  })

  it('includes savings node when income exceeds expenses', () => {
    const txns = [
      makeTxn({ value: 3000 }),
      makeTxn({ value: -1000, userCategoryKey: 'groceries' }),
    ]
    const result = computeSankeyData(txns, mockGetCategory)
    const savingsNode = result.nodes.find((n) => n.name === 'Savings')
    expect(savingsNode).toBeDefined()
  })

  it('omits savings node when expenses equal income', () => {
    const txns = [
      makeTxn({ value: 1000 }),
      makeTxn({ value: -1000, userCategoryKey: 'groceries' }),
    ]
    const result = computeSankeyData(txns, mockGetCategory)
    const savingsNode = result.nodes.find((n) => n.name === 'Savings')
    expect(savingsNode).toBeUndefined()
  })
})
