import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { HorizontalBarChart } from '@/components/charts/HorizontalBarChart'
import { RecapNavigator } from '@/components/app/RecapNavigator'
import { formatCurrency, getMonthRange, savingsRate } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'

type TxRow = { amount: number; type: string; category_id: string | null; categories: { id: string; name: string; color: string | null } | null }

async function getRecapData(year: number, month: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { start, end } = getMonthRange(year, month)
  const prevDate = new Date(year, month - 2, 1)
  const { start: prevStart, end: prevEnd } = getMonthRange(prevDate.getFullYear(), prevDate.getMonth() + 1)

  const [{ data: currRaw }, { data: prevRaw }] = await Promise.all([
    supabase.from('transactions').select('amount, type, category_id, categories(id, name, color)').eq('user_id', user.id).eq('is_recurring_instance', false).gte('date', start).lte('date', end),
    supabase.from('transactions').select('amount, type, category_id, categories(id, name, color)').eq('user_id', user.id).eq('is_recurring_instance', false).gte('date', prevStart).lte('date', prevEnd),
  ])

  const curr = currRaw as TxRow[] | null ?? []
  const prev = prevRaw as TxRow[] | null ?? []

  const income = curr.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const expenses = curr.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const prevIncome = prev.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const prevExpenses = prev.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)

  const catMap = new Map<string, { name: string; value: number; color: string | null }>()
  curr.filter(t => t.type === 'expense').forEach(t => {
    const key = t.category_id ?? 'other'
    const name = t.categories?.name ?? 'Autre'
    const color = t.categories?.color ?? null
    const entry = catMap.get(key)
    if (entry) entry.value += Number(t.amount)
    else catMap.set(key, { name, value: Number(t.amount), color })
  })
  const byCategory = Array.from(catMap.values()).sort((a, b) => b.value - a.value)
  const topCategories = byCategory.slice(0, 5)

  return { income, expenses, prevIncome, prevExpenses, byCategory, topCategories, savings: savingsRate(income, expenses) }
}

function Delta({ current, prev, invert = false }: { current: number; prev: number; invert?: boolean }) {
  if (prev === 0) return null
  const pct = Math.round(((current - prev) / prev) * 100)
  const isGood = invert ? pct <= 0 : pct >= 0
  return (
    <span className={`text-xs ml-1 ${isGood ? 'text-emerald-600' : 'text-rose-500'}`}>
      {pct >= 0 ? '+' : ''}{pct}%
    </span>
  )
}

function parseMonth(monthParam?: string): { year: number; month: number } {
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split('-').map(Number)
    return { year: y, month: m }
  }
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

interface Props { searchParams: Promise<{ month?: string }> }

export default async function RecapPage({ searchParams }: Props) {
  const params = await searchParams
  const { year, month } = parseMonth(params.month)

  const data = await getRecapData(year, month)
  if (!data) return <p>Erreur de chargement</p>

  const { income, expenses, prevIncome, prevExpenses, byCategory, topCategories, savings } = data
  const balance = income - expenses
  const prevBalance = prevIncome - prevExpenses

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Récap mensuel</h1>
        <Suspense>
          <RecapNavigator year={year} month={month} />
        </Suspense>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Revenus</p>
          <p className="text-xl font-bold text-emerald-600">{formatCurrency(income)}</p>
          <Delta current={income} prev={prevIncome} />
        </div>
        <div className="rounded-xl border p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Dépenses</p>
          <p className="text-xl font-bold text-rose-500">{formatCurrency(expenses)}</p>
          <Delta current={expenses} prev={prevExpenses} invert />
        </div>
        <div className="rounded-xl border p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Solde</p>
          <p className={`text-xl font-bold ${balance >= 0 ? 'text-foreground' : 'text-rose-500'}`}>{formatCurrency(balance)}</p>
          <Delta current={balance} prev={prevBalance} />
        </div>
        <div className="rounded-xl border p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Épargne</p>
          <p className="text-xl font-bold">{savings !== null ? `${savings}%` : '—'}</p>
        </div>
      </div>

      {byCategory.length > 0 && (
        <div className="rounded-xl border">
          <div className="px-4 py-3 border-b">
            <h3 className="text-sm font-semibold">Dépenses par catégorie</h3>
          </div>
          <div className="divide-y">
            {byCategory.map(cat => (
              <div key={cat.name} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium">{cat.name}</p>
                    <p className="text-sm font-semibold">{formatCurrency(cat.value)}</p>
                  </div>
                  <Progress value={expenses > 0 ? (cat.value / expenses) * 100 : 0} className="h-1.5" />
                </div>
                <p className="text-xs text-muted-foreground w-10 text-right">
                  {expenses > 0 ? Math.round((cat.value / expenses) * 100) : 0}%
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {topCategories.length > 0 && (
        <HorizontalBarChart data={topCategories} />
      )}

      {byCategory.length === 0 && (
        <p className="text-center text-muted-foreground text-sm py-12">Aucune transaction ce mois-ci</p>
      )}
    </div>
  )
}
