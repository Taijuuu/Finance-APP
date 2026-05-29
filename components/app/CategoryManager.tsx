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
import type { ElementType } from 'react'

type Category = Database['public']['Tables']['categories']['Row']

const ICON_OPTIONS = ['home', 'car', 'utensils', 'shopping-cart', 'heart-pulse', 'smartphone', 'plane', 'briefcase', 'dumbbell', 'gift', 'music', 'book', 'coffee', 'camera', 'globe', 'star', 'zap', 'shield', 'credit-card', 'piggy-bank', 'trending-up', 'building', 'wrench', 'laptop', 'shirt', 'baby', 'paw-print', 'sun', 'moon', 'tree', 'bike', 'bus', 'film', 'gamepad', 'pizza', 'wine', 'flower', 'hammer', 'scissors']
const COLOR_OPTIONS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#F97316', '#EC4899', '#14B8A6', '#84CC16', '#0EA5E9', '#F43F5E', '#64748B']

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
                <AlertDialogTrigger render={<Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" />}>
                  <Trash2 size={13} />
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Supprimer cette catégorie ?</AlertDialogTitle>
                    <AlertDialogDescription>Les transactions associées perdront leur catégorie.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDelete(c.id)}>Supprimer</AlertDialogAction>
                  </AlertDialogFooter>
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
              <Select value={type} onValueChange={v => setType((v ?? 'expense') as typeof type)}>
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
            <Button className="w-full" onClick={handleSave} disabled={saving || !name}>
              {saving ? '...' : editing ? 'Mettre à jour' : 'Créer'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
