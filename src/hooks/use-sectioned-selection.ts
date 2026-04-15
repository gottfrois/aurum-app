import * as React from 'react'
import {
  SectionedSelectionContext,
  type SectionedSelectionContextType,
} from '~/contexts/sectioned-selection-context'

/**
 * Access the sectioned selection context. Must be used within a `SectionedSelectionProvider`.
 */
export function useSectionedSelection<
  TSection extends string = string,
>(): SectionedSelectionContextType<TSection> {
  const context = React.useContext(SectionedSelectionContext)
  if (!context) {
    throw new Error(
      'useSectionedSelection must be used within a SectionedSelectionProvider',
    )
  }
  return context as unknown as SectionedSelectionContextType<TSection>
}
