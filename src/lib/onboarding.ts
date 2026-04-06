export interface OnboardingData {
  hasConsents: boolean
  member: {
    role: 'owner' | 'member'
    onboardingStep: string | null
    hasPortfolio: boolean
  } | null
  hasEncryptionKey: boolean
}

export const STEP_IDS = [
  'legal',
  'name',
  'workspace',
  'invite',
  'vault',
  'portfolio',
  'connection',
] as const

export type StepId = (typeof STEP_IDS)[number]

/**
 * The FULL journey for this user type. Stable — doesn't change with completion state.
 * Used for dot count so the indicator never shrinks.
 *
 * - No membership: estimated owner journey (may change at phase transition)
 * - Member (invited): legal, vault, portfolio, connection
 * - Owner: legal, name, workspace, invite, vault, portfolio, connection
 */
export function computeAllSteps(data: OnboardingData): StepId[] {
  if (!data.member) {
    // Pre-membership — estimate full journey
    const steps: StepId[] = []
    if (!data.hasConsents) steps.push('legal')
    steps.push(
      'name',
      'workspace',
      'invite',
      'vault',
      'portfolio',
      'connection',
    )
    return steps
  }

  if (data.member.role === 'member') {
    return ['legal', 'vault', 'portfolio', 'connection']
  }

  return [
    'legal',
    'name',
    'workspace',
    'invite',
    'vault',
    'portfolio',
    'connection',
  ]
}

/**
 * Only REMAINING steps that still need completing.
 * Used to determine the initial step on load/refresh.
 */
export function computeRemainingSteps(data: OnboardingData): StepId[] {
  const hasMembership = data.member !== null
  const steps: StepId[] = []

  // Pre-membership steps
  if (!data.hasConsents) steps.push('legal')
  if (!hasMembership) steps.push('name')
  if (!hasMembership) steps.push('workspace')

  // Post-membership steps (only when user has a workspace)
  if (hasMembership && data.member) {
    if (
      data.member.role === 'owner' &&
      data.member.onboardingStep === 'invite'
    ) {
      steps.push('invite')
    }
    if (!data.hasEncryptionKey) steps.push('vault')
    if (!data.member.hasPortfolio) steps.push('portfolio')
    steps.push('connection')
  }

  return steps
}
