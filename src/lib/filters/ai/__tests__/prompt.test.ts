import { describe, expect, it } from 'vitest'
import type { FieldDescriptor } from '../../types'
import { toSerializableFields } from '../../types'
import { buildSystemPrompt } from '../prompt'

describe('toSerializableFields', () => {
  it('strips accessor and icon, keeps core fields', () => {
    const fields: Array<FieldDescriptor> = [
      {
        key: 'amount',
        label: 'Amount',
        type: 'custom',
        valueType: 'number',
        operators: [
          { value: 'gt', label: 'greater than' },
          { value: 'lt', label: 'less than' },
        ],
        defaultOperator: 'gt',
        accessor: (r) => r.value,
      },
    ]

    const result = toSerializableFields(fields)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      name: 'amount',
      label: 'Amount',
      valueType: 'number',
      operators: ['gt', 'lt'],
    })
    expect(result[0]).not.toHaveProperty('accessor')
    expect(result[0]).not.toHaveProperty('icon')
    expect(result[0]).not.toHaveProperty('defaultOperator')
  })

  it('extracts enum options from multiselect fields', () => {
    const fields: Array<FieldDescriptor> = [
      {
        key: 'status',
        label: 'Status',
        type: 'multiselect',
        valueType: 'enum',
        operators: [{ value: 'is_any_of', label: 'is any of' }],
        defaultOperator: 'is_any_of',
        options: [
          { value: 'active', label: 'Active' },
          { value: 'inactive', label: 'Inactive' },
        ],
        accessor: (r) => r.status,
      },
    ]

    const result = toSerializableFields(fields)
    expect(result[0].enumOptions).toEqual([
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
    ])
  })
})

describe('buildSystemPrompt', () => {
  const fields = [
    {
      name: 'amount',
      label: 'Amount',
      valueType: 'number' as const,
      operators: ['gt', 'lt'],
    },
    {
      name: 'category',
      label: 'Category',
      valueType: 'enum' as const,
      operators: ['is_any_of'],
      enumOptions: [
        { value: 'food', label: 'Food & Dining' },
        { value: 'transport', label: 'Transport' },
      ],
    },
  ]

  it('includes field names and types', () => {
    const prompt = buildSystemPrompt(fields, '2025-03-11')
    expect(prompt).toContain('amount')
    expect(prompt).toContain('number')
    expect(prompt).toContain('category')
    expect(prompt).toContain('enum')
  })

  it('includes operators', () => {
    const prompt = buildSystemPrompt(fields, '2025-03-11')
    expect(prompt).toContain('gt, lt')
    expect(prompt).toContain('is_any_of')
  })

  it('includes enum values with labels', () => {
    const prompt = buildSystemPrompt(fields, '2025-03-11')
    expect(prompt).toContain('"food" (Food & Dining)')
    expect(prompt).toContain('"transport" (Transport)')
  })

  it('includes today date', () => {
    const prompt = buildSystemPrompt(fields, '2025-03-11')
    expect(prompt).toContain('2025-03-11')
  })
})
