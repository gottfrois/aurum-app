import type { Meta, StoryObj } from '@storybook/react-vite'
import { PeriodSelector } from '../period-selector'

const meta = {
  title: 'Navigation/PeriodSelector',
  component: PeriodSelector,
  decorators: [
    (Story) => (
      <div className="@container/card">
        <Story />
      </div>
    ),
  ],
  args: {
    onPeriodChange: () => {},
  },
} satisfies Meta<typeof PeriodSelector>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    period: '1M',
  },
}

export const YearToDate: Story = {
  args: {
    period: 'YTD',
  },
}

export const AllTime: Story = {
  args: {
    period: 'All',
  },
}
