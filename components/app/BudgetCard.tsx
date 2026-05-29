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
  const pct = Number(budget.amount) > 0 ? (spent / Number(budget.amount)) * 100 : 0
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
            <PopoverTrigger render={<Button variant="ghost" size="icon" className="h-6 w-6" />}>
              <Pencil size={12} />
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
