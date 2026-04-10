import { describe, expect, it } from 'vitest'
import type { TransactionRecord } from '../financial-summary'
import { computeFinancialSummary } from '../financial-summary'

function makeTxn(
  overrides: Partial<TransactionRecord> = {},
): TransactionRecord {
  return {
    _id: `txn_${Math.random().toString(36).slice(2, 8)}`,
    bankAccountId: 'acct_1',
    portfolioId: 'port_1',
    date: '2025-03-15',
    value: -50,
    wording: 'Test Transaction',
    coming: false,
    ...overrides,
  }
}

describe('computeFinancialSummary', () => {
  it('returns zeros for undefined input', () => {
    const result = computeFinancialSummary(undefined)
    expect(result.totalIncome).toBe(0)
    expect(result.totalExpenses).toBe(0)
    expect(result.delta).toBe(0)
    expect(result.savingsRate).toBe(0)
    expect(result.recurringTotal).toBe(0)
  })

  it('returns zeros for empty array', () => {
    const result = computeFinancialSummary([])
    expect(result.totalIncome).toBe(0)
  })

  it('separates income and expenses', () => {
    const txns = [
      makeTxn({ value: 3000 }),
      makeTxn({ value: -1200 }),
      makeTxn({ value: -800 }),
    ]
    const result = computeFinancialSummary(txns)
    expect(result.totalIncome).toBe(3000)
    expect(result.totalExpenses).toBe(2000)
    expect(result.delta).toBe(1000)
  })

  it('calculates savings rate', () => {
    const txns = [makeTxn({ value: 1000 }), makeTxn({ value: -600 })]
    const result = computeFinancialSummary(txns)
    expect(result.savingsRate).toBe(40) // (1000-600)/1000 * 100
  })

  it('returns zero savings rate when no income', () => {
    const txns = [makeTxn({ value: -500 })]
    const result = computeFinancialSummary(txns)
    expect(result.savingsRate).toBe(0)
  })

  it('excludes budget-excluded transactions', () => {
    const txns = [
      makeTxn({ value: -500, excludedFromBudget: true }),
      makeTxn({ value: -200 }),
    ]
    const result = computeFinancialSummary(txns)
    expect(result.totalExpenses).toBe(200)
  })

  it('detects recurring expenses (counterparty in 2+ months)', () => {
    const txns = [
      makeTxn({ date: '2025-01-15', value: -30, counterparty: 'Netflix' }),
      makeTxn({ date: '2025-02-15', value: -30, counterparty: 'Netflix' }),
      makeTxn({ date: '2025-03-15', value: -30, counterparty: 'Netflix' }),
      makeTxn({ date: '2025-01-10', value: -500, counterparty: 'One-time' }),
    ]
    const result = computeFinancialSummary(txns)
    expect(result.recurringTotal).toBe(30) // 90/3 months
  })

  it('does not count single-month payee as recurring', () => {
    const txns = [
      makeTxn({
        date: '2025-01-15',
        value: -500,
        counterparty: 'Big Purchase',
      }),
    ]
    const result = computeFinancialSummary(txns)
    expect(result.recurringTotal).toBe(0)
  })
})
