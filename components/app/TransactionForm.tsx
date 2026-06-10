'use client'

import { useEffect } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { transactionSchema, type TransactionInput } from '@/lib/validations/transaction'
import { createTransaction, updateTransaction } from '@/app/actions/transactions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/ui/date-picker'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'

type Transaction = Database['public']['Tables']['transactions']['Row']
type Category = Database['public']['Tables']['categories']['Row']

interface Props {
  transaction?: Transaction | null
  categories: Category[]
  onSuccess: () => void
}

export function TransactionForm({ transaction, categories, onSuccess }: Props) {
  const isEdit = !!transaction
  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting } } = useForm<TransactionInput>({
    resolver: zodResolver(transactionSchema) as Resolver<TransactionInput>,
    defaultValues: {
      type: 'expense',
      date: new Date().toISOString().split('T')[0],
    },
  })

  useEffect(() => {
    if (transaction) {
      reset({
        amount: transaction.amount,
        type: transaction.type,
        category_id: transaction.category_id ?? undefined,
        description: transaction.description ?? undefined,
        date: transaction.date,
      })
    }
  }, [transaction, reset])

  const selectedType = watch('type')
  const selectedCategoryId = watch('category_id')

  // Clear category when type changes and selected category no longer matches
  useEffect(() => {
    if (selectedCategoryId) {
      const cat = categories.find(c => c.id === selectedCategoryId)
      if (cat && cat.type !== selectedType && cat.type !== 'both') {
        setValue('category_id', undefined)
      }
    }
  }, [selectedType, selectedCategoryId, categories, setValue])

  async function onSubmit(data: TransactionInput) {
    try {
      const result = isEdit
        ? await updateTransaction(transaction!.id, data)
        : await createTransaction(data)
      if (result.error) { toast.error(result.error); return }
      toast.success(isEdit ? 'Transaction mise à jour' : 'Transaction ajoutée')
      onSuccess()
    } catch {
      toast.error('Une erreur inattendue est survenue.')
    }
  }

  const filteredCategories = categories.filter(c => c.type === selectedType || c.type === 'both')
  const selectedCategory = categories.find(c => c.id === selectedCategoryId)

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
              {selectedCategory?.name ?? 'Choisir une catégorie'}
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
        <Label htmlFor="date">Date</Label>
        <DatePicker id="date" value={watch('date')} onChange={v => setValue('date', v, { shouldValidate: true })} />
        {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" rows={2} {...register('description')} />
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Enregistrement...' : isEdit ? 'Mettre à jour' : 'Ajouter'}
      </Button>
    </form>
  )
}
