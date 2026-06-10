'use client'

import { useEffect } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { recurringSchema, type RecurringInput } from '@/lib/validations/recurring'
import { createRecurring, updateRecurring } from '@/app/actions/recurring'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/ui/date-picker'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'

type Recurring = Database['public']['Tables']['recurring_transactions']['Row']
type Category = Database['public']['Tables']['categories']['Row']

const FREQ_LABELS: Record<string, string> = {
  weekly: 'Hebdomadaire',
  monthly: 'Mensuel',
  yearly: 'Annuel',
}

interface Props {
  recurring?: Recurring | null
  categories: Category[]
  onSuccess: () => void
}

export function RecurringForm({ recurring, categories, onSuccess }: Props) {
  const isEdit = !!recurring
  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting } } = useForm<RecurringInput>({
    resolver: zodResolver(recurringSchema) as Resolver<RecurringInput>,
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
  const selectedCategoryId = watch('category_id')
  const selectedFrequency = watch('frequency')

  // Clear category when type changes and selected category no longer matches
  useEffect(() => {
    if (selectedCategoryId) {
      const cat = categories.find(c => c.id === selectedCategoryId)
      if (cat && cat.type !== selectedType && cat.type !== 'both') {
        setValue('category_id', undefined)
      }
    }
  }, [selectedType, selectedCategoryId, categories, setValue])

  async function onSubmit(data: RecurringInput) {
    try {
      const result = isEdit ? await updateRecurring(recurring!.id, data) : await createRecurring(data)
      if (result.error) { toast.error(result.error); return }
      toast.success(isEdit ? 'Récurrent mis à jour' : 'Récurrent créé')
      onSuccess()
    } catch {
      toast.error('Une erreur inattendue est survenue.')
    }
  }

  const filteredCategories = categories.filter(c => c.type === selectedType || c.type === 'both')
  const selectedCategory = categories.find(c => c.id === selectedCategoryId)

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
            <SelectTrigger className="w-full">
              <span className="flex-1 text-left text-sm">
                {selectedType === 'expense' ? 'Dépense' : 'Revenu'}
              </span>
            </SelectTrigger>
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
        <Select
          value={selectedCategoryId ?? ''}
          onValueChange={v => setValue('category_id', v || undefined)}
        >
          <SelectTrigger className="w-full">
            <span className={cn('flex-1 text-left text-sm truncate', !selectedCategoryId && 'text-muted-foreground')}>
              {selectedCategory?.name ?? 'Choisir...'}
            </span>
          </SelectTrigger>
          <SelectContent>
            {filteredCategories.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Fréquence</Label>
        <Select value={selectedFrequency} onValueChange={v => setValue('frequency', v as 'weekly' | 'monthly' | 'yearly')}>
          <SelectTrigger className="w-full">
            <span className="flex-1 text-left text-sm">
              {FREQ_LABELS[selectedFrequency] ?? selectedFrequency}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="weekly">Hebdomadaire</SelectItem>
            <SelectItem value="monthly">Mensuel</SelectItem>
            <SelectItem value="yearly">Annuel</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="start_date">Date de début</Label>
        <DatePicker id="start_date" value={watch('start_date')} onChange={v => setValue('start_date', v, { shouldValidate: true })} />
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Enregistrement...' : isEdit ? 'Mettre à jour' : 'Créer'}
      </Button>
    </form>
  )
}
