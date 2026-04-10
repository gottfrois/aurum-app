import type { Meta, StoryObj } from '@storybook/react-vite'
import { MoneyPreferencesProvider } from '~/contexts/money-preferences-context'
import { AnomalyHighlightsCard } from '../anomaly-highlights-card'

const mockCategories = [
  { key: 'groceries', label: 'Groceries', color: '#22c55e', builtIn: true },
  { key: 'dining', label: 'Dining', color: '#f97316', builtIn: true },
  { key: 'shopping', label: 'Shopping', color: '#eab308', builtIn: true },
]

const mockAnomalies = [
  {
    categoryKey: 'shopping',
    currentMonthSpend: 850,
    averageSpend: 200,
    ratio: 4.25,
    month: '2025-03',
  },
  {
    categoryKey: 'dining',
    currentMonthSpend: 600,
    averageSpend: 220,
    ratio: 2.73,
    month: '2025-03',
  },
  {
    categoryKey: 'groceries',
    currentMonthSpend: 900,
    averageSpend: 420,
    ratio: 2.14,
    month: '2025-03',
  },
]

const meta = {
  title: 'Charts/AnomalyHighlightsCard',
  component: AnomalyHighlightsCard,
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
    isLoading: false,
    categories: mockCategories,
  },
} satisfies Meta<typeof AnomalyHighlightsCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    anomalies: mockAnomalies,
  },
}

export const SingleAnomaly: Story = {
  args: {
    anomalies: [mockAnomalies[0]],
  },
}

export const NoAnomalies: Story = {
  args: {
    anomalies: [],
  },
}

export const Loading: Story = {
  args: {
    anomalies: [],
    isLoading: true,
  },
}
