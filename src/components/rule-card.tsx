import { GripVertical, MoreHorizontal } from 'lucide-react'
import * as React from 'react'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover'
import { SortableItemHandle } from '~/components/ui/sortable'
import { Switch } from '~/components/ui/switch'
import type { Doc, Id } from '../../convex/_generated/dataModel'

interface RuleCardProps {
  rule: Doc<'transactionRules'>
  index: number
  categoryMap: Map<string, Doc<'transactionCategories'>>
  labelMap: Map<Id<'transactionLabels'>, Doc<'transactionLabels'>>
  dragDisabled: boolean
  onEdit: () => void
  onDelete: () => void
  onToggle: (enabled: boolean) => void
}

export function RuleCard({
  rule,
  index,
  categoryMap,
  labelMap,
  dragDisabled,
  onEdit,
  onDelete,
  onToggle,
}: RuleCardProps) {
  const category = rule.categoryKey
    ? categoryMap.get(rule.categoryKey)
    : undefined
  const ruleLabels = (rule.labelIds ?? [])
    .map((id) => labelMap.get(id))
    .filter(Boolean) as Doc<'transactionLabels'>[]

  const isRegex = rule.matchType === 'regex'
  const patternDisplay = isRegex ? `/${rule.pattern}/` : `"${rule.pattern}"`
  const matchVerb = isRegex ? 'matches' : 'contains'

  const actions = buildActions(
    category,
    ruleLabels,
    rule.excludeFromBudget,
    rule.customDescription,
  )
  const isEnabled = rule.enabled !== false

  return (
    <div className="flex gap-3 rounded-lg border bg-card p-3">
      <SortableItemHandle
        className={`flex shrink-0 self-center ${dragDisabled ? 'pointer-events-none opacity-30' : ''}`}
      >
        <GripVertical className="size-4 text-muted-foreground" />
      </SortableItemHandle>

      <span className="w-5 shrink-0 self-center text-center text-xs tabular-nums text-muted-foreground">
        {index + 1}
      </span>

      <div className={`min-w-0 flex-1 ${!isEnabled ? 'opacity-50' : ''}`}>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-muted-foreground">When transaction</span>
          <Badge variant="outline" className="rounded-md text-xs">
            {matchVerb}
          </Badge>
          <span className="truncate font-mono">{patternDisplay}</span>
        </div>

        {actions.length > 0 && (
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {actions.map((action, i) => (
              <React.Fragment key={action.key}>
                <span className="text-muted-foreground">
                  {i === 0
                    ? `then ${action.connector}`
                    : i === actions.length - 1
                      ? `and ${action.connector}`
                      : action.connector}
                </span>
                {action.element}
                {i < actions.length - 1 && i !== actions.length - 2 && (
                  <span className="text-muted-foreground">,</span>
                )}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      <Switch
        checked={isEnabled}
        onCheckedChange={onToggle}
        className="shrink-0 self-center"
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 self-center"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
          <DropdownMenuItem className="text-destructive" onClick={onDelete}>
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

interface RuleAction {
  key: string
  connector: string
  element: React.ReactNode
}

function buildActions(
  category: Doc<'transactionCategories'> | undefined,
  labels: Doc<'transactionLabels'>[],
  excludeFromBudget: boolean | undefined,
  customDescription: string | undefined,
): RuleAction[] {
  const actions: RuleAction[] = []

  if (category) {
    actions.push({
      key: 'category',
      connector: 'assign',
      element: (
        <Badge variant="outline" className="rounded-md">
          <span
            className="mr-1 inline-block size-2 rounded-full"
            style={{ backgroundColor: category.color }}
          />
          {category.label}
        </Badge>
      ),
    })
  }

  if (labels.length === 1) {
    actions.push({
      key: `label-${labels[0]._id}`,
      connector: 'add',
      element: (
        <Badge variant="outline" className="rounded-md">
          <span
            className="mr-1 inline-block size-2 rounded-full"
            style={{ backgroundColor: labels[0].color }}
          />
          {labels[0].name}
        </Badge>
      ),
    })
  } else if (labels.length > 1) {
    actions.push({
      key: 'labels',
      connector: 'add',
      element: (
        <CollapsedBadges
          items={labels.map((l) => ({ color: l.color, name: l.name }))}
          count={labels.length}
          noun="label"
        />
      ),
    })
  }

  if (excludeFromBudget) {
    actions.push({
      key: 'budget',
      connector: 'exclude from',
      element: (
        <Badge variant="outline" className="rounded-md">
          Budget
        </Badge>
      ),
    })
  }

  if (customDescription) {
    actions.push({
      key: 'description',
      connector: 'change description to',
      element: (
        <Badge variant="outline" className="rounded-md">
          {customDescription}
        </Badge>
      ),
    })
  }

  return actions
}

function CollapsedBadges({
  items,
  count,
  noun,
}: {
  items: Array<{ color: string; name: string }>
  count: number
  noun: string
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Badge
          variant="outline"
          className="cursor-pointer rounded-md hover:bg-accent"
        >
          {count} {noun}s
        </Badge>
      </PopoverTrigger>
      <PopoverContent className="w-auto min-w-40 p-2">
        <div className="flex flex-col gap-1">
          {items.map((item) => (
            <div
              key={item.name}
              className="flex items-center gap-2 rounded-md px-2 py-1"
            >
              <span
                className="inline-block size-2 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-sm">{item.name}</span>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
