import { describe, expect, it } from 'vitest'
import { applyFilters } from '../engine'
import { createTransactionFilterConfig } from '../transactions'
import type { FilterCondition } from '../types'

const deps = {
  accountOptions: [
    { value: 'acc1', label: 'Bank A' },
    { value: 'acc2', label: 'Bank B' },
  ],
  categoryOptions: [
    { value: 'food_and_restaurants', label: 'Food & Restaurants' },
    { value: 'housing', label: 'Housing' },
  ],
  labelOptions: [],
  transactionTypeOptions: [
    { value: 'card', label: 'Card' },
    { value: 'transfer', label: 'Transfer' },
  ],
}

const config = createTransactionFilterConfig(deps)

const sampleTransactions = [
  {
    _id: 't1',
    bankAccountId: 'acc1',
    date: '2025-03-01',
    value: -25,
    wording: 'Lunch at café',
    type: 'card',
    coming: false,
    counterparty: 'Café du coin',
    category: 'food',
    categoryParent: 'food_and_restaurants',
  },
  {
    _id: 't2',
    bankAccountId: 'acc2',
    date: '2025-03-05',
    value: 3000,
    wording: 'Salary March',
    type: 'transfer',
    coming: false,
    counterparty: 'Employer Inc',
    category: 'revenue',
    categoryParent: undefined,
    userCategoryKey: 'revenue',
  },
  {
    _id: 't3',
    bankAccountId: 'acc1',
    date: '2025-03-10',
    value: -800,
    wording: 'Rent payment',
    type: 'transfer',
    coming: true,
    counterparty: 'Landlord',
    category: 'housing',
    categoryParent: 'housing',
    userCategoryKey: 'housing',
  },
]

function cond(
  field: string,
  operator: string,
  value: unknown,
): FilterCondition {
  return {
    id: '1',
    field,
    operator: operator as FilterCondition['operator'],
    value,
  }
}

describe('createTransactionFilterConfig', () => {
  it('produces correct number of fields', () => {
    expect(config.fields).toHaveLength(11)
  })

  it('has all fields in fieldMap', () => {
    for (const f of config.fields) {
      expect(config.fieldMap.get(f.name)).toBe(f)
    }
  })
})

describe('virtual field accessors', () => {
  it('flow: derives income/expense from value', () => {
    const flowField = config.fieldMap.get('flow')
    expect(flowField).toBeDefined()
    expect(
      flowField?.accessor(
        sampleTransactions[0] as unknown as Record<string, unknown>,
      ),
    ).toBe('expense')
    expect(
      flowField?.accessor(
        sampleTransactions[1] as unknown as Record<string, unknown>,
      ),
    ).toBe('income')
  })

  it('status: derives pending/completed from coming', () => {
    const statusField = config.fieldMap.get('status')
    expect(statusField).toBeDefined()
    expect(
      statusField?.accessor(
        sampleTransactions[0] as unknown as Record<string, unknown>,
      ),
    ).toBe('completed')
    expect(
      statusField?.accessor(
        sampleTransactions[2] as unknown as Record<string, unknown>,
      ),
    ).toBe('pending')
  })
})

describe('integration: filtering transactions', () => {
  it('filters by account', () => {
    const result = applyFilters(
      sampleTransactions,
      [cond('account', 'is_any_of', ['acc1'])],
      config,
    )
    expect(result).toHaveLength(2)
  })

  it('filters by flow', () => {
    const result = applyFilters(
      sampleTransactions,
      [cond('flow', 'is_any_of', ['income'])],
      config,
    )
    expect(result).toHaveLength(1)
    expect((result[0] as Record<string, unknown>).wording).toBe('Salary March')
  })

  it('filters by amount range', () => {
    const result = applyFilters(
      sampleTransactions,
      [cond('amount', 'between', { from: -100, to: 0 })],
      config,
    )
    expect(result).toHaveLength(1)
  })

  it('combines multiple filters (AND)', () => {
    const result = applyFilters(
      sampleTransactions,
      [
        cond('account', 'is_any_of', ['acc1']),
        cond('status', 'is_any_of', ['pending']),
      ],
      config,
    )
    expect(result).toHaveLength(1)
    expect((result[0] as Record<string, unknown>).wording).toBe('Rent payment')
  })
})
