import type { Meta, StoryObj } from '@storybook/react-vite'
import { Wallet } from 'lucide-react'
import { Button } from '../ui/button'
import { PageHeader } from '../ui/page-header'

const meta = {
  title: 'Navigation/PageHeader',
  component: PageHeader,
  decorators: [
    (Story) => (
      <div className="max-w-3xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PageHeader>

export default meta
type Story = StoryObj<typeof meta>

export const TitleOnly: Story = {
  args: {
    title: 'Connections',
  },
}

export const WithDescription: Story = {
  args: {
    title: 'Connections',
    description: 'All bank connections across your portfolios.',
  },
}

export const WithAction: Story = {
  args: {
    title: 'Members',
    description: 'Manage who has access to your workspace.',
    action: <Button>Invite</Button>,
  },
}

export const WithOutlineAction: Story = {
  args: {
    title: 'Billing',
    description: 'Manage your plan and billing.',
    action: <Button variant="outline">Manage subscription</Button>,
  },
}

export const WithIcon: Story = {
  args: {
    title: 'My Portfolio',
    icon: (
      <div className="flex size-9 items-center justify-center rounded-full bg-primary/10">
        <Wallet className="size-5 text-primary" />
      </div>
    ),
  },
}
