'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { upsertBudget } from '@/app/actions/budgets'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'

type Category = Database['public']['Tables']['categories']['Row']

interface Props { categories: Category[]; month: number; year: number }

export function BudgetCreateForm({ categories, month, year }: Props) {
  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)

  const selectedCategory = categories.find(c => c.id === categoryId)

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
        <Select value={categoryId} onValueChange={v => setCategoryId(v ?? '')}>
          <SelectTrigger>
            <span className={cn('flex-1 text-left text-sm truncate', !categoryId && 'text-muted-foreground')}>
              {selectedCategory?.name ?? 'Catégorie'}
            </span>
          </SelectTrigger>
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
