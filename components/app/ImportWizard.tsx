'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { read, utils } from 'xlsx'
import { toast } from 'sonner'
import { Upload, Loader2 } from 'lucide-react'
import { parseAmount, parseRowDate, detectDuplicates, computeImportHash } from '@/lib/import-engine'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import type { Database } from '@/types/database'

type Category = Database['public']['Tables']['categories']['Row']
type FieldOption = 'montant' | 'date' | 'description' | 'ignorer'
type ParsedRow = { amount: number; type: 'expense' | 'income'; date: string; description: string }

interface Props { categories: Category[] }

function autoDetectDateFormat(sample: string): 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'ISO' {
  if (/^\d{4}-\d{2}-\d{2}/.test(sample)) return 'ISO'
  const parts = sample.split(/[\/\-\.]/)
  if (parts.length === 3 && Number(parts[0]) > 12) return 'DD/MM/YYYY'
  return 'DD/MM/YYYY'
}

export function ImportWizard({ categories }: Props) {
  const router = useRouter()
  const [step, setStep] = useState<1 | 3>(1)
  const [processing, setProcessing] = useState(false)
  const [summary, setSummary] = useState<{ toImport: number; duplicates: number; errors: number } | null>(null)
  const [validRows, setValidRows] = useState<ParsedRow[]>([])
  const [importing, setImporting] = useState(false)

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
      const mapping: Record<string, FieldOption> = {}
      hdrs.forEach(h => {
        const lower = h.toLowerCase()
        if (lower.includes('mont') || lower.includes('amount')) mapping[h] = 'montant'
        else if (lower.includes('date')) mapping[h] = 'date'
        else if (lower.includes('desc') || lower.includes('lib')) mapping[h] = 'description'
        else mapping[h] = 'ignorer'
      })

      const amountCol = Object.entries(mapping).find(([, v]) => v === 'montant')?.[0]
      const dateCol = Object.entries(mapping).find(([, v]) => v === 'date')?.[0]
      const descCol = Object.entries(mapping).find(([, v]) => v === 'description')?.[0]

      if (!amountCol || !dateCol) { toast.error('Colonnes montant/date introuvables dans le fichier'); setProcessing(false); return }

      const firstDateVal = parsed.find(r => r[dateCol])?.[dateCol]
      const dateFormat = firstDateVal instanceof Date || typeof firstDateVal === 'number'
        ? 'ISO'
        : autoDetectDateFormat(String(firstDateVal ?? ''))

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setProcessing(false); return }

      const { data: existing } = await supabase.from('transactions').select('date, amount, description').eq('user_id', user.id)
      const existingHashes = (existing ?? []).map(t => computeImportHash(t.date, Number(t.amount), t.description ?? ''))

      let errors = 0
      const processed: ParsedRow[] = []
      for (const r of parsed) {
        try {
          const { amount, type } = parseAmount(r[amountCol] as string | number)
          const date = parseRowDate(r[dateCol] as string | number | Date, dateFormat)
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
      toast.error('Erreur lors de la lecture du fichier')
    } finally {
      setProcessing(false)
    }
  }, [])

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
    setStep(1); setSummary(null); setValidRows([])
    router.refresh()
  }

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

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Résumé de l'import</h2>
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
        <Button variant="outline" onClick={() => { setStep(1); setSummary(null); setValidRows([]) }}>Recommencer</Button>
        <Button onClick={handleImport} disabled={importing || summary?.toImport === 0}>
          {importing ? 'Import en cours...' : `Importer ${summary?.toImport} transactions`}
        </Button>
      </div>
    </div>
  )
}
