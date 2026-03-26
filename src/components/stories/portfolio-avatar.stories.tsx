import type { Meta, StoryObj } from '@storybook/react-vite'
import { PortfolioAvatar } from '../portfolio-avatar'

const meta = {
  title: 'Elements/PortfolioAvatar',
  component: PortfolioAvatar,
} satisfies Meta<typeof PortfolioAvatar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    name: 'Personal Portfolio',
    className: 'size-8',
  },
}

export const SingleWord: Story = {
  args: {
    name: 'Investments',
    className: 'size-8',
  },
}

export const Large: Story = {
  args: {
    name: 'Joint Account',
    className: 'size-12 text-base',
  },
}

export const Small: Story = {
  args: {
    name: 'Savings Plan',
    className: 'size-6 text-[10px]',
  },
}
