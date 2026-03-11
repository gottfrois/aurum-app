import type {
  BooleanOperator,
  DateOperator,
  EnumOperator,
  FilterOperator,
  FilterValueType,
  NumberOperator,
  StringOperator,
} from './types'

export const STRING_OPERATORS: Array<StringOperator> = [
  'is',
  'is_not',
  'contains',
  'does_not_contain',
  'is_any_of',
  'is_none_of',
  'is_empty',
  'is_not_empty',
]

export const NUMBER_OPERATORS: Array<NumberOperator> = [
  'eq',
  'neq',
  'gt',
  'lt',
  'gte',
  'lte',
  'between',
  'is_empty',
  'is_not_empty',
]

export const DATE_OPERATORS: Array<DateOperator> = [
  'is',
  'is_not',
  'gt',
  'lt',
  'between',
  'is_empty',
  'is_not_empty',
]

export const ENUM_OPERATORS: Array<EnumOperator> = [
  'is_any_of',
  'is_none_of',
  'is_empty',
  'is_not_empty',
]

export const BOOLEAN_OPERATORS: Array<BooleanOperator> = ['is']

export const OPERATORS_BY_TYPE: Record<
  FilterValueType,
  Array<FilterOperator>
> = {
  string: STRING_OPERATORS,
  number: NUMBER_OPERATORS,
  date: DATE_OPERATORS,
  enum: ENUM_OPERATORS,
  boolean: BOOLEAN_OPERATORS,
}

export const OPERATOR_LABELS: Record<FilterOperator, string> = {
  is: 'is',
  is_not: 'is not',
  contains: 'contains',
  does_not_contain: 'does not contain',
  is_any_of: 'is any of',
  is_none_of: 'is none of',
  is_empty: 'is empty',
  is_not_empty: 'is not empty',
  eq: 'is',
  neq: 'is not',
  gt: 'greater than',
  lt: 'less than',
  gte: 'greater than or equal',
  lte: 'less than or equal',
  between: 'between',
}

const DATE_OPERATOR_LABELS: Partial<Record<FilterOperator, string>> = {
  gt: 'after',
  lt: 'before',
}

export function getOperatorLabel(
  operator: FilterOperator,
  valueType?: FilterValueType,
): string {
  if (valueType === 'date') {
    const dateLabel = DATE_OPERATOR_LABELS[operator]
    if (dateLabel) return dateLabel
  }
  return OPERATOR_LABELS[operator]
}

export const VALUELESS_OPERATORS = new Set<FilterOperator>([
  'is_empty',
  'is_not_empty',
])

export const RANGE_OPERATORS = new Set<FilterOperator>(['between'])
