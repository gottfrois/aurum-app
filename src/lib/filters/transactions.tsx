import {
  ArrowUpDown,
  Building2,
  Calendar,
  CircleDot,
  DollarSign,
  EyeOff,
  FileType,
  Tag,
  Tags,
  Text,
  Users,
} from 'lucide-react'
import {
  DateRangeRenderer,
  NumberRenderer,
  SingleDateRenderer,
} from '~/components/filters/custom-renderers'
import type { FilterOption } from '~/components/reui/filters'
import { resolveTransactionCategoryKey } from '~/lib/categories'
import type { FieldDescriptor } from './types'

export type TransactionFilterField =
  | 'account'
  | 'category'
  | 'labels'
  | 'amount'
  | 'date'
  | 'flow'
  | 'wording'
  | 'type'
  | 'status'
  | 'counterparty'
  | 'excluded'

interface TransactionFilterDeps {
  accountOptions: Array<FilterOption<string>>
  categoryOptions: Array<FilterOption<string>>
  labelOptions: Array<FilterOption<string>>
  transactionTypeOptions: Array<FilterOption<string>>
  excludeFields?: Array<TransactionFilterField>
}

export function createTransactionFilterFields(
  deps: TransactionFilterDeps,
): Array<FieldDescriptor> {
  const allFields: Array<
    FieldDescriptor & { fieldKey: TransactionFilterField }
  > = [
    {
      fieldKey: 'account',
      key: 'account',
      label: 'Account',
      type: 'multiselect',
      icon: <Building2 className="size-3.5" />,
      options: deps.accountOptions,
      searchable: true,
      className: 'w-[280px]',
      operators: [
        { value: 'is_any_of', label: 'is any of' },
        { value: 'is_not_any_of', label: 'is none of' },
      ],
      defaultOperator: 'is_any_of',
      accessor: (r) => r.bankAccountId,
      valueType: 'enum',
    },
    {
      fieldKey: 'category',
      key: 'category',
      label: 'Category',
      type: 'multiselect',
      icon: <Tag className="size-3.5" />,
      options: deps.categoryOptions,
      searchable: true,
      className: 'w-[240px]',
      operators: [
        { value: 'is_any_of', label: 'is any of' },
        { value: 'is_not_any_of', label: 'is none of' },
      ],
      defaultOperator: 'is_any_of',
      accessor: (r) =>
        resolveTransactionCategoryKey(
          r as {
            userCategoryKey?: string
            categoryParent?: string
            category?: string
          },
        ),
      valueType: 'enum',
    },
    {
      fieldKey: 'labels',
      key: 'labels',
      label: 'Labels',
      type: 'multiselect',
      icon: <Tags className="size-3.5" />,
      options: deps.labelOptions,
      searchable: true,
      operators: [
        { value: 'is_any_of', label: 'is any of' },
        { value: 'is_not_any_of', label: 'is none of' },
        { value: 'empty', label: 'is empty' },
        { value: 'not_empty', label: 'is not empty' },
      ],
      defaultOperator: 'is_any_of',
      accessor: (r) => (r.labelIds ?? []) as Array<string>,
      valueType: 'enum',
    },
    {
      fieldKey: 'amount',
      key: 'amount',
      label: 'Amount',
      type: 'custom',
      icon: <DollarSign className="size-3.5" />,
      operators: [
        { value: 'eq', label: 'equals' },
        { value: 'neq', label: 'not equals' },
        { value: 'gt', label: 'greater than' },
        { value: 'lt', label: 'less than' },
        { value: 'gte', label: 'at least' },
        { value: 'lte', label: 'at most' },
        { value: 'between', label: 'between' },
      ],
      defaultOperator: 'gt',
      customRenderer: (props) => NumberRenderer(props),
      customValueRenderer: (values) => {
        if (values.length === 2 && values[0] != null && values[1] != null) {
          return (
            <span>
              {String(values[0])} – {String(values[1])}
            </span>
          )
        }
        if (values.length >= 1 && values[0] != null) {
          return <span>{String(values[0])}</span>
        }
        return null
      },
      accessor: (r) => r.value,
      valueType: 'number',
    },
    {
      fieldKey: 'date',
      key: 'date',
      label: 'Date',
      type: 'custom',
      icon: <Calendar className="size-3.5" />,
      operators: [
        { value: 'between', label: 'between' },
        { value: 'is', label: 'is' },
        { value: 'after', label: 'after' },
        { value: 'before', label: 'before' },
      ],
      defaultOperator: 'between',
      customRenderer: (props) => {
        if (props.operator === 'between') {
          return DateRangeRenderer(props)
        }
        return SingleDateRenderer(props)
      },
      customValueRenderer: (values) => {
        if (values.length === 2 && values[0] != null && values[1] != null) {
          return (
            <span>
              {String(values[0])} – {String(values[1])}
            </span>
          )
        }
        if (values.length >= 1 && values[0] != null) {
          return <span>{String(values[0])}</span>
        }
        return null
      },
      accessor: (r) => r.date,
      valueType: 'date',
    },
    {
      fieldKey: 'flow',
      key: 'flow',
      label: 'Flow',
      type: 'multiselect',
      icon: <ArrowUpDown className="size-3.5" />,
      options: [
        { value: 'income', label: 'Income' },
        { value: 'expense', label: 'Expense' },
      ],
      operators: [{ value: 'is_any_of', label: 'is any of' }],
      defaultOperator: 'is_any_of',
      accessor: (r) => ((r.value as number) > 0 ? 'income' : 'expense'),
      valueType: 'enum',
    },
    {
      fieldKey: 'wording',
      key: 'wording',
      label: 'Description',
      type: 'text',
      icon: <Text className="size-3.5" />,
      operators: [
        { value: 'contains', label: 'contains' },
        { value: 'not_contains', label: 'does not contain' },
        { value: 'is', label: 'is' },
        { value: 'is_not', label: 'is not' },
      ],
      defaultOperator: 'contains',
      accessor: (r) => r.wording,
      valueType: 'string',
    },
    {
      fieldKey: 'type',
      key: 'type',
      label: 'Type',
      type: 'multiselect',
      icon: <FileType className="size-3.5" />,
      options: deps.transactionTypeOptions,
      searchable: true,
      operators: [
        { value: 'is_any_of', label: 'is any of' },
        { value: 'is_not_any_of', label: 'is none of' },
      ],
      defaultOperator: 'is_any_of',
      accessor: (r) => r.type,
      valueType: 'enum',
    },
    {
      fieldKey: 'status',
      key: 'status',
      label: 'Status',
      type: 'multiselect',
      icon: <CircleDot className="size-3.5" />,
      options: [
        { value: 'pending', label: 'Pending' },
        { value: 'completed', label: 'Completed' },
      ],
      operators: [{ value: 'is_any_of', label: 'is any of' }],
      defaultOperator: 'is_any_of',
      accessor: (r) => (r.coming ? 'pending' : 'completed'),
      valueType: 'enum',
    },
    {
      fieldKey: 'counterparty',
      key: 'counterparty',
      label: 'Counterparty',
      type: 'text',
      icon: <Users className="size-3.5" />,
      operators: [
        { value: 'contains', label: 'contains' },
        { value: 'not_contains', label: 'does not contain' },
        { value: 'is', label: 'is' },
        { value: 'is_not', label: 'is not' },
        { value: 'empty', label: 'is empty' },
        { value: 'not_empty', label: 'is not empty' },
      ],
      defaultOperator: 'contains',
      accessor: (r) => r.counterparty,
      valueType: 'string',
    },
    {
      fieldKey: 'excluded',
      key: 'excluded',
      label: 'Budget',
      type: 'multiselect',
      icon: <EyeOff className="size-3.5" />,
      options: [
        { value: 'included', label: 'Included' },
        { value: 'excluded', label: 'Excluded' },
      ],
      operators: [{ value: 'is_any_of', label: 'is any of' }],
      defaultOperator: 'is_any_of',
      accessor: (r) =>
        (r as Record<string, unknown>).excludedFromBudget
          ? 'excluded'
          : 'included',
      valueType: 'enum',
    },
  ]

  const excluded = deps.excludeFields
  const filtered = excluded
    ? allFields.filter((f) => !excluded.includes(f.fieldKey))
    : allFields

  // Strip the internal fieldKey before returning
  return filtered.map(({ fieldKey: _, ...field }) => field)
}
