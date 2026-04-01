import { useQuery } from 'convex/react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../../convex/_generated/api'

/**
 * Syncs the user's language preference from Convex to i18next.
 * Should be placed inside a component wrapped by ConvexProvider.
 */
export function useLanguageSync(isAuthenticated: boolean) {
  const { i18n } = useTranslation()
  const language = useQuery(
    api.preferences.getLanguagePreference,
    isAuthenticated ? {} : 'skip',
  )

  useEffect(() => {
    if (language && language !== i18n.language) {
      i18n.changeLanguage(language)
    }
  }, [language, i18n])
}
