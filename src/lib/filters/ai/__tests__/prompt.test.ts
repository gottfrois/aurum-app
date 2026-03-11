import { describe, expect, it } from 'vitest'
import { buildSystemPrompt, serializeFilterConfig } from '../prompt'
import type { FilterConfig, FilterFieldDescriptor } from '../../types'

describe('serializeFilterConfig', () => {
  it('strips accessor and icon, keeps core fields', () => {
    const config: FilterConfig = {
      fields: [
        {
          name: 'amount',
          label: 'Amount',
          valueType: 'number',
          operators: ['gt', 'lt'],
          defaultOperator: 'gt',
          accessor: (r) => r.value,
          icon: (() => null) as unknown as FilterFieldDescriptor['icon'],
        },
      ],
      fieldMap: new Map(),
    }

    const result = serializeFilterConfig(config)
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

  it('resolves function enumOptions', () => {
    const config: FilterConfig = {
      fields: [
        {
          name: 'status',
          label: 'Status',
          valueType: 'enum',
          operators: ['is_any_of'],
          defaultOperator: 'is_any_of',
          enumOptions: () => [
            { value: 'active', label: 'Active', color: '#00ff00' },
            { value: 'inactive', label: 'Inactive' },
          ],
          accessor: (r) => r.status,
        },
      ],
      fieldMap: new Map(),
    }

    const result = serializeFilterConfig(config)
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
      operators: ['gt' as const, 'lt' as const],
    },
    {
      name: 'category',
      label: 'Category',
      valueType: 'enum' as const,
      operators: ['is_any_of' as const],
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
