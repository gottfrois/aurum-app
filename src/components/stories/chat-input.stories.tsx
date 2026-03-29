import type { Meta, StoryObj } from '@storybook/react-vite'
import { ChatInput } from '../chat/chat-input'

const meta = {
  title: 'Forms/ChatInput',
  component: ChatInput,
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
  args: {
    onSend: () => {},
  },
} satisfies Meta<typeof ChatInput>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Disabled: Story = {
  args: {
    disabled: true,
  },
}
