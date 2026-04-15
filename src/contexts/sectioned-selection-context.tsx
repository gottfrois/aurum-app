import * as React from 'react'
import {
  type UseMultiSelectionReturn,
  useMultiSelection,
} from '~/hooks/use-multi-selection'

export interface SectionedSelectionContextType<TSection extends string = string>
  extends UseMultiSelectionReturn {
  /** Which section the current selection belongs to */
  activeSection: TSection | null
  /** Predicate returning true for items that cannot be selected */
  isDisabled: (id: string) => boolean
  /** Toggle item selection with cross-section prevention */
  toggleItemSelection: (id: string, section: TSection) => void
  /** Range-select with cross-section prevention */
  selectRangeInSection: (
    id: string,
    section: TSection,
    allIdsInSection: Array<string>,
  ) => void
  /** Select all (non-disabled) visible items in a section */
  selectAllVisibleInSection: (ids: Array<string>, section: TSection) => void
  /** Shift+arrow selection — clears when crossing a section boundary */
  moveHighlightingWithShiftInSection: (
    direction: 'up' | 'down',
    allIds: Array<string>,
    getSectionForId: (id: string) => TSection,
  ) => void
  /** Whether "select all matching" mode is active (beyond the visible page) */
  isSelectAllMode: boolean
  setIsSelectAllMode: (v: boolean) => void
  /** Count disabled items in a list of IDs */
  countDisabled: (ids: Array<string>) => number
}

const SectionedSelectionContext =
  React.createContext<SectionedSelectionContextType | null>(null)

interface SectionedSelectionProviderProps {
  /** Predicate returning true for items that cannot be selected. Defaults to "none disabled". */
  isDisabled?: (id: string) => boolean
  children: React.ReactNode
}

const defaultIsDisabled = () => false

/**
 * Generic multi-section selection provider with cross-section prevention.
 *
 * Wraps `useMultiSelection` and adds section awareness: selecting items from one section
 * automatically clears items from another. Supports disabled items via a predicate.
 *
 * The section type is inferred from usage — consumers define their own section types
 * (e.g. `"active" | "pending"`, `"today" | "earlier"`, or a single literal for single-section lists).
 */
export function SectionedSelectionProvider({
  isDisabled = defaultIsDisabled,
  children,
}: SectionedSelectionProviderProps) {
  const selection = useMultiSelection()
  const [activeSection, setActiveSection] = React.useState<string | null>(null)
  const [isSelectAllMode, setIsSelectAllMode] = React.useState(false)

  const countDisabled = React.useCallback(
    (ids: Array<string>) => ids.filter((id) => isDisabled(id)).length,
    [isDisabled],
  )

  const ensureSection = React.useCallback(
    (section: string) => {
      if (activeSection !== null && activeSection !== section) {
        selection.clearSelection()
        setIsSelectAllMode(false)
      }
      setActiveSection(section)
    },
    [activeSection, selection],
  )

  const toggleItemSelection = React.useCallback(
    (id: string, section: string) => {
      if (isDisabled(id)) return
      ensureSection(section)
      selection.toggleSelection(id)
    },
    [isDisabled, ensureSection, selection],
  )

  const selectRangeInSection = React.useCallback(
    (id: string, section: string, allIdsInSection: Array<string>) => {
      if (isDisabled(id)) return
      ensureSection(section)
      selection.selectRange(id, allIdsInSection)
    },
    [isDisabled, ensureSection, selection],
  )

  const selectAllVisibleInSection = React.useCallback(
    (ids: Array<string>, section: string) => {
      const selectableIds = ids.filter((id) => !isDisabled(id))
      ensureSection(section)
      selection.selectAllVisible(selectableIds)
    },
    [isDisabled, ensureSection, selection],
  )

  const moveHighlightingWithShiftInSection = React.useCallback(
    (
      direction: 'up' | 'down',
      allIds: Array<string>,
      getSectionForId: (id: string) => string,
    ) => {
      const currentId = selection.highlightedId
      if (!currentId || !allIds.length) {
        selection.moveHighlightingWithShift(direction, allIds)
        return
      }

      const currentIdx = allIds.indexOf(currentId)
      const nextIdx = direction === 'down' ? currentIdx + 1 : currentIdx - 1
      const nextId = allIds[nextIdx]

      if (nextId) {
        const currentSection = getSectionForId(currentId)
        const nextSection = getSectionForId(nextId)

        if (currentSection !== nextSection && selection.selectedIds.size > 0) {
          // Crossing section boundaries with an active selection — start fresh.
          // We replace selectedIds rather than clearing + re-extending because
          // useReducer state would otherwise batch the clear and lose the seed.
          setIsSelectAllMode(false)
          setActiveSection(nextSection)
          selection.selectMany([nextId])
          selection.setHighlightedId(nextId)
          selection.startKeyboardScrolling()
          return
        }

        if (activeSection === null) {
          setActiveSection(nextSection)
        }
      }

      selection.moveHighlightingWithShift(direction, allIds)
    },
    [selection, activeSection],
  )

  const clearSelection = React.useCallback(() => {
    selection.clearSelection()
    setActiveSection(null)
    setIsSelectAllMode(false)
  }, [selection])

  const value = React.useMemo<SectionedSelectionContextType>(
    () => ({
      ...selection,
      clearSelection,
      activeSection,
      isDisabled,
      toggleItemSelection,
      selectRangeInSection,
      selectAllVisibleInSection,
      moveHighlightingWithShiftInSection,
      isSelectAllMode,
      setIsSelectAllMode,
      countDisabled,
    }),
    [
      selection,
      clearSelection,
      activeSection,
      isDisabled,
      toggleItemSelection,
      selectRangeInSection,
      selectAllVisibleInSection,
      moveHighlightingWithShiftInSection,
      isSelectAllMode,
      countDisabled,
    ],
  )

  return (
    <SectionedSelectionContext.Provider value={value}>
      {children}
    </SectionedSelectionContext.Provider>
  )
}

export { SectionedSelectionContext }
