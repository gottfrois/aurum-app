import { useAction } from 'convex/react'
import { ChevronRight, ListFilter, Loader2, Sparkles } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'
import { Button } from '~/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '~/components/ui/command'
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover'
import { serializeFilterConfig } from '~/lib/filters/ai/prompt'
import { VALUELESS_OPERATORS } from '~/lib/filters/operators'
import type {
  FilterCondition,
  FilterConfig,
  FilterFieldDescriptor,
} from '~/lib/filters/types'
import { api } from '../../../convex/_generated/api'
import { FilterValueInput } from './filter-value-input'

interface FilterDropdownProps {
  config: FilterConfig
  onAdd: (condition: FilterCondition) => void
  onUpdate: (id: string, updates: Partial<Omit<FilterCondition, 'id'>>) => void
  onRemove: (id: string) => void
  onLoadConditions?: (conditions: Array<FilterCondition>) => void
  trigger?: React.ReactNode
}

export function FilterDropdown({
  config,
  onAdd,
  onUpdate,
  onRemove,
  onLoadConditions,
  trigger,
}: FilterDropdownProps) {
  const [open, setOpen] = React.useState(false)
  const [hoveredField, setHoveredField] =
    React.useState<FilterFieldDescriptor | null>(null)
  const [pendingValue, setPendingValue] = React.useState<unknown>(undefined)
  const [subSide, setSubSide] = React.useState<'right' | 'left'>('right')
  // Tracks a live condition created by enum checkbox toggling
  const [liveConditionId, setLiveConditionId] = React.useState<string | null>(
    null,
  )
  const [aiMode, setAIMode] = React.useState(false)
  const [aiQuery, setAIQuery] = React.useState('')
  const [aiLoading, setAILoading] = React.useState(false)
  const askAI = useAction(api.aiFilters.askAI)
  const closeTimeoutRef = React.useRef<ReturnType<typeof setTimeout>>(null)
  const triggerRef = React.useRef<HTMLSpanElement>(null)
  const [anchorRect, setAnchorRect] = React.useState<{
    top: number
    left: number
  } | null>(null)

  const reset = () => {
    setHoveredField(null)
    setPendingValue(undefined)
    setLiveConditionId(null)
    setAIMode(false)
    setAIQuery('')
    setAILoading(false)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setAnchorRect({ top: rect.bottom + 4, left: rect.left })
    }
    if (!nextOpen && liveConditionId) {
      const isEmpty =
        pendingValue === undefined ||
        pendingValue === null ||
        (Array.isArray(pendingValue) && pendingValue.length === 0)
      if (isEmpty) {
        onRemove(liveConditionId)
      }
    }
    setOpen(nextOpen)
    if (!nextOpen) {
      reset()
      setAnchorRect(null)
    }
  }

  const [subTop, setSubTop] = React.useState(0)

  const handleFieldHover = (
    field: FilterFieldDescriptor,
    e: React.MouseEvent,
  ) => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }

    // Determine which side has more space
    const item = e.currentTarget as HTMLElement
    const rect = item.getBoundingClientRect()
    const spaceRight = window.innerWidth - rect.right
    const spaceLeft = rect.left
    setSubSide(
      spaceRight >= 280 ? 'right' : spaceLeft >= 280 ? 'left' : 'right',
    )

    // Position submenu vertically aligned with the hovered item
    const container = item.closest('[data-filter-container]') as HTMLElement
    const containerRect = container.getBoundingClientRect()
    setSubTop(rect.top - containerRect.top)

    if (hoveredField?.name !== field.name) {
      // Clean up live condition from previous field if empty
      if (liveConditionId) {
        const isEmpty =
          pendingValue === undefined ||
          pendingValue === null ||
          (Array.isArray(pendingValue) && pendingValue.length === 0)
        if (isEmpty) {
          onRemove(liveConditionId)
        }
        setLiveConditionId(null)
      }
      setHoveredField(field)
      setPendingValue(field.valueType === 'enum' ? [] : undefined)
    }
  }

  const handleFieldLeave = () => {
    closeTimeoutRef.current = setTimeout(() => {
      // Clean up live condition if empty
      if (liveConditionId) {
        const isEmpty =
          pendingValue === undefined ||
          pendingValue === null ||
          (Array.isArray(pendingValue) && pendingValue.length === 0)
        if (isEmpty) {
          onRemove(liveConditionId)
        }
        setLiveConditionId(null)
      }
      setHoveredField(null)
      setPendingValue(undefined)
    }, 150)
  }

  const handleSubEnter = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }
  }

  const handleSubLeave = () => {
    handleFieldLeave()
  }

  const handleFieldClick = (field: FilterFieldDescriptor) => {
    const op = field.defaultOperator
    if (VALUELESS_OPERATORS.has(op)) {
      onAdd({
        id: crypto.randomUUID(),
        field: field.name,
        operator: op,
        value: null,
      })
      reset()
      setOpen(false)
    }
  }

  const handleValueChange = (newValue: unknown) => {
    setPendingValue(newValue)
  }

  const handleAutoApply = (value: unknown) => {
    if (!hoveredField) return
    onAdd({
      id: crypto.randomUUID(),
      field: hoveredField.name,
      operator: hoveredField.defaultOperator,
      value,
    })
    reset()
    setOpen(false)
  }

  const handleToggle = (newValue: unknown) => {
    if (!hoveredField) return
    setPendingValue(newValue)

    if (liveConditionId) {
      // Update existing condition
      onUpdate(liveConditionId, { value: newValue })
    } else {
      // Create condition on first toggle
      const id = crypto.randomUUID()
      onAdd({
        id,
        field: hoveredField.name,
        operator: hoveredField.defaultOperator,
        value: newValue,
      })
      setLiveConditionId(id)
    }
  }

  const handleAISubmit = async () => {
    const trimmed = aiQuery.trim()
    if (!trimmed || aiLoading || !onLoadConditions) return

    setAILoading(true)
    try {
      const fields = serializeFilterConfig(config)
      const conditions = await askAI({ query: trimmed, fields })
      if (conditions.length === 0) {
        toast.info("Couldn't interpret that, try rephrasing")
      } else {
        onLoadConditions(conditions)
        reset()
        setOpen(false)
      }
    } catch {
      toast.error('Failed to generate filters')
    } finally {
      setAILoading(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <span ref={triggerRef} className="inline-flex">
          {trigger ?? (
            <Button variant="ghost" size="icon" className="rounded-full">
              <ListFilter />
            </Button>
          )}
        </span>
      </PopoverTrigger>
      {anchorRect && (
        <PopoverAnchor
          style={{
            position: 'fixed',
            top: anchorRect.top,
            left: anchorRect.left,
            width: 0,
            height: 0,
            pointerEvents: 'none',
          }}
        />
      )}
      <PopoverContent className="w-[220px] p-0" align="start">
        <div className="relative" data-filter-container>
          {aiMode ? (
            <div className="flex flex-col">
              <div className="flex items-center gap-2 border-b px-3 py-2">
                <Sparkles className="size-4 shrink-0 text-muted-foreground" />
                <input
                  value={aiQuery}
                  onChange={(e) => setAIQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleAISubmit()
                    if (e.key === 'Escape') {
                      e.preventDefault()
                      setAIMode(false)
                      setAIQuery('')
                    }
                  }}
                  placeholder="Describe your filter..."
                  className="flex h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
                  disabled={aiLoading}
                />
                {aiLoading && (
                  <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
                )}
              </div>
              <p className="px-3 py-3 text-xs text-muted-foreground">
                e.g. &ldquo;food expenses over 50€ last month&rdquo;
              </p>
            </div>
          ) : (
            <Command>
              <CommandInput placeholder="Filter by..." />
              <CommandList>
                <CommandEmpty>No fields found.</CommandEmpty>
                {onLoadConditions && (
                  <CommandGroup>
                    <CommandItem onSelect={() => setAIMode(true)}>
                      <Sparkles className="size-4 text-muted-foreground" />
                      Ask AI
                    </CommandItem>
                  </CommandGroup>
                )}
                <CommandGroup heading="Fields">
                  {config.fields.map((field) => {
                    const isValueless = VALUELESS_OPERATORS.has(
                      field.defaultOperator,
                    )
                    return (
                      <CommandItem
                        key={field.name}
                        value={field.label}
                        onSelect={() => handleFieldClick(field)}
                        onMouseEnter={(e) => handleFieldHover(field, e)}
                        onMouseLeave={handleFieldLeave}
                        className="justify-between"
                      >
                        <span className="flex items-center gap-2">
                          {field.icon && (
                            <field.icon className="size-4 text-muted-foreground" />
                          )}
                          {field.label}
                        </span>
                        {!isValueless && (
                          <ChevronRight className="size-3.5 text-muted-foreground" />
                        )}
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          )}

          {hoveredField &&
            !VALUELESS_OPERATORS.has(hoveredField.defaultOperator) && (
              <SubPanel
                field={hoveredField}
                value={pendingValue}
                side={subSide}
                top={subTop}
                onChange={handleValueChange}
                onAutoApply={handleAutoApply}
                onToggle={handleToggle}
                onMouseEnter={handleSubEnter}
                onMouseLeave={handleSubLeave}
              />
            )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function SubPanel({
  field,
  value,
  side,
  top,
  onChange,
  onAutoApply,
  onToggle,
  onMouseEnter,
  onMouseLeave,
}: {
  field: FilterFieldDescriptor
  value: unknown
  side: 'right' | 'left'
  top: number
  onChange: (value: unknown) => void
  onAutoApply: (value: unknown) => void
  onToggle: (value: unknown) => void
  onMouseEnter: () => void
  onMouseLeave: () => void
}) {
  const positionClass = side === 'right' ? 'left-full ml-1' : 'right-full mr-1'

  const latestValueRef = React.useRef(value)
  latestValueRef.current = value

  const autoApplyOnChange = (newValue: unknown) => {
    onChange(newValue)
    latestValueRef.current = newValue
  }

  const autoApplyOnApply = () => {
    onAutoApply(latestValueRef.current)
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: mouse enter/leave on this container is used for hover-based submenu behavior, not for interactive actions
    <div
      className={`absolute ${positionClass} z-50 w-[280px] rounded-md border bg-popover shadow-md`}
      style={{ top }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <FilterValueInput
        field={field}
        operator={field.defaultOperator}
        value={value}
        onChange={autoApplyOnChange}
        onApply={autoApplyOnApply}
        onToggle={onToggle}
      />
    </div>
  )
}
