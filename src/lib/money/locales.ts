/**
 * Supported number-formatting locales. Distinct from the UI language list
 * (which is en/fr only) — users can pick e.g. 'en-GB' for British formatting
 * while keeping the UI in French.
 */

export const SUPPORTED_NUMBER_LOCALES = [
  'en-US',
  'en-GB',
  'fr-FR',
  'de-DE',
  'es-ES',
  'it-IT',
  'ja-JP',
] as const

export type SupportedNumberLocale = (typeof SUPPORTED_NUMBER_LOCALES)[number]

/**
 * Map a UI language code (e.g. 'en', 'fr') to a sensible default
 * number-formatting locale.
 */
export function inferLocaleFromI18n(language: string): string {
  const lang = language.toLowerCase().split('-')[0]
  switch (lang) {
    case 'fr':
      return 'fr-FR'
    case 'en':
      return 'en-US'
    case 'de':
      return 'de-DE'
    case 'es':
      return 'es-ES'
    case 'it':
      return 'it-IT'
    case 'ja':
      return 'ja-JP'
    default:
      return 'en-US'
  }
}
