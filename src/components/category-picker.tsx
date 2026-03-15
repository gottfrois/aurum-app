import { useMutation } from 'convex/react'
import { Check, ChevronsUpDown } from 'lucide-react'
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
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover'
import { useEncryption } from '~/contexts/encryption-context'
import { useCategories } from '~/lib/categories'
import { encryptData, importPublicKey } from '~/lib/crypto'
import { cn } from '~/lib/utils'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'

interface CategoryPickerProps {
  transactionId: string
  currentCategoryKey: string
  wording: string
  onCreateRule?: (wording: string, categoryKey: string) => void
}

export function CategoryPicker({
  transactionId,
  currentCategoryKey,
  wording,
  onCreateRule,
}: CategoryPickerProps) {
  const [open, setOpen] = React.useState(false)
  const { categories, getCategory } = useCategories()
  const { workspacePublicKey } = useEncryption()
  const updateCategory = useMutation(api.transactions.updateTransactionCategory)

  const current = getCategory(currentCategoryKey)

  const builtInCategories = categories.filter((c) => c.builtIn)
  const customCategories = categories.filter((c) => !c.builtIn)

  const handleSelect = async (categoryKey: string) => {
    setOpen(false)
    if (categoryKey === currentCategoryKey) return

    try {
      if (!workspacePublicKey) throw new Error('Vault not unlocked')
      const pubKey = await importPublicKey(workspacePublicKey)
      const encryptedCategories = await encryptData(
        {
          category: categoryKey,
          categoryParent: undefined,
          userCategoryKey: categoryKey,
        },
        pubKey,
        transactionId,
        'encryptedCategories',
      )
      await updateCategory({
        transactionId: transactionId as Id<'transactions'>,
        encryptedCategories,
      })
      const cat = getCategory(categoryKey)
      toast.success('Category updated', {
        description: `Changed to "${cat.label}"`,
        action: onCreateRule
          ? {
              label: 'Create rule',
              onClick: () => onCreateRule(wording, categoryKey),
            }
          : undefined,
      })
    } catch {
      toast.error('Failed to update category')
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          role="combobox"
          aria-expanded={open}
          className="h-auto justify-start gap-2 px-2 py-1 font-normal"
        >
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: current.color }}
          />
          <span className="truncate text-muted-foreground">
            {current.label}
          </span>
          <ChevronsUpDown className="ml-auto size-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search categories..." />
          <CommandList>
            <CommandEmpty>No category found.</CommandEmpty>
            <CommandGroup heading="Categories">
              {builtInCategories.map((cat) => (
                <CommandItem
                  key={cat.key}
                  value={cat.label}
                  onSelect={() => handleSelect(cat.key)}
                >
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span>{cat.label}</span>
                  <Check
                    className={cn(
                      'ml-auto size-3',
                      currentCategoryKey === cat.key
                        ? 'opacity-100'
                        : 'opacity-0',
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
            {customCategories.length > 0 && (
              <CommandGroup heading="Custom">
                {customCategories.map((cat) => (
                  <CommandItem
                    key={cat.key}
                    value={cat.label}
                    onSelect={() => handleSelect(cat.key)}
                    className={cat.parentKey ? 'pl-6' : undefined}
                  >
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span>{cat.label}</span>
                    <Check
                      className={cn(
                        'ml-auto size-3',
                        currentCategoryKey === cat.key
                          ? 'opacity-100'
                          : 'opacity-0',
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
