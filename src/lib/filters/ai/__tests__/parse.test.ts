import { describe, expect, it } from 'vitest'
import { fuzzyMatchEnumValue, parseAIFilterResponse } from '../parse'
import type { SerializableField } from '../prompt'

const numberField: SerializableField = {
  name: 'amount',
  label: 'Amount',
  valueType: 'number',
  operators: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'between'],
}

const enumField: SerializableField = {
  name: 'category',
  label: 'Category',
  valueType: 'enum',
  operators: ['is_any_of', 'is_not_any_of', 'empty', 'not_empty'],
  enumOptions: [
    { value: 'food', label: 'Food & Dining' },
    { value: 'transport', label: 'Transport' },
    { value: 'housing', label: 'Housing' },
  ],
}

const stringField: SerializableField = {
  name: 'wording',
  label: 'Description',
  valueType: 'string',
  operators: ['contains', 'not_contains', 'is', 'is_not', 'empty', 'not_empty'],
}

const dateField: SerializableField = {
  name: 'date',
  label: 'Date',
  valueType: 'date',
  operators: ['is', 'after', 'before', 'between'],
}

const fields = [numberField, enumField, stringField, dateField]

describe('parseAIFilterResponse', () => {
  it('valid number filter returns 1 filter with values[]', () => {
    const result = parseAIFilterResponse(
      { filters: [{ field: 'amount', operator: 'gt', value: 50 }] },
      fields,
    )
    expect(result).toHaveLength(1)
    expect(result[0].field).toBe('amount')
    expect(result[0].operator).toBe('gt')
    expect(result[0].values).toEqual([50])
    expect(result[0].id).toBeDefined()
  })

  it('unknown field is dropped', () => {
    const result = parseAIFilterResponse(
      { filters: [{ field: 'unknown', operator: 'gt', value: 50 }] },
      fields,
    )
    expect(result).toHaveLength(0)
  })

  it('invalid operator for field type is dropped', () => {
    const result = parseAIFilterResponse(
      { filters: [{ field: 'amount', operator: 'contains', value: 'abc' }] },
      fields,
    )
    expect(result).toHaveLength(0)
  })

  it('enum is_any_of with valid values', () => {
    const result = parseAIFilterResponse(
      {
        filters: [
          {
            field: 'category',
            operator: 'is_any_of',
            value: ['food', 'transport'],
          },
        ],
      },
      fields,
    )
    expect(result).toHaveLength(1)
    expect(result[0].values).toEqual(['food', 'transport'])
  })

  it('enum fuzzy match by label', () => {
    const result = parseAIFilterResponse(
      {
        filters: [
          {
            field: 'category',
            operator: 'is_any_of',
            value: ['Food & Dining'],
          },
        ],
      },
      fields,
    )
    expect(result).toHaveLength(1)
    expect(result[0].values).toEqual(['food'])
  })

  it('enum with mixed valid/invalid keeps only valid', () => {
    const result = parseAIFilterResponse(
      {
        filters: [
          {
            field: 'category',
            operator: 'is_any_of',
            value: ['food', 'nonexistent', 'housing'],
          },
        ],
      },
      fields,
    )
    expect(result).toHaveLength(1)
    expect(result[0].values).toEqual(['food', 'housing'])
  })

  it('between with correct shape produces values [from, to]', () => {
    const result = parseAIFilterResponse(
      {
        filters: [
          {
            field: 'date',
            operator: 'between',
            value: { from: '2025-01-01', to: '2025-01-31' },
          },
        ],
      },
      fields,
    )
    expect(result).toHaveLength(1)
    expect(result[0].values).toEqual(['2025-01-01', '2025-01-31'])
  })

  it('between with wrong shape is dropped', () => {
    const result = parseAIFilterResponse(
      {
        filters: [{ field: 'date', operator: 'between', value: '2025-01-01' }],
      },
      fields,
    )
    expect(result).toHaveLength(0)
  })

  it('valueless operator produces empty values', () => {
    const result = parseAIFilterResponse(
      {
        filters: [{ field: 'wording', operator: 'empty', value: undefined }],
      },
      fields,
    )
    expect(result).toHaveLength(1)
    expect(result[0].values).toEqual([])
  })

  it('mixed valid and invalid filters — only valid survive', () => {
    const result = parseAIFilterResponse(
      {
        filters: [
          { field: 'amount', operator: 'gt', value: 100 },
          { field: 'unknown', operator: 'gt', value: 50 },
          { field: 'wording', operator: 'contains', value: 'grocery' },
        ],
      },
      fields,
    )
    expect(result).toHaveLength(2)
    expect(result[0].field).toBe('amount')
    expect(result[1].field).toBe('wording')
  })

  it('null/undefined/empty input returns empty array', () => {
    expect(parseAIFilterResponse(null as never, fields)).toEqual([])
    expect(parseAIFilterResponse(undefined as never, fields)).toEqual([])
    expect(parseAIFilterResponse({ filters: [] }, fields)).toEqual([])
  })
})

describe('fuzzyMatchEnumValue', () => {
  const options = [
    { value: 'food', label: 'Food & Dining' },
    { value: 'transport', label: 'Transport' },
  ]

  it('exact value match', () => {
    expect(fuzzyMatchEnumValue('food', options)).toBe('food')
  })

  it('case-insensitive value match', () => {
    expect(fuzzyMatchEnumValue('FOOD', options)).toBe('food')
  })

  it('case-insensitive label match', () => {
    expect(fuzzyMatchEnumValue('food & dining', options)).toBe('food')
  })

  it('no match returns null', () => {
    expect(fuzzyMatchEnumValue('unknown', options)).toBeNull()
  })
})
