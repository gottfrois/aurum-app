import { useUser } from '@clerk/tanstack-react-start'
import { useState } from 'react'
import { toast } from 'sonner'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { StepLayout } from './step-layout'
import type { OnboardingStepProps } from './types'

export function NameStep({ goToStep, setSubmitting }: OnboardingStepProps) {
  const { user } = useUser()
  const [firstName, setFirstName] = useState(user?.firstName ?? '')
  const [lastName, setLastName] = useState(user?.lastName ?? '')
  const [saving, setSaving] = useState(false)

  async function handleNext() {
    if (!user) return
    setSaving(true)
    setSubmitting(true)
    try {
      await user.update({ firstName, lastName })
      goToStep('workspace')
    } catch (err) {
      toast.error('Failed to update name')
      console.error(err)
      setSaving(false)
      setSubmitting(false)
    }
  }

  return (
    <StepLayout
      title="What's your name?"
      subtitle="Let us know what to call you"
      onBack={() => goToStep('legal')}
      onSubmit={handleNext}
      submitLabel="Continue"
      submitDisabled={!firstName.trim()}
      loading={saving}
    >
      <div className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="firstName">First name</Label>
          <Input
            id="firstName"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="First name"
            autoFocus
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="lastName">Last name</Label>
          <Input
            id="lastName"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Last name"
          />
        </div>
      </div>
    </StepLayout>
  )
}
