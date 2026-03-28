import { describe, expect, it } from 'vitest'
import type { Filter } from '~/components/reui/filters'
import { deserializeFilters, serializeFilters } from '../serialize'

const sampleFilters: Array<Filter> = [
  { id: 'f1', field: 'category', operator: 'is_any_of', values: ['food'] },
  { id: 'f2', field: 'amount', operator: 'gt', values: [100] },
]

describe('serializeFilters / deserializeFilters', () => {
  it('round-trips correctly', () => {
    const json = serializeFilters(sampleFilters)
    const result = deserializeFilters(json)
    expect(result).toEqual(sampleFilters)
  })

  it('returns [] for invalid JSON', () => {
    expect(deserializeFilters('not-json')).toEqual([])
  })

  it('returns [] for non-array JSON', () => {
    expect(deserializeFilters('{"a":1}')).toEqual([])
  })

  it('filters out invalid items', () => {
    const json = JSON.stringify([
      sampleFilters[0],
      { invalid: true },
      sampleFilters[1],
    ])
    const result = deserializeFilters(json)
    expect(result).toHaveLength(2)
  })
})
