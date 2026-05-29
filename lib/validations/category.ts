import { z } from 'zod'

export const categorySchema = z.object({
  name: z.string().min(1, 'Nom requis').max(50),
  icon_name: z.string().min(1, 'Icône requise'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Couleur invalide'),
  type: z.enum(['expense', 'income', 'both']),
})

export type CategoryInput = z.infer<typeof categorySchema>
