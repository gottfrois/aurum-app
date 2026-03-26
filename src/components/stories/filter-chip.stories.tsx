import type { Meta, StoryObj } from '@storybook/react-vite'
import { DollarSign, Tag, Type } from 'lucide-react'
import type {
  FilterCondition,
  FilterFieldDescriptor,
} from '~/lib/filters/types'
import { FilterChip } from '../filters/filter-chip'

const meta = {
  title: 'Forms/FilterChip',
  component: FilterChip,
  args: {
    onUpdate: () => {},
    onRemove: () => {},
  },
} satisfies Meta<typeof FilterChip>

export default meta
type Story = StoryObj<typeof meta>

const descriptionField: FilterFieldDescriptor = {
  name: 'description',
  label: 'Description',
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
  icon: Type,
  accessor: (r) => r.description,
}

const amountField: FilterFieldDescriptor = {
  name: 'amount',
  label: 'Amount',
  valueType: 'number',
  operators: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'between'],
  defaultOperator: 'gt',
  icon: DollarSign,
  accessor: (r) => r.amount,
}

const categoryField: FilterFieldDescriptor = {
  name: 'category',
  label: 'Category',
  valueType: 'enum',
  operators: ['is_any_of', 'is_none_of', 'is_empty', 'is_not_empty'],
  defaultOperator: 'is_any_of',
  icon: Tag,
  enumOptions: [
    { value: 'food', label: 'Food & Groceries' },
    { value: 'housing', label: 'Housing' },
    { value: 'transport', label: 'Transport' },
  ],
  accessor: (r) => r.category,
}

export const StringContains: Story = {
  args: {
    condition: {
      id: '1',
      field: 'description',
      operator: 'contains',
      value: 'Amazon',
    } as FilterCondition,
    field: descriptionField,
  },
}

export const NumberGreaterThan: Story = {
  args: {
    condition: {
      id: '2',
      field: 'amount',
      operator: 'gt',
      value: 100,
    } as FilterCondition,
    field: amountField,
  },
}

export const EnumSelection: Story = {
  args: {
    condition: {
      id: '3',
      field: 'category',
      operator: 'is_any_of',
      value: ['food', 'housing'],
    } as FilterCondition,
    field: categoryField,
  },
}

export const IsEmpty: Story = {
  args: {
    condition: {
      id: '4',
      field: 'description',
      operator: 'is_empty',
      value: null,
    } as FilterCondition,
    field: descriptionField,
  },
}
