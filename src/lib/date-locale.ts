import { enUS, fr } from 'date-fns/locale'
import i18n from './i18n'

export function getDateLocale() {
  return i18n.language === 'fr' ? fr : enUS
}
