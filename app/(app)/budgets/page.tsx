import { createClient } from '@/lib/supabase/server'
import { getBudgets } from '@/app/actions/budgets'
import { getCategories } from '@/app/actions/categories'
import { BudgetCard } from '@/components/app/BudgetCard'
import { BudgetCreateForm } from '@/components/app/BudgetCreateForm'
import { getMonthRange } from '@/lib/utils'
import type { Database } from '@/types/database'

type BudgetRow = Database['public']['Tables']['budgets']['Row'] & {
  categories: Pick<Database['public']['Tables']['categories']['Row'], 'id' | 'name' | 'icon_name' | 'color'> | null
}

export default async function BudgetsPage() {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [budgetsRaw, categories] = await Promise.all([getBudgets(month, year), getCategories()])
  const budgets = budgetsRaw as BudgetRow[]

  const { start, end } = getMonthRange(year, month)
  const { data: transactions } = await supabase
    .from('transactions')
    .select('amount, category_id, type')
    .eq('user_id', user.id)
    .eq('type', 'expense')
    .gte('date', start)
    .lte('date', end)

  const spentByCategory = new Map<string, number>()
  ;(transactions ?? []).forEach(t => {
    if (t.category_id) spentByCategory.set(t.category_id, (spentByCategory.get(t.category_id) ?? 0) + Number(t.amount))
  })

  const budgetedCategoryIds = new Set(budgets.map(b => b.category_id))
  const unbudgetedCategories = categories.filter(c => !budgetedCategoryIds.has(c.id) && c.type !== 'income')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Budgets</h1>
        <p className="text-sm text-muted-foreground">
          {new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(now)}
        </p>
      </div>

      {budgets.length === 0 && (
        <p className="text-sm text-muted-foreground">Aucun budget défini ce mois. Commencez par en créer un ci-dessous.</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {budgets.map(b => (
          <BudgetCard key={b.id} budget={b} spent={spentByCategory.get(b.category_id) ?? 0} month={month} year={year} />
        ))}
      </div>

      {unbudgetedCategories.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">Ajouter un budget</h2>
          <BudgetCreateForm categories={unbudgetedCategories} month={month} year={year} />
        </div>
      )}
    </div>
  )
}
