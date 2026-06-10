'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { deleteTransaction, deleteAllTransactions } from '@/app/actions/transactions'
import { TransactionForm } from './TransactionForm'
import { CategoryBadge } from './CategoryBadge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
      else { toast.success('Transaction supprimée'); router.refresh() }
    } catch {
      toast.error('Une erreur inattendue est survenue.')
    }
  }

  async function handleDeleteAll() {
    try {
      const result = await deleteAllTransactions()
      if (result.error) toast.error(result.error)
      else { toast.success('Toutes les transactions ont été supprimées'); router.refresh() }
    } catch {
      toast.error('Une erreur inattendue est survenue.')
    }
  }

  function setParam(key: string, value: string | undefined) {
    const params = new URLSearchParams(searchParams as Record<string, string>)
    if (value) params.set(key, value); else params.delete(key)
    if (key !== 'page') params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Transactions</h1>
        <AlertDialog>
          <AlertDialogTrigger
            render={<Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive" />}
          >
            <Trash2 size={14} className="mr-1.5" /> Tout supprimer
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer toutes les transactions ?</AlertDialogTitle>
              <AlertDialogDescription>
                Cette action supprimera définitivement toutes vos transactions et réinitialisera le dashboard. Cette action est irréversible.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleDeleteAll}
              >
                Tout supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="flex flex-col gap-2 mb-4">
        <div className="flex flex-wrap gap-2">
          <div className="w-44">
            <DatePicker
              mode="month"
              value={searchParams.month ?? ''}
              onChange={v => setParam('month', v || undefined)}
              placeholder="Tous les mois"
            />
          </div>
          <Select
            value={searchParams.type ?? ''}
            onValueChange={v => setParam('type', (!v || v === '_all') ? undefined : v)}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Tous types">
                {v => v === 'expense' ? 'Dépenses' : v === 'income' ? 'Revenus' : 'Tous types'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Tous types</SelectItem>
              <SelectItem value="expense">Dépenses</SelectItem>
              <SelectItem value="income">Revenus</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={searchParams.category ?? ''}
            onValueChange={v => setParam('category', (!v || v === '_all') ? undefined : v)}
          >
            <SelectTrigger className="flex-1 min-w-0 max-w-48">
              <SelectValue placeholder="Toutes catégories">
                {v => categories.find(c => c.id === v)?.name ?? 'Toutes catégories'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Toutes catégories</SelectItem>
              {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <input
            type="search"
            placeholder="Rechercher..."
            className="h-9 rounded-md border px-3 text-sm bg-background flex-1 min-w-[140px]"
            defaultValue={searchParams.q ?? ''}
            onKeyDown={e => { if (e.key === 'Enter') setParam('q', (e.target as HTMLInputElement).value || undefined) }}
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={openCreate} size="sm" className="flex-1 sm:flex-none">
            <Plus size={14} className="mr-1" /> Ajouter
          </Button>
        </div>
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

      <Dialog open={sheetOpen} onOpenChange={setSheetOpen}>
        <DialogContent className="sm:max-w-lg overflow-y-auto max-h-[90dvh]">
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier la transaction' : 'Nouvelle transaction'}</DialogTitle>
          </DialogHeader>
          <TransactionForm
            transaction={editing}
            categories={categories}
            onSuccess={() => setSheetOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
