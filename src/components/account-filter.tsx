import { Check, ListFilter } from 'lucide-react'
import type * as React from 'react'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover'
import { Separator } from '~/components/ui/separator'
import { cn } from '~/lib/utils'

export interface AccountOption {
  id: string
  label: string
}

interface AccountFilterProps {
  accounts: Array<AccountOption>
  selected: Set<string>
  onChange: React.Dispatch<React.SetStateAction<Set<string>>>
}

export function AccountFilter({
  accounts,
  selected,
  onChange,
}: AccountFilterProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <ListFilter className="size-3.5" />
          Accounts
          {selected.size > 0 && (
            <Badge
              variant="secondary"
              className="ml-1 size-5 rounded-full p-0 text-[10px]"
            >
              {selected.size}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-2" align="start">
        <div className="flex flex-col gap-0.5">
          {accounts.map((acct) => {
            const isSelected = selected.has(acct.id)
            return (
              <button
                key={acct.id}
                className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                onClick={() => {
                  onChange((prev) => {
                    const next = new Set(prev)
                    if (next.has(acct.id)) {
                      next.delete(acct.id)
                    } else {
                      next.add(acct.id)
                    }
                    return next
                  })
                }}
              >
                <div
                  className={cn(
                    'flex size-4 shrink-0 items-center justify-center rounded-sm border',
                    isSelected
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-muted-foreground/30',
                  )}
                >
                  {isSelected && <Check className="size-3" />}
                </div>
                <span className="truncate">{acct.label}</span>
              </button>
            )
          })}
          {selected.size > 0 && (
            <>
              <Separator className="my-1" />
              <button
                className="px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground"
                onClick={() => onChange(new Set())}
              >
                Clear filter
              </button>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
