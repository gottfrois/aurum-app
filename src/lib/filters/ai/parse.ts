import type { FilterCondition, FilterOperator } from '../types'
import type { AIFilterResponse } from './schema'
import type { SerializableField } from './prompt'

export function fuzzyMatchEnumValue(
  query: string,
  options: Array<{ value: string; label: string }>,
): string | null {
  // Exact value match
  const exact = options.find((o) => o.value === query)
  if (exact) return exact.value

  // Case-insensitive value match
  const lowerQuery = query.toLowerCase()
  const ciValue = options.find((o) => o.value.toLowerCase() === lowerQuery)
  if (ciValue) return ciValue.value

  // Case-insensitive label match
  const ciLabel = options.find((o) => o.label.toLowerCase() === lowerQuery)
  if (ciLabel) return ciLabel.value

  return null
}

export function parseAIFilterResponse(
  raw: AIFilterResponse | null | undefined,
  fields: Array<SerializableField>,
): Array<FilterCondition> {
  if (raw == null || !Array.isArray(raw.filters)) return []

  const fieldMap = new Map(fields.map((f) => [f.name, f]))
  const conditions: Array<FilterCondition> = []

  for (const filter of raw.filters) {
    if (typeof filter.field !== 'string') continue

    const field = fieldMap.get(filter.field)
    if (!field) continue

    const operator = filter.operator as FilterOperator
    if (!field.operators.includes(operator as never)) continue

    // Valueless operators
    if (operator === 'is_empty' || operator === 'is_not_empty') {
      conditions.push({
        id: crypto.randomUUID(),
        field: filter.field,
        operator,
        value: null,
      })
      continue
    }

    // Array operators
    if (operator === 'is_any_of' || operator === 'is_none_of') {
      const rawValues = Array.isArray(filter.value)
        ? filter.value
        : [filter.value]
      const resolved: Array<string> = []

      for (const v of rawValues) {
        if (typeof v !== 'string') continue
        if (field.enumOptions) {
          const matched = fuzzyMatchEnumValue(v, field.enumOptions)
          if (matched) resolved.push(matched)
        } else {
          resolved.push(v)
        }
      }

      if (resolved.length === 0) continue

      conditions.push({
        id: crypto.randomUUID(),
        field: filter.field,
        operator,
        value: resolved,
      })
      continue
    }

    // Between operator
    if (operator === 'between') {
      const val = filter.value as Record<string, unknown> | null
      if (
        !val ||
        typeof val !== 'object' ||
        !('from' in val) ||
        !('to' in val)
      ) {
        continue
      }
      conditions.push({
        id: crypto.randomUUID(),
        field: filter.field,
        operator,
        value: { from: val.from, to: val.to },
      })
      continue
    }

    // Scalar operators
    conditions.push({
      id: crypto.randomUUID(),
      field: filter.field,
      operator,
      value: filter.value,
    })
  }

  return conditions
}
