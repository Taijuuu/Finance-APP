import { z } from 'zod'

export const transactionSchema = z.object({
  amount: z.coerce.number().positive('Le montant doit être positif'),
  type: z.enum(['expense', 'income']),
  category_id: z.string().uuid().nullable().optional(),
  description: z.string().max(255).optional().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date invalide (YYYY-MM-DD)'),
})

export type TransactionInput = z.infer<typeof transactionSchema>
