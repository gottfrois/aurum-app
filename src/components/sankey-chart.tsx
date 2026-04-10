import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Layer, Rectangle, Sankey, Tooltip } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { useMoney } from '~/hooks/use-money'

interface SankeyNode {
  name: string
  color?: string
  categoryKey?: string
  intermediate?: boolean
}

interface SankeyLink {
  source: number
  target: number
  value: number
  stroke?: string
}

interface SankeyChartProps {
  nodes: Array<SankeyNode>
  links: Array<SankeyLink>
  currency: string
  onLabelClick?: (categoryKey: string) => void
}

function SankeyNodeComponent({
  x,
  y,
  width,
  height,
  payload,
  containerWidth,
  formatCurrency,
  onLabelClick,
}: {
  x: number
  y: number
  width: number
  height: number
  payload: SankeyNode & { value?: number }
  containerWidth: number
  formatCurrency: (value: number) => string
  onLabelClick?: (categoryKey: string) => void
}) {
  const isLeft = x < containerWidth / 2
  const formattedValue =
    payload.value != null ? formatCurrency(payload.value) : ''
  const clickable = onLabelClick && payload.categoryKey

  if (payload.intermediate) {
    return (
      <Layer>
        <Rectangle
          x={x}
          y={y}
          width={width}
          height={height}
          fill={payload.color ?? 'var(--color-primary)'}
          fillOpacity={0.4}
          radius={2}
        />
      </Layer>
    )
  }

  return (
    <Layer>
      <Rectangle
        x={x}
        y={y}
        width={width}
        height={height}
        fill={payload.color ?? 'var(--color-primary)'}
        fillOpacity={0.9}
        radius={2}
      />
      {/* biome-ignore lint/a11y/noStaticElementInteractions: role is conditionally set at runtime */}
      <text
        x={isLeft ? x - 6 : x + width + 6}
        y={y + height / 2 - 7}
        textAnchor={isLeft ? 'end' : 'start'}
        dominantBaseline="middle"
        role={clickable ? 'button' : undefined}
        tabIndex={clickable ? 0 : undefined}
        className={`text-xs font-medium ${clickable ? 'cursor-pointer fill-foreground hover:underline' : 'fill-foreground'}`}
        onClick={
          clickable
            ? () => onLabelClick(payload.categoryKey as string)
            : undefined
        }
        onKeyDown={
          clickable
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  onLabelClick(payload.categoryKey as string)
                }
              }
            : undefined
        }
      >
        {payload.name}
      </text>
      <text
        x={isLeft ? x - 6 : x + width + 6}
        y={y + height / 2 + 7}
        textAnchor={isLeft ? 'end' : 'start'}
        dominantBaseline="middle"
        className="fill-muted-foreground text-[10px] font-mono"
      >
        {formattedValue}
      </text>
    </Layer>
  )
}

function SankeyTooltipContent({
  active,
  payload,
  formatCurrency,
}: {
  active?: boolean
  payload?: Array<{
    payload: {
      source?: SankeyNode
      target?: SankeyNode
      payload?: { value?: number }
    }
  }>
  formatCurrency: (value: number) => string
}) {
  if (!active || !payload?.length) return null
  const data = payload[0].payload
  const value = data.payload?.value

  return (
    <div className="rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="flex items-center gap-2 font-medium">
        {data.target?.color && (
          <div
            className="size-2.5 shrink-0 rounded-[2px]"
            style={{ backgroundColor: data.target.color }}
          />
        )}
        {data.source?.name} → {data.target?.name}
      </div>
      <div className="mt-1 font-mono tabular-nums text-muted-foreground">
        {formatCurrency(value ?? 0)}
      </div>
    </div>
  )
}

function renderSankeyLink(props: {
  sourceX: number
  sourceY: number
  sourceControlX: number
  targetX: number
  targetY: number
  targetControlX: number
  linkWidth: number
  index: number
  payload: SankeyLink & { source?: SankeyNode; target?: SankeyNode }
}) {
  const {
    sourceX,
    sourceY,
    sourceControlX,
    targetX,
    targetY,
    targetControlX,
    linkWidth,
    index,
    payload,
  } = props
  const color = payload.stroke ?? 'var(--color-primary)'

  return (
    <Layer key={`link-${index}`}>
      <path
        d={`M${sourceX},${sourceY} C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
        fill="none"
        stroke={color}
        strokeOpacity={0.2}
        strokeWidth={linkWidth}
      />
    </Layer>
  )
}

export function SankeyChart({
  nodes,
  links,
  currency,
  onLabelClick,
}: SankeyChartProps) {
  const { t } = useTranslation()
  const { format } = useMoney()

  const formatCurrency = React.useCallback(
    (value: number) => format(value, currency, { maximumFractionDigits: 0 }),
    [format, currency],
  )

  if (nodes.length === 0 || links.length === 0) {
    return null
  }

  const chartHeight = Math.max(280, (nodes.length - 1) * 40 + 40)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('charts.incomeFlow')}</CardTitle>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        <div className="w-full overflow-x-auto">
          <div className="min-w-[600px]" style={{ height: chartHeight }}>
            <Sankey
              width={900}
              height={chartHeight}
              data={{ nodes, links }}
              nodeWidth={10}
              nodePadding={24}
              linkCurvature={0.5}
              iterations={64}
              margin={{ left: 120, right: 120, top: 10, bottom: 10 }}
              node={
                <SankeyNodeComponent
                  x={0}
                  y={0}
                  width={0}
                  height={0}
                  payload={{ name: '' }}
                  containerWidth={900}
                  formatCurrency={formatCurrency}
                  onLabelClick={onLabelClick}
                />
              }
              link={renderSankeyLink}
            >
              <Tooltip
                content={
                  <SankeyTooltipContent formatCurrency={formatCurrency} />
                }
              />
            </Sankey>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
