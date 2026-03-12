import * as React from 'react'
import { useAction } from 'convex/react'
import { Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../../convex/_generated/api'
import type { FilterCondition, FilterConfig } from '~/lib/filters/types'
import { serializeFilterConfig } from '~/lib/filters/ai/prompt'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover'

interface AskAIFilterProps {
  config: FilterConfig
  onLoadConditions: (conditions: Array<FilterCondition>) => void
}

export function AskAIFilter({ config, onLoadConditions }: AskAIFilterProps) {
  const askAI = useAction(api.aiFilters.askAI)
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [loading, setLoading] = React.useState(false)

  const handleSubmit = async () => {
    const trimmed = query.trim()
    if (!trimmed) return

    setLoading(true)
    try {
      const fields = serializeFilterConfig(config)
      const conditions = await askAI({ query: trimmed, fields })
      if (conditions.length === 0) {
        toast.info("Couldn't interpret that, try rephrasing")
      } else {
        onLoadConditions(conditions)
        setQuery('')
        setOpen(false)
      }
    } catch {
      toast.error('Failed to generate filters')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5">
          <Sparkles className="size-3.5" />
          Ask AI
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-2" align="end">
        <div className="flex gap-2">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !loading) void handleSubmit()
              if (e.key === 'Escape') setOpen(false)
            }}
            placeholder="e.g. food expenses over 50€ last month"
            className="h-8 text-sm"
            disabled={loading}
          />
          <Button
            size="sm"
            className="h-8"
            onClick={() => void handleSubmit()}
            disabled={loading || !query.trim()}
          >
            {loading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
