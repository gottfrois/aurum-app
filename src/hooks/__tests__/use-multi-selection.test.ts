import { describe, expect, it } from 'vitest'
import {
  createInitialState,
  type MultiSelectionState,
  multiSelectionReducer,
} from '~/hooks/use-multi-selection'

const IDS = ['a', 'b', 'c', 'd', 'e']

function apply(
  state: MultiSelectionState,
  ...actions: Array<Parameters<typeof multiSelectionReducer>[1]>
): MultiSelectionState {
  return actions.reduce(multiSelectionReducer, state)
}

describe('multiSelectionReducer — initial state', () => {
  it('starts empty', () => {
    const s = createInitialState()
    expect(s.selectedIds.size).toBe(0)
    expect(s.lastSelectedId).toBeNull()
    expect(s.highlightedId).toBeNull()
    expect(s.isKeyboardNavigationActive).toBe(false)
    expect(s.isScrollingFromKeyboard).toBe(false)
  })
})

describe('multiSelectionReducer — toggleSelection', () => {
  it('adds then removes an id and updates the anchor', () => {
    let s = apply(createInitialState(), { type: 'toggleSelection', id: 'a' })
    expect([...s.selectedIds]).toEqual(['a'])
    expect(s.lastSelectedId).toBe('a')

    s = apply(s, { type: 'toggleSelection', id: 'b' })
    expect([...s.selectedIds].sort()).toEqual(['a', 'b'])
    expect(s.lastSelectedId).toBe('b')

    s = apply(s, { type: 'toggleSelection', id: 'a' })
    expect([...s.selectedIds]).toEqual(['b'])
    // anchor is updated to the most recently clicked id, even on deselect
    expect(s.lastSelectedId).toBe('a')
  })
})

describe('multiSelectionReducer — selectRange', () => {
  it('falls back to single toggle when there is no anchor', () => {
    const s = apply(createInitialState(), {
      type: 'selectRange',
      id: 'c',
      allIds: IDS,
    })
    expect([...s.selectedIds]).toEqual(['c'])
    expect(s.lastSelectedId).toBe('c')
  })

  it('selects forward and updates the anchor to the new end', () => {
    const s = apply(
      createInitialState(),
      { type: 'toggleSelection', id: 'b' },
      { type: 'selectRange', id: 'd', allIds: IDS },
    )
    expect([...s.selectedIds].sort()).toEqual(['b', 'c', 'd'])
    expect(s.lastSelectedId).toBe('d')
  })

  it('selects reverse ranges', () => {
    const s = apply(
      createInitialState(),
      { type: 'toggleSelection', id: 'd' },
      { type: 'selectRange', id: 'b', allIds: IDS },
    )
    expect([...s.selectedIds].sort()).toEqual(['b', 'c', 'd'])
    expect(s.lastSelectedId).toBe('b')
  })

  it('is additive — preserves items outside the range', () => {
    const s = apply(
      createInitialState(),
      { type: 'toggleSelection', id: 'a' },
      { type: 'toggleSelection', id: 'c' },
      { type: 'selectRange', id: 'e', allIds: IDS },
    )
    // anchor was 'c' after second toggle, so c..e is added; 'a' is preserved
    expect([...s.selectedIds].sort()).toEqual(['a', 'c', 'd', 'e'])
  })

  it('falls back to toggle when ids are unknown to `allIds`', () => {
    const s = apply(
      createInitialState(),
      { type: 'toggleSelection', id: 'a' },
      { type: 'selectRange', id: 'zz', allIds: IDS },
    )
    expect([...s.selectedIds].sort()).toEqual(['a', 'zz'])
  })
})

describe('multiSelectionReducer — moveHighlighting', () => {
  it('seeds at index 0 on first `down` with no highlight', () => {
    const s = apply(createInitialState(), {
      type: 'moveHighlighting',
      direction: 'down',
      allIds: IDS,
    })
    expect(s.highlightedId).toBe('a')
    expect(s.isKeyboardNavigationActive).toBe(true)
    expect(s.isScrollingFromKeyboard).toBe(true)
  })

  it('seeds at last index on first `up` with no highlight', () => {
    const s = apply(createInitialState(), {
      type: 'moveHighlighting',
      direction: 'up',
      allIds: IDS,
    })
    expect(s.highlightedId).toBe('e')
  })

  it('clamps at the top boundary', () => {
    const s = apply(
      createInitialState(),
      { type: 'setHighlightedId', id: 'a' },
      { type: 'moveHighlighting', direction: 'up', allIds: IDS },
    )
    expect(s.highlightedId).toBe('a')
  })

  it('clamps at the bottom boundary', () => {
    const s = apply(
      createInitialState(),
      { type: 'setHighlightedId', id: 'e' },
      { type: 'moveHighlighting', direction: 'down', allIds: IDS },
    )
    expect(s.highlightedId).toBe('e')
  })

  it('is a no-op on an empty list', () => {
    const s = apply(createInitialState(), {
      type: 'moveHighlighting',
      direction: 'down',
      allIds: [],
    })
    expect(s.highlightedId).toBeNull()
  })
})

describe('multiSelectionReducer — moveHighlightingWithShift', () => {
  it('seeds selection with the current highlight when no selection exists', () => {
    const s = apply(
      createInitialState(),
      { type: 'setHighlightedId', id: 'b' },
      { type: 'moveHighlightingWithShift', direction: 'down', allIds: IDS },
    )
    expect([...s.selectedIds]).toEqual(['b'])
    expect(s.highlightedId).toBe('b')
  })

  it('extends selection downward', () => {
    const s = apply(
      createInitialState(),
      { type: 'setHighlightedId', id: 'b' },
      { type: 'toggleSelection', id: 'b' },
      { type: 'moveHighlightingWithShift', direction: 'down', allIds: IDS },
    )
    expect([...s.selectedIds].sort()).toEqual(['b', 'c'])
    expect(s.highlightedId).toBe('c')
  })

  it('contracts when moving back over a selected item', () => {
    let s = apply(
      createInitialState(),
      { type: 'setHighlightedId', id: 'b' },
      { type: 'toggleSelection', id: 'b' },
      { type: 'moveHighlightingWithShift', direction: 'down', allIds: IDS },
      { type: 'moveHighlightingWithShift', direction: 'down', allIds: IDS },
    )
    // selected b,c,d — highlight on d
    expect([...s.selectedIds].sort()).toEqual(['b', 'c', 'd'])
    expect(s.highlightedId).toBe('d')

    s = apply(s, {
      type: 'moveHighlightingWithShift',
      direction: 'up',
      allIds: IDS,
    })
    // moving up from d over c: c is already selected → remove d, highlight c
    expect([...s.selectedIds].sort()).toEqual(['b', 'c'])
    expect(s.highlightedId).toBe('c')
  })

  it('does not move past the bottom boundary', () => {
    const s = apply(
      createInitialState(),
      { type: 'setHighlightedId', id: 'e' },
      { type: 'toggleSelection', id: 'e' },
      { type: 'moveHighlightingWithShift', direction: 'down', allIds: IDS },
    )
    expect([...s.selectedIds]).toEqual(['e'])
    expect(s.highlightedId).toBe('e')
  })
})

describe('multiSelectionReducer — selectAllVisible', () => {
  it('replaces selection and highlights the first id', () => {
    const s = apply(
      createInitialState(),
      { type: 'toggleSelection', id: 'z' },
      { type: 'selectAllVisible', allIds: IDS },
    )
    expect([...s.selectedIds].sort()).toEqual([...IDS].sort())
    expect(s.highlightedId).toBe('a')
    expect(s.lastSelectedId).toBe('a')
  })

  it('is a no-op when given no ids', () => {
    const prev = apply(createInitialState(), {
      type: 'toggleSelection',
      id: 'x',
    })
    const s = apply(prev, { type: 'selectAllVisible', allIds: [] })
    expect(s).toBe(prev)
  })
})

describe('multiSelectionReducer — clearSelection', () => {
  it('empties selection and anchor but preserves highlight', () => {
    const s = apply(
      createInitialState(),
      { type: 'setHighlightedId', id: 'c' },
      { type: 'toggleSelection', id: 'a' },
      { type: 'toggleSelection', id: 'b' },
      { type: 'clearSelection' },
    )
    expect(s.selectedIds.size).toBe(0)
    expect(s.lastSelectedId).toBeNull()
    expect(s.highlightedId).toBe('c')
  })
})

describe('multiSelectionReducer — mouseMoved', () => {
  it('flips keyboard/scroll flags off when they were on', () => {
    const s = apply(
      createInitialState(),
      { type: 'moveHighlighting', direction: 'down', allIds: IDS },
      { type: 'mouseMoved' },
    )
    expect(s.isKeyboardNavigationActive).toBe(false)
    expect(s.isScrollingFromKeyboard).toBe(false)
  })

  it('is a no-op when neither flag is set (identity return)', () => {
    const prev = createInitialState()
    const s = apply(prev, { type: 'mouseMoved' })
    expect(s).toBe(prev)
  })
})

describe('multiSelectionReducer — toggleHighlightedSelection', () => {
  it('toggles the currently highlighted id', () => {
    let s = apply(
      createInitialState(),
      { type: 'setHighlightedId', id: 'c' },
      { type: 'toggleHighlightedSelection' },
    )
    expect([...s.selectedIds]).toEqual(['c'])

    s = apply(s, { type: 'toggleHighlightedSelection' })
    expect(s.selectedIds.size).toBe(0)
  })

  it('is a no-op with no highlight', () => {
    const prev = createInitialState()
    const s = apply(prev, { type: 'toggleHighlightedSelection' })
    expect(s).toBe(prev)
  })
})
