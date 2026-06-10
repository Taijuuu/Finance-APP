'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { read, utils } from 'xlsx'
import { toast } from 'sonner'
import { Upload, Loader2 } from 'lucide-react'
import { parseAmount, parseRowDate, detectDuplicates, computeImportHash } from '@/lib/import-engine'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'

type Category = Database['public']['Tables']['categories']['Row']
type FieldOption = 'montant' | 'date' | 'description' | 'ignorer'
type DateFmt = 'auto' | 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'ISO'
type ParsedRow = { amount: number; type: 'expense' | 'income'; date: string; description: string }

interface Props { categories: Category[] }

const FIELD_LABELS: Record<FieldOption, string> = {
  montant: 'Montant',
  date: 'Date',
  description: 'Description',
  ignorer: 'Ignorer',
}
const DATE_LABELS: Record<DateFmt, string> = {
  auto: 'Détection auto',
  'DD/MM/YYYY': 'Jour/Mois/Année',
  'MM/DD/YYYY': 'Mois/Jour/Année',
  ISO: 'Année-Mois-Jour (ISO)',
}

function autoDetectDateFormat(sample: string): 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'ISO' {
  if (/^\d{4}-\d{2}-\d{2}/.test(sample)) return 'ISO'
  const parts = sample.split(/[\/\-\.]/)
  if (parts.length === 3 && Number(parts[0]) > 12) return 'DD/MM/YYYY'
  return 'DD/MM/YYYY'
}

// Best-effort guess so the mapping step is pre-filled; the user can always override.
function autoDetectMapping(headers: string[]): Record<string, FieldOption> {
  const mapping: Record<string, FieldOption> = {}
  let hasMontant = false
  let hasDate = false
  for (const h of headers) {
    const lower = h.toLowerCase()
    if (!hasMontant && (lower.includes('mont') || lower.includes('amount') || lower.includes('valeur') || lower.includes('débit') || lower.includes('debit') || lower.includes('crédit') || lower.includes('credit') || lower.includes('somme'))) {
      mapping[h] = 'montant'; hasMontant = true
    } else if (!hasDate && lower.includes('date')) {
      mapping[h] = 'date'; hasDate = true
    } else if (lower.includes('desc') || lower.includes('lib') || lower.includes('motif') || lower.includes('nature') || lower.includes('intitul')) {
      mapping[h] = 'description'
    } else {
      mapping[h] = 'ignorer'
    }
  }
  return mapping
}

export function ImportWizard({ categories }: Props) {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [processing, setProcessing] = useState(false)
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<Record<string, FieldOption>>({})
  const [dateFormat, setDateFormat] = useState<DateFmt>('auto')
  const [summary, setSummary] = useState<{ toImport: number; duplicates: number; errors: number } | null>(null)
  const [validRows, setValidRows] = useState<ParsedRow[]>([])
  const [importing, setImporting] = useState(false)

  // Step 1 → read the file, extract headers + rows, pre-fill the mapping, then show the mapping step.
  const handleFile = useCallback(async (file: File) => {
    setProcessing(true)
    try {
      const buffer = await file.arrayBuffer()
      const wb = read(new Uint8Array(buffer), { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsed: Record<string, unknown>[] = utils.sheet_to_json(ws, { defval: '', cellDates: true } as any)
      if (parsed.length === 0) { toast.error('Fichier vide'); setProcessing(false); return }

      const hdrs = Object.keys(parsed[0])
      setRawRows(parsed)
      setHeaders(hdrs)
      setMapping(autoDetectMapping(hdrs))
      setDateFormat('auto')
      setStep(2)
    } catch {
      toast.error('Erreur lors de la lecture du fichier')
    } finally {
      setProcessing(false)
    }
  }, [])

  function setColumn(header: string, role: FieldOption) {
    setMapping(prev => {
      const next = { ...prev, [header]: role }
      // Montant and Date are single-column roles: clear any previous holder.
      if (role === 'montant' || role === 'date') {
        for (const h of Object.keys(next)) {
          if (h !== header && next[h] === role) next[h] = 'ignorer'
        }
      }
      return next
    })
  }

  // Step 2 → apply the mapping, parse every row, detect duplicates, then show the summary.
  async function handleMapping() {
    const amountCol = Object.entries(mapping).find(([, v]) => v === 'montant')?.[0]
    const dateCol = Object.entries(mapping).find(([, v]) => v === 'date')?.[0]
    const descCol = Object.entries(mapping).find(([, v]) => v === 'description')?.[0]

    if (!amountCol || !dateCol) {
      toast.error('Assigne au moins une colonne « Montant » et une colonne « Date »')
      return
    }

    setProcessing(true)
    try {
      const firstDateVal = rawRows.find(r => r[dateCol])?.[dateCol]
      const resolvedFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'ISO' = dateFormat !== 'auto'
        ? dateFormat
        : firstDateVal instanceof Date || typeof firstDateVal === 'number'
          ? 'ISO'
          : autoDetectDateFormat(String(firstDateVal ?? ''))

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setProcessing(false); return }

      const { data: existing } = await supabase.from('transactions').select('date, amount, description').eq('user_id', user.id)
      const existingHashes = (existing ?? []).map(t => computeImportHash(t.date, Number(t.amount), t.description ?? ''))

      let errors = 0
      const processed: ParsedRow[] = []
      for (const r of rawRows) {
        try {
          const { amount, type } = parseAmount(r[amountCol] as string | number)
          const date = parseRowDate(r[dateCol] as string | number | Date, resolvedFormat)
          const description = descCol ? String(r[descCol] ?? '') : ''
          processed.push({ amount, type, date, description })
        } catch {
          errors++
        }
      }

      const withDupes = detectDuplicates(processed, existingHashes)
      const toImport = withDupes.filter(r => !r.isDuplicate) as ParsedRow[]
      const duplicates = withDupes.filter(r => r.isDuplicate).length

      setValidRows(toImport)
      setSummary({ toImport: toImport.length, duplicates, errors })
      setStep(3)
    } catch {
      toast.error('Erreur lors de l\'analyse des données')
    } finally {
      setProcessing(false)
    }
  }

  function reset() {
    setStep(1)
    setRawRows([])
    setHeaders([])
    setMapping({})
    setDateFormat('auto')
    setSummary(null)
    setValidRows([])
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
    reset()
    router.refresh()
  }

  // ── Step 1: drop zone ──────────────────────────────────────────────
  if (step === 1) return (
    <div
      className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${processing ? 'opacity-60 cursor-wait' : 'cursor-pointer hover:border-primary'}`}
      onDragOver={e => e.preventDefault()}
      onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f && !processing) handleFile(f) }}
      onClick={() => !processing && document.getElementById('file-input')?.click()}
    >
      {processing
        ? <Loader2 size={32} className="mx-auto text-muted-foreground mb-3 animate-spin" />
        : <Upload size={32} className="mx-auto text-muted-foreground mb-3" />}
      <p className="text-sm font-medium">{processing ? 'Analyse en cours...' : 'Déposez un fichier .xlsx ou .csv'}</p>
      {!processing && <p className="text-xs text-muted-foreground mt-1">ou cliquez pour choisir</p>}
      <input id="file-input" type="file" accept=".xlsx,.csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
    </div>
  )

  // ── Step 2: column mapping (works with ANY file layout) ────────────
  if (step === 2) {
    const preview = rawRows.slice(0, 3)
    const hasAmount = Object.values(mapping).includes('montant')
    const hasDate = Object.values(mapping).includes('date')
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Associez vos colonnes</h2>
          <p className="text-sm text-muted-foreground mt-1">Indiquez à quoi correspond chaque colonne de votre fichier. Montant et date sont obligatoires.</p>
        </div>

        <div className="space-y-2">
          {headers.map(h => (
            <div key={h} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{h}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {preview.map(r => String(r[h] ?? '')).filter(Boolean).slice(0, 2).join(' · ') || '—'}
                </p>
              </div>
              <div className="w-44 shrink-0">
                <Select value={mapping[h]} onValueChange={v => setColumn(h, (v as FieldOption) ?? 'ignorer')}>
                  <SelectTrigger className="w-full">
                    <span className={cn('flex-1 text-left text-sm', mapping[h] === 'ignorer' && 'text-muted-foreground')}>
                      {FIELD_LABELS[mapping[h] ?? 'ignorer']}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(FIELD_LABELS) as FieldOption[]).map(f => (
                      <SelectItem key={f} value={f}>{FIELD_LABELS[f]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <p className="text-sm font-medium flex-1">Format des dates</p>
          <div className="w-44 shrink-0">
            <Select value={dateFormat} onValueChange={v => setDateFormat((v as DateFmt) ?? 'auto')}>
              <SelectTrigger className="w-full">
                <span className="flex-1 text-left text-sm">{DATE_LABELS[dateFormat]}</span>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(DATE_LABELS) as DateFmt[]).map(f => (
                  <SelectItem key={f} value={f}>{DATE_LABELS[f]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {(!hasAmount || !hasDate) && (
          <p className="text-xs text-amber-500">
            {!hasAmount && !hasDate ? 'Sélectionnez une colonne Montant et une colonne Date.'
              : !hasAmount ? 'Sélectionnez une colonne Montant.'
              : 'Sélectionnez une colonne Date.'}
          </p>
        )}

        <div className="flex gap-3">
          <Button variant="outline" onClick={reset}>Recommencer</Button>
          <Button onClick={handleMapping} disabled={processing || !hasAmount || !hasDate}>
            {processing ? 'Analyse en cours...' : 'Continuer'}
          </Button>
        </div>
      </div>
    )
  }

  // ── Step 3: summary + import ───────────────────────────────────────
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Résumé de l&apos;import</h2>
      {summary && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{summary.toImport}</p>
            <p className="text-xs text-muted-foreground mt-1">à importer</p>
          </div>
          <div className="rounded-xl border p-3 text-center">
            <p className="text-2xl font-bold text-amber-500">{summary.duplicates}</p>
            <p className="text-xs text-muted-foreground mt-1">doublons ignorés</p>
          </div>
          <div className="rounded-xl border p-3 text-center">
            <p className="text-2xl font-bold text-destructive">{summary.errors}</p>
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
