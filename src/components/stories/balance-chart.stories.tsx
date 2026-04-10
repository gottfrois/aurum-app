import type { Meta, StoryObj } from '@storybook/react-vite'
import { MoneyPreferencesProvider } from '~/contexts/money-preferences-context'
import { BalanceChart } from '../balance-chart'

function generateData(months: number, startBalance: number, trend: number) {
  const data = []
  const now = new Date()
  for (let i = months * 30; i >= 0; i -= 3) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    const noise = (Math.random() - 0.5) * startBalance * 0.05
    const balance = startBalance + trend * ((months * 30 - i) / 30) + noise
    data.push({
      date: date.toISOString().split('T')[0],
      balance: Math.round(balance),
    })
  }
  return data
}

const meta = {
  title: 'Charts/BalanceChart',
  component: BalanceChart,
  decorators: [
    (Story) => (
      <MoneyPreferencesProvider>
        <div className="max-w-3xl">
          <Story />
        </div>
      </MoneyPreferencesProvider>
    ),
  ],
  args: {
    currency: 'EUR',
    period: '1Y' as const,
    onPeriodChange: () => {},
    isLoading: false,
  },
} satisfies Meta<typeof BalanceChart>

export default meta
type Story = StoryObj<typeof meta>

export const WithTitle: Story = {
  args: {
    title: 'Net Worth',
    description: 'Across all portfolios',
    data: generateData(12, 100000, 2000),
  },
}

export const WithoutTitle: Story = {
  args: {
    data: generateData(6, 50000, 1000),
  },
}

export const Loading: Story = {
  args: {
    title: 'Net Worth',
    data: [],
    isLoading: true,
  },
}

export const InsufficientData: Story = {
  args: {
    title: 'Net Worth',
    data: [{ date: '2025-01-01', balance: 100000 }],
  },
}
