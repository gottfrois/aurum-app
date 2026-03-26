import { Check, ChevronsUpDown, Plus } from 'lucide-react'
import * as React from 'react'
import {
  CreateCategoryDialog,
  useCreateCategoryDialog,
} from '~/components/create-category-dialog'
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
import { usePortfolio } from '~/contexts/portfolio-context'
import { useCategories } from '~/lib/categories'
import { cn } from '~/lib/utils'

interface CategoryComboboxProps {
  value: string
  onChange: (categoryKey: string, categoryLabel: string) => void
  /** Render a custom trigger instead of the default button */
  trigger?: (props: {
    category: { key: string; label: string; color: string }
    open: boolean
  }) => React.ReactNode
  allowCreate?: boolean
  modal?: boolean
}

export function CategoryCombobox({
  value,
  onChange,
  trigger,
  allowCreate = false,
  modal,
}: CategoryComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const { categories, getCategory } = useCategories()
  const { singlePortfolioId } = usePortfolio()

  const current = getCategory(value)

  const builtInCategories = categories.filter((c) => c.builtIn)
  const customCategories = categories.filter((c) => !c.builtIn)

  const exactMatch = categories.some(
    (c) => c.label.toLowerCase() === search.trim().toLowerCase(),
  )

  const createDialog = useCreateCategoryDialog(
    customCategories.length,
    singlePortfolioId,
  )

  const handleSelect = (categoryKey: string) => {
    const cat = getCategory(categoryKey)
    setOpen(false)
    setSearch('')
    onChange(categoryKey, cat.label)
  }

  const handleCreateClick = () => {
    const name = search.trim()
    if (!name) return
    setOpen(false)
    setSearch('')
    createDialog.openDialog(name)
  }

  const handleCreated = (categoryKey: string, categoryLabel: string) => {
    onChange(categoryKey, categoryLabel)
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen} modal={modal}>
        <PopoverTrigger asChild>
          {trigger ? (
            trigger({ category: current, open })
          ) : (
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
          )}
        </PopoverTrigger>
        <PopoverContent className="w-[220px] p-0" align="start">
          <Command>
            <CommandInput
              placeholder={
                allowCreate
                  ? 'Search or create category...'
                  : 'Search categories...'
              }
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>
                {allowCreate && search.trim() ? (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent"
                    onClick={handleCreateClick}
                  >
                    <Plus className="size-3" />
                    Create &ldquo;{search.trim()}&rdquo;
                  </button>
                ) : (
                  'No category found.'
                )}
              </CommandEmpty>
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
                        value === cat.key ? 'opacity-100' : 'opacity-0',
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
                          value === cat.key ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {allowCreate && search.trim() && !exactMatch && (
                <CommandGroup>
                  <CommandItem onSelect={handleCreateClick}>
                    <Plus className="size-3" />
                    Create &ldquo;{search.trim()}&rdquo;
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {allowCreate && (
        <CreateCategoryDialog
          open={createDialog.dialogOpen}
          onOpenChange={createDialog.setDialogOpen}
          initialName={createDialog.initialName}
          initialColor={createDialog.initialColor}
          defaultPortfolioId={createDialog.defaultPortfolioId}
          onCreated={handleCreated}
        />
      )}
    </>
  )
}
