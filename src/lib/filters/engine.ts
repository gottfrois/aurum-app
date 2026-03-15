import type { FilterCondition, FilterConfig } from './types'

function evaluateString(
  rawValue: unknown,
  operator: string,
  filterValue: unknown,
): boolean {
  const value = rawValue == null ? '' : String(rawValue)
  const lower = value.toLowerCase()

  switch (operator) {
    case 'is':
      return lower === String(filterValue).toLowerCase()
    case 'is_not':
      return lower !== String(filterValue).toLowerCase()
    case 'contains':
      return lower.includes(String(filterValue).toLowerCase())
    case 'does_not_contain':
      return !lower.includes(String(filterValue).toLowerCase())
    case 'is_any_of':
      if (!Array.isArray(filterValue) || filterValue.length === 0) return true
      return filterValue.some((v) => lower === String(v).toLowerCase())
    case 'is_none_of':
      return Array.isArray(filterValue)
        ? filterValue.every((v) => lower !== String(v).toLowerCase())
        : true
    case 'is_empty':
      return value === ''
    case 'is_not_empty':
      return value !== ''
    default:
      return true
  }
}

function evaluateNumber(
  rawValue: unknown,
  operator: string,
  filterValue: unknown,
): boolean {
  if (operator === 'is_empty') return rawValue == null
  if (operator === 'is_not_empty') return rawValue != null

  const value = Number(rawValue)
  if (Number.isNaN(value)) return false

  switch (operator) {
    case 'eq':
      return value === Number(filterValue)
    case 'neq':
      return value !== Number(filterValue)
    case 'gt':
      return value > Number(filterValue)
    case 'lt':
      return value < Number(filterValue)
    case 'gte':
      return value >= Number(filterValue)
    case 'lte':
      return value <= Number(filterValue)
    case 'between': {
      const range = filterValue as { from: number; to: number }
      return value >= range.from && value <= range.to
    }
    default:
      return true
  }
}

function evaluateDate(
  rawValue: unknown,
  operator: string,
  filterValue: unknown,
): boolean {
  if (operator === 'is_empty') return rawValue == null || rawValue === ''
  if (operator === 'is_not_empty') return rawValue != null && rawValue !== ''

  const value = String(rawValue ?? '')
  if (!value) return false

  switch (operator) {
    case 'is':
      return value === String(filterValue)
    case 'is_not':
      return value !== String(filterValue)
    case 'gt':
      return value > String(filterValue)
    case 'lt':
      return value < String(filterValue)
    case 'between': {
      const range = filterValue as { from: string; to: string }
      return value >= range.from && value <= range.to
    }
    default:
      return true
  }
}

function evaluateEnum(
  rawValue: unknown,
  operator: string,
  filterValue: unknown,
): boolean {
  // Handle array raw values (e.g. labelIds)
  if (Array.isArray(rawValue)) {
    switch (operator) {
      case 'is_any_of':
        if (!Array.isArray(filterValue) || filterValue.length === 0) return true
        return rawValue.some((v) => filterValue.includes(String(v)))
      case 'is_none_of':
        if (!Array.isArray(filterValue)) return true
        return rawValue.every((v) => !filterValue.includes(String(v)))
      case 'is_empty':
        return rawValue.length === 0
      case 'is_not_empty':
        return rawValue.length > 0
      default:
        return true
    }
  }

  const value = rawValue == null ? '' : String(rawValue)

  switch (operator) {
    case 'is_any_of':
      if (!Array.isArray(filterValue) || filterValue.length === 0) return true
      return filterValue.includes(value)
    case 'is_none_of':
      return Array.isArray(filterValue) ? !filterValue.includes(value) : true
    case 'is_empty':
      return value === ''
    case 'is_not_empty':
      return value !== ''
    default:
      return true
  }
}

function evaluateBoolean(
  rawValue: unknown,
  _operator: string,
  filterValue: unknown,
): boolean {
  return Boolean(rawValue) === Boolean(filterValue)
}

export function evaluateCondition<TField extends string>(
  record: Record<string, unknown>,
  condition: FilterCondition<TField>,
  config: FilterConfig<TField>,
): boolean {
  const fieldDescriptor = config.fieldMap.get(condition.field)
  if (!fieldDescriptor) return true

  // Conditions without a value configured yet should not filter anything,
  // unless the operator is valueless (is_empty / is_not_empty)
  const op = condition.operator
  if (
    condition.value === undefined &&
    op !== 'is_empty' &&
    op !== 'is_not_empty'
  ) {
    return true
  }

  const rawValue = fieldDescriptor.accessor(record)

  switch (fieldDescriptor.valueType) {
    case 'string':
      return evaluateString(rawValue, condition.operator, condition.value)
    case 'number':
      return evaluateNumber(rawValue, condition.operator, condition.value)
    case 'date':
      return evaluateDate(rawValue, condition.operator, condition.value)
    case 'enum':
      return evaluateEnum(rawValue, condition.operator, condition.value)
    case 'boolean':
      return evaluateBoolean(rawValue, condition.operator, condition.value)
    default:
      return true
  }
}

export function applyFilters<TField extends string, TRecord>(
  records: Array<TRecord>,
  conditions: Array<FilterCondition<TField>>,
  config: FilterConfig<TField>,
): Array<TRecord> {
  if (conditions.length === 0) return records
  return records.filter((record) =>
    conditions.every((condition) =>
      evaluateCondition(
        record as unknown as Record<string, unknown>,
        condition,
        config,
      ),
    ),
  )
}
