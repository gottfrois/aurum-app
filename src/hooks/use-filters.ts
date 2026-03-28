import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Filter } from '~/components/reui/filters'
import { applyFilters } from '~/lib/filters/engine'
import type { FieldDescriptor } from '~/lib/filters/types'

export interface UseFiltersOptions {
  initialFilters?: Array<Filter>
  onFiltersChange?: (filters: Array<Filter>) => void
}

export interface UseFiltersReturn<TRecord> {
  filters: Array<Filter>
  setFilters: (
    filters: Array<Filter> | ((prev: Array<Filter>) => Array<Filter>),
  ) => void
  filteredData: Array<TRecord> | undefined
  hasActiveFilters: boolean
}

export function useFilters<TRecord>(
  data: Array<TRecord> | undefined,
  fields: Array<FieldDescriptor>,
  options?: UseFiltersOptions,
): UseFiltersReturn<TRecord> {
  const [filters, setFiltersState] = useState<Array<Filter>>(
    () => options?.initialFilters ?? [],
  )

  const onChangeRef = useRef(options?.onFiltersChange)
  onChangeRef.current = options?.onFiltersChange

  useEffect(() => {
    onChangeRef.current?.(filters)
  }, [filters])

  const setFilters = useCallback(
    (next: Array<Filter> | ((prev: Array<Filter>) => Array<Filter>)) => {
      setFiltersState(next)
    },
    [],
  )

  const filteredData = useMemo(() => {
    if (!data) return undefined
    return applyFilters(data, filters, fields)
  }, [data, filters, fields])

  const hasActiveFilters = filters.length > 0

  return {
    filters,
    setFilters,
    filteredData,
    hasActiveFilters,
  }
}
