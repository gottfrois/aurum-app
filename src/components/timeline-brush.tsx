import {
  addMonths,
  differenceInCalendarDays,
  eachMonthOfInterval,
  format,
  isBefore,
  isEqual,
  startOfDay,
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import * as React from 'react'
import { Button } from '~/components/ui/button'
import { cn } from '~/lib/utils'

interface TimelineBrushProps {
  start: Date
  end: Date
  onRangeChange: (start: Date, end: Date) => void
  volumeData?: Array<{ date: string; count: number }>
  minDate?: Date
  maxDate?: Date
  className?: string
}

const MIN_SELECTION_DAYS = 7
/** Hard floor: never allow viewport to go earlier than this */
const ABSOLUTE_MIN_YEAR = 2015
/** Maximum viewport span in months */
const MAX_VIEWPORT_MONTHS = 60

function dateToPercent(date: Date, min: Date, max: Date): number {
  const total = differenceInCalendarDays(max, min)
  if (total <= 0) return 0
  const offset = differenceInCalendarDays(date, min)
  return Math.max(0, Math.min(100, (offset / total) * 100))
}

function percentToDate(pct: number, min: Date, max: Date): Date {
  const total = differenceInCalendarDays(max, min)
  const days = Math.round((pct / 100) * total)
  const d = new Date(min)
  d.setDate(d.getDate() + days)
  return startOfDay(d)
}

function clampDate(date: Date, min: Date, max: Date): Date {
  if (date < min) return min
  if (date > max) return max
  return date
}

export function TimelineBrush({
  start,
  end,
  onRangeChange,
  volumeData,
  minDate: minDateProp,
  maxDate: maxDateProp,
  className,
}: TimelineBrushProps) {
  const trackRef = React.useRef<HTMLDivElement>(null)

  // Derive the earliest date that has data (for clamping drag & viewport)
  const dataMinDate = React.useMemo(() => {
    if (volumeData && volumeData.length > 0) {
      return startOfDay(new Date(volumeData[0].date))
    }
    return null
  }, [volumeData])

  const absoluteFloor = React.useMemo(
    () => new Date(ABSOLUTE_MIN_YEAR, 0, 1),
    [],
  )

  // The effective earliest date: data boundary if available, else absolute floor
  const effectiveMinDate = dataMinDate ?? absoluteFloor

  const [viewMin, setViewMin] = React.useState<Date>(
    () => minDateProp ?? startOfDay(addMonths(new Date(), -12)),
  )
  const [viewMax, setViewMax] = React.useState<Date>(
    () => maxDateProp ?? startOfDay(new Date()),
  )

  // Local drag state (not committed until pointer-up)
  const [dragStart, setDragStart] = React.useState<Date | null>(null)
  const [dragEnd, setDragEnd] = React.useState<Date | null>(null)
  const [dragType, setDragType] = React.useState<
    'left' | 'right' | 'move' | null
  >(null)
  const [dragPointerX, setDragPointerX] = React.useState<number | null>(null)
  const dragOriginRef = React.useRef<{
    pointerX: number
    startDate: Date
    endDate: Date
  } | null>(null)

  // Hover state for "no data" tooltip
  const [hoverPct, setHoverPct] = React.useState<number | null>(null)

  const displayStart = dragStart ?? start
  const displayEnd = dragEnd ?? end

  // Auto-expand viewport if selection approaches edges
  React.useEffect(() => {
    if (dragType) return
    const totalDays = differenceInCalendarDays(viewMax, viewMin)
    const edgeThreshold = totalDays * 0.05
    const startDays = differenceInCalendarDays(start, viewMin)
    const endDays = differenceInCalendarDays(viewMax, end)

    if (startDays < edgeThreshold) {
      const newMin = startOfDay(addMonths(viewMin, -3))
      const clamped = newMin < effectiveMinDate ? effectiveMinDate : newMin
      if (clamped.getTime() !== viewMin.getTime()) {
        setViewMin(clamped)
      }
    }
    if (endDays < edgeThreshold) {
      const newMax = startOfDay(addMonths(viewMax, 3))
      const today = startOfDay(new Date())
      const clamped = newMax > today ? today : newMax
      if (clamped.getTime() !== viewMax.getTime()) {
        setViewMax(clamped)
      }
    }
  }, [start, end, viewMin, viewMax, dragType, effectiveMinDate])

  // Month labels
  const months = React.useMemo(
    () =>
      eachMonthOfInterval({ start: viewMin, end: viewMax }).map((d) => ({
        date: d,
        label: format(d, 'MMM'),
        year: d.getFullYear(),
        pct: dateToPercent(d, viewMin, viewMax),
      })),
    [viewMin, viewMax],
  )

  // Year labels — one per year, positioned at January or the first visible month
  const yearLabels = React.useMemo(() => {
    const seen = new Map<number, number>()
    for (const m of months) {
      if (!seen.has(m.year)) {
        seen.set(m.year, m.pct)
      }
    }
    return [...seen.entries()].map(([year, pct]) => ({ year, pct }))
  }, [months])

  // Tick marks: one tall tick per month boundary, subdivided ticks between months
  const ticks = React.useMemo(() => {
    const result: Array<{ pct: number; isMonthBoundary: boolean }> = []

    for (let i = 0; i < months.length; i++) {
      const m = months[i]
      // Tall tick at month boundary
      result.push({ pct: m.pct, isMonthBoundary: true })

      // Subdivide the gap between this month and next into 4 small ticks
      if (i < months.length - 1) {
        const nextPct = months[i + 1].pct
        const gap = nextPct - m.pct
        for (let s = 1; s <= 3; s++) {
          result.push({
            pct: m.pct + (gap * s) / 4,
            isMonthBoundary: false,
          })
        }
      }
    }

    return result
  }, [months])

  // Data boundary as percentage (areas before this are "no data")
  const dataBoundaryPct = React.useMemo(() => {
    if (!dataMinDate) return null
    if (isBefore(dataMinDate, viewMin)) return null // all visible area has data
    return dateToPercent(dataMinDate, viewMin, viewMax)
  }, [dataMinDate, viewMin, viewMax])

  // SVG area chart path
  const areaPath = React.useMemo(() => {
    if (!volumeData || volumeData.length === 0) return null
    const maxCount = Math.max(...volumeData.map((d) => d.count))
    if (maxCount === 0) return null

    const points = volumeData.map((d) => ({
      x: dateToPercent(new Date(d.date), viewMin, viewMax),
      y: 1 - d.count / maxCount,
    }))

    const pathParts = points.map(
      (p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y * 100}`,
    )

    const lastX = points[points.length - 1].x
    const firstX = points[0].x
    const areaD = `${pathParts.join(' ')} L ${lastX} 100 L ${firstX} 100 Z`

    return areaD
  }, [volumeData, viewMin, viewMax])

  // Check if a date is in the "no data" zone
  const isInNoDataZone = React.useCallback(
    (pct: number): boolean => {
      if (dataBoundaryPct === null) return false
      return pct < dataBoundaryPct
    },
    [dataBoundaryPct],
  )

  // Hover tooltip for "no data" zone
  const noDataTooltip = React.useMemo(() => {
    if (dragType) return null // Don't show during drag
    if (hoverPct === null) return null
    if (!isInNoDataZone(hoverPct)) return null
    return { pct: hoverPct }
  }, [hoverPct, dragType, isInNoDataZone])

  // Track hover for no-data tooltip
  const handleTrackHover = (e: React.PointerEvent) => {
    if (dragType) return
    const pct = getPointerPercent(e)
    setHoverPct(pct)
  }

  const handleTrackLeave = () => {
    setHoverPct(null)
  }

  // Pointer helpers
  const getPointerPercent = (e: React.PointerEvent | PointerEvent): number => {
    const track = trackRef.current
    if (!track) return 0
    const rect = track.getBoundingClientRect()
    return Math.max(
      0,
      Math.min(100, ((e.clientX - rect.left) / rect.width) * 100),
    )
  }

  const handlePointerDown = (
    e: React.PointerEvent,
    type: 'left' | 'right' | 'move',
  ) => {
    e.preventDefault()
    e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    setDragType(type)
    setDragStart(displayStart)
    setDragEnd(displayEnd)
    setDragPointerX(getPointerPercent(e))
    setHoverPct(null) // Hide no-data tooltip during drag
    dragOriginRef.current = {
      pointerX: getPointerPercent(e),
      startDate: displayStart,
      endDate: displayEnd,
    }
  }

  // Clamp a date to not go before data boundary
  const clampToData = React.useCallback(
    (date: Date): Date => {
      if (dataMinDate && isBefore(date, dataMinDate)) return dataMinDate
      return date
    },
    [dataMinDate],
  )

  const handlePointerMove = (e: React.PointerEvent) => {
    // Update hover for no-data tooltip
    if (!dragType) {
      handleTrackHover(e)
      return
    }
    if (!dragOriginRef.current) return
    const pct = getPointerPercent(e)
    setDragPointerX(pct)
    const origin = dragOriginRef.current

    if (dragType === 'left') {
      let newStart = percentToDate(pct, viewMin, viewMax)
      newStart = clampDate(newStart, viewMin, viewMax)
      newStart = clampToData(newStart)
      const maxStart = new Date(displayEnd)
      maxStart.setDate(maxStart.getDate() - MIN_SELECTION_DAYS)
      if (newStart > maxStart) newStart = maxStart
      setDragStart(newStart)
    } else if (dragType === 'right') {
      let newEnd = percentToDate(pct, viewMin, viewMax)
      newEnd = clampDate(newEnd, viewMin, viewMax)
      const minEnd = new Date(displayStart)
      minEnd.setDate(minEnd.getDate() + MIN_SELECTION_DAYS)
      if (newEnd < minEnd) newEnd = minEnd
      setDragEnd(newEnd)
    } else {
      // dragType === 'move'
      const deltaPct = pct - origin.pointerX
      const totalDays = differenceInCalendarDays(viewMax, viewMin)
      const deltaDays = Math.round((deltaPct / 100) * totalDays)
      let newStart = new Date(origin.startDate)
      let newEnd = new Date(origin.endDate)
      newStart.setDate(newStart.getDate() + deltaDays)
      newEnd.setDate(newEnd.getDate() + deltaDays)
      newStart = startOfDay(newStart)
      newEnd = startOfDay(newEnd)

      // Clamp to viewport
      if (newStart < viewMin) {
        const diff = differenceInCalendarDays(viewMin, newStart)
        newStart = viewMin
        newEnd = new Date(newEnd)
        newEnd.setDate(newEnd.getDate() + diff)
      }
      if (newEnd > viewMax) {
        const diff = differenceInCalendarDays(newEnd, viewMax)
        newEnd = viewMax
        newStart = new Date(newStart)
        newStart.setDate(newStart.getDate() - diff)
      }
      newStart = clampDate(newStart, viewMin, viewMax)
      newEnd = clampDate(newEnd, viewMin, viewMax)

      // Prevent moving into no-data zone
      newStart = clampToData(newStart)

      setDragStart(newStart)
      setDragEnd(newEnd)
    }
  }

  const handlePointerUp = () => {
    if (dragType && dragStart && dragEnd) {
      if (!isEqual(dragStart, start) || !isEqual(dragEnd, end)) {
        onRangeChange(dragStart, dragEnd)
      }
    }
    setDragType(null)
    setDragStart(null)
    setDragEnd(null)
    setDragPointerX(null)
    dragOriginRef.current = null
  }

  const scrollTimeline = (direction: 'left' | 'right') => {
    const step = direction === 'left' ? -3 : 3
    const today = startOfDay(new Date())
    let newMin = startOfDay(addMonths(viewMin, step))
    let newMax = startOfDay(addMonths(viewMax, step))

    // Clamp: don't go before data floor
    if (newMin < effectiveMinDate) {
      newMin = effectiveMinDate
    }

    // Clamp: don't go past today
    if (newMax > today) newMax = today

    // Enforce max viewport span
    const spanMonths =
      (newMax.getFullYear() - newMin.getFullYear()) * 12 +
      (newMax.getMonth() - newMin.getMonth())
    if (spanMonths > MAX_VIEWPORT_MONTHS) {
      if (direction === 'left') {
        newMin = startOfDay(addMonths(newMax, -MAX_VIEWPORT_MONTHS))
        if (newMin < effectiveMinDate) newMin = effectiveMinDate
      } else {
        newMax = startOfDay(addMonths(newMin, MAX_VIEWPORT_MONTHS))
        if (newMax > today) newMax = today
      }
    }

    setViewMin(newMin)
    setViewMax(newMax)
  }

  // Can we scroll left further?
  const canScrollLeft =
    !isEqual(viewMin, effectiveMinDate) && isBefore(effectiveMinDate, viewMin)

  const leftPct = dateToPercent(displayStart, viewMin, viewMax)
  const rightPct = dateToPercent(displayEnd, viewMin, viewMax)
  const widthPct = rightPct - leftPct

  // Selection label
  const selectionLabel = React.useMemo(() => {
    const s = format(displayStart, 'MMM dd')
    const e = format(displayEnd, 'MMM dd, yyyy')
    return `${s} - ${e}`
  }, [displayStart, displayEnd])

  // Tooltip date during drag
  const tooltipDate = React.useMemo(() => {
    if (dragPointerX === null || !dragType) return null
    const date = percentToDate(dragPointerX, viewMin, viewMax)
    return { pct: dragPointerX, label: format(date, 'MMM d') }
  }, [dragPointerX, dragType, viewMin, viewMax])

  return (
    <div className={cn('hidden md:block select-none', className)}>
      <div className="flex items-center gap-1.5">
        {/* Scroll left */}
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          onClick={() => scrollTimeline('left')}
          disabled={!canScrollLeft}
        >
          <ChevronLeft />
        </Button>

        {/* Track */}
        <div
          ref={trackRef}
          className="relative h-14 min-w-0 flex-1"
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={handleTrackLeave}
        >
          {/* No-data overlay zone */}
          {dataBoundaryPct !== null && dataBoundaryPct > 0 && (
            <div
              className="absolute inset-y-0 left-0 cursor-not-allowed"
              style={{ width: `${dataBoundaryPct}%` }}
            />
          )}

          {/* SVG area chart background */}
          {areaPath && (
            <svg
              className="absolute inset-0 h-full w-full overflow-hidden"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <path d={areaPath} className="fill-muted-foreground/10" />
            </svg>
          )}

          {/* Tick marks */}
          {ticks.map((tick, i) => (
            <div
              key={i}
              className={cn(
                'absolute bottom-0 w-px transition-all duration-150',
                tick.isMonthBoundary
                  ? 'h-1.5 bg-muted-foreground/30'
                  : 'h-[3px] bg-muted-foreground/15',
                dragType &&
                  dragPointerX !== null &&
                  Math.abs(tick.pct - dragPointerX) < 5 &&
                  'bg-muted-foreground/60',
              )}
              style={{
                left: `${tick.pct}%`,
                height:
                  dragType &&
                  dragPointerX !== null &&
                  Math.abs(tick.pct - dragPointerX) < 5
                    ? `${Math.max(
                        tick.isMonthBoundary ? 6 : 3,
                        (tick.isMonthBoundary ? 12 : 8) *
                          (1 - Math.abs(tick.pct - dragPointerX) / 5),
                      )}px`
                    : undefined,
              }}
            />
          ))}

          {/* Year labels — top row */}
          {yearLabels.map((yl, i) => {
            const isFirst = i === 0
            const isLast = i === yearLabels.length - 1
            const transform = isFirst
              ? 'translateX(0)'
              : isLast
                ? 'translateX(-100%)'
                : 'translateX(-50%)'
            return (
              <div
                key={yl.year}
                className="pointer-events-none absolute top-0 text-[10px] font-medium text-muted-foreground/80"
                style={{ left: `${yl.pct}%`, transform }}
              >
                {yl.year}
              </div>
            )
          })}

          {/* Month labels — second row */}
          {months.map((m, i) => {
            const isFirst = i === 0
            const isLast = i === months.length - 1
            const transform = isFirst
              ? 'translateX(0)'
              : isLast
                ? 'translateX(-100%)'
                : 'translateX(-50%)'
            return (
              <div
                key={i}
                className="pointer-events-none absolute top-3.5 text-[10px] text-muted-foreground/60"
                style={{ left: `${m.pct}%`, transform }}
              >
                {m.label}
              </div>
            )
          })}

          {/* Selection region */}
          <div
            className="absolute inset-y-0 cursor-grab rounded border border-primary bg-primary/10 active:cursor-grabbing"
            style={{
              left: `${leftPct}%`,
              width: `${widthPct}%`,
            }}
            onPointerDown={(e) => handlePointerDown(e, 'move')}
          >
            {/* Selection label */}
            {widthPct > 15 && (
              <div className="pointer-events-none flex h-full items-center justify-center">
                <span className="whitespace-nowrap text-[10px] font-medium text-primary">
                  {selectionLabel}
                </span>
              </div>
            )}
          </div>

          {/* Left handle */}
          <div
            className="absolute inset-y-1 w-1.5 cursor-col-resize rounded-full bg-primary"
            style={{ left: `${leftPct}%`, transform: 'translateX(-50%)' }}
            onPointerDown={(e) => handlePointerDown(e, 'left')}
          />

          {/* Right handle */}
          <div
            className="absolute inset-y-1 w-1.5 cursor-col-resize rounded-full bg-primary"
            style={{ left: `${rightPct}%`, transform: 'translateX(-50%)' }}
            onPointerDown={(e) => handlePointerDown(e, 'right')}
          />

          {/* Drag tooltip */}
          {tooltipDate && (
            <div
              className="absolute -bottom-7 z-20 -translate-x-1/2 rounded bg-foreground px-2 py-0.5 text-[11px] font-medium text-background"
              style={{ left: `${tooltipDate.pct}%` }}
            >
              {tooltipDate.label}
            </div>
          )}

          {/* No-data hover tooltip */}
          {noDataTooltip && (
            <div
              className="absolute -bottom-7 z-20 -translate-x-1/2 rounded bg-muted-foreground px-2 py-0.5 text-[11px] font-medium text-background"
              style={{ left: `${noDataTooltip.pct}%` }}
            >
              No data available
            </div>
          )}
        </div>

        {/* Scroll right */}
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          onClick={() => scrollTimeline('right')}
          disabled={isEqual(viewMax, startOfDay(new Date()))}
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  )
}
