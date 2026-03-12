import * as React from 'react'
import { useMutation } from 'convex/react'
import { Check, ChevronsUpDown, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
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
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover'
import { Badge } from '~/components/ui/badge'
import { cn } from '~/lib/utils'

const LABEL_COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
]

export interface LabelData {
  _id: string
  name: string
  color: string
}

interface LabelPickerProps {
  labels: Array<LabelData>
  selectedLabelIds: Array<string>
  workspaceId: string
  onToggle: (labelIds: Array<string>) => void
}

export function LabelPicker({
  labels,
  selectedLabelIds,
  workspaceId,
  onToggle,
}: LabelPickerProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const createLabel = useMutation(api.labels.createLabel)

  const selectedLabels = labels.filter((l) => selectedLabelIds.includes(l._id))

  const handleToggle = (labelId: string) => {
    const next = selectedLabelIds.includes(labelId)
      ? selectedLabelIds.filter((id) => id !== labelId)
      : [...selectedLabelIds, labelId]
    onToggle(next)
  }

  const handleCreate = async () => {
    const name = search.trim()
    if (!name) return

    try {
      const color = LABEL_COLORS[labels.length % LABEL_COLORS.length]
      const labelId = await createLabel({
        workspaceId: workspaceId as Id<'workspaces'>,
        name,
        color,
      })
      setSearch('')
      onToggle([...selectedLabelIds, labelId])
      toast.success(`Label "${name}" created`)
    } catch {
      toast.error('Failed to create label')
    }
  }

  const exactMatch = labels.some(
    (l) => l.name.toLowerCase() === search.trim().toLowerCase(),
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          role="combobox"
          aria-expanded={open}
          className="h-auto min-h-[28px] justify-start gap-1.5 px-2 py-1 font-normal"
        >
          {selectedLabels.length > 0 ? (
            <span className="flex flex-wrap gap-1">
              {selectedLabels.map((label) => (
                <Badge
                  key={label._id}
                  variant="secondary"
                  className="gap-1 px-1.5 py-0 text-xs"
                  style={{
                    backgroundColor: label.color + '20',
                    color: label.color,
                    borderColor: label.color + '40',
                  }}
                >
                  <span
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: label.color }}
                  />
                  {label.name}
                </Badge>
              ))}
            </span>
          ) : (
            <span className="text-muted-foreground">Add labels...</span>
          )}
          <ChevronsUpDown className="ml-auto size-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search or create label..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>
              {search.trim() ? (
                <button
                  className="flex w-full items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent"
                  onClick={handleCreate}
                >
                  <Plus className="size-3" />
                  Create &ldquo;{search.trim()}&rdquo;
                </button>
              ) : (
                'No labels found.'
              )}
            </CommandEmpty>
            {labels.length > 0 && (
              <CommandGroup>
                {labels.map((label) => (
                  <CommandItem
                    key={label._id}
                    value={label.name}
                    onSelect={() => handleToggle(label._id)}
                  >
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: label.color }}
                    />
                    <span>{label.name}</span>
                    <Check
                      className={cn(
                        'ml-auto size-3',
                        selectedLabelIds.includes(label._id)
                          ? 'opacity-100'
                          : 'opacity-0',
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {search.trim() && !exactMatch && labels.length > 0 && (
              <CommandGroup>
                <CommandItem onSelect={handleCreate}>
                  <Plus className="size-3" />
                  Create &ldquo;{search.trim()}&rdquo;
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
