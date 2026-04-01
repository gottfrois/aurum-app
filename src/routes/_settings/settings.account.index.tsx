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
import { api } from '../../../convex/_generated/api'

export const Route = createFileRoute('/_settings/settings/account/')({
  component: PreferencesPage,
})

function PreferencesPage() {
  const { t, i18n } = useTranslation()
  const { theme, setTheme } = useTheme()
  const setLanguagePreference = useMutation(
    api.preferences.setLanguagePreference,
  )

  const themeOptions = [
    { value: 'system', label: t('settings.preferences.theme.system') },
    { value: 'light', label: t('settings.preferences.theme.light') },
    { value: 'dark', label: t('settings.preferences.theme.dark') },
  ]

  const languageOptions = [
    { value: 'en', label: t('settings.preferences.language.en') },
    { value: 'fr', label: t('settings.preferences.language.fr') },
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
      <div className="space-y-6 mt-8">
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
      </div>
    </div>
  )
}
