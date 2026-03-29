import type { Meta, StoryObj } from '@storybook/react-vite'
import { ChatMessage } from '../chat/chat-message'

const meta = {
  title: 'Data Display/ChatMessage',
  component: ChatMessage,
  decorators: [
    (Story) => (
      <div className="max-w-md p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ChatMessage>

export default meta
type Story = StoryObj<typeof meta>

export const UserMessage: Story = {
  args: {
    message: {
      id: '1',
      role: 'user',
      content: "What's my net worth?",
      createdAt: Date.now(),
    },
  },
}

export const AssistantMessage: Story = {
  args: {
    message: {
      id: '2',
      role: 'assistant',
      content:
        'Your net worth across all portfolios is currently €47,830, up 2.3% from last month. Your investment portfolio has grown by €1,120 this quarter.',
      createdAt: Date.now(),
    },
  },
}

export const LongMessage: Story = {
  args: {
    message: {
      id: '3',
      role: 'assistant',
      content:
        "Based on your recent transactions, your total spending this month is approximately €3,240. The largest categories are:\n\n• Housing: €1,200\n• Groceries: €480\n• Transportation: €320\n• Dining out: €280\n• Entertainment: €190\n\nCompared to last month, you've reduced spending in Transportation by 12% but increased Dining out by 15%. Your savings rate this month is 22%, which is above your 3-month average of 18%.",
      createdAt: Date.now(),
    },
  },
}

export const ShortMessage: Story = {
  args: {
    message: {
      id: '4',
      role: 'user',
      content: 'Thanks!',
      createdAt: Date.now(),
    },
  },
}
