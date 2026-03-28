import type { FilterFieldConfig } from '../../components/reui/filters'

export type ValueType = 'string' | 'number' | 'date' | 'enum' | 'boolean'

export type FieldDescriptor = FilterFieldConfig & {
  accessor: (record: Record<string, unknown>) => unknown
  valueType: ValueType
}

/**
 * Strips engine/AI-only props from field descriptors to produce
 * clean FilterFieldConfig[] for the <Filters> component.
 */
export function toReUIFields(
  fields: Array<FieldDescriptor>,
): Array<FilterFieldConfig> {
  return fields.map(({ accessor: _a, valueType: _v, ...config }) => config)
}

/**
 * Converts field descriptors to the serializable format needed by the AI prompt.
 */
export function toSerializableFields(fields: Array<FieldDescriptor>): Array<{
  name: string
  label: string
  valueType: ValueType
  operators: Array<string>
  enumOptions?: Array<{ value: string; label: string }>
}> {
  return fields.map((field) => {
    const enumOptions =
      field.type === 'multiselect' && field.options
        ? field.options.map((o: { value: unknown; label: string }) => ({
            value: String(o.value),
            label: o.label,
          }))
        : undefined

    const operators = (field.operators ?? []).map(
      (op: string | { value: string }) =>
        typeof op === 'string' ? op : op.value,
    )

    return {
      name: field.key ?? '',
      label: field.label ?? '',
      valueType: field.valueType,
      operators,
      ...(enumOptions && { enumOptions }),
    }
  })
}
