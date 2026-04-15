import type { Meta, StoryObj } from '@storybook/react-vite'
import { MoneyPreferencesProvider } from '~/contexts/money-preferences-context'
import type { ChartSpec } from '../../../convex/lib/chartSpec'
import { ChartMessage } from '../chat/chart-message'

const meta = {
  title: 'Charts/ChartMessage',
  component: ChartMessage,
  decorators: [
    (Story) => (
      <MoneyPreferencesProvider>
        <div className="max-w-2xl">
          <Story />
        </div>
      </MoneyPreferencesProvider>
    ),
  ],
} satisfies Meta<typeof ChartMessage>

export default meta
type Story = StoryObj<typeof meta>

const weekdaySpec: ChartSpec = {
  type: 'bar',
  title: 'Average spend by day of week',
  data: [
    { weekday: 'Mon', avg: 24 },
    { weekday: 'Tue', avg: 18 },
    { weekday: 'Wed', avg: 32 },
    { weekday: 'Thu', avg: 21 },
    { weekday: 'Fri', avg: 58 },
    { weekday: 'Sat', avg: 64 },
    { weekday: 'Sun', avg: 41 },
  ],
  xKey: 'weekday',
  series: [{ key: 'avg', label: 'Avg spend', color: 'var(--chart-1)' }],
  valueFormat: 'currency',
  currency: 'EUR',
}

export const BarWeekdaySpend: Story = {
  args: { spec: weekdaySpec },
}

const multiSeriesBar: ChartSpec = {
  type: 'bar',
  title: 'Monthly income vs expenses',
  data: [
    { month: 'Jan', income: 3200, expenses: 2800 },
    { month: 'Feb', income: 3200, expenses: 2500 },
    { month: 'Mar', income: 3500, expenses: 3100 },
    { month: 'Apr', income: 3200, expenses: 2700 },
    { month: 'May', income: 3800, expenses: 2900 },
    { month: 'Jun', income: 3200, expenses: 3400 },
  ],
  xKey: 'month',
  series: [
    { key: 'income', label: 'Income', color: 'var(--chart-1)' },
    { key: 'expenses', label: 'Expenses', color: 'var(--chart-2)' },
  ],
  valueFormat: 'currency',
  currency: 'EUR',
}

export const BarMultiSeries: Story = {
  args: { spec: multiSeriesBar },
}

export const BarStacked: Story = {
  args: { spec: { ...multiSeriesBar, stack: 'normal' } },
}

const lineSpec: ChartSpec = {
  type: 'line',
  title: 'Net worth trend',
  data: Array.from({ length: 12 }, (_, i) => ({
    month: `2026-${String(i + 1).padStart(2, '0')}`,
    value: 100000 + i * 4200 + Math.round(Math.sin(i) * 2500),
  })),
  xKey: 'month',
  series: [{ key: 'value', label: 'Net worth', color: 'var(--chart-1)' }],
  valueFormat: 'currency',
  currency: 'EUR',
}

export const LineNetWorth: Story = {
  args: { spec: lineSpec },
}

const areaSpec: ChartSpec = {
  type: 'area',
  title: 'Cash flow (stacked)',
  data: [
    { month: 'Jan', income: 3200, expenses: 2800 },
    { month: 'Feb', income: 3200, expenses: 2500 },
    { month: 'Mar', income: 3500, expenses: 3100 },
    { month: 'Apr', income: 3200, expenses: 2700 },
    { month: 'May', income: 3800, expenses: 2900 },
    { month: 'Jun', income: 3200, expenses: 3400 },
  ],
  xKey: 'month',
  series: [
    { key: 'income', label: 'Income', color: 'var(--chart-1)' },
    { key: 'expenses', label: 'Expenses', color: 'var(--chart-2)' },
  ],
  stack: 'normal',
  valueFormat: 'currency',
  currency: 'EUR',
}

export const AreaStacked: Story = {
  args: { spec: areaSpec },
}

// Mirrors what query_series(metric='net_worth', groupBy='assetClass') returns:
// multi-series rows keyed by asset-class taxonomy keys.
const assetClassStackSpec: ChartSpec = {
  type: 'area',
  title: 'Net worth by asset class',
  data: Array.from({ length: 12 }, (_, i) => ({
    month: `2026-${String(i + 1).padStart(2, '0')}`,
    checking: 4200 + i * 80,
    savings: 18000 + i * 350,
    investments: 62000 + i * 1800 + Math.round(Math.sin(i) * 1500),
    insurance: 9500 + i * 120,
  })),
  xKey: 'month',
  series: [
    { key: 'checking', label: 'Checking', color: 'var(--chart-1)' },
    { key: 'savings', label: 'Savings', color: 'var(--chart-2)' },
    { key: 'investments', label: 'Investments', color: 'var(--chart-3)' },
    { key: 'insurance', label: 'Insurance', color: 'var(--chart-4)' },
  ],
  stack: 'normal',
  valueFormat: 'currency',
  currency: 'EUR',
}

export const AreaStackedByAssetClass: Story = {
  args: { spec: assetClassStackSpec },
}

const pieSpec: ChartSpec = {
  type: 'pie',
  title: 'Spending by category — March',
  data: [
    { category: 'Restaurants', amount: 520 },
    { category: 'Transport', amount: 240 },
    { category: 'Groceries', amount: 380 },
    { category: 'Subscriptions', amount: 95 },
    { category: 'Shopping', amount: 210 },
  ],
  xKey: 'category',
  nameKey: 'category',
  valueKey: 'amount',
  series: [{ key: 'amount', label: 'Spend', color: 'var(--chart-1)' }],
  valueFormat: 'currency',
  currency: 'EUR',
}

export const PieCategoryBreakdown: Story = {
  args: { spec: pieSpec },
}

const singleRowSpec: ChartSpec = {
  type: 'bar',
  title: 'Single bucket',
  data: [{ label: 'Only', value: 42 }],
  xKey: 'label',
  series: [{ key: 'value', label: 'Value', color: 'var(--chart-1)' }],
  valueFormat: 'number',
}

export const EdgeSingleRow: Story = {
  args: { spec: singleRowSpec },
}

export const ErrorState: Story = {
  args: { spec: { error: 'xKey "day" is not present in data rows' } },
}
