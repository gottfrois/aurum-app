export interface OnboardingStepProps {
  goToStep: (step: string) => void
  setSubmitting: (v: boolean) => void
  isInvited: boolean
  isFirstStep?: boolean
}
