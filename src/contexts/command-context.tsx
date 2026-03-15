import type { ComponentType } from 'react'
import * as React from 'react'

export interface CommandEntry {
  id: string
  label: string
  group: string
  icon?: ComponentType<{ className?: string }>
  onSelect: () => void
  /** When set, selecting this command renders the view inside the palette instead of closing it. */
  view?: (props: { onBack: () => void }) => React.ReactNode
}

interface CommandContextValue {
  commands: Array<CommandEntry>
  register: (commands: Array<CommandEntry>) => () => void
  openPalette: (opts?: { group?: string }) => void
  paletteState: { open: boolean; filterGroup?: string }
  setPaletteState: React.Dispatch<
    React.SetStateAction<{ open: boolean; filterGroup?: string }>
  >
}

const CommandContext = React.createContext<CommandContextValue | null>(null)

export function CommandProvider({ children }: { children: React.ReactNode }) {
  const [commands, setCommands] = React.useState<Array<CommandEntry>>([])
  const [paletteState, setPaletteState] = React.useState<{
    open: boolean
    filterGroup?: string
  }>({ open: false })

  const register = React.useCallback((entries: Array<CommandEntry>) => {
    setCommands((prev) => [...prev, ...entries])
    return () => {
      setCommands((prev) => {
        const ids = new Set(entries.map((e) => e.id))
        return prev.filter((c) => !ids.has(c.id))
      })
    }
  }, [])

  const openPalette = React.useCallback((opts?: { group?: string }) => {
    setPaletteState({ open: true, filterGroup: opts?.group })
  }, [])

  const value = React.useMemo(
    () => ({ commands, register, openPalette, paletteState, setPaletteState }),
    [commands, register, openPalette, paletteState],
  )

  return (
    <CommandContext.Provider value={value}>{children}</CommandContext.Provider>
  )
}

export function useCommandRegistry() {
  const ctx = React.useContext(CommandContext)
  if (!ctx)
    throw new Error('useCommandRegistry must be used within CommandProvider')
  return ctx
}

export function useRegisterCommands(
  commands: Array<CommandEntry>,
  deps: Array<unknown>,
) {
  const { register } = useCommandRegistry()

  const stable = React.useMemo(() => commands, deps) // deps are intentionally dynamic

  React.useEffect(() => {
    if (stable.length === 0) return
    return register(stable)
  }, [register, stable])
}
