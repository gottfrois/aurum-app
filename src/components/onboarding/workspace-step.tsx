import { useUser } from '@clerk/tanstack-react-start'
import { useMutation } from 'convex/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t, i18n } = useTranslation()
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
      await createWorkspace({ workspaceName: name, language: i18n.language })
      goToStep('invite')
    } catch (err) {
      toast.error(t('toast.failedCreateWorkspace'))
      console.error(err)
      setSaving(false)
      setSubmitting(false)
    }
  }

  return (
    <StepLayout
      title={t('onboarding.workspace.title')}
      subtitle={t('onboarding.workspace.subtitle')}
      onBack={() => goToStep('name')}
      onSubmit={handleNext}
      submitLabel={t('common.continue')}
      submitDisabled={!name.trim()}
      loading={saving}
    >
      <div className="grid gap-2">
        <Label htmlFor="workspace-name">
          {t('onboarding.workspace.nameLabel')}
        </Label>
        <Input
          id="workspace-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('onboarding.workspace.namePlaceholder')}
          autoFocus
        />
      </div>
    </StepLayout>
  )
}
