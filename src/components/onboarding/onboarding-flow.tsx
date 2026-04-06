import { useCallback, useEffect, useState } from 'react'
import type { StepId } from '~/lib/onboarding'
import { cn } from '~/lib/utils'
import type { OnboardingStepProps } from './types'

export interface OnboardingFlowProps {
  /** Full journey for dots (stable, role-based) */
  allSteps: StepId[]
  /** First uncompleted step to start on */
  initialStepId: StepId
  onComplete: () => void
  renderStep: (stepId: StepId, props: OnboardingStepProps) => React.ReactNode
}

export function OnboardingFlow({
  allSteps,
  initialStepId,
  onComplete,
  renderStep,
}: OnboardingFlowProps) {
  const [currentStepId, setCurrentStepId] = useState<StepId>(initialStepId)

  // When allSteps changes (phase transition), ensure currentStepId is valid
  useEffect(() => {
    if (!allSteps.includes(currentStepId)) {
      setCurrentStepId(initialStepId)
    }
  }, [allSteps, currentStepId, initialStepId])

  const currentIndex = allSteps.indexOf(currentStepId)

  const next = useCallback(() => {
    const idx = allSteps.indexOf(currentStepId)
    if (idx >= allSteps.length - 1) {
      onComplete()
      return
    }
    setCurrentStepId(allSteps[idx + 1])
  }, [allSteps, currentStepId, onComplete])

  const back = useCallback(() => {
    const idx = allSteps.indexOf(currentStepId)
    if (idx > 0) {
      setCurrentStepId(allSteps[idx - 1])
    }
  }, [allSteps, currentStepId])

  return (
    <div className="flex flex-col gap-8">
      {renderStep(currentStepId, {
        next,
        back: currentIndex > 0 ? back : undefined,
        isInvited: false,
      })}

      <div className="flex items-center justify-center gap-1.5">
        {allSteps.map((step, i) => (
          <div
            key={step}
            className={cn(
              'h-2 rounded-full transition-all duration-300',
              i === currentIndex ? 'w-8 bg-primary' : 'w-2 bg-primary/20',
            )}
          />
        ))}
      </div>
    </div>
  )
}
