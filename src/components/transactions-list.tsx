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
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ListFilter,
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '~/components/ui/sheet'
import { Separator } from '~/components/ui/separator'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover'
import { useFormatCurrency } from '~/contexts/privacy-context'
import { resolveTransactionCategoryKey, useCategories } from '~/lib/categories'
import { CategoryPicker } from '~/components/category-picker'
import { CreateRuleDialog } from '~/components/create-rule-dialog'
import { cn } from '~/lib/utils'

export interface TransactionRow {
  _id: string
  bankAccountId?: string
  date: string
  wording: string
  originalWording?: string
  simplifiedWording?: string
  category?: string
  categoryParent?: string
  userCategoryKey?: string
  value: number
  originalValue?: number
  originalCurrency?: string
  type?: string
  coming: boolean
  counterparty?: string
  card?: string
  comment?: string
  rdate?: string
  vdate?: string
  accountName?: string
  accountNumber?: string
}

export interface AccountOption {
  id: string
  label: string
}

interface TransactionsListProps {
  data: Array<TransactionRow>
  currency: string
  accounts?: Array<AccountOption>
}

type FlowFilter = 'all' | 'income' | 'expense'

const PAGE_SIZE_OPTIONS = ['25', '50', '100']

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function TransactionsList({
  data,
  currency,
  accounts = [],
}: TransactionsListProps) {
  const formatCurrency = useFormatCurrency()
  const { getCategory } = useCategories()
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: 'date', desc: true },
  ])
  const [globalFilter, setGlobalFilter] = React.useState('')
  const [categoryFilter, setCategoryFilter] = React.useState<string>('all')
  const [accountFilter, setAccountFilter] = React.useState<Set<string>>(
    new Set(),
  )
  const [flowFilter, setFlowFilter] = React.useState<FlowFilter>('all')
  const [selectedTransaction, setSelectedTransaction] =
    React.useState<TransactionRow | null>(null)
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
    if (accountFilter.size > 0) {
      result = result.filter(
        (t) => t.bankAccountId && accountFilter.has(t.bankAccountId),
      )
    }
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
  }, [data, accountFilter, categoryFilter, flowFilter])

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
        cell: ({ getValue }) => formatDate(getValue<string>()),
      },
      {
        accessorKey: 'wording',
        header: 'Description',
        cell: ({ row }) => (
          <div className="flex max-w-[150px] items-center gap-2 sm:max-w-[200px] md:max-w-[300px] lg:max-w-[400px]">
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
        accessorKey: 'accountName',
        header: 'Account',
        cell: ({ row }) => {
          const name = row.original.accountName
          const number = row.original.accountNumber
          if (!name && !number) return null
          return (
            <div className="flex max-w-[160px] flex-col gap-0.5">
              {name && (
                <span className="truncate text-muted-foreground">{name}</span>
              )}
              {number && (
                <span className="truncate font-mono text-xs text-muted-foreground/70">
                  {number}
                </span>
              )}
            </div>
          )
        },
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
        {accounts.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <ListFilter className="size-3.5" />
                Accounts
                {accountFilter.size > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-1 size-5 rounded-full p-0 text-[10px]"
                  >
                    {accountFilter.size}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[260px] p-2" align="start">
              <div className="flex flex-col gap-0.5">
                {accounts.map((acct) => {
                  const selected = accountFilter.has(acct.id)
                  return (
                    <button
                      key={acct.id}
                      className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                      onClick={() => {
                        setAccountFilter((prev) => {
                          const next = new Set(prev)
                          if (next.has(acct.id)) {
                            next.delete(acct.id)
                          } else {
                            next.add(acct.id)
                          }
                          return next
                        })
                      }}
                    >
                      <div
                        className={cn(
                          'flex size-4 shrink-0 items-center justify-center rounded-sm border',
                          selected
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-muted-foreground/30',
                        )}
                      >
                        {selected && <Check className="size-3" />}
                      </div>
                      <span className="truncate">{acct.label}</span>
                    </button>
                  )
                })}
                {accountFilter.size > 0 && (
                  <>
                    <Separator className="my-1" />
                    <button
                      className="px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground"
                      onClick={() => setAccountFilter(new Set())}
                    >
                      Clear filter
                    </button>
                  </>
                )}
              </div>
            </PopoverContent>
          </Popover>
        )}
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
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedTransaction(row.original)}
                >
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

      <TransactionDetailSheet
        transaction={selectedTransaction}
        onOpenChange={(open) => {
          if (!open) setSelectedTransaction(null)
        }}
        currency={currency}
        formatCurrency={formatCurrency}
        onCreateRule={handleCreateRule}
      />

      <CreateRuleDialog
        open={ruleDialog.open}
        onOpenChange={(open) => setRuleDialog((prev) => ({ ...prev, open }))}
        defaultPattern={ruleDialog.pattern}
        defaultCategoryKey={ruleDialog.categoryKey}
      />
    </div>
  )
}

function TransactionDetailSheet({
  transaction,
  onOpenChange,
  currency,
  formatCurrency,
  onCreateRule,
}: {
  transaction: TransactionRow | null
  onOpenChange: (open: boolean) => void
  currency: string
  formatCurrency: (value: number, currency: string) => string
  onCreateRule: (wording: string, categoryKey: string) => void
}) {
  if (!transaction) return null

  const categoryKey = resolveTransactionCategoryKey(transaction)

  const details: Array<{ label: string; value: string | undefined }> = [
    { label: 'Date', value: formatDate(transaction.date) },
    {
      label: 'Value date',
      value: transaction.vdate ? formatDate(transaction.vdate) : undefined,
    },
    {
      label: 'Accounting date',
      value: transaction.rdate ? formatDate(transaction.rdate) : undefined,
    },
    { label: 'Account', value: transaction.accountName },
    { label: 'Account number', value: transaction.accountNumber },
    { label: 'Type', value: transaction.type },
    { label: 'Counterparty', value: transaction.counterparty },
    { label: 'Card', value: transaction.card },
    {
      label: 'Original wording',
      value: transaction.originalWording,
    },
    {
      label: 'Simplified wording',
      value: transaction.simplifiedWording,
    },
    { label: 'Comment', value: transaction.comment },
  ]

  const hasOriginalCurrency =
    transaction.originalCurrency &&
    transaction.originalCurrency !== currency &&
    transaction.originalValue != null

  return (
    <Sheet open={!!transaction} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="pr-6">{transaction.wording}</SheetTitle>
          <SheetDescription>
            {transaction.coming
              ? 'Pending transaction'
              : 'Completed transaction'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-4 pb-4">
          <div className="flex items-center justify-between">
            <span
              className={cn(
                'text-2xl font-semibold font-mono tabular-nums',
                transaction.value > 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400',
              )}
            >
              {transaction.value > 0 ? '+' : ''}
              {formatCurrency(transaction.value, currency)}
            </span>
          </div>

          {hasOriginalCurrency && (
            <p className="text-sm text-muted-foreground">
              Original:{' '}
              {formatCurrency(
                transaction.originalValue!,
                transaction.originalCurrency!,
              )}
            </p>
          )}

          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              Category
            </p>
            <CategoryPicker
              transactionId={transaction._id}
              currentCategoryKey={categoryKey}
              wording={transaction.wording}
              onCreateRule={onCreateRule}
            />
          </div>

          <Separator />

          <dl className="grid gap-3">
            {details
              .filter((d) => d.value)
              .map((d) => (
                <div key={d.label} className="grid grid-cols-[120px_1fr] gap-2">
                  <dt className="text-sm text-muted-foreground">{d.label}</dt>
                  <dd className="text-sm break-words">{d.value}</dd>
                </div>
              ))}
          </dl>
        </div>
      </SheetContent>
    </Sheet>
  )
}
