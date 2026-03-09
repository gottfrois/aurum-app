import { Polar } from '@convex-dev/polar'
import { components } from './_generated/api'
import { action } from './_generated/server'
import type { DataModel } from './_generated/dataModel'
import type { QueryCtx } from './_generated/server'

export const polar = new Polar<DataModel>(components.polar, {
  getUserInfo: async (ctx) => {
    // The runtime ctx includes auth, but the Polar type narrows to RunQueryCtx.
    // Cast to access getUserIdentity as shown in the official docs.
    const identity = await (ctx as QueryCtx).auth.getUserIdentity()
    if (!identity) throw new Error('Unauthenticated')
    return { userId: identity.subject, email: identity.email ?? '' }
  },
  products: {
    soloMonthly: process.env.POLAR_SOLO_MONTHLY_ID!,
    soloYearly: process.env.POLAR_SOLO_YEARLY_ID!,
    teamMonthly: process.env.POLAR_TEAM_MONTHLY_ID!,
    teamYearly: process.env.POLAR_TEAM_YEARLY_ID!,
    familyMonthly: process.env.POLAR_FAMILY_MONTHLY_ID!,
    familyYearly: process.env.POLAR_FAMILY_YEARLY_ID!,
  },
})

/** Map product keys to their seat allowance */
export const PLAN_SEATS: Record<string, number> = {
  soloMonthly: 1,
  soloYearly: 1,
  teamMonthly: 3,
  teamYearly: 3,
  familyMonthly: 5,
  familyYearly: 5,
}

export const {
  changeCurrentSubscription,
  cancelCurrentSubscription,
  getConfiguredProducts,
  listAllProducts,
  listAllSubscriptions,
  generateCheckoutLink,
  generateCustomerPortalUrl,
} = polar.api()

export const syncProducts = action({
  args: {},
  handler: async (ctx) => {
    await polar.syncProducts(ctx)
  },
})
