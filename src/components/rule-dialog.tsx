import * as Sentry from '@sentry/tanstackstart-react'
import { useMutation, useQuery } from 'convex/react'
import { ChevronsUpDown, Loader2, Search } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { CategoryCombobox } from '~/components/category-combobox'
import { DialogFormFooter } from '~/components/dialog-form-footer'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Checkbox } from '~/components/ui/checkbox'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '~/components/ui/command'
import {
  Dialog,
  DialogContent,
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
import { Switch } from '~/components/ui/switch'
import { usePortfolio } from '~/contexts/portfolio-context'
import { useCachedDecryptRecords } from '~/hooks/use-cached-decrypt'
import { useRetroactiveRuleApplication } from '~/hooks/use-retroactive-rule-application'
import { type PreviewMatch, useRulePreview } from '~/hooks/use-rule-preview'
import { cn } from '~/lib/utils'
import { api } from '../../convex/_generated/api'
import type { Doc, Id } from '../../convex/_generated/dataModel'

type DecryptedBankAccount = Doc<'bankAccounts'> & {
  name?: string
  customName?: string
  connectorName?: string
}

interface RuleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  rule?: Doc<'transactionRules'>
  defaultPattern?: string
  defaultCategoryKey?: string
  defaultExcludeFromBudget?: boolean
  defaultCustomDescription?: string
  onCreated?: (ruleId: Id<'transactionRules'>) => void
  portfolioId?: Id<'portfolios'>
}

export function RuleDialog({
  open,
  onOpenChange,
  rule,
  defaultPattern = '',
  defaultCategoryKey = '',
  defaultExcludeFromBudget = false,
  defaultCustomDescription = '',
  onCreated,
  portfolioId,
}: RuleDialogProps) {
  const { t } = useTranslation()
  const isEdit = !!rule
  const [pattern, setPattern] = React.useState(defaultPattern)
  const [matchType, setMatchType] = React.useState<'contains' | 'regex'>(
    'contains',
  )
  const [categoryKey, setCategoryKey] = React.useState(defaultCategoryKey)
  const [excludeFromBudget, setExcludeFromBudget] = React.useState(
    defaultExcludeFromBudget,
  )
  const [selectedLabelIds, setSelectedLabelIds] = React.useState<string[]>([])
  const [selectedAccountIds, setSelectedAccountIds] = React.useState<string[]>(
    [],
  )
  const [customDescription, setCustomDescription] = React.useState('')
  const [applyRetroactively, setApplyRetroactively] = React.useState(true)
  const [saving, setSaving] = React.useState(false)

  const workspace = useQuery(api.workspaces.getMyWorkspace)
  const { allPortfolioIds } = usePortfolio()
  const labels = useQuery(
    api.transactionLabels.listWorkspaceLabels,
    workspace ? { workspaceId: workspace._id } : 'skip',
  )

  // Fetch bank accounts for the relevant scope
  const rawBankAccountsSingle = useQuery(
    api.powens.listBankAccounts,
    portfolioId ? { portfolioId } : 'skip',
  )
  const rawBankAccountsAll = useQuery(
    api.powens.listAllBankAccounts,
    !portfolioId && allPortfolioIds.length > 0
      ? { portfolioIds: allPortfolioIds }
      : 'skip',
  )
  const rawBankAccounts = portfolioId
    ? rawBankAccountsSingle
    : rawBankAccountsAll
  const bankAccounts = useCachedDecryptRecords(
    'bankAccounts',
    rawBankAccounts,
  ) as DecryptedBankAccount[] | undefined

  const activeBankAccounts = React.useMemo(
    () => bankAccounts?.filter((ba) => !ba.deleted && !ba.disabled) ?? [],
    [bankAccounts],
  )

  const createRule = useMutation(api.transactionRules.createRule)
  const updateRule = useMutation(api.transactionRules.updateRule)
  const { apply } = useRetroactiveRuleApplication()
  const preview = useRulePreview()

  React.useEffect(() => {
    if (open) {
      preview.reset()
      if (rule) {
        setPattern(rule.pattern)
        setMatchType(rule.matchType)
        setCategoryKey(rule.categoryKey ?? '')
        setExcludeFromBudget(rule.excludeFromBudget ?? false)
        setSelectedLabelIds((rule.labelIds as string[] | undefined) ?? [])
        setSelectedAccountIds((rule.accountIds as string[] | undefined) ?? [])
        setCustomDescription(rule.customDescription ?? '')
        setApplyRetroactively(true)
      } else {
        setPattern(defaultPattern)
        setMatchType('contains')
        setCategoryKey(defaultCategoryKey)
        setExcludeFromBudget(defaultExcludeFromBudget)
        setSelectedLabelIds([])
        setSelectedAccountIds([])
        setCustomDescription(defaultCustomDescription)
        setApplyRetroactively(true)
      }
    }
  }, [
    open,
    rule,
    defaultPattern,
    defaultCategoryKey,
    defaultExcludeFromBudget,
    defaultCustomDescription,
    preview.reset,
  ])

  const hasAction =
    !!categoryKey ||
    excludeFromBudget ||
    selectedLabelIds.length > 0 ||
    !!customDescription.trim()

  const handleSave = async () => {
    if (!pattern.trim() || !hasAction) return
    setSaving(true)
    try {
      const accountIdsArg =
        selectedAccountIds.length > 0
          ? (selectedAccountIds as Array<Id<'bankAccounts'>>)
          : undefined

      if (isEdit) {
        await updateRule({
          ruleId: rule._id,
          pattern: pattern.trim(),
          matchType,
          categoryKey: categoryKey || '',
          excludeFromBudget,
          labelIds: selectedLabelIds as Array<Id<'transactionLabels'>>,
          customDescription: customDescription.trim() || '',
          accountIds: accountIdsArg ?? ([] as Array<Id<'bankAccounts'>>),
        })
        toast.success(t('toast.ruleUpdated'))
      } else {
        const ruleId = await createRule({
          pattern: pattern.trim(),
          matchType,
          categoryKey: categoryKey || undefined,
          excludeFromBudget: excludeFromBudget || undefined,
          labelIds:
            selectedLabelIds.length > 0
              ? (selectedLabelIds as Array<Id<'transactionLabels'>>)
              : undefined,
          customDescription: customDescription.trim() || undefined,
          portfolioId,
          accountIds: accountIdsArg,
        })
        toast.success(t('toast.ruleCreated'), {
          description: applyRetroactively
            ? t('toast.ruleCreatedRetroactive')
            : t('toast.ruleCreatedNewOnly'),
          action: onCreated
            ? {
                label: 'Edit',
                onClick: () => onCreated(ruleId),
              }
            : undefined,
        })

        if (applyRetroactively) {
          apply({
            ruleId,
            rulePattern: pattern.trim(),
            pattern: pattern.trim(),
            matchType,
            categoryKey: categoryKey || undefined,
            excludeFromBudget: excludeFromBudget || undefined,
            labelIds:
              selectedLabelIds.length > 0 ? selectedLabelIds : undefined,
            customDescription: customDescription.trim() || undefined,
            portfolioId,
            accountIds: accountIdsArg,
          })
        }
      }
      onOpenChange(false)
    } catch (error) {
      Sentry.captureException(error)
      toast.error(
        isEdit ? t('toast.failedUpdateRule') : t('toast.failedCreateRule'),
      )
    } finally {
      setSaving(false)
    }
  }

  const toggleLabel = (labelId: string) => {
    setSelectedLabelIds((prev) =>
      prev.includes(labelId)
        ? prev.filter((id) => id !== labelId)
        : [...prev, labelId],
    )
  }

  const selectedLabels = (labels ?? []).filter((l) =>
    selectedLabelIds.includes(l._id),
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? t('dialogs.rule.editTitle')
              : t('dialogs.rule.createTitle')}
          </DialogTitle>
        </DialogHeader>

        <div className="-mx-4 max-h-[50vh] overflow-y-auto px-4">
          <div className="space-y-5">
            {/* Condition */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t('dialogs.rule.conditionLabel')}
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="flex">
                <MatchTypePicker
                  matchType={matchType}
                  onChange={setMatchType}
                />
                <Input
                  value={pattern}
                  onChange={(e) => setPattern(e.target.value)}
                  placeholder={
                    matchType === 'regex'
                      ? t('dialogs.rule.patternPlaceholderRegex')
                      : t('dialogs.rule.patternPlaceholderContains')
                  }
                  className="rounded-l-none border-l-0 font-mono"
                  autoFocus
                />
              </div>

              {/* Account filter */}
              {activeBankAccounts.length > 0 && (
                <div className="space-y-2">
                  <Label>{t('dialogs.rule.accountLabel')}</Label>
                  <AccountMultiSelect
                    accounts={activeBankAccounts}
                    selectedAccountIds={selectedAccountIds}
                    onToggle={(accountId) =>
                      setSelectedAccountIds((prev) =>
                        prev.includes(accountId)
                          ? prev.filter((id) => id !== accountId)
                          : [...prev, accountId],
                      )
                    }
                  />
                </div>
              )}
            </div>

            {/* Preview */}
            <RulePreview
              pattern={pattern}
              matchType={matchType}
              portfolioId={portfolioId}
              selectedAccountIds={selectedAccountIds}
              preview={preview}
            />

            {/* Actions */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground uppercase tracking-wide">
                  {t('dialogs.rule.actionsLabel')}
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>

              {/* Assign category */}
              <div className="space-y-2">
                <Label>{t('dialogs.rule.categoryLabel')}</Label>
                <CategoryCombobox
                  value={categoryKey}
                  onChange={(key) => setCategoryKey(key)}
                  allowCreate
                  trigger={({ category, open }) => (
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={open}
                      className="w-full justify-between font-normal"
                    >
                      {categoryKey ? (
                        <span className="flex items-center gap-2">
                          <span
                            className="size-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: category.color }}
                          />
                          {category.label}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          {t('dialogs.rule.noCategory')}
                        </span>
                      )}
                      <ChevronsUpDown className="ml-auto size-4 shrink-0 opacity-50" />
                    </Button>
                  )}
                />
              </div>

              {/* Add labels */}
              {labels && labels.length > 0 && (
                <div className="space-y-2">
                  <Label>{t('dialogs.rule.labelsLabel')}</Label>
                  <LabelMultiSelect
                    labels={labels}
                    selectedLabelIds={selectedLabelIds}
                    selectedLabels={selectedLabels}
                    onToggle={toggleLabel}
                  />
                </div>
              )}

              {/* Change description */}
              <div className="space-y-2">
                <Label>{t('dialogs.rule.descriptionLabel')}</Label>
                <Input
                  value={customDescription}
                  onChange={(e) => setCustomDescription(e.target.value)}
                  placeholder={t('dialogs.rule.descriptionPlaceholder')}
                />
              </div>

              {/* Exclude from budget */}
              <div className="flex items-center justify-between">
                <Label htmlFor="exclude-budget" className="font-normal">
                  {t('dialogs.rule.excludeBudget')}
                </Label>
                <Switch
                  id="exclude-budget"
                  checked={excludeFromBudget}
                  onCheckedChange={setExcludeFromBudget}
                />
              </div>
            </div>

            {/* Apply retroactively */}
            {!isEdit && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="apply-retroactively"
                  checked={applyRetroactively}
                  onCheckedChange={(checked) =>
                    setApplyRetroactively(checked === true)
                  }
                />
                <Label htmlFor="apply-retroactively" className="font-normal">
                  {t('dialogs.rule.applyRetroactively')}
                </Label>
              </div>
            )}
          </div>
        </div>

        <DialogFormFooter
          onCancel={() => onOpenChange(false)}
          onConfirm={handleSave}
          disabled={saving || !pattern.trim() || !hasAction}
          saving={saving}
          confirmLabel={isEdit ? t('button.saveRule') : t('button.createRule')}
        />
      </DialogContent>
    </Dialog>
  )
}

function MatchTypePicker({
  matchType,
  onChange,
}: {
  matchType: 'contains' | 'regex'
  onChange: (v: 'contains' | 'regex') => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = React.useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-9 shrink-0 items-center gap-1 rounded-l-md border bg-muted/50 px-3 text-sm font-medium transition-colors hover:bg-accent"
        >
          {matchType === 'contains'
            ? t('dialogs.rule.matchContains')
            : t('dialogs.rule.matchRegex').split(' ')[0]}
          <ChevronsUpDown className="size-3 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[140px] p-1" align="start">
        <button
          type="button"
          className={cn(
            'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent',
            matchType === 'contains' && 'font-medium',
          )}
          onClick={() => {
            onChange('contains')
            setOpen(false)
          }}
        >
          {t('dialogs.rule.matchContains')}
        </button>
        <button
          type="button"
          className={cn(
            'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent',
            matchType === 'regex' && 'font-medium',
          )}
          onClick={() => {
            onChange('regex')
            setOpen(false)
          }}
        >
          {t('dialogs.rule.matchRegex')}
        </button>
      </PopoverContent>
    </Popover>
  )
}

function RulePreview({
  pattern,
  matchType,
  portfolioId,
  selectedAccountIds,
  preview,
}: {
  pattern: string
  matchType: 'contains' | 'regex'
  portfolioId?: Id<'portfolios'>
  selectedAccountIds: string[]
  preview: ReturnType<typeof useRulePreview>
}) {
  const { t } = useTranslation()
  const handleTest = () => {
    preview.scan({
      pattern: pattern.trim(),
      matchType,
      portfolioId,
      accountIds:
        selectedAccountIds.length > 0
          ? (selectedAccountIds as Array<Id<'bankAccounts'>>)
          : undefined,
    })
  }

  const hasResults =
    !preview.isScanning && !preview.error && preview.totalScanned > 0

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!pattern.trim() || preview.isScanning}
        onClick={handleTest}
      >
        {preview.isScanning ? (
          <>
            <Loader2 className="size-3.5 animate-spin" />
            {t('dialogs.rule.scanning')}
          </>
        ) : (
          <>
            <Search className="size-3.5" />
            {t('dialogs.rule.testRule')}
          </>
        )}
      </Button>

      {preview.isScanning && preview.totalScanned > 0 && (
        <p className="text-xs text-muted-foreground">
          {t('dialogs.rule.scanProgress', {
            matched: preview.totalMatched,
            scanned: preview.totalScanned,
          })}
        </p>
      )}

      {preview.error && (
        <p className="text-xs text-destructive">{preview.error}</p>
      )}

      {hasResults && (
        <div className="min-w-0 space-y-2">
          <p className="text-xs text-muted-foreground">
            {t('dialogs.rule.scanResults', {
              matched: preview.totalMatched,
              scanned: preview.totalScanned,
              count: preview.totalMatched,
            })}
          </p>

          {preview.matches.length > 0 && (
            <div className="overflow-hidden rounded-md border">
              <table className="w-full table-fixed text-xs">
                <colgroup>
                  <col className="w-16" />
                  <col />
                  <col className="w-16" />
                </colgroup>
                <tbody className="divide-y">
                  {preview.matches.map((match) => (
                    <PreviewRow key={match._id} match={match} />
                  ))}
                </tbody>
              </table>
              {preview.totalMatched > preview.matches.length && (
                <div className="border-t px-3 py-1.5 text-xs text-muted-foreground">
                  {t('dialogs.rule.scanMore', {
                    count: preview.totalMatched - preview.matches.length,
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function PreviewRow({ match }: { match: PreviewMatch }) {
  const dateStr = new Date(match.date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
  const amount = new Intl.NumberFormat('fr-FR', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(match.value)

  return (
    <tr>
      <td className="whitespace-nowrap px-3 py-1.5 text-muted-foreground">
        {dateStr}
      </td>
      <td className="truncate px-3 py-1.5" title={match.wording}>
        {match.wording}
      </td>
      <td
        className={cn(
          'px-3 py-1.5 text-right tabular-nums',
          match.value < 0 ? 'text-foreground' : 'text-emerald-600',
        )}
      >
        {match.value >= 0 ? '+' : ''}
        {amount}
      </td>
    </tr>
  )
}

function LabelMultiSelect({
  labels,
  selectedLabelIds,
  selectedLabels,
  onToggle,
}: {
  labels: Array<Doc<'transactionLabels'>>
  selectedLabelIds: string[]
  selectedLabels: Array<Doc<'transactionLabels'>>
  onToggle: (labelId: string) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = React.useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-auto min-h-9 w-full justify-between font-normal"
        >
          {selectedLabels.length > 0 ? (
            <span className="flex min-w-0 flex-wrap gap-1">
              {selectedLabels.map((label) => (
                <Badge
                  key={label._id}
                  variant="secondary"
                  className="gap-1 px-2 py-0.5 text-xs"
                  style={{
                    backgroundColor: `${label.color}20`,
                    color: label.color,
                    borderColor: `${label.color}40`,
                  }}
                >
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: label.color }}
                  />
                  {label.name}
                </Badge>
              ))}
            </span>
          ) : (
            <span className="text-muted-foreground">
              {t('dialogs.rule.noLabels')}
            </span>
          )}
          <ChevronsUpDown className="ml-auto size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder={t('dialogs.rule.searchLabels')} />
          <CommandList>
            <CommandEmpty>{t('dialogs.rule.noLabelsFound')}</CommandEmpty>
            <CommandGroup>
              {labels.map((label) => (
                <CommandItem
                  key={label._id}
                  value={label.name}
                  onSelect={() => onToggle(label._id)}
                >
                  <Checkbox
                    checked={selectedLabelIds.includes(label._id)}
                    tabIndex={-1}
                    className="pointer-events-none"
                  />
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: label.color }}
                  />
                  <span>{label.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function getAccountDisplayName(account: DecryptedBankAccount): string {
  if (account.customName) return account.customName
  if (account.connectorName) {
    return `${account.connectorName} – ${account.name ?? ''}`
  }
  return account.name ?? 'Unknown account'
}

function AccountMultiSelect({
  accounts,
  selectedAccountIds,
  onToggle,
}: {
  accounts: DecryptedBankAccount[]
  selectedAccountIds: string[]
  onToggle: (accountId: string) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = React.useState(false)

  const selectedAccounts = accounts.filter((a) =>
    selectedAccountIds.includes(a._id),
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-auto min-h-9 w-full justify-between font-normal"
        >
          {selectedAccounts.length > 0 ? (
            <span className="flex min-w-0 flex-wrap gap-1">
              {selectedAccounts.map((account) => (
                <Badge
                  key={account._id}
                  variant="secondary"
                  className="px-2 py-0.5 text-xs"
                >
                  {getAccountDisplayName(account)}
                </Badge>
              ))}
            </span>
          ) : (
            <span className="text-muted-foreground">
              {t('dialogs.rule.allAccounts')}
            </span>
          )}
          <ChevronsUpDown className="ml-auto size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder={t('dialogs.rule.searchAccounts')} />
          <CommandList>
            <CommandEmpty>{t('dialogs.rule.noAccountsFound')}</CommandEmpty>
            <CommandGroup>
              {accounts.map((account) => (
                <CommandItem
                  key={account._id}
                  value={getAccountDisplayName(account)}
                  onSelect={() => onToggle(account._id)}
                >
                  <Checkbox
                    checked={selectedAccountIds.includes(account._id)}
                    tabIndex={-1}
                    className="pointer-events-none"
                  />
                  <span>{getAccountDisplayName(account)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
