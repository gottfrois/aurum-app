import type { Meta, StoryObj } from '@storybook/react-vite'
import { PrivacyProvider } from '~/contexts/privacy-context'
import type { YearOverYearEntry } from '~/lib/financial-analytics'
import { YearOverYearChart } from '../year-over-year-chart'

const mockData: Array<YearOverYearEntry> = [
  { month: 1, years: { 2024: 2800, 2025: 3100 } },
  { month: 2, years: { 2024: 2500, 2025: 2700 } },
  { month: 3, years: { 2024: 3100, 2025: 3400 } },
  { month: 4, years: { 2024: 2700, 2025: 2900 } },
  { month: 5, years: { 2024: 2900, 2025: 3200 } },
  { month: 6, years: { 2024: 3400, 2025: 3000 } },
  { month: 7, years: { 2024: 3200, 2025: 3500 } },
  { month: 8, years: { 2024: 2600, 2025: 2800 } },
  { month: 9, years: { 2024: 2900, 2025: 3100 } },
  { month: 10, years: { 2024: 3000, 2025: 3300 } },
  { month: 11, years: { 2024: 3500 } },
  { month: 12, years: { 2024: 4200 } },
]

const meta = {
  title: 'Charts/YearOverYearChart',
  component: YearOverYearChart,
  decorators: [
    (Story) => (
      <PrivacyProvider>
        <div className="h-[400px] max-w-4xl">
          <Story />
        </div>
      </PrivacyProvider>
    ),
  ],
  args: {
    currency: 'EUR',
    isLoading: false,
  },
} satisfies Meta<typeof YearOverYearChart>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    data: mockData,
  },
}

export const PartialYear: Story = {
  args: {
    data: mockData.slice(0, 6),
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
