import type { Meta, StoryObj } from '@storybook/react-vite'
import { MoneyPreferencesProvider } from '~/contexts/money-preferences-context'
import type { DailyPaceEntry } from '~/lib/financial-analytics'
import { MonthlyPaceChart } from '../monthly-pace-chart'

function generatePaceData(
  daysElapsed: number,
  daysTotal: number,
  dailyRate: number,
  prevDailyRate: number,
): Array<DailyPaceEntry> {
  const data: Array<DailyPaceEntry> = []
  let cumActual = 0
  let cumPrev = 0
  const noise = () => 0.5 + Math.random()

  for (let d = 1; d <= daysTotal; d++) {
    if (d <= daysElapsed) {
      cumActual += dailyRate * noise()
    }
    cumPrev += prevDailyRate * noise()

    data.push({
      day: d,
      actual: d <= daysElapsed ? Math.round(cumActual) : null,
      projected: d >= daysElapsed ? Math.round(dailyRate * d) : null,
      previousMonth: Math.round(cumPrev),
    })
  }
  return data
}

const meta = {
  title: 'Charts/MonthlyPaceChart',
  component: MonthlyPaceChart,
  decorators: [
    (Story) => (
      <MoneyPreferencesProvider>
        <div className="h-[450px] max-w-4xl">
          <Story />
        </div>
      </MoneyPreferencesProvider>
    ),
  ],
  args: {
    currency: 'EUR',
    isLoading: false,
  },
} satisfies Meta<typeof MonthlyPaceChart>

export default meta
type Story = StoryObj<typeof meta>

export const MidMonth: Story = {
  args: {
    data: generatePaceData(15, 31, 85, 75),
    currentTotal: 1275,
    projectedTotal: 2635,
    previousTotal: 2325,
    dailyRate: 85,
  },
}

export const EarlyMonth: Story = {
  args: {
    data: generatePaceData(5, 31, 90, 80),
    currentTotal: 450,
    projectedTotal: 2790,
    previousTotal: 2480,
    dailyRate: 90,
  },
}

export const EndOfMonth: Story = {
  args: {
    data: generatePaceData(28, 31, 80, 95),
    currentTotal: 2240,
    projectedTotal: 2480,
    previousTotal: 2945,
    dailyRate: 80,
  },
}

export const Loading: Story = {
  args: {
    data: [],
    currentTotal: 0,
    projectedTotal: 0,
    previousTotal: 0,
    dailyRate: 0,
    isLoading: true,
  },
}

export const Empty: Story = {
  args: {
    data: [],
    currentTotal: 0,
    projectedTotal: 0,
    previousTotal: 0,
    dailyRate: 0,
  },
}
