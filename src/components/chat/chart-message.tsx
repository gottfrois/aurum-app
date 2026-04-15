import * as React from 'react'
import { useTranslation } from 'react-i18next'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import type { ChartConfig } from '~/components/ui/chart'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '~/components/ui/chart'
import { useMoney } from '~/hooks/use-money'
import type { ChartSpec } from '../../../convex/lib/chartSpec'

/**
 * Renders a `ChartSpec` emitted by the agent's `render_chart` tool.
 *
 * The spec is already validated server-side by `buildChartSpec` — we only
 * check for the error-shape fallback and otherwise trust the payload.
 */
export function ChartMessage({
  spec,
}: {
  spec: ChartSpec | { error: string }
}) {
  const { t } = useTranslation()
  // Called unconditionally to satisfy React hook rules; result is only used
  // when `spec` is a valid ChartSpec (not the error shape).
  const format = useValueFormatter('error' in spec ? null : spec)

  if ('error' in spec) {
    return (
      <Card className="w-full">
        <CardContent className="text-sm text-destructive">
          {t('chat.chartError', { defaultValue: 'Chart error:' })} {spec.error}
        </CardContent>
      </Card>
    )
  }

  const config: ChartConfig = Object.fromEntries(
    spec.series.map((s) => [s.key, { label: s.label, color: s.color }]),
  )

  return (
    <Card className="w-full">
      {(spec.title || spec.description) && (
        <CardHeader>
          {spec.title && <CardTitle>{spec.title}</CardTitle>}
          {spec.description && (
            <p className="text-sm text-muted-foreground">{spec.description}</p>
          )}
        </CardHeader>
      )}
      <CardContent>
        {/*
         * ChartContainer wraps its children in Recharts' ResponsiveContainer,
         * which clones its single child to inject width/height. The child
         * MUST be a Recharts chart element (BarChart/LineChart/...), NOT a
         * wrapper component — otherwise width/height land on the wrapper and
         * never reach the inner chart, producing a blank card.
         */}
        <ChartContainer
          config={config}
          className="aspect-auto h-[280px] w-full"
        >
          {renderChartBody(spec, format)}
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

function renderChartBody(spec: ChartSpec, format: Formatter) {
  switch (spec.type) {
    case 'bar':
      return renderBar(spec, format)
    case 'line':
      return renderLine(spec, format)
    case 'area':
      return renderArea(spec, format)
    case 'pie':
      return renderPie(spec, format)
  }
}

// ---------- Value formatting -------------------------------------------------

type Formatter = (value: number) => string

function useValueFormatter(spec: ChartSpec | null): Formatter {
  const { format } = useMoney()
  const valueFormat = spec?.valueFormat
  const currency = spec?.currency
  return React.useCallback(
    (value: number) => {
      if (valueFormat === 'currency' && currency) {
        return format(value, currency, { maximumFractionDigits: 0 })
      }
      if (valueFormat === 'percent') {
        return `${Math.round(value * 100)}%`
      }
      return new Intl.NumberFormat(undefined, {
        maximumFractionDigits: 2,
      }).format(value)
    },
    [format, valueFormat, currency],
  )
}

// ---------- Shared tooltip ---------------------------------------------------

/**
 * Recharts discovers `Tooltip` by walking `React.Children` of the chart;
 * wrapping it in a custom component hides it. So we return the element as
 * plain JSX from a helper function (not a React component).
 */
function sharedTooltip(format: Formatter) {
  return (
    <ChartTooltip
      content={
        <ChartTooltipContent
          indicator="dot"
          formatter={(value, name, item) => (
            <>
              <div
                className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                style={{
                  backgroundColor: item.payload.fill || item.color,
                }}
              />
              <div className="flex flex-1 items-center justify-between gap-4 leading-none">
                <span className="text-muted-foreground">{name}</span>
                <span className="font-mono font-medium text-foreground tabular-nums">
                  {format(Number(value))}
                </span>
              </div>
            </>
          )}
        />
      }
    />
  )
}

// ---------- Bar --------------------------------------------------------------

function renderBar(spec: ChartSpec, format: Formatter) {
  const stackId = spec.stack && spec.stack !== 'none' ? 'stack' : undefined
  return (
    <BarChart data={spec.data}>
      <CartesianGrid vertical={false} />
      <XAxis
        dataKey={spec.xKey}
        tickLine={false}
        axisLine={false}
        tickMargin={8}
      />
      <YAxis
        tickLine={false}
        axisLine={false}
        tickMargin={8}
        tickFormatter={format}
        width={80}
      />
      {sharedTooltip(format)}
      {spec.series.length > 1 && (
        <ChartLegend content={<ChartLegendContent />} />
      )}
      {spec.series.map((s) => (
        <Bar
          key={s.key}
          dataKey={s.key}
          name={s.label}
          stackId={stackId}
          fill={`var(--color-${s.key})`}
          radius={stackId ? 0 : [4, 4, 0, 0]}
        />
      ))}
    </BarChart>
  )
}

// ---------- Line -------------------------------------------------------------

function renderLine(spec: ChartSpec, format: Formatter) {
  return (
    <LineChart data={spec.data}>
      <CartesianGrid vertical={false} />
      <XAxis
        dataKey={spec.xKey}
        tickLine={false}
        axisLine={false}
        tickMargin={8}
      />
      <YAxis
        tickLine={false}
        axisLine={false}
        tickMargin={8}
        tickFormatter={format}
        width={80}
      />
      {sharedTooltip(format)}
      {spec.series.length > 1 && (
        <ChartLegend content={<ChartLegendContent />} />
      )}
      {spec.series.map((s) => (
        <Line
          key={s.key}
          dataKey={s.key}
          name={s.label}
          type="monotone"
          stroke={`var(--color-${s.key})`}
          strokeWidth={2}
          dot={false}
        />
      ))}
    </LineChart>
  )
}

// ---------- Area -------------------------------------------------------------

function renderArea(spec: ChartSpec, format: Formatter) {
  const stackId = spec.stack && spec.stack !== 'none' ? 'stack' : undefined
  return (
    <AreaChart data={spec.data}>
      <CartesianGrid vertical={false} />
      <XAxis
        dataKey={spec.xKey}
        tickLine={false}
        axisLine={false}
        tickMargin={8}
      />
      <YAxis
        tickLine={false}
        axisLine={false}
        tickMargin={8}
        tickFormatter={format}
        width={80}
      />
      {sharedTooltip(format)}
      {spec.series.length > 1 && (
        <ChartLegend content={<ChartLegendContent />} />
      )}
      {spec.series.map((s) => (
        <Area
          key={s.key}
          dataKey={s.key}
          name={s.label}
          type="monotone"
          stackId={stackId}
          stroke={`var(--color-${s.key})`}
          fill={`var(--color-${s.key})`}
          fillOpacity={0.3}
        />
      ))}
    </AreaChart>
  )
}

// ---------- Pie --------------------------------------------------------------

function renderPie(spec: ChartSpec, format: Formatter) {
  const nameKey = spec.nameKey ?? spec.xKey
  const valueKey = spec.valueKey ?? spec.series[0].key
  const seriesColor = spec.series[0].color

  // Pie wants each slice colored independently — fall back to the series
  // color, but walk the palette via the `--chart-N` CSS vars for variety.
  const sliceColor = (index: number) =>
    `var(--chart-${(index % 5) + 1}, ${seriesColor ?? 'var(--chart-1)'})`

  return (
    <PieChart>
      {sharedTooltip(format)}
      <ChartLegend content={<ChartLegendContent nameKey={nameKey} />} />
      <Pie
        data={spec.data}
        dataKey={valueKey}
        nameKey={nameKey}
        outerRadius={100}
        strokeWidth={2}
        stroke="var(--color-background)"
      >
        {spec.data.map((row, i) => (
          <Cell
            key={`cell-${String(row[nameKey] ?? i)}`}
            fill={sliceColor(i)}
          />
        ))}
      </Pie>
    </PieChart>
  )
}
