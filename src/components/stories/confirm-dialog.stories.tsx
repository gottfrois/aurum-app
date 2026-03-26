import type { Meta, StoryObj } from '@storybook/react-vite'
import { ConfirmDialog } from '../confirm-dialog'

const meta = {
  title: 'Feedback/ConfirmDialog',
  component: ConfirmDialog,
  args: {
    open: true,
    onOpenChange: () => {},
    onConfirm: () => {},
    loading: false,
  },
} satisfies Meta<typeof ConfirmDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Simple: Story = {
  args: {
    title: 'Delete transaction',
    description:
      'Are you sure you want to delete this transaction? This action cannot be undone.',
  },
}

export const WithConfirmValue: Story = {
  args: {
    title: 'Delete portfolio',
    description:
      'This will permanently delete all accounts, transactions, and data in this portfolio.',
    confirmValue: 'my-portfolio',
    confirmLabel: 'Delete portfolio',
  },
}

export const Loading: Story = {
  args: {
    title: 'Delete account',
    description: 'Are you sure you want to delete this account?',
    loading: true,
  },
}

export const CustomLabels: Story = {
  args: {
    title: 'Remove connection',
    description:
      'This will disconnect your bank and stop syncing transactions.',
    confirmLabel: 'Disconnect',
    cancelLabel: 'Keep connected',
  },
}
