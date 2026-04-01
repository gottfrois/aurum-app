import { useAction, useMutation } from 'convex/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Label } from '~/components/ui/label'
import { api } from '../../../convex/_generated/api'
import { StepLayout } from './step-layout'
import type { OnboardingStepProps } from './types'

export function InviteStep({ goToStep, setSubmitting }: OnboardingStepProps) {
  const { t } = useTranslation()
  const [emails, setEmails] = useState('')
  const [saving, setSaving] = useState(false)
  const [skipping, setSkipping] = useState(false)
  const sendInvitation = useAction(api.members.sendInvitation)
  const updateStep = useMutation(api.onboarding.updateOnboardingStep)

  async function handleNext() {
    const emailList = emails
      .split(/[,\n]/)
      .map((e) => e.trim())
      .filter(Boolean)

    setSaving(true)
    setSubmitting(true)
    try {
      if (emailList.length > 0) {
        await sendInvitation({ emails: emailList })
      }
      await updateStep({ step: 'vault' })
      goToStep('vault')
    } catch (err) {
      toast.error(t('toast.failedSendInvitationsOnboarding'))
      console.error(err)
      setSaving(false)
      setSubmitting(false)
    }
  }

  async function handleSkip() {
    setSkipping(true)
    setSubmitting(true)
    try {
      await updateStep({ step: 'vault' })
      goToStep('vault')
    } catch {
      setSkipping(false)
      setSubmitting(false)
    }
  }

  return (
    <StepLayout
      title={t('onboarding.invite.title')}
      subtitle={t('onboarding.invite.subtitle')}
      onBack={() => goToStep('workspace')}
      onSubmit={handleNext}
      submitLabel={t('button.sendInvites')}
      submitDisabled={!emails.trim()}
      loading={saving}
      onSkip={handleSkip}
      skipDisabled={skipping}
    >
      <div className="grid gap-2">
        <Label htmlFor="emails">{t('onboarding.invite.emailLabel')}</Label>
        <textarea
          id="emails"
          className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          value={emails}
          onChange={(e) => setEmails(e.target.value)}
          placeholder={t('onboarding.invite.emailPlaceholder')}
        />
      </div>
    </StepLayout>
  )
}
