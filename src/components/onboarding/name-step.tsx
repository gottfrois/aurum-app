import { useUser } from '@clerk/tanstack-react-start'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { StepLayout } from './step-layout'
import type { OnboardingStepProps } from './types'

export function NameStep({ goToStep, setSubmitting }: OnboardingStepProps) {
  const { t } = useTranslation()
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
      toast.error(t('toast.failedUpdateNameOnboarding'))
      console.error(err)
      setSaving(false)
      setSubmitting(false)
    }
  }

  return (
    <StepLayout
      title={t('onboarding.name.title')}
      subtitle={t('onboarding.name.subtitle')}
      onBack={() => goToStep('legal')}
      onSubmit={handleNext}
      submitLabel={t('common.continue')}
      submitDisabled={!firstName.trim()}
      loading={saving}
    >
      <div className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="firstName">
            {t('onboarding.name.firstNameLabel')}
          </Label>
          <Input
            id="firstName"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder={t('onboarding.name.firstNamePlaceholder')}
            autoFocus
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="lastName">{t('onboarding.name.lastNameLabel')}</Label>
          <Input
            id="lastName"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder={t('onboarding.name.lastNamePlaceholder')}
          />
        </div>
      </div>
    </StepLayout>
  )
}
