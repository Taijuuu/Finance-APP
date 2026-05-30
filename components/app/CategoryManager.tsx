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
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'
import type { ElementType } from 'react'

type Category = Database['public']['Tables']['categories']['Row']

const ICON_OPTIONS = ['home', 'car', 'utensils', 'shopping-cart', 'heart-pulse', 'smartphone', 'plane', 'briefcase', 'dumbbell', 'gift', 'music', 'book', 'coffee', 'camera', 'globe', 'star', 'zap', 'shield', 'credit-card', 'piggy-bank', 'trending-up', 'building', 'wrench', 'laptop', 'shirt', 'baby', 'paw-print', 'sun', 'moon', 'tree', 'bike', 'bus', 'film', 'gamepad', 'pizza', 'wine', 'flower', 'hammer', 'scissors']
const COLOR_OPTIONS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#F97316', '#EC4899', '#14B8A6', '#84CC16', '#0EA5E9', '#F43F5E', '#64748B']

const TYPE_LABELS: Record<string, string> = { expense: 'Dépense', income: 'Revenu', both: 'Les deux' }
const TYPE_COLORS: Record<string, string> = {
  expense: 'text-rose-500 bg-rose-50 dark:bg-rose-500/10',
  income: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10',
  both: 'text-blue-500 bg-blue-50 dark:bg-blue-500/10',
}

function iconToKey(iconName: string): string {
  return iconName.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('')
}

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

  const sorted = [...categories].sort((a, b) => {
    if (a.is_default !== b.is_default) return a.is_default ? 1 : -1
    return a.name.localeCompare(b.name, 'fr')
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Catégories</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{categories.length} catégorie{categories.length > 1 ? 's' : ''}</p>
        </div>
        <Button size="sm" onClick={openCreate}><Plus size={14} className="mr-1" />Nouvelle</Button>
      </div>

      <div className="rounded-xl border divide-y">
        {sorted.map(c => (
          <div key={c.id} className="flex items-center gap-3 px-4 py-3">
            <CategoryBadge name={c.name} iconName={c.icon_name} color={c.color} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{c.name}</p>
            </div>
            <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', TYPE_COLORS[c.type])}>
              {TYPE_LABELS[c.type]}
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => openEdit(c)}>
              <Pencil size={13} />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger render={<Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive hover:text-destructive" />}>
                <Trash2 size={13} />
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer «&nbsp;{c.name}&nbsp;» ?</AlertDialogTitle>
                  <AlertDialogDescription>Les transactions associées perdront leur catégorie. Cette action est irréversible.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleDelete(c.id)}>Supprimer</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ))}
        {categories.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-8">Aucune catégorie</p>
        )}
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader><SheetTitle>{editing ? 'Modifier la catégorie' : 'Nouvelle catégorie'}</SheetTitle></SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label>Nom</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Courses, Salaire..." />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={v => setType((v ?? 'expense') as typeof type)}>
                <SelectTrigger className="w-full">
                  <span className="flex-1 text-left text-sm">{TYPE_LABELS[type]}</span>
                </SelectTrigger>
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
                  const Icon = (LucideIcons as unknown as Record<string, ElementType>)[iconToKey(ico)]
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
            <div className="pt-1 flex items-center gap-2">
              <div className="text-xs text-muted-foreground">Aperçu :</div>
              <CategoryBadge name={name || 'Catégorie'} iconName={iconName} color={color} size="sm" />
            </div>
            <Button className="w-full" onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? 'Enregistrement...' : editing ? 'Mettre à jour' : 'Créer'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
