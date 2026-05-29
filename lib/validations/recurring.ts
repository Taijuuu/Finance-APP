import { z } from 'zod'

export const recurringSchema = z.object({
  name: z.string().min(1, 'Nom requis').max(100),
  amount: z.coerce.number().positive('Le montant doit être positif'),
  type: z.enum(['expense', 'income']),
  category_id: z.string().uuid().nullable().optional(),
  frequency: z.enum(['weekly', 'monthly', 'yearly']),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export type RecurringInput = z.infer<typeof recurringSchema>
