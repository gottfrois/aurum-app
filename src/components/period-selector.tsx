import type { Period } from '~/lib/chart-periods'
import { PERIODS } from '~/lib/chart-periods'
import { ToggleGroup, ToggleGroupItem } from '~/components/ui/toggle-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'

interface PeriodSelectorProps {
  period: Period
  onPeriodChange: (period: Period) => void
}

export function PeriodSelector({
  period,
  onPeriodChange,
}: PeriodSelectorProps) {
  return (
    <>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={period}
        onValueChange={(val) => {
          if (val) onPeriodChange(val as Period)
        }}
        className="hidden @lg/card:flex"
      >
        {PERIODS.map((p) => (
          <ToggleGroupItem key={p} value={p}>
            {p}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <Select
        value={period}
        onValueChange={(val) => onPeriodChange(val as Period)}
      >
        <SelectTrigger size="sm" className="@lg/card:hidden w-auto gap-1">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PERIODS.map((p) => (
            <SelectItem key={p} value={p}>
              {p}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  )
}
