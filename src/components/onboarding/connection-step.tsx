import { useNavigate } from '@tanstack/react-router'
import { useAction, useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { toast } from 'sonner'
import { api } from '../../../convex/_generated/api'
import { StepLayout } from './step-layout'
import type { OnboardingStepProps } from './types'

export function ConnectionStep({
  goToStep,
  setSubmitting,
}: OnboardingStepProps) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [skipping, setSkipping] = useState(false)
  const completeOnboarding = useMutation(api.onboarding.completeOnboarding)
  const portfolios = useQuery(api.portfolios.listPortfolios)
  const generateUrl = useAction(api.powens.generateConnectUrl)

  async function handleConnect() {
    if (!portfolios || portfolios.length === 0) return
    setLoading(true)
    setSubmitting(true)
    try {
      const url = await generateUrl({ portfolioId: portfolios[0]._id })
      window.location.href = url
    } catch (err) {
      toast.error('Failed to start bank connection')
      console.error(err)
      setLoading(false)
      setSubmitting(false)
    }
  }

  async function handleSkip() {
    setSkipping(true)
    setSubmitting(true)
    try {
      await completeOnboarding()
      void navigate({ to: '/' })
    } catch (err) {
      toast.error('Failed to complete onboarding')
      console.error(err)
      setSkipping(false)
      setSubmitting(false)
    }
  }

  return (
    <StepLayout
      title="Connect your bank"
      subtitle="Link your bank accounts to start tracking your finances automatically"
      onBack={() => goToStep('portfolio')}
      onSubmit={handleConnect}
      submitLabel="Connect bank"
      submitDisabled={!portfolios || portfolios.length === 0}
      loading={loading}
      onSkip={handleSkip}
      skipDisabled={skipping}
    />
  )
}
