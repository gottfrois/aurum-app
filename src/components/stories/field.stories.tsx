import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
} from '../ui/field'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'

const meta = {
  title: 'Forms/Field',
  component: Field,
  decorators: [
    (Story) => (
      <div className="max-w-lg">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Field>

export default meta
type Story = StoryObj<typeof meta>

export const Vertical: Story = {
  render: () => (
    <FieldGroup>
      <Field orientation="vertical">
        <FieldLabel>Name</FieldLabel>
        <Input placeholder="Enter your name" />
      </Field>
      <Field orientation="vertical">
        <FieldLabel>Email</FieldLabel>
        <FieldContent>
          <Input type="email" placeholder="you@example.com" />
          <FieldDescription>We'll never share your email.</FieldDescription>
        </FieldContent>
      </Field>
    </FieldGroup>
  ),
}

export const Horizontal: Story = {
  render: () => (
    <FieldGroup>
      <Field orientation="horizontal">
        <FieldLabel>Username</FieldLabel>
        <Input placeholder="johndoe" />
      </Field>
      <Field orientation="horizontal">
        <FieldLabel>Bio</FieldLabel>
        <FieldContent>
          <Textarea placeholder="Tell us about yourself" />
          <FieldDescription>Max 160 characters.</FieldDescription>
        </FieldContent>
      </Field>
    </FieldGroup>
  ),
}

export const WithError: Story = {
  render: () => (
    <Field orientation="vertical" data-invalid="true">
      <FieldLabel>Password</FieldLabel>
      <FieldContent>
        <Input type="password" />
        <FieldError
          errors={[{ message: 'Password must be at least 8 characters' }]}
        />
      </FieldContent>
    </Field>
  ),
}

export const FieldSetExample: Story = {
  name: 'FieldSet with Legend',
  render: () => (
    <FieldSet>
      <FieldLegend>Account Settings</FieldLegend>
      <FieldDescription>Configure your account preferences.</FieldDescription>
      <FieldGroup>
        <Field>
          <FieldLabel>Display Name</FieldLabel>
          <Input defaultValue="John Doe" />
        </Field>
        <FieldSeparator>or</FieldSeparator>
        <Field>
          <FieldTitle>Notification Email</FieldTitle>
          <FieldContent>
            <Input type="email" defaultValue="john@example.com" />
            <FieldDescription>Separate from login email.</FieldDescription>
          </FieldContent>
        </Field>
      </FieldGroup>
    </FieldSet>
  ),
}
