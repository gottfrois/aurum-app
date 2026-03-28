import {
  type ColumnDef,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  type RowSelectionState,
  useReactTable,
} from '@tanstack/react-table'
import { Trash2, X } from 'lucide-react'
import * as React from 'react'
import { ConfirmDialog } from '~/components/confirm-dialog'
import { Button } from '~/components/ui/button'
import { Checkbox } from '~/components/ui/checkbox'
import { Input } from '~/components/ui/input'
import { ScrollArea } from '~/components/ui/scroll-area'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '~/components/ui/tooltip'

export interface DataTableGroup<TData> {
  label: string
  description?: string
  action?: React.ReactNode
  filter: (row: TData) => boolean
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  filterPlaceholder?: string
  filterColumn?: string
  actions?: React.ReactNode
  onBatchDelete?: (ids: string[]) => void
  batchDeleteConfirmDescription?: string
  getRowId?: (row: TData) => string
  enableRowSelection?: (row: TData) => boolean
  disabledRowTooltip?: string
  groups?: DataTableGroup<TData>[]
}

export function DataTable<TData, TValue>({
  columns,
  data,
  filterPlaceholder = 'Filter...',
  filterColumn,
  actions,
  onBatchDelete,
  batchDeleteConfirmDescription = 'This action cannot be undone. The selected items will be permanently deleted.',
  getRowId,
  enableRowSelection,
  disabledRowTooltip,
  groups,
}: DataTableProps<TData, TValue>) {
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  )
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})
  const [confirmBatchDelete, setConfirmBatchDelete] = React.useState(false)

  const allColumns = React.useMemo(() => {
    if (!onBatchDelete) return columns

    const selectColumn: ColumnDef<TData, TValue> = {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && 'indeterminate')
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => {
        const disabled = !row.getCanSelect()
        const checkbox = (
          <Checkbox
            checked={row.getIsSelected()}
            disabled={disabled}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
          />
        )
        if (disabled && disabledRowTooltip) {
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">{checkbox}</span>
              </TooltipTrigger>
              <TooltipContent>{disabledRowTooltip}</TooltipContent>
            </Tooltip>
          )
        }
        return checkbox
      },
      size: 40,
      enableSorting: false,
      enableHiding: false,
    }
    return [selectColumn, ...columns]
  }, [columns, onBatchDelete, disabledRowTooltip])

  const table = useReactTable({
    data,
    columns: allColumns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    getRowId: getRowId ? (row) => getRowId(row) : undefined,
    enableRowSelection: enableRowSelection
      ? (row) => enableRowSelection(row.original)
      : !!onBatchDelete,
    state: {
      columnFilters,
      rowSelection,
    },
  })

  const selectedCount = table.getFilteredSelectedRowModel().rows.length

  const handleBatchDelete = () => {
    if (!onBatchDelete) return
    const ids = table.getFilteredSelectedRowModel().rows.map((row) => row.id)
    onBatchDelete(ids)
    setRowSelection({})
    setConfirmBatchDelete(false)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 pb-6">
        {filterColumn && (
          <Input
            placeholder={filterPlaceholder}
            value={
              (table.getColumn(filterColumn)?.getFilterValue() as string) ?? ''
            }
            onChange={(event) =>
              table.getColumn(filterColumn)?.setFilterValue(event.target.value)
            }
            className="max-w-sm"
          />
        )}
        <div className="ml-auto flex items-center gap-2">{actions}</div>
      </div>
      <Table className="shrink-0">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="border-b-0">
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className="text-muted-foreground"
                  style={
                    header.column.columnDef.size
                      ? { width: header.column.columnDef.size }
                      : undefined
                  }
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
      </Table>
      <ScrollArea className="min-h-0 flex-1">
        <Table>
          <TableBody>
            {table.getRowModel().rows.length ? (
              groups ? (
                groups.map((group) => {
                  const groupRows = table
                    .getRowModel()
                    .rows.filter((row) => group.filter(row.original))
                  if (groupRows.length === 0) return null
                  return (
                    <React.Fragment key={group.label}>
                      <TableRow className="border-b-0 bg-muted/50 hover:bg-muted/50">
                        <TableCell
                          colSpan={allColumns.length}
                          className="py-1.5"
                        >
                          <div className="flex items-center">
                            <span className="font-medium text-muted-foreground">
                              {group.label}
                            </span>
                            <span className="ml-1.5 text-muted-foreground/60">
                              {groupRows.length}
                            </span>
                            {group.description && (
                              <>
                                <span className="mx-1.5 text-muted-foreground/40">
                                  ·
                                </span>
                                <span className="text-muted-foreground/60">
                                  {group.description}
                                </span>
                              </>
                            )}
                            {group.action && (
                              <span className="ml-auto">{group.action}</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      {groupRows.map((row) => (
                        <TableRow
                          key={row.id}
                          data-state={row.getIsSelected() && 'selected'}
                          className="h-12 border-b border-border/50"
                        >
                          {row.getVisibleCells().map((cell) => (
                            <TableCell
                              key={cell.id}
                              style={
                                cell.column.columnDef.size
                                  ? { width: cell.column.columnDef.size }
                                  : undefined
                              }
                            >
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext(),
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </React.Fragment>
                  )
                })
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && 'selected'}
                    className="h-12 border-b border-border/50"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        style={
                          cell.column.columnDef.size
                            ? { width: cell.column.columnDef.size }
                            : undefined
                        }
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )
            ) : (
              <TableRow>
                <TableCell
                  colSpan={allColumns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </ScrollArea>
      {onBatchDelete && selectedCount > 0 && (
        <div className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center gap-2 rounded-full border bg-background px-2 py-2 shadow-xl">
            <Button
              variant="outline"
              className="pointer-events-none rounded-full"
            >
              {selectedCount} selected
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setRowSelection({})}
              className="rounded-full"
            >
              <X />
            </Button>
            <div className="h-7 w-px shrink-0 bg-border" />
            <Button
              variant="destructive"
              className="rounded-full"
              onClick={() => setConfirmBatchDelete(true)}
            >
              <Trash2 className="size-4" />
              Delete
            </Button>
          </div>
        </div>
      )}
      {onBatchDelete && (
        <ConfirmDialog
          open={confirmBatchDelete}
          onOpenChange={setConfirmBatchDelete}
          title={`Delete ${selectedCount} item${selectedCount > 1 ? 's' : ''}?`}
          description={batchDeleteConfirmDescription}
          confirmLabel="Delete"
          onConfirm={handleBatchDelete}
        />
      )}
    </div>
  )
}
