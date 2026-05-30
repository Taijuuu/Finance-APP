import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { RevenueExpenseChart } from '@/components/charts/RevenueExpenseChart'
import { CategoryDonutChart } from '@/components/charts/CategoryDonutChart'
import { BalanceLineChart } from '@/components/charts/BalanceLineChart'
import { CategoryBadge } from '@/components/app/CategoryBadge'
import { ChartSkeleton } from '@/components/app/Skeletons'
import { MonthNavigator } from '@/components/app/MonthNavigator'
import { formatCurrency, formatDate, savingsRate, getMonthRange } from '@/lib/utils'

interface Props {
  searchParams: Promise<{ month?: string }>
}

function parseMonth(monthParam?: string): { year: number; month: number } {
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split('-').map(Number)
    return { year: y, month: m }
  }
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

async function getDashboardData(year: number, month: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { start, end } = getMonthRange(year, month)

  const { data: currentMonth } = await supabase
    .from('transactions')
    .select('amount, type, category_id')
    .eq('user_id', user.id)
    .gte('date', start)
    .lte('date', end)

  const income = (currentMonth ?? []).filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const expenses = (currentMonth ?? []).filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)

  const barData = await Promise.all(
    Array.from({ length: 6 }, (_, i) => new Date(year, month - 1 - (5 - i), 1))
      .map(async d => {
        const y = d.getFullYear()
        const m = d.getMonth() + 1
        const { start: s, end: e } = getMonthRange(y, m)
        const { data } = await supabase.from('transactions').select('amount, type').eq('user_id', user.id).gte('date', s).lte('date', e)
        const rev = (data ?? []).filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
        const exp = (data ?? []).filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
        return { month: `${String(m).padStart(2, '0')}/${y}`, revenus: rev, dépenses: exp }
      })
  )

  type CatRow = { amount: number; categories: { name: string; color: string | null } | null }
  const { data: catDataRaw } = await supabase
    .from('transactions')
    .select('amount, categories(name, color)')
    .eq('user_id', user.id)
    .eq('type', 'expense')
    .gte('date', start)
    .lte('date', end)
  const catData = catDataRaw as CatRow[] | null

  const catMap = new Map<string, { value: number; color: string | null }>()
  ;(catData ?? []).forEach((t) => {
    const name = t.categories?.name ?? 'Autre'
    const color = t.categories?.color ?? null
    catMap.set(name, { value: (catMap.get(name)?.value ?? 0) + Number(t.amount), color })
  })
  const donutData = Array.from(catMap, ([name, v]) => ({ name, ...v })).sort((a, b) => b.value - a.value).slice(0, 8)

  const lineData = await Promise.all(
    Array.from({ length: 12 }, (_, i) => new Date(year, month - 1 - (11 - i), 1))
      .map(async d => {
        const y = d.getFullYear()
        const m = d.getMonth() + 1
        const { start: s, end: e } = getMonthRange(y, m)
        const { data } = await supabase.from('transactions').select('amount, type').eq('user_id', user.id).gte('date', s).lte('date', e)
        const rev = (data ?? []).filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
        const exp = (data ?? []).filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
        return { month: `${String(m).padStart(2, '0')}/${String(y).slice(2)}`, solde: rev - exp }
      })
  )

  type RecentRow = { id: string; amount: number; type: string; description: string | null; date: string; category_id: string | null; categories: { id: string; name: string; icon_name: string | null; color: string | null } | null }
  const { data: recentRaw } = await supabase
    .from('transactions')
    .select('*, categories(id, name, icon_name, color)')
    .eq('user_id', user.id)
    .eq('is_recurring_instance', false)
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: false })
    .limit(5)
  const recent = recentRaw as RecentRow[] | null

  type BudgetRow = { category_id: string; amount: number; categories: { name: string } | null }
  const { data: budgetsRaw } = await supabase
    .from('budgets')
    .select('category_id, amount, categories(name)')
    .eq('user_id', user.id)
    .eq('month', month)
    .eq('year', year)
  const budgets = budgetsRaw as BudgetRow[] | null

  const alerts: string[] = []
  for (const b of (budgets ?? [])) {
    const spent = (currentMonth ?? [])
      .filter(t => t.type === 'expense' && t.category_id === b.category_id)
      .reduce((s, t) => s + Number(t.amount), 0)
    if (spent > Number(b.amount)) {
      alerts.push(b.categories?.name ?? 'Catégorie')
    }
  }

  return { income, expenses, barData, donutData, lineData, recent: (recent ?? []) as RecentRow[], alerts, savings: savingsRate(income, expenses) }
}

export default async function DashboardPage({ searchParams }: Props) {
  const params = await searchParams
  const { year, month } = parseMonth(params.month)

  const data = await getDashboardData(year, month)
  if (!data) return <p>Erreur de chargement</p>
  const { income, expenses, barData, donutData, lineData, recent, alerts, savings } = data
  const balance = income - expenses

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <MonthNavigator year={year} month={month} />
      </div>

      {alerts.length > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Budget dépassé : {alerts.join(', ')}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Revenus</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(income)}</p>
        </div>
        <div className="rounded-xl border p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Dépenses</p>
          <p className="text-2xl font-bold text-rose-500 dark:text-rose-400">{formatCurrency(expenses)}</p>
        </div>
        <div className="rounded-xl border p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Solde</p>
          <p className={`text-2xl font-bold ${balance >= 0 ? 'text-foreground' : 'text-rose-500'}`}>{formatCurrency(balance)}</p>
          {savings !== null && <p className="text-xs text-muted-foreground mt-1">Épargne : {savings}%</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Suspense fallback={<ChartSkeleton />}><RevenueExpenseChart data={barData} /></Suspense>
        <Suspense fallback={<ChartSkeleton />}><CategoryDonutChart data={donutData} /></Suspense>
      </div>
      <Suspense fallback={<ChartSkeleton />}><BalanceLineChart data={lineData} /></Suspense>

      <div className="rounded-xl border">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h3 className="text-sm font-semibold">Dernières transactions</h3>
          <a href="/transactions" className="text-xs text-primary hover:underline">Voir tout</a>
        </div>
        <div className="divide-y">
          {recent.map((t) => (
            <div key={t.id} className="flex items-center gap-3 px-4 py-3">
              {t.categories && <CategoryBadge name="" iconName={t.categories.icon_name} color={t.categories.color} size="sm" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{t.description || t.categories?.name || '—'}</p>
                <p className="text-xs text-muted-foreground">{formatDate(t.date)}</p>
              </div>
              <span className={`text-sm font-semibold ${t.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                {t.type === 'income' ? '+' : '-'}{formatCurrency(Number(t.amount))}
              </span>
            </div>
          ))}
          {recent.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">Aucune transaction ce mois</p>}
        </div>
      </div>
    </div>
  )
}
