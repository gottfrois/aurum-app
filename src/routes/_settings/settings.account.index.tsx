import { createFileRoute } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { useTheme } from 'next-themes'
import { useTranslation } from 'react-i18next'
import {
  ItemCard,
  ItemCardItem,
  ItemCardItemAction,
  ItemCardItemContent,
  ItemCardItemDescription,
  ItemCardItems,
  ItemCardItemTitle,
} from '~/components/item-card'
import { PageHeader } from '~/components/ui/page-header'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { SelectWithHint } from '~/components/ui/select-with-hint'
import { useListPreferences } from '~/contexts/list-preferences-context'
import { useMoneyPreferences } from '~/contexts/money-preferences-context'
import {
  TRANSACTIONS_PAGE_SIZE_OPTIONS,
  type TransactionsPageSize,
} from '~/lib/list-prefs/storage'
import type { CurrencyDisplay, CurrencySign } from '~/lib/money/format'
import { formatMoney } from '~/lib/money/format'
import {
  inferLocaleFromI18n,
  SUPPORTED_NUMBER_LOCALES,
} from '~/lib/money/locales'
import { api } from '../../../convex/_generated/api'

const PREVIEW_AMOUNT = 1234.56
const NEGATIVE_PREVIEW_AMOUNT = -1234.56

export const Route = createFileRoute('/_settings/settings/account/')({
  component: PreferencesPage,
})

function PreferencesPage() {
  const { t, i18n } = useTranslation()
  const { theme, setTheme } = useTheme()
  const setLanguagePreference = useMutation(
    api.preferences.setLanguagePreference,
  )

  const {
    numberLocale,
    numberLocaleMode,
    currencyDisplay,
    currencySign,
    setNumberLocale,
    setCurrencyDisplay,
    setCurrencySign,
  } = useMoneyPreferences()

  const { transactionsPageSize, setTransactionsPageSize } = useListPreferences()

  const themeOptions = [
    { value: 'system', label: t('settings.preferences.theme.system') },
    { value: 'light', label: t('settings.preferences.theme.light') },
    { value: 'dark', label: t('settings.preferences.theme.dark') },
  ]

  const languageOptions = [
    { value: 'en', label: t('settings.preferences.language.en') },
    { value: 'fr', label: t('settings.preferences.language.fr') },
  ]

  const previewForLocale = (locale: string) =>
    formatMoney(PREVIEW_AMOUNT, {
      locale,
      currency: 'EUR',
      currencyDisplay,
      currencySign,
    })

  const numberLocaleOptions = [
    {
      value: 'auto',
      label: t('settings.preferences.numberLocale.auto'),
      hint: previewForLocale(inferLocaleFromI18n(i18n.language)),
    },
    ...SUPPORTED_NUMBER_LOCALES.map((loc) => ({
      value: loc,
      label: loc,
      hint: previewForLocale(loc),
    })),
  ]

  // Use CAD so the difference between `symbol` (e.g. "CA$") and
  // `narrowSymbol` (e.g. "$") is visible in any locale.
  const previewForDisplay = (display: CurrencyDisplay) =>
    formatMoney(PREVIEW_AMOUNT, {
      locale: numberLocale,
      currency: 'CAD',
      currencyDisplay: display,
      currencySign,
    })

  const currencyDisplayOptions = [
    {
      value: 'symbol' as const,
      label: t('settings.preferences.currencyDisplay.symbol'),
      hint: previewForDisplay('symbol'),
    },
    {
      value: 'narrowSymbol' as const,
      label: t('settings.preferences.currencyDisplay.narrowSymbol'),
      hint: previewForDisplay('narrowSymbol'),
    },
    {
      value: 'code' as const,
      label: t('settings.preferences.currencyDisplay.code'),
      hint: previewForDisplay('code'),
    },
  ]

  const previewForSign = (sign: CurrencySign) =>
    formatMoney(NEGATIVE_PREVIEW_AMOUNT, {
      locale: numberLocale,
      currency: 'EUR',
      currencyDisplay,
      currencySign: sign,
    })

  const currencySignOptions = [
    {
      value: 'standard' as const,
      label: t('settings.preferences.currencySign.standard'),
      hint: previewForSign('standard'),
    },
    {
      value: 'accounting' as const,
      label: t('settings.preferences.currencySign.accounting'),
      hint: previewForSign('accounting'),
    },
  ]

  const handleLanguageChange = async (value: string) => {
    await i18n.changeLanguage(value)
    await setLanguagePreference({ language: value })
  }

  return (
    <div className="max-w-3xl flex-1 w-full mx-auto px-10 py-16 flex flex-col">
      <PageHeader
        title={t('settings.preferences.title')}
        description={t('settings.preferences.description')}
      />
      <div className="space-y-8 mt-8">
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-medium">
              {t('settings.preferences.interface.title')}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t('settings.preferences.interface.description')}
            </p>
          </div>
          <ItemCard>
            <ItemCardItems>
              <ItemCardItem>
                <ItemCardItemContent>
                  <ItemCardItemTitle>
                    {t('settings.preferences.theme.title')}
                  </ItemCardItemTitle>
                  <ItemCardItemDescription>
                    {t('settings.preferences.theme.description')}
                  </ItemCardItemDescription>
                </ItemCardItemContent>
                <ItemCardItemAction>
                  <Select value={theme} onValueChange={setTheme}>
                    <SelectTrigger
                      aria-label={t('settings.preferences.theme.title')}
                      className="w-fit focus:shadow-none focus:ring-0 focus:ring-offset-0"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {themeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </ItemCardItemAction>
              </ItemCardItem>
              <ItemCardItem>
                <ItemCardItemContent>
                  <ItemCardItemTitle>
                    {t('settings.preferences.language.title')}
                  </ItemCardItemTitle>
                  <ItemCardItemDescription>
                    {t('settings.preferences.language.description')}
                  </ItemCardItemDescription>
                </ItemCardItemContent>
                <ItemCardItemAction>
                  <Select
                    value={i18n.language}
                    onValueChange={handleLanguageChange}
                  >
                    <SelectTrigger
                      aria-label={t('settings.preferences.language.title')}
                      className="w-fit focus:shadow-none focus:ring-0 focus:ring-offset-0"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {languageOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </ItemCardItemAction>
              </ItemCardItem>
            </ItemCardItems>
          </ItemCard>
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-medium">
              {t('settings.preferences.money.title')}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t('settings.preferences.money.description')}
            </p>
          </div>
          <ItemCard>
            <ItemCardItems>
              <ItemCardItem>
                <ItemCardItemContent>
                  <ItemCardItemTitle>
                    {t('settings.preferences.numberLocale.title')}
                  </ItemCardItemTitle>
                  <ItemCardItemDescription>
                    {t('settings.preferences.numberLocale.description')}
                  </ItemCardItemDescription>
                </ItemCardItemContent>
                <ItemCardItemAction>
                  <SelectWithHint
                    value={numberLocaleMode}
                    onValueChange={setNumberLocale}
                    options={numberLocaleOptions}
                    ariaLabel={t('settings.preferences.numberLocale.title')}
                  />
                </ItemCardItemAction>
              </ItemCardItem>
              <ItemCardItem>
                <ItemCardItemContent>
                  <ItemCardItemTitle>
                    {t('settings.preferences.currencyDisplay.title')}
                  </ItemCardItemTitle>
                  <ItemCardItemDescription>
                    {t('settings.preferences.currencyDisplay.description')}
                  </ItemCardItemDescription>
                </ItemCardItemContent>
                <ItemCardItemAction>
                  <SelectWithHint
                    value={currencyDisplay}
                    onValueChange={(v) =>
                      setCurrencyDisplay(v as CurrencyDisplay)
                    }
                    options={currencyDisplayOptions}
                    ariaLabel={t('settings.preferences.currencyDisplay.title')}
                  />
                </ItemCardItemAction>
              </ItemCardItem>
              <ItemCardItem>
                <ItemCardItemContent>
                  <ItemCardItemTitle>
                    {t('settings.preferences.currencySign.title')}
                  </ItemCardItemTitle>
                  <ItemCardItemDescription>
                    {t('settings.preferences.currencySign.description')}
                  </ItemCardItemDescription>
                </ItemCardItemContent>
                <ItemCardItemAction>
                  <SelectWithHint
                    value={currencySign}
                    onValueChange={(v) => setCurrencySign(v as CurrencySign)}
                    options={currencySignOptions}
                    ariaLabel={t('settings.preferences.currencySign.title')}
                  />
                </ItemCardItemAction>
              </ItemCardItem>
            </ItemCardItems>
          </ItemCard>
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-medium">
              {t('settings.preferences.lists.title')}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t('settings.preferences.lists.description')}
            </p>
          </div>
          <ItemCard>
            <ItemCardItems>
              <ItemCardItem>
                <ItemCardItemContent>
                  <ItemCardItemTitle>
                    {t('settings.preferences.transactionsPageSize.title')}
                  </ItemCardItemTitle>
                  <ItemCardItemDescription>
                    {t('settings.preferences.transactionsPageSize.description')}
                  </ItemCardItemDescription>
                </ItemCardItemContent>
                <ItemCardItemAction>
                  <Select
                    value={String(transactionsPageSize)}
                    onValueChange={(value) =>
                      setTransactionsPageSize(
                        Number(value) as TransactionsPageSize,
                      )
                    }
                  >
                    <SelectTrigger
                      aria-label={t(
                        'settings.preferences.transactionsPageSize.title',
                      )}
                      className="w-fit focus:shadow-none focus:ring-0 focus:ring-offset-0"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TRANSACTIONS_PAGE_SIZE_OPTIONS.map((size) => (
                        <SelectItem key={size} value={String(size)}>
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </ItemCardItemAction>
              </ItemCardItem>
            </ItemCardItems>
          </ItemCard>
        </section>
      </div>
    </div>
  )
}
