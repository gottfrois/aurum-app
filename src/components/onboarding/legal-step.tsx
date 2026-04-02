import { useMutation } from 'convex/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Label } from '~/components/ui/label'
import { Switch } from '~/components/ui/switch'
import { api } from '../../../convex/_generated/api'
import { StepLayout } from './step-layout'
import type { OnboardingStepProps } from './types'

interface Consents {
  tos: boolean
  privacy: boolean
  marketing: boolean
}

interface LegalStepProps extends OnboardingStepProps {
  consents: Consents
  onConsentsChange: (consents: Consents) => void
}

export function LegalStep({
  goToStep,
  setSubmitting,
  isInvited,
  consents,
  onConsentsChange,
}: LegalStepProps) {
  const { t } = useTranslation()
  const [saving, setSaving] = useState(false)
  const saveConsents = useMutation(api.onboarding.saveConsents)
  const updateStep = useMutation(api.onboarding.updateOnboardingStep)

  async function handleNext() {
    setSaving(true)
    setSubmitting(true)
    try {
      await saveConsents({
        termsOfService: consents.tos,
        privacyPolicy: consents.privacy,
        marketingCommunications: consents.marketing,
      })
      await updateStep({ step: 'name' })
      goToStep(isInvited ? 'vault' : 'name')
    } catch (err) {
      toast.error(t('toast.failedSaveConsents'))
      console.error(err)
      setSaving(false)
      setSubmitting(false)
    }
  }

  return (
    <StepLayout
      title={t('onboarding.legal.title')}
      subtitle={t('onboarding.legal.subtitle')}
      onSubmit={handleNext}
      submitLabel={t('common.continue')}
      submitDisabled={!consents.tos || !consents.privacy}
      loading={saving}
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <Label
            htmlFor="tos"
            className="inline flex-1 cursor-pointer leading-snug"
          >
            {
              t('onboarding.legal.tosLabel').split(
                t('onboarding.legal.tosLink'),
              )[0]
            }
            <a
              href="https://bunkr.io/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              {t('onboarding.legal.tosLink')}
            </a>{' '}
            <span className="text-destructive">*</span>
          </Label>
          <Switch
            id="tos"
            checked={consents.tos}
            onCheckedChange={(tos) => onConsentsChange({ ...consents, tos })}
          />
        </div>
        <div className="flex items-start justify-between gap-4">
          <Label
            htmlFor="privacy"
            className="inline flex-1 cursor-pointer leading-snug"
          >
            {
              t('onboarding.legal.privacyLabel').split(
                t('onboarding.legal.privacyLink'),
              )[0]
            }
            <a
              href="https://bunkr.io/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              {t('onboarding.legal.privacyLink')}
            </a>{' '}
            <span className="text-destructive">*</span>
          </Label>
          <Switch
            id="privacy"
            checked={consents.privacy}
            onCheckedChange={(privacy) =>
              onConsentsChange({ ...consents, privacy })
            }
          />
        </div>
        <div className="flex items-start justify-between gap-4">
          <Label
            htmlFor="marketing"
            className="inline flex-1 cursor-pointer leading-snug"
          >
            {t('onboarding.legal.marketingLabel')}
          </Label>
          <Switch
            id="marketing"
            checked={consents.marketing}
            onCheckedChange={(marketing) =>
              onConsentsChange({ ...consents, marketing })
            }
          />
        </div>
      </div>
    </StepLayout>
  )
}
