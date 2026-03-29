import type { Meta, StoryObj } from '@storybook/react-vite'
import { BotMessageSquare } from 'lucide-react'
import {
  type ChatConversation,
  type ChatMessage,
  ChatProvider,
  useChatDispatch,
  useChatState,
  useMinimizedConversations,
} from '../../contexts/chat-context'
import { ChatConversationTab } from '../chat/chat-conversation-tab'
import { ChatPanel } from '../chat/chat-panel'
import { Button } from '../ui/button'

// --- Mock data ---

const NOW = Date.now()

const mockMessages: ChatMessage[] = [
  {
    id: '1',
    role: 'user',
    content: "What's my net worth?",
    createdAt: NOW - 60000,
  },
  {
    id: '2',
    role: 'assistant',
    content:
      'Your net worth across all portfolios is currently €47,830, up 2.3% from last month.',
    createdAt: NOW - 55000,
  },
  {
    id: '3',
    role: 'user',
    content: 'How about my spending this month?',
    createdAt: NOW - 30000,
  },
  {
    id: '4',
    role: 'assistant',
    content:
      'Your total spending this month is approximately €3,240. The largest categories are Housing (€1,200), Groceries (€480), and Transportation (€320).',
    createdAt: NOW - 25000,
  },
]

const mockConversation: ChatConversation = {
  id: 'conv-1',
  title: "What's my net worth?",
  messages: mockMessages,
  createdAt: NOW - 60000,
}

const emptyConversation: ChatConversation = {
  id: 'conv-empty',
  title: 'New chat',
  messages: [],
  createdAt: NOW,
}

const mockMinimizedConversations: ChatConversation[] = [
  {
    id: 'conv-min-1',
    title: 'Spending analysis',
    messages: [
      {
        id: 'm1',
        role: 'user',
        content: 'Analyze my spending',
        createdAt: NOW - 120000,
      },
    ],
    createdAt: NOW - 120000,
  },
  {
    id: 'conv-min-2',
    title: 'Investment performance',
    messages: [
      {
        id: 'm2',
        role: 'user',
        content: 'How are my investments?',
        createdAt: NOW - 90000,
      },
    ],
    createdAt: NOW - 90000,
  },
]

// --- Stories ---

const meta = {
  title: 'Overlays/ChatPanel',
  component: ChatPanel,
} satisfies Meta<typeof ChatPanel>

export default meta
type Story = StoryObj<typeof meta>

export const EmptyState: Story = {
  decorators: [
    (Story) => (
      <ChatProvider
        initialState={{
          conversations: [emptyConversation],
          activeConversationId: 'conv-empty',
          panelMode: 'popover',
          minimizedConversationIds: [],
        }}
      >
        <div className="relative h-[700px] w-[500px]">
          <Story />
        </div>
      </ChatProvider>
    ),
  ],
}

export const WithMessages: Story = {
  decorators: [
    (Story) => (
      <ChatProvider
        initialState={{
          conversations: [mockConversation],
          activeConversationId: 'conv-1',
          panelMode: 'popover',
          minimizedConversationIds: [],
        }}
      >
        <div className="relative h-[700px] w-[500px]">
          <Story />
        </div>
      </ChatProvider>
    ),
  ],
}

export const ExpandedEmpty: Story = {
  decorators: [
    (Story) => (
      <ChatProvider
        initialState={{
          conversations: [emptyConversation],
          activeConversationId: 'conv-empty',
          panelMode: 'expanded',
          minimizedConversationIds: [],
        }}
      >
        <div className="flex h-[600px] w-full">
          <Story />
        </div>
      </ChatProvider>
    ),
  ],
}

export const ExpandedWithMessages: Story = {
  decorators: [
    (Story) => (
      <ChatProvider
        initialState={{
          conversations: [mockConversation],
          activeConversationId: 'conv-1',
          panelMode: 'expanded',
          minimizedConversationIds: [],
        }}
      >
        <div className="flex h-[600px] w-full">
          <Story />
        </div>
      </ChatProvider>
    ),
  ],
}

// --- Conversation Tabs story ---

function ConversationTabsDemo() {
  const minimized = useMinimizedConversations()
  const dispatch = useChatDispatch()

  return (
    <footer className="flex h-14 items-center border-t bg-background">
      <div className="flex w-full items-center justify-end gap-2 px-4">
        {minimized.map((conv) => (
          <ChatConversationTab
            key={conv.id}
            conversation={conv}
            onOpen={() => dispatch.openConversation(conv.id)}
            onClose={() => dispatch.closeConversation(conv.id)}
          />
        ))}
        <Button variant="ghost" size="sm" onClick={dispatch.openNewChat}>
          <BotMessageSquare className="size-4" />
          Ask Bunkr...
        </Button>
      </div>
    </footer>
  )
}

export const ConversationTabs: Story = {
  render: () => <ConversationTabsDemo />,
  decorators: [
    (Story) => (
      <ChatProvider
        initialState={{
          conversations: mockMinimizedConversations,
          activeConversationId: null,
          panelMode: 'closed',
          minimizedConversationIds: ['conv-min-1', 'conv-min-2'],
        }}
      >
        <Story />
      </ChatProvider>
    ),
  ],
}

// --- Interactive story ---

function InteractiveDemo() {
  const { panelMode } = useChatState()
  const minimized = useMinimizedConversations()
  const dispatch = useChatDispatch()

  return (
    <div className="relative flex h-[700px] w-full flex-col border">
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        {panelMode === 'expanded' ? <ChatPanel /> : <p>Main content area</p>}
      </div>
      <footer className="flex h-14 shrink-0 items-center border-t">
        <div className="flex w-full items-center justify-end gap-2 px-4">
          {minimized.map((conv) => (
            <ChatConversationTab
              key={conv.id}
              conversation={conv}
              onOpen={() => dispatch.openConversation(conv.id)}
              onClose={() => dispatch.closeConversation(conv.id)}
            />
          ))}
          <Button variant="ghost" size="sm" onClick={dispatch.openNewChat}>
            <BotMessageSquare className="size-4" />
            Ask Bunkr...
          </Button>
        </div>
      </footer>
      {panelMode === 'popover' && <ChatPanel />}
    </div>
  )
}

export const Interactive: Story = {
  render: () => <InteractiveDemo />,
  decorators: [
    (Story) => (
      <ChatProvider>
        <Story />
      </ChatProvider>
    ),
  ],
}
