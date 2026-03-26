import type { Meta, StoryObj } from '@storybook/react-vite'
import { Moon, Sun } from 'lucide-react'
import { AnimatedToggle } from '../ui/animated-toggle'

const meta = {
  title: 'Forms/AnimatedToggle',
  component: AnimatedToggle,
} satisfies Meta<typeof AnimatedToggle>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    defaultChecked: false,
  },
}

export const Checked: Story = {
  args: {
    checked: true,
  },
}

export const WithIcons: Story = {
  args: {
    defaultChecked: false,
    icons: {
      on: <Sun className="size-full" />,
      off: <Moon className="size-full" />,
    },
  },
}

export const Small: Story = {
  args: {
    size: 'sm',
    defaultChecked: true,
  },
}

export const Large: Story = {
  args: {
    size: 'lg',
    icons: {
      on: <Sun className="size-full" />,
      off: <Moon className="size-full" />,
    },
  },
}

export const Disabled: Story = {
  args: {
    disabled: true,
    checked: true,
  },
}
