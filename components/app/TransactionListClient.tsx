'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { deleteTransaction } from '@/app/actions/transactions'
import { TransactionForm } from './TransactionForm'
import { CategoryBadge } from './CategoryBadge'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Database } from '@/types/database'

type Transaction = Database['public']['Tables']['transactions']['Row'] & {
  categories: Pick<Database['public']['Tables']['categories']['Row'], 'id' | 'name' | 'icon_name' | 'color'> | null
}
type Category = Database['public']['Tables']['categories']['Row']

interface Props {
  transactions: Transaction[]
  categories: Category[]
  totalCount: number
  currentPage: number
  searchParams: Record<string, string | undefined>
}

export function TransactionListClient({ transactions, categories, totalCount, currentPage, searchParams }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const pageSize = 20
  const totalPages = Math.ceil(totalCount / pageSize)

  function openCreate() { setEditing(null); setSheetOpen(true) }
  function openEdit(t: Transaction) { setEditing(t); setSheetOpen(true) }

  async function handleDelete(id: string) {
    try {
      const result = await deleteTransaction(id)
      if (result.error) toast.error(result.error)
      else toast.success('Transaction supprimée')
    } catch {
      toast.error('Une erreur inattendue est survenue.')
    }
  }

  function setParam(key: string, value: string | undefined) {
    const params = new URLSearchParams(searchParams as Record<string, string>)
    if (value) params.set(key, value); else params.delete(key)
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <>
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          type="month"
          className="h-9 rounded-md border px-3 text-sm bg-background"
          value={searchParams.month ?? ''}
          onChange={e => setParam('month', e.target.value || undefined)}
        />
        <select
          className="h-9 rounded-md border px-3 text-sm bg-background"
          value={searchParams.type ?? ''}
          onChange={e => setParam('type', e.target.value || undefined)}
        >
          <option value="">Tous types</option>
          <option value="expense">Dépenses</option>
          <option value="income">Revenus</option>
        </select>
        <select
          className="h-9 rounded-md border px-3 text-sm bg-background"
          value={searchParams.category ?? ''}
          onChange={e => setParam('category', e.target.value || undefined)}
        >
          <option value="">Toutes catégories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input
          type="search"
          placeholder="Rechercher..."
          className="h-9 rounded-md border px-3 text-sm bg-background"
          defaultValue={searchParams.q ?? ''}
          onKeyDown={e => { if (e.key === 'Enter') setParam('q', (e.target as HTMLInputElement).value || undefined) }}
        />
        <Button onClick={openCreate} size="sm" className="ml-auto">
          <Plus size={14} className="mr-1" /> Ajouter
        </Button>
      </div>

      <div className="rounded-xl border overflow-hidden">
        {transactions.length === 0 ? (
          <p className="text-center text-muted-foreground py-12 text-sm">Aucune transaction trouvée</p>
        ) : (
          <div className="divide-y">
            {transactions.map(t => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                {t.categories && (
                  <CategoryBadge name="" iconName={t.categories.icon_name} color={t.categories.color} size="sm" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{t.description || t.categories?.name || '—'}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(t.date)} · {t.categories?.name}</p>
                </div>
                <span className={`text-sm font-semibold ${t.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
                  {t.type === 'income' ? '+' : '-'}{formatCurrency(Number(t.amount))}
                </span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}>
                  <Pencil size={13} />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger
                    render={<Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" />}
                  >
                    <Trash2 size={13} />
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Supprimer la transaction ?</AlertDialogTitle>
                      <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(t.id)}>Supprimer</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <Button
              key={p}
              variant={p === currentPage ? 'default' : 'outline'}
              size="sm"
              onClick={() => setParam('page', String(p))}
            >
              {p}
            </Button>
          ))}
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{editing ? 'Modifier la transaction' : 'Nouvelle transaction'}</SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            <TransactionForm
              transaction={editing}
              categories={categories}
              onSuccess={() => setSheetOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
