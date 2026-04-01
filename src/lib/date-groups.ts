import {
  differenceInDays,
  differenceInHours,
  differenceInMinutes,
  differenceInWeeks,
  isToday,
  isYesterday,
} from 'date-fns'
import i18n from './i18n'

export type DateGroupKey =
  | 'today'
  | 'yesterday'
  | 'lastWeek'
  | 'lastMonth'
  | 'older'

/** @deprecated Use DateGroupKey instead */
export type DateGroup =
  | 'Today'
  | 'Yesterday'
  | 'Last week'
  | 'Last month'
  | 'Older'

const GROUP_ORDER: DateGroupKey[] = [
  'today',
  'yesterday',
  'lastWeek',
  'lastMonth',
  'older',
]

const DATE_GROUP_TRANSLATION_KEYS: Record<DateGroupKey, string> = {
  today: 'dates.today',
  yesterday: 'dates.yesterday',
  lastWeek: 'dates.lastWeek',
  lastMonth: 'dates.lastMonth',
  older: 'dates.older',
}

export function translateDateGroup(key: DateGroupKey): string {
  return i18n.t(DATE_GROUP_TRANSLATION_KEYS[key])
}

function getDateGroupKey(date: Date): DateGroupKey {
  if (isToday(date)) return 'today'
  if (isYesterday(date)) return 'yesterday'
  const days = differenceInDays(new Date(), date)
  if (days <= 7) return 'lastWeek'
  if (days <= 30) return 'lastMonth'
  return 'older'
}

export function groupByDate<T>(
  items: T[],
  getDate: (item: T) => Date,
): Array<{ group: string; items: T[] }> {
  const groups = new Map<DateGroupKey, T[]>()

  for (const item of items) {
    const group = getDateGroupKey(getDate(item))
    if (!groups.has(group)) {
      groups.set(group, [])
    }
    groups.get(group)?.push(item)
  }

  return GROUP_ORDER.filter((g) => groups.has(g)).map((g) => ({
    group: translateDateGroup(g),
    items: groups.get(g) ?? [],
  }))
}

export function formatRelativeShort(date: Date): string {
  const now = new Date()
  const mins = differenceInMinutes(now, date)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hours = differenceInHours(now, date)
  if (hours < 24) return `${hours}h`
  const days = differenceInDays(now, date)
  if (days < 7) return `${days}d`
  const weeks = differenceInWeeks(now, date)
  if (weeks < 5) return `${weeks}w`
  const months = Math.floor(days / 30)
  return `${months}mo`
}
