import type {
  ColumnDef,
  RowSelectionState,
  SortingState,
} from '@tanstack/react-table'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useMutation, useQuery } from 'convex/react'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Search,
} from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'
import { CategoryPicker } from '~/components/category-picker'
import {
  CreateCategoryDialog,
  useCreateCategoryDialog,
} from '~/components/create-category-dialog'
import type { LabelData } from '~/components/label-picker'
import { LabelPicker } from '~/components/label-picker'
import { RuleDialog } from '~/components/rule-dialog'
import { SelectionBar } from '~/components/selection-bar'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Checkbox } from '~/components/ui/checkbox'
import { Input } from '~/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { Separator } from '~/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '~/components/ui/sheet'
import { Switch } from '~/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import { useEncryption } from '~/contexts/encryption-context'
import { usePortfolio } from '~/contexts/portfolio-context'
import { useFormatCurrency } from '~/contexts/privacy-context'
import { useCommand } from '~/hooks/use-command'
import type { CategoryInfo } from '~/lib/categories'
import { resolveTransactionCategoryKey, useCategories } from '~/lib/categories'
import { encryptData, importPublicKey } from '~/lib/crypto'
import { cn } from '~/lib/utils'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'

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
  labelIds?: Array<string>
  excludedFromBudget?: boolean
  value: number
  originalValue?: number
  originalCurrency?: string
  type?: string
  coming: boolean
  counterparty?: string
  card?: string
  comment?: string
  customDescription?: string
  rdate?: string
  vdate?: string
  accountName?: string
  accountNumber?: string
}

interface TransactionsListProps {
  data: Array<TransactionRow>
  currency: string
  labels?: Array<LabelData>
  workspaceId?: string
}

const PAGE_SIZE_OPTIONS = ['25', '50', '100']
const MAX_VISIBLE_LABELS = 2
const SELECTION_COMMAND_GROUP = 'Selection'
const LABEL_COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
]

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
  labels = [],
  workspaceId,
}: TransactionsListProps) {
  const formatCurrency = useFormatCurrency()
  const { categories, getCategory } = useCategories()
  const { workspacePublicKey } = useEncryption()
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: 'date', desc: true },
  ])
  const [globalFilter, setGlobalFilter] = React.useState('')
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})
  const [selectAllMatching, setSelectAllMatching] = React.useState(false)
  const [selectedTransactionId, setSelectedTransactionId] = React.useState<
    string | null
  >(null)
  const selectedTransaction = React.useMemo(
    () => data.find((t) => t._id === selectedTransactionId) ?? null,
    [data, selectedTransactionId],
  )
  const [editingRuleId, setEditingRuleId] = React.useState<string | null>(null)
  const allRules = useQuery(
    api.transactionRules.listRules,
    editingRuleId ? {} : 'skip',
  )
  const editingRule = React.useMemo(
    () => allRules?.find((r) => r._id === editingRuleId),
    [allRules, editingRuleId],
  )
  const [ruleDialog, setRuleDialog] = React.useState<{
    open: boolean
    pattern: string
    categoryKey: string
    excludeFromBudget: boolean
    customDescription: string
  }>({
    open: false,
    pattern: '',
    categoryKey: '',
    excludeFromBudget: false,
    customDescription: '',
  })

  const updateTransactionLabels = useMutation(
    api.transactions.updateTransactionLabels,
  )
  const updateTransactionExclusion = useMutation(
    api.transactions.updateTransactionExclusion,
  )
  const batchUpdateLabels = useMutation(
    api.transactions.batchUpdateTransactionLabels,
  )
  const batchUpdateCategory = useMutation(
    api.transactions.batchUpdateTransactionCategory,
  )
  const batchUpdateExclusion = useMutation(
    api.transactions.batchUpdateTransactionExclusion,
  )
  const updateDetails = useMutation(api.transactions.updateTransactionDetails)
  const batchUpdateDetails = useMutation(
    api.transactions.batchUpdateTransactionDetails,
  )
  const labelMap = React.useMemo(() => {
    const map = new Map<string, LabelData>()
    for (const label of labels) {
      map.set(label._id, label)
    }
    return map
  }, [labels])

  const handleCreateRule = React.useCallback(
    (
      wording: string,
      categoryKey: string,
      excludeFromBudget: boolean = false,
      customDescription: string = '',
    ) => {
      setRuleDialog({
        open: true,
        pattern: wording,
        categoryKey,
        excludeFromBudget,
        customDescription,
      })
    },
    [],
  )

  const handleLabelToggle = React.useCallback(
    async (transactionId: string, labelIds: Array<string>) => {
      try {
        await updateTransactionLabels({
          transactionId: transactionId as Id<'transactions'>,
          labelIds: labelIds as Array<Id<'transactionLabels'>>,
        })
      } catch {
        toast.error('Failed to update labels')
      }
    },
    [updateTransactionLabels],
  )

  const columns = React.useMemo<Array<ColumnDef<TransactionRow>>>(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          // biome-ignore lint/a11y/noStaticElementInteractions: wrapper only stops click propagation to parent row
          <div
            role="presentation"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={
                table.getIsAllPageRowsSelected() ||
                (table.getIsSomePageRowsSelected() && 'indeterminate')
              }
              onCheckedChange={(value) => {
                table.toggleAllPageRowsSelected(!!value)
                if (!value) setSelectAllMatching(false)
              }}
              aria-label="Select all"
            />
          </div>
        ),
        cell: ({ row }) => (
          // biome-ignore lint/a11y/noStaticElementInteractions: wrapper only stops click propagation to parent row
          <div
            role="presentation"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
              aria-label="Select row"
            />
          </div>
        ),
        enableSorting: false,
      },
      {
        accessorKey: 'date',
        header: ({ column }) => (
          <button
            type="button"
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
        cell: ({ row }) => {
          const rowLabels = (row.original.labelIds ?? [])
            .map((id) => labelMap.get(id))
            .filter(Boolean) as Array<LabelData>
          const visibleLabels = rowLabels.slice(0, MAX_VISIBLE_LABELS)
          const overflowCount = rowLabels.length - MAX_VISIBLE_LABELS

          return (
            <div className="flex max-w-[150px] items-center gap-2 sm:max-w-[200px] md:max-w-[300px] lg:max-w-[400px]">
              <span
                className={cn(
                  'truncate',
                  row.original.excludedFromBudget && 'line-through',
                )}
              >
                {row.original.customDescription || row.original.wording}
              </span>
              {row.original.coming && (
                <Badge variant="outline" className="shrink-0 text-xs">
                  Pending
                </Badge>
              )}
              {visibleLabels.map((label) => (
                <Badge
                  key={label._id}
                  variant="secondary"
                  className="shrink-0 gap-1 px-1.5 py-0.5 text-xs"
                  style={{
                    backgroundColor: `${label.color}20`,
                    color: label.color,
                    borderColor: `${label.color}40`,
                  }}
                >
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: label.color }}
                  />
                  {label.name}
                </Badge>
              ))}
              {overflowCount > 0 && (
                <Badge
                  variant="secondary"
                  className="shrink-0 px-1.5 py-0.5 text-xs"
                >
                  +{overflowCount}
                </Badge>
              )}
            </div>
          )
        },
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
            // biome-ignore lint/a11y/noStaticElementInteractions: wrapper only stops click propagation to parent row
            <div
              role="presentation"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <CategoryPicker
                transactionId={row.original._id}
                currentCategoryKey={categoryKey}
                wording={row.original.wording}
                onCreateRule={handleCreateRule}
              />
            </div>
          )
        },
      },
      {
        accessorKey: 'value',
        header: ({ column }) => (
          <button
            type="button"
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
    [currency, formatCurrency, getCategory, handleCreateRule, labelMap],
  )

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter, rowSelection },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: true,
    getRowId: (row) => row._id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex: false,
    initialState: { pagination: { pageSize: 25 } },
    globalFilterFn: (row, _columnId, filterValue: string) => {
      const wording = row.original.wording.toLowerCase()
      return wording.includes(filterValue.toLowerCase())
    },
  })

  const { pageIndex, pageSize } = table.getState().pagination
  const totalRows = table.getFilteredRowModel().rows.length
  const from = totalRows === 0 ? 0 : pageIndex * pageSize + 1
  const to = Math.min((pageIndex + 1) * pageSize, totalRows)

  const selectedCount = selectAllMatching
    ? totalRows
    : Object.keys(rowSelection).length
  const hasSelection = selectedCount > 0

  const clearSelection = React.useCallback(() => {
    setRowSelection({})
    setSelectAllMatching(false)
  }, [])

  const getSelectedIds = React.useCallback((): Array<string> => {
    if (selectAllMatching) {
      return table.getFilteredRowModel().rows.map((r) => r.original._id)
    }
    return Object.keys(rowSelection)
  }, [selectAllMatching, rowSelection, table])

  const getSelectedRows = React.useCallback((): Array<TransactionRow> => {
    if (selectAllMatching) {
      return table.getFilteredRowModel().rows.map((r) => r.original)
    }
    return Object.keys(rowSelection).map((id) => table.getRow(id).original)
  }, [selectAllMatching, rowSelection, table])

  const handleBulkLabelToggle = React.useCallback(
    async (labelId: string, checked: boolean) => {
      const ids = getSelectedIds()
      if (ids.length === 0) return

      const label = labelMap.get(labelId)
      try {
        if (checked) {
          await batchUpdateLabels({
            transactionIds: ids as Array<Id<'transactions'>>,
            addLabelIds: [labelId as Id<'transactionLabels'>],
          })
          toast.success(
            `Adding "${label?.name}" to ${ids.length} transactions...`,
          )
        } else {
          await batchUpdateLabels({
            transactionIds: ids as Array<Id<'transactions'>>,
            removeLabelIds: [labelId as Id<'transactionLabels'>],
          })
          toast.success(
            `Removing "${label?.name}" from ${ids.length} transactions...`,
          )
        }
      } catch {
        toast.error('Failed to update labels')
      }
    },
    [getSelectedIds, batchUpdateLabels, labelMap],
  )

  const handleBulkCategoryChange = React.useCallback(
    async (categoryKey: string) => {
      const ids = getSelectedIds()
      if (ids.length === 0) return

      try {
        if (!workspacePublicKey) throw new Error('Vault not unlocked')
        const pubKey = await importPublicKey(workspacePublicKey)

        const updates = await Promise.all(
          ids.map(async (transactionId) => {
            const encryptedCategories = await encryptData(
              {
                category: categoryKey,
                categoryParent: undefined,
                userCategoryKey: categoryKey,
              },
              pubKey,
              transactionId,
              'encryptedCategories',
            )
            return {
              transactionId: transactionId as Id<'transactions'>,
              encryptedCategories,
            }
          }),
        )

        await batchUpdateCategory({ updates })
        const cat = getCategory(categoryKey)
        toast.success(
          `Changing category to "${cat.label}" for ${ids.length} transactions...`,
        )
      } catch {
        toast.error('Failed to update category')
      }
    },
    [getSelectedIds, batchUpdateCategory, workspacePublicKey, getCategory],
  )

  const handleExclusionToggle = React.useCallback(
    async (transactionId: string, excluded: boolean) => {
      try {
        await updateTransactionExclusion({
          transactionId: transactionId as Id<'transactions'>,
          excludedFromBudget: excluded,
        })
      } catch {
        toast.error('Failed to update transaction')
      }
    },
    [updateTransactionExclusion],
  )

  const handleBulkExclusionChange = React.useCallback(
    async (excluded: boolean) => {
      const ids = getSelectedIds()
      if (ids.length === 0) return

      try {
        await batchUpdateExclusion({
          transactionIds: ids as Array<Id<'transactions'>>,
          excludedFromBudget: excluded,
        })
        toast.success(
          excluded
            ? `Excluding ${ids.length} transactions from budget...`
            : `Including ${ids.length} transactions in budget...`,
        )
      } catch {
        toast.error('Failed to update exclusion')
      }
    },
    [getSelectedIds, batchUpdateExclusion],
  )

  const handleDescriptionUpdate = React.useCallback(
    async (transactionId: string, customDescription: string) => {
      const txn = data.find((t) => t._id === transactionId)
      if (!txn || !workspacePublicKey) return

      try {
        const pubKey = await importPublicKey(workspacePublicKey)
        const encryptedDetails = await encryptData(
          {
            wording: txn.wording,
            originalWording: txn.originalWording,
            simplifiedWording: txn.simplifiedWording,
            counterparty: txn.counterparty,
            card: txn.card,
            comment: txn.comment,
            customDescription: customDescription || undefined,
          },
          pubKey,
          transactionId,
          'encryptedDetails',
        )
        await updateDetails({
          transactionId: transactionId as Id<'transactions'>,
          encryptedDetails,
        })
        toast.success(
          customDescription ? 'Description updated' : 'Description reset',
          customDescription
            ? {
                action: {
                  label: 'Create rule',
                  onClick: () =>
                    handleCreateRule(txn.wording, '', false, customDescription),
                },
              }
            : undefined,
        )
      } catch {
        toast.error('Failed to update description')
      }
    },
    [data, workspacePublicKey, updateDetails, handleCreateRule],
  )

  const handleBulkDescriptionChange = React.useCallback(
    async (customDescription: string) => {
      const rows = getSelectedRows()
      if (rows.length === 0 || !workspacePublicKey) return

      try {
        const pubKey = await importPublicKey(workspacePublicKey)
        const items = await Promise.all(
          rows.map(async (txn) => {
            const encryptedDetails = await encryptData(
              {
                wording: txn.wording,
                originalWording: txn.originalWording,
                simplifiedWording: txn.simplifiedWording,
                counterparty: txn.counterparty,
                card: txn.card,
                comment: txn.comment,
                customDescription: customDescription || undefined,
              },
              pubKey,
              txn._id,
              'encryptedDetails',
            )
            return {
              transactionId: txn._id as Id<'transactions'>,
              encryptedDetails,
            }
          }),
        )
        await batchUpdateDetails({ items })
        toast.success(`Updating description for ${rows.length} transactions...`)
      } catch {
        toast.error('Failed to update descriptions')
      }
    },
    [getSelectedRows, batchUpdateDetails, workspacePublicKey],
  )

  const selectedRows = React.useMemo(() => getSelectedRows(), [getSelectedRows])

  useCommand('selection.change-labels', {
    handler: () => {},
    disabled: !hasSelection,
    view: ({ onBack }) => (
      <BulkLabelView
        labels={labels}
        selectedRows={selectedRows}
        workspaceId={workspaceId}
        onToggle={handleBulkLabelToggle}
        onBack={onBack}
      />
    ),
  })

  useCommand('selection.change-category', {
    handler: () => {},
    disabled: !hasSelection,
    view: ({ onBack }) => (
      <BulkCategoryView
        categories={categories}
        selectedRows={selectedRows}
        onSelect={handleBulkCategoryChange}
        onBack={onBack}
      />
    ),
  })

  useCommand('selection.toggle-exclusion', {
    handler: () => {},
    disabled: !hasSelection,
    view: ({ onBack }) => (
      <BulkExclusionView onSelect={handleBulkExclusionChange} onBack={onBack} />
    ),
  })

  useCommand('selection.change-description', {
    handler: () => {},
    disabled: !hasSelection,
    view: ({ onBack }) => (
      <BulkDescriptionView
        onSubmit={handleBulkDescriptionChange}
        onBack={onBack}
      />
    ),
  })

  useCommand('selection.clear', {
    handler: clearSelection,
    disabled: !hasSelection,
  })

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
                  className={cn(
                    'cursor-pointer',
                    row.original.excludedFromBudget && 'text-muted-foreground',
                  )}
                  data-state={row.getIsSelected() && 'selected'}
                  onClick={() => setSelectedTransactionId(row.original._id)}
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

      <SelectionBar
        count={selectedCount}
        totalMatchingCount={totalRows}
        selectAllMatching={selectAllMatching}
        onSelectAllMatching={() => setSelectAllMatching(true)}
        onClear={clearSelection}
        commandGroup={SELECTION_COMMAND_GROUP}
      />

      <TransactionDetailSheet
        transaction={selectedTransaction}
        onOpenChange={(open) => {
          if (!open) setSelectedTransactionId(null)
        }}
        currency={currency}
        formatCurrency={formatCurrency}
        onCreateRule={handleCreateRule}
        labels={labels}
        workspaceId={workspaceId}
        onLabelToggle={handleLabelToggle}
        onExclusionToggle={handleExclusionToggle}
        onDescriptionUpdate={handleDescriptionUpdate}
      />

      <RuleDialog
        open={ruleDialog.open}
        onOpenChange={(open) => setRuleDialog((prev) => ({ ...prev, open }))}
        defaultPattern={ruleDialog.pattern}
        defaultCategoryKey={ruleDialog.categoryKey}
        defaultExcludeFromBudget={ruleDialog.excludeFromBudget}
        defaultCustomDescription={ruleDialog.customDescription}
        onCreated={(ruleId) => setEditingRuleId(ruleId)}
      />

      <RuleDialog
        open={!!editingRule}
        onOpenChange={(open) => {
          if (!open) setEditingRuleId(null)
        }}
        rule={editingRule}
      />
    </div>
  )
}

function BulkLabelView({
  labels,
  selectedRows,
  workspaceId,
  onToggle,
  onBack,
}: {
  labels: Array<LabelData>
  selectedRows: Array<TransactionRow>
  workspaceId?: string
  onToggle: (labelId: string, checked: boolean) => void
  onBack: () => void
}) {
  const [search, setSearch] = React.useState('')
  // Optimistic overrides: tracks labels toggled by the user before the server confirms
  const [optimistic, setOptimistic] = React.useState<Map<string, boolean>>(
    new Map(),
  )
  const createLabelMutation = useMutation(api.transactionLabels.createLabel)

  const handleToggle = (labelId: string, checked: boolean) => {
    setOptimistic((prev) => new Map(prev).set(labelId, checked))
    onToggle(labelId, checked)
  }

  const handleCreate = async () => {
    const name = search.trim()
    if (!name || !workspaceId) return

    try {
      const color = LABEL_COLORS[labels.length % LABEL_COLORS.length]
      const labelId = await createLabelMutation({
        workspaceId: workspaceId as Id<'workspaces'>,
        name,
        color,
      })
      setSearch('')
      handleToggle(labelId, true)
    } catch {
      toast.error('Failed to create label')
    }
  }

  // Compute checked state for each label, with optimistic overrides
  const labelStates = React.useMemo(() => {
    const states = new Map<string, 'all' | 'some' | 'none'>()
    const total = selectedRows.length
    for (const label of labels) {
      // If user has optimistically toggled this label, use that value
      const override = optimistic.get(label._id)
      if (override !== undefined) {
        states.set(label._id, override ? 'all' : 'none')
        continue
      }
      const count = selectedRows.filter((r) =>
        r.labelIds?.includes(label._id),
      ).length
      if (count === 0) states.set(label._id, 'none')
      else if (count === total) states.set(label._id, 'all')
      else states.set(label._id, 'some')
    }
    return states
  }, [labels, selectedRows, optimistic])

  const query = search.trim().toLowerCase()
  const filtered = query
    ? labels.filter((l) => l.name.toLowerCase().includes(query))
    : labels
  const exactMatch = labels.some((l) => l.name.toLowerCase() === query)

  return (
    <>
      <div className="flex h-12 items-center gap-2 border-b px-3">
        <button
          type="button"
          onClick={onBack}
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
        </button>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search or create label..."
          className="flex h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          autoFocus
        />
      </div>
      <div className="min-h-[300px] max-h-[300px] overflow-y-auto overflow-x-hidden scroll-py-1 px-2 py-1">
        {filtered.length === 0 && !search.trim() && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No labels found.
          </p>
        )}
        {filtered.length > 0 && (
          <div className="py-1">
            {filtered.map((label) => {
              const state = labelStates.get(label._id) ?? 'none'
              const checked = state === 'all'
              const indeterminate = state === 'some'
              return (
                <button
                  type="button"
                  key={label._id}
                  onClick={() =>
                    handleToggle(label._id, !checked && !indeterminate)
                  }
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-sm hover:bg-accent"
                >
                  <Checkbox
                    checked={indeterminate ? 'indeterminate' : checked}
                    tabIndex={-1}
                    className="pointer-events-none"
                  />
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: label.color }}
                  />
                  <span>{label.name}</span>
                </button>
              )
            })}
          </div>
        )}
        {search.trim() && !exactMatch && (
          <button
            type="button"
            onClick={handleCreate}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-sm hover:bg-accent"
          >
            <Plus className="size-3" />
            Create &ldquo;{search.trim()}&rdquo;
          </button>
        )}
      </div>
    </>
  )
}

function BulkCategoryView({
  categories,
  selectedRows,
  onSelect,
  onBack,
}: {
  categories: Array<CategoryInfo>
  selectedRows: Array<TransactionRow>
  onSelect: (categoryKey: string) => void
  onBack: () => void
}) {
  const [search, setSearch] = React.useState('')
  const { singlePortfolioId } = usePortfolio()

  // Determine current category state across selected rows
  const currentCategoryKey = React.useMemo(() => {
    if (selectedRows.length === 0) return null
    const first = resolveTransactionCategoryKey(selectedRows[0])
    const allSame = selectedRows.every(
      (r) => resolveTransactionCategoryKey(r) === first,
    )
    return allSame ? first : null
  }, [selectedRows])

  const builtInCategories = categories.filter((c) => c.builtIn)
  const customCategories = categories.filter((c) => !c.builtIn)

  const query = search.trim().toLowerCase()
  const filterCats = (cats: Array<CategoryInfo>) =>
    query ? cats.filter((c) => c.label.toLowerCase().includes(query)) : cats
  const filteredBuiltIn = filterCats(builtInCategories)
  const filteredCustom = filterCats(customCategories)

  const exactMatch = categories.some((c) => c.label.toLowerCase() === query)

  const createDialog = useCreateCategoryDialog(
    customCategories.length,
    singlePortfolioId,
  )

  const handleSelect = (categoryKey: string) => {
    onSelect(categoryKey)
    onBack()
  }

  const handleCreateClick = () => {
    const name = search.trim()
    if (!name) return
    setSearch('')
    createDialog.openDialog(name)
  }

  const handleCreated = (categoryKey: string) => {
    handleSelect(categoryKey)
  }

  return (
    <>
      <div className="flex h-12 items-center gap-2 border-b px-3">
        <button
          type="button"
          onClick={onBack}
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
        </button>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search or create category..."
          className="flex h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          autoFocus
        />
      </div>
      <div className="min-h-[300px] max-h-[300px] overflow-y-auto overflow-x-hidden scroll-py-1 px-2 py-1">
        {filteredBuiltIn.length === 0 &&
          filteredCustom.length === 0 &&
          (search.trim() ? (
            <div className="py-1">
              <button
                type="button"
                onClick={handleCreateClick}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-sm hover:bg-accent"
              >
                <Plus className="size-3" />
                Create &ldquo;{search.trim()}&rdquo;
              </button>
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No categories found.
            </p>
          ))}
        {filteredBuiltIn.length > 0 && (
          <div className="py-1">
            {filteredBuiltIn.map((cat) => (
              <button
                type="button"
                key={cat.key}
                onClick={() => handleSelect(cat.key)}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-sm hover:bg-accent"
              >
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: cat.color }}
                />
                <span>{cat.label}</span>
                {currentCategoryKey === cat.key && (
                  <span className="ml-auto text-xs text-muted-foreground">
                    Current
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
        {filteredCustom.length > 0 && (
          <>
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              Custom
            </div>
            <div className="py-1">
              {filteredCustom.map((cat) => (
                <button
                  type="button"
                  key={cat.key}
                  onClick={() => handleSelect(cat.key)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-sm px-2 py-2 text-sm hover:bg-accent',
                    cat.parentKey && 'pl-6',
                  )}
                >
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span>{cat.label}</span>
                  {currentCategoryKey === cat.key && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      Current
                    </span>
                  )}
                </button>
              ))}
            </div>
          </>
        )}
        {search.trim() &&
          !exactMatch &&
          (filteredBuiltIn.length > 0 || filteredCustom.length > 0) && (
            <div className="border-t py-1">
              <button
                type="button"
                onClick={handleCreateClick}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-sm hover:bg-accent"
              >
                <Plus className="size-3" />
                Create &ldquo;{search.trim()}&rdquo;
              </button>
            </div>
          )}
      </div>
      <CreateCategoryDialog
        open={createDialog.dialogOpen}
        onOpenChange={createDialog.setDialogOpen}
        initialName={createDialog.initialName}
        initialColor={createDialog.initialColor}
        defaultPortfolioId={createDialog.defaultPortfolioId}
        onCreated={handleCreated}
      />
    </>
  )
}

function TransactionDetailSheet({
  transaction,
  onOpenChange,
  currency,
  formatCurrency,
  onCreateRule,
  labels,
  workspaceId,
  onLabelToggle,
  onExclusionToggle,
  onDescriptionUpdate,
}: {
  transaction: TransactionRow | null
  onOpenChange: (open: boolean) => void
  currency: string
  formatCurrency: (value: number, currency: string) => string
  onCreateRule: (
    wording: string,
    categoryKey: string,
    excludeFromBudget?: boolean,
  ) => void
  labels: Array<LabelData>
  workspaceId?: string
  onLabelToggle: (transactionId: string, labelIds: Array<string>) => void
  onExclusionToggle: (transactionId: string, excluded: boolean) => void
  onDescriptionUpdate: (
    transactionId: string,
    customDescription: string,
  ) => void
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
    { label: 'Wording', value: transaction.wording },
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
          <EditableDescription
            transactionId={transaction._id}
            customDescription={transaction.customDescription}
            wording={transaction.wording}
            onUpdate={onDescriptionUpdate}
          />
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
              {transaction.originalValue != null &&
                transaction.originalCurrency &&
                formatCurrency(
                  transaction.originalValue,
                  transaction.originalCurrency,
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
              modal
            />
          </div>

          {workspaceId && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                Labels
              </p>
              <LabelPicker
                labels={labels}
                selectedLabelIds={transaction.labelIds ?? []}
                workspaceId={workspaceId}
                onToggle={(labelIds) =>
                  onLabelToggle(transaction._id, labelIds)
                }
              />
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <EyeOff className="size-4 text-muted-foreground" />
              <span className="text-sm">Exclude from budget</span>
            </div>
            <Switch
              checked={transaction.excludedFromBudget ?? false}
              onCheckedChange={(checked) => {
                onExclusionToggle(transaction._id, checked)
                if (checked) {
                  toast.success('Excluded from budget', {
                    action: {
                      label: 'Create rule',
                      onClick: () =>
                        onCreateRule(transaction.wording, '', true),
                    },
                  })
                } else {
                  toast.success('Included in budget')
                }
              }}
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

function BulkExclusionView({
  onSelect,
  onBack,
}: {
  onSelect: (excluded: boolean) => void
  onBack: () => void
}) {
  const options = [
    { label: 'Exclude from budget', value: true, icon: EyeOff },
    { label: 'Include in budget', value: false, icon: Eye },
  ]

  return (
    <>
      <div className="flex h-12 items-center gap-2 border-b px-3">
        <button
          type="button"
          onClick={onBack}
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-sm font-medium">Budget visibility</span>
      </div>
      <div className="min-h-[300px] max-h-[300px] overflow-y-auto overflow-x-hidden scroll-py-1 px-2 py-1">
        {options.map((option) => (
          <button
            type="button"
            key={String(option.value)}
            onClick={() => {
              onSelect(option.value)
              onBack()
            }}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-sm hover:bg-accent"
          >
            <option.icon className="size-4" />
            <span>{option.label}</span>
          </button>
        ))}
      </div>
    </>
  )
}

function EditableDescription({
  transactionId,
  customDescription,
  wording,
  onUpdate,
}: {
  transactionId: string
  customDescription?: string
  wording: string
  onUpdate: (transactionId: string, customDescription: string) => void
}) {
  const [editing, setEditing] = React.useState(false)
  const [value, setValue] = React.useState(customDescription ?? '')
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    setValue(customDescription ?? '')
  }, [customDescription])

  const handleSave = () => {
    setEditing(false)
    const trimmed = value.trim()
    if (trimmed !== (customDescription ?? '')) {
      onUpdate(transactionId, trimmed)
    }
  }

  if (editing) {
    return (
      <div className="pr-6">
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave()
            if (e.key === 'Escape') {
              setValue(customDescription ?? '')
              setEditing(false)
            }
          }}
          className="text-lg font-semibold"
          placeholder={wording}
          autoFocus
        />
        {customDescription && (
          <p className="mt-1 text-xs text-muted-foreground">{wording}</p>
        )}
      </div>
    )
  }

  return (
    <div className="pr-6">
      <button
        type="button"
        tabIndex={-1}
        className="group flex items-center gap-2 text-left"
        onClick={() => setEditing(true)}
      >
        <SheetTitle className="text-lg">
          {customDescription || wording}
        </SheetTitle>
        <Pencil className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </button>
      {customDescription && (
        <p className="mt-0.5 text-xs text-muted-foreground">{wording}</p>
      )}
    </div>
  )
}

function BulkDescriptionView({
  onSubmit,
  onBack,
}: {
  onSubmit: (description: string) => void
  onBack: () => void
}) {
  const [value, setValue] = React.useState('')

  return (
    <>
      <div className="flex h-12 items-center gap-2 border-b px-3">
        <button
          type="button"
          onClick={onBack}
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-sm font-medium">Change description</span>
      </div>
      <div className="p-3">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Custom description..."
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter' && value.trim()) {
              onSubmit(value.trim())
              onBack()
            }
          }}
        />
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onBack}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!value.trim()}
            onClick={() => {
              onSubmit(value.trim())
              onBack()
            }}
          >
            Apply
          </Button>
        </div>
      </div>
    </>
  )
}
