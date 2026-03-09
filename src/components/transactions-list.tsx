import * as React from 'react'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
} from 'lucide-react'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import { Input } from '~/components/ui/input'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '~/components/ui/toggle-group'
import { useFormatCurrency } from '~/contexts/privacy-context'
import { resolveTransactionCategoryKey, useCategories } from '~/lib/categories'
import { CategoryPicker } from '~/components/category-picker'
import { CreateRuleDialog } from '~/components/create-rule-dialog'
import { cn } from '~/lib/utils'

export interface TransactionRow {
  _id: string
  date: string
  wording: string
  category?: string
  categoryParent?: string
  userCategoryKey?: string
  value: number
  type?: string
  coming: boolean
}

interface TransactionsListProps {
  data: Array<TransactionRow>
  currency: string
}

type FlowFilter = 'all' | 'income' | 'expense'

const PAGE_SIZE_OPTIONS = ['25', '50', '100']

export function TransactionsList({ data, currency }: TransactionsListProps) {
  const formatCurrency = useFormatCurrency()
  const { getCategory } = useCategories()
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: 'date', desc: true },
  ])
  const [globalFilter, setGlobalFilter] = React.useState('')
  const [categoryFilter, setCategoryFilter] = React.useState<string>('all')
  const [flowFilter, setFlowFilter] = React.useState<FlowFilter>('all')
  const [ruleDialog, setRuleDialog] = React.useState<{
    open: boolean
    pattern: string
    categoryKey: string
  }>({ open: false, pattern: '', categoryKey: '' })

  const handleCreateRule = React.useCallback(
    (wording: string, categoryKey: string) => {
      setRuleDialog({ open: true, pattern: wording, categoryKey })
    },
    [],
  )

  const filteredData = React.useMemo(() => {
    let result = data
    if (categoryFilter !== 'all') {
      result = result.filter(
        (t) => resolveTransactionCategoryKey(t) === categoryFilter,
      )
    }
    if (flowFilter === 'income') {
      result = result.filter((t) => t.value > 0)
    } else if (flowFilter === 'expense') {
      result = result.filter((t) => t.value < 0)
    }
    return result
  }, [data, categoryFilter, flowFilter])

  const columns = React.useMemo<Array<ColumnDef<TransactionRow>>>(
    () => [
      {
        accessorKey: 'date',
        header: ({ column }) => (
          <button
            className="flex items-center gap-1"
            onClick={() => column.toggleSorting()}
          >
            Date
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="size-3" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="size-3" />
            ) : (
              <ArrowUpDown className="size-3" />
            )}
          </button>
        ),
        cell: ({ getValue }) => {
          const date = getValue<string>()
          return new Date(date).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })
        },
      },
      {
        accessorKey: 'wording',
        header: 'Description',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="truncate">{row.original.wording}</span>
            {row.original.coming && (
              <Badge variant="outline" className="shrink-0 text-[10px]">
                Pending
              </Badge>
            )}
          </div>
        ),
      },
      {
        id: 'category',
        header: 'Category',
        accessorFn: (row) =>
          getCategory(resolveTransactionCategoryKey(row)).label,
        cell: ({ row }) => {
          const categoryKey = resolveTransactionCategoryKey(row.original)
          return (
            <CategoryPicker
              transactionId={row.original._id}
              currentCategoryKey={categoryKey}
              wording={row.original.wording}
              onCreateRule={handleCreateRule}
            />
          )
        },
      },
      {
        accessorKey: 'value',
        header: ({ column }) => (
          <button
            className="flex items-center gap-1"
            onClick={() => column.toggleSorting()}
          >
            Amount
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="size-3" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="size-3" />
            ) : (
              <ArrowUpDown className="size-3" />
            )}
          </button>
        ),
        cell: ({ getValue }) => {
          const value = getValue<number>()
          return (
            <span
              className={cn(
                'font-mono font-medium tabular-nums',
                value > 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400',
              )}
            >
              {value > 0 ? '+' : ''}
              {formatCurrency(value, currency)}
            </span>
          )
        },
      },
    ],
    [currency, formatCurrency, getCategory, handleCreateRule],
  )

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
    globalFilterFn: (row, _columnId, filterValue: string) => {
      const wording = row.original.wording.toLowerCase()
      return wording.includes(filterValue.toLowerCase())
    },
  })

  const usedCategories = React.useMemo(() => {
    const keys = new Set(data.map((t) => resolveTransactionCategoryKey(t)))
    return [...keys].sort()
  }, [data])

  const { pageIndex, pageSize } = table.getState().pagination
  const totalRows = table.getFilteredRowModel().rows.length
  const from = totalRows === 0 ? 0 : pageIndex * pageSize + 1
  const to = Math.min((pageIndex + 1) * pageSize, totalRows)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search transactions..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {usedCategories.map((key) => (
              <SelectItem key={key} value={key}>
                {getCategory(key).label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={flowFilter}
          onValueChange={(val) => {
            if (val) setFlowFilter(val as FlowFilter)
          }}
        >
          <ToggleGroupItem value="all">All</ToggleGroupItem>
          <ToggleGroupItem value="income">Income</ToggleGroupItem>
          <ToggleGroupItem value="expense">Expense</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
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
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No transactions found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="text-sm text-muted-foreground">
          {totalRows > 0 ? (
            <>
              {from}–{to} of {totalRows}
            </>
          ) : (
            '0 results'
          )}
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={String(pageSize)}
            onValueChange={(val) => table.setPageSize(Number(val))}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={size}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronsLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="px-2 text-sm tabular-nums text-muted-foreground">
              {table.getState().pagination.pageIndex + 1} /{' '}
              {table.getPageCount()}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <ChevronsRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      <CreateRuleDialog
        open={ruleDialog.open}
        onOpenChange={(open) => setRuleDialog((prev) => ({ ...prev, open }))}
        defaultPattern={ruleDialog.pattern}
        defaultCategoryKey={ruleDialog.categoryKey}
      />
    </div>
  )
}
