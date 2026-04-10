import type { Meta, StoryObj } from '@storybook/react-vite'
import { PrivacyProvider } from '~/contexts/privacy-context'
import type { RecentTransactionEntry } from '../recent-transactions-list'
import { RecentTransactionsList } from '../recent-transactions-list'

const mockTransactions: Array<RecentTransactionEntry> = [
  {
    _id: '1',
    date: '2025-03-15',
    description: 'Carrefour',
    value: -85.5,
    categoryLabel: 'Groceries',
    categoryColor: '#22c55e',
  },
  {
    _id: '2',
    date: '2025-03-14',
    description: 'Uber Eats',
    value: -42,
    categoryLabel: 'Dining',
    categoryColor: '#f97316',
  },
  {
    _id: '3',
    date: '2025-03-14',
    description: 'Salary',
    value: 3200,
    categoryLabel: 'Salary',
    categoryColor: '#3b82f6',
  },
  {
    _id: '4',
    date: '2025-03-13',
    description: 'Netflix',
    value: -15.49,
    categoryLabel: 'Subscriptions',
    categoryColor: '#8b5cf6',
  },
  {
    _id: '5',
    date: '2025-03-12',
    description: 'Navigo',
    value: -86.4,
    categoryLabel: 'Transport',
    categoryColor: '#06b6d4',
  },
  {
    _id: '6',
    date: '2025-03-11',
    description: 'EDF',
    value: -65,
    categoryLabel: 'Utilities',
    categoryColor: '#eab308',
  },
  {
    _id: '7',
    date: '2025-03-10',
    description: 'Amazon',
    value: -120,
    categoryLabel: 'Shopping',
    categoryColor: '#ec4899',
  },
  {
    _id: '8',
    date: '2025-03-09',
    description: 'Boulangerie',
    value: -35,
    categoryLabel: 'Dining',
    categoryColor: '#f97316',
  },
]

const meta = {
  title: 'Data Display/RecentTransactionsList',
  component: RecentTransactionsList,
  decorators: [
    (Story) => (
      <PrivacyProvider>
        <div className="max-w-2xl">
          <Story />
        </div>
      </PrivacyProvider>
    ),
  ],
  args: {
    currency: 'EUR',
  },
} satisfies Meta<typeof RecentTransactionsList>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    transactions: mockTransactions,
  },
}

export const Loading: Story = {
  args: {
    transactions: undefined,
  },
}

export const Empty: Story = {
  args: {
    transactions: [],
  },
}
