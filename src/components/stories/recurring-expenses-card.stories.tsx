import type { Meta, StoryObj } from '@storybook/react-vite'
import { PrivacyProvider } from '~/contexts/privacy-context'
import { RecurringExpensesCard } from '../recurring-expenses-card'

const mockCategories = [
  {
    key: 'subscriptions',
    label: 'Subscriptions',
    color: '#8b5cf6',
    builtIn: true,
  },
  { key: 'utilities', label: 'Utilities', color: '#3b82f6', builtIn: true },
  { key: 'insurance', label: 'Insurance', color: '#22c55e', builtIn: true },
  { key: 'transport', label: 'Transport', color: '#f97316', builtIn: true },
]

const mockItems = [
  {
    payee: 'Rent',
    monthlyAmount: 1200,
    frequency: 12,
    months: [
      '2024-04',
      '2024-05',
      '2024-06',
      '2024-07',
      '2024-08',
      '2024-09',
      '2024-10',
      '2024-11',
      '2024-12',
      '2025-01',
      '2025-02',
      '2025-03',
    ],
    categoryKey: 'utilities',
    lastDate: '2025-03-01',
  },
  {
    payee: 'Car Insurance',
    monthlyAmount: 85,
    frequency: 6,
    months: ['2024-10', '2024-11', '2024-12', '2025-01', '2025-02', '2025-03'],
    categoryKey: 'insurance',
    lastDate: '2025-03-05',
  },
  {
    payee: 'Netflix',
    monthlyAmount: 15.49,
    frequency: 12,
    months: [
      '2024-04',
      '2024-05',
      '2024-06',
      '2024-07',
      '2024-08',
      '2024-09',
      '2024-10',
      '2024-11',
      '2024-12',
      '2025-01',
      '2025-02',
      '2025-03',
    ],
    categoryKey: 'subscriptions',
    lastDate: '2025-03-15',
  },
  {
    payee: 'Spotify',
    monthlyAmount: 10.99,
    frequency: 12,
    months: [
      '2024-04',
      '2024-05',
      '2024-06',
      '2024-07',
      '2024-08',
      '2024-09',
      '2024-10',
      '2024-11',
      '2024-12',
      '2025-01',
      '2025-02',
      '2025-03',
    ],
    categoryKey: 'subscriptions',
    lastDate: '2025-03-12',
  },
  {
    payee: 'Gym',
    monthlyAmount: 39.99,
    frequency: 8,
    months: [
      '2024-08',
      '2024-09',
      '2024-10',
      '2024-11',
      '2024-12',
      '2025-01',
      '2025-02',
      '2025-03',
    ],
    categoryKey: 'utilities',
    lastDate: '2025-03-01',
  },
  {
    payee: 'Navigo',
    monthlyAmount: 86.4,
    frequency: 10,
    months: [
      '2024-06',
      '2024-07',
      '2024-08',
      '2024-09',
      '2024-10',
      '2024-11',
      '2024-12',
      '2025-01',
      '2025-02',
      '2025-03',
    ],
    categoryKey: 'transport',
    lastDate: '2025-03-01',
  },
]

const meta = {
  title: 'Charts/RecurringExpensesCard',
  component: RecurringExpensesCard,
  decorators: [
    (Story) => (
      <PrivacyProvider>
        <div className="max-w-lg">
          <Story />
        </div>
      </PrivacyProvider>
    ),
  ],
  args: {
    currency: 'EUR',
    isLoading: false,
    categories: mockCategories,
  },
} satisfies Meta<typeof RecurringExpensesCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    items: mockItems,
  },
}

export const Loading: Story = {
  args: {
    items: [],
    isLoading: true,
  },
}

export const Empty: Story = {
  args: {
    items: [],
  },
}
