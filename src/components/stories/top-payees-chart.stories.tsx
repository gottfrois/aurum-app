import type { Meta, StoryObj } from '@storybook/react-vite'
import { PrivacyProvider } from '~/contexts/privacy-context'
import { TopPayeesChart } from '../top-payees-chart'

const mockCategories = [
  { key: 'groceries', label: 'Groceries', color: '#22c55e', builtIn: true },
  { key: 'dining', label: 'Dining', color: '#f97316', builtIn: true },
  { key: 'transport', label: 'Transport', color: '#3b82f6', builtIn: true },
  { key: 'utilities', label: 'Utilities', color: '#8b5cf6', builtIn: true },
  { key: 'shopping', label: 'Shopping', color: '#eab308', builtIn: true },
]

const mockData = [
  {
    payee: 'Carrefour',
    total: 3200,
    transactionCount: 48,
    categoryKey: 'groceries',
  },
  {
    payee: 'Monoprix',
    total: 1800,
    transactionCount: 30,
    categoryKey: 'groceries',
  },
  {
    payee: 'RATP',
    total: 1040,
    transactionCount: 12,
    categoryKey: 'transport',
  },
  { payee: 'EDF', total: 960, transactionCount: 12, categoryKey: 'utilities' },
  {
    payee: 'Uber Eats',
    total: 850,
    transactionCount: 22,
    categoryKey: 'dining',
  },
  {
    payee: 'Amazon',
    total: 720,
    transactionCount: 15,
    categoryKey: 'shopping',
  },
  {
    payee: 'Picard',
    total: 680,
    transactionCount: 18,
    categoryKey: 'groceries',
  },
  {
    payee: 'Boulangerie',
    total: 540,
    transactionCount: 90,
    categoryKey: 'dining',
  },
  {
    payee: 'Total Energies',
    total: 480,
    transactionCount: 8,
    categoryKey: 'transport',
  },
  { payee: 'Fnac', total: 350, transactionCount: 5, categoryKey: 'shopping' },
]

const meta = {
  title: 'Charts/TopPayeesChart',
  component: TopPayeesChart,
  decorators: [
    (Story) => (
      <PrivacyProvider>
        <div className="h-[450px] max-w-2xl">
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
} satisfies Meta<typeof TopPayeesChart>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    data: mockData,
  },
}

export const FewPayees: Story = {
  args: {
    data: mockData.slice(0, 3),
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
