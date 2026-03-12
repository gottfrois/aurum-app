import * as React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useAction } from 'convex/react'
import {
  ArrowLeftRight,
  Landmark,
  LayoutDashboard,
  Loader2,
  Settings,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../convex/_generated/api'
import type { FilterCondition } from '~/lib/filters/types'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '~/components/ui/command'
import { serializeFilterConfig } from '~/lib/filters/ai/prompt'
import { createTransactionFilterConfig } from '~/lib/filters/transactions'

const NAV_ITEMS = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard },
  { title: 'Transactions', url: '/transactions', icon: ArrowLeftRight },
  { title: 'Accounts', url: '/accounts', icon: Landmark },
  { title: 'Settings', url: '/settings', icon: Settings },
] as const

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
  const [open, setOpen] = React.useState(false)
  const [aiMode, setAIMode] = React.useState(false)
  const [aiQuery, setAIQuery] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const navigate = useNavigate()
  const askAI = useAction(api.aiFilters.askAI)

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleOpenChange = (value: boolean) => {
    setOpen(value)
    if (!value) {
      setAIMode(false)
      setAIQuery('')
      setLoading(false)
    }
  }

  const handleNav = (url: string) => {
    setOpen(false)
    void navigate({ to: url })
  }

  const handleAISubmit = async (query: string) => {
    const trimmed = query.trim()
    if (!trimmed || loading) return

    setLoading(true)
    try {
      // Use empty deps for serialization — enum options won't be available
      // but the field metadata (names, types, operators) is sufficient
      const config = createTransactionFilterConfig({
        accountOptions: [],
        categoryOptions: [],
        transactionTypeOptions: [],
      })
      const fields = serializeFilterConfig(config)
      const conditions = await askAI({ query: trimmed, fields })

      if (conditions.length === 0) {
        toast.info("Couldn't interpret that, try rephrasing")
        setLoading(false)
        return
      }

      setOpen(false)
      void navigate({ to: '/transactions' })
      // Dispatch after a tick so the transactions page can mount and listen
      setTimeout(() => dispatchAIFilters(conditions), 100)
    } catch {
      toast.error('Failed to generate filters')
    } finally {
      setLoading(false)
    }
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Command Palette"
      description="Search for pages or use AI to filter data"
    >
      {aiMode ? (
        <>
          <div className="flex items-center gap-2 border-b px-3 h-12">
            <Sparkles className="size-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
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
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            <p>Try something like:</p>
            <p className="mt-1 text-xs italic">
              &ldquo;food expenses over 50€ from last month&rdquo;
            </p>
          </div>
        </>
      ) : (
        <>
          <CommandInput placeholder="Type a command or search..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Navigation">
              {NAV_ITEMS.map((item) => (
                <CommandItem
                  key={item.url}
                  onSelect={() => handleNav(item.url)}
                >
                  <item.icon />
                  <span>{item.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="AI">
              <CommandItem onSelect={() => setAIMode(true)}>
                <Sparkles />
                <span>Ask AI to filter...</span>
                <CommandShortcut>AI</CommandShortcut>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </>
      )}
    </CommandDialog>
  )
}
