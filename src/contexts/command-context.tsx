import type { ComponentType } from 'react'
import * as React from 'react'
import type { Hotkey } from '~/lib/hotkeys'

export interface CommandEntry {
  id: string
  label: string
  group: string
  icon?: ComponentType<{ className?: string }>
  hotkey?: Hotkey
  handler: () => void
  disabled?: boolean
  hidden?: boolean
  keywords?: string[]
  /** When set, selecting this command renders the view inside the palette instead of closing it. */
  view?: (props: { onBack: () => void }) => React.ReactNode
}

/** Stable dispatch functions — never changes identity after mount */
interface CommandDispatch {
  register: (commands: Array<CommandEntry>) => () => void
  openPalette: (opts?: { group?: string }) => void
  setPaletteState: React.Dispatch<
    React.SetStateAction<{
      open: boolean
      filterGroup?: string
      aiMode?: boolean
    }>
  >
}

/** Reactive state — changes when commands or palette state update */
interface CommandState {
  commands: Array<CommandEntry>
  paletteState: { open: boolean; filterGroup?: string; aiMode?: boolean }
}

const DispatchContext = React.createContext<CommandDispatch | null>(null)
const StateContext = React.createContext<CommandState | null>(null)

export function CommandProvider({ children }: { children: React.ReactNode }) {
  const [commands, setCommands] = React.useState<Array<CommandEntry>>([])
  const [paletteState, setPaletteState] = React.useState<{
    open: boolean
    filterGroup?: string
    aiMode?: boolean
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

  const dispatch = React.useMemo(
    () => ({ register, openPalette, setPaletteState }),
    [register, openPalette],
  )

  const state = React.useMemo(
    () => ({ commands, paletteState }),
    [commands, paletteState],
  )

  return (
    <DispatchContext.Provider value={dispatch}>
      <StateContext.Provider value={state}>{children}</StateContext.Provider>
    </DispatchContext.Provider>
  )
}

/** Use for reading commands and palette state (re-renders when they change) */
export function useCommandRegistry() {
  const dispatch = React.useContext(DispatchContext)
  const state = React.useContext(StateContext)
  if (!dispatch || !state)
    throw new Error('useCommandRegistry must be used within CommandProvider')
  return { ...state, ...dispatch }
}

/** Use for registration only — stable reference, never triggers re-render on command changes */
export function useCommandDispatch() {
  const ctx = React.useContext(DispatchContext)
  if (!ctx)
    throw new Error('useCommandDispatch must be used within CommandProvider')
  return ctx
}
