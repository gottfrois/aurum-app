import { StripeSubscriptions } from '@convex-dev/stripe'
import { components } from './_generated/api'

export const stripe = new StripeSubscriptions(components.stripe, {})

export const PLANS = {
  solo: {
    name: 'Solo',
    seats: 1,
    monthly: 900,
    yearly: 8900,
  },
  duo: {
    name: 'Duo',
    seats: 2,
    monthly: 1400,
    yearly: 13900,
  },
  family: {
    name: 'Family',
    seats: 5,
    monthly: 2900,
    yearly: 28900,
  },
} as const

export type PlanKey = keyof typeof PLANS
