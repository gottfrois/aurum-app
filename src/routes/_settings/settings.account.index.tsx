import { createFileRoute } from '@tanstack/react-router'
import { useTheme } from 'next-themes'
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

export const Route = createFileRoute('/_settings/settings/account/')({
  component: PreferencesPage,
})

const themeOptions = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

function PreferencesPage() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="max-w-3xl flex-1 w-full mx-auto px-10 py-16 flex flex-col">
      <PageHeader
        title="Preferences"
        description="Customize how Bunkr looks and feels."
      />
      <div className="space-y-6 mt-8">
        <ItemCard>
          <ItemCardItems>
            <ItemCardItem>
              <ItemCardItemContent>
                <ItemCardItemTitle>Interface theme</ItemCardItemTitle>
                <ItemCardItemDescription>
                  Choose between light, dark, or system theme
                </ItemCardItemDescription>
              </ItemCardItemContent>
              <ItemCardItemAction>
                <Select value={theme} onValueChange={setTheme}>
                  <SelectTrigger
                    aria-label="Interface theme"
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
          </ItemCardItems>
        </ItemCard>
      </div>
    </div>
  )
}
