import type { SerializableField } from './prompt'
import type { AIFilterResponse } from './schema'

export interface ParsedFilter {
  id: string
  field: string
  operator: string
  values: unknown[]
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
}

export function fuzzyMatchEnumValue(
  query: string,
  options: Array<{ value: string; label: string }>,
): string | null {
  const exact = options.find((o) => o.value === query)
  if (exact) return exact.value

  const lowerQuery = query.toLowerCase()
  const ciValue = options.find((o) => o.value.toLowerCase() === lowerQuery)
  if (ciValue) return ciValue.value

  const ciLabel = options.find((o) => o.label.toLowerCase() === lowerQuery)
  if (ciLabel) return ciLabel.value

  return null
}

export function parseAIFilterResponse(
  raw: AIFilterResponse | null | undefined,
  fields: Array<SerializableField>,
): Array<ParsedFilter> {
  if (raw == null || !Array.isArray(raw.filters)) return []

  const fieldMap = new Map(fields.map((f) => [f.name, f]))
  const filters: Array<ParsedFilter> = []

  for (const item of raw.filters) {
    if (typeof item.field !== 'string') continue

    const field = fieldMap.get(item.field)
    if (!field) continue

    const operator = item.operator as string
    if (!field.operators.includes(operator)) continue

    // Valueless operators
    if (operator === 'empty' || operator === 'not_empty') {
      filters.push({
        id: generateId(),
        field: item.field,
        operator,
        values: [],
      })
      continue
    }

    // Array operators
    if (operator === 'is_any_of' || operator === 'is_not_any_of') {
      const rawValues = Array.isArray(item.value) ? item.value : [item.value]
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
      filters.push({
        id: generateId(),
        field: item.field,
        operator,
        values: resolved,
      })
      continue
    }

    // Between operator → values = [from, to]
    if (operator === 'between') {
      const val = item.value as Record<string, unknown> | null
      if (
        !val ||
        typeof val !== 'object' ||
        !('from' in val) ||
        !('to' in val)
      ) {
        continue
      }
      filters.push({
        id: generateId(),
        field: item.field,
        operator,
        values: [val.from, val.to],
      })
      continue
    }

    // Scalar operators → values = [value]
    filters.push({
      id: generateId(),
      field: item.field,
      operator,
      values: [item.value],
    })
  }

  return filters
}
