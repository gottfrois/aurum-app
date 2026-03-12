import { StripeSubscriptions } from '@convex-dev/stripe'
import { components } from './_generated/api'

export const stripe = new StripeSubscriptions(components.stripe, {})

/** Per-seat price in EUR cents */
export const SEAT_PRICES = {
  monthly: 900, // €9/month/seat
  yearly: 8900, // €89/year/seat (save ~18%)
} as const
