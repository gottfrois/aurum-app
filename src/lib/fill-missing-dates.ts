function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Forward-fills missing dates in a sorted array of { date, balance } points.
 * If a date is missing, the previous day's balance carries forward.
 */
export function fillMissingDates<T extends { date: string; balance: number }>(
  data: Array<T>,
): Array<T> {
  if (data.length < 2) return data

  const filled: Array<T> = [data[0]]
  for (let i = 1; i < data.length; i++) {
    const prev = filled[filled.length - 1]
    let nextDate = addDays(prev.date, 1)
    while (nextDate < data[i].date) {
      filled.push({ ...prev, date: nextDate })
      nextDate = addDays(nextDate, 1)
    }
    filled.push(data[i])
  }
  return filled
}

/**
 * Forward-fills missing dates in stacked chart data (multiple category keys).
 * Each row has a `date` string key plus numeric category keys.
 */
export function fillMissingDatesStacked(
  data: Array<Record<string, string | number>>,
): Array<Record<string, string | number>> {
  if (data.length < 2) return data

  const filled: Array<Record<string, string | number>> = [data[0]]
  for (let i = 1; i < data.length; i++) {
    const prev = filled[filled.length - 1]
    let nextDate = addDays(prev.date as string, 1)
    while (nextDate < (data[i].date as string)) {
      filled.push({ ...prev, date: nextDate })
      nextDate = addDays(nextDate, 1)
    }
    filled.push(data[i])
  }
  return filled
}
