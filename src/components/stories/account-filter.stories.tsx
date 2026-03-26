import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { AccountFilter, type AccountOption } from '../account-filter'

const accounts: Array<AccountOption> = [
  { id: '1', label: 'Compte Courant BNP' },
  { id: '2', label: 'Livret A' },
  { id: '3', label: 'PEA Boursorama' },
  { id: '4', label: 'Assurance Vie Linxea' },
]

function AccountFilterDemo({
  initialSelected = new Set<string>(),
}: {
  initialSelected?: Set<string>
}) {
  const [selected, setSelected] = useState(initialSelected)
  return (
    <AccountFilter
      accounts={accounts}
      selected={selected}
      onChange={setSelected}
    />
  )
}

const meta = {
  title: 'Forms/AccountFilter',
  component: AccountFilterDemo,
} satisfies Meta<typeof AccountFilterDemo>

export default meta
type Story = StoryObj<typeof meta>

export const NoneSelected: Story = {}

export const WithSelection: Story = {
  args: {
    initialSelected: new Set(['1', '3']),
  },
}
