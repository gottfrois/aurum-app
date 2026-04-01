import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { getAuthUserId, requireAuthUserId } from './lib/auth'

const SUPPORTED_LANGUAGES = ['en', 'fr'] as const

export const getLanguagePreference = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null

    const member = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()

    return member?.language ?? null
  },
})

export const setLanguagePreference = mutation({
  args: {
    language: v.string(),
  },
  handler: async (ctx, args) => {
    if (
      !SUPPORTED_LANGUAGES.includes(
        args.language as (typeof SUPPORTED_LANGUAGES)[number],
      )
    ) {
      throw new Error(`Unsupported language: ${args.language}`)
    }

    const userId = await requireAuthUserId(ctx)

    const member = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()

    if (!member) throw new Error('No workspace membership found')

    await ctx.db.patch('workspaceMembers', member._id, {
      language: args.language,
    })
  },
})
