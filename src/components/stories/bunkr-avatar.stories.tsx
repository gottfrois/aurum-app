import type { Meta, StoryObj } from '@storybook/react-vite'
import { BunkrAvatar } from '../bunkr-avatar'

const meta = {
  title: 'Elements/BunkrAvatar',
  component: BunkrAvatar,
} satisfies Meta<typeof BunkrAvatar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Large: Story = {
  args: {
    className: 'size-12',
  },
}

export const Small: Story = {
  args: {
    className: 'size-6',
  },
}
