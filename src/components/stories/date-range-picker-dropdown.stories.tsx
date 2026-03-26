import type { Meta, StoryObj } from '@storybook/react-vite'
import { subMonths } from 'date-fns'
import { DateRangePickerDropdown } from '../date-range-picker-dropdown'

const now = new Date()

const meta = {
  title: 'Overlays/DateRangePickerDropdown',
  component: DateRangePickerDropdown,
  args: {
    onRangeChange: () => {},
  },
} satisfies Meta<typeof DateRangePickerDropdown>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    start: subMonths(now, 1),
    end: now,
  },
}

export const WideRange: Story = {
  args: {
    start: new Date(2024, 0, 1),
    end: now,
  },
}
