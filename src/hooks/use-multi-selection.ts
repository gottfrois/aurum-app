import * as React from 'react'

/**
 * Pure state shape for multi-selection with keyboard navigation.
 *
 * Exported so the reducer can be unit-tested directly without React.
 */
export interface MultiSelectionState {
  selectedIds: Set<string>
  lastSelectedId: string | null
  highlightedId: string | null
  isKeyboardNavigationActive: boolean
  isScrollingFromKeyboard: boolean
}

export function createInitialState(): MultiSelectionState {
  return {
    selectedIds: new Set(),
    lastSelectedId: null,
    highlightedId: null,
    isKeyboardNavigationActive: false,
    isScrollingFromKeyboard: false,
  }
}

export type MultiSelectionAction =
  | { type: 'toggleSelection'; id: string }
  | { type: 'selectRange'; id: string; allIds: Array<string> }
  | { type: 'selectMany'; ids: Array<string> }
  | { type: 'clearSelection' }
  | { type: 'setHighlightedId'; id: string | null }
  | {
      type: 'moveHighlighting'
      direction: 'up' | 'down'
      allIds: Array<string>
    }
  | {
      type: 'moveHighlightingWithShift'
      direction: 'up' | 'down'
      allIds: Array<string>
    }
  | { type: 'toggleHighlightedSelection' }
  | { type: 'selectAllVisible'; allIds: Array<string> }
  | { type: 'setIsKeyboardNavigationActive'; value: boolean }
  | { type: 'startKeyboardScrolling' }
  | { type: 'mouseMoved' }

function getNextIndex(
  state: MultiSelectionState,
  direction: 'up' | 'down',
  allIds: Array<string>,
): number | null {
  if (!allIds.length) return null
  if (!state.highlightedId) return direction === 'up' ? allIds.length - 1 : 0

  const currentIndex = allIds.indexOf(state.highlightedId)
  if (currentIndex === -1) return 0
  if (direction === 'up') return currentIndex > 0 ? currentIndex - 1 : 0
  return currentIndex < allIds.length - 1 ? currentIndex + 1 : allIds.length - 1
}

/**
 * Pure reducer for multi-selection state. Exported for unit testing.
 */
export function multiSelectionReducer(
  state: MultiSelectionState,
  action: MultiSelectionAction,
): MultiSelectionState {
  switch (action.type) {
    case 'toggleSelection': {
      const next = new Set(state.selectedIds)
      if (next.has(action.id)) next.delete(action.id)
      else next.add(action.id)
      return { ...state, selectedIds: next, lastSelectedId: action.id }
    }

    case 'selectRange': {
      const { id, allIds } = action
      if (!state.lastSelectedId) {
        return multiSelectionReducer(state, { type: 'toggleSelection', id })
      }
      const lastIndex = allIds.indexOf(state.lastSelectedId)
      const currentIndex = allIds.indexOf(id)
      if (lastIndex === -1 || currentIndex === -1) {
        return multiSelectionReducer(state, { type: 'toggleSelection', id })
      }
      const start = Math.min(lastIndex, currentIndex)
      const end = Math.max(lastIndex, currentIndex)
      const next = new Set(state.selectedIds)
      for (const rangeId of allIds.slice(start, end + 1)) next.add(rangeId)
      return { ...state, selectedIds: next, lastSelectedId: id }
    }

    case 'selectMany': {
      return {
        ...state,
        selectedIds: new Set(action.ids),
        lastSelectedId: action.ids.length > 0 ? action.ids[0] : null,
      }
    }

    case 'clearSelection': {
      return {
        ...state,
        selectedIds: new Set(),
        lastSelectedId: null,
      }
    }

    case 'setHighlightedId': {
      return { ...state, highlightedId: action.id }
    }

    case 'moveHighlighting': {
      const newIndex = getNextIndex(state, action.direction, action.allIds)
      if (newIndex === null) {
        return {
          ...state,
          isKeyboardNavigationActive: true,
          isScrollingFromKeyboard: true,
        }
      }
      return {
        ...state,
        highlightedId: action.allIds[newIndex],
        isKeyboardNavigationActive: true,
        isScrollingFromKeyboard: true,
      }
    }

    case 'moveHighlightingWithShift': {
      const { direction, allIds } = action
      const base = {
        ...state,
        isKeyboardNavigationActive: true,
        isScrollingFromKeyboard: true,
      }

      if (!allIds.length || !state.highlightedId) return base
      const currentIndex = allIds.indexOf(state.highlightedId)
      if (currentIndex === -1) return base

      // No selection yet — seed with the current highlight, don't move.
      if (state.selectedIds.size === 0) {
        return {
          ...base,
          selectedIds: new Set([state.highlightedId]),
          lastSelectedId: state.highlightedId,
        }
      }

      const newIndex = getNextIndex(state, direction, allIds)
      if (newIndex === null) return base

      const nextId = allIds[newIndex]
      if (state.highlightedId === nextId) return base

      const next = new Set(state.selectedIds)
      if (state.selectedIds.has(nextId)) {
        // Contracting back — remove the previous highlight.
        next.delete(state.highlightedId)
      } else {
        if (!state.selectedIds.has(state.highlightedId))
          next.add(state.highlightedId)
        next.add(nextId)
      }

      return {
        ...base,
        selectedIds: next,
        highlightedId: nextId,
        lastSelectedId: nextId,
      }
    }

    case 'toggleHighlightedSelection': {
      if (!state.highlightedId) return state
      return multiSelectionReducer(state, {
        type: 'toggleSelection',
        id: state.highlightedId,
      })
    }

    case 'selectAllVisible': {
      if (!action.allIds.length) return state
      return {
        ...state,
        selectedIds: new Set(action.allIds),
        lastSelectedId: action.allIds[0],
        highlightedId: action.allIds[0],
      }
    }

    case 'setIsKeyboardNavigationActive': {
      return { ...state, isKeyboardNavigationActive: action.value }
    }

    case 'startKeyboardScrolling': {
      return { ...state, isScrollingFromKeyboard: true }
    }

    case 'mouseMoved': {
      if (!state.isScrollingFromKeyboard && !state.isKeyboardNavigationActive)
        return state
      return {
        ...state,
        isScrollingFromKeyboard: false,
        isKeyboardNavigationActive: false,
      }
    }
  }
}

export interface UseMultiSelectionReturn {
  /** The set of currently selected item IDs */
  selectedIds: Set<string>
  /** Toggle selection of a single item */
  toggleSelection: (id: string) => void
  /** Select a range from the last-selected anchor to `id` (shift+click). Additive — never removes existing selections outside the range. */
  selectRange: (id: string, allIds: Array<string>) => void
  /** Replace the current selection with the given IDs */
  selectMany: (ids: Array<string>) => void
  /** Clear all selected items (also resets the anchor) */
  clearSelection: () => void
  /** Check if an item is selected */
  isSelected: (id: string) => boolean
  /** Number of selected items */
  selectionCount: number

  /** The currently highlighted (keyboard-focused) item ID */
  highlightedId: string | null
  /** Set the highlighted item directly */
  setHighlightedId: (id: string | null) => void
  /** Check if an item is highlighted */
  isHighlighted: (id: string) => boolean
  /** Move highlight up or down in the list (arrow keys) */
  moveHighlighting: (direction: 'up' | 'down', allIds: Array<string>) => void
  /** Move highlight with shift held — extends/contracts selection (shift+arrow) */
  moveHighlightingWithShift: (
    direction: 'up' | 'down',
    allIds: Array<string>,
  ) => void
  /** Toggle selection of the currently highlighted item (space/enter) */
  toggleHighlightedSelection: () => void
  /** Select all visible items and highlight the first one (Cmd/Ctrl+A) */
  selectAllVisible: (allIds: Array<string>) => void

  /** Whether keyboard navigation is currently active (vs mouse) */
  isKeyboardNavigationActive: boolean
  /** Set keyboard navigation mode */
  setIsKeyboardNavigationActive: (isActive: boolean) => void
  /** Whether the list is currently scrolling due to keyboard navigation */
  isScrollingFromKeyboard: boolean
  /** Signal that keyboard navigation triggered a scroll */
  startKeyboardScrolling: () => void
  /** Attach to the list container's onMouseMove — disables keyboard nav mode on real mouse movement */
  handleListMouseMove: (e: React.MouseEvent) => void
}

/**
 * Generic multi-selection hook with keyboard navigation support.
 *
 * Manages selection state (Set<string>), range selection (shift+click),
 * keyboard highlighting (arrow keys), and mouse/keyboard mode tracking.
 *
 * This is a plain hook — consumers wrap it in their own context as needed.
 */
export function useMultiSelection(): UseMultiSelectionReturn {
  const [state, dispatch] = React.useReducer(
    multiSelectionReducer,
    undefined,
    createInitialState,
  )

  const toggleSelection = React.useCallback(
    (id: string) => dispatch({ type: 'toggleSelection', id }),
    [],
  )
  const selectRange = React.useCallback(
    (id: string, allIds: Array<string>) =>
      dispatch({ type: 'selectRange', id, allIds }),
    [],
  )
  const selectMany = React.useCallback(
    (ids: Array<string>) => dispatch({ type: 'selectMany', ids }),
    [],
  )
  const clearSelection = React.useCallback(
    () => dispatch({ type: 'clearSelection' }),
    [],
  )
  const setHighlightedId = React.useCallback(
    (id: string | null) => dispatch({ type: 'setHighlightedId', id }),
    [],
  )
  const moveHighlighting = React.useCallback(
    (direction: 'up' | 'down', allIds: Array<string>) =>
      dispatch({ type: 'moveHighlighting', direction, allIds }),
    [],
  )
  const moveHighlightingWithShift = React.useCallback(
    (direction: 'up' | 'down', allIds: Array<string>) =>
      dispatch({ type: 'moveHighlightingWithShift', direction, allIds }),
    [],
  )
  const toggleHighlightedSelection = React.useCallback(
    () => dispatch({ type: 'toggleHighlightedSelection' }),
    [],
  )
  const selectAllVisible = React.useCallback(
    (allIds: Array<string>) => dispatch({ type: 'selectAllVisible', allIds }),
    [],
  )
  const setIsKeyboardNavigationActive = React.useCallback(
    (value: boolean) =>
      dispatch({ type: 'setIsKeyboardNavigationActive', value }),
    [],
  )
  const startKeyboardScrolling = React.useCallback(
    () => dispatch({ type: 'startKeyboardScrolling' }),
    [],
  )

  const handleListMouseMove = React.useCallback((e: React.MouseEvent) => {
    // Only flip back to mouse mode on actual pointer movement
    if (e.movementX !== 0 || e.movementY !== 0) {
      dispatch({ type: 'mouseMoved' })
    }
  }, [])

  const isSelected = React.useCallback(
    (id: string) => state.selectedIds.has(id),
    [state.selectedIds],
  )
  const isHighlighted = React.useCallback(
    (id: string) => state.highlightedId === id,
    [state.highlightedId],
  )

  return {
    selectedIds: state.selectedIds,
    toggleSelection,
    selectRange,
    selectMany,
    clearSelection,
    isSelected,
    selectionCount: state.selectedIds.size,

    highlightedId: state.highlightedId,
    setHighlightedId,
    isHighlighted,
    moveHighlighting,
    moveHighlightingWithShift,
    toggleHighlightedSelection,
    selectAllVisible,

    isKeyboardNavigationActive: state.isKeyboardNavigationActive,
    setIsKeyboardNavigationActive,
    isScrollingFromKeyboard: state.isScrollingFromKeyboard,
    startKeyboardScrolling,
    handleListMouseMove,
  }
}
