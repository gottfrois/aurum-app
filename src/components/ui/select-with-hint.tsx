import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { cn } from '~/lib/utils'

export interface SelectWithHintOption {
  value: string
  label: string
  /** Secondary muted text shown to the right of the label. */
  hint: string
}

export interface SelectWithHintProps {
  value: string
  onValueChange: (value: string) => void
  options: ReadonlyArray<SelectWithHintOption>
  /** Accessible label for the trigger. */
  ariaLabel?: string
  placeholder?: string
  disabled?: boolean
  className?: string
}

/**
 * A Select where each option pairs a label with a secondary muted "hint"
 * (e.g. a preview value, an offset, or a unit). The hint is rendered in a
 * monospace, tabular-nums style and is also shown in the trigger when an
 * option is selected.
 */
export function SelectWithHint({
  value,
  onValueChange,
  options,
  ariaLabel,
  placeholder,
  disabled,
  className,
}: SelectWithHintProps) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger
        aria-label={ariaLabel}
        className={cn(
          'w-fit focus:shadow-none focus:ring-0 focus:ring-offset-0',
          className,
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            <span className="flex items-center justify-between gap-3">
              <span>{option.label}</span>
              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                {option.hint}
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
