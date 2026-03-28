import { describe, expect, it } from 'vitest'
import type { Filter } from '~/components/reui/filters'
import { applyFilters } from '../engine'
import type { FieldDescriptor } from '../types'

const stringField: FieldDescriptor = {
  key: 'name',
  label: 'Name',
  type: 'text',
  valueType: 'string',
  accessor: (r) => r.name,
}

const numberField: FieldDescriptor = {
  key: 'amount',
  label: 'Amount',
  type: 'custom',
  valueType: 'number',
  accessor: (r) => r.amount,
}

const dateField: FieldDescriptor = {
  key: 'date',
  label: 'Date',
  type: 'custom',
  valueType: 'date',
  accessor: (r) => r.date,
}

const enumField: FieldDescriptor = {
  key: 'status',
  label: 'Status',
  type: 'multiselect',
  valueType: 'enum',
  accessor: (r) => r.status,
}

const fields = [stringField, numberField, dateField, enumField]

function filter(field: string, operator: string, values: unknown[]): Filter {
  return { id: '1', field, operator, values }
}

describe('engine — string operators', () => {
  const record = { name: 'Hello World', amount: 0, date: '', status: '' }

  it('is (case-insensitive)', () => {
    expect(
      applyFilters([record], [filter('name', 'is', ['hello world'])], fields),
    ).toHaveLength(1)
    expect(
      applyFilters([record], [filter('name', 'is', ['other'])], fields),
    ).toHaveLength(0)
  })

  it('is_not', () => {
    expect(
      applyFilters([record], [filter('name', 'is_not', ['other'])], fields),
    ).toHaveLength(1)
    expect(
      applyFilters(
        [record],
        [filter('name', 'is_not', ['hello world'])],
        fields,
      ),
    ).toHaveLength(0)
  })

  it('contains', () => {
    expect(
      applyFilters([record], [filter('name', 'contains', ['World'])], fields),
    ).toHaveLength(1)
    expect(
      applyFilters([record], [filter('name', 'contains', ['xyz'])], fields),
    ).toHaveLength(0)
  })

  it('not_contains', () => {
    expect(
      applyFilters([record], [filter('name', 'not_contains', ['xyz'])], fields),
    ).toHaveLength(1)
    expect(
      applyFilters(
        [record],
        [filter('name', 'not_contains', ['hello'])],
        fields,
      ),
    ).toHaveLength(0)
  })

  it('empty / not_empty', () => {
    expect(
      applyFilters([record], [filter('name', 'empty', [])], fields),
    ).toHaveLength(0)
    expect(
      applyFilters([record], [filter('name', 'not_empty', [])], fields),
    ).toHaveLength(1)
    const emptyRecord = { ...record, name: '' }
    expect(
      applyFilters([emptyRecord], [filter('name', 'empty', [])], fields),
    ).toHaveLength(1)
  })
})

describe('engine — number operators', () => {
  const record = { name: '', amount: 50, date: '', status: '' }

  it('eq / neq', () => {
    expect(
      applyFilters([record], [filter('amount', 'eq', [50])], fields),
    ).toHaveLength(1)
    expect(
      applyFilters([record], [filter('amount', 'eq', [51])], fields),
    ).toHaveLength(0)
    expect(
      applyFilters([record], [filter('amount', 'neq', [51])], fields),
    ).toHaveLength(1)
  })

  it('gt / lt / gte / lte', () => {
    expect(
      applyFilters([record], [filter('amount', 'gt', [49])], fields),
    ).toHaveLength(1)
    expect(
      applyFilters([record], [filter('amount', 'gt', [50])], fields),
    ).toHaveLength(0)
    expect(
      applyFilters([record], [filter('amount', 'gte', [50])], fields),
    ).toHaveLength(1)
    expect(
      applyFilters([record], [filter('amount', 'lt', [51])], fields),
    ).toHaveLength(1)
    expect(
      applyFilters([record], [filter('amount', 'lte', [50])], fields),
    ).toHaveLength(1)
  })

  it('between', () => {
    expect(
      applyFilters([record], [filter('amount', 'between', [40, 60])], fields),
    ).toHaveLength(1)
    expect(
      applyFilters([record], [filter('amount', 'between', [51, 60])], fields),
    ).toHaveLength(0)
  })
})

describe('engine — date operators', () => {
  const record = { name: '', amount: 0, date: '2025-03-15', status: '' }

  it('is / is_not', () => {
    expect(
      applyFilters([record], [filter('date', 'is', ['2025-03-15'])], fields),
    ).toHaveLength(1)
    expect(
      applyFilters(
        [record],
        [filter('date', 'is_not', ['2025-03-15'])],
        fields,
      ),
    ).toHaveLength(0)
  })

  it('after / before', () => {
    expect(
      applyFilters([record], [filter('date', 'after', ['2025-03-14'])], fields),
    ).toHaveLength(1)
    expect(
      applyFilters(
        [record],
        [filter('date', 'before', ['2025-03-16'])],
        fields,
      ),
    ).toHaveLength(1)
  })

  it('between', () => {
    expect(
      applyFilters(
        [record],
        [filter('date', 'between', ['2025-03-01', '2025-03-31'])],
        fields,
      ),
    ).toHaveLength(1)
    expect(
      applyFilters(
        [record],
        [filter('date', 'between', ['2025-04-01', '2025-04-30'])],
        fields,
      ),
    ).toHaveLength(0)
  })
})

describe('engine — enum operators', () => {
  const record = { name: '', amount: 0, date: '', status: 'active' }

  it('is_any_of / is_not_any_of', () => {
    expect(
      applyFilters(
        [record],
        [filter('status', 'is_any_of', ['active'])],
        fields,
      ),
    ).toHaveLength(1)
    expect(
      applyFilters(
        [record],
        [filter('status', 'is_any_of', ['inactive'])],
        fields,
      ),
    ).toHaveLength(0)
    expect(
      applyFilters(
        [record],
        [filter('status', 'is_not_any_of', ['inactive'])],
        fields,
      ),
    ).toHaveLength(1)
    expect(
      applyFilters(
        [record],
        [filter('status', 'is_not_any_of', ['active'])],
        fields,
      ),
    ).toHaveLength(0)
  })

  it('empty / not_empty', () => {
    expect(
      applyFilters([record], [filter('status', 'not_empty', [])], fields),
    ).toHaveLength(1)
    const emptyRecord = { ...record, status: '' }
    expect(
      applyFilters([emptyRecord], [filter('status', 'empty', [])], fields),
    ).toHaveLength(1)
  })
})

describe('engine — unknown field', () => {
  it('passes through', () => {
    const record = { name: 'test', amount: 0, date: '', status: '' }
    expect(
      applyFilters([record], [filter('unknown', 'is', ['test'])], fields),
    ).toHaveLength(1)
  })
})

describe('applyFilters', () => {
  const data = [
    { name: 'Alice', amount: 100, date: '2025-01-01', status: 'active' },
    { name: 'Bob', amount: 50, date: '2025-02-01', status: 'inactive' },
    { name: 'Carol', amount: 200, date: '2025-03-01', status: 'active' },
  ]

  it('returns all with no filters', () => {
    expect(applyFilters(data, [], fields)).toBe(data)
  })

  it('filters with single condition', () => {
    const result = applyFilters(
      data,
      [filter('status', 'is_any_of', ['active'])],
      fields,
    )
    expect(result).toHaveLength(2)
  })

  it('AND logic with multiple conditions', () => {
    const result = applyFilters(
      data,
      [
        filter('status', 'is_any_of', ['active']),
        filter('amount', 'gt', [150]),
      ],
      fields,
    )
    expect(result).toHaveLength(1)
    expect((result[0] as Record<string, unknown>).name).toBe('Carol')
  })
})
