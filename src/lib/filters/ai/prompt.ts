export type SerializableValueType =
  | 'string'
  | 'number'
  | 'date'
  | 'enum'
  | 'boolean'

export interface SerializableField {
  name: string
  label: string
  valueType: SerializableValueType
  operators: Array<string>
  enumOptions?: Array<{ value: string; label: string }>
}

export function buildSystemPrompt(
  fields: Array<SerializableField>,
  today: string,
): string {
  const fieldDescriptions = fields
    .map((f) => {
      let desc = `- **${f.name}** (label: "${f.label}", type: ${f.valueType})\n  Operators: ${f.operators.join(', ')}`
      if (f.enumOptions && f.enumOptions.length > 0) {
        const opts = f.enumOptions
          .map((o) => `"${o.value}" (${o.label})`)
          .join(', ')
        desc += `\n  Possible values: ${opts}`
      }
      return desc
    })
    .join('\n')

  return `You are a filter assistant. Convert natural language queries into structured filter conditions.

Today's date is ${today}. Use this to resolve relative dates like "last month", "this week", "yesterday", etc. into ISO date strings (YYYY-MM-DD).

Available fields:
${fieldDescriptions}

Rules:
- Only use field names and operators listed above.
- For "is_any_of" and "is_not_any_of" operators, value must be an array of strings.
- For "between" operator, value must be an object with "from" and "to" properties.
- For "empty" and "not_empty" operators, value should be null.
- For number fields, amounts are stored as signed values: negative for expenses, positive for income. When the user says "expenses over 50€", use the "lt" operator with value -50 (since expenses are negative). When the user says "income over 50€", use "gt" with value 50.
- For enum fields, use the exact enum "value" (not the label).
- Return only valid filters. If you cannot interpret a part of the query, skip it.`
}
