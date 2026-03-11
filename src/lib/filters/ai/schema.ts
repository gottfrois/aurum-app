import { z } from 'zod'

export const aiFilterSchema = z.object({
  filters: z.array(
    z.object({
      field: z.string().describe('Field name from the available fields'),
      operator: z.string().describe('Operator valid for the field type'),
      value: z.unknown().describe('Value matching the operator shape'),
    }),
  ),
})

export type AIFilterResponse = z.infer<typeof aiFilterSchema>
