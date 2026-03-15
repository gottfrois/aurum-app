import { describe, expect, it } from 'vitest'
import {
  OPERATOR_LABELS,
  OPERATORS_BY_TYPE,
  RANGE_OPERATORS,
  VALUELESS_OPERATORS,
} from '../operators'

describe('OPERATORS_BY_TYPE', () => {
  it('covers all value types', () => {
    expect(OPERATORS_BY_TYPE.string.length).toBeGreaterThan(0)
    expect(OPERATORS_BY_TYPE.number.length).toBeGreaterThan(0)
    expect(OPERATORS_BY_TYPE.date.length).toBeGreaterThan(0)
    expect(OPERATORS_BY_TYPE.enum.length).toBeGreaterThan(0)
    expect(OPERATORS_BY_TYPE.boolean.length).toBeGreaterThan(0)
  })
})

describe('OPERATOR_LABELS', () => {
  it('has a label for every operator across all types', () => {
    for (const operators of Object.values(OPERATORS_BY_TYPE)) {
      for (const op of operators) {
        expect(OPERATOR_LABELS[op]).toBeDefined()
        expect(typeof OPERATOR_LABELS[op]).toBe('string')
      }
    }
  })
})

describe('VALUELESS_OPERATORS', () => {
  it('contains is_empty and is_not_empty', () => {
    expect(VALUELESS_OPERATORS.has('is_empty')).toBe(true)
    expect(VALUELESS_OPERATORS.has('is_not_empty')).toBe(true)
  })

  it('does not contain value operators', () => {
    expect(VALUELESS_OPERATORS.has('is')).toBe(false)
    expect(VALUELESS_OPERATORS.has('eq')).toBe(false)
  })
})

describe('RANGE_OPERATORS', () => {
  it('contains between', () => {
    expect(RANGE_OPERATORS.has('between')).toBe(true)
  })

  it('does not contain non-range operators', () => {
    expect(RANGE_OPERATORS.has('is')).toBe(false)
    expect(RANGE_OPERATORS.has('gt')).toBe(false)
  })
})
