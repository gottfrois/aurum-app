import {
  ArrowUpDown,
  Building2,
  Calendar,
  CircleDot,
  DollarSign,
  FileType,
  Tag,
  Tags,
  Text,
  Users,
} from 'lucide-react'
import type { EnumOption, FilterConfig, FilterFieldDescriptor } from './types'
import { resolveTransactionCategoryKey } from '~/lib/categories'

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

interface TransactionFilterDeps {
  accountOptions: Array<EnumOption>
  categoryOptions: Array<EnumOption>
  labelOptions: Array<EnumOption>
  transactionTypeOptions: Array<EnumOption>
}

export function createTransactionFilterConfig(
  deps: TransactionFilterDeps,
): FilterConfig<TransactionFilterField> {
  const fields: Array<FilterFieldDescriptor<TransactionFilterField>> = [
    {
      name: 'account',
      label: 'Account',
      valueType: 'enum',
      operators: ['is_any_of', 'is_none_of'],
      defaultOperator: 'is_any_of',
      enumOptions: deps.accountOptions,
      accessor: (r) => r.bankAccountId,
      icon: Building2,
    },
    {
      name: 'category',
      label: 'Category',
      valueType: 'enum',
      operators: ['is_any_of', 'is_none_of'],
      defaultOperator: 'is_any_of',
      enumOptions: deps.categoryOptions,
      accessor: (r) =>
        resolveTransactionCategoryKey(
          r as {
            userCategoryKey?: string
            categoryParent?: string
            category?: string
          },
        ),
      icon: Tag,
    },
    {
      name: 'labels',
      label: 'Labels',
      valueType: 'enum',
      operators: ['is_any_of', 'is_none_of', 'is_empty', 'is_not_empty'],
      defaultOperator: 'is_any_of',
      enumOptions: deps.labelOptions,
      accessor: (r) => (r.labelIds ?? []) as Array<string>,
      icon: Tags,
    },
    {
      name: 'amount',
      label: 'Amount',
      valueType: 'number',
      operators: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'between'],
      defaultOperator: 'gt',
      accessor: (r) => r.value,
      icon: DollarSign,
    },
    {
      name: 'date',
      label: 'Date',
      valueType: 'date',
      operators: ['is', 'gt', 'lt', 'between'],
      defaultOperator: 'between',
      accessor: (r) => r.date,
      icon: Calendar,
    },
    {
      name: 'flow',
      label: 'Flow',
      valueType: 'enum',
      operators: ['is_any_of'],
      defaultOperator: 'is_any_of',
      enumOptions: [
        { value: 'income', label: 'Income' },
        { value: 'expense', label: 'Expense' },
      ],
      accessor: (r) => ((r.value as number) > 0 ? 'income' : 'expense'),
      icon: ArrowUpDown,
    },
    {
      name: 'wording',
      label: 'Description',
      valueType: 'string',
      operators: ['contains', 'does_not_contain', 'is', 'is_not'],
      defaultOperator: 'contains',
      accessor: (r) => r.wording,
      icon: Text,
    },
    {
      name: 'type',
      label: 'Type',
      valueType: 'enum',
      operators: ['is_any_of', 'is_none_of'],
      defaultOperator: 'is_any_of',
      enumOptions: deps.transactionTypeOptions,
      accessor: (r) => r.type,
      icon: FileType,
    },
    {
      name: 'status',
      label: 'Status',
      valueType: 'enum',
      operators: ['is_any_of'],
      defaultOperator: 'is_any_of',
      enumOptions: [
        { value: 'pending', label: 'Pending' },
        { value: 'completed', label: 'Completed' },
      ],
      accessor: (r) => (r.coming ? 'pending' : 'completed'),
      icon: CircleDot,
    },
    {
      name: 'counterparty',
      label: 'Counterparty',
      valueType: 'string',
      operators: [
        'contains',
        'does_not_contain',
        'is',
        'is_not',
        'is_empty',
        'is_not_empty',
      ],
      defaultOperator: 'contains',
      accessor: (r) => r.counterparty,
      icon: Users,
    },
  ]

  return {
    fields,
    fieldMap: new Map(fields.map((f) => [f.name, f])),
  }
}
