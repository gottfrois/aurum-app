import { useTranslation } from 'react-i18next'
import { Money } from '~/components/ui/money'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import { useMoney } from '~/hooks/use-money'
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

export function HoldingsTable({
  investments,
  currency,
}: {
  investments: Array<Investment>
  currency: string
}) {
  const { t } = useTranslation()
  const { locale } = useMoney()
  const sorted = [...investments].sort((a, b) => b.valuation - a.valuation)

  // Percent formatter follows the same locale as the money formatter
  const pctFmt = new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

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
              <Money value={inv.unitprice} currency={currency} />
            </TableCell>
            <TableCell className="text-right">
              <Money value={inv.valuation} currency={currency} />
            </TableCell>
            <TableCell className="text-right">
              {inv.diff != null ? (
                <span
                  className={cn(
                    inv.diff >= 0 ? 'text-success' : 'text-destructive',
                  )}
                >
                  {inv.diff >= 0 ? '+' : ''}
                  <Money value={inv.diff} currency={currency} />
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
                ? pctFmt.format(inv.portfolioShare)
                : '—'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
