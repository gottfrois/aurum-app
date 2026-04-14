/**
 * RAG (Retrieval-Augmented Generation) wiring for the Bunkr agent.
 *
 * Indexes plaintext workspace entities — categories, labels, rules — into a
 * workspace-scoped RAG namespace so the agent's `semantic_search` primitive
 * can answer fuzzy phrasing ("the label I use for subscriptions", "that rule
 * about Uber"). Transactions are NOT indexed here because their descriptions
 * are E2E-encrypted; fuzzy transaction search stays on the structured
 * `query_transactions(textSearch)` path for now.
 *
 * Each entity is stored as a single RAG entry keyed by `<type>:<id>` so a
 * re-index of the same entity replaces the old entry.
 */

import { google } from '@ai-sdk/google'
import { RAG } from '@convex-dev/rag'
import { v } from 'convex/values'
import { components, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { internalAction } from './_generated/server'

// --- Types we filter on in the RAG namespace -------------------------------

type EntityType = 'category' | 'label' | 'rule'

type FilterTypes = {
  type: EntityType
}

// --- RAG instance ----------------------------------------------------------

// gemini-embedding-001 outputs 3072 dims by default. We keep the default —
// the Convex vector index supports up to 4096.
export const rag = new RAG<FilterTypes>(components.rag, {
  textEmbeddingModel: google.embedding('gemini-embedding-001'),
  embeddingDimension: 3072,
  filterNames: ['type'],
})

// --- Namespace + key conventions -------------------------------------------

function namespaceFor(workspaceId: Id<'workspaces'>): string {
  return `ws:${workspaceId}`
}

function entryKey(type: EntityType, id: string): string {
  return `${type}:${id}`
}

// --- Entry payload shape stored on the RAG entry metadata ------------------

type EntryMeta = {
  type: EntityType
  id: string
  preview: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Internal actions: called from mutation write paths via scheduler.
// ---------------------------------------------------------------------------

async function indexEntityImpl(
  ctx: Parameters<typeof rag.add>[0],
  params: {
    workspaceId: Id<'workspaces'>
    type: EntityType
    id: string
    text: string
    preview: Record<string, unknown>
  },
): Promise<void> {
  const { workspaceId, type, id, text, preview } = params
  if (!text.trim()) return
  const meta: EntryMeta = { type, id, preview }
  await rag.add(ctx, {
    namespace: namespaceFor(workspaceId),
    key: entryKey(type, id),
    title: `${type}:${id}`,
    text,
    // Convex value types don't accept Record<string, unknown> directly; we
    // round-trip through JSON.parse(JSON.stringify(...)) to coerce to the
    // plain-object-of-values shape the RAG component expects.
    // biome-ignore lint/suspicious/noExplicitAny: RAG metadata uses Convex Value — coerce through JSON.
    metadata: JSON.parse(JSON.stringify(meta)) as any,
    filterValues: [{ name: 'type', value: type }],
  })
}

async function removeEntityImpl(
  ctx: Parameters<typeof rag.getNamespace>[0] &
    Parameters<typeof rag.deleteByKey>[0],
  params: {
    workspaceId: Id<'workspaces'>
    type: EntityType
    id: string
  },
): Promise<void> {
  const { workspaceId, type, id } = params
  const ns = await rag.getNamespace(ctx, {
    namespace: namespaceFor(workspaceId),
  })
  if (!ns) return
  await rag.deleteByKey(ctx, {
    namespaceId: ns.namespaceId,
    key: entryKey(type, id),
  })
}

export const indexCategory = internalAction({
  args: {
    workspaceId: v.id('workspaces'),
    categoryId: v.id('transactionCategories'),
  },
  handler: async (ctx, args) => {
    const category = await ctx.runQuery(internal.rag.getCategoryForIndexing, {
      categoryId: args.categoryId,
    })
    if (!category) return
    const parts = [category.label, category.description ?? ''].filter(Boolean)
    await indexEntityImpl(ctx, {
      workspaceId: args.workspaceId,
      type: 'category',
      id: String(category._id),
      text: parts.join('\n'),
      preview: {
        key: category.key,
        label: category.label,
        description: category.description ?? null,
        portfolioId: category.portfolioId ?? null,
      },
    })
  },
})

export const indexLabel = internalAction({
  args: {
    workspaceId: v.id('workspaces'),
    labelId: v.id('transactionLabels'),
  },
  handler: async (ctx, args) => {
    const label = await ctx.runQuery(internal.rag.getLabelForIndexing, {
      labelId: args.labelId,
    })
    if (!label) return
    const parts = [label.name, label.description ?? ''].filter(Boolean)
    await indexEntityImpl(ctx, {
      workspaceId: args.workspaceId,
      type: 'label',
      id: String(label._id),
      text: parts.join('\n'),
      preview: {
        id: String(label._id),
        name: label.name,
        description: label.description ?? null,
        portfolioId: label.portfolioId ?? null,
      },
    })
  },
})

export const indexRule = internalAction({
  args: {
    workspaceId: v.id('workspaces'),
    ruleId: v.id('transactionRules'),
  },
  handler: async (ctx, args) => {
    const rule = await ctx.runQuery(internal.rag.getRuleForIndexing, {
      ruleId: args.ruleId,
    })
    if (!rule) return
    const parts = [
      rule.pattern,
      rule.customDescription ?? '',
      rule.categoryKey ?? '',
    ].filter(Boolean)
    await indexEntityImpl(ctx, {
      workspaceId: args.workspaceId,
      type: 'rule',
      id: String(rule._id),
      text: parts.join('\n'),
      preview: {
        id: String(rule._id),
        pattern: rule.pattern,
        matchType: rule.matchType,
        categoryKey: rule.categoryKey ?? null,
        customDescription: rule.customDescription ?? null,
        portfolioId: rule.portfolioId ?? null,
      },
    })
  },
})

export const removeEntity = internalAction({
  args: {
    workspaceId: v.id('workspaces'),
    type: v.union(v.literal('category'), v.literal('label'), v.literal('rule')),
    id: v.string(),
  },
  handler: async (ctx, args) => {
    await removeEntityImpl(ctx, {
      workspaceId: args.workspaceId,
      type: args.type,
      id: args.id,
    })
  },
})

// ---------------------------------------------------------------------------
// Search — used by the `semantic_search` primitive.
// ---------------------------------------------------------------------------

export const searchWorkspace = internalAction({
  args: {
    workspaceId: v.id('workspaces'),
    query: v.string(),
    types: v.optional(
      v.array(
        v.union(v.literal('category'), v.literal('label'), v.literal('rule')),
      ),
    ),
    limit: v.optional(v.number()),
    vectorScoreThreshold: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { entries, results } = await rag.search(ctx, {
      namespace: namespaceFor(args.workspaceId),
      query: args.query,
      limit: args.limit ?? 10,
      vectorScoreThreshold: args.vectorScoreThreshold ?? 0.3,
      ...(args.types && args.types.length > 0
        ? {
            filters: args.types.map((t) => ({
              name: 'type' as const,
              value: t,
            })),
          }
        : {}),
    })

    const entryById = new Map(entries.map((e) => [e.entryId, e]))
    return results.map((r) => {
      const entry = entryById.get(r.entryId)
      const meta = (entry?.metadata ?? {}) as Partial<EntryMeta>
      const snippet = r.content.map((c) => c.text).join('\n')
      return {
        type: meta.type ?? 'unknown',
        id: meta.id ?? null,
        score: r.score,
        snippet,
        preview: meta.preview ?? {},
      }
    })
  },
})

// ---------------------------------------------------------------------------
// Internal queries used by the index actions above.
// ---------------------------------------------------------------------------

import { internalQuery } from './_generated/server'

export const getCategoryForIndexing = internalQuery({
  args: { categoryId: v.id('transactionCategories') },
  handler: async (ctx, { categoryId }) => {
    const c = await ctx.db.get(categoryId)
    if (!c) return null
    return {
      _id: c._id,
      workspaceId: c.workspaceId,
      portfolioId: c.portfolioId ?? null,
      key: c.key,
      label: c.label,
      description: c.description ?? null,
    }
  },
})

export const getLabelForIndexing = internalQuery({
  args: { labelId: v.id('transactionLabels') },
  handler: async (ctx, { labelId }) => {
    const l = await ctx.db.get(labelId)
    if (!l) return null
    return {
      _id: l._id,
      workspaceId: l.workspaceId,
      portfolioId: l.portfolioId ?? null,
      name: l.name,
      description: l.description ?? null,
    }
  },
})

export const getRuleForIndexing = internalQuery({
  args: { ruleId: v.id('transactionRules') },
  handler: async (ctx, { ruleId }) => {
    const r = await ctx.db.get(ruleId)
    if (!r) return null
    return {
      _id: r._id,
      workspaceId: r.workspaceId,
      portfolioId: r.portfolioId ?? null,
      pattern: r.pattern,
      matchType: r.matchType,
      categoryKey: r.categoryKey ?? null,
      customDescription: r.customDescription ?? null,
    }
  },
})
