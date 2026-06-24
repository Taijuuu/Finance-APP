import { Suspense } from 'react'
import { CheckCircle2, Circle, Target } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Progress } from '@/components/ui/progress'
import { RevenueExpenseChart } from '@/components/charts/RevenueExpenseChart'
import { CategoryDonutChart } from '@/components/charts/CategoryDonutChart'
import { BalanceLineChart } from '@/components/charts/BalanceLineChart'
import { CategoryBadge } from '@/components/app/CategoryBadge'
import { ChartSkeleton } from '@/components/app/Skeletons'
import { MonthNavigator } from '@/components/app/MonthNavigator'
import { formatCurrency, formatDate, savingsRate, getMonthRange } from '@/lib/utils'
import { syncRecurring, syncUpTo } from '@/lib/recurring-sync'

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

  // Materialise missing recurring occurrences (and clean orphans) before fetching
  await syncRecurring(supabase, user.id, syncUpTo(year, month))

  // 12-month range for charts (one batch query instead of 18 individual queries)
  const rangeStart = new Date(year, month - 13, 1)
  const { start: bulkStart } = getMonthRange(rangeStart.getFullYear(), rangeStart.getMonth() + 1)

  // 5 parallel queries instead of 24
  type TxRow = { amount: number; type: string; category_id: string | null; date: string; is_pointed: boolean }
  type CatRow = { amount: number; categories: { name: string; color: string | null } | null }
  type RecentRow = { id: string; amount: number; type: string; description: string | null; date: string; category_id: string | null; categories: { id: string; name: string; icon_name: string | null; color: string | null } | null }
  type BudgetRow = { category_id: string; amount: number; categories: { name: string } | null }

  const [{ data: bulkRaw }, { data: catDataRaw }, { data: recentRaw }, { data: budgetsRaw }, { data: profileRaw }] = await Promise.all([
    supabase.from('transactions').select('amount, type, category_id, date, is_pointed').eq('user_id', user.id).gte('date', bulkStart).lte('date', end),
    supabase.from('transactions').select('amount, categories(name, color)').eq('user_id', user.id).eq('type', 'expense').gte('date', start).lte('date', end),
    supabase.from('transactions').select('*, categories(id, name, icon_name, color)').eq('user_id', user.id).gte('date', start).lte('date', end).order('date', { ascending: false }).limit(5),
    supabase.from('budgets').select('category_id, amount, categories(name)').eq('user_id', user.id).eq('month', month).eq('year', year),
    supabase.from('profiles').select('reconcile_expenses, monthly_savings_goal').eq('id', user.id).single(),
  ])

  const bulk = (bulkRaw as TxRow[] | null) ?? []
  const catData = (catDataRaw as CatRow[] | null) ?? []
  const recent = (recentRaw as RecentRow[] | null) ?? []
  const budgets = (budgetsRaw as BudgetRow[] | null) ?? []
  const profile = profileRaw as { reconcile_expenses: boolean; monthly_savings_goal: number | null } | null
  const reconcileEnabled = profile?.reconcile_expenses ?? false
  const savingsGoal = Number(profile?.monthly_savings_goal ?? 0)

  // Aggregate current & previous month from bulk
  const prevDate = new Date(year, month - 2, 1)
  const { start: prevStart, end: prevEnd } = getMonthRange(prevDate.getFullYear(), prevDate.getMonth() + 1)
  const currentMonth = bulk.filter(t => t.date >= start && t.date <= end)
  const prevMonth = bulk.filter(t => t.date >= prevStart && t.date <= prevEnd)

  const income = currentMonth.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const expenses = currentMonth.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const prevIncome = prevMonth.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const prevExpenses = prevMonth.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const pointedExpenses = currentMonth.filter(t => t.type === 'expense' && t.is_pointed).reduce((s, t) => s + Number(t.amount), 0)
  const unpointedExpenses = expenses - pointedExpenses

  // Bar chart: last 6 months aggregated from bulk
  const barData = Array.from({ length: 6 }, (_, i) => new Date(year, month - 1 - (5 - i), 1)).map(d => {
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    const { start: s, end: e } = getMonthRange(y, m)
    const rows = bulk.filter(t => t.date >= s && t.date <= e)
    return {
      month: `${String(m).padStart(2, '0')}/${y}`,
      revenus: rows.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0),
      dépenses: rows.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0),
    }
  })

  // Line chart: last 12 months aggregated from bulk
  const lineData = Array.from({ length: 12 }, (_, i) => new Date(year, month - 1 - (11 - i), 1)).map(d => {
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    const { start: s, end: e } = getMonthRange(y, m)
    const rows = bulk.filter(t => t.date >= s && t.date <= e)
    const rev = rows.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
    const exp = rows.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
    return { month: `${String(m).padStart(2, '0')}/${String(y).slice(2)}`, solde: rev - exp }
  })

  // Donut chart
  const catMap = new Map<string, { value: number; color: string | null }>()
  catData.forEach(t => {
    const name = t.categories?.name ?? 'Autre'
    const color = t.categories?.color ?? null
    catMap.set(name, { value: (catMap.get(name)?.value ?? 0) + Number(t.amount), color })
  })
  const donutData = Array.from(catMap, ([name, v]) => ({ name, ...v })).sort((a, b) => b.value - a.value).slice(0, 8)

  // Budget alerts
  const spendingByCategory = new Map<string, number>()
  currentMonth.filter(t => t.type === 'expense' && t.category_id).forEach(t => {
    spendingByCategory.set(t.category_id!, (spendingByCategory.get(t.category_id!) ?? 0) + Number(t.amount))
  })
  const alerts = budgets
    .filter(b => (spendingByCategory.get(b.category_id) ?? 0) > Number(b.amount))
    .map(b => b.categories?.name ?? 'Catégorie')

  return { income, expenses, prevIncome, prevExpenses, pointedExpenses, unpointedExpenses, reconcileEnabled, savingsGoal, barData, donutData, lineData, recent, alerts, savings: savingsRate(income, expenses) }
}

export default async function DashboardPage({ searchParams }: Props) {
  const params = await searchParams
  const { year, month } = parseMonth(params.month)

  const data = await getDashboardData(year, month)
  if (!data) return <p>Erreur de chargement</p>
  const { income, expenses, prevIncome, prevExpenses, pointedExpenses, unpointedExpenses, reconcileEnabled, savingsGoal, barData, donutData, lineData, recent, alerts, savings } = data
  const balance = income - expenses
  const prevBalance = prevIncome - prevExpenses
  const realBalance = income - pointedExpenses
  const saved = Math.max(balance, 0)
  const goalPct = savingsGoal > 0 ? Math.min(Math.round((saved / savingsGoal) * 100), 100) : 0
  const goalReached = savingsGoal > 0 && balance >= savingsGoal

  function trend(current: number, prev: number) {
    if (prev === 0) return null
    return Math.round(((current - prev) / prev) * 100)
  }

  function Sparkline({ values, color }: { values: number[]; color: string }) {
    const max = Math.max(...values, 1)
    return (
      <div className="flex items-end gap-0.5 h-7 mt-3">
        {values.map((v, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm transition-all"
            style={{
              height: `${Math.max((v / max) * 100, 6)}%`,
              backgroundColor: i === values.length - 1 ? color : `${color}55`,
            }}
          />
        ))}
      </div>
    )
  }

  function TrendBadge({ pct, invert = false }: { pct: number | null; invert?: boolean }) {
    if (pct === null) return null
    const isGood = invert ? pct <= 0 : pct >= 0
    return (
      <span className={`text-xs font-medium ${isGood ? 'text-emerald-500' : 'text-rose-500'}`}>
        {pct >= 0 ? '↑' : '↓'} {Math.abs(pct)}% vs mois dernier
      </span>
    )
  }

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
        <div className="rounded-xl border bg-card p-5 overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none" />
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Revenus</p>
          <p className="text-2xl font-bold text-emerald-500">{formatCurrency(income)}</p>
          <TrendBadge pct={trend(income, prevIncome)} />
          <Sparkline values={barData.map(d => d.revenus)} color="#10B981" />
        </div>
        <div className="rounded-xl border bg-card p-5 overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 to-transparent pointer-events-none" />
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Dépenses</p>
          <p className="text-2xl font-bold text-rose-500">{formatCurrency(expenses)}</p>
          <TrendBadge pct={trend(expenses, prevExpenses)} invert />
          <Sparkline values={barData.map(d => d.dépenses)} color="#F43F5E" />
          {reconcileEnabled && (
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-2 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-emerald-500 shrink-0" /> Débité <span className="font-semibold text-foreground">{formatCurrency(pointedExpenses)}</span></span>
              <span className="flex items-center gap-1"><Circle size={12} className="text-muted-foreground/60 shrink-0" /> Reste <span className="font-semibold text-foreground">{formatCurrency(unpointedExpenses)}</span></span>
            </div>
          )}
        </div>
        <div className="rounded-xl border bg-card p-5 overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Solde net</p>
          <p className={`text-2xl font-bold ${balance >= 0 ? 'text-primary' : 'text-rose-500'}`}>{formatCurrency(balance)}</p>
          <TrendBadge pct={trend(balance, prevBalance)} />
          {savings !== null && (
            <p className="text-xs text-muted-foreground mt-2">Taux d'épargne : <span className="font-semibold text-foreground">{savings}%</span></p>
          )}
          {reconcileEnabled && (
            <p className="text-xs text-muted-foreground mt-1">Solde réel <span className="text-muted-foreground/70">(dépenses débitées)</span> : <span className={`font-semibold ${realBalance >= 0 ? 'text-foreground' : 'text-rose-500'}`}>{formatCurrency(realBalance)}</span></p>
          )}
        </div>
      </div>

      {savingsGoal > 0 && (
        <div className="rounded-xl border bg-card p-5 overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
          <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
            <p className="text-sm font-semibold flex items-center gap-2">
              <Target size={15} className="text-primary shrink-0" /> Objectif d&apos;épargne
              {goalReached && <span className="text-xs font-medium text-emerald-500">· atteint 🎉</span>}
            </p>
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{formatCurrency(saved)}</span> / {formatCurrency(savingsGoal)}
            </p>
          </div>
          <Progress value={goalPct} className="h-2" />
          <p className="text-xs text-muted-foreground mt-2">
            {goalReached
              ? `Objectif atteint ce mois-ci (${goalPct}%).`
              : balance <= 0
                ? 'Aucune épargne ce mois pour l’instant.'
                : `${goalPct}% de l’objectif · reste ${formatCurrency(savingsGoal - saved)} à épargner.`}
          </p>
        </div>
      )}

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
