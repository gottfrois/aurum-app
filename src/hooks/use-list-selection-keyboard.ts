import * as React from 'react'
import { useSectionedSelection } from '~/hooks/use-sectioned-selection'

interface UseListSelectionKeyboardOptions<TSection extends string> {
  /** All selectable item IDs across sections in display order */
  allSelectableIds: Array<string>
  /** Selectable IDs grouped by section (target for Cmd/Ctrl+A) */
  selectableSectionIds: Record<TSection, Array<string>>
  /** Resolve which section an ID belongs to */
  getSectionForId: (id: string) => TSection
  /**
   * Resolve which section the pointer is currently hovering, if any.
   * When provided and non-null, takes priority over `highlightedId` for `Cmd/Ctrl+A`.
   */
  getHoveredSection?: () => TSection | null
  /** Whether the keyboard listener is active (default: true) */
  enabled?: boolean
}

/**
 * Global keyboard handler for list selection with multi-section support.
 *
 * Bindings:
 * - **Arrow Up/Down** — move highlight across all selectable items
 * - **Shift+Arrow Up/Down** — extend selection; clears when crossing section boundaries
 * - **Space** — toggle selection of highlighted item (skips disabled)
 * - **Escape** — clear selection
 * - **Ctrl/Cmd+A** — select all visible in the target section. Priority:
 *   (1) `getHoveredSection()` if provided and non-null, (2) highlighted item's section,
 *   (3) first non-empty section.
 *
 * Ignores events originating from inputs, textareas, content-editable elements, menus, and dialogs.
 * Must be used within a `SectionedSelectionProvider`.
 */
export function useListSelectionKeyboard<TSection extends string>({
  allSelectableIds,
  selectableSectionIds,
  getSectionForId,
  getHoveredSection,
  enabled = true,
}: UseListSelectionKeyboardOptions<TSection>): void {
  const {
    highlightedId,
    isDisabled,
    moveHighlighting,
    moveHighlightingWithShiftInSection,
    toggleItemSelection,
    selectAllVisibleInSection,
    clearSelection,
  } = useSectionedSelection<TSection>()

  React.useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (
        !target ||
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.closest("[role='menu']") ||
        target.closest("[role='dialog']")
      ) {
        return
      }

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault()
          if (e.shiftKey) {
            moveHighlightingWithShiftInSection(
              'down',
              allSelectableIds,
              getSectionForId,
            )
          } else {
            moveHighlighting('down', allSelectableIds)
          }
          break
        }
        case 'ArrowUp': {
          e.preventDefault()
          if (e.shiftKey) {
            moveHighlightingWithShiftInSection(
              'up',
              allSelectableIds,
              getSectionForId,
            )
          } else {
            moveHighlighting('up', allSelectableIds)
          }
          break
        }
        case ' ': {
          e.preventDefault()
          if (!highlightedId || isDisabled(highlightedId)) break
          toggleItemSelection(highlightedId, getSectionForId(highlightedId))
          break
        }
        case 'Escape': {
          e.preventDefault()
          clearSelection()
          break
        }
        case 'a': {
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault()
            const sectionKeys = Object.keys(
              selectableSectionIds,
            ) as Array<TSection>
            const hoveredSection = getHoveredSection?.() ?? null
            const section: TSection =
              hoveredSection ??
              (highlightedId
                ? getSectionForId(highlightedId)
                : (sectionKeys.find(
                    (k) => selectableSectionIds[k].length > 0,
                  ) ?? sectionKeys[0]))
            if (section !== undefined) {
              selectAllVisibleInSection(selectableSectionIds[section], section)
            }
          }
          break
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [
    enabled,
    allSelectableIds,
    selectableSectionIds,
    getSectionForId,
    getHoveredSection,
    highlightedId,
    isDisabled,
    moveHighlighting,
    moveHighlightingWithShiftInSection,
    toggleItemSelection,
    selectAllVisibleInSection,
    clearSelection,
  ])
}
