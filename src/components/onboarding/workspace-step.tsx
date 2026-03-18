import { useUser } from '@clerk/tanstack-react-start'
import { useMutation } from 'convex/react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { api } from '../../../convex/_generated/api'
import { StepLayout } from './step-layout'
import type { OnboardingStepProps } from './types'

export function WorkspaceStep({
  goToStep,
  setSubmitting,
}: OnboardingStepProps) {
  const { user } = useUser()
  const defaultName = user?.firstName
    ? `${user.firstName}'s workspace`
    : 'My Workspace'
  const [name, setName] = useState(defaultName)
  const [saving, setSaving] = useState(false)
  const createWorkspace = useMutation(api.onboarding.createWorkspaceOnboarding)

  async function handleNext() {
    setSaving(true)
    setSubmitting(true)
    try {
      await createWorkspace({ workspaceName: name })
      goToStep('invite')
    } catch (err) {
      toast.error('Failed to create workspace')
      console.error(err)
      setSaving(false)
      setSubmitting(false)
    }
  }

  return (
    <StepLayout
      title="Create your workspace"
      subtitle="Your workspace is where you manage your finances"
      onBack={() => goToStep('name')}
      onSubmit={handleNext}
      submitLabel="Continue"
      submitDisabled={!name.trim()}
      loading={saving}
    >
      <div className="grid gap-2">
        <Label htmlFor="workspace-name">Workspace name</Label>
        <Input
          id="workspace-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Workspace"
          autoFocus
        />
      </div>
    </StepLayout>
  )
}
