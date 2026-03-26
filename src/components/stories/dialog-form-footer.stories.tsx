import type { Meta, StoryObj } from '@storybook/react-vite'
import { DialogFormFooter } from '../dialog-form-footer'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { Input } from '../ui/input'

const meta = {
  title: 'Overlays/DialogFormFooter',
  component: DialogFormFooter,
  decorators: [
    (Story) => (
      <Dialog open>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Example Dialog</DialogTitle>
          </DialogHeader>
          <Input placeholder="Type something..." />
          <Story />
        </DialogContent>
      </Dialog>
    ),
  ],
  args: {
    onCancel: () => {},
    onConfirm: () => {},
  },
} satisfies Meta<typeof DialogFormFooter>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    disabled: false,
    saving: false,
    confirmLabel: 'Save',
  },
}

export const Saving: Story = {
  args: {
    disabled: true,
    saving: true,
    confirmLabel: 'Save',
  },
}

export const Disabled: Story = {
  args: {
    disabled: true,
    saving: false,
    confirmLabel: 'Create',
  },
}

export const CustomLabel: Story = {
  args: {
    disabled: false,
    saving: false,
    confirmLabel: 'Apply changes',
  },
}
