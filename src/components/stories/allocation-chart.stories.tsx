import type { Meta, StoryObj } from '@storybook/react-vite'
import { MoneyPreferencesProvider } from '~/contexts/money-preferences-context'
import { AllocationChart } from '../allocation-chart'

const meta = {
  title: 'Charts/AllocationChart',
  component: AllocationChart,
  decorators: [
    (Story) => (
      <MoneyPreferencesProvider>
        <div className="max-w-md">
          <Story />
        </div>
      </MoneyPreferencesProvider>
    ),
  ],
  args: {
    currency: 'EUR',
  },
} satisfies Meta<typeof AllocationChart>

export default meta
type Story = StoryObj<typeof meta>

const data = [
  {
    key: 'checking',
    label: 'Checking',
    value: 15000,
    color: 'var(--color-chart-1)',
  },
  {
    key: 'savings',
    label: 'Savings',
    value: 45000,
    color: 'var(--color-chart-2)',
  },
  {
    key: 'investments',
    label: 'Investments',
    value: 82000,
    color: 'var(--color-chart-3)',
  },
  {
    key: 'insurance',
    label: 'Insurance',
    value: 23000,
    color: 'var(--color-chart-4)',
  },
]

export const Donut: Story = {
  args: {
    data,
    total: data.reduce((sum, d) => sum + d.value, 0),
  },
}

export const SingleCategory: Story = {
  args: {
    data: [data[2]],
    total: data[2].value,
  },
}
