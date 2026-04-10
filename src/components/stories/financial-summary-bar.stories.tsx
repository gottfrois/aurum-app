import type { Meta, StoryObj } from '@storybook/react-vite'
import { MoneyPreferencesProvider } from '~/contexts/money-preferences-context'
import { FinancialSummaryBar } from '../financial-summary-bar'

const meta = {
  title: 'Data Display/FinancialSummaryBar',
  component: FinancialSummaryBar,
  decorators: [
    (Story) => (
      <MoneyPreferencesProvider>
        <div className="max-w-5xl">
          <Story />
        </div>
      </MoneyPreferencesProvider>
    ),
  ],
  args: {
    currency: 'EUR',
  },
} satisfies Meta<typeof FinancialSummaryBar>

export default meta
type Story = StoryObj<typeof meta>

export const PositiveDelta: Story = {
  args: {
    totalIncome: 20838,
    totalExpenses: 8623,
    delta: 12215,
    savingsRate: 58.6,
    recurringTotal: 4200,
    previous: {
      totalIncome: 18500,
      totalExpenses: 9100,
      delta: 9400,
      savingsRate: 50.8,
      recurringTotal: 3800,
    },
  },
}

export const NegativeDelta: Story = {
  args: {
    totalIncome: 3500,
    totalExpenses: 5200,
    delta: -1700,
    savingsRate: -48.6,
    recurringTotal: 2100,
    previous: {
      totalIncome: 4200,
      totalExpenses: 3800,
      delta: 400,
      savingsRate: 9.5,
      recurringTotal: 1900,
    },
  },
}

export const NoPrevious: Story = {
  args: {
    totalIncome: 5000,
    totalExpenses: 3200,
    delta: 1800,
    savingsRate: 36.0,
    recurringTotal: 0,
  },
}

export const ZeroIncome: Story = {
  args: {
    totalIncome: 0,
    totalExpenses: 1500,
    delta: -1500,
    savingsRate: 0,
    recurringTotal: 0,
    previous: {
      totalIncome: 0,
      totalExpenses: 800,
      delta: -800,
      savingsRate: 0,
      recurringTotal: 0,
    },
  },
}
