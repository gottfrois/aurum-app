import type { Meta, StoryObj } from '@storybook/react-vite'
import { PrivacyProvider } from '~/contexts/privacy-context'
import { CashFlowChart } from '../cash-flow-chart'

const meta = {
  title: 'Charts/CashFlowChart',
  component: CashFlowChart,
  decorators: [
    (Story) => (
      <PrivacyProvider>
        <div className="max-w-3xl">
          <Story />
        </div>
      </PrivacyProvider>
    ),
  ],
  args: {
    currency: 'EUR',
    isLoading: false,
  },
} satisfies Meta<typeof CashFlowChart>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    data: [
      { month: 'Jan', income: 3200, expenses: 2800 },
      { month: 'Feb', income: 3200, expenses: 2500 },
      { month: 'Mar', income: 3500, expenses: 3100 },
      { month: 'Apr', income: 3200, expenses: 2700 },
      { month: 'May', income: 3800, expenses: 2900 },
      { month: 'Jun', income: 3200, expenses: 3400 },
    ],
  },
}

export const Loading: Story = {
  args: {
    data: [],
    isLoading: true,
  },
}

export const Empty: Story = {
  args: {
    data: [],
  },
}
