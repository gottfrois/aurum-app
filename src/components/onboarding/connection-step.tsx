import { useNavigate } from '@tanstack/react-router'
import { useAction, useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '../../../convex/_generated/api'
import { StepLayout } from './step-layout'
import type { OnboardingStepProps } from './types'

export function ConnectionStep({ back }: OnboardingStepProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [skipping, setSkipping] = useState(false)
  const completeOnboarding = useMutation(api.onboarding.completeOnboarding)
  const portfolios = useQuery(api.portfolios.listPortfolios)
  const generateUrl = useAction(api.powens.generateConnectUrl)

  async function handleConnect() {
    if (!portfolios || portfolios.length === 0) return
    setLoading(true)
    try {
      const url = await generateUrl({ portfolioId: portfolios[0]._id })
      window.location.href = url
    } catch (err) {
      toast.error(t('toast.failedBankConnection'))
      console.error(err)
      setLoading(false)
    }
  }

  async function handleSkip() {
    setSkipping(true)
    try {
      await completeOnboarding()
      void navigate({ to: '/' })
    } catch (err) {
      toast.error(t('toast.failedCompleteOnboarding'))
      console.error(err)
      setSkipping(false)
    }
  }

  return (
    <StepLayout
      title={t('onboarding.connection.title')}
      subtitle={t('onboarding.connection.subtitle')}
      onBack={back}
      onSubmit={handleConnect}
      submitLabel={t('button.connectBank')}
      submitDisabled={!portfolios || portfolios.length === 0}
      loading={loading}
      onSkip={handleSkip}
      skipDisabled={skipping}
    />
  )
}
