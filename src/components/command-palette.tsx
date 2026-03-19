import { useAction } from 'convex/react'
import { Loader2, Sparkles } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '~/components/ui/command'
import { HotkeyDisplay } from '~/components/ui/kbd'
import type { CommandEntry } from '~/contexts/command-context'
import { useCommandRegistry } from '~/contexts/command-context'
import { serializeFilterConfig } from '~/lib/filters/ai/prompt'
import { createTransactionFilterConfig } from '~/lib/filters/transactions'
import type { FilterCondition } from '~/lib/filters/types'
import { api } from '../../convex/_generated/api'

// Event for passing AI-generated filters to the transactions page
const AI_FILTER_EVENT = 'bunkr:ai-filters'

export function dispatchAIFilters(conditions: Array<FilterCondition>) {
  window.dispatchEvent(new CustomEvent(AI_FILTER_EVENT, { detail: conditions }))
}

export function useAIFilterListener(
  onLoadConditions: (conditions: Array<FilterCondition>) => void,
) {
  React.useEffect(() => {
    const handler = (e: Event) => {
      const conditions = (e as CustomEvent<Array<FilterCondition>>).detail
      onLoadConditions(conditions)
    }
    window.addEventListener(AI_FILTER_EVENT, handler)
    return () => window.removeEventListener(AI_FILTER_EVENT, handler)
  }, [onLoadConditions])
}

export function CommandPalette() {
  const { commands, paletteState, setPaletteState } = useCommandRegistry()
  const [aiQuery, setAIQuery] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [activeCommandId, setActiveCommandId] = React.useState<string | null>(
    null,
  )
  const askAI = useAction(api.aiFilters.askAI)

  const open = paletteState.open
  const filterGroup = paletteState.filterGroup
  const aiMode = paletteState.aiMode ?? false

  const activeCommand = activeCommandId
    ? commands.find((c) => c.id === activeCommandId)
    : null

  const setAIMode = (value: boolean) => {
    setPaletteState((prev) => ({ ...prev, aiMode: value }))
  }

  const handleOpenChange = (value: boolean) => {
    setPaletteState({ open: value })
    if (!value) {
      setAIQuery('')
      setLoading(false)
      setActiveCommandId(null)
    }
  }

  const handleAISubmit = async (query: string) => {
    const trimmed = query.trim()
    if (!trimmed || loading) return

    setLoading(true)
    try {
      const config = createTransactionFilterConfig({
        accountOptions: [],
        categoryOptions: [],
        labelOptions: [],
        transactionTypeOptions: [],
      })
      const fields = serializeFilterConfig(config)
      const conditions = await askAI({ query: trimmed, fields })

      if (conditions.length === 0) {
        toast.info("Couldn't interpret that, try rephrasing")
        setLoading(false)
        return
      }

      setPaletteState({ open: false })
      // Dispatch after a tick so the transactions page can mount and listen
      setTimeout(() => dispatchAIFilters(conditions), 100)
    } catch {
      toast.error('Failed to generate filters')
    } finally {
      setLoading(false)
    }
  }

  // Group registered commands, filtering out hidden ones
  const groupedCommands = React.useMemo(() => {
    const visible = commands.filter((c) => !c.hidden && !c.disabled)
    const filtered = filterGroup
      ? visible.filter((c) => c.group === filterGroup)
      : visible
    const groups = new Map<string, typeof filtered>()
    for (const cmd of filtered) {
      const list = groups.get(cmd.group) ?? []
      list.push(cmd)
      groups.set(cmd.group, list)
    }
    return groups
  }, [commands, filterGroup])

  const handleCommandSelect = (cmd: CommandEntry) => {
    if (cmd.view) {
      setActiveCommandId(cmd.id)
    } else {
      setPaletteState({ open: false })
      cmd.handler()
    }
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Command Palette"
      description="Search for pages or use AI to filter data"
    >
      {activeCommand?.view ? (
        <div
          onKeyDownCapture={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              e.stopPropagation()
              setActiveCommandId(null)
            }
          }}
        >
          {activeCommand.view({ onBack: () => setActiveCommandId(null) })}
        </div>
      ) : aiMode ? (
        <>
          <div className="flex items-center gap-2 border-b px-3 h-12">
            <Sparkles className="size-4 shrink-0 text-muted-foreground" />
            <input
              value={aiQuery}
              onChange={(e) => setAIQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleAISubmit(aiQuery)
                if (e.key === 'Escape') {
                  e.preventDefault()
                  setAIMode(false)
                  setAIQuery('')
                }
              }}
              placeholder="Describe the filters you want..."
              className="flex h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              disabled={loading}
            />
            {loading && (
              <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
            )}
          </div>
          <div className="flex min-h-[300px] items-center justify-center px-4 py-6 text-center text-sm text-muted-foreground">
            <div>
              <p>Try something like:</p>
              <p className="mt-1 text-xs italic">
                &ldquo;food expenses over 50€ from last month&rdquo;
              </p>
            </div>
          </div>
        </>
      ) : (
        <>
          <CommandInput placeholder="Type a command or search..." />
          <CommandList className="min-h-[300px]">
            <CommandEmpty>No results found.</CommandEmpty>

            {[...groupedCommands.entries()].map(([group, cmds]) => (
              <React.Fragment key={group}>
                <CommandGroup heading={group}>
                  {cmds.map((cmd) => (
                    <CommandItem
                      key={cmd.id}
                      keywords={cmd.keywords}
                      onSelect={() => handleCommandSelect(cmd)}
                    >
                      {cmd.icon && <cmd.icon />}
                      <span>{cmd.label}</span>
                      {cmd.hotkey && (
                        <HotkeyDisplay
                          hotkey={cmd.hotkey}
                          className="ml-auto"
                        />
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
                {!filterGroup && <CommandSeparator />}
              </React.Fragment>
            ))}
          </CommandList>
        </>
      )}
    </CommandDialog>
  )
}
