import type { Database } from '@/types/database'

type Category = Database['public']['Tables']['categories']['Row']

interface Props {
  transaction?: Database['public']['Tables']['transactions']['Row'] | null
  categories: Category[]
  onSuccess: () => void
}

export function TransactionForm({ onSuccess: _onSuccess }: Props) {
  return (
    <div className="text-sm text-muted-foreground p-4">
      Formulaire disponible prochainement
    </div>
  )
}
