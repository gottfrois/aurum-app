import type { Meta, StoryObj } from '@storybook/react-vite'
import { subMonths } from 'date-fns'
import { PeriodNavigator } from '../period-navigator'

const now = new Date()

const meta = {
  title: 'Navigation/PeriodNavigator',
  component: PeriodNavigator,
  args: {
    start: subMonths(now, 1),
    end: now,
    activePeriod: '1M',
    canGoNext: false,
    onSelectPeriod: () => {},
    onCustomRange: () => {},
    onPrev: () => {},
    onNext: () => {},
  },
} satisfies Meta<typeof PeriodNavigator>

export default meta
type Story = StoryObj<typeof meta>

export const CurrentMonth: Story = {}

export const ThreeMonths: Story = {
  args: {
    start: subMonths(now, 3),
    activePeriod: '3M',
  },
}

export const YearToDate: Story = {
  args: {
    start: new Date(now.getFullYear(), 0, 1),
    activePeriod: 'YTD',
  },
}

export const CanNavigateForward: Story = {
  args: {
    start: subMonths(now, 2),
    end: subMonths(now, 1),
    canGoNext: true,
  },
}

export const CustomRange: Story = {
  args: {
    start: new Date(2025, 5, 15),
    end: new Date(2025, 8, 30),
    activePeriod: null,
    canGoNext: true,
  },
}
