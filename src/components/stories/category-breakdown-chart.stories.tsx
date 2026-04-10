import type { Meta, StoryObj } from '@storybook/react-vite'
import { MoneyPreferencesProvider } from '~/contexts/money-preferences-context'
import { CategoryBreakdownChart } from '../category-breakdown-chart'

const mockData = [
  { key: 'groceries', label: 'Groceries', value: 580, color: '#22c55e' },
  { key: 'transport', label: 'Transport', value: 320, color: '#3b82f6' },
  { key: 'dining', label: 'Dining', value: 280, color: '#f97316' },
  { key: 'utilities', label: 'Utilities', value: 180, color: '#8b5cf6' },
  {
    key: 'entertainment',
    label: 'Entertainment',
    value: 120,
    color: '#ec4899',
  },
  { key: 'shopping', label: 'Shopping', value: 95, color: '#eab308' },
]

const meta = {
  title: 'Charts/CategoryBreakdownChart',
  component: CategoryBreakdownChart,
  decorators: [
    (Story) => (
      <MoneyPreferencesProvider>
        <div className="max-w-lg">
          <Story />
        </div>
      </MoneyPreferencesProvider>
    ),
  ],
  args: {
    currency: 'EUR',
  },
} satisfies Meta<typeof CategoryBreakdownChart>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    data: mockData,
    total: 1575,
  },
}

export const WithTitle: Story = {
  args: {
    data: mockData,
    total: 1575,
    title: 'Income by Category',
  },
}

export const FewCategories: Story = {
  args: {
    data: mockData.slice(0, 3),
    total: 1180,
  },
}

export const Empty: Story = {
  args: {
    data: [],
    total: 0,
  },
}
