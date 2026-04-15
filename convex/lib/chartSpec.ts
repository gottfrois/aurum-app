/**
 * Chart specification for the agent's render_chart primitive.
 *
 * Pure TS (no Convex / Node) so it can be imported by both the tool shell in
 * `agentPrimitives.ts` and the React client in `src/components/chat`.
 *
 * The agent emits a `ChartSpec` after querying data; the chat UI renders it
 * inline via shadcn `ChartContainer` + Recharts.
 */

import type { Bucket } from './agentPrimitivesCore'

export type ChartType = 'bar' | 'line' | 'area' | 'pie'
export type StackMode = 'none' | 'normal' | 'percent'
export type ValueFormat = 'currency' | 'number' | 'percent'

export interface ChartSeries {
  /** Key in each row whose value this series plots. */
  key: string
  /** Human-readable label (legend + tooltip). */
  label: string
  /** Optional CSS color. If omitted, auto-assigned from the chart palette. */
  color?: string
}

export interface ChartSpec {
  type: ChartType
  title?: string
  description?: string
  /** Flat row objects. Recharts-shaped. */
  data: Array<Record<string, string | number>>
  /** Row key used as the X axis (bar/line/area). Ignored by pie. */
  xKey: string
  /** Series to plot (bar/line/area). For pie, provide exactly one series. */
  series: ChartSeries[]
  /** bar/area only. */
  stack?: StackMode
  /** pie — row key for slice name. Defaults to `xKey`. */
  nameKey?: string
  /** pie — row key for slice value. Defaults to `series[0].key`. */
  valueKey?: string
  valueFormat?: ValueFormat
  /** ISO 4217, only meaningful when valueFormat === 'currency'. */
  currency?: string
}

// ---------- Palette ----------------------------------------------------------

/**
 * Default color palette, matching shadcn's chart CSS variables
 * (defined in `src/styles/app.css`). We emit `var(--chart-N)` so the value
 * resolves to the theme's token at render time.
 */
export const CHART_COLORS: readonly string[] = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
]

// ---------- Build & validate -------------------------------------------------

export interface BuildChartSpecInput {
  type: ChartType
  title?: string
  description?: string
  data: Array<Record<string, string | number>>
  xKey: string
  series: ChartSeries[]
  stack?: StackMode
  nameKey?: string
  valueKey?: string
  valueFormat?: ValueFormat
  currency?: string
}

export const CHART_MAX_ROWS = 200
export const CHART_MAX_SERIES = 6

/**
 * Validate inputs and fill in defaults (auto-colors, inferred
 * valueFormat/nameKey/valueKey). Pure; throws on invalid input.
 */
export function buildChartSpec(input: BuildChartSpecInput): ChartSpec {
  if (!input.data || input.data.length === 0) {
    throw new Error('render_chart: data must contain at least one row')
  }
  if (input.data.length > CHART_MAX_ROWS) {
    throw new Error(
      `render_chart: too many rows (${input.data.length} > ${CHART_MAX_ROWS}). Aggregate or slice before rendering.`,
    )
  }
  if (!input.series || input.series.length === 0) {
    throw new Error('render_chart: at least one series is required')
  }
  if (input.series.length > CHART_MAX_SERIES) {
    throw new Error(
      `render_chart: too many series (${input.series.length} > ${CHART_MAX_SERIES}).`,
    )
  }

  const firstRow = input.data[0]
  const rowKeys = new Set(Object.keys(firstRow))

  if (input.type !== 'pie' && !rowKeys.has(input.xKey)) {
    throw new Error(
      `render_chart: xKey "${input.xKey}" is not present in data rows`,
    )
  }
  for (const s of input.series) {
    if (!rowKeys.has(s.key)) {
      throw new Error(
        `render_chart: series key "${s.key}" is not present in data rows`,
      )
    }
  }

  // Pie-specific: infer nameKey / valueKey, validate single series.
  let nameKey = input.nameKey
  let valueKey = input.valueKey
  if (input.type === 'pie') {
    if (input.series.length !== 1) {
      throw new Error('render_chart: pie charts require exactly one series')
    }
    nameKey = nameKey ?? input.xKey
    valueKey = valueKey ?? input.series[0].key
    if (!rowKeys.has(nameKey)) {
      throw new Error(
        `render_chart: pie nameKey "${nameKey}" is not present in data rows`,
      )
    }
    if (!rowKeys.has(valueKey)) {
      throw new Error(
        `render_chart: pie valueKey "${valueKey}" is not present in data rows`,
      )
    }
  }

  // Auto-assign colors from the palette for any series missing one.
  const series: ChartSeries[] = input.series.map((s, i) => ({
    ...s,
    color: s.color ?? CHART_COLORS[i % CHART_COLORS.length],
  }))

  // Default valueFormat to 'currency' if a currency was provided.
  const valueFormat =
    input.valueFormat ?? (input.currency ? 'currency' : undefined)

  return {
    type: input.type,
    title: input.title,
    description: input.description,
    data: input.data,
    xKey: input.xKey,
    series,
    stack: input.stack,
    nameKey,
    valueKey,
    valueFormat,
    currency: input.currency,
  }
}

// ---------- Helpers for tabular-result adapters ------------------------------

/**
 * Flatten `Bucket[]` (from query_transactions) into chart rows.
 *
 * Produces rows of shape `{ [xKey]: bucket.label, ...bucket.aggregates }`
 * — i.e. one row per bucket with each aggregate hoisted to a top-level field,
 * ready to feed into `buildChartSpec`.
 */
export function bucketsToRows(
  buckets: Bucket[],
  xKey = 'label',
): Array<Record<string, string | number>> {
  return buckets.map((b) => ({
    [xKey]: b.label,
    ...b.aggregates,
  }))
}
