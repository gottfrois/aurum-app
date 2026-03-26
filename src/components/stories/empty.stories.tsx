import type { Meta, StoryObj } from '@storybook/react-vite'
import { Inbox, Search } from 'lucide-react'
import { Button } from '../ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '../ui/empty'

const meta = {
  title: 'Feedback/Empty',
  component: Empty,
  decorators: [
    (Story) => (
      <div className="max-w-lg">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Empty>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Inbox />
        </EmptyMedia>
        <EmptyTitle>No transactions</EmptyTitle>
        <EmptyDescription>
          Connect a bank account to start tracking your transactions.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button>Connect a bank</Button>
      </EmptyContent>
    </Empty>
  ),
}

export const SearchEmpty: Story = {
  render: () => (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Search />
        </EmptyMedia>
        <EmptyTitle>No results found</EmptyTitle>
        <EmptyDescription>
          Try adjusting your search or filter to find what you're looking for.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  ),
}

export const Minimal: Story = {
  render: () => (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>Nothing here yet</EmptyTitle>
        <EmptyDescription>
          Items will appear once they're created.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  ),
}
