import type { Meta, StoryObj } from '@storybook/react-vite'
import { ManualTransactionDialog } from '../manual-transaction-dialog'

const MOCK_ACCOUNTS = [
  { id: 'acc_1', label: 'Checking Account', portfolioId: 'portfolio_1' },
  { id: 'acc_2', label: 'Savings Account', portfolioId: 'portfolio_1' },
  { id: 'acc_3', label: 'Cash', portfolioId: 'portfolio_1' },
]

const MOCK_TRANSACTION = {
  _id: 'txn_1',
  bankAccountId: 'acc_1',
  portfolioId: 'portfolio_1',
  source: 'manual' as const,
  date: '2026-04-01',
  wording: 'Grocery shopping at Carrefour',
  value: -42.5,
  coming: false,
  category: 'food_and_restaurants',
  userCategoryKey: 'food_and_restaurants',
  comment: 'Weekly groceries',
}

const meta = {
  title: 'Overlays/ManualTransactionDialog',
  component: ManualTransactionDialog,
  // Requires ConvexProvider + EncryptionProvider — skip automated testing
  tags: ['!test'],
  args: {
    open: true,
    onOpenChange: () => {},
    portfolioId: 'portfolio_1' as never,
    accounts: MOCK_ACCOUNTS,
  },
} satisfies Meta<typeof ManualTransactionDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Create: Story = {
  args: {
    mode: 'create',
  },
}

export const CreateWithDefaultAccount: Story = {
  args: {
    mode: 'create',
    defaultBankAccountId: 'acc_2' as never,
  },
}

export const Edit: Story = {
  args: {
    mode: 'edit',
    transaction: MOCK_TRANSACTION,
  },
}
