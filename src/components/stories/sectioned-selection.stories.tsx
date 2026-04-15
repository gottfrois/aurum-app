import type { Meta, StoryObj } from '@storybook/react-vite'
import * as React from 'react'
import { SectionedSelectionProvider } from '~/contexts/sectioned-selection-context'
import { useListSelectionKeyboard } from '~/hooks/use-list-selection-keyboard'
import { useSectionedSelection } from '~/hooks/use-sectioned-selection'
import { cn } from '~/lib/utils'
import { Checkbox } from '../ui/checkbox'
import { Kbd } from '../ui/kbd'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table'

type DemoSection = 'today' | 'earlier'

interface DemoRow {
  id: string
  section: DemoSection
  label: string
  amount: string
}

const ROWS: Array<DemoRow> = [
  { id: 't1', section: 'today', label: 'Coffee shop', amount: '-4,50 €' },
  { id: 't2', section: 'today', label: 'Groceries', amount: '-52,10 €' },
  { id: 't3', section: 'today', label: 'Salary', amount: '+3 200,00 €' },
  { id: 'e1', section: 'earlier', label: 'Netflix', amount: '-15,99 €' },
  { id: 'e2', section: 'earlier', label: 'Gas station', amount: '-48,20 €' },
  { id: 'e3', section: 'earlier', label: 'Restaurant', amount: '-32,80 €' },
  { id: 'e4', section: 'earlier', label: 'Book store', amount: '-19,90 €' },
  { id: 'e5', section: 'earlier', label: 'Taxi', amount: '-12,40 €' },
]

function sectionIds(rows: Array<DemoRow>, section: DemoSection): Array<string> {
  return rows.filter((r) => r.section === section).map((r) => r.id)
}

function DemoRow({
  row,
  allIdsInSection,
}: {
  row: DemoRow
  allIdsInSection: Array<string>
}) {
  const {
    selectedIds,
    highlightedId,
    selectionCount,
    toggleItemSelection,
    selectRangeInSection,
  } = useSectionedSelection<DemoSection>()

  const isSelected = selectedIds.has(row.id)
  const isHighlighted = highlightedId === row.id
  const selectionActive = selectionCount > 0

  const handleRowClick = (e: React.MouseEvent) => {
    if (e.shiftKey) {
      selectRangeInSection(row.id, row.section, allIdsInSection)
      return
    }
    if (selectionActive) {
      toggleItemSelection(row.id, row.section)
    }
  }

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (e.shiftKey) {
      selectRangeInSection(row.id, row.section, allIdsInSection)
      return
    }
    toggleItemSelection(row.id, row.section)
  }

  return (
    <TableRow
      className={cn('cursor-pointer', isHighlighted && 'bg-muted/50')}
      data-state={isSelected ? 'selected' : undefined}
      onClick={handleRowClick}
    >
      <TableCell>
        {/* biome-ignore lint/a11y/noStaticElementInteractions: wrapper only stops click propagation to parent row */}
        <div
          role="presentation"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <Checkbox
            checked={isSelected}
            onClick={handleCheckboxClick}
            aria-label={`Select ${row.label}`}
          />
        </div>
      </TableCell>
      <TableCell>{row.label}</TableCell>
      <TableCell className="text-right tabular-nums">{row.amount}</TableCell>
    </TableRow>
  )
}

function DemoList({ rows }: { rows: Array<DemoRow> }) {
  const { handleListMouseMove } = useSectionedSelection<DemoSection>()

  const allSelectableIds = React.useMemo(() => rows.map((r) => r.id), [rows])
  const selectableSectionIds = React.useMemo<
    Record<DemoSection, Array<string>>
  >(
    () => ({
      today: sectionIds(rows, 'today'),
      earlier: sectionIds(rows, 'earlier'),
    }),
    [rows],
  )
  const idToSection = React.useMemo(() => {
    const map = new Map<string, DemoSection>()
    for (const r of rows) map.set(r.id, r.section)
    return map
  }, [rows])
  const getSectionForId = React.useCallback(
    (id: string): DemoSection => idToSection.get(id) ?? 'today',
    [idToSection],
  )

  useListSelectionKeyboard<DemoSection>({
    allSelectableIds,
    selectableSectionIds,
    getSectionForId,
  })

  const sections: Array<{ key: DemoSection; title: string }> = [
    { key: 'today', title: 'Today' },
    { key: 'earlier', title: 'Earlier' },
  ]

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody onMouseMove={handleListMouseMove}>
            {sections.map(({ key, title }) => {
              const sectionRows = rows.filter((r) => r.section === key)
              const idsInSection = sectionRows.map((r) => r.id)
              return (
                <React.Fragment key={key}>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableCell
                      colSpan={3}
                      className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                    >
                      {title}
                    </TableCell>
                  </TableRow>
                  {sectionRows.map((row) => (
                    <DemoRow
                      key={row.id}
                      row={row}
                      allIdsInSection={idsInSection}
                    />
                  ))}
                </React.Fragment>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <SelectionLegend />
    </div>
  )
}

function SelectionLegend() {
  const { selectionCount, activeSection } = useSectionedSelection<DemoSection>()
  return (
    <div className="space-y-2 text-sm text-muted-foreground">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="inline-flex items-center gap-1.5">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd>
          <span>move</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Kbd>⇧</Kbd>
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd>
          <span>extend</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Kbd>Space</Kbd>
          <span>toggle</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Kbd>⌘</Kbd>
          <Kbd>A</Kbd>
          <span>select all in section</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Kbd>Esc</Kbd>
          <span>clear</span>
        </span>
      </div>
      <div>
        <strong>{selectionCount}</strong> selected
        {activeSection ? ` in ${activeSection}` : ''}
      </div>
    </div>
  )
}

function SectionedSelectionDemo({ rows }: { rows: Array<DemoRow> }) {
  return (
    <SectionedSelectionProvider>
      <DemoList rows={rows} />
    </SectionedSelectionProvider>
  )
}

const meta = {
  title: 'Data Display/SectionedSelection',
  component: SectionedSelectionDemo,
  parameters: {
    layout: 'padded',
  },
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SectionedSelectionDemo>

export default meta
type Story = StoryObj<typeof meta>

export const TwoSections: Story = {
  args: {
    rows: ROWS,
  },
}

export const SingleSection: Story = {
  args: {
    rows: ROWS.filter((r) => r.section === 'earlier'),
  },
}
