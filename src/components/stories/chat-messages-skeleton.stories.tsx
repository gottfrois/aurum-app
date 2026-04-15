import type { Meta, StoryObj } from '@storybook/react-vite'
import { ChatMessagesSkeleton } from '../chat/chat-messages-skeleton'

const meta = {
  title: 'Feedback/ChatMessagesSkeleton',
  component: ChatMessagesSkeleton,
  decorators: [
    (Story) => (
      <div className="flex h-[500px] max-w-md flex-col border">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ChatMessagesSkeleton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
