import { useTranslation } from 'react-i18next'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import { usePrivacy } from '~/contexts/privacy-context'
import { cn } from '~/lib/utils'

export interface Investment {
  _id: string
  label: string
  code?: string
  quantity: number
  unitprice: number
  unitvalue: number
  valuation: number
  portfolioShare?: number
  diff?: number
  diffPercent?: number
}

const currencyFmt = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
})

const pctFmt = new Intl.NumberFormat('fr-FR', {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const MASKED = '••••••'

export function HoldingsTable({
  investments,
}: {
  investments: Array<Investment>
}) {
  const { t } = useTranslation()
  const { isPrivate } = usePrivacy()
  const sorted = [...investments].sort((a, b) => b.valuation - a.valuation)

  if (sorted.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t('holdings.noHoldings')}
      </p>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('holdings.name')}</TableHead>
          <TableHead>{t('holdings.isin')}</TableHead>
          <TableHead className="text-right">{t('holdings.qty')}</TableHead>
          <TableHead className="text-right">
            {t('holdings.unitPrice')}
          </TableHead>
          <TableHead className="text-right">{t('holdings.value')}</TableHead>
          <TableHead className="text-right">{t('holdings.pnl')}</TableHead>
          <TableHead className="text-right">{t('holdings.weight')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((inv) => (
          <TableRow key={inv._id}>
            <TableCell className="font-medium">{inv.label}</TableCell>
            <TableCell className="text-muted-foreground">
              {inv.code ?? '—'}
            </TableCell>
            <TableCell className="text-right">{inv.quantity}</TableCell>
            <TableCell className="text-right">
              {isPrivate ? MASKED : currencyFmt.format(inv.unitprice)}
            </TableCell>
            <TableCell className="text-right">
              {isPrivate ? MASKED : currencyFmt.format(inv.valuation)}
            </TableCell>
            <TableCell className="text-right">
              {isPrivate ? (
                MASKED
              ) : inv.diff != null ? (
                <span
                  className={cn(
                    inv.diff >= 0 ? 'text-success' : 'text-destructive',
                  )}
                >
                  {inv.diff >= 0 ? '+' : ''}
                  {currencyFmt.format(inv.diff)}
                  {inv.diffPercent != null && (
                    <span className="ml-1 text-xs">
                      ({inv.diffPercent >= 0 ? '+' : ''}
                      {pctFmt.format(inv.diffPercent / 100)})
                    </span>
                  )}
                </span>
              ) : (
                '—'
              )}
            </TableCell>
            <TableCell className="text-right">
              {inv.portfolioShare != null
                ? pctFmt.format(inv.portfolioShare / 100)
                : '—'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
