import type { Filter } from '~/components/reui/filters'
import type { FieldDescriptor } from './types'

function evaluateFilter(
  record: Record<string, unknown>,
  filter: Filter,
  fields: Array<FieldDescriptor>,
): boolean {
  const field = fields.find((f) => f.key === filter.field)
  if (!field) return true

  const rawValue = field.accessor(record)
  const { operator, values } = filter

  // Valueless operators
  if (operator === 'empty') {
    if (Array.isArray(rawValue)) return rawValue.length === 0
    return rawValue == null || rawValue === ''
  }
  if (operator === 'not_empty') {
    if (Array.isArray(rawValue)) return rawValue.length > 0
    return rawValue != null && rawValue !== ''
  }

  // No values configured yet — don't filter
  if (values.length === 0) return true

  // Multi-value operators (enum/multiselect)
  if (operator === 'is_any_of') {
    const filterValues = values.map(String)
    if (filterValues.length === 0) return true
    if (Array.isArray(rawValue)) {
      return rawValue.some((v) => filterValues.includes(String(v)))
    }
    return filterValues.includes(String(rawValue ?? ''))
  }
  if (operator === 'is_not_any_of' || operator === 'is_none_of') {
    const filterValues = values.map(String)
    if (Array.isArray(rawValue)) {
      return rawValue.every((v) => !filterValues.includes(String(v)))
    }
    return !filterValues.includes(String(rawValue ?? ''))
  }
  if (operator === 'includes_all') {
    const filterValues = values.map(String)
    if (!Array.isArray(rawValue)) return false
    return filterValues.every((v) => rawValue.map(String).includes(v))
  }
  if (operator === 'excludes_all') {
    const filterValues = values.map(String)
    if (!Array.isArray(rawValue)) return true
    return filterValues.every((v) => !rawValue.map(String).includes(v))
  }

  // Single-value operators
  const filterValue = values[0]

  // String operators
  if (operator === 'is') {
    return (
      String(rawValue ?? '').toLowerCase() === String(filterValue).toLowerCase()
    )
  }
  if (operator === 'is_not') {
    return (
      String(rawValue ?? '').toLowerCase() !== String(filterValue).toLowerCase()
    )
  }
  if (operator === 'contains') {
    return String(rawValue ?? '')
      .toLowerCase()
      .includes(String(filterValue).toLowerCase())
  }
  if (operator === 'does_not_contain' || operator === 'not_contains') {
    return !String(rawValue ?? '')
      .toLowerCase()
      .includes(String(filterValue).toLowerCase())
  }
  if (operator === 'starts_with') {
    return String(rawValue ?? '')
      .toLowerCase()
      .startsWith(String(filterValue).toLowerCase())
  }
  if (operator === 'ends_with') {
    return String(rawValue ?? '')
      .toLowerCase()
      .endsWith(String(filterValue).toLowerCase())
  }

  // Numeric operators
  if (operator === 'eq') {
    return Number(rawValue) === Number(filterValue)
  }
  if (operator === 'neq') {
    return Number(rawValue) !== Number(filterValue)
  }
  if (operator === 'gt' || operator === 'after') {
    if (field.valueType === 'date') {
      return String(rawValue ?? '') > String(filterValue)
    }
    return Number(rawValue) > Number(filterValue)
  }
  if (operator === 'lt' || operator === 'before') {
    if (field.valueType === 'date') {
      return String(rawValue ?? '') < String(filterValue)
    }
    return Number(rawValue) < Number(filterValue)
  }
  if (operator === 'gte') {
    return Number(rawValue) >= Number(filterValue)
  }
  if (operator === 'lte') {
    return Number(rawValue) <= Number(filterValue)
  }

  // Range operator
  if (operator === 'between') {
    const from = values[0]
    const to = values[1]
    if (from == null || to == null) return true
    if (field.valueType === 'date') {
      const v = String(rawValue ?? '')
      return v >= String(from) && v <= String(to)
    }
    const v = Number(rawValue)
    return v >= Number(from) && v <= Number(to)
  }

  return true
}

export function applyFilters<TRecord>(
  records: Array<TRecord>,
  filters: Array<Filter>,
  fields: Array<FieldDescriptor>,
): Array<TRecord> {
  if (filters.length === 0) return records
  return records.filter((record) =>
    filters.every((filter) =>
      evaluateFilter(
        record as unknown as Record<string, unknown>,
        filter,
        fields,
      ),
    ),
  )
}
