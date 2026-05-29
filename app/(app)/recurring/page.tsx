import { getRecurring } from '@/app/actions/recurring'
import { getCategories } from '@/app/actions/categories'
import { RecurringListClient } from '@/components/app/RecurringListClient'
import type { Database } from '@/types/database'

type Recurring = Database['public']['Tables']['recurring_transactions']['Row'] & {
  categories: Pick<Database['public']['Tables']['categories']['Row'], 'id' | 'name' | 'icon_name' | 'color'> | null
}

export default async function RecurringPage() {
  const [recurrings, categories] = await Promise.all([getRecurring(), getCategories()])
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Transactions récurrentes</h1>
      <RecurringListClient recurrings={recurrings as Recurring[]} categories={categories} />
    </div>
  )
}
