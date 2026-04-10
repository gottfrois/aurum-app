import type { Meta, StoryObj } from '@storybook/react-vite'
import { MoneyPreferencesProvider } from '~/contexts/money-preferences-context'
import { CategoryPieChart } from '../category-pie-chart'

const meta = {
  title: 'Charts/CategoryPieChart',
  component: CategoryPieChart,
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
} satisfies Meta<typeof CategoryPieChart>

export default meta
type Story = StoryObj<typeof meta>

const data = [
  { key: 'housing', label: 'Housing', value: 1200, color: 'hsl(220 70% 50%)' },
  {
    key: 'food',
    label: 'Food & Groceries',
    value: 450,
    color: 'hsl(142 71% 45%)',
  },
  {
    key: 'transport',
    label: 'Transport',
    value: 280,
    color: 'hsl(280 65% 60%)',
  },
  {
    key: 'entertainment',
    label: 'Entertainment',
    value: 150,
    color: 'hsl(350 80% 55%)',
  },
  { key: 'health', label: 'Health', value: 120, color: 'hsl(30 90% 50%)' },
]

export const Default: Story = {
  args: {
    data,
    total: data.reduce((sum, d) => sum + d.value, 0),
  },
}

export const Clickable: Story = {
  args: {
    data,
    total: data.reduce((sum, d) => sum + d.value, 0),
    onCategoryClick: (key: string) => alert(`Clicked: ${key}`),
  },
}

export const Empty: Story = {
  args: {
    data: [],
    total: 0,
  },
}
