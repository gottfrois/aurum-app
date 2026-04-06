import { describe, expect, it } from 'vitest'
import {
  computeAllSteps,
  computeRemainingSteps,
  type OnboardingData,
} from '../onboarding'

function makeData(overrides: Partial<OnboardingData> = {}): OnboardingData {
  return {
    hasConsents: false,
    member: null,
    hasEncryptionKey: false,
    ...overrides,
  }
}

describe('computeAllSteps', () => {
  it('returns estimated full owner journey for new user without membership', () => {
    expect(computeAllSteps(makeData())).toEqual([
      'legal',
      'name',
      'workspace',
      'invite',
      'vault',
      'portfolio',
      'connection',
    ])
  })

  it('skips legal for returning user with consents but no membership', () => {
    expect(computeAllSteps(makeData({ hasConsents: true }))).toEqual([
      'name',
      'workspace',
      'invite',
      'vault',
      'portfolio',
      'connection',
    ])
  })

  it('returns member journey for invited user', () => {
    expect(
      computeAllSteps(
        makeData({
          member: {
            role: 'member',
            onboardingStep: 'vault',
            hasPortfolio: false,
          },
        }),
      ),
    ).toEqual(['legal', 'vault', 'portfolio', 'connection'])
  })

  it('returns full owner journey for workspace owner', () => {
    expect(
      computeAllSteps(
        makeData({
          member: {
            role: 'owner',
            onboardingStep: 'invite',
            hasPortfolio: false,
          },
        }),
      ),
    ).toEqual([
      'legal',
      'name',
      'workspace',
      'invite',
      'vault',
      'portfolio',
      'connection',
    ])
  })

  it('member journey is stable regardless of completion state', () => {
    const withConsents = computeAllSteps(
      makeData({
        hasConsents: true,
        member: {
          role: 'member',
          onboardingStep: 'portfolio',
          hasPortfolio: false,
        },
        hasEncryptionKey: true,
      }),
    )
    const withoutConsents = computeAllSteps(
      makeData({
        member: {
          role: 'member',
          onboardingStep: 'vault',
          hasPortfolio: false,
        },
      }),
    )
    expect(withConsents).toEqual(withoutConsents)
  })
})

describe('computeRemainingSteps', () => {
  it('returns pre-membership steps for new user', () => {
    expect(computeRemainingSteps(makeData())).toEqual([
      'legal',
      'name',
      'workspace',
    ])
  })

  it('skips legal when consents accepted', () => {
    expect(computeRemainingSteps(makeData({ hasConsents: true }))).toEqual([
      'name',
      'workspace',
    ])
  })

  it('returns remaining steps for member with no key', () => {
    expect(
      computeRemainingSteps(
        makeData({
          member: {
            role: 'member',
            onboardingStep: 'vault',
            hasPortfolio: false,
          },
        }),
      ),
    ).toEqual(['legal', 'vault', 'portfolio', 'connection'])
  })

  it('skips vault when member has encryption key', () => {
    expect(
      computeRemainingSteps(
        makeData({
          hasConsents: true,
          member: {
            role: 'member',
            onboardingStep: 'portfolio',
            hasPortfolio: false,
          },
          hasEncryptionKey: true,
        }),
      ),
    ).toEqual(['portfolio', 'connection'])
  })

  it('returns only connection when everything else is done', () => {
    expect(
      computeRemainingSteps(
        makeData({
          hasConsents: true,
          member: {
            role: 'member',
            onboardingStep: 'connection',
            hasPortfolio: true,
          },
          hasEncryptionKey: true,
        }),
      ),
    ).toEqual(['connection'])
  })

  it('includes invite for owner at invite step', () => {
    expect(
      computeRemainingSteps(
        makeData({
          hasConsents: true,
          member: {
            role: 'owner',
            onboardingStep: 'invite',
            hasPortfolio: false,
          },
        }),
      ),
    ).toEqual(['invite', 'vault', 'portfolio', 'connection'])
  })

  it('returns empty array when all steps satisfied (connection always present with membership)', () => {
    const steps = computeRemainingSteps(
      makeData({
        hasConsents: true,
        member: {
          role: 'owner',
          onboardingStep: 'complete',
          hasPortfolio: true,
        },
        hasEncryptionKey: true,
      }),
    )
    expect(steps).toEqual(['connection'])
  })
})
