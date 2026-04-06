import { useClerk } from '@clerk/tanstack-react-start'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useConvexAuth, useMutation, useQuery } from 'convex/react'
import { Globe, Loader2, LogOut } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ConnectionStep } from '~/components/onboarding/connection-step'
import { InviteStep } from '~/components/onboarding/invite-step'
import { LegalStep } from '~/components/onboarding/legal-step'
import { NameStep } from '~/components/onboarding/name-step'
import { OnboardingFlow } from '~/components/onboarding/onboarding-flow'
import { PortfolioStep } from '~/components/onboarding/portfolio-step'
import type { OnboardingStepProps } from '~/components/onboarding/types'
import { VaultStep } from '~/components/onboarding/vault-step'
import { WorkspaceStep } from '~/components/onboarding/workspace-step'
import { Button } from '~/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '~/components/ui/select'
import { computeAllSteps, computeRemainingSteps } from '~/lib/onboarding'
import { api } from '../../convex/_generated/api'

export const Route = createFileRoute('/onboarding')({
  component: OnboardingPage,
})

function OnboardingPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { signOut } = useClerk()
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth()

  const onboardingState = useQuery(
    api.onboarding.getOnboardingState,
    isAuthenticated ? {} : 'skip',
  )
  const data = useQuery(
    api.onboarding.getOnboardingData,
    isAuthenticated ? {} : 'skip',
  )
  const completeOnboarding = useMutation(api.onboarding.completeOnboarding)

  // Redirect if onboarding is complete
  useEffect(() => {
    if (!isAuthenticated) return
    if (onboardingState === undefined) return
    if (onboardingState.status === 'complete') {
      void navigate({ to: '/' })
    }
  }, [isAuthenticated, onboardingState, navigate])

  // Compute steps from server state
  const allSteps = useMemo(() => {
    if (!data) return null
    return computeAllSteps(data)
  }, [data])

  const remainingSteps = useMemo(() => {
    if (!data) return null
    return computeRemainingSteps(data)
  }, [data])

  const initialStepId = remainingSteps?.[0] ?? null

  // Auto-complete when no remaining steps
  const autoCompleting = useRef(false)
  useEffect(() => {
    if (!remainingSteps || remainingSteps.length > 0 || autoCompleting.current)
      return
    if (data?.member) {
      autoCompleting.current = true
      completeOnboarding()
        .then(() => navigate({ to: '/' }))
        .catch(() => {
          autoCompleting.current = false
        })
    }
  }, [remainingSteps, data, completeOnboarding, navigate])

  const [consents, setConsents] = useState({
    tos: false,
    privacy: false,
    marketing: false,
  })
  const isInvited = data?.member?.role === 'member'

  function handleComplete() {
    completeOnboarding()
      .then(() => navigate({ to: '/' }))
      .catch(() => {})
  }

  const renderStep = useCallback(
    (stepId: string, stepProps: OnboardingStepProps) => {
      const props = { ...stepProps, isInvited: isInvited ?? false }
      switch (stepId) {
        case 'legal':
          return (
            <LegalStep
              {...props}
              consents={consents}
              onConsentsChange={setConsents}
            />
          )
        case 'name':
          return <NameStep {...props} />
        case 'workspace':
          return <WorkspaceStep {...props} />
        case 'invite':
          return <InviteStep {...props} />
        case 'vault':
          return <VaultStep {...props} />
        case 'portfolio':
          return <PortfolioStep {...props} />
        case 'connection':
          return <ConnectionStep {...props} />
        default:
          return null
      }
    },
    [isInvited, consents],
  )

  function handleSignOut() {
    void signOut({ redirectUrl: '/sign-in/' })
  }

  if (
    isAuthLoading ||
    onboardingState === undefined ||
    data === undefined ||
    !allSteps ||
    !initialStepId
  ) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center justify-center gap-2 md:justify-start">
            <img
              src="/icon-square.svg"
              alt="Bunkr"
              className="size-8 rounded"
            />
            <span className="text-xl font-bold">Bunkr</span>
          </div>
          <div className="flex items-center gap-1">
            <Select
              value={i18n.language}
              onValueChange={(v) => i18n.changeLanguage(v)}
            >
              <SelectTrigger
                size="sm"
                className="w-fit gap-1.5 border-none shadow-none focus:ring-0"
              >
                <Globe className="size-4" />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="fr">Français</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={handleSignOut}
            >
              <LogOut className="size-4" />
              <span className="hidden sm:inline">{t('common.logOut')}</span>
            </Button>
          </div>
        </div>

        {/* Stepper content */}
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">
            <OnboardingFlow
              allSteps={allSteps}
              initialStepId={initialStepId}
              onComplete={handleComplete}
              renderStep={renderStep}
            />
          </div>
        </div>
      </div>

      {/* Right column - marketing */}
      <div className="relative hidden bg-muted lg:block">
        <div className="absolute inset-0 flex items-center justify-center p-12">
          <div className="max-w-md space-y-4 text-center">
            <h2 className="text-3xl font-bold">{t('onboarding.hero.title')}</h2>
            <p className="text-lg text-muted-foreground">
              {t('onboarding.hero.description')}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
