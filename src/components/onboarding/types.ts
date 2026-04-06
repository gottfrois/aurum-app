export interface OnboardingStepProps {
  next: () => void
  back?: () => void
  isInvited: boolean
}
