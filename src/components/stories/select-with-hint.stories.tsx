import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { SelectWithHint } from '../ui/select-with-hint'

const meta = {
  title: 'Forms/SelectWithHint',
  component: SelectWithHint,
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SelectWithHint>

export default meta
type Story = StoryObj<typeof meta>

const numberFormatOptions = [
  { value: 'auto', label: 'Auto', hint: '€1,234.56' },
  { value: 'en-US', label: 'en-US', hint: '€1,234.56' },
  { value: 'en-GB', label: 'en-GB', hint: '€1,234.56' },
  { value: 'fr-FR', label: 'fr-FR', hint: '1 234,56 €' },
  { value: 'de-DE', label: 'de-DE', hint: '1.234,56 €' },
  { value: 'es-ES', label: 'es-ES', hint: '1234,56 €' },
  { value: 'it-IT', label: 'it-IT', hint: '1.234,56 €' },
  { value: 'ja-JP', label: 'ja-JP', hint: '€1,234.56' },
]

export const NumberFormat: Story = {
  args: {
    value: 'auto',
    onValueChange: () => {},
    options: numberFormatOptions,
    ariaLabel: 'Number format',
  },
  render: (args) => {
    const [value, setValue] = useState(args.value)
    return <SelectWithHint {...args} value={value} onValueChange={setValue} />
  },
}

const currencyDisplayOptions = [
  { value: 'symbol', label: 'Symbol', hint: 'CA$1,234.56' },
  { value: 'narrowSymbol', label: 'Narrow symbol', hint: '$1,234.56' },
  { value: 'code', label: 'ISO code', hint: 'CAD 1,234.56' },
]

export const CurrencyDisplay: Story = {
  args: {
    value: 'symbol',
    onValueChange: () => {},
    options: currencyDisplayOptions,
    ariaLabel: 'Currency display',
  },
  render: (args) => {
    const [value, setValue] = useState(args.value)
    return <SelectWithHint {...args} value={value} onValueChange={setValue} />
  },
}

const negativeFormatOptions = [
  { value: 'standard', label: 'Minus sign', hint: '-€1,234.56' },
  { value: 'accounting', label: 'Parentheses', hint: '(€1,234.56)' },
]

export const NegativeFormat: Story = {
  args: {
    value: 'standard',
    onValueChange: () => {},
    options: negativeFormatOptions,
    ariaLabel: 'Negative numbers',
  },
  render: (args) => {
    const [value, setValue] = useState(args.value)
    return <SelectWithHint {...args} value={value} onValueChange={setValue} />
  },
}

const timezoneOptions = [
  { value: 'est', label: 'EST', hint: 'UTC-5' },
  { value: 'cst', label: 'CST', hint: 'UTC-6' },
  { value: 'pst', label: 'PST', hint: 'UTC-8' },
  { value: 'gmt', label: 'GMT', hint: 'UTC+0' },
  { value: 'cet', label: 'CET', hint: 'UTC+1' },
  { value: 'ist', label: 'IST', hint: 'UTC+5:30' },
  { value: 'jst', label: 'JST', hint: 'UTC+9' },
]

export const Timezone: Story = {
  args: {
    value: 'gmt',
    onValueChange: () => {},
    options: timezoneOptions,
    ariaLabel: 'Timezone',
  },
  render: (args) => {
    const [value, setValue] = useState(args.value)
    return <SelectWithHint {...args} value={value} onValueChange={setValue} />
  },
}

export const Disabled: Story = {
  args: {
    value: 'auto',
    onValueChange: () => {},
    options: numberFormatOptions,
    ariaLabel: 'Number format',
    disabled: true,
  },
}
