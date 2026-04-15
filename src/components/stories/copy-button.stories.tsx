import type { Meta, StoryObj } from '@storybook/react-vite'
import { TooltipProvider } from '~/components/ui/tooltip'
import { CopyButton } from '../ui/copy-button'

const meta = {
  title: 'Elements/CopyButton',
  component: CopyButton,
  decorators: [
    (Story) => (
      <TooltipProvider>
        <Story />
      </TooltipProvider>
    ),
  ],
  args: {
    value: 'FR0000120404',
  },
} satisfies Meta<typeof CopyButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithCustomLabel: Story = {
  args: {
    label: 'Copy ISIN',
  },
}

export const InlineWithText: Story = {
  render: (args) => (
    <div className="group/copy flex items-center gap-1">
      <span className="font-mono text-sm">{args.value}</span>
      <CopyButton
        {...args}
        className="size-6 opacity-0 transition-opacity group-hover/copy:opacity-100 focus-visible:opacity-100"
        iconSize={12}
      />
      <span className="ml-2 text-xs text-muted-foreground">
        (hover to reveal)
      </span>
    </div>
  ),
}
