# Finance App — Implementation Plan (Part 2)

> Continuation of `2026-05-29-finance-app.md`. Same header applies.

---

## Task 11: Recurring transactions page

**Files:**
- Create: `components/app/RecurringForm.tsx`
- Modify: `app/(app)/recurring/page.tsx`

- [ ] **Step 1: Create RecurringForm component**

Create `components/app/RecurringForm.tsx`:

```tsx
'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { recurringSchema, type RecurringInput } from '@/lib/validations/recurring'
import { createRecurring, updateRecurring } from '@/app/actions/recurring'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Database } from '@/types/database'

type Recurring = Database['public']['Tables']['recurring_transactions']['Row']
type Category = Database['public']['Tables']['categories']['Row']

interface Props {
  recurring?: Recurring | null
  categories: Category[]
  onSuccess: () => void
}

export function RecurringForm({ recurring, categories, onSuccess }: Props) {
  const isEdit = !!recurring
  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting } } = useForm<RecurringInput>({
    resolver: zodResolver(recurringSchema),
    defaultValues: { type: 'expense', frequency: 'monthly', start_date: new Date().toISOString().split('T')[0] },
  })

  useEffect(() => {
    if (recurring) reset({
      name: recurring.name,
      amount: recurring.amount,
      type: recurring.type,
      category_id: recurring.category_id ?? undefined,
      frequency: recurring.frequency,
      start_date: recurring.start_date,
    })
  }, [recurring, reset])

  const selectedType = watch('type')

  async function onSubmit(data: RecurringInput) {
    const result = isEdit ? await updateRecurring(recurring!.id, data) : await createRecurring(data)
    if (result.error) { toast.error(result.error); return }
    toast.success(isEdit ? 'Récurrent mis à jour' : 'Récurrent créé')
    onSuccess()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nom</Label>
        <Input id="name" {...register('name')} placeholder="Loyer, Abonnement Netflix..." />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Type</Label>
          <Select value={selectedType} onValueChange={v => setValue('type', v as 'expense' | 'income')}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="expense">Dépense</SelectItem>
              <SelectItem value="income">Revenu</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="amount">Montant (€)</Label>
          <Input id="amount" type="number" step="0.01" min="0.01" {...register('amount')} />
          {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
        </div>
      </div>
      <div className="space-y-2">
        <Label>Catégorie</Label>
        <Select onValueChange={v => setValue('category_id', v)}>
          <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
          <SelectContent>
            {categories.filter(c => c.type === selectedType || c.type === 'both').map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Fréquence</Label>
        <Select defaultValue="monthly" onValueChange={v => setValue('frequency', v as 'weekly' | 'monthly' | 'yearly')}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="weekly">Hebdomadaire</SelectItem>
            <SelectItem value="monthly">Mensuel</SelectItem>
            <SelectItem value="yearly">Annuel</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="start_date">Date de début</Label>
        <Input id="start_date" type="date" {...register('start_date')} />
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Enregistrement...' : isEdit ? 'Mettre à jour' : 'Créer'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 2: Build recurring page**

Replace `app/(app)/recurring/page.tsx`:

```tsx
import { getRecurring } from '@/app/actions/recurring'
import { getCategories } from '@/app/actions/categories'
import { RecurringListClient } from '@/components/app/RecurringListClient'

export default async function RecurringPage() {
  const [recurrings, categories] = await Promise.all([getRecurring(), getCategories()])
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Transactions récurrentes</h1>
      <RecurringListClient recurrings={recurrings as any} categories={categories} />
    </div>
  )
}
```

- [ ] **Step 3: Create RecurringListClient**

Create `components/app/RecurringListClient.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { toggleRecurring, deleteRecurring } from '@/app/actions/recurring'
import { RecurringForm } from './RecurringForm'
import { CategoryBadge } from './CategoryBadge'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { formatCurrency } from '@/lib/utils'
import { computeMissingOccurrences } from '@/lib/recurring-engine'
import type { Database } from '@/types/database'

type Recurring = Database['public']['Tables']['recurring_transactions']['Row'] & {
  categories: Pick<Database['public']['Tables']['categories']['Row'], 'id' | 'name' | 'icon_name' | 'color'> | null
}
type Category = Database['public']['Tables']['categories']['Row']

const FREQ_LABELS = { weekly: 'Hebdo', monthly: 'Mensuel', yearly: 'Annuel' }

function nextOccurrence(r: Recurring): string {
  const dates = computeMissingOccurrences({ frequency: r.frequency, start_date: r.start_date, last_generated: r.last_generated }, new Date())
  if (dates.length > 0) return dates[0]
  const next = computeMissingOccurrences(
    { frequency: r.frequency, start_date: r.start_date, last_generated: null },
    new Date(new Date().getFullYear() + 2, 0, 1)
  )
  return next.find(d => d > new Date().toISOString().split('T')[0]) ?? '—'
}

function estimatedMonthly(recurrings: Recurring[]): number {
  return recurrings.filter(r => r.is_active).reduce((sum, r) => {
    const factor = r.frequency === 'weekly' ? 4.33 : r.frequency === 'yearly' ? 1 / 12 : 1
    return sum + Number(r.amount) * factor * (r.type === 'expense' ? 1 : -1)
  }, 0)
}

interface Props { recurrings: Recurring[]; categories: Category[] }

export function RecurringListClient({ recurrings, categories }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Recurring | null>(null)

  async function handleToggle(id: string, current: boolean) {
    const result = await toggleRecurring(id, !current)
    if (result.error) toast.error(result.error)
    else toast.success(!current ? 'Activé' : 'Désactivé')
  }

  async function handleDelete(id: string) {
    const result = await deleteRecurring(id)
    if (result.error) toast.error(result.error)
    else toast.success('Récurrent supprimé')
  }

  const monthly = estimatedMonthly(recurrings)

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground">
          Charge mensuelle estimée : <span className={`font-semibold ${monthly > 0 ? 'text-rose-500' : 'text-emerald-600'}`}>{formatCurrency(Math.abs(monthly))}</span>
        </p>
        <Button size="sm" onClick={() => { setEditing(null); setSheetOpen(true) }}>
          <Plus size={14} className="mr-1" /> Ajouter
        </Button>
      </div>

      <div className="rounded-xl border divide-y">
        {recurrings.length === 0 && <p className="text-center text-muted-foreground text-sm py-12">Aucune transaction récurrente</p>}
        {recurrings.map(r => (
          <div key={r.id} className="flex items-center gap-3 px-4 py-3">
            {r.categories && <CategoryBadge name="" iconName={r.categories.icon_name} color={r.categories.color} size="sm" />}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{r.name}</p>
              <p className="text-xs text-muted-foreground">{r.categories?.name} · {FREQ_LABELS[r.frequency]} · Prochain : {nextOccurrence(r)}</p>
            </div>
            <span className={`text-sm font-semibold ${r.type === 'income' ? 'text-emerald-600' : 'text-rose-500'}`}>
              {r.type === 'income' ? '+' : '-'}{formatCurrency(Number(r.amount))}
            </span>
            <Badge variant={r.is_active ? 'default' : 'secondary'} className="cursor-pointer" onClick={() => handleToggle(r.id, r.is_active)}>
              {r.is_active ? 'Actif' : 'Inactif'}
            </Badge>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(r); setSheetOpen(true) }}><Pencil size={13} /></Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"><Trash2 size={13} /></Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer ce récurrent ?</AlertDialogTitle>
                  <AlertDialogDescription>Les transactions déjà générées ne seront pas supprimées.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleDelete(r.id)}>Supprimer</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ))}
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader><SheetTitle>{editing ? 'Modifier' : 'Nouvelle transaction récurrente'}</SheetTitle></SheetHeader>
          <div className="mt-6">
            <RecurringForm recurring={editing} categories={categories} onSuccess={() => setSheetOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add app/ components/
git commit -m "feat: add recurring transactions page with CRUD and next-occurrence display"
```

---

## Task 12: Monthly recap page

**Files:**
- Create: `components/charts/HorizontalBarChart.tsx`
- Modify: `app/(app)/recap/page.tsx`

- [ ] **Step 1: Create HorizontalBarChart**

Create `components/charts/HorizontalBarChart.tsx`:

```tsx
'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface DataPoint { name: string; value: number; color: string | null }

export function HorizontalBarChart({ data }: { data: DataPoint[] }) {
  return (
    <div className="rounded-xl border p-6">
      <h3 className="text-sm font-semibold text-muted-foreground mb-4">Top dépenses par catégorie</h3>
      <ResponsiveContainer width="100%" height={data.length * 40 + 20}>
        <BarChart data={data} layout="vertical" barCategoryGap="30%">
          <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}€`} />
          <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip formatter={(v: number) => [`${v.toFixed(2)} €`]} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {data.map((entry, i) => <Cell key={i} fill={entry.color ?? '#9CA3AF'} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 2: Build recap page**

Replace `app/(app)/recap/page.tsx`:

```tsx
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { HorizontalBarChart } from '@/components/charts/HorizontalBarChart'
import { CategoryBadge } from '@/components/app/CategoryBadge'
import { ChartSkeleton } from '@/components/app/Skeletons'
import { Progress } from '@/components/ui/progress'
import { formatCurrency, savingsRate, getMonthRange } from '@/lib/utils'
import { RecapNavigator } from '@/components/app/RecapNavigator'

interface Props {
  searchParams: Promise<{ month?: string; year?: string }>
}

export default async function RecapPage({ searchParams }: Props) {
  const params = await searchParams
  const now = new Date()
  const year = params.year ? Number(params.year) : now.getFullYear()
  const month = params.month ? Number(params.month) : now.getMonth() + 1

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { start, end } = getMonthRange(year, month)
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  const { start: prevStart, end: prevEnd } = getMonthRange(prevYear, prevMonth)

  const [{ data: current }, { data: prev }] = await Promise.all([
    supabase.from('transactions').select('amount, type, category_id, categories(id, name, icon_name, color)').eq('user_id', user.id).gte('date', start).lte('date', end),
    supabase.from('transactions').select('amount, type').eq('user_id', user.id).gte('date', prevStart).lte('date', prevEnd),
  ])

  const income = (current ?? []).filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const expenses = (current ?? []).filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const prevIncome = (prev ?? []).filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const prevExpenses = (prev ?? []).filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)

  function diff(curr: number, prev: number) {
    if (prev === 0) return null
    return Math.round(((curr - prev) / prev) * 100)
  }

  // Category breakdown
  const catMap = new Map<string, { amount: number; iconName: string | null; color: string | null; categoryId: string }>()
  ;(current ?? []).filter(t => t.type === 'expense').forEach((t: any) => {
    const name = t.categories?.name ?? 'Autre'
    catMap.set(name, {
      amount: (catMap.get(name)?.amount ?? 0) + Number(t.amount),
      iconName: t.categories?.icon_name ?? null,
      color: t.categories?.color ?? null,
      categoryId: t.category_id,
    })
  })
  const catRows = Array.from(catMap, ([name, v]) => ({ name, ...v })).sort((a, b) => b.amount - a.amount)
  const topFive = catRows.slice(0, 5).map(c => ({ name: c.name, value: c.amount, color: c.color }))

  const savings = savingsRate(income, expenses)
  const monthLabel = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Récap mensuel</h1>
        <RecapNavigator month={month} year={year} />
      </div>
      <p className="text-sm text-muted-foreground capitalize">{monthLabel}</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Revenus', value: formatCurrency(income), delta: diff(income, prevIncome), positive: true },
          { label: 'Dépenses', value: formatCurrency(expenses), delta: diff(expenses, prevExpenses), positive: false },
          { label: 'Solde', value: formatCurrency(income - expenses), delta: null, positive: income - expenses >= 0 },
          { label: "Taux d'épargne", value: savings !== null ? `${savings}%` : '—', delta: null, positive: (savings ?? 0) >= 0 },
        ].map(({ label, value, delta, positive }) => (
          <div key={label} className="rounded-xl border p-4">
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className={`text-xl font-bold ${positive ? '' : 'text-rose-500'}`}>{value}</p>
            {delta !== null && (
              <p className={`text-xs mt-1 ${delta > 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
                {delta > 0 ? '↑' : '↓'} {Math.abs(delta)}% vs mois préc.
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="rounded-xl border">
        <div className="px-4 py-3 border-b">
          <h3 className="text-sm font-semibold">Dépenses par catégorie</h3>
        </div>
        <div className="divide-y">
          {catRows.map(c => (
            <div key={c.name} className="px-4 py-3 flex items-center gap-4">
              <CategoryBadge name={c.name} iconName={c.iconName} color={c.color} size="sm" />
              <div className="flex-1">
                <Progress value={expenses > 0 ? (c.amount / expenses) * 100 : 0} className="h-2" />
              </div>
              <span className="text-sm font-semibold w-24 text-right">{formatCurrency(c.amount)}</span>
              <span className="text-xs text-muted-foreground w-12 text-right">
                {expenses > 0 ? Math.round((c.amount / expenses) * 100) : 0}%
              </span>
            </div>
          ))}
          {catRows.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">Aucune dépense ce mois</p>}
        </div>
      </div>

      {topFive.length > 0 && (
        <Suspense fallback={<ChartSkeleton />}>
          <HorizontalBarChart data={topFive} />
        </Suspense>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create RecapNavigator client component**

Create `components/app/RecapNavigator.tsx`:

```tsx
'use client'

import { useRouter, usePathname } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function RecapNavigator({ month, year }: { month: number; year: number }) {
  const router = useRouter()
  const pathname = usePathname()

  function navigate(direction: -1 | 1) {
    let m = month + direction
    let y = year
    if (m < 1) { m = 12; y-- }
    if (m > 12) { m = 1; y++ }
    router.push(`${pathname}?month=${m}&year=${y}`)
  }

  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ChevronLeft size={16} /></Button>
      <Button variant="ghost" size="icon" onClick={() => navigate(1)}><ChevronRight size={16} /></Button>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add app/ components/
git commit -m "feat: add monthly recap page with category breakdown and charts"
```

---

## Task 13: Budgets page

**Files:**
- Create: `app/actions/budgets.ts`, `components/app/BudgetCard.tsx`
- Modify: `app/(app)/budgets/page.tsx`

- [ ] **Step 1: Create budget server actions**

Create `app/actions/budgets.ts`:

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { budgetSchema } from '@/lib/validations/budget'
import { revalidatePath } from 'next/cache'

export async function getBudgets(month: number, year: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase
    .from('budgets')
    .select('*, categories(id, name, icon_name, color)')
    .eq('user_id', user.id)
    .eq('month', month)
    .eq('year', year)
  return data ?? []
}

export async function upsertBudget(input: unknown) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  const parsed = budgetSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const { error } = await supabase
    .from('budgets')
    .upsert({ ...parsed.data, user_id: user.id }, { onConflict: 'user_id,category_id,month,year' })
  if (error) return { error: error.message }
  revalidatePath('/budgets')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function deleteBudget(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  const { error } = await supabase.from('budgets').delete().eq('id', id).eq('user_id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/budgets')
  return { success: true }
}
```

- [ ] **Step 2: Create BudgetCard component**

Create `components/app/BudgetCard.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { upsertBudget, deleteBudget } from '@/app/actions/budgets'
import { CategoryBadge } from './CategoryBadge'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Pencil, Trash2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { Database } from '@/types/database'

type Budget = Database['public']['Tables']['budgets']['Row'] & {
  categories: Pick<Database['public']['Tables']['categories']['Row'], 'id' | 'name' | 'icon_name' | 'color'> | null
}

interface Props {
  budget: Budget
  spent: number
  month: number
  year: number
}

export function BudgetCard({ budget, spent, month, year }: Props) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(String(budget.amount))
  const [saving, setSaving] = useState(false)
  const pct = budget.amount > 0 ? (spent / Number(budget.amount)) * 100 : 0
  const over = pct > 100

  async function handleSave() {
    setSaving(true)
    const result = await upsertBudget({ category_id: budget.category_id, amount: Number(value), month, year })
    setSaving(false)
    if (result.error) toast.error(result.error)
    else { toast.success('Budget mis à jour'); setOpen(false) }
  }

  async function handleDelete() {
    const result = await deleteBudget(budget.id)
    if (result.error) toast.error(result.error)
    else toast.success('Budget supprimé')
  }

  return (
    <div className="rounded-xl border p-4 space-y-3">
      <div className="flex items-center justify-between">
        {budget.categories && (
          <CategoryBadge name={budget.categories.name} iconName={budget.categories.icon_name} color={budget.categories.color} size="sm" />
        )}
        <div className="flex gap-1">
          {over && <Badge variant="destructive" className="text-xs">Dépassé</Badge>}
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6"><Pencil size={12} /></Button>
            </PopoverTrigger>
            <PopoverContent className="w-48">
              <div className="space-y-3">
                <Label>Budget mensuel (€)</Label>
                <Input type="number" min="0.01" step="0.01" value={value} onChange={e => setValue(e.target.value)} />
                <Button size="sm" className="w-full" onClick={handleSave} disabled={saving}>
                  {saving ? '...' : 'Sauvegarder'}
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={handleDelete}><Trash2 size={12} /></Button>
        </div>
      </div>
      <div>
        <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
          <span>{formatCurrency(spent)} dépensés</span>
          <span>/ {formatCurrency(Number(budget.amount))}</span>
        </div>
        <Progress
          value={Math.min(pct, 100)}
          className={`h-2 ${over ? '[&>div]:bg-destructive' : pct > 80 ? '[&>div]:bg-amber-500' : '[&>div]:bg-emerald-500'}`}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Build budgets page**

Replace `app/(app)/budgets/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server'
import { getBudgets } from '@/app/actions/budgets'
import { getCategories } from '@/app/actions/categories'
import { BudgetCard } from '@/components/app/BudgetCard'
import { BudgetCreateForm } from '@/components/app/BudgetCreateForm'
import { getMonthRange } from '@/lib/utils'

export default async function BudgetsPage() {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [budgets, categories] = await Promise.all([getBudgets(month, year), getCategories()])

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

  const budgetedCategoryIds = new Set(budgets.map((b: any) => b.category_id))
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
        {(budgets as any[]).map(b => (
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
```

- [ ] **Step 4: Create BudgetCreateForm**

Create `components/app/BudgetCreateForm.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { upsertBudget } from '@/app/actions/budgets'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Database } from '@/types/database'

type Category = Database['public']['Tables']['categories']['Row']

interface Props { categories: Category[]; month: number; year: number }

export function BudgetCreateForm({ categories, month, year }: Props) {
  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!categoryId || !amount) return
    setSaving(true)
    const result = await upsertBudget({ category_id: categoryId, amount: Number(amount), month, year })
    setSaving(false)
    if (result.error) toast.error(result.error)
    else { toast.success('Budget créé'); setCategoryId(''); setAmount('') }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 items-end">
      <div className="flex-1 min-w-40">
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger><SelectValue placeholder="Catégorie" /></SelectTrigger>
          <SelectContent>
            {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="w-32">
        <Input type="number" min="0.01" step="0.01" placeholder="Montant €" value={amount} onChange={e => setAmount(e.target.value)} />
      </div>
      <Button type="submit" size="sm" disabled={saving || !categoryId || !amount}>
        {saving ? '...' : 'Créer'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add app/ components/
git commit -m "feat: add budgets page with progress bars and create/edit/delete"
```

---

## Task 14: Import wizard

**Files:**
- Create: `lib/import-engine.ts`, `lib/import-engine.test.ts`
- Create: `components/app/ImportWizard.tsx`
- Modify: `app/(app)/import/page.tsx`

- [ ] **Step 1: Write failing tests for import engine**

Create `lib/import-engine.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { computeImportHash, detectDuplicates } from './import-engine'

describe('computeImportHash', () => {
  it('produces consistent hash for same inputs', () => {
    const h1 = computeImportHash('2024-03-15', 42.50, 'Carrefour')
    const h2 = computeImportHash('2024-03-15', 42.50, 'Carrefour')
    expect(h1).toBe(h2)
  })
  it('produces different hash for different inputs', () => {
    const h1 = computeImportHash('2024-03-15', 42.50, 'Carrefour')
    const h2 = computeImportHash('2024-03-15', 42.50, 'Lidl')
    expect(h1).not.toBe(h2)
  })
})

describe('detectDuplicates', () => {
  it('marks rows that match existing hashes', () => {
    const existing = [computeImportHash('2024-01-05', 100, 'Loyer')]
    const rows = [
      { date: '2024-01-05', amount: 100, description: 'Loyer' },
      { date: '2024-02-01', amount: 50, description: 'Courses' },
    ]
    const result = detectDuplicates(rows, existing)
    expect(result[0].isDuplicate).toBe(true)
    expect(result[1].isDuplicate).toBe(false)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npm test
```
Expected: FAIL.

- [ ] **Step 3: Implement import engine**

Create `lib/import-engine.ts`:

```ts
export function computeImportHash(date: string, amount: number, description: string): string {
  return `${date}|${amount.toFixed(2)}|${description.trim().toLowerCase()}`
}

interface ImportRow {
  date: string
  amount: number
  description: string
  [key: string]: unknown
}

export function detectDuplicates<T extends ImportRow>(
  rows: T[],
  existingHashes: string[]
): (T & { isDuplicate: boolean; hash: string })[] {
  const existingSet = new Set(existingHashes)
  return rows.map(row => {
    const hash = computeImportHash(row.date, row.amount, row.description)
    return { ...row, hash, isDuplicate: existingSet.has(hash) }
  })
}

export function parseAmount(raw: string | number, positiveIsExpense: boolean): { amount: number; type: 'expense' | 'income' } {
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.').replace(/\s/g, ''))
  if (isNaN(n)) throw new Error(`Montant invalide: ${raw}`)
  const isExpense = positiveIsExpense ? n > 0 : n < 0
  return { amount: Math.abs(n), type: isExpense ? 'expense' : 'income' }
}

export function parseRowDate(raw: string, format: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'ISO'): string {
  if (format === 'ISO') {
    const d = new Date(raw)
    if (isNaN(d.getTime())) throw new Error(`Date invalide: ${raw}`)
    return d.toISOString().split('T')[0]
  }
  const parts = raw.split(/[\/\-]/)
  if (parts.length !== 3) throw new Error(`Format date invalide: ${raw}`)
  const [a, b, c] = parts
  if (format === 'DD/MM/YYYY') return `${c}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`
  return `${c}-${a.padStart(2, '0')}-${b.padStart(2, '0')}`
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npm test
```
Expected: all 3 tests PASS.

- [ ] **Step 5: Build ImportWizard component**

Create `components/app/ImportWizard.tsx`:

```tsx
'use client'

import { useState, useCallback } from 'react'
import { read, utils } from 'xlsx'
import { toast } from 'sonner'
import { Upload, ChevronRight } from 'lucide-react'
import { z } from 'zod'
import { parseAmount, parseRowDate, detectDuplicates, computeImportHash } from '@/lib/import-engine'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import type { Database } from '@/types/database'

type Category = Database['public']['Tables']['categories']['Row']

const FIELD_OPTIONS = ['montant', 'date', 'description', 'catégorie', 'ignorer'] as const
type FieldOption = typeof FIELD_OPTIONS[number]

interface Props { categories: Category[] }

export function ImportWizard({ categories }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [mapping, setMapping] = useState<Record<string, FieldOption>>({})
  const [positiveIsExpense, setPositiveIsExpense] = useState(true)
  const [dateFormat, setDateFormat] = useState<'DD/MM/YYYY' | 'MM/DD/YYYY' | 'ISO'>('DD/MM/YYYY')
  const [summary, setSummary] = useState<{ toImport: number; duplicates: number; errors: number } | null>(null)
  const [validRows, setValidRows] = useState<any[]>([])
  const [importing, setImporting] = useState(false)

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = e => {
      const data = new Uint8Array(e.target!.result as ArrayBuffer)
      const wb = read(data, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const parsed: Record<string, unknown>[] = utils.sheet_to_json(ws, { defval: '' })
      if (parsed.length === 0) { toast.error('Fichier vide'); return }
      const hdrs = Object.keys(parsed[0])
      setHeaders(hdrs)
      setRows(parsed)
      const autoMapping: Record<string, FieldOption> = {}
      hdrs.forEach(h => {
        const lower = h.toLowerCase()
        if (lower.includes('mont') || lower.includes('amount')) autoMapping[h] = 'montant'
        else if (lower.includes('date')) autoMapping[h] = 'date'
        else if (lower.includes('desc') || lower.includes('lib')) autoMapping[h] = 'description'
        else autoMapping[h] = 'ignorer'
      })
      setMapping(autoMapping)
      setStep(2)
    }
    reader.readAsArrayBuffer(file)
  }, [])

  async function handleValidate() {
    const amountCol = Object.entries(mapping).find(([, v]) => v === 'montant')?.[0]
    const dateCol = Object.entries(mapping).find(([, v]) => v === 'date')?.[0]
    const descCol = Object.entries(mapping).find(([, v]) => v === 'description')?.[0]
    if (!amountCol || !dateCol) { toast.error('Colonne montant et date requises'); return }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: existing } = await supabase.from('transactions').select('date, amount, description').eq('user_id', user.id)
    const existingHashes = (existing ?? []).map(t => computeImportHash(t.date, Number(t.amount), t.description ?? ''))

    const rawRows = rows.map(r => ({
      rawAmount: r[amountCol],
      rawDate: String(r[dateCol]),
      description: descCol ? String(r[descCol] ?? '') : '',
    }))

    let errors = 0
    const processed = rawRows.map(r => {
      try {
        const { amount, type } = parseAmount(r.rawAmount as string | number, positiveIsExpense)
        const date = parseRowDate(r.rawDate, dateFormat)
        return { amount, type, date, description: r.description }
      } catch {
        errors++
        return null
      }
    }).filter(Boolean) as { amount: number; type: string; date: string; description: string }[]

    const withDupes = detectDuplicates(processed, existingHashes)
    const toImport = withDupes.filter(r => !r.isDuplicate)
    const duplicates = withDupes.filter(r => r.isDuplicate).length

    setValidRows(toImport)
    setSummary({ toImport: toImport.length, duplicates, errors })
    setStep(3)
  }

  async function handleImport() {
    setImporting(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const catMap = new Map(categories.map(c => [c.name.toLowerCase(), c.id]))
    const toInsert = validRows.map(r => ({
      user_id: user.id,
      amount: r.amount,
      type: r.type,
      date: r.date,
      description: r.description,
      category_id: catMap.get(r.description?.toLowerCase()) ?? null,
    }))

    const { error } = await supabase.from('transactions').insert(toInsert)
    setImporting(false)
    if (error) { toast.error(error.message); return }
    toast.success(`${toInsert.length} transactions importées`)
    setStep(1); setRows([]); setHeaders([]); setSummary(null)
  }

  if (step === 1) return (
    <div
      className="border-2 border-dashed rounded-xl p-12 text-center cursor-pointer hover:border-primary transition-colors"
      onDragOver={e => e.preventDefault()}
      onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
      onClick={() => document.getElementById('file-input')?.click()}
    >
      <Upload size={32} className="mx-auto text-muted-foreground mb-3" />
      <p className="text-sm font-medium">Déposez un fichier .xlsx ou .csv</p>
      <p className="text-xs text-muted-foreground mt-1">ou cliquez pour choisir</p>
      <input id="file-input" type="file" accept=".xlsx,.csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
    </div>
  )

  if (step === 2) return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">Mapper les colonnes</h2>
        <span className="text-sm text-muted-foreground">({rows.length} lignes détectées)</span>
      </div>
      <div className="rounded-xl border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>{headers.map(h => <th key={h} className="px-4 py-2 text-left font-medium text-xs">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.slice(0, 3).map((row, i) => (
              <tr key={i} className="border-t">
                {headers.map(h => <td key={h} className="px-4 py-2 text-muted-foreground truncate max-w-32">{String(row[h] ?? '')}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {headers.map(h => (
          <div key={h} className="space-y-1.5">
            <Label className="text-xs">{h}</Label>
            <Select value={mapping[h]} onValueChange={v => setMapping(m => ({ ...m, [h]: v as FieldOption }))}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{FIELD_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Montants positifs =</Label>
          <Select value={positiveIsExpense ? 'expense' : 'income'} onValueChange={v => setPositiveIsExpense(v === 'expense')}>
            <SelectTrigger className="h-8 text-xs w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="expense">Dépenses</SelectItem>
              <SelectItem value="income">Revenus</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Format date</Label>
          <Select value={dateFormat} onValueChange={v => setDateFormat(v as typeof dateFormat)}>
            <SelectTrigger className="h-8 text-xs w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="DD/MM/YYYY">JJ/MM/AAAA</SelectItem>
              <SelectItem value="MM/DD/YYYY">MM/JJ/AAAA</SelectItem>
              <SelectItem value="ISO">ISO (AAAA-MM-JJ)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button onClick={handleValidate} className="gap-2">Valider <ChevronRight size={14} /></Button>
    </div>
  )

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Résumé de l'import</h2>
      {summary && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border p-4 text-center">
            <p className="text-3xl font-bold text-foreground">{summary.toImport}</p>
            <p className="text-xs text-muted-foreground mt-1">à importer</p>
          </div>
          <div className="rounded-xl border p-4 text-center">
            <p className="text-3xl font-bold text-amber-500">{summary.duplicates}</p>
            <p className="text-xs text-muted-foreground mt-1">doublons ignorés</p>
          </div>
          <div className="rounded-xl border p-4 text-center">
            <p className="text-3xl font-bold text-destructive">{summary.errors}</p>
            <p className="text-xs text-muted-foreground mt-1">erreurs</p>
          </div>
        </div>
      )}
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => setStep(2)}>Retour</Button>
        <Button onClick={handleImport} disabled={importing || summary?.toImport === 0}>
          {importing ? 'Import en cours...' : `Importer ${summary?.toImport} transactions`}
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Build import page**

Replace `app/(app)/import/page.tsx`:

```tsx
import { getCategories } from '@/app/actions/categories'
import { ImportWizard } from '@/components/app/ImportWizard'

export default async function ImportPage() {
  const categories = await getCategories()
  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Import Excel / CSV</h1>
      <p className="text-sm text-muted-foreground mb-6">Importez vos transactions depuis un fichier de votre banque</p>
      <ImportWizard categories={categories} />
    </div>
  )
}
```

- [ ] **Step 7: Commit**

```bash
git add lib/ app/ components/
git commit -m "feat: add import wizard with SheetJS, column mapping, and duplicate detection"
```

---

## Task 15: Profile page + category management

**Files:**
- Create: `app/actions/profile.ts`, `components/app/CategoryManager.tsx`
- Modify: `app/(app)/profile/page.tsx`

- [ ] **Step 1: Create profile server actions**

Create `app/actions/profile.ts`:

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const profileSchema = z.object({
  full_name: z.string().min(1).max(100),
  currency: z.string().length(3),
})

export async function getProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  return data
}

export async function updateProfile(input: unknown) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  const parsed = profileSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const { error } = await supabase.from('profiles').update(parsed.data).eq('id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/profile')
  return { success: true }
}
```

- [ ] **Step 2: Create CategoryManager component**

Create `components/app/CategoryManager.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import { createCategory, updateCategory, deleteCategory } from '@/app/actions/categories'
import { CategoryBadge } from './CategoryBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import type { Database } from '@/types/database'

type Category = Database['public']['Tables']['categories']['Row']

const ICON_OPTIONS = ['home', 'car', 'utensils', 'shopping-cart', 'heart-pulse', 'smartphone', 'plane', 'briefcase', 'dumbbell', 'gift', 'music', 'book', 'coffee', 'camera', 'globe', 'star', 'zap', 'shield', 'credit-card', 'piggy-bank', 'trending-up', 'building', 'wrench', 'laptop', 'shirt', 'baby', 'paw-print', 'sun', 'moon', 'tree', 'bike', 'bus', 'film', 'gamepad', 'pizza', 'wine', 'flower', 'hammer', 'scissors']

const COLOR_OPTIONS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#F97316', '#EC4899', '#14B8A6', '#84CC16', '#0EA5E9', '#F43F5E', '#64748B']

interface Props { categories: Category[] }

export function CategoryManager({ categories }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [name, setName] = useState('')
  const [iconName, setIconName] = useState('circle-help')
  const [color, setColor] = useState('#6366F1')
  const [type, setType] = useState<'expense' | 'income' | 'both'>('expense')
  const [saving, setSaving] = useState(false)

  function openCreate() {
    setEditing(null); setName(''); setIconName('circle-help'); setColor('#6366F1'); setType('expense'); setSheetOpen(true)
  }
  function openEdit(c: Category) {
    setEditing(c); setName(c.name); setIconName(c.icon_name ?? 'circle-help'); setColor(c.color ?? '#6366F1'); setType(c.type as typeof type); setSheetOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    const input = { name, icon_name: iconName, color, type }
    const result = editing ? await updateCategory(editing.id, input) : await createCategory(input)
    setSaving(false)
    if (result.error) toast.error(result.error)
    else { toast.success(editing ? 'Catégorie mise à jour' : 'Catégorie créée'); setSheetOpen(false) }
  }

  async function handleDelete(id: string) {
    const result = await deleteCategory(id)
    if (result.error) toast.error(result.error)
    else toast.success('Catégorie supprimée')
  }

  const custom = categories.filter(c => !c.is_default)
  const defaults = categories.filter(c => c.is_default)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Catégories</h2>
        <Button size="sm" onClick={openCreate}><Plus size={14} className="mr-1" />Nouvelle</Button>
      </div>

      {custom.length > 0 && (
        <div className="rounded-xl border divide-y">
          {custom.map(c => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3">
              <CategoryBadge name={c.name} iconName={c.icon_name} color={c.color} size="sm" />
              <span className="text-xs text-muted-foreground ml-auto">{c.type}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}><Pencil size={13} /></Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 size={13} /></Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader><AlertDialogTitle>Supprimer cette catégorie ?</AlertDialogTitle><AlertDialogDescription>Les transactions associées perdront leur catégorie.</AlertDialogDescription></AlertDialogHeader>
                  <AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(c.id)}>Supprimer</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}
        </div>
      )}

      <details className="text-xs text-muted-foreground cursor-pointer">
        <summary className="py-2">Catégories par défaut ({defaults.length})</summary>
        <div className="mt-2 rounded-xl border divide-y">
          {defaults.map(c => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-2.5 opacity-60">
              <CategoryBadge name={c.name} iconName={c.icon_name} color={c.color} size="sm" />
            </div>
          ))}
        </div>
      </details>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader><SheetTitle>{editing ? 'Modifier la catégorie' : 'Nouvelle catégorie'}</SheetTitle></SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-2"><Label>Nom</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={v => setType(v as typeof type)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Dépense</SelectItem>
                  <SelectItem value="income">Revenu</SelectItem>
                  <SelectItem value="both">Les deux</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Icône</Label>
              <div className="grid grid-cols-8 gap-1.5">
                {ICON_OPTIONS.map(ico => {
                  const Icon = (LucideIcons as Record<string, React.ElementType>)[ico.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('')]
                  return Icon ? (
                    <button key={ico} type="button" onClick={() => setIconName(ico)}
                      className={`p-1.5 rounded-md border transition-colors ${iconName === ico ? 'border-primary bg-primary/10' : 'border-transparent hover:bg-muted'}`}>
                      <Icon size={16} />
                    </button>
                  ) : null
                })}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Couleur</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.map(c => (
                  <button key={c} type="button" onClick={() => setColor(c)}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${color === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            <Button className="w-full" onClick={handleSave} disabled={saving || !name}>
              {saving ? '...' : editing ? 'Mettre à jour' : 'Créer'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
```

- [ ] **Step 3: Build profile page**

Replace `app/(app)/profile/page.tsx`:

```tsx
import { getProfile } from '@/app/actions/profile'
import { getCategories } from '@/app/actions/categories'
import { ProfileForm } from '@/components/app/ProfileForm'
import { CategoryManager } from '@/components/app/CategoryManager'
import { Separator } from '@/components/ui/separator'

export default async function ProfilePage() {
  const [profile, categories] = await Promise.all([getProfile(), getCategories()])
  return (
    <div className="max-w-lg space-y-8">
      <h1 className="text-2xl font-bold">Profil</h1>
      <ProfileForm profile={profile} />
      <Separator />
      <CategoryManager categories={categories} />
    </div>
  )
}
```

- [ ] **Step 4: Create ProfileForm component**

Create `components/app/ProfileForm.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { updateProfile } from '@/app/actions/profile'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Database } from '@/types/database'

type Profile = Database['public']['Tables']['profiles']['Row']

const CURRENCIES = [{ value: 'EUR', label: '€ Euro' }, { value: 'USD', label: '$ Dollar' }, { value: 'GBP', label: '£ Livre' }, { value: 'CHF', label: 'CHF Franc suisse' }]

export function ProfileForm({ profile }: { profile: Profile | null }) {
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    const fd = new FormData(e.currentTarget)
    const result = await updateProfile({ full_name: fd.get('full_name'), currency: fd.get('currency') })
    setSaving(false)
    if (result.error) toast.error(result.error)
    else toast.success('Profil mis à jour')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="full_name">Nom complet</Label>
        <Input id="full_name" name="full_name" defaultValue={profile?.full_name ?? ''} />
      </div>
      <div className="space-y-2">
        <Label>Devise</Label>
        <Select name="currency" defaultValue={profile?.currency ?? 'EUR'}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{CURRENCIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={saving}>{saving ? 'Sauvegarde...' : 'Sauvegarder'}</Button>
    </form>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add app/ components/
git commit -m "feat: add profile page with settings and category management"
```

---

## Task 16: Dark mode theming

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Update globals.css with semantic color tokens**

In `app/globals.css`, ensure the following CSS variables are defined for both light and dark modes. Shadcn init should have generated a base — replace/merge with:

```css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 243 75% 59%;          /* indigo #4F46E5 */
    --primary-foreground: 0 0% 100%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 243 75% 59%;
    --radius: 0.75rem;
  }

  .dark {
    --background: 240 10% 4%;        /* #0A0A0F */
    --foreground: 240 20% 94%;       /* #F0F0FF */
    --card: 240 10% 7%;              /* #111118 */
    --card-foreground: 240 20% 94%;
    --popover: 240 10% 7%;
    --popover-foreground: 240 20% 94%;
    --primary: 243 75% 59%;
    --primary-foreground: 0 0% 100%;
    --secondary: 240 8% 16%;
    --secondary-foreground: 240 20% 94%;
    --muted: 240 8% 14%;
    --muted-foreground: 240 6% 53%;  /* #8888AA */
    --accent: 240 8% 14%;
    --accent-foreground: 240 20% 94%;
    --destructive: 0 62.8% 55%;
    --destructive-foreground: 240 20% 94%;
    --border: 240 6% 20%;            /* #2A2A3A */
    --input: 240 6% 20%;
    --ring: 243 75% 59%;
  }
}
```

- [ ] **Step 2: Verify theme switching**

```bash
npm run dev
```
Toggle dark/light in sidebar → colors switch cleanly. Charts update their colors via `useTheme`.

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat: configure dark/light mode CSS tokens for both themes"
```

---

## Task 17: PWA configuration

**Files:**
- Create: `public/manifest.json`
- Create: `public/icons/icon-192.png`, `public/icons/icon-512.png` (placeholder — replace with real icons)
- Create: `components/app/InstallBanner.tsx`
- Modify: `next.config.ts`, `app/layout.tsx`

- [ ] **Step 1: Create manifest.json**

Create `public/manifest.json`:

```json
{
  "name": "FinanceApp",
  "short_name": "Finance",
  "description": "Gestion de finances personnelles",
  "start_url": "/dashboard",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#4F46E5",
  "orientation": "portrait",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

- [ ] **Step 2: Create placeholder icons**

Create `public/icons/` directory. Place a 192×192 and 512×512 PNG icon there. For development, use any square PNG and rename it. For production, use a proper icon generator (e.g., [realfavicongenerator.net](https://realfavicongenerator.net)).

- [ ] **Step 3: Configure next-pwa**

Replace `next.config.ts`:

```ts
import type { NextConfig } from 'next'
import withPWAInit from '@ducanh2912/next-pwa'

const withPWA = withPWAInit({
  dest: 'public',
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === 'development',
  workboxOptions: {
    disableDevLogs: true,
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
        handler: 'NetworkOnly',
      },
    ],
  },
})

const nextConfig: NextConfig = {
  // any existing config
}

export default withPWA(nextConfig)
```

- [ ] **Step 4: Add manifest link to app layout**

In `app/layout.tsx`, add to metadata:

```ts
export const metadata: Metadata = {
  title: 'FinanceApp',
  description: 'Gestion de finances personnelles',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'FinanceApp',
  },
}
```

- [ ] **Step 5: Create InstallBanner component**

Create `components/app/InstallBanner.tsx`:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { X, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function InstallBanner() {
  const [show, setShow] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)

  useEffect(() => {
    if (localStorage.getItem('pwa-dismissed')) return

    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
    const standalone = (window.navigator as any).standalone === true
    if (ios && !standalone) { setIsIOS(true); setShow(true); return }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function dismiss() {
    localStorage.setItem('pwa-dismissed', '1')
    setShow(false)
  }

  async function install() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="fixed bottom-20 lg:bottom-4 left-4 right-4 lg:left-auto lg:right-4 lg:w-80 z-50 rounded-xl border bg-background shadow-lg p-4">
      <div className="flex items-start gap-3">
        <Download size={18} className="text-primary mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold">Installer l'app</p>
          {isIOS ? (
            <p className="text-xs text-muted-foreground mt-1">
              Appuyez sur <strong>Partager</strong> puis <strong>Ajouter à l'écran d'accueil</strong>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">Accès rapide depuis votre écran d'accueil</p>
          )}
          {!isIOS && (
            <Button size="sm" className="mt-2 h-7 text-xs" onClick={install}>Installer</Button>
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={dismiss}><X size={13} /></Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Add InstallBanner to app layout**

In `app/(app)/layout.tsx`, import and add `<InstallBanner />` after `<MobileFab />`:

```tsx
import { InstallBanner } from '@/components/app/InstallBanner'
// ...
<InstallBanner />
```

- [ ] **Step 7: Build and verify PWA**

```bash
npm run build
npm start
```
Open `http://localhost:3000` in Chrome DevTools → Application tab → Manifest should load. On mobile, banner appears on first visit.

- [ ] **Step 8: Commit**

```bash
git add public/ app/ components/ next.config.ts
git commit -m "feat: configure PWA with manifest, service worker, and install banner"
```

---

## Task 18: Animations + final polish

**Files:**
- Create: `components/app/PageTransition.tsx`
- Modify: `app/(app)/layout.tsx`, `app/globals.css`

- [ ] **Step 1: Create PageTransition wrapper**

Create `components/app/PageTransition.tsx`:

```tsx
'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { usePathname } from 'next/navigation'

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
```

- [ ] **Step 2: Wrap main content with PageTransition**

In `app/(app)/layout.tsx`, wrap `{children}` with `<PageTransition>`:

```tsx
import { PageTransition } from '@/components/app/PageTransition'
// in JSX:
<div className="max-w-6xl mx-auto px-4 py-6">
  <PageTransition>
    {children}
  </PageTransition>
</div>
```

- [ ] **Step 3: Add card hover transitions to globals.css**

Add to `app/globals.css`:

```css
@layer utilities {
  .card-hover {
    @apply transition-transform transition-shadow duration-200;
  }
  .card-hover:hover {
    @apply -translate-y-0.5 shadow-md;
  }
}
```

Apply `card-hover` class to budget cards and dashboard cards where appropriate.

- [ ] **Step 4: Add prefers-reduced-motion override**

Add to `app/globals.css`:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 5: Verify all pages on mobile viewport**

In Chrome DevTools, switch to mobile viewport (375px). Check:
- Bottom nav is visible and all 4 links work
- FAB (+) is visible above bottom nav
- Transaction Sheet opens and form is usable
- Dashboard cards stack in single column
- Charts are responsive

- [ ] **Step 6: Run all tests one final time**

```bash
npm test
```
Expected: all tests PASS.

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat: add page transitions, hover animations, and reduced-motion support"
```

---

## Self-Review

**Spec coverage check:**
- [x] Auth (login, register, session, profile) → Tasks 5, 15
- [x] Dashboard with 3 charts + summary cards → Task 10
- [x] Transactions CRUD + filters + pagination → Tasks 7, 8
- [x] Pre-seeded categories (23) with Lucide icons → Task 2 (SQL trigger)
- [x] Custom categories (CRUD + icon picker) → Task 15
- [x] Recurring transactions + generate mechanism → Tasks 9, 11
- [x] Monthly recap with comparison → Task 12
- [x] Import Excel/CSV wizard with deduplication → Task 14
- [x] Budgets with progress bars + alerts → Task 13
- [x] Dark/light mode with system detection → Tasks 6, 16
- [x] Responsive mobile-first + bottom nav + FAB → Tasks 6, 8, 18
- [x] PWA + manifest + install banner → Task 17
- [x] Skeleton loaders → Task 7
- [x] Toasts for all CRUD actions → throughout
- [x] Animations + page transitions → Task 18

**Placeholder scan:** No TBD or TODO found. All steps contain concrete code.

**Type consistency:** `Database` types defined in Task 3 and used consistently throughout. Server action return types `{ error: string } | { success: true }` consistent across all actions.
