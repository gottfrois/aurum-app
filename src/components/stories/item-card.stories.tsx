import type { Meta, StoryObj } from '@storybook/react-vite'
import { Building2, CreditCard, Wallet } from 'lucide-react'
import {
  ItemCard,
  ItemCardFooter,
  ItemCardHeader,
  ItemCardHeaderContent,
  ItemCardHeaderDescription,
  ItemCardHeaderTitle,
  ItemCardItem,
  ItemCardItemAction,
  ItemCardItemContent,
  ItemCardItemDescription,
  ItemCardItems,
  ItemCardItemTitle,
} from '../item-card'
import { Button } from '../ui/button'

const meta = {
  title: 'Data Display/ItemCard',
  component: ItemCard,
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ItemCard>

export default meta
type Story = StoryObj<typeof meta>

export const WithItems: Story = {
  render: () => (
    <ItemCard>
      <ItemCardHeader>
        <ItemCardHeaderContent>
          <ItemCardHeaderTitle>
            <Building2 className="size-4" />
            Checking Accounts
          </ItemCardHeaderTitle>
          <ItemCardHeaderDescription>3 accounts</ItemCardHeaderDescription>
        </ItemCardHeaderContent>
      </ItemCardHeader>
      <ItemCardItems>
        <ItemCardItem>
          <ItemCardItemContent>
            <ItemCardItemTitle>
              <CreditCard className="size-4" />
              Main Account
            </ItemCardItemTitle>
            <ItemCardItemDescription>FR76 •••• 4521</ItemCardItemDescription>
          </ItemCardItemContent>
          <ItemCardItemAction>
            <span className="font-medium">2 450,00 €</span>
          </ItemCardItemAction>
        </ItemCardItem>
        <ItemCardItem>
          <ItemCardItemContent>
            <ItemCardItemTitle>
              <Wallet className="size-4" />
              Savings
            </ItemCardItemTitle>
            <ItemCardItemDescription>FR76 •••• 8903</ItemCardItemDescription>
          </ItemCardItemContent>
          <ItemCardItemAction>
            <span className="font-medium">15 200,00 €</span>
          </ItemCardItemAction>
        </ItemCardItem>
      </ItemCardItems>
      <ItemCardFooter>
        <Button variant="ghost" size="sm">
          View all
        </Button>
      </ItemCardFooter>
    </ItemCard>
  ),
}

export const HeaderOnly: Story = {
  render: () => (
    <ItemCard>
      <ItemCardHeader>
        <ItemCardHeaderContent>
          <ItemCardHeaderTitle>Empty Section</ItemCardHeaderTitle>
          <ItemCardHeaderDescription>No items yet</ItemCardHeaderDescription>
        </ItemCardHeaderContent>
      </ItemCardHeader>
      <ItemCardItems>{/* empty */}</ItemCardItems>
    </ItemCard>
  ),
}
