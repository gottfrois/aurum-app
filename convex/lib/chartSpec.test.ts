import { describe, expect, it } from 'vitest'
import type { Bucket } from './agentPrimitivesCore'
import {
  type BuildChartSpecInput,
  bucketsToRows,
  buildChartSpec,
  CHART_COLORS,
  CHART_MAX_ROWS,
  CHART_MAX_SERIES,
} from './chartSpec'

function input(overrides: Partial<BuildChartSpecInput>): BuildChartSpecInput {
  return {
    type: 'bar',
    data: [
      { label: 'Mon', sum: 12 },
      { label: 'Tue', sum: 8 },
      { label: 'Wed', sum: 15 },
    ],
    xKey: 'label',
    series: [{ key: 'sum', label: 'Spend' }],
    ...overrides,
  }
}

describe('buildChartSpec', () => {
  it('builds a bar chart with defaults', () => {
    const spec = buildChartSpec(input({}))
    expect(spec.type).toBe('bar')
    expect(spec.data).toHaveLength(3)
    expect(spec.xKey).toBe('label')
    expect(spec.series[0].color).toBe(CHART_COLORS[0])
  })

  it('auto-assigns colors to each series from the palette', () => {
    const spec = buildChartSpec(
      input({
        series: [
          { key: 'sum', label: 'Spend' },
          { key: 'count', label: 'Count' },
        ],
        data: [
          { label: 'Mon', sum: 1, count: 2 },
          { label: 'Tue', sum: 3, count: 4 },
        ],
      }),
    )
    expect(spec.series[0].color).toBe(CHART_COLORS[0])
    expect(spec.series[1].color).toBe(CHART_COLORS[1])
  })

  it('respects explicit colors', () => {
    const spec = buildChartSpec(
      input({
        series: [{ key: 'sum', label: 'Spend', color: '#ff0000' }],
      }),
    )
    expect(spec.series[0].color).toBe('#ff0000')
  })

  it('infers valueFormat=currency when currency is set', () => {
    const spec = buildChartSpec(input({ currency: 'EUR' }))
    expect(spec.valueFormat).toBe('currency')
  })

  it('respects an explicit valueFormat', () => {
    const spec = buildChartSpec(
      input({ currency: 'EUR', valueFormat: 'number' }),
    )
    expect(spec.valueFormat).toBe('number')
  })

  it('builds a line chart', () => {
    const spec = buildChartSpec(input({ type: 'line' }))
    expect(spec.type).toBe('line')
  })

  it('builds an area chart with stacking', () => {
    const spec = buildChartSpec(input({ type: 'area', stack: 'normal' }))
    expect(spec.type).toBe('area')
    expect(spec.stack).toBe('normal')
  })

  it('builds a pie chart and infers nameKey/valueKey', () => {
    const spec = buildChartSpec(
      input({
        type: 'pie',
        data: [
          { label: 'Food', sum: 120 },
          { label: 'Transport', sum: 80 },
        ],
      }),
    )
    expect(spec.type).toBe('pie')
    expect(spec.nameKey).toBe('label')
    expect(spec.valueKey).toBe('sum')
  })

  it('rejects pie with multiple series', () => {
    expect(() =>
      buildChartSpec(
        input({
          type: 'pie',
          series: [
            { key: 'sum', label: 'Sum' },
            { key: 'count', label: 'Count' },
          ],
          data: [{ label: 'Food', sum: 1, count: 2 }],
        }),
      ),
    ).toThrow(/exactly one series/)
  })

  it('rejects empty data', () => {
    expect(() => buildChartSpec(input({ data: [] }))).toThrow(/at least one/)
  })

  it('rejects missing xKey', () => {
    expect(() => buildChartSpec(input({ xKey: 'nope' }))).toThrow(/xKey/)
  })

  it('rejects missing series key', () => {
    expect(() =>
      buildChartSpec(input({ series: [{ key: 'nope', label: 'X' }] })),
    ).toThrow(/series key/)
  })

  it('rejects too many rows', () => {
    const data = Array.from({ length: CHART_MAX_ROWS + 1 }, (_, i) => ({
      label: `L${i}`,
      sum: i,
    }))
    expect(() => buildChartSpec(input({ data }))).toThrow(/too many rows/)
  })

  it('rejects too many series', () => {
    const row: Record<string, number | string> = { label: 'Mon' }
    for (let i = 0; i < CHART_MAX_SERIES + 1; i++) row[`s${i}`] = i
    const series = Array.from({ length: CHART_MAX_SERIES + 1 }, (_, i) => ({
      key: `s${i}`,
      label: `S${i}`,
    }))
    expect(() => buildChartSpec(input({ data: [row], series }))).toThrow(
      /too many series/,
    )
  })

  it('rejects no series', () => {
    expect(() => buildChartSpec(input({ series: [] }))).toThrow(/series/)
  })
})

describe('bucketsToRows', () => {
  it('flattens buckets into Recharts rows', () => {
    const buckets: Bucket[] = [
      {
        key: 'mon',
        label: 'Monday',
        aggregates: { sum: 100, count: 3 },
      },
      {
        key: 'tue',
        label: 'Tuesday',
        aggregates: { sum: 50, count: 1 },
      },
    ]
    const rows = bucketsToRows(buckets)
    expect(rows).toEqual([
      { label: 'Monday', sum: 100, count: 3 },
      { label: 'Tuesday', sum: 50, count: 1 },
    ])
  })

  it('supports a custom xKey', () => {
    const buckets: Bucket[] = [
      { key: 'mon', label: 'Monday', aggregates: { sum: 100 } },
    ]
    const rows = bucketsToRows(buckets, 'day')
    expect(rows).toEqual([{ day: 'Monday', sum: 100 }])
  })

  it('feeds cleanly into buildChartSpec', () => {
    const buckets: Bucket[] = [
      { key: 'mon', label: 'Monday', aggregates: { sum: 100 } },
      { key: 'tue', label: 'Tuesday', aggregates: { sum: 50 } },
    ]
    const rows = bucketsToRows(buckets)
    const spec = buildChartSpec({
      type: 'bar',
      data: rows,
      xKey: 'label',
      series: [{ key: 'sum', label: 'Spend' }],
    })
    expect(spec.data).toEqual(rows)
  })
})
