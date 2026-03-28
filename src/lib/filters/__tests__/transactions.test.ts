import { describe, expect, it } from 'vitest'
import type { Filter } from '~/components/reui/filters'
import { applyFilters } from '../engine'
import { createTransactionFilterFields } from '../transactions'

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

const fields = createTransactionFilterFields(deps)

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

function filter(field: string, operator: string, values: unknown[]): Filter {
  return { id: '1', field, operator, values }
}

describe('createTransactionFilterFields', () => {
  it('produces correct number of fields', () => {
    expect(fields).toHaveLength(11)
  })

  it('all fields have key and accessor', () => {
    for (const f of fields) {
      expect(f.key).toBeDefined()
      expect(f.accessor).toBeTypeOf('function')
    }
  })
})

describe('virtual field accessors', () => {
  it('flow: derives income/expense from value', () => {
    const flowField = fields.find((f) => f.key === 'flow')
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
    const statusField = fields.find((f) => f.key === 'status')
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
      [filter('account', 'is_any_of', ['acc1'])],
      fields,
    )
    expect(result).toHaveLength(2)
  })

  it('filters by flow', () => {
    const result = applyFilters(
      sampleTransactions,
      [filter('flow', 'is_any_of', ['income'])],
      fields,
    )
    expect(result).toHaveLength(1)
    expect((result[0] as Record<string, unknown>).wording).toBe('Salary March')
  })

  it('filters by amount range', () => {
    const result = applyFilters(
      sampleTransactions,
      [filter('amount', 'between', [-100, 0])],
      fields,
    )
    expect(result).toHaveLength(1)
  })

  it('combines multiple filters (AND)', () => {
    const result = applyFilters(
      sampleTransactions,
      [
        filter('account', 'is_any_of', ['acc1']),
        filter('status', 'is_any_of', ['pending']),
      ],
      fields,
    )
    expect(result).toHaveLength(1)
    expect((result[0] as Record<string, unknown>).wording).toBe('Rent payment')
  })
})
