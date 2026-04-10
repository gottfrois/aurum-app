import { BarChart3, LayoutGrid, PieChartIcon } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  Pie,
  PieChart,
  ResponsiveContainer,
  Treemap,
  XAxis,
  YAxis,
} from 'recharts'
import { TreemapCell } from '~/components/treemap-cell'
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import type { ChartConfig } from '~/components/ui/chart'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '~/components/ui/chart'
import { ToggleGroup, ToggleGroupItem } from '~/components/ui/toggle-group'
import { useMoney } from '~/hooks/use-money'
import { cn } from '~/lib/utils'

interface CategoryEntry {
  key: string
  label: string
  value: number
  color: string
}

interface CategoryBreakdownChartProps {
  data: Array<CategoryEntry>
  currency: string
  total: number
  title?: string
  className?: string
  onCategoryClick?: (categoryKey: string) => void
}

type ChartView = 'pie' | 'treemap' | 'bar'

function CategoryTooltipContent({
  active,
  payload,
  currency,
  total,
  formatCurrency,
}: {
  active?: boolean
  payload?: Array<{ payload: CategoryEntry }>
  currency: string
  total: number
  formatCurrency: (value: number, currency: string) => string
}) {
  const { t } = useTranslation()
  if (!active || !payload?.length) return null
  const entry = payload[0].payload
  const percentage = total > 0 ? ((entry.value / total) * 100).toFixed(1) : '0'

  return (
    <div className="grid min-w-32 items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="flex items-center gap-2">
        <div
          className="size-2.5 shrink-0 rounded-[2px]"
          style={{ backgroundColor: entry.color }}
        />
        <span className="font-medium">{entry.label}</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-muted-foreground">{t('charts.amount')}</span>
        <span className="font-mono font-medium tabular-nums">
          {formatCurrency(entry.value, currency)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-muted-foreground">{t('charts.share')}</span>
        <span className="font-mono font-medium tabular-nums">
          {percentage}%
        </span>
      </div>
    </div>
  )
}

const MAX_LEGEND_ITEMS = 8

function collapseCategories(
  data: Array<CategoryEntry>,
  otherLabel: string,
): Array<CategoryEntry> {
  if (data.length <= MAX_LEGEND_ITEMS) return data
  const top = data.slice(0, MAX_LEGEND_ITEMS - 1)
  const rest = data.slice(MAX_LEGEND_ITEMS - 1)
  const otherValue = rest.reduce((sum, e) => sum + e.value, 0)
  return [
    ...top,
    {
      key: '__other__',
      label: otherLabel,
      value: Math.round(otherValue * 100) / 100,
      color: 'var(--muted-foreground)',
    },
  ]
}

export function CategoryBreakdownChart({
  data,
  currency,
  total,
  title,
  className,
  onCategoryClick,
}: CategoryBreakdownChartProps) {
  const { t } = useTranslation()
  const { format } = useMoney()
  const [view, setView] = React.useState<ChartView>('pie')

  const formatCurrency = React.useCallback(
    (value: number, cur: string) =>
      format(value, cur, { maximumFractionDigits: 0 }),
    [format],
  )

  const displayData = React.useMemo(
    () => collapseCategories(data, t('insights.other')),
    [data, t],
  )

  const formattedTotal = formatCurrency(total, currency)

  const chartConfig = React.useMemo(() => {
    const config: ChartConfig = {}
    for (const entry of displayData) {
      config[entry.key] = { label: entry.label, color: entry.color }
    }
    return config
  }, [displayData])

  if (displayData.length === 0) {
    return (
      <Card className={cn(className)}>
        <CardHeader>
          <CardTitle>{title ?? t('charts.expensesByCategory')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
            {t('charts.noExpenseData')}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle>{title ?? t('charts.expensesByCategory')}</CardTitle>
        <CardAction>
          <ToggleGroup
            type="single"
            value={view}
            onValueChange={(v) => {
              if (v) setView(v as ChartView)
            }}
            size="sm"
          >
            <ToggleGroupItem value="pie" aria-label={t('categoryChart.pie')}>
              <PieChartIcon className="size-4" />
            </ToggleGroupItem>
            <ToggleGroupItem
              value="treemap"
              aria-label={t('categoryChart.treemap')}
            >
              <LayoutGrid className="size-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="bar" aria-label={t('categoryChart.bar')}>
              <BarChart3 className="size-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        {view === 'pie' && (
          <PieView
            data={displayData}
            currency={currency}
            total={total}
            formattedTotal={formattedTotal}
            formatCurrency={formatCurrency}
            chartConfig={chartConfig}
            onCategoryClick={onCategoryClick}
          />
        )}
        {view === 'treemap' && (
          <TreemapView
            data={displayData}
            currency={currency}
            total={total}
            formatCurrency={formatCurrency}
          />
        )}
        {view === 'bar' && (
          <BarView
            data={displayData}
            currency={currency}
            chartConfig={chartConfig}
            formatCurrency={formatCurrency}
            onCategoryClick={onCategoryClick}
          />
        )}
        {/* Legend */}
        <div className="mt-4 grid w-full gap-2 text-sm">
          {displayData.map((entry) => {
            const percentage =
              total > 0 ? ((entry.value / total) * 100).toFixed(1) : '0'
            const isOther = entry.key === '__other__'
            return onCategoryClick && !isOther ? (
              <button
                key={entry.key}
                type="button"
                className="flex w-full cursor-pointer items-center gap-3"
                onClick={() => onCategoryClick(entry.key)}
              >
                <div
                  className="size-3 shrink-0 rounded-sm"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="flex-1 text-left font-medium hover:underline">
                  {entry.label}
                </span>
                <span className="font-mono tabular-nums text-muted-foreground">
                  {percentage}%
                </span>
                <span className="font-mono font-medium tabular-nums">
                  {formatCurrency(entry.value, currency)}
                </span>
              </button>
            ) : (
              <div key={entry.key} className="flex items-center gap-3">
                <div
                  className="size-3 shrink-0 rounded-sm"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="flex-1 font-medium">{entry.label}</span>
                <span className="font-mono tabular-nums text-muted-foreground">
                  {percentage}%
                </span>
                <span className="font-mono font-medium tabular-nums">
                  {formatCurrency(entry.value, currency)}
                </span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Pie View ─────────────────────────────────────────────

function PieView({
  data,
  currency,
  total,
  formattedTotal,
  formatCurrency,
  chartConfig,
}: {
  data: Array<CategoryEntry>
  currency: string
  total: number
  formattedTotal: string
  formatCurrency: (value: number, currency: string) => string
  chartConfig: ChartConfig
  onCategoryClick?: (categoryKey: string) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center">
      <ChartContainer
        config={chartConfig}
        className="aspect-square h-[200px] shrink-0"
      >
        <PieChart>
          <ChartTooltip
            content={
              <CategoryTooltipContent
                currency={currency}
                total={total}
                formatCurrency={formatCurrency}
              />
            }
          />
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            isAnimationActive={false}
            innerRadius={60}
            outerRadius={85}
            strokeWidth={2}
            stroke="var(--color-background)"
          >
            {data.map((entry) => (
              <Cell key={entry.key} fill={entry.color} />
            ))}
            <Label
              content={({ viewBox }) => {
                if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                  return (
                    <text
                      x={viewBox.cx}
                      y={viewBox.cy}
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      <tspan
                        x={viewBox.cx}
                        y={viewBox.cy}
                        className="fill-foreground text-lg font-bold"
                      >
                        {formattedTotal}
                      </tspan>
                      <tspan
                        x={viewBox.cx}
                        y={(viewBox.cy ?? 0) + 20}
                        className="fill-muted-foreground text-xs"
                      >
                        {t('charts.expenses')}
                      </tspan>
                    </text>
                  )
                }
              }}
            />
          </Pie>
        </PieChart>
      </ChartContainer>
    </div>
  )
}

// ─── Treemap View ─────────────────────────────────────────

function TreemapView({
  data,
  currency,
  total,
  formatCurrency,
}: {
  data: Array<CategoryEntry>
  currency: string
  total: number
  formatCurrency: (value: number, currency: string) => string
}) {
  const treemapData = React.useMemo(
    () =>
      data.map((entry) => ({
        name: entry.label,
        size: entry.value,
        color: entry.color,
        label: entry.label,
        value: entry.value,
      })),
    [data],
  )

  const renderContent = React.useCallback(
    (props: Record<string, unknown>) => (
      <TreemapCell
        x={props.x as number}
        y={props.y as number}
        width={props.width as number}
        height={props.height as number}
        label={props.name as string}
        color={props.color as string}
        value={props.value as number}
        total={total}
        formatCurrency={formatCurrency}
        currency={currency}
      />
    ),
    [total, formatCurrency, currency],
  )

  return (
    <ResponsiveContainer width="100%" height={220}>
      <Treemap
        data={treemapData}
        dataKey="size"
        isAnimationActive={false}
        // biome-ignore lint/suspicious/noExplicitAny: Recharts Treemap content typing is incorrect
        content={renderContent as any}
      />
    </ResponsiveContainer>
  )
}

// ─── Bar View ─────────────────────────────────────────────

function BarView({
  data,
  currency,
  chartConfig,
  formatCurrency,
  onCategoryClick,
}: {
  data: Array<CategoryEntry>
  currency: string
  chartConfig: ChartConfig
  formatCurrency: (value: number, currency: string) => string
  onCategoryClick?: (categoryKey: string) => void
}) {
  const fmtCurrency = React.useCallback(
    (value: number) => formatCurrency(value, currency),
    [formatCurrency, currency],
  )

  return (
    <ChartContainer
      config={chartConfig}
      className="aspect-auto h-[250px] w-full"
    >
      <BarChart data={data} layout="vertical">
        <CartesianGrid horizontal={false} />
        <XAxis
          type="number"
          tickLine={false}
          axisLine={false}
          tickFormatter={fmtCurrency}
        />
        <YAxis
          type="category"
          dataKey="label"
          tickLine={false}
          axisLine={false}
          width={120}
          tick={{ fontSize: 12 }}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => (
                <span className="font-mono font-medium tabular-nums">
                  {fmtCurrency(value as number)}
                </span>
              )}
              indicator="dot"
            />
          }
        />
        <Bar
          dataKey="value"
          radius={[0, 4, 4, 0]}
          onClick={
            onCategoryClick
              ? (_data, index) => {
                  const entry = data[index]
                  if (entry) onCategoryClick(entry.key)
                }
              : undefined
          }
          className={onCategoryClick ? 'cursor-pointer' : undefined}
        >
          {data.map((entry) => (
            <Cell key={entry.key} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}
