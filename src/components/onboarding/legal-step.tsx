import { useMutation } from 'convex/react'
import { useState } from 'react'
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
      try {
        await updateStep({ step: 'name' })
      } catch {
        // Member record may not exist yet for new users
      }
      goToStep(isInvited ? 'vault' : 'name')
    } catch (err) {
      toast.error('Failed to save consents')
      console.error(err)
      setSaving(false)
      setSubmitting(false)
    }
  }

  return (
    <StepLayout
      title="Legal agreements"
      subtitle="Please review and accept the following to continue"
      onSubmit={handleNext}
      submitLabel="Continue"
      submitDisabled={!consents.tos || !consents.privacy}
      loading={saving}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="tos" className="flex-1 cursor-pointer">
            I accept the{' '}
            <a
              href="https://bunkr.io/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              Terms of Service
            </a>{' '}
            <span className="text-destructive">*</span>
          </Label>
          <Switch
            id="tos"
            checked={consents.tos}
            onCheckedChange={(tos) => onConsentsChange({ ...consents, tos })}
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="privacy" className="flex-1 cursor-pointer">
            I accept the{' '}
            <a
              href="https://bunkr.io/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              Privacy Policy
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
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="marketing" className="flex-1 cursor-pointer">
            I agree to receive marketing communications
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
