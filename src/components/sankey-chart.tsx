import { Layer, Rectangle, Sankey, Tooltip } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { usePrivacy } from '~/contexts/privacy-context'

interface SankeyNode {
  name: string
  color?: string
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
}

function formatCurrencyValue(value: number, currency: string) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

function SankeyNodeComponent({
  x,
  y,
  width,
  height,
  payload,
  containerWidth,
  currency,
  isPrivate,
}: {
  x: number
  y: number
  width: number
  height: number
  payload: SankeyNode & { value?: number }
  containerWidth: number
  currency: string
  isPrivate: boolean
}) {
  const isLeft = x < containerWidth / 2
  const formattedValue =
    payload.value != null
      ? isPrivate
        ? '••••••'
        : formatCurrencyValue(payload.value, currency)
      : ''

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
      <text
        x={isLeft ? x - 6 : x + width + 6}
        y={y + height / 2 - 7}
        textAnchor={isLeft ? 'end' : 'start'}
        dominantBaseline="middle"
        className="fill-foreground text-xs font-medium"
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
  currency,
  isPrivate,
}: {
  active?: boolean
  payload?: Array<{
    payload: {
      source?: SankeyNode
      target?: SankeyNode
      payload?: { value?: number }
    }
  }>
  currency: string
  isPrivate: boolean
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
        {isPrivate ? '••••••' : formatCurrencyValue(value ?? 0, currency)}
      </div>
    </div>
  )
}

export function SankeyChart({ nodes, links, currency }: SankeyChartProps) {
  const { isPrivate } = usePrivacy()

  if (nodes.length === 0 || links.length === 0) {
    return null
  }

  const chartHeight = Math.max(280, (nodes.length - 1) * 40 + 40)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Income Flow</CardTitle>
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
                  currency={currency}
                  isPrivate={isPrivate}
                />
              }
              link={{ fill: 'none', strokeOpacity: 0.3 }}
            >
              <Tooltip
                content={
                  <SankeyTooltipContent
                    currency={currency}
                    isPrivate={isPrivate}
                  />
                }
              />
            </Sankey>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
