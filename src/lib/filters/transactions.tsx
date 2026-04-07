import type { TFunction } from 'i18next'
import {
  ArrowUpDown,
  Building2,
  DollarSign,
  EyeOff,
  FileType,
  Pencil,
  Tag,
  Tags,
  Text,
  Users,
} from 'lucide-react'
import { NumberRenderer } from '~/components/filters/custom-renderers'
import type { FilterOption } from '~/components/reui/filters'
import { resolveTransactionCategoryKey } from '~/lib/categories'
import type { FieldDescriptor } from './types'

export type TransactionFilterField =
  | 'account'
  | 'category'
  | 'labels'
  | 'amount'
  | 'flow'
  | 'wording'
  | 'type'
  | 'status'
  | 'counterparty'
  | 'excluded'
  | 'source'

interface TransactionFilterDeps {
  accountOptions: Array<FilterOption<string>>
  categoryOptions: Array<FilterOption<string>>
  labelOptions: Array<FilterOption<string>>
  transactionTypeOptions: Array<FilterOption<string>>
  excludeFields?: Array<TransactionFilterField>
  t?: TFunction
}

export function createTransactionFilterFields(
  deps: TransactionFilterDeps,
): Array<FieldDescriptor> {
  // Use passed t function or identity for backward compat
  const t = deps.t ?? ((key: string) => key)
  const allFields: Array<
    FieldDescriptor & { fieldKey: TransactionFilterField }
  > = [
    {
      fieldKey: 'account',
      key: 'account',
      label: t('filters.account'),
      type: 'multiselect',
      icon: <Building2 className="size-3.5" />,
      options: deps.accountOptions,
      searchable: true,
      className: 'w-[280px]',
      operators: [
        { value: 'is_any_of', label: t('filters.operators.isAnyOf') },
        { value: 'is_not_any_of', label: t('filters.operators.isNotAnyOf') },
      ],
      defaultOperator: 'is_any_of',
      accessor: (r) => r.bankAccountId,
      valueType: 'enum',
    },
    {
      fieldKey: 'category',
      key: 'category',
      label: t('filters.category'),
      type: 'multiselect',
      icon: <Tag className="size-3.5" />,
      options: deps.categoryOptions,
      searchable: true,
      className: 'w-[240px]',
      operators: [
        { value: 'is_any_of', label: t('filters.operators.isAnyOf') },
        { value: 'is_not_any_of', label: t('filters.operators.isNotAnyOf') },
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
      label: t('filters.labels'),
      type: 'multiselect',
      icon: <Tags className="size-3.5" />,
      options: deps.labelOptions,
      searchable: true,
      operators: [
        { value: 'is_any_of', label: t('filters.operators.isAnyOf') },
        { value: 'is_not_any_of', label: t('filters.operators.isNotAnyOf') },
        { value: 'empty', label: t('filters.operators.empty') },
        { value: 'not_empty', label: t('filters.operators.notEmpty') },
      ],
      defaultOperator: 'is_any_of',
      accessor: (r) => (r.labelIds ?? []) as Array<string>,
      valueType: 'enum',
    },
    {
      fieldKey: 'amount',
      key: 'amount',
      label: t('filters.amount'),
      type: 'custom',
      icon: <DollarSign className="size-3.5" />,
      operators: [
        { value: 'eq', label: t('filters.operators.equals') },
        { value: 'neq', label: t('filters.operators.notEquals') },
        { value: 'gt', label: t('filters.operators.greaterThan') },
        { value: 'lt', label: t('filters.operators.lessThan') },
        { value: 'gte', label: t('filters.operators.atLeast') },
        { value: 'lte', label: t('filters.operators.atMost') },
        { value: 'between', label: t('filters.operators.between') },
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
      fieldKey: 'flow',
      key: 'flow',
      label: t('filters.flow'),
      type: 'multiselect',
      icon: <ArrowUpDown className="size-3.5" />,
      options: [
        { value: 'income', label: t('filters.flowIncome') },
        { value: 'expense', label: t('filters.flowExpense') },
      ],
      operators: [
        { value: 'is_any_of', label: t('filters.operators.isAnyOf') },
      ],
      defaultOperator: 'is_any_of',
      accessor: (r) => ((r.value as number) > 0 ? 'income' : 'expense'),
      valueType: 'enum',
    },
    {
      fieldKey: 'wording',
      key: 'wording',
      label: t('filters.description'),
      type: 'text',
      icon: <Text className="size-3.5" />,
      operators: [
        { value: 'contains', label: t('filters.operators.contains') },
        { value: 'not_contains', label: t('filters.operators.notContains') },
        { value: 'is', label: t('filters.operators.is') },
        { value: 'is_not', label: t('filters.operators.isNot') },
      ],
      defaultOperator: 'contains',
      accessor: (r) => r.wording,
      valueType: 'string',
    },
    {
      fieldKey: 'type',
      key: 'type',
      label: t('filters.type'),
      type: 'multiselect',
      icon: <FileType className="size-3.5" />,
      options: deps.transactionTypeOptions,
      searchable: true,
      operators: [
        { value: 'is_any_of', label: t('filters.operators.isAnyOf') },
        { value: 'is_not_any_of', label: t('filters.operators.isNotAnyOf') },
      ],
      defaultOperator: 'is_any_of',
      accessor: (r) => r.type,
      valueType: 'enum',
    },
    {
      fieldKey: 'counterparty',
      key: 'counterparty',
      label: t('filters.counterparty'),
      type: 'text',
      icon: <Users className="size-3.5" />,
      operators: [
        { value: 'contains', label: t('filters.operators.contains') },
        { value: 'not_contains', label: t('filters.operators.notContains') },
        { value: 'is', label: t('filters.operators.is') },
        { value: 'is_not', label: t('filters.operators.isNot') },
        { value: 'empty', label: t('filters.operators.empty') },
        { value: 'not_empty', label: t('filters.operators.notEmpty') },
      ],
      defaultOperator: 'contains',
      accessor: (r) => r.counterparty,
      valueType: 'string',
    },
    {
      fieldKey: 'excluded',
      key: 'excluded',
      label: t('filters.budget'),
      type: 'multiselect',
      icon: <EyeOff className="size-3.5" />,
      options: [
        { value: 'included', label: t('filters.budgetIncluded') },
        { value: 'excluded', label: t('filters.budgetExcluded') },
      ],
      operators: [
        { value: 'is_any_of', label: t('filters.operators.isAnyOf') },
      ],
      defaultOperator: 'is_any_of',
      accessor: (r) =>
        (r as Record<string, unknown>).excludedFromBudget
          ? 'excluded'
          : 'included',
      valueType: 'enum',
    },
    {
      fieldKey: 'source',
      key: 'source',
      label: t('filters.source'),
      type: 'multiselect',
      icon: <Pencil className="size-3.5" />,
      options: [
        { value: 'synced', label: t('filters.sourceSynced') },
        { value: 'manual', label: t('filters.sourceManual') },
      ],
      operators: [
        { value: 'is_any_of', label: t('filters.operators.isAnyOf') },
      ],
      defaultOperator: 'is_any_of',
      accessor: (r) =>
        (r as Record<string, unknown>).source === 'manual'
          ? 'manual'
          : 'synced',
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
