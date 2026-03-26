import type { Meta, StoryObj } from '@storybook/react-vite'
import { PrivacyProvider } from '~/contexts/privacy-context'
import { DashboardCard } from '../dashboard-card'

const meta = {
  title: 'Data Display/DashboardCard',
  component: DashboardCard,
  decorators: [
    (Story) => (
      <PrivacyProvider>
        <div className="max-w-sm">
          <Story />
        </div>
      </PrivacyProvider>
    ),
  ],
  args: {
    currency: 'EUR',
  },
} satisfies Meta<typeof DashboardCard>

export default meta
type Story = StoryObj<typeof meta>

export const TrendingUp: Story = {
  args: {
    title: 'Net Worth',
    value: '125 400 €',
    pnl: { absolute: 12500, percentage: 8.3, isPositive: true },
    description: 'Across all portfolios',
  },
}

export const TrendingDown: Story = {
  args: {
    title: 'Investments',
    value: '48 200 €',
    pnl: { absolute: -2100, percentage: -4.2, isPositive: false },
    description: 'Stocks & ETFs',
  },
}

export const NoPnL: Story = {
  args: {
    title: 'Cash',
    value: '15 000 €',
    pnl: null,
  },
}
