'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { read, utils } from 'xlsx'
import { toast } from 'sonner'
import { Upload, Loader2 } from 'lucide-react'
import {
  detectDuplicates, computeImportHash,
  analyzeSheet, parseRows, isMappingUsable,
  type ImportRole, type ParsedRow, type DateFmt,
} from '@/lib/import-engine'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'

type Category = Database['public']['Tables']['categories']['Row']

interface Props { categories: Category[] }

const FIELD_LABELS: Record<ImportRole, string> = {
  montant: 'Montant',
  credit: 'Crédit',
  debit: 'Débit',
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
const SINGLE_ROLES: ImportRole[] = ['montant', 'credit', 'debit', 'date', 'description']

export function ImportWizard({ categories }: Props) {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [processing, setProcessing] = useState(false)
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<Record<string, ImportRole>>({})
  const [dateFormat, setDateFormat] = useState<DateFmt>('auto')
  const [summary, setSummary] = useState<{ toImport: number; duplicates: number; errors: number } | null>(null)
  const [validRows, setValidRows] = useState<ParsedRow[]>([])
  const [importing, setImporting] = useState(false)

  // Shared: parse rows with a mapping, detect duplicates against the DB, show the summary.
  const finishProcessing = useCallback(async (
    rows: Record<string, unknown>[],
    map: Record<string, ImportRole>,
    fmt: DateFmt,
  ) => {
    setProcessing(true)
    try {
      const { rows: parsed, errors } = parseRows(rows, map, fmt)

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setProcessing(false); return }

      const { data: existing } = await supabase.from('transactions').select('date, amount, description').eq('user_id', user.id)
      const existingHashes = (existing ?? []).map(t => computeImportHash(t.date, Number(t.amount), t.description ?? ''))

      const withDupes = detectDuplicates(parsed, existingHashes)
      const toImport = withDupes.filter(r => !r.isDuplicate).map(({ amount, type, date, description }) => ({ amount, type, date, description }))
      const duplicates = withDupes.filter(r => r.isDuplicate).length

      setValidRows(toImport)
      setSummary({ toImport: toImport.length, duplicates, errors })
      setStep(3)
    } catch {
      toast.error('Erreur lors de l\'analyse des données')
    } finally {
      setProcessing(false)
    }
  }, [])

  // Step 1 → read the file, locate the real header row, auto-map columns.
  // If everything is detected, go straight to the summary (fully automatic).
  // Otherwise drop into the manual mapping step.
  const handleFile = useCallback(async (file: File) => {
    setProcessing(true)
    try {
      const buffer = await file.arrayBuffer()
      const wb = read(new Uint8Array(buffer), { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const matrix = utils.sheet_to_json(ws, { header: 1, cellDates: true, blankrows: false, defval: '' } as any) as unknown[][]
      if (!matrix.length) { toast.error('Fichier vide'); setProcessing(false); return }

      const { headers: hdrs, dataRows, mapping: map } = analyzeSheet(matrix)
      setRawRows(dataRows)
      setHeaders(hdrs)
      setMapping(map)
      setDateFormat('auto')

      if (isMappingUsable(map)) {
        await finishProcessing(dataRows, map, 'auto')
      } else {
        setStep(2)
        setProcessing(false)
      }
    } catch {
      toast.error('Erreur lors de la lecture du fichier')
      setProcessing(false)
    }
  }, [finishProcessing])

  function setColumn(header: string, role: ImportRole) {
    setMapping(prev => {
      const next = { ...prev, [header]: role }
      if (SINGLE_ROLES.includes(role)) {
        for (const h of Object.keys(next)) {
          if (h !== header && next[h] === role) next[h] = 'ignorer'
        }
      }
      return next
    })
  }

  function reset() {
    setStep(1)
    setRawRows([]); setHeaders([]); setMapping({}); setDateFormat('auto')
    setSummary(null); setValidRows([])
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
      {!processing && <p className="text-xs text-muted-foreground mt-1">ou cliquez pour choisir — relevés bancaires (débit/crédit) gérés automatiquement</p>}
      <input id="file-input" type="file" accept=".xlsx,.csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
    </div>
  )

  // ── Step 2: manual mapping fallback (any layout) ───────────────────
  if (step === 2) {
    const preview = rawRows.slice(0, 3)
    const usable = isMappingUsable(mapping)
    const hasAmount = Object.values(mapping).some(r => r === 'montant' || r === 'credit' || r === 'debit')
    const hasDate = Object.values(mapping).includes('date')
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Associez vos colonnes</h2>
          <p className="text-sm text-muted-foreground mt-1">Détection automatique impossible. Indiquez à quoi correspond chaque colonne. Date + (Montant ou Crédit/Débit) sont obligatoires.</p>
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
                <Select value={mapping[h]} onValueChange={v => setColumn(h, (v as ImportRole) ?? 'ignorer')}>
                  <SelectTrigger className="w-full">
                    <span className={cn('flex-1 text-left text-sm', mapping[h] === 'ignorer' && 'text-muted-foreground')}>
                      {FIELD_LABELS[mapping[h] ?? 'ignorer']}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(FIELD_LABELS) as ImportRole[]).map(f => (
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

        {!usable && (
          <p className="text-xs text-amber-500">
            {!hasDate && !hasAmount ? 'Sélectionnez une colonne Date et une colonne Montant (ou Crédit/Débit).'
              : !hasDate ? 'Sélectionnez une colonne Date.'
              : 'Sélectionnez une colonne Montant (ou Crédit/Débit).'}
          </p>
        )}

        <div className="flex gap-3">
          <Button variant="outline" onClick={reset}>Recommencer</Button>
          <Button onClick={() => finishProcessing(rawRows, mapping, dateFormat)} disabled={processing || !usable}>
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
        <Button variant="outline" onClick={() => { setStep(2); setProcessing(false) }}>Ajuster les colonnes</Button>
        <Button onClick={handleImport} disabled={importing || summary?.toImport === 0}>
          {importing ? 'Import en cours...' : `Importer ${summary?.toImport} transactions`}
        </Button>
      </div>
    </div>
  )
}
