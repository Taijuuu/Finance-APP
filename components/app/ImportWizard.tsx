'use client'

import { useState, useCallback } from 'react'
import { read, utils } from 'xlsx'
import { toast } from 'sonner'
import { Upload, ChevronRight } from 'lucide-react'
import { parseAmount, parseRowDate, detectDuplicates, computeImportHash } from '@/lib/import-engine'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import type { Database } from '@/types/database'

type Category = Database['public']['Tables']['categories']['Row']

const FIELD_OPTIONS = ['montant', 'date', 'description', 'catégorie', 'ignorer'] as const
type FieldOption = typeof FIELD_OPTIONS[number]

interface Props { categories: Category[] }

export function ImportWizard({ categories }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [mapping, setMapping] = useState<Record<string, FieldOption>>({})
  const [positiveIsExpense, setPositiveIsExpense] = useState(true)
  const [dateFormat, setDateFormat] = useState<'DD/MM/YYYY' | 'MM/DD/YYYY' | 'ISO'>('DD/MM/YYYY')
  const [summary, setSummary] = useState<{ toImport: number; duplicates: number; errors: number } | null>(null)
  const [validRows, setValidRows] = useState<{ amount: number; type: 'expense' | 'income'; date: string; description: string }[]>([])
  const [importing, setImporting] = useState(false)

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = e => {
      const data = new Uint8Array(e.target!.result as ArrayBuffer)
      const wb = read(data, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const parsed: Record<string, unknown>[] = utils.sheet_to_json(ws, { defval: '' })
      if (parsed.length === 0) { toast.error('Fichier vide'); return }
      const hdrs = Object.keys(parsed[0])
      setHeaders(hdrs)
      setRows(parsed)
      const autoMapping: Record<string, FieldOption> = {}
      hdrs.forEach(h => {
        const lower = h.toLowerCase()
        if (lower.includes('mont') || lower.includes('amount')) autoMapping[h] = 'montant'
        else if (lower.includes('date')) autoMapping[h] = 'date'
        else if (lower.includes('desc') || lower.includes('lib')) autoMapping[h] = 'description'
        else autoMapping[h] = 'ignorer'
      })
      setMapping(autoMapping)
      setStep(2)
    }
    reader.readAsArrayBuffer(file)
  }, [])

  async function handleValidate() {
    const amountCol = Object.entries(mapping).find(([, v]) => v === 'montant')?.[0]
    const dateCol = Object.entries(mapping).find(([, v]) => v === 'date')?.[0]
    const descCol = Object.entries(mapping).find(([, v]) => v === 'description')?.[0]
    if (!amountCol || !dateCol) { toast.error('Colonne montant et date requises'); return }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: existing } = await supabase.from('transactions').select('date, amount, description').eq('user_id', user.id)
    const existingHashes = (existing ?? []).map(t => computeImportHash(t.date, Number(t.amount), t.description ?? ''))

    const rawRows = rows.map(r => ({
      rawAmount: r[amountCol],
      rawDate: String(r[dateCol]),
      description: descCol ? String(r[descCol] ?? '') : '',
    }))

    type ParsedRow = { amount: number; type: 'expense' | 'income'; date: string; description: string }
    let errors = 0
    const processed: ParsedRow[] = []
    for (const r of rawRows) {
      try {
        const { amount, type } = parseAmount(r.rawAmount as string | number, positiveIsExpense)
        const date = parseRowDate(r.rawDate, dateFormat)
        processed.push({ amount, type, date, description: r.description })
      } catch {
        errors++
      }
    }

    const withDupes = detectDuplicates(processed, existingHashes)
    const toImport = withDupes.filter(r => !r.isDuplicate)
    const duplicates = withDupes.filter(r => r.isDuplicate).length

    setValidRows(toImport as { amount: number; type: 'expense' | 'income'; date: string; description: string }[])
    setSummary({ toImport: toImport.length, duplicates, errors })
    setStep(3)
  }

  async function handleImport() {
    setImporting(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setImporting(false); return }

    const catMap = new Map(categories.map(c => [c.name.toLowerCase(), c.id]))
    const toInsert = validRows.map(r => ({
      user_id: user.id,
      amount: r.amount,
      type: r.type,
      date: r.date,
      description: r.description,
      category_id: catMap.get(r.description?.toLowerCase()) ?? null,
    }))

    const { error } = await supabase.from('transactions').insert(toInsert)
    setImporting(false)
    if (error) { toast.error(error.message); return }
    toast.success(`${toInsert.length} transactions importées`)
    setStep(1); setRows([]); setHeaders([]); setSummary(null)
  }

  if (step === 1) return (
    <div
      className="border-2 border-dashed rounded-xl p-12 text-center cursor-pointer hover:border-primary transition-colors"
      onDragOver={e => e.preventDefault()}
      onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
      onClick={() => document.getElementById('file-input')?.click()}
    >
      <Upload size={32} className="mx-auto text-muted-foreground mb-3" />
      <p className="text-sm font-medium">Déposez un fichier .xlsx ou .csv</p>
      <p className="text-xs text-muted-foreground mt-1">ou cliquez pour choisir</p>
      <input id="file-input" type="file" accept=".xlsx,.csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
    </div>
  )

  if (step === 2) return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">Mapper les colonnes</h2>
        <span className="text-sm text-muted-foreground">({rows.length} lignes détectées)</span>
      </div>
      <div className="rounded-xl border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>{headers.map(h => <th key={h} className="px-4 py-2 text-left font-medium text-xs">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.slice(0, 3).map((row, i) => (
              <tr key={i} className="border-t">
                {headers.map(h => <td key={h} className="px-4 py-2 text-muted-foreground truncate max-w-32">{String(row[h] ?? '')}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {headers.map(h => (
          <div key={h} className="space-y-1.5">
            <Label className="text-xs">{h}</Label>
            <Select value={mapping[h]} onValueChange={v => setMapping(m => ({ ...m, [h]: v as FieldOption }))}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{FIELD_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Montants positifs =</Label>
          <Select value={positiveIsExpense ? 'expense' : 'income'} onValueChange={v => setPositiveIsExpense(v === 'expense')}>
            <SelectTrigger className="h-8 text-xs w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="expense">Dépenses</SelectItem>
              <SelectItem value="income">Revenus</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Format date</Label>
          <Select value={dateFormat} onValueChange={v => setDateFormat(v as typeof dateFormat)}>
            <SelectTrigger className="h-8 text-xs w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="DD/MM/YYYY">JJ/MM/AAAA</SelectItem>
              <SelectItem value="MM/DD/YYYY">MM/JJ/AAAA</SelectItem>
              <SelectItem value="ISO">ISO (AAAA-MM-JJ)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button onClick={handleValidate} className="gap-2">Valider <ChevronRight size={14} /></Button>
    </div>
  )

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Résumé de l'import</h2>
      {summary && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border p-4 text-center">
            <p className="text-3xl font-bold text-foreground">{summary.toImport}</p>
            <p className="text-xs text-muted-foreground mt-1">à importer</p>
          </div>
          <div className="rounded-xl border p-4 text-center">
            <p className="text-3xl font-bold text-amber-500">{summary.duplicates}</p>
            <p className="text-xs text-muted-foreground mt-1">doublons ignorés</p>
          </div>
          <div className="rounded-xl border p-4 text-center">
            <p className="text-3xl font-bold text-destructive">{summary.errors}</p>
            <p className="text-xs text-muted-foreground mt-1">erreurs</p>
          </div>
        </div>
      )}
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => setStep(2)}>Retour</Button>
        <Button onClick={handleImport} disabled={importing || summary?.toImport === 0}>
          {importing ? 'Import en cours...' : `Importer ${summary?.toImport} transactions`}
        </Button>
      </div>
    </div>
  )
}
