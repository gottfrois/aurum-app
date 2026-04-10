import { LayoutGrid, PieChartIcon } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import {
  Cell,
  Label,
  Pie,
  PieChart,
  ResponsiveContainer,
  Treemap,
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
import { ChartContainer, ChartTooltip } from '~/components/ui/chart'
import { ToggleGroup, ToggleGroupItem } from '~/components/ui/toggle-group'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '~/components/ui/tooltip'
import { usePrivacy } from '~/contexts/privacy-context'

interface AllocationEntry {
  key: string
  label: string
  value: number
  color: string
}

interface AllocationChartProps {
  data: Array<AllocationEntry>
  currency: string
  total: number
  onCategoryClick?: (categoryKey: string) => void
}

type ChartView = 'donut' | 'treemap'

const CATEGORY_COLORS: Record<string, string> = {
  checking: 'var(--color-chart-1)',
  savings: 'var(--color-chart-2)',
  investments: 'var(--color-chart-3)',
  insurance: 'var(--color-chart-4)',
}

export { CATEGORY_COLORS }

function formatCurrencyValue(value: number, currency: string) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

function AllocationTooltipContent({
  active,
  payload,
  currency,
  total,
  formatCurrency,
}: {
  active?: boolean
  payload?: Array<{ payload: AllocationEntry }>
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
        <span className="text-muted-foreground">{t('charts.allocation')}</span>
        <span className="font-mono font-medium tabular-nums">
          {percentage}%
        </span>
      </div>
    </div>
  )
}

function DonutView({
  data,
  chartConfig,
  currency,
  total,
  formattedTotal,
  formatCurrency,
}: {
  data: Array<AllocationEntry>
  chartConfig: ChartConfig
  currency: string
  total: number
  formattedTotal: string
  formatCurrency: (value: number, currency: string) => string
}) {
  return (
    <ChartContainer
      config={chartConfig}
      className="aspect-square h-[200px] shrink-0"
    >
      <PieChart>
        <ChartTooltip
          content={
            <AllocationTooltipContent
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
                    <AllocationDonutLabel cx={viewBox.cx} cy={viewBox.cy} />
                  </text>
                )
              }
            }}
          />
        </Pie>
      </PieChart>
    </ChartContainer>
  )
}

function TreemapView({
  data,
  currency,
  total,
  formatCurrency,
}: {
  data: Array<AllocationEntry>
  currency: string
  total: number
  formatCurrency: (value: number, currency: string) => string
}) {
  const treemapData = React.useMemo(
    () =>
      data.map((d) => ({
        ...d,
        name: d.label,
      })),
    [data],
  )

  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <Treemap
          data={treemapData}
          dataKey="value"
          nameKey="name"
          isAnimationActive={false}
          content={
            <TreemapCell
              x={0}
              y={0}
              width={0}
              height={0}
              label=""
              value={0}
              color=""
              currency={currency}
              total={total}
              formatCurrency={formatCurrency}
            />
          }
        />
      </ResponsiveContainer>
    </div>
  )
}

const DEFAULT_LEGEND_LIMIT = 6

function AllocationLegend({
  data,
  currency,
  total,
  formatCurrency,
  onCategoryClick,
}: {
  data: Array<AllocationEntry>
  currency: string
  total: number
  formatCurrency: (value: number, currency: string) => string
  onCategoryClick?: (categoryKey: string) => void
}) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = React.useState(false)

  const visible = React.useMemo(
    () => (expanded ? data : data.slice(0, DEFAULT_LEGEND_LIMIT)),
    [data, expanded],
  )
  const hiddenCount = data.length - DEFAULT_LEGEND_LIMIT

  return (
    <div className="grid w-full gap-2 text-sm">
      {visible.map((entry) => {
        const percentage =
          total > 0 ? ((entry.value / total) * 100).toFixed(1) : '0'

        return onCategoryClick ? (
          <button
            key={entry.key}
            type="button"
            className="flex w-full min-w-0 cursor-pointer items-center gap-3"
            onClick={() => onCategoryClick(entry.key)}
          >
            <div
              className="size-3 shrink-0 rounded-sm"
              style={{ backgroundColor: entry.color }}
            />
            <span
              className="min-w-0 flex-1 truncate text-left font-medium hover:underline"
              title={entry.label}
            >
              {entry.label}
            </span>
            <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
              {percentage}%
            </span>
            <span className="shrink-0 font-mono font-medium tabular-nums">
              {formatCurrency(entry.value, currency)}
            </span>
          </button>
        ) : (
          <div key={entry.key} className="flex min-w-0 items-center gap-3">
            <div
              className="size-3 shrink-0 rounded-sm"
              style={{ backgroundColor: entry.color }}
            />
            <span
              className="min-w-0 flex-1 truncate font-medium"
              title={entry.label}
            >
              {entry.label}
            </span>
            <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
              {percentage}%
            </span>
            <span className="shrink-0 font-mono font-medium tabular-nums">
              {formatCurrency(entry.value, currency)}
            </span>
          </div>
        )
      })}
      {hiddenCount > 0 && (
        <button
          type="button"
          className="mt-1 text-left text-xs text-muted-foreground hover:text-foreground hover:underline"
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded
            ? t('charts.showLess')
            : t('charts.showMore', { count: hiddenCount })}
        </button>
      )}
    </div>
  )
}

function AllocationDonutLabel({ cx, cy }: { cx?: number; cy?: number }) {
  const { t } = useTranslation()
  return (
    <tspan x={cx} y={(cy ?? 0) + 20} className="fill-muted-foreground text-xs">
      {t('charts.total')}
    </tspan>
  )
}

export function AllocationChart({
  data,
  currency,
  total,
  onCategoryClick,
}: AllocationChartProps) {
  const { t } = useTranslation()
  const [view, setView] = React.useState<ChartView>('donut')
  const { isPrivate } = usePrivacy()

  const formatCurrency = React.useCallback(
    (value: number, cur: string) =>
      isPrivate ? '••••••' : formatCurrencyValue(value, cur),
    [isPrivate],
  )

  const chartConfig = React.useMemo(() => {
    const config: ChartConfig = {}
    for (const entry of data) {
      config[entry.key] = { label: entry.label, color: entry.color }
    }
    return config
  }, [data])

  const formattedTotal = formatCurrency(total, currency)

  return (
    <Card className="@container/card flex h-full flex-col">
      <CardHeader>
        <CardTitle>{t('charts.allocation')}</CardTitle>
        <CardAction>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={view}
            onValueChange={(val) => {
              if (val) setView(val as ChartView)
            }}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <ToggleGroupItem
                  value="donut"
                  aria-label={t('charts.donutChart')}
                >
                  <PieChartIcon className="size-4" />
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent>{t('charts.donutChart')}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <ToggleGroupItem
                  value="treemap"
                  aria-label={t('charts.treemap')}
                >
                  <LayoutGrid className="size-4" />
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent>{t('charts.treemap')}</TooltipContent>
            </Tooltip>
          </ToggleGroup>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col px-2 sm:px-6">
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          {view === 'donut' ? (
            <DonutView
              data={data}
              chartConfig={chartConfig}
              currency={currency}
              total={total}
              formattedTotal={formattedTotal}
              formatCurrency={formatCurrency}
            />
          ) : (
            <TreemapView
              data={data}
              currency={currency}
              total={total}
              formatCurrency={formatCurrency}
            />
          )}
          <AllocationLegend
            data={data}
            currency={currency}
            total={total}
            formatCurrency={formatCurrency}
            onCategoryClick={onCategoryClick}
          />
        </div>
      </CardContent>
    </Card>
  )
}
