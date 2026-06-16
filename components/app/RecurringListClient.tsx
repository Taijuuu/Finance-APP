'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { toggleRecurring, deleteRecurring } from '@/app/actions/recurring'
import { RecurringForm } from './RecurringForm'
import { CategoryBadge } from './CategoryBadge'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { formatCurrency } from '@/lib/utils'
import { computeMissingOccurrences } from '@/lib/recurring-engine'
import type { Database } from '@/types/database'

type Recurring = Database['public']['Tables']['recurring_transactions']['Row'] & {
  categories: Pick<Database['public']['Tables']['categories']['Row'], 'id' | 'name' | 'icon_name' | 'color'> | null
}
type Category = Database['public']['Tables']['categories']['Row']

const FREQ_LABELS: Record<string, string> = { weekly: 'Hebdo', monthly: 'Mensuel', yearly: 'Annuel' }

function nextOccurrence(r: Recurring): string {
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const upcoming = computeMissingOccurrences(
    { frequency: r.frequency, start_date: r.start_date, last_generated: null },
    new Date(today.getFullYear() + 2, 0, 1)
  )
  return upcoming.find(d => d > todayStr) ?? '—'
}

function estimatedMonthly(recurrings: Recurring[]): number {
  return recurrings.filter(r => r.is_active).reduce((sum, r) => {
    const factor = r.frequency === 'weekly' ? 4.33 : r.frequency === 'yearly' ? 1 / 12 : 1
    return sum + Number(r.amount) * factor * (r.type === 'expense' ? 1 : -1)
  }, 0)
}

interface Props { recurrings: Recurring[]; categories: Category[] }

export function RecurringListClient({ recurrings, categories }: Props) {
  const router = useRouter()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Recurring | null>(null)

  async function handleToggle(id: string, current: boolean) {
    try {
      const result = await toggleRecurring(id, !current)
      if (result.error) toast.error(result.error)
      else { toast.success(!current ? 'Activé' : 'Désactivé'); router.refresh() }
    } catch { toast.error('Une erreur inattendue est survenue.') }
  }

  async function handleDelete(id: string) {
    try {
      const result = await deleteRecurring(id)
      if (result.error) toast.error(result.error)
      else { toast.success('Récurrent supprimé'); router.refresh() }
    } catch { toast.error('Une erreur inattendue est survenue.') }
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
            <Badge
              variant={r.is_active ? 'default' : 'secondary'}
              className="cursor-pointer"
              onClick={() => handleToggle(r.id, r.is_active)}
            >
              {r.is_active ? 'Actif' : 'Inactif'}
            </Badge>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(r); setSheetOpen(true) }}>
              <Pencil size={13} />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger render={<Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" />}>
                <Trash2 size={13} />
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer ce récurrent ?</AlertDialogTitle>
                  <AlertDialogDescription>Toutes les transactions générées par ce récurrent seront aussi supprimées et retirées des totaux.</AlertDialogDescription>
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

      <Dialog open={sheetOpen} onOpenChange={setSheetOpen}>
        <DialogContent className="w-full max-w-md overflow-y-auto max-h-[90dvh]">
          <DialogHeader><DialogTitle>{editing ? 'Modifier' : 'Nouvelle transaction récurrente'}</DialogTitle></DialogHeader>
          <RecurringForm recurring={editing} categories={categories} onSuccess={() => { setSheetOpen(false); router.refresh() }} />
        </DialogContent>
      </Dialog>
    </>
  )
}
