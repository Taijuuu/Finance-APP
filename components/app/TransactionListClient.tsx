'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import { deleteTransaction, deleteAllTransactions } from '@/app/actions/transactions'
import { TransactionForm } from './TransactionForm'
import { CategoryBadge } from './CategoryBadge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import { ExportButton } from '@/components/app/ExportButton'
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
  summary: { income: number; expenses: number; count: number }
  currentPage: number
  searchParams: Record<string, string | undefined>
}

export function TransactionListClient({ transactions, categories, totalCount, summary, currentPage, searchParams }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const pageSize = 20
  const totalPages = Math.ceil(totalCount / pageSize)

  // Compact, responsive pagination: show first/last, current page and its neighbours,
  // with ellipses in between so the bar never overflows on small screens.
  function getPageItems(): (number | 'ellipsis')[] {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const pages = new Set<number>([1, totalPages, currentPage, currentPage - 1, currentPage + 1])
    const sorted = [...pages].filter(p => p >= 1 && p <= totalPages).sort((a, b) => a - b)
    const items: (number | 'ellipsis')[] = []
    let prev = 0
    for (const p of sorted) {
      if (p - prev > 1) items.push('ellipsis')
      items.push(p)
      prev = p
    }
    return items
  }

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
      <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
        <h1 className="text-2xl font-bold">Transactions</h1>
        <div className="flex items-center gap-2 flex-wrap">
        <ExportButton variant="outline" size="sm" compact />
        <AlertDialog>
          <AlertDialogTrigger
            render={<Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive" />}
          >
            <Trash2 size={14} className="sm:mr-1.5" /> <span className="hidden sm:inline">Tout supprimer</span>
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
      </div>

      <div className="mb-4 rounded-xl border bg-card p-4 overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 to-transparent pointer-events-none" />
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            Dépense totale {summary.count > 0 && <span className="normal-case">· {summary.count} transaction{summary.count > 1 ? 's' : ''}</span>}
          </p>
          <p className="text-xl sm:text-2xl font-bold text-rose-500">{formatCurrency(summary.expenses)}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2 mb-4">
        <div className="flex flex-wrap gap-2">
          <div className="flex-1 min-w-[150px] sm:flex-none sm:w-44">
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
            <SelectTrigger className="flex-1 min-w-[130px] sm:flex-none sm:w-36">
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
            className="h-9 rounded-md border px-3 text-base md:text-sm bg-background flex-1 min-w-[140px]"
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
              <div key={t.id} className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 hover:bg-muted/30 transition-colors">
                {t.categories && (
                  <CategoryBadge name="" iconName={t.categories.icon_name} color={t.categories.color} size="sm" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{t.description || t.categories?.name || '—'}</p>
                  <p className="text-xs text-muted-foreground truncate">{formatDate(t.date)} · {t.categories?.name}</p>
                </div>
                <span className={`text-sm font-semibold shrink-0 whitespace-nowrap ${t.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
                  {t.type === 'income' ? '+' : '-'}{formatCurrency(Number(t.amount))}
                </span>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => openEdit(t)}>
                  <Pencil size={13} />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger
                    render={<Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive hover:text-destructive" />}
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
        <div className="flex flex-wrap justify-center items-center gap-1.5 mt-4">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            disabled={currentPage <= 1}
            onClick={() => setParam('page', String(currentPage - 1))}
            aria-label="Page précédente"
          >
            <ChevronLeft size={15} />
          </Button>
          {getPageItems().map((p, i) =>
            p === 'ellipsis' ? (
              <span key={`e${i}`} className="px-1 text-muted-foreground select-none">…</span>
            ) : (
              <Button
                key={p}
                variant={p === currentPage ? 'default' : 'outline'}
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => setParam('page', String(p))}
              >
                {p}
              </Button>
            )
          )}
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            disabled={currentPage >= totalPages}
            onClick={() => setParam('page', String(currentPage + 1))}
            aria-label="Page suivante"
          >
            <ChevronRight size={15} />
          </Button>
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
