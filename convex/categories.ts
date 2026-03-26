import { v } from 'convex/values'
import { internalMutation, mutation, query } from './_generated/server'
import { getAuthUserId, requireAuthUserId } from './lib/auth'

const DEFAULT_CATEGORIES = [
  {
    key: 'revenue',
    label: 'Revenue',
    color: 'hsl(142 71% 45%)',
    icon: 'Wallet',
    sortOrder: 0,
  },
  {
    key: 'food_and_restaurants',
    label: 'Food & Restaurants',
    color: 'hsl(25 95% 53%)',
    icon: 'Utensils',
    sortOrder: 1,
  },
  {
    key: 'housing',
    label: 'Housing',
    color: 'hsl(217 91% 60%)',
    icon: 'Home',
    sortOrder: 2,
  },
  {
    key: 'travel_and_transport',
    label: 'Travel & Transport',
    color: 'hsl(280 68% 60%)',
    icon: 'Bus',
    sortOrder: 3,
  },
  {
    key: 'shopping',
    label: 'Shopping',
    color: 'hsl(340 82% 52%)',
    icon: 'ShoppingBag',
    sortOrder: 4,
  },
  {
    key: 'leisure',
    label: 'Leisure',
    color: 'hsl(47 96% 53%)',
    icon: 'GraduationCap',
    sortOrder: 5,
  },
  {
    key: 'healthcare',
    label: 'Healthcare',
    color: 'hsl(0 84% 60%)',
    icon: 'Heart',
    sortOrder: 6,
  },
  {
    key: 'administration_and_taxes',
    label: 'Taxes & Admin',
    color: 'hsl(210 40% 50%)',
    icon: 'Landmark',
    sortOrder: 7,
  },
  {
    key: 'bank_insurances',
    label: 'Banks & Insurance',
    color: 'hsl(190 80% 42%)',
    icon: 'Building2',
    sortOrder: 8,
  },
  {
    key: 'household',
    label: 'Household',
    color: 'hsl(160 60% 45%)',
    icon: 'CreditCard',
    sortOrder: 9,
  },
  {
    key: 'loans',
    label: 'Loans',
    color: 'hsl(30 80% 55%)',
    icon: 'Banknote',
    sortOrder: 10,
  },
  {
    key: 'media_and_telecommunications',
    label: 'Media & Telecom',
    color: 'hsl(260 60% 55%)',
    icon: 'Phone',
    sortOrder: 11,
  },
  {
    key: 'others',
    label: 'Others',
    color: 'hsl(0 0% 55%)',
    icon: 'MoreHorizontal',
    sortOrder: 12,
  },
] as const

export const listCategories = query({
  args: {
    portfolioId: v.optional(v.id('portfolios')),
    includeAllPortfolios: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []

    const member = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!member) return []

    const all = await ctx.db
      .query('transactionCategories')
      .withIndex('by_workspaceId', (q) =>
        q.eq('workspaceId', member.workspaceId),
      )
      .collect()

    if (args.includeAllPortfolios) {
      return all
    }

    if (!args.portfolioId) {
      return all.filter((c) => !c.portfolioId)
    }

    const inherited = all.filter((c) => !c.portfolioId)
    const portfolioSpecific = all.filter(
      (c) => c.portfolioId === args.portfolioId,
    )
    return [...inherited, ...portfolioSpecific]
  },
})

export const listWorkspaceCategories = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []

    const member = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!member) return []

    const all = await ctx.db
      .query('transactionCategories')
      .withIndex('by_workspaceId', (q) =>
        q.eq('workspaceId', member.workspaceId),
      )
      .collect()

    return all.filter((c) => !c.portfolioId)
  },
})

export const seedDefaultCategories = internalMutation({
  args: { workspaceId: v.id('workspaces') },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('transactionCategories')
      .withIndex('by_workspaceId', (q) => q.eq('workspaceId', args.workspaceId))
      .first()
    if (existing) return

    for (const cat of DEFAULT_CATEGORIES) {
      await ctx.db.insert('transactionCategories', {
        workspaceId: args.workspaceId,
        key: cat.key,
        label: cat.label,
        color: cat.color,
        icon: cat.icon,
        builtIn: true,
        sortOrder: cat.sortOrder,
      })
    }
  },
})

export const createCategory = mutation({
  args: {
    portfolioId: v.optional(v.id('portfolios')),
    label: v.string(),
    description: v.optional(v.string()),
    color: v.string(),
    icon: v.optional(v.string()),
    parentKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx)
    const member = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()

    if (args.portfolioId) {
      const portfolio = await ctx.db.get('portfolios', args.portfolioId)
      if (
        !portfolio ||
        !member ||
        member.workspaceId !== portfolio.workspaceId
      ) {
        throw new Error('Not authorized')
      }
    } else {
      if (!member || member.role !== 'owner') {
        throw new Error('Only workspace owners can create workspace categories')
      }
    }

    if (!member) throw new Error('Not authorized')

    const key = args.label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')

    const existing = await ctx.db
      .query('transactionCategories')
      .withIndex('by_workspaceId_key', (q) =>
        q.eq('workspaceId', member.workspaceId).eq('key', key),
      )
      .first()
    if (existing) throw new Error('A category with this name already exists')

    return await ctx.db.insert('transactionCategories', {
      workspaceId: member.workspaceId,
      portfolioId: args.portfolioId,
      key,
      label: args.label,
      description: args.description,
      color: args.color,
      icon: args.icon,
      parentKey: args.parentKey,
      builtIn: false,
      createdAt: Date.now(),
    })
  },
})

export const updateCategory = mutation({
  args: {
    categoryId: v.id('transactionCategories'),
    label: v.optional(v.string()),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
    parentKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx)
    const member = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()

    const category = await ctx.db.get('transactionCategories', args.categoryId)
    if (!category) throw new Error('Category not found')

    if (category.portfolioId) {
      if (!member || member.workspaceId !== category.workspaceId) {
        throw new Error('Not authorized')
      }
    } else {
      if (
        !member ||
        member.workspaceId !== category.workspaceId ||
        member.role !== 'owner'
      ) {
        throw new Error('Only workspace owners can update workspace categories')
      }
    }

    const patch: Record<string, string | undefined> = {}
    if (args.label !== undefined) patch.label = args.label
    if (args.description !== undefined) patch.description = args.description
    if (args.color !== undefined) patch.color = args.color
    if (args.icon !== undefined) patch.icon = args.icon
    if (args.parentKey !== undefined) patch.parentKey = args.parentKey

    await ctx.db.patch('transactionCategories', args.categoryId, patch)
  },
})

export const deleteCategory = mutation({
  args: { categoryId: v.id('transactionCategories') },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx)
    const member = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()

    const category = await ctx.db.get('transactionCategories', args.categoryId)
    if (!category) throw new Error('Category not found')

    if (category.portfolioId) {
      if (!member || member.workspaceId !== category.workspaceId) {
        throw new Error('Not authorized')
      }
    } else {
      if (
        !member ||
        member.workspaceId !== category.workspaceId ||
        member.role !== 'owner'
      ) {
        throw new Error('Only workspace owners can delete workspace categories')
      }
    }

    if (category.builtIn) {
      throw new Error('Cannot delete built-in categories')
    }

    await ctx.db.delete('transactionCategories', args.categoryId)
  },
})

export const batchDeleteCategories = mutation({
  args: { categoryIds: v.array(v.id('transactionCategories')) },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx)
    const member = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!member) throw new Error('Not authorized')

    for (const categoryId of args.categoryIds) {
      const category = await ctx.db.get('transactionCategories', categoryId)
      if (!category || category.workspaceId !== member.workspaceId) continue
      if (category.builtIn) continue
      if (!category.portfolioId && member.role !== 'owner') continue

      await ctx.db.delete('transactionCategories', categoryId)
    }
  },
})
