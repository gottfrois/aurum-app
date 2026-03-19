import * as React from 'react'
import { HotkeyDisplay } from '~/components/ui/kbd'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '~/components/ui/sheet'
import { useCommandRegistry } from '~/contexts/command-context'

interface ShortcutsDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ShortcutsDrawer({ open, onOpenChange }: ShortcutsDrawerProps) {
  const { commands } = useCommandRegistry()

  const grouped = React.useMemo(() => {
    const withHotkeys = commands.filter((cmd) => cmd.hotkey)
    const groups = new Map<string, typeof withHotkeys>()
    for (const cmd of withHotkeys) {
      const list = groups.get(cmd.group) ?? []
      list.push(cmd)
      groups.set(cmd.group, list)
    }
    return groups
  }, [commands])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>Keyboard shortcuts</SheetTitle>
          <SheetDescription>
            Available keyboard shortcuts in the app.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-6 px-4 pb-4">
          {[...grouped.entries()].map(([group, cmds]) => (
            <div key={group}>
              <h3 className="mb-2 text-xs font-medium text-muted-foreground">
                {group}
              </h3>
              <div className="flex flex-col gap-1">
                {cmds.map((cmd) => (
                  <div
                    key={cmd.id}
                    className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      {cmd.icon && (
                        <cmd.icon className="size-4 text-muted-foreground" />
                      )}
                      <span>{cmd.label}</span>
                    </div>
                    {cmd.hotkey && <HotkeyDisplay hotkey={cmd.hotkey} />}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}
