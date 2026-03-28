import type { Filter } from '~/components/reui/filters'

export function serializeFilters(filters: Array<Filter>): string {
  return JSON.stringify(filters)
}

export function deserializeFilters(json: string): Array<Filter> {
  try {
    const parsed: unknown = JSON.parse(json)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is Filter =>
        typeof item === 'object' &&
        item !== null &&
        'id' in item &&
        'field' in item &&
        'operator' in item &&
        'values' in item &&
        Array.isArray(item.values),
    )
  } catch {
    return []
  }
}
