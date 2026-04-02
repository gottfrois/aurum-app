import { useClerk } from '@clerk/tanstack-react-start'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAction, useConvexAuth, useQuery } from 'convex/react'
import { Globe, Loader2, LogOut } from 'lucide-react'
import { MotionConfig, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ConnectionStep } from '~/components/onboarding/connection-step'
import { InviteStep } from '~/components/onboarding/invite-step'
import { LegalStep } from '~/components/onboarding/legal-step'
import { NameStep } from '~/components/onboarding/name-step'
import { PortfolioStep } from '~/components/onboarding/portfolio-step'
import { VaultStep } from '~/components/onboarding/vault-step'
import { WorkspaceStep } from '~/components/onboarding/workspace-step'
import { Button } from '~/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '~/components/ui/select'
import { cn } from '~/lib/utils'
import { api } from '../../convex/_generated/api'

export const Route = createFileRoute('/onboarding')({
  component: OnboardingPage,
})

const NEW_USER_STEPS = [
  'legal',
  'name',
  'workspace',
  'invite',
  'vault',
  'portfolio',
  'connection',
] as const
const INVITED_USER_STEPS = [
  'legal',
  'vault',
  'portfolio',
  'connection',
] as const

type Step = (typeof NEW_USER_STEPS)[number]

function OnboardingPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { signOut } = useClerk()
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth()

  const onboardingState = useQuery(
    api.onboarding.getOnboardingState,
    isAuthenticated ? {} : 'skip',
  )

  const checkInvitation = useAction(api.onboarding.checkAndAcceptInvitation)
  const [isInvited, setIsInvited] = useState<boolean | null>(null)
  const [, setSubmitting] = useState(false)
  const [consents, setConsents] = useState({
    tos: false,
    privacy: false,
    marketing: false,
  })
  const checkedRef = useRef(false)

  // Animation state — exactly like the multi-step-form original
  const [currentStep, setCurrentStep] = useState(0)
  const [direction, setDirection] = useState<number>(1)

  // Check for pending invitations on first load
  useEffect(() => {
    if (!isAuthenticated || checkedRef.current) return
    if (onboardingState === undefined) return
    if (onboardingState.status === 'complete') {
      void navigate({ to: '/' })
      return
    }

    checkedRef.current = true
    checkInvitation()
      .then((result) => {
        setIsInvited(result.accepted)
      })
      .catch(() => {
        setIsInvited(false)
      })
  }, [isAuthenticated, onboardingState, checkInvitation, navigate])

  const steps: ReadonlyArray<string> = isInvited
    ? INVITED_USER_STEPS
    : NEW_USER_STEPS

  function goToStep(nextStep: string) {
    const toIndex = steps.indexOf(nextStep)
    if (toIndex === -1) return
    setDirection(toIndex > currentStep ? 1 : -1)
    setCurrentStep(toIndex)
  }

  function handleSignOut() {
    void signOut({ redirectUrl: '/sign-in/' })
  }

  const stepName = steps[currentStep] as Step
  const stepProps = { goToStep, setSubmitting, isInvited: isInvited ?? false }

  function renderStep() {
    switch (stepName) {
      case 'legal':
        return (
          <LegalStep
            {...stepProps}
            consents={consents}
            onConsentsChange={setConsents}
          />
        )
      case 'name':
        return <NameStep {...stepProps} />
      case 'workspace':
        return <WorkspaceStep {...stepProps} />
      case 'invite':
        return <InviteStep {...stepProps} />
      case 'vault':
        return <VaultStep {...stepProps} />
      case 'portfolio':
        return <PortfolioStep {...stepProps} />
      case 'connection':
        return <ConnectionStep {...stepProps} />
      default:
        return null
    }
  }

  if (isAuthLoading || onboardingState === undefined || isInvited === null) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const variants = {
    initial: (d: number) => ({ x: d * 60, opacity: 0 }),
    animate: { x: 0, opacity: 1 },
  }

  return (
    <MotionConfig transition={{ duration: 0.5, type: 'spring', bounce: 0 }}>
      <div className="grid min-h-svh lg:grid-cols-2">
        <div className="flex flex-col gap-4 p-6 md:p-10">
          {/* Header: logo left, logout right */}
          <div className="flex items-center justify-between">
            <div className="flex items-center justify-center gap-2 md:justify-start">
              <img src="/icon.svg" alt="Bunkr" className="size-8 rounded" />
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

          <div className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-xs">
              {/* Animated step content */}
              <motion.div
                key={currentStep}
                variants={variants}
                initial="initial"
                animate="animate"
                custom={direction}
              >
                {renderStep()}
              </motion.div>

              {/* Step indicator dots */}
              <div className="mt-8 flex items-center justify-center gap-1.5">
                {steps.map((s, i) => (
                  <div
                    key={s}
                    className={cn(
                      'h-2 rounded-full transition-all duration-300',
                      currentStep === i
                        ? 'w-8 bg-primary'
                        : 'w-2 bg-primary/20',
                    )}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right column - marketing */}
        <div className="relative hidden bg-muted lg:block">
          <div className="absolute inset-0 flex items-center justify-center p-12">
            <div className="max-w-md space-y-4 text-center">
              <h2 className="text-3xl font-bold">
                {t('onboarding.hero.title')}
              </h2>
              <p className="text-lg text-muted-foreground">
                {t('onboarding.hero.description')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </MotionConfig>
  )
}
