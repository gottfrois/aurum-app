import { useMutation } from 'convex/react'
import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { CategoryCombobox } from '~/components/category-combobox'
import { DialogFormFooter } from '~/components/dialog-form-footer'
import type { LabelData } from '~/components/label-picker'
import { LabelPicker } from '~/components/label-picker'
import { Button } from '~/components/ui/button'
import { Calendar } from '~/components/ui/calendar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { Textarea } from '~/components/ui/textarea'
import { useEncryption } from '~/contexts/encryption-context'
import { encryptFieldGroups, importPublicKey } from '~/lib/crypto'
import { cn } from '~/lib/utils'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import type { TransactionRow } from './transactions-list'

interface AccountOption {
  id: string
  label: string
  portfolioId: string
}

interface ManualTransactionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  portfolioId: Id<'portfolios'>
  /** Available bank accounts for the account selector */
  accounts: Array<AccountOption>
  /** Available labels for the label picker */
  labels?: Array<LabelData>
  /** Pre-selected account (e.g. from account detail page) */
  defaultBankAccountId?: Id<'bankAccounts'>
  /** Existing transaction data for edit mode */
  transaction?: TransactionRow
  onCreated?: (transactionId: string) => void
}

export function ManualTransactionDialog({
  open,
  onOpenChange,
  mode,
  portfolioId,
  accounts,
  labels = [],
  defaultBankAccountId,
  transaction,
  onCreated,
}: ManualTransactionDialogProps) {
  const { t } = useTranslation()
  const { workspacePublicKey } = useEncryption()
  const createManual = useMutation(api.transactions.createManualTransaction)
  const updateManual = useMutation(api.transactions.updateManualTransaction)

  const [date, setDate] = React.useState<Date>(new Date())
  const [amount, setAmount] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [categoryKey, setCategoryKey] = React.useState('')
  const [labelIds, setLabelIds] = React.useState<Array<string>>([])
  const [accountId, setAccountId] = React.useState('')
  const [notes, setNotes] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [calendarOpen, setCalendarOpen] = React.useState(false)

  // Sync form state when dialog opens
  React.useEffect(() => {
    if (!open) return
    if (mode === 'edit' && transaction) {
      setDate(new Date(transaction.date))
      setAmount(transaction.value ? String(transaction.value) : '')
      setDescription(transaction.customDescription || transaction.wording || '')
      setCategoryKey(
        transaction.userCategoryKey ||
          transaction.categoryParent ||
          transaction.category ||
          '',
      )
      setLabelIds(transaction.labelIds ?? [])
      setAccountId(transaction.bankAccountId ?? '')
      setNotes(transaction.comment ?? '')
    } else {
      setDate(new Date())
      setAmount('')
      setDescription('')
      setCategoryKey('')
      setLabelIds([])
      setAccountId(defaultBankAccountId ?? accounts[0]?.id ?? '')
      setNotes('')
    }
  }, [open, mode, transaction, defaultBankAccountId, accounts])

  const parsedAmount = Number.parseFloat(amount)
  const isValid =
    description.trim().length > 0 &&
    !Number.isNaN(parsedAmount) &&
    parsedAmount !== 0 &&
    accountId.length > 0

  const handleSubmit = async () => {
    if (!isValid || !workspacePublicKey) return

    setSaving(true)
    try {
      const pubKey = await importPublicKey(workspacePublicKey)
      const dateStr = format(date, 'yyyy-MM-dd')

      if (mode === 'create') {
        // Two-step create: insert with empty encrypted strings, then encrypt with real ID
        const transactionId = await createManual({
          bankAccountId: accountId as Id<'bankAccounts'>,
          portfolioId,
          date: dateStr,
          encryptedDetails: '',
          encryptedFinancials: '',
          encryptedCategories: '',
          labelIds:
            labelIds.length > 0
              ? (labelIds as Array<Id<'transactionLabels'>>)
              : undefined,
        })

        // Now encrypt with the real transaction ID
        const encrypted = await encryptFieldGroups(
          {
            encryptedDetails: {
              wording: description.trim(),
              originalWording: description.trim(),
              simplifiedWording: description.trim(),
              counterparty: undefined,
              card: undefined,
              comment: notes.trim() || undefined,
              customDescription: undefined,
            },
            encryptedFinancials: {
              value: parsedAmount,
              originalValue: parsedAmount,
            },
            encryptedCategories: {
              category: undefined,
              categoryParent: undefined,
              userCategoryKey: categoryKey || undefined,
            },
          },
          pubKey,
          transactionId,
        )

        await updateManual({
          transactionId,
          encryptedDetails: encrypted.encryptedDetails,
          encryptedFinancials: encrypted.encryptedFinancials,
          encryptedCategories: encrypted.encryptedCategories,
        })

        onOpenChange(false)
        onCreated?.(transactionId)
        toast.success(t('toast.manualTransactionCreated'))
      } else if (transaction) {
        // Edit mode: encrypt with existing transaction ID
        const encrypted = await encryptFieldGroups(
          {
            encryptedDetails: {
              wording: description.trim(),
              originalWording:
                transaction.originalWording || description.trim(),
              simplifiedWording: description.trim(),
              counterparty: transaction.counterparty,
              card: transaction.card,
              comment: notes.trim() || undefined,
              customDescription: undefined,
            },
            encryptedFinancials: {
              value: parsedAmount,
              originalValue: parsedAmount,
            },
            encryptedCategories: {
              category: undefined,
              categoryParent: undefined,
              userCategoryKey: categoryKey || undefined,
            },
          },
          pubKey,
          transaction._id,
        )

        await updateManual({
          transactionId: transaction._id as Id<'transactions'>,
          date: dateStr,
          bankAccountId: accountId as Id<'bankAccounts'>,
          encryptedDetails: encrypted.encryptedDetails,
          encryptedFinancials: encrypted.encryptedFinancials,
          encryptedCategories: encrypted.encryptedCategories,
          labelIds: labelIds as Array<Id<'transactionLabels'>>,
        })

        onOpenChange(false)
        toast.success(t('toast.manualTransactionUpdated'))
      }
    } catch {
      toast.error(
        mode === 'create'
          ? t('toast.failedCreateManualTransaction')
          : t('toast.failedUpdateManualTransaction'),
      )
    } finally {
      setSaving(false)
    }
  }

  const title =
    mode === 'create'
      ? t('dialogs.manualTransaction.createTitle')
      : t('dialogs.manualTransaction.editTitle')
  const subtitle =
    mode === 'create'
      ? t('dialogs.manualTransaction.createDescription')
      : t('dialogs.manualTransaction.editDescription')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{subtitle}</DialogDescription>
        </DialogHeader>
        <div className="-mx-4 max-h-[50vh] space-y-4 overflow-y-auto px-4 py-2">
          {/* Date */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t('dialogs.manualTransaction.date')}</Label>
              <span className="text-sm text-muted-foreground">
                {t('common.required')}
              </span>
            </div>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !date && 'text-muted-foreground',
                  )}
                >
                  <CalendarIcon />
                  {format(date, 'PPP')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => {
                    if (d) {
                      setDate(d)
                      setCalendarOpen(false)
                    }
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t('dialogs.manualTransaction.amount')}</Label>
              <span className="text-sm text-muted-foreground">
                {t('common.required')}
              </span>
            </div>
            <div className="flex">
              <Input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="rounded-r-none"
                autoFocus
              />
              <span className="inline-flex items-center rounded-r-md border border-l-0 border-input bg-muted px-3 text-sm text-muted-foreground">
                EUR
              </span>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t('dialogs.manualTransaction.description')}</Label>
              <span className="text-sm text-muted-foreground">
                {t('common.required')}
              </span>
            </div>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t(
                'dialogs.manualTransaction.descriptionPlaceholder',
              )}
              rows={2}
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>{t('dialogs.manualTransaction.category')}</Label>
            <CategoryCombobox
              value={categoryKey}
              onChange={(key) => setCategoryKey(key)}
              allowCreate
              modal
              variant="outline"
            />
          </div>

          {/* Labels */}
          {labels.length > 0 && (
            <div className="space-y-2">
              <Label>{t('dialogs.manualTransaction.labels')}</Label>
              <LabelPicker
                labels={labels}
                selectedLabelIds={labelIds}
                onToggle={setLabelIds}
                variant="outline"
              />
            </div>
          )}

          {/* Account */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t('dialogs.manualTransaction.account')}</Label>
              <span className="text-sm text-muted-foreground">
                {t('common.required')}
              </span>
            </div>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={t(
                    'dialogs.manualTransaction.accountPlaceholder',
                  )}
                />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>{t('dialogs.manualTransaction.notes')}</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('dialogs.manualTransaction.notesPlaceholder')}
              rows={2}
            />
          </div>
        </div>

        <DialogFormFooter
          onCancel={() => onOpenChange(false)}
          onConfirm={handleSubmit}
          disabled={!isValid || saving}
          saving={saving}
          confirmLabel={
            mode === 'create' ? t('common.create') : t('common.save')
          }
        />
      </DialogContent>
    </Dialog>
  )
}

export function useManualTransactionDialog() {
  const [open, setOpen] = React.useState(false)
  const [mode, setMode] = React.useState<'create' | 'edit'>('create')
  const [editTransaction, setEditTransaction] = React.useState<TransactionRow>()

  const openCreate = React.useCallback(() => {
    setMode('create')
    setEditTransaction(undefined)
    setOpen(true)
  }, [])

  const openEdit = React.useCallback((transaction: TransactionRow) => {
    setMode('edit')
    setEditTransaction(transaction)
    setOpen(true)
  }, [])

  return {
    open,
    setOpen,
    mode,
    editTransaction,
    openCreate,
    openEdit,
  }
}
