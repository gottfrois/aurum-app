import type { Meta, StoryObj } from '@storybook/react-vite'
import { MoneyPreferencesProvider } from '~/contexts/money-preferences-context'
import { PnLBadge } from '../pnl-badge'

const meta = {
  title: 'Data Display/PnLBadge',
  component: PnLBadge,
  decorators: [
    (Story) => (
      <MoneyPreferencesProvider>
        <Story />
      </MoneyPreferencesProvider>
    ),
  ],
  args: {
    currency: 'EUR',
  },
} satisfies Meta<typeof PnLBadge>

export default meta
type Story = StoryObj<typeof meta>

export const Positive: Story = {
  args: {
    pnl: { absolute: 12500, percentage: 8.3, isPositive: true },
  },
}

export const Negative: Story = {
  args: {
    pnl: { absolute: -4200, percentage: -3.1, isPositive: false },
  },
}

export const Zero: Story = {
  args: {
    pnl: { absolute: 0, percentage: 0, isPositive: true },
  },
}

export const Null: Story = {
  args: {
    pnl: null,
  },
}
