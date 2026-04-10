export interface TreemapCellProps {
  x: number
  y: number
  width: number
  height: number
  label: string
  color: string
  value: number
  total: number
  formatCurrency: (value: number, currency: string) => string
  currency: string
}

export function TreemapCell({
  x,
  y,
  width,
  height,
  label,
  color,
  value,
  total,
  formatCurrency,
  currency,
}: TreemapCellProps) {
  const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0'
  const showLabel = width > 60 && height > 40

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={color}
        stroke="var(--color-background)"
        strokeWidth={2}
        rx={4}
      />
      {showLabel && (
        <>
          <text
            x={x + width / 2}
            y={y + height / 2 - 10}
            textAnchor="middle"
            className="fill-white text-xs font-medium"
          >
            {label}
          </text>
          <text
            x={x + width / 2}
            y={y + height / 2 + 6}
            textAnchor="middle"
            className="fill-white/80 text-[10px]"
          >
            {formatCurrency(value, currency)}
          </text>
          <text
            x={x + width / 2}
            y={y + height / 2 + 20}
            textAnchor="middle"
            className="fill-white/60 text-[10px]"
          >
            {percentage}%
          </text>
        </>
      )}
    </g>
  )
}
