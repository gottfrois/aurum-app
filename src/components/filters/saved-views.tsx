import * as React from 'react'
import { useMutation, useQuery } from 'convex/react'
import { Bookmark, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import type { FilterCondition } from '~/lib/filters/types'
import { Button } from '~/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover'
import { deserializeFilters } from '~/lib/filters/serialize'

interface SavedViewsProps {
  entityType: string
  currentConditions: Array<FilterCondition>
  onLoadConditions: (conditions: Array<FilterCondition>) => void
}

export function SavedViews({ entityType, onLoadConditions }: SavedViewsProps) {
  const views = useQuery(api.filterViews.list, { entityType })
  const removeView = useMutation(api.filterViews.remove)

  const [open, setOpen] = React.useState(false)

  const handleDelete = async (viewId: Id<'filterViews'>) => {
    try {
      await removeView({ viewId })
      toast.success('View deleted')
    } catch {
      toast.error('Failed to delete view')
    }
  }

  const handleLoad = (filtersJson: string) => {
    onLoadConditions(deserializeFilters(filtersJson))
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5">
          <Bookmark className="size-3.5" />
          Views
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-2" align="start">
        {views && views.length > 0 ? (
          <div className="flex flex-col gap-0.5">
            {views.map((view) => (
              <div key={view._id} className="flex items-center gap-1">
                <button
                  className="flex-1 truncate rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                  onClick={() => handleLoad(view.filters)}
                >
                  {view.name}
                </button>
                <button
                  className="rounded-sm p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => handleDelete(view._id)}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="px-2 py-1.5 text-sm text-muted-foreground">
            No saved views
          </p>
        )}
      </PopoverContent>
    </Popover>
  )
}
