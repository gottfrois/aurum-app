import type { Meta, StoryObj } from '@storybook/react-vite'
import { PrivacyProvider } from '~/contexts/privacy-context'
import { WinnersLosers } from '../winners-losers'

const meta = {
  title: 'Data Display/WinnersLosers',
  component: WinnersLosers,
  decorators: [
    (Story) => (
      <PrivacyProvider>
        <div className="max-w-2xl">
          <Story />
        </div>
      </PrivacyProvider>
    ),
  ],
  args: {
    currency: 'EUR',
  },
} satisfies Meta<typeof WinnersLosers>

export default meta
type Story = StoryObj<typeof meta>

const investments = [
  {
    _id: '1',
    label: 'Apple Inc.',
    code: 'AAPL',
    valuation: 15200,
    diff: 3200,
    diffPercent: 26.7,
  },
  {
    _id: '2',
    label: 'MSCI World ETF',
    code: 'CW8',
    valuation: 42000,
    diff: 5600,
    diffPercent: 15.4,
  },
  {
    _id: '3',
    label: 'Tesla Inc.',
    code: 'TSLA',
    valuation: 8400,
    diff: -2100,
    diffPercent: -20.0,
  },
  {
    _id: '4',
    label: 'Nvidia Corp.',
    code: 'NVDA',
    valuation: 22000,
    diff: 8000,
    diffPercent: 57.1,
  },
  {
    _id: '5',
    label: 'BNP Paribas',
    code: 'BNP',
    valuation: 5600,
    diff: -800,
    diffPercent: -12.5,
  },
  {
    _id: '6',
    label: 'Amundi PEA',
    code: 'PE500',
    valuation: 12000,
    diff: 1200,
    diffPercent: 11.1,
  },
]

export const Default: Story = {
  args: { investments },
}

export const OnlyWinners: Story = {
  args: {
    investments: investments.filter((i) => (i.diffPercent ?? 0) > 0),
  },
}

export const OnlyLosers: Story = {
  args: {
    investments: investments.filter((i) => (i.diffPercent ?? 0) < 0),
  },
}

export const Empty: Story = {
  args: { investments: [] },
}
